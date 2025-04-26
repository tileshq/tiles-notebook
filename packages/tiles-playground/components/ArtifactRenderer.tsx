'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import mermaid from 'mermaid';
import ReactMarkdown from 'react-markdown';
import type { NodeKey } from 'lexical';
import type { ArtifactContentType } from '../nodes/ArtifactNode'; // Assuming ArtifactNode is in ../nodes

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
    // Might need iframe sandboxing later
    border: '1px dashed #ccc',
    padding: '5px',
    minHeight: '50px',
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
        console.error('Mermaid rendering error:', error);
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
        // WARNING: Rendering raw HTML is risky. Sanitize or use iframe sandbox.
        return (
          <div 
            style={styles.htmlContainer}
            dangerouslySetInnerHTML={{ __html: content /* TODO: Sanitize this! */ }}
          />
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