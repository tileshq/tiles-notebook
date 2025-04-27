'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import mermaid from 'mermaid';
import ReactMarkdown from 'react-markdown';
import type { NodeKey } from 'lexical';
import type { ArtifactContentType } from '../nodes/ArtifactNode'; // Assuming ArtifactNode is in ../nodes
import DOMPurify from 'dompurify';

// Function to check if content is valid HTML
const isValidHTML = (content: string): boolean => {
  // Basic check for HTML structure
  return content.trim().toLowerCase().startsWith('<html') || 
         content.trim().toLowerCase().startsWith('<!doctype html') ||
         content.includes('<body') || 
         content.includes('<div') ||
         content.includes('<p') ||
         content.includes('<br') ||
         content.includes('<span');
};

// Function to fix common HTML content issues
const fixHTMLContent = (content: string): string => {
  // Replace escaped newlines with actual newlines
  let fixed = content.replace(/\\n/g, '\n');
  
  // Replace escaped quotes with actual quotes
  fixed = fixed.replace(/\\"/g, '"');
  
  // Replace escaped backslashes with actual backslashes
  fixed = fixed.replace(/\\\\/g, '\\');
  
  // Ensure proper HTML structure if it's just a fragment
  if (!fixed.trim().toLowerCase().startsWith('<html') && 
      !fixed.trim().toLowerCase().startsWith('<!doctype html')) {
    // Wrap in a basic HTML structure if it's just a fragment
    fixed = `<div class="html-fragment">${fixed}</div>`;
  }
  
  return fixed;
};

interface ArtifactRendererProps {
  contentType: ArtifactContentType;
  content: string;
  nodeKey: NodeKey;
}

// Basic styling for the container and toggle button
const styles: Record<string, React.CSSProperties> = {
  container: {
    border: '1px solid #eee',
    borderRadius: '4px',
    padding: '10px',
    margin: '10px 0',
    position: 'relative',
    backgroundColor: '#f9f9f9',
  },
  toggleButton: {
    position: 'absolute',
    top: '5px',
    right: '5px',
    padding: '2px 6px',
    fontSize: '10px',
    cursor: 'pointer',
    backgroundColor: '#ddd',
    border: '1px solid #ccc',
    borderRadius: '3px',
    zIndex: 10, // Ensure button is clickable over content
  },
  codeBlock: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    backgroundColor: '#eee',
    padding: '8px',
    borderRadius: '4px',
    maxHeight: '400px',
    overflowY: 'auto',
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  mermaidContainer: {
    // Mermaid might need specific styling or container properties
  },
  htmlContainer: {
    // Improved styling for HTML container
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '10px',
    backgroundColor: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  markdownContainer: {
    // Standard block element, styling can be applied via Tailwind/CSS
  },
};

// Initialize Mermaid
mermaid.initialize({
  startOnLoad: false, // We'll trigger rendering manually
  theme: 'default', // Or 'dark', 'neutral', etc.
  // Consider securityLevel: 'strict' or 'sandbox' if needed
});

const ArtifactRenderer: React.FC<ArtifactRendererProps> = ({ contentType, content, nodeKey }) => {
  const [showCode, setShowCode] = useState(false);
  const mermaidRef = useRef<HTMLDivElement>(null);
  const [mermaidRendered, setMermaidRendered] = useState(false);
  const [uniqueMermaidId] = useState(`mermaid-${nodeKey}-${Date.now()}`);

  const renderMermaid = useCallback(async () => {
    if (mermaidRef.current && !mermaidRendered) {
      try {
        // Ensure the container is clean before rendering
        mermaidRef.current.innerHTML = ''; 
        const { svg } = await mermaid.render(uniqueMermaidId, content);
        if (mermaidRef.current) { // Check ref again inside async
          mermaidRef.current.innerHTML = svg;
          setMermaidRendered(true);
        }
      } catch (error) {
        if (mermaidRef.current) {
          mermaidRef.current.innerHTML = `<pre>Error rendering Mermaid diagram: ${error instanceof Error ? error.message : String(error)}</pre>`;
        }
      }
    }
  }, [content, uniqueMermaidId, mermaidRendered]);

  useEffect(() => {
    if (contentType === 'application/vnd.ant.mermaid' && !showCode) {
      renderMermaid();
    }
    // Reset rendered state if content changes (e.g., node edited)
    return () => setMermaidRendered(false);
  }, [contentType, content, showCode, renderMermaid]);

  const toggleView = () => setShowCode(!showCode);

  const renderContent = () => {
    if (showCode) {
      return <pre style={styles.codeBlock}><code>{content}</code></pre>;
    }

    switch (contentType) {
      case 'application/vnd.ant.html':
        // Fix any issues with the HTML content
        const fixedContent = fixHTMLContent(content);
        
        // Check if content is valid HTML
        if (!isValidHTML(fixedContent)) {
          return (
            <div style={styles.htmlContainer}>
              <p>Invalid HTML content. Showing as code:</p>
              <pre style={styles.codeBlock}><code>{fixedContent}</code></pre>
            </div>
          );
        }
        
        // Use DOMPurify to sanitize the HTML
        const sanitizedHTML = DOMPurify.sanitize(fixedContent, {
          ADD_TAGS: ['style', 'script'],
          ADD_ATTR: ['onclick', 'onload', 'onerror'],
          FORBID_TAGS: [],
          FORBID_ATTR: []
        });
        
        // Create a sandboxed iframe for safer HTML rendering
        return (
          <div style={styles.htmlContainer}>
            <iframe
              srcDoc={sanitizedHTML}
              style={{ width: '100%', height: '400px', border: '1px solid #ccc' }}
              sandbox="allow-same-origin allow-scripts"
              title="HTML Content"
            />
          </div>
        );
      case 'text/markdown':
        return (
          <div style={styles.markdownContainer}>
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        );
      case 'application/vnd.ant.mermaid':
        return (
          <div ref={mermaidRef} style={styles.mermaidContainer} />
        );
      default:
        return <pre>Unsupported artifact type: {contentType}</pre>;
    }
  };

  return (
    <div style={styles.container}>
      <button style={styles.toggleButton} onClick={toggleView} title={showCode ? 'Show Rendered' : 'Show Code'}>
        {showCode ? '👁️' : '</>'}
      </button>
      {renderContent()}
    </div>
  );
};

export default ArtifactRenderer; 