'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect, useRef, useState } from 'react';
import { $getSelection, $isRangeSelection, $isTextNode, COMMAND_PRIORITY_EDITOR, LexicalCommand } from 'lexical';
import { useMcpContext } from '@/contexts/McpContext';
import { CSSProperties } from 'react';

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
                    
                    // Here you can initialize the WASM module
                    // For example:
                    // WebAssembly.instantiate(wasmBuffer, importObject)
                    //   .then(result => {
                    //     // Use the WASM module
                    //     console.log('WASM module instantiated:', result);
                    //   })
                    //   .catch(err => {
                    //     console.error('Failed to instantiate WASM module:', err);
                    //     setWasmError(err.message);
                    //   });
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
    <button 
      onClick={handleRunMcp}
      disabled={isProcessing}
      style={isProcessing ? {...styles.button, ...styles.buttonDisabled} : styles.button}
      title="Run MCP (Ctrl+Enter)"
      className="toolbar-item"
    >
      🤖
    </button>
  );
} 