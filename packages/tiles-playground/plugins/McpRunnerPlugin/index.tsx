'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect, useRef, useState } from 'react';
import { $getSelection, $isRangeSelection, $isTextNode, COMMAND_PRIORITY_EDITOR, LexicalCommand } from 'lexical';
import { useMcpContext } from '@/contexts/McpContext';
import { CSSProperties } from 'react';
import { createWasmExecutorFromBuffer, WasmExecutorResult, WasmExecutorOptions } from '../../../wasm-runner/lib/wasm-executor';

// Define a custom command for running MCP
export const RUN_MCP_COMMAND: LexicalCommand<void> = {
  type: 'RUN_MCP_COMMAND',
};

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

export default function McpRunnerPlugin(): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const { servlets, refreshServlets, isLoading, error, fetchWasmContent } = useMcpContext();
  const [wasmContent, setWasmContent] = useState<ArrayBuffer | null>(null);
  const [wasmError, setWasmError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [executionResult, setExecutionResult] = useState<WasmExecutorResult | null>(null);
  
  // Static configuration options for WasmExecutor
  const wasmExecutorOptions: WasmExecutorOptions = {
    useWasi: true,
    config: { 
      arguments: {
        code: "2 + 2"  // Required: JavaScript code to evaluate
      }
    },
    //allowedHosts: ['*', '127.0.0.1'],
    allowedPaths: {
      '/tmp': '/tmp',
      '/data': '/data'
    },
    logLevel: 'debug',
    runInWorker: true // Set to true if you want to run in a worker thread
  };
  
  // Create a ref to store the latest servlets data
  const servletsRef = useRef(servlets);
  
  // Update the ref whenever servlets changes
  useEffect(() => {
    servletsRef.current = servlets;
    console.log('Servlets updated in ref:', servlets);
  }, [servlets]);

  // Function to process the current selection
  const processCurrentSelection = () => {
    setIsProcessing(true);
    setExecutionResult(null);
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      // Get the current line's nodes
      const anchor = selection.anchor;
      
      // Get the nodes in the current line
      const nodes = anchor.getNode().getParent()?.getChildren();
      
      console.log('nodes', nodes);
      
      if (nodes) {
        // Check each node in the current line
        nodes.forEach((node) => {
          if ($isTextNode(node) && node.getType() === 'mcpserver') {
            console.log('Found mcpserver node:', {
              text: node.getTextContent(),
              key: node.getKey(),
            });

            // Use the ref to access the latest servlets data
            const currentServlets = servletsRef.current;
            console.log('Available servlets from ref:', currentServlets);

            // Find the servlet matching the node's text content (assuming it's the slug)
            const servletSlug = node.getTextContent();
            const matchingServlet = currentServlets.find((servlet) => servlet.slug === servletSlug);

            if (matchingServlet) {
              console.log('Matching servlet found:', matchingServlet);

              // Get content address from either meta.lastContentAddress or binding.contentAddress
              const contentAddress = matchingServlet.meta?.lastContentAddress || 
                                    matchingServlet.binding?.contentAddress;
              
              console.log('contentAddress', contentAddress);

              // Fetch WASM content if we have a content address
              if (contentAddress) {
                setWasmError(null);
                fetchWasmContent(contentAddress)
                  .then((wasmBuffer) => {
                    console.log('WASM content fetched successfully, size:', wasmBuffer.byteLength);
                    setWasmContent(wasmBuffer);
                    
                    // Initialize and execute the WASM module using WasmExecutor with options
                    createWasmExecutorFromBuffer(wasmBuffer, wasmExecutorOptions)
                      .then(async executor => {
                        // Wait for the executor to be fully initialized
                        // The plugin property is initialized asynchronously
                        console.log('Executor created, waiting for initialization...');
                        
                        // Add a small delay to allow initialization to complete
                        await new Promise(resolve => setTimeout(resolve, 100));
                        
                        // Execute the main function with input
                        const inputParams = {
                          params: {
                            name: matchingServlet.name || matchingServlet.slug,
                            arguments: {
                              code: "print(45 + 32)"  // JavaScript code to evaluate
                            }
                          }
                        };

                        console.log('Executing with input:', JSON.stringify(inputParams));
                        
                        // Use the correct function name from the servlet metadata if available
                        const functionName = matchingServlet.meta?.schema?.tools?.[0]?.name || 'call';
                        console.log(`Using function name: ${functionName}`);
                        
                        return executor.execute('call', JSON.stringify(inputParams));
                      })
                      .then(result => {
                        console.log('WASM execution result:', result);
                        setExecutionResult(result);
                        
                        if (result.error) {
                          setWasmError(result.error);
                        }
                      })
                      .catch(err => {
                        console.error('Failed to execute WASM module:', err);
                        setWasmError(err.message);
                      });
                  })
                  .catch(err => {
                    console.error('Failed to fetch WASM content:', err);
                    setWasmError(err.message);
                  });
              } else {
                console.log('No content address found for servlet');
                setWasmError('No content address found for servlet');
              }
            } else {
              console.log(`Servlet with slug "${servletSlug}" not found in context.`);
            }
          }
        });
      }
    }
    setIsProcessing(false);
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
            editor.dispatchCommand(RUN_MCP_COMMAND, undefined);
          }
        });
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
        onClick={handleRunMcp}
        disabled={isProcessing}
        style={isProcessing ? {...styles.button, ...styles.buttonDisabled} : styles.button}
        title="Run MCP (Ctrl+Enter)"
        className="toolbar-item"
      >
        🤖
      </button>
      {executionResult && (
        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <h4>Execution Result:</h4>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {executionResult.output}
          </pre>
          {executionResult.error && (
            <div style={{ color: 'red', marginTop: '5px' }}>
              <strong>Error:</strong> {executionResult.error}
            </div>
          )}
        </div>
      )}
      {wasmError && <div style={styles.error}>{wasmError}</div>}
    </div>
  );
} 