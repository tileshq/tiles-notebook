'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect, useRef, useState } from 'react';
import { $getSelection, $isRangeSelection, $isTextNode, COMMAND_PRIORITY_EDITOR, LexicalCommand, $createTextNode, $createParagraphNode, TextNode, $insertNodes, LexicalNode } from 'lexical';
import { $createHorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { useMcpContext } from '@/contexts/McpContext';
import { REMOTE_MCP_SERVERS } from '../../lib/mcp-client-manager';
import { CSSProperties } from 'react';
import { createWasmExecutorFromBuffer, WasmExecutorResult, WasmExecutorOptions, WasmExecutor } from '../../lib/wasm-executor';
import { $createArtifactNode, $isArtifactNode, ArtifactContentType } from '../../nodes/ArtifactNode';
import { $setSelection } from 'lexical';

// Define a custom command for running MCP
export const RUN_MCP_COMMAND: LexicalCommand<void> = {
  type: 'RUN_MCP_COMMAND',
};

// Types for conversation
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: any;
  type?: string;
}

interface ServletInfo {
  slug: string;
  contentAddress?: string;
  functionName?: string;
  config?: Record<string, any>;
  meta?: {
    schema?: {
      description?: string;
      tools?: {
        name: string;
        description: string;
        inputSchema: {
          type: string;
          properties: Record<string, any>;
          required?: string[];
        };
        parameters?: {
          properties: Record<string, any>;
        };
      }[];
      name?: string;
    };
  };
}

interface ServletTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  servletSlug: string;
}

interface ToolUseSubmessage {
  type: 'tool_use';
  id: string;
  name: string;
  input: any;
}

// --- Define Artifact Structure ---
interface ArtifactStructure {
    type: 'artifact';
    contentType: ArtifactContentType;
    content: string;
    metadata?: Record<string, any>; // Optional metadata
}

// Helper to check if an object is a valid artifact
function isValidArtifact(obj: any): obj is ArtifactStructure {
    // console.log('Validating artifact:', obj);
    const isValid = obj &&
           obj.type === 'artifact' &&
           typeof obj.contentType === 'string' &&
           typeof obj.content === 'string' &&
           ['application/vnd.ant.html', 'text/markdown', 'application/vnd.ant.mermaid'].includes(obj.contentType);
    
    // console.log('Artifact validation result:', isValid);
    if (!isValid) {
      // console.log('Validation failed because:');
      if (!obj) // console.log('- Object is null or undefined');
      if (obj && obj.type !== 'artifact') // console.log('- Type is not "artifact"');
      if (obj && typeof obj.contentType !== 'string') // console.log('- contentType is not a string');
      if (obj && typeof obj.content !== 'string') // console.log('- content is not a string');
      if (obj && typeof obj.contentType === 'string' && 
          !['application/vnd.ant.html', 'text/markdown', 'application/vnd.ant.mermaid'].includes(obj.contentType)) {
        // console.log('- contentType is not one of the allowed types');
      }
    }
    
    return isValid;
}

// Function to extract and parse artifact from the new structured format
function extractArtifactFromText(text: string): ArtifactStructure | null {
  try {
    console.log('extractArtifactFromText called with text length:', text.length);
    console.log('Text preview:', text.substring(0, 300));
    
    // Use a simpler approach - find the delimiters with indexOf
    const startDelimiter = '.-.-.-.-.-.-.-.-<={*TILES_ARTIFACT_DELIMITER*}=>-.-.-.-.-.-.-.-.';
    const endDelimiter = '.-.-.-.-.-.-.-.-<={*TILES_ARTIFACT_END*}=>-.-.-.-.-.-.-.-.';
    
    console.log('Looking for start delimiter:', startDelimiter);
    console.log('Looking for end delimiter:', endDelimiter);
    
    const startIndex = text.indexOf(startDelimiter);
    const endIndex = text.indexOf(endDelimiter);
    
    console.log('Start delimiter index:', startIndex);
    console.log('End delimiter index:', endIndex);
    
    let artifactMatch: [string | null, string] | null = null;
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      const contentStart = startIndex + startDelimiter.length;
      const artifactContent = text.substring(contentStart, endIndex).trim();
      console.log('Extracted artifact content:', artifactContent.substring(0, 200));
      artifactMatch = [null, artifactContent]; // Mimic regex match structure
    }
    
    console.log('Artifact match result:', artifactMatch ? 'FOUND' : 'NOT FOUND');
    
    if (!artifactMatch) {
      console.log('No TILES pattern found, trying fallbacks...');
      
      // Fallback: try legacy JSON format for backward compatibility
      try {
        const parsed = JSON.parse(text);
        if (isValidArtifact(parsed)) {
          console.log('Found valid legacy JSON artifact');
          return parsed;
        }
      } catch (e) {
        // Not a JSON artifact either
        console.log('Not a valid JSON artifact');
      }
      
      // Another fallback: Look for HTML content directly in the text
      if (text.includes('<html') || text.includes('<!DOCTYPE html')) {
        console.log('Found HTML content, trying to extract...');
        const htmlMatch = text.match(/<html[\s\S]*<\/html>/i) || 
                          text.match(/<!DOCTYPE html[\s\S]*<\/html>/i) ||
                          text.match(/<body[\s\S]*<\/body>/i);
        
        if (htmlMatch) {
          console.log('Successfully extracted HTML content');
          return {
            type: 'artifact',
            contentType: 'application/vnd.ant.html',
            content: htmlMatch[0]
          };
        }
      }
      
      console.log('No artifacts found in any format');
      return null;
    }
    
    const artifactContent = artifactMatch[1];
    
    // Extract metadata fields
    const kindMatch = artifactContent.match(/TILES_KIND:\s*(\w+)/);
    const titleMatch = artifactContent.match(/TILES_TITLE:\s*(.+)/);
    const descriptionMatch = artifactContent.match(/TILES_DESCRIPTION:\s*(.+)/);
    
    // Extract content between TILES_CONTENT_BEGIN and TILES_CONTENT_END
    const contentMatch = artifactContent.match(
      /TILES_CONTENT_BEGIN\s*\n([\s\S]*?)\nTILES_CONTENT_END/
    );
    
    if (!kindMatch || !contentMatch) {
      console.warn('Missing required TILES_KIND or content in artifact');
      return null;
    }
    
    const kind = kindMatch[1].toLowerCase();
    const title = titleMatch ? titleMatch[1].trim() : '';
    const description = descriptionMatch ? descriptionMatch[1].trim() : '';
    const content = contentMatch[1];
    
    // Map kind to contentType
    let contentType: ArtifactContentType;
    switch (kind) {
      case 'html':
        contentType = 'application/vnd.ant.html';
        break;
      case 'markdown':
        contentType = 'text/markdown';
        break;
      case 'mermaid':
        contentType = 'application/vnd.ant.mermaid';
        break;
      default:
        console.warn(`Unknown artifact kind: ${kind}`);
        return null;
    }
    
    return {
      type: 'artifact',
      contentType,
      content,
      metadata: {
        title,
        description
      }
    };
    
  } catch (e) {
    console.error('Error extracting artifact from text:', e);
    return null;
  }
}

// Styles for the plugin
const styles: Record<string, CSSProperties> = {
  button: {
    backgroundColor: 'transparent',
    color: 'inherit',
    border: 'none',
    borderRadius: '4px',
    padding: '8px',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  error: {
    color: 'red',
    marginTop: '5px',
    fontSize: '12px',
  }
};

// Add ConfigPanel component before McpRunnerPlugin
function ConfigPanel({
  onClose,
  config,
  onConfigChange,
  runOnServer,
  onRunOnServerChange,
}: {
  onClose: () => void;
  config: Record<string, string>;
  onConfigChange: (newConfig: Record<string, string>) => void;
  runOnServer: boolean;
  onRunOnServerChange: (runOnServer: boolean) => void;
}): JSX.Element {
  const { 
    remoteServers, 
    connectionStates, 
    connectToServer, 
    disconnectFromServer,
    addRemoteServer,
    removeRemoteServer,
    updateServerEnabled
  } = useMcpContext();
  
  // Local configuration state
  const [keyValuePairs, setKeyValuePairs] = useState<Array<{key: string; value: string}>>(
    Object.entries(config).length > 0 
      ? Object.entries(config).map(([key, value]) => ({ key, value }))
      : [{ key: '', value: '' }]
  );
  
  // Remote server management state
  const [activeTab, setActiveTab] = useState<'local' | 'remote'>('local');
  const [newServerName, setNewServerName] = useState('');
  const [newServerUrl, setNewServerUrl] = useState('');
  const [isConnecting, setIsConnecting] = useState<Set<string>>(new Set());

  // Log initial config
  useEffect(() => {
    //console.log('ConfigPanel mounted with initial config:', config);
  }, []);

  const handleAddPair = () => {
    //console.log('Adding new key-value pair');
    setKeyValuePairs([...keyValuePairs, { key: '', value: '' }]);
  };

  const handleRemovePair = (index: number) => {
    //console.log('Removing pair at index:', index);
    const newPairs = keyValuePairs.filter((_, i) => i !== index);
    setKeyValuePairs(newPairs);
    
    // Create a new config object from the remaining pairs
    const newConfig = newPairs.reduce((acc, { key, value }) => {
      if (key.trim() !== '' && value.trim() !== '') {
        // Remove any quotes from the key and value
        const cleanKey = key.replace(/^"|"$/g, '').trim();
        const cleanValue = value.replace(/^"|"$/g, '').trim();
        if (cleanKey && cleanValue) {
          acc[cleanKey] = cleanValue;
        }
      }
      return acc;
    }, {} as Record<string, string>);
    
    console.log('New config after removal:', newConfig);
    onConfigChange(newConfig);
  };

  const handlePairChange = (index: number, field: 'key' | 'value', newValue: string) => {
    //console.log(`Changing ${field} at index ${index} to:`, newValue);
    const newPairs = keyValuePairs.map((pair, i) => 
      i === index ? { ...pair, [field]: newValue } : pair
    );
    setKeyValuePairs(newPairs);
    
    // Create a new config object from the pairs, excluding empty pairs
    const newConfig = newPairs.reduce((acc, { key, value }) => {
      if (key !== '""' && value !== '""' && key.trim() !== '' && value.trim() !== '') {
        // Remove any quotes from the key and value
        const cleanKey = key.replace(/^"|"$/g, '').trim();
        const cleanValue = value.replace(/^"|"$/g, '').trim();
        if (cleanKey && cleanValue) {
          acc[cleanKey] = cleanValue;
        }
      }
      return acc;
    }, {} as Record<string, string>);
    
    console.log('New config being set:', newConfig);
    onConfigChange(newConfig);
  };

  // Log whenever keyValuePairs changes
  useEffect(() => {
    console.log('Current keyValuePairs:', keyValuePairs);
  }, [keyValuePairs]);

  // Remote server management functions
  const handleToggleServer = async (serverId: string, enabled: boolean) => {
    try {
      // First update the server's enabled state in the context
      updateServerEnabled(serverId, enabled);

      if (enabled) {
        setIsConnecting(prev => new Set(prev).add(serverId));
        await connectToServer(serverId);
      } else {
        await disconnectFromServer(serverId);
      }
    } catch (error) {
      console.error(`Failed to ${enabled ? 'connect to' : 'disconnect from'} server ${serverId}:`, error);
      // Revert the enabled state on error
      updateServerEnabled(serverId, !enabled);
    } finally {
      setIsConnecting(prev => {
        const newSet = new Set(prev);
        newSet.delete(serverId);
        return newSet;
      });
    }
  };

  const handleAddCustomServer = () => {
    if (!newServerName.trim() || !newServerUrl.trim()) {
      return;
    }

    const serverId = newServerName.toLowerCase().replace(/\s+/g, '-');
    addRemoteServer({
      id: serverId,
      name: newServerName.trim(),
      url: newServerUrl.trim(),
      requiresAuth: true,
      enabled: false,
      category: 'data',
      description: 'Custom MCP server'
    });

    setNewServerName('');
    setNewServerUrl('');
  };

  const getConnectionStatus = (serverId: string) => {
    const connectionState = connectionStates.get(serverId);
    if (isConnecting.has(serverId)) return 'connecting';
    return connectionState?.status || 'disconnected';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return '🟢';
      case 'connecting': return '🟡';
      case 'error': return '🔴';
      case 'auth-required': return '🔐';
      default: return '⚪';
    }
  };


  return (
    <div className="config-panel">
      <div className="config-panel-header">
        <h3>Configuration</h3>
        <button
          className="close-button"
          onClick={onClose}
          aria-label="Close config panel">
          ×
        </button>
      </div>
      
      {/* Tab Navigation */}
      <div className="config-tabs">
        <button 
          className={`config-tab ${activeTab === 'local' ? 'active' : ''}`}
          onClick={() => setActiveTab('local')}
        >
          Portable Local MCPs
        </button>
        <button 
          className={`config-tab ${activeTab === 'remote' ? 'active' : ''}`}
          onClick={() => setActiveTab('remote')}
        >
          Remote MCPs
        </button>
      </div>

      <div className="config-panel-content">
        {activeTab === 'local' && (
          <div className="local-config">
            <div className="config-option">
              <div className="execution-toggle">
                <div className="toggle-header">
                  <div className="toggle-info">
                    <span className="toggle-label">Execution Location</span>
                    <span className="toggle-description">
                      Choose where WASM servers run: browser (direct) or server (avoids CORS issues)
                    </span>
                  </div>
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      id="execution-toggle"
                      checked={runOnServer}
                      onChange={(e) => {
                        console.log('Server execution toggle changed to:', e.target.checked);
                        onRunOnServerChange(e.target.checked);
                      }}
                    />
                    <label htmlFor="execution-toggle" className="toggle-slider">
                      <span className="toggle-option left">Browser</span>
                      <span className="toggle-option right">Server</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <p>Add key-value pairs for your configuration.</p>
            {keyValuePairs.map((pair, index) => (
              <div key={index} className="config-pair">
                <input
                  type="text"
                  placeholder="Key"
                  value={pair.key.replace(/^"|"$/g, '')} // Remove quotes for display
                  onChange={(e) => handlePairChange(index, 'key', e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={pair.value.replace(/^"|"$/g, '')} // Remove quotes for display
                  onChange={(e) => handlePairChange(index, 'value', e.target.value)}
                />
                <button
                  className="remove-pair"
                  onClick={() => handleRemovePair(index)}
                  aria-label="Remove pair">
                  ×
                </button>
              </div>
            ))}
            <button
              className="add-pair"
              onClick={handleAddPair}>
              + Add Pair
            </button>
          </div>
        )}

        {activeTab === 'remote' && (
          <div className="remote-config">
            <h4>Remote MCPs</h4>
            {remoteServers.filter(server => REMOTE_MCP_SERVERS.some(predefined => predefined.id === server.id)).map(server => {
              const status = getConnectionStatus(server.id);
              const connectionState = connectionStates.get(server.id);
              const tools = connectionState?.tools || [];
              
              return (
                <div key={server.id} className="server-item" data-status={status}>
                  <div className="server-info">
                    <span className="server-icon">{server.icon || '🌐'}</span>
                    <div className="server-details">
                      <span className="server-name">{server.name}</span>
                      <span className="server-url">{server.url}</span>
                      <span className="server-description">{server.description}</span>
                    </div>
                    <div className="server-status">
                      <span className="status-icon">{getStatusIcon(status)}</span>
                      <span className="status-text">{status}</span>
                    </div>
                  </div>
                  
                  <div className="server-tools">
                    {status === 'connected' && tools.length > 0 ? (
                      <div className="tools-list">
                        <span className="tools-label">Tools ({tools.length}):</span>
                        <div className="tools-grid">
                          {tools.map((tool, index) => (
                            <span key={index} className="tool-tag" title={tool.description}>
                              {tool.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : status === 'connected' && tools.length === 0 ? (
                      <div className="tools-placeholder">
                        <span className="tools-label">No tools available</span>
                      </div>
                    ) : (
                      <div className="tools-placeholder">
                        <span className="tools-label">Connect to see tools/capabilities</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="server-actions">
                    <label className="server-toggle">
                      <input
                        type="checkbox"
                        checked={server.enabled}
                        disabled={isConnecting.has(server.id)}
                        onChange={(e) => handleToggleServer(server.id, e.target.checked)}
                      />
                      {isConnecting.has(server.id) ? 'Connecting...' : (server.enabled ? 'Enabled' : 'Disabled')}
                    </label>
                  </div>
                </div>
              );
            })}

            <h4>Add Custom Server</h4>
            <div className="custom-server-form">
              <input
                type="text"
                placeholder="Server Name"
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
              />
              <input
                type="url"
                placeholder="Server URL (e.g., https://api.example.com/mcp)"
                value={newServerUrl}
                onChange={(e) => setNewServerUrl(e.target.value)}
              />
              <button
                onClick={handleAddCustomServer}
                disabled={!newServerName.trim() || !newServerUrl.trim()}
              >
                + Add Server
              </button>
            </div>

            {remoteServers.filter(server => !REMOTE_MCP_SERVERS.some(predefined => predefined.id === server.id)).length > 0 && (
              <>
                <h4>Custom Servers</h4>
                {remoteServers.filter(server => !REMOTE_MCP_SERVERS.some(predefined => predefined.id === server.id)).map(server => {
                  const status = getConnectionStatus(server.id);
                  const connectionState = connectionStates.get(server.id);
                  const tools = connectionState?.tools || [];
                  
                  return (
                    <div key={server.id} className="server-item custom-server" data-status={status}>
                      <div className="server-info">
                        <div className="server-details">
                          <span className="server-name">{server.name}</span>
                          <span className="server-url">{server.url}</span>
                        </div>
                        <div className="server-status">
                          <span className="status-icon">{getStatusIcon(status)}</span>
                          <span className="status-text">{status}</span>
                        </div>
                      </div>
                      
                      <div className="server-tools">
                        {status === 'connected' && tools.length > 0 ? (
                          <div className="tools-list">
                            <span className="tools-label">Tools ({tools.length}):</span>
                            <div className="tools-grid">
                              {tools.map((tool, index) => (
                                <span key={index} className="tool-tag" title={tool.description}>
                                  {tool.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : status === 'connected' && tools.length === 0 ? (
                          <div className="tools-placeholder">
                            <span className="tools-label">No tools available</span>
                          </div>
                        ) : (
                          <div className="tools-placeholder">
                            <span className="tools-label">Connect to see tools/capabilities</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="server-actions">
                        <label className="server-toggle">
                          <input
                            type="checkbox"
                            checked={server.enabled}
                            disabled={isConnecting.has(server.id)}
                            onChange={(e) => handleToggleServer(server.id, e.target.checked)}
                          />
                          {isConnecting.has(server.id) ? 'Connecting...' : (server.enabled ? 'Connected' : 'Connect')}
                        </label>
                        <button
                          className="remove-server"
                          onClick={() => removeRemoteServer(server.id)}
                          aria-label="Remove server"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function McpRunnerPlugin(): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const { servlets, refreshServlets, isLoading, error, fetchWasmContent, allServers, findServerBySlug } = useMcpContext();
  const [wasmContent, setWasmContent] = useState<ArrayBuffer | null>(null);
  const [wasmError, setWasmError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [executionResult, setExecutionResult] = useState<WasmExecutorResult | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [runOnServer, setRunOnServer] = useState(false);
  
  // Debug: Track runOnServer state changes
  useEffect(() => {
    console.log('runOnServer state changed to:', runOnServer);
  }, [runOnServer]);
  
  // Create a ref to store the latest config
  const configRef = useRef(config);
  
  // Create a ref to store the latest runOnServer state
  const runOnServerRef = useRef(runOnServer);
  
  // Update configRef whenever config changes
  useEffect(() => {
    configRef.current = config;
    console.log('Config updated in McpRunnerPlugin:', config);
  }, [config]);
  
  // Update runOnServerRef whenever runOnServer changes
  useEffect(() => {
    runOnServerRef.current = runOnServer;
    console.log('runOnServer updated in ref:', runOnServer);
  }, [runOnServer]);
  
  // Configuration options for WasmExecutor - moved inside processCurrentSelection
  const getWasmExecutorOptions = (): WasmExecutorOptions => ({
    useWasi: true,
    allowedPaths: {
      '/tmp': '/tmp',
      '/data': '/data'
    },
    logLevel: 'debug',
    runInWorker: true,
    allowedHosts: ['*'],
    config: configRef.current // Use the current config from ref
  });
  
  // Create a ref to store the latest servlets data
  const servletsRef = useRef(servlets);
  
  // Create a ref to store the latest all servers data
  const allServersRef = useRef(allServers);
  
  // Update the ref whenever servlets changes
  useEffect(() => {
    servletsRef.current = servlets;
    //console.log('Servlets updated in ref:', servlets);
  }, [servlets]);
  
  // Update the ref whenever allServers changes
  useEffect(() => {
    allServersRef.current = allServers;
    //console.log('All servers updated in ref:', allServers);
  }, [allServers]);

  // Insert text nodes after the current node
  const insertTextAfterNode = (targetNode: TextNode, text: string) => {
    editor.update(() => {
      const paragraph = $createParagraphNode();
      // Add indentation to the text
      const indentedText = '  ' + text;
      const textNode = $createTextNode(indentedText);
      paragraph.append(textNode);

      const targetParent = targetNode.getParentOrThrow();
      targetParent.insertAfter(paragraph);

      // Add horizontal rule after the text
      const horizontalRule = $createHorizontalRuleNode();
      paragraph.insertAfter(horizontalRule);
    });
  };

  // --- Insert Artifact Node ---
  const insertArtifactAfterNode = (targetNode: TextNode, artifact: ArtifactStructure) => {
      // console.log('Inserting artifact:', artifact);
      // console.log('Artifact content type:', artifact.contentType);
      // console.log('Artifact content length:', artifact.content.length);
      
      if (artifact.contentType === 'application/vnd.ant.html') {
        // console.log('HTML content preview:', artifact.content.substring(0, 100) + '...');
      }
      
      editor.update(() => {
          const artifactNode = $createArtifactNode(artifact.contentType, artifact.content, artifact.metadata);
          const paragraph = $createParagraphNode(); // Wrap artifact in a paragraph for block behavior
          paragraph.append(artifactNode);

          const targetParent = targetNode.getParentOrThrow();
          targetParent.insertAfter(paragraph); // Insert the paragraph containing the artifact

          // Optionally add a horizontal rule after the artifact paragraph
          const horizontalRule = $createHorizontalRuleNode();
          paragraph.insertAfter(horizontalRule);
      });
  };
  // --- End Insert Artifact Node ---

  // Function to execute remote MCP tool
  const executeRemoteMcpTool = async (
    serverId: string,
    toolName: string,
    args: Record<string, any>
  ) => {
    try {
      // Find the server config to pass to backend for auto-connection
      const serverConfig = allServersRef.current.find(s => s.serverId === serverId);
      
      const response = await fetch('/api/mcp-execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'remote-mcp',
          serverId,
          serverConfig: serverConfig ? {
            id: serverConfig.serverId,
            name: serverConfig.name,
            url: serverConfig.serverUrl,
            requiresAuth: serverConfig.requiresAuth,
            enabled: true,
            category: 'data',
            description: serverConfig.description
          } : undefined,
          toolName,
          args
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || 'Failed to execute remote MCP tool');
        } catch (parseError) {
          throw new Error(`Failed to execute remote MCP tool: ${errorText}`);
        }
      }

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error);
      }

      return {
        output: result.output,
        error: undefined
      };
    } catch (error) {
      console.error('Error executing remote MCP tool:', error);
      return {
        output: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  };

  // Function to execute WASM on server
  const executeWasmOnServer = async (
    contentAddress: string,
    functionName: string,
    input: string,
    config: Record<string, string>
  ) => {
    try {
      const response = await fetch('/api/wasm-execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentAddress,
          functionName,
          input,
          config,
          executorOptions: {
            useWasi: true,
            allowedPaths: {
              '/tmp': '/tmp',
              '/data': '/data'
            },
            logLevel: 'debug',
            runInWorker: false
            // Note: allowedHosts is omitted because it requires runInWorker: true
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || 'Failed to execute WASM on server');
        } catch (parseError) {
          throw new Error(`Failed to execute WASM on server: ${errorText}`);
        }
      }

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error);
      }

      return {
        output: result.output,
        error: undefined
      };
    } catch (error) {
      console.error('Error executing WASM on server:', error);
      return {
        output: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  };

  // Make request to the Next.js API
  const callClaudeApi = async (messages: Message[], tools: any[]) => {
    try {
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          tools,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        // console.error('Claude API error response:', errorText);
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || 'Failed to connect to Claude API');
        } catch (parseError) {
          throw new Error(`Failed to connect to Claude API: ${errorText}`);
        }
      }

      const responseText = await response.text();
      //console.log('Raw Claude API response:', responseText);
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        // console.error('Failed to parse Claude API response:', parseError);
        throw new Error(`Invalid JSON response from Claude API: ${responseText}`);
      }
    } catch (error) {
      // console.error('Error calling Claude API:', error);
      throw error;
    }
  };

  // Function to process the current selection with agentic loop
  const processCurrentSelection = async () => {
    setIsProcessing(true);
    setExecutionResult(null);
    setWasmError(null);
    
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      setWasmError('Please select some text first');
      setIsProcessing(false);
      return;
    }
    
    // Get the selected text
    const userPrompt = selection.getTextContent().trim();

    // Clear/unselect the selection
    editor.update(() => {
      $setSelection(null);
    });
    
    if (!userPrompt) {
      setWasmError('Please select some text first');
      setIsProcessing(false);
      return;
    }
  
    // Find the last node in the selection to insert results after
    const anchorNode = selection.anchor.getNode();
    const focusNode = selection.focus.getNode();
    const lastNode = $isTextNode(focusNode) ? focusNode : 
                    ($isTextNode(anchorNode) ? anchorNode : null);
    
    if (!lastNode) {
      setWasmError('Selection must include text nodes');
      setIsProcessing(false);
      return;
    }
    
    // Find mcpserver node and subsequent nodes for input
    let mcpServerNode: TextNode | null = null;
    let hasFoundMcpNode = false;
    let processedPrompt = '';
    
    // Get all nodes in the selection
    const nodes = selection.getNodes();
    
    // Process each node in the selection
    for (const node of nodes) {
      if ($isTextNode(node) && node.getType() === 'mcpserver') {
        mcpServerNode = node;
        hasFoundMcpNode = true;
        continue;
      }
      
      if (hasFoundMcpNode && $isTextNode(node)) {
        processedPrompt += node.getTextContent() + ' ';
      }
    }
    
    if (!mcpServerNode) {
      setWasmError('No mcpserver node found in selection');
      setIsProcessing(false);
      return;
    }
    
    // Use either the processed prompt if we found nodes after mcpserver,
    // or fall back to the entire selection if not
    const finalPrompt = processedPrompt.trim() || userPrompt;
    
    if (!finalPrompt) {
      setWasmError('Please add your prompt after the mcpserver tag');
      setIsProcessing(false);
      return;
    }

    //console.log('Found mcpserver node:', {
    //  text: mcpServerNode.getTextContent(),
    //  key: mcpServerNode.getKey(),
    //  userPrompt: finalPrompt
    //});

    // Use the ref to access the latest unified servers data
    const currentServers = allServersRef.current;
    
    // Find the server matching the node's text content (assuming it's the slug)
    const serverSlug = mcpServerNode.getTextContent();
    const matchingServer = currentServers.find((server) => server.slug === serverSlug);

    if (!matchingServer) {
      setWasmError(`Server with slug "${serverSlug}" not found`);
      setIsProcessing(false);
      return;
    }

    if (!matchingServer.available) {
      setWasmError(`Server "${serverSlug}" is not available (status: ${matchingServer.status || 'unknown'})`);
      setIsProcessing(false);
      return;
    }

    // Get the current WasmExecutor options with latest config
    const wasmExecutorOptions = getWasmExecutorOptions();
    console.log('Config being used for WASM executor:', wasmExecutorOptions.config);

    
    // Handle different server types
    let contentAddress: string | null = null;
    if (matchingServer.type === 'local') {
      // Get content address from either meta.lastContentAddress or binding.contentAddress for local servers
      contentAddress = matchingServer.meta?.lastContentAddress || 
                      matchingServer.binding?.contentAddress || null;
      
      if (!contentAddress) {
        setWasmError('No content address found for local server');
        setIsProcessing(false);
        return;
      }
    }
    // For remote servers, contentAddress is not needed
    
    // Insert initial message to show processing
    const executionMode = matchingServer.type === 'remote' ? 'Remote MCP' : 
                         (runOnServerRef.current ? 'Server' : 'Local');
    insertTextAfterNode(mcpServerNode, `Processing request: "${finalPrompt}"... (${executionMode} Execution)`);
    
    try {
      // Only fetch WASM content and create executor for local servers running locally
      let executor: WasmExecutor | null = null;
      if (matchingServer.type === 'local' && !runOnServerRef.current) {
        // Fetch WASM content
        const wasmBuffer = await fetchWasmContent(contentAddress!);
        setWasmContent(wasmBuffer);
        
        // Create the WASM executor with current options
        console.log('Creating WASM executor with options:', wasmExecutorOptions);
        executor = await createWasmExecutorFromBuffer(wasmBuffer, wasmExecutorOptions);
        
        // Add a small delay to allow initialization to complete
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      
      
          // Extract all available tools based on server type
    let availableTools: any[] = [];
    
    if (matchingServer.type === 'local') {
      availableTools = matchingServer.meta?.schema?.tools || [];
    } else if (matchingServer.type === 'remote') {
      availableTools = matchingServer.tools || [];
    }
    
    if (availableTools.length === 0) {
      setWasmError(`No tools found in ${matchingServer.type} server "${serverSlug}"`);
      setIsProcessing(false);
      return;
    }
    
    // Format all tools for Claude API
    const claudeTools = availableTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: "object",
        properties: tool.inputSchema?.properties || {},
        required: tool.inputSchema?.required || []
      }
    }));
      
      // --- Artifact System Prompt ---
      // Prepare a system message to instruct Claude about artifact formats
      const artifactSystemMessage: Message = {
        role: 'system',
        content: `When generating visual content such as diagrams, charts, HTML, or formatted content, use this structured format:

First provide a natural conversational response explaining what you've created.

Then include your artifact using this exact format:

.-.-.-.-.-.-.-.-<={*TILES_ARTIFACT_DELIMITER*}=>-.-.-.-.-.-.-.-.

TILES_KIND: [html|markdown|mermaid]
TILES_TITLE: Brief descriptive title
TILES_DESCRIPTION: What this artifact does or shows
TILES_CONTENT_BEGIN
[your raw content here - no escaping needed]
TILES_CONTENT_END

.-.-.-.-.-.-.-.-<={*TILES_ARTIFACT_END*}=>-.-.-.-.-.-.-.-.

Kind selection rules:
- html: Interactive content, styled elements, dashboards, games, apps
- mermaid: Diagrams, flowcharts, mind maps, charts, graphs  
- markdown: Documentation, notes, plain formatted text, lists

Content guidelines:
- NO escaping required between TILES_CONTENT_BEGIN/END
- Raw HTML, Mermaid syntax, or Markdown can be placed directly
- Always include meaningful TITLE and DESCRIPTION
- Content can span multiple lines freely

Examples:

For HTML:
I'll create an interactive dashboard for you.

.-.-.-.-.-.-.-.-<={*TILES_ARTIFACT_DELIMITER*}=>-.-.-.-.-.-.-.-.

TILES_KIND: html
TILES_TITLE: Analytics Dashboard
TILES_DESCRIPTION: Interactive user metrics with charts and filters
TILES_CONTENT_BEGIN
<div style="font-family: Arial; padding: 20px; background: #f5f5f5;">
  <h1>User Analytics</h1>
  <div style="display: flex; gap: 20px;">
    <div style="flex: 1; background: white; padding: 15px; border-radius: 8px;">
      <h3>Total Users</h3>
      <p style="font-size: 24px; color: #2196F3;">1,247</p>
    </div>
  </div>
</div>
TILES_CONTENT_END

.-.-.-.-.-.-.-.-<={*TILES_ARTIFACT_END*}=>-.-.-.-.-.-.-.-.

For Mermaid:
Here's a process flow diagram showing the user journey.

.-.-.-.-.-.-.-.-<={*TILES_ARTIFACT_DELIMITER*}=>-.-.-.-.-.-.-.-.

TILES_KIND: mermaid
TILES_TITLE: User Registration Flow
TILES_DESCRIPTION: Step-by-step process for new user signup
TILES_CONTENT_BEGIN
graph TD
    A[User Visits Site] --> B{Has Account?}
    B -->|No| C[Registration Form]
    B -->|Yes| D[Login Form]
    C --> E[Validate Data]
    E --> F[Create Account]
    F --> G[Send Welcome Email]
    G --> H[Redirect to Dashboard]
    D --> I[Authenticate]
    I --> H
TILES_CONTENT_END

.-.-.-.-.-.-.-.-<={*TILES_ARTIFACT_END*}=>-.-.-.-.-.-.-.-.

IMPORTANT: 
- Always start with a natural conversational response
- Use the exact delimiter format shown above
- No escaping needed in content section
- Include all three metadata fields (KIND, TITLE, DESCRIPTION)`
      };

      // Start the conversation with the initial message
      let messages: Message[] = [
        artifactSystemMessage, // Add the system message about artifacts first
        { role: 'user', content: finalPrompt }
      ];
      // --- End Artifact System Prompt ---
      
      // Keep track of conversation history for display
      let conversationHistory: Message[] = [{
        role: 'user',
        content: finalPrompt
      }];
      
      let response;
      
      // Insert user message to conversation display
      insertTextAfterNode(mcpServerNode, `tile: ${finalPrompt}`);
      
      // Agentic loop - continue running until we get a final message
      do {
        // Send the current state of the conversation to Claude via API
        try {
          //console.log('Sending messages to Claude:', messages, claudeTools);
          
          // Call Claude API with messages that include our system prompt
          response = await callClaudeApi(messages, claudeTools);
          // console.log('Claude API response structure:', {
          //   role: response.role,
          //   contentLength: response.content.length,
          //   stopReason: response.stop_reason
          // });
        } catch (error) {
          // console.error('Error calling Claude API:', error);
          setWasmError(`Error calling Claude API: ${error instanceof Error ? error.message : String(error)}`);
          insertTextAfterNode(mcpServerNode, `Error calling Claude API: ${error instanceof Error ? error.message : String(error)}`);
          break;
        }
        
        // Add Claude's response to messages and conversation history
        messages.push({
          role: response.role,
          content: response.content,
        });
        
        conversationHistory.push({
          role: response.role,
          content: response.content,
        });
        
        // --- Process and Display Claude's Response ---
        let claudeNonArtifactResponse = '';

        // First check if the entire response is an artifact
        try {
          const responseText = response.content
            .filter((part: any) => part.type === 'text')
            .map((part: any) => part.text)
            .join('')
            .trim();

          console.log('Response text for artifact check:', responseText.substring(0, 200) + '...');
          
          // Check for new TILES format or legacy JSON format
          if (responseText.includes('TILES_ARTIFACT_DELIMITER') || responseText.includes('"type": "artifact"')) {
            console.log('Found potential artifact in response');
            
            // Try to extract and parse the artifact
            const artifact = extractArtifactFromText(responseText);
            console.log('Extracted artifact result:', artifact);
            
            if (artifact) {
              console.log('Successfully extracted artifact:', {
                type: artifact.type,
                contentType: artifact.contentType,
                contentLength: artifact.content.length,
                metadata: artifact.metadata
              });
              
              // For the new format, we need to handle conversational text + artifact
              if (responseText.includes('TILES_ARTIFACT_DELIMITER')) {
                console.log('Processing TILES format artifact');
                // Extract conversational part (before the delimiter)
                const conversationalPart = responseText.split('.-.-.-.-.-.-.-.-<={*TILES_ARTIFACT_DELIMITER*}=>')[0].trim();
                if (conversationalPart) {
                  console.log('Inserting conversational part:', conversationalPart.substring(0, 100));
                  insertTextAfterNode(mcpServerNode, `Claude: ${conversationalPart}`);
                }
                
                // Insert the artifact node
                console.log('Inserting artifact node...');
                insertArtifactAfterNode(mcpServerNode, artifact);
                continue; // Skip to next iteration since we handled everything
              } else {
                // Legacy JSON format - insert artifact only
                console.log('Processing legacy JSON artifact');
                insertArtifactAfterNode(mcpServerNode, artifact);
                continue; // Skip to next iteration since this was a pure artifact response
              }
            } else {
              console.log('Failed to extract artifact from response');
            }
          } else {
            console.log('No artifact delimiters found in response');
          }
        } catch (e) {
          // Not a valid artifact, continue with normal processing
          console.warn('Response was not a valid artifact:', e);
        }

        // Process each part of the response
        for (const part of response.content) {
          if (part.type === 'text') {
            claudeNonArtifactResponse += part.text;
          } else if (part.type === 'tool_use') {
            // Handle tool use as before (potentially insert pending text first)
            if (claudeNonArtifactResponse) {
              insertTextAfterNode(mcpServerNode, `Claude: ${claudeNonArtifactResponse}`);
              claudeNonArtifactResponse = ''; // Reset accumulator
            }
            // Tool use handling continues below...
          }
        }

        // Insert any remaining non-artifact text at the end
        if (claudeNonArtifactResponse) {
          // Check if the non-artifact text contains an artifact (new or legacy format)
          if (claudeNonArtifactResponse.includes('TILES_ARTIFACT_DELIMITER') || claudeNonArtifactResponse.includes('"type": "artifact"')) {
            // Try to extract and parse the artifact
            const artifact = extractArtifactFromText(claudeNonArtifactResponse);
            if (artifact) {
              // console.log('Successfully extracted artifact from text:', {
              //   type: artifact.type,
              //   contentType: artifact.contentType,
              //   contentLength: artifact.content.length
              // });
              
              // For the new format, handle conversational text + artifact
              if (claudeNonArtifactResponse.includes('TILES_ARTIFACT_DELIMITER')) {
                // Extract conversational part (before the delimiter)
                const conversationalPart = claudeNonArtifactResponse.split('.-.-.-.-.-.-.-.-<={*TILES_ARTIFACT_DELIMITER*}=>')[0].trim();
                if (conversationalPart) {
                  insertTextAfterNode(mcpServerNode, `Claude: ${conversationalPart}`);
                }
                
                // Insert the artifact node
                insertArtifactAfterNode(mcpServerNode, artifact);
                claudeNonArtifactResponse = ''; // Clear since we handled everything
              } else {
                // Legacy JSON format - insert artifact and remove JSON from text
                insertArtifactAfterNode(mcpServerNode, artifact);
                
                // Remove the artifact JSON from the text to display
                claudeNonArtifactResponse = claudeNonArtifactResponse.replace(
                  /\{[\s\S]*"type":\s*"artifact"[\s\S]*\}/, 
                  ''
                );
              }
            }
          }
          
          // Only insert the text if it's not empty after processing
          if (claudeNonArtifactResponse.trim()) {
            insertTextAfterNode(mcpServerNode, `Claude: ${claudeNonArtifactResponse}`);
          }
        }
        // --- End Process and Display Claude's Response ---
        
        // Check if there are any tool use requests
        const newMessage: Message = { role: 'user', content: [] };
        let toolUseCount = 0;
        
        for (const submessage of response.content) {
          if (submessage.type !== 'tool_use') {
            continue;
          }
          
          toolUseCount++;
          const { id, input, name } = submessage as unknown as ToolUseSubmessage;
          
          try {
            // Display tool call
            insertTextAfterNode(mcpServerNode, `Tool call: ${name}\nInput: ${JSON.stringify(input, null, 2)}`);
            
            // Execute based on server type
            let executionResult;
            
            if (matchingServer.type === 'remote') {
              // Execute remote MCP tool
              console.log('Executing remote MCP tool:', name);
              insertTextAfterNode(mcpServerNode, `🌐 Executing ${name} on remote MCP server...`);
              executionResult = await executeRemoteMcpTool(
                matchingServer.serverId!,
                name,
                input
              );
            } else {
              // Local server execution (WASM)
              // Prepare the input for the servlet
              const servletInput = JSON.stringify({
                params: {
                  name: name,
                  arguments: input
                }
              });
              
              const useServerExecution = runOnServerRef.current;
              console.log('Tool execution mode:', useServerExecution ? 'Server' : 'Local');
              
              if (useServerExecution) {
                // Execute local WASM on server
                console.log('Executing on server with contentAddress:', contentAddress);
                insertTextAfterNode(mcpServerNode, `🌐 Executing ${name} on server...`);
                executionResult = await executeWasmOnServer(
                  contentAddress!,
                  'call',
                  servletInput,
                  configRef.current
                );
              } else {
                // Execute locally using the plugin
                console.log('Executing locally');
                insertTextAfterNode(mcpServerNode, `💻 Executing ${name} locally...`);
                if (!executor) {
                  throw new Error('Local executor not initialized');
                }
                executionResult = await executor.execute('call', servletInput);
              }
            }
            setExecutionResult(executionResult);
            
            if (executionResult.error) {
              throw new Error(executionResult.error);
            }
            
            // Get the result
            const resultText = executionResult.output;
            let parsedResult;
            
            try {
              // Try to parse as JSON if it looks like JSON
              if (resultText.startsWith('{') && resultText.endsWith('}')) {
                parsedResult = JSON.parse(resultText);
              } else {
                parsedResult = resultText;
              }
            } catch (e) {
              parsedResult = resultText;
            }
            
            // Display tool result
            insertTextAfterNode(
              mcpServerNode, 
              `Tool result: ${typeof parsedResult === 'object' ? JSON.stringify(parsedResult, null, 2) : parsedResult}`
            );
            
            // Add the tool result to the message
            newMessage.content.push({
              type: 'tool_result',
              tool_use_id: id,
              content: typeof parsedResult === 'object' ? JSON.stringify(parsedResult) : String(parsedResult)
            });
            
            // Track for history display
            conversationHistory.push({
              role: 'user',
              type: 'tool_results',
              content: [{
                toolName: name,
                input,
                result: parsedResult
              }]
            });
          } catch (error) {
            // console.error(`Error executing tool ${name}:`, error);
            
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Display error
            insertTextAfterNode(mcpServerNode, `Error: ${errorMessage}`);
            
            // Add the error as a tool result
            newMessage.content.push({
              type: 'tool_result',
              tool_use_id: id,
              content: `Error: ${errorMessage}`,
              is_error: true
            });
            
            // Track for history display
            conversationHistory.push({
              role: 'user',
              type: 'tool_results',
              content: [{
                toolName: name,
                input,
                error: errorMessage
              }]
            });
          }
        }
        
        // If Claude is doing tool use, add the result as a user message and continue
        if (response.stop_reason === 'tool_use') {
          messages.push(newMessage);
          continue;
        }
        
        // If there was tool use but Claude is now done its turn, add the results and continue
        if (response.stop_reason === 'end_turn' && toolUseCount > 0) {
          messages.push(newMessage);
          continue;
        }
        
        // Otherwise, we're done
        break;
        
      } while (true);
      
      //console.log(`Conversation complete.`);
      
      // Clean up the executor if it was created
      if (executor) {
        await executor.free();
      }
      
      // Insert final completion message
      insertTextAfterNode(mcpServerNode, "✅ Processing complete");
      
    } catch (err) {
      // console.error('Error in agentic loop:', err);
      setWasmError(err instanceof Error ? err.message : String(err));
      insertTextAfterNode(mcpServerNode, `Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    // Register the custom command
    const unregisterCommand = editor.registerCommand(
      RUN_MCP_COMMAND,
      () => {
        processCurrentSelection();
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );

    // Register keyboard shortcut (Ctrl+Enter or Cmd+Enter)
    const unregisterKeyDown = editor.registerRootListener((rootElement, prevRootElement) => {
      if (rootElement !== null) {
        rootElement.addEventListener('keydown', (event) => {
          // Check for Ctrl+Enter or Cmd+Enter
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation(); // Also stop propagation to prevent other handlers
            editor.dispatchCommand(RUN_MCP_COMMAND, undefined);
          }
        }, true); // Use capture phase to handle the event before other handlers
      }
    });

    return () => {
      unregisterCommand();
      unregisterKeyDown();
    };
  }, [editor]);

  // Handle the button click
  const handleRunMcp = () => {
    editor.dispatchCommand(RUN_MCP_COMMAND, undefined);
  };

  // This component will be rendered in the toolbar
  return (
    <div>
      <button 
        onClick={() => setShowConfig(!showConfig)}
        style={{
          ...styles.button,
          position: 'fixed',
          top: '175px', // Position below the servlets button (125px + 40px height + 10px gap)
          right: '20px',
          zIndex: 100,
          backgroundColor: '#ffffff',
          boxShadow: '0px 1px 5px rgba(0, 0, 0, 0.3)',
          width: '40px',
          height: '40px',
          borderRadius: '20px',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        title="Configure"
        className="toolbar-item"
      >
        <i className="settings" />
      </button>
      <button 
        onClick={handleRunMcp}
        disabled={isProcessing}
        style={isProcessing ? {...styles.button, ...styles.buttonDisabled} : styles.button}
        title="Run Tiles (Ctrl+Enter)"
        className="toolbar-item"
      >
      Run Tiles  <img src="/icon.png" alt="Run Icon" style={{height: '1em', width: '1em', verticalAlign: 'middle', marginRight: '0.45em', marginLeft: '0.45em'}} />
      </button>
      {wasmError && <div style={styles.error}>{wasmError}</div>}
      {showConfig && (
        <ConfigPanel
          onClose={() => setShowConfig(false)}
          config={config}
          onConfigChange={setConfig}
          runOnServer={runOnServer}
          onRunOnServerChange={setRunOnServer}
        />
      )}
    </div>
  );
}