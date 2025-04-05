'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect, useRef, useState } from 'react';
import { $getSelection, $isRangeSelection, $isTextNode, SELECTION_CHANGE_COMMAND } from 'lexical';
import { useMcpContext } from '@/contexts/McpContext';

export default function McpRunnerPlugin(): null {
  const [editor] = useLexicalComposerContext();
  const { servlets, refreshServlets, isLoading, error, fetchWasmContent } = useMcpContext();
  const [wasmContent, setWasmContent] = useState<ArrayBuffer | null>(null);
  const [wasmError, setWasmError] = useState<string | null>(null);
  
  // Create a ref to store the latest servlets data
  const servletsRef = useRef(servlets);
  
  // Update the ref whenever servlets changes
  useEffect(() => {
    servletsRef.current = servlets;
    console.log('Servlets updated in ref:', servlets);
  }, [servlets]);

  useEffect(() => {
    // Register a listener for selection changes only
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          // Get the current line's nodes
          const anchor = selection.anchor;
          //const focus = selection.focus;
          
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

                // refresh servlets
                //refreshServlets();

                // Use the ref to access the latest servlets data
                const currentServlets = servletsRef.current;
                console.log('Available servlets from ref:', currentServlets);

                // Find the servlet matching the node's text content (assuming it's the slug)
                const servletSlug = node.getTextContent();
                const matchingServlet = currentServlets.find((servlet) => servlet.slug === servletSlug);

                if (matchingServlet) {
                  console.log('Matching servlet found:', matchingServlet);
                  // You can now use matchingServlet.name, matchingServlet.description, etc.

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
        return false; // Don't prevent other handlers from running
      },
      1 // Low priority
    );
  }, [editor, fetchWasmContent]); // Include fetchWasmContent in dependencies

  return null;
} 