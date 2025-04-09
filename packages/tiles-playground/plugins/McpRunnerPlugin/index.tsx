'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect, useRef, useState } from 'react';
import { $getSelection, $isRangeSelection, $isTextNode, COMMAND_PRIORITY_EDITOR, LexicalCommand, $createTextNode, $createParagraphNode, TextNode } from 'lexical';
import { $createHorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { useMcpContext } from '@/contexts/McpContext';
import { CSSProperties } from 'react';
import { createWasmExecutorFromBuffer, WasmExecutorResult, WasmExecutorOptions } from 'wasm-runner/lib/wasm-executor';

// Define a custom command for running MCP
export const RUN_MCP_COMMAND: LexicalCommand<void> = {
  type: 'RUN_MCP_COMMAND',
};

// Types for conversation
interface Message {
  role: 'user' | 'assistant';
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
  
  // Configuration options for WasmExecutor
  const wasmExecutorOptions: WasmExecutorOptions = {
    useWasi: true,
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

  // Insert text nodes after the current node
  const insertTextAfterNode = (targetNode: TextNode, text: string) => {
    editor.update(() => {
      const paragraph = $createParagraphNode();
      // Add indentation to the text
      const indentedText = '  ' + text;
      const textNode = $createTextNode(indentedText);
      paragraph.append(textNode);
      targetNode.getParentOrThrow().insertAfter(paragraph);
      
      // Add horizontal rule after the text
      const horizontalRule = $createHorizontalRuleNode();
      paragraph.insertAfter(horizontalRule);
    });
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
        console.error('Claude API error response:', errorText);
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || 'Failed to connect to Claude API');
        } catch (parseError) {
          throw new Error(`Failed to connect to Claude API: ${errorText}`);
        }
      }

      const responseText = await response.text();
      console.log('Raw Claude API response:', responseText);
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse Claude API response:', parseError);
        throw new Error(`Invalid JSON response from Claude API: ${responseText}`);
      }
    } catch (error) {
      console.error('Error calling Claude API:', error);
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
      setIsProcessing(false);
      return;
    }
    
    // Get the current line's nodes
    const anchor = selection.anchor;
    const nodes = anchor.getNode().getParent()?.getChildren();
    
    if (!nodes) {
      setIsProcessing(false);
      return;
    }
    
    // Find mcpserver node and subsequent nodes for input
    let mcpServerNode: TextNode | null = null;
    let userPrompt = '';
    let hasFoundMcpNode = false;
    
    // Convert nodes to array if needed
    const nodesArray = Array.isArray(nodes) ? nodes : Array.from(nodes);
    
    for (const node of nodesArray) {
      if ($isTextNode(node as any) && (node as any).getType() === 'mcpserver') {
        mcpServerNode = node as TextNode;
        hasFoundMcpNode = true;
        continue;
      }
      
      if (hasFoundMcpNode && $isTextNode(node as any)) {
        userPrompt += (node as TextNode).getTextContent() + ' ';
      }
    }
    
    if (!mcpServerNode) {
      console.log('No mcpserver node found');
      setWasmError('No mcpserver node found');
      setIsProcessing(false);
      return;
    }
    
    userPrompt = userPrompt.trim();
    if (!userPrompt) {
      console.log('No user prompt found after mcpserver node');
      setWasmError('Please add your prompt after the mcpserver tag');
      setIsProcessing(false);
      return;
    }

    console.log('Found mcpserver node:', {
      text: mcpServerNode.getTextContent(),
      key: mcpServerNode.getKey(),
      userPrompt
    });

    // Use the ref to access the latest servlets data
    const currentServlets = servletsRef.current;
    
    // Find the servlet matching the node's text content (assuming it's the slug)
    const servletSlug = mcpServerNode.getTextContent();
    const matchingServlet = currentServlets.find((servlet) => servlet.slug === servletSlug);

    if (!matchingServlet) {
      console.log(`Servlet with slug "${servletSlug}" not found in context.`);
      setWasmError(`Servlet with slug "${servletSlug}" not found`);
      setIsProcessing(false);
      return;
    }
    
    console.log('Matching servlet found:', matchingServlet);

    // Get content address from either meta.lastContentAddress or binding.contentAddress
    const contentAddress = matchingServlet.meta?.lastContentAddress || 
                          matchingServlet.binding?.contentAddress;
    
    if (!contentAddress) {
      console.log('No content address found for servlet');
      setWasmError('No content address found for servlet');
      setIsProcessing(false);
      return;
    }
    
    // Insert initial message to show processing
    insertTextAfterNode(mcpServerNode, `Processing request: "${userPrompt}"...`);
    
    try {
      // Fetch WASM content
      const wasmBuffer = await fetchWasmContent(contentAddress);
      setWasmContent(wasmBuffer);
      
      // Create the WASM executor
      const executor = await createWasmExecutorFromBuffer(wasmBuffer, wasmExecutorOptions);
      
      // Add a small delay to allow initialization to complete
      await new Promise(resolve => setTimeout(resolve, 250));
      
      // Prepare the servlet tool information
      const servletInfo: ServletInfo = {
        slug: servletSlug,
        contentAddress,
        functionName: 'call',
        config: {},
        meta: matchingServlet.meta
      };
      
      // Create the tool definition for Claude
      const tool: ServletTool = {
        name: (matchingServlet.name || servletSlug).split('/')[1] || matchingServlet.name || servletSlug,
        description: (matchingServlet.meta?.schema as any)?.description || `Execute the ${servletSlug} servlet`,
        inputSchema: {}, // We'll fill this from the servlet metadata if available
        servletSlug
      };
      
      // Format the tools for Claude API
      const claudeTools = [{
        name: tool.name,
        description: tool.description,
        input_schema: {
          type: "object",
          properties: {
            ...(matchingServlet.meta?.schema?.tools?.[0]?.inputSchema?.properties || {})
          },
          required: []
        }
      }];
      
      // Start the conversation with the initial message
      let messages: Message[] = [
        { role: 'user', content: userPrompt }
      ];
      
      // Keep track of conversation history for display
      let conversationHistory: Message[] = [{
        role: 'user',
        content: userPrompt
      }];
      
      let response;
      
      // Insert user message to conversation display
      insertTextAfterNode(mcpServerNode, `User: ${userPrompt}`);
      
      // Agentic loop - continue running until we get a final message
      do {
        // Send the current state of the conversation to Claude via API
        try {
          console.log('Sending messages to Claude:', messages, claudeTools);

          response = await callClaudeApi(messages, claudeTools);
        } catch (error) {
          console.error('Error calling Claude API:', error);
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
        
        // Display Claude's response if it's not a tool use
        let claudeTextResponse = '';
        for (const part of response.content) {
          if (part.type === 'text') {
            claudeTextResponse += part.text;
          }
        }
        
        if (claudeTextResponse) {
          insertTextAfterNode(mcpServerNode, `Claude: ${claudeTextResponse}`);
        }
        
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
            
            // Prepare the input for the servlet
            const servletInput = JSON.stringify({
              params: {
                name: name,
                arguments: input
              }
            });
            
            console.log(`Executing tool ${name} with input:`, servletInput);
            
            // Execute the servlet using the plugin
            const executionResult = await executor.execute('call', servletInput);
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
            console.error(`Error executing tool ${name}:`, error);
            
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
      
      console.log(`Conversation complete.`);
      
      // Clean up the executor
      if (executor) {
        await executor.free();
      }
      
      // Insert final completion message
      insertTextAfterNode(mcpServerNode, "✅ Processing complete");
      
    } catch (err) {
      console.error('Error in agentic loop:', err);
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
      {wasmError && <div style={styles.error}>{wasmError}</div>}
    </div>
  );
}