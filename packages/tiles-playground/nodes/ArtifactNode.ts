/** @jsx React.createElement */
/** @jsxRuntime classic */
import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical';

import { DecoratorNode } from 'lexical';
import * as React from 'react';

// Lazy load the renderer component to avoid circular dependencies
const ArtifactRenderer = React.lazy(
  () => import('../components/ArtifactRenderer'),
);

export type ArtifactContentType =
  | 'application/vnd.ant.html'
  | 'text/markdown'
  | 'application/vnd.ant.mermaid';

export interface SerializedArtifactNode extends SerializedLexicalNode {
  contentType: ArtifactContentType;
  content: string;
  metadata?: {
    title?: string;
    description?: string;
  };
  type: 'artifact';
  version: 1;
}

// Helper function to convert DOM element data attributes to node properties
function convertArtifactElement(domNode: Node): DOMConversionOutput | null {
  const element = domNode as HTMLElement;
  const contentType = element.getAttribute('data-artifact-content-type');
  const content = element.getAttribute('data-artifact-content');
  const title = element.getAttribute('data-artifact-title');
  const description = element.getAttribute('data-artifact-description');

  if (contentType && content) {
    const metadata = (title || description) ? { title: title || undefined, description: description || undefined } : undefined;
    const node = $createArtifactNode(
      contentType as ArtifactContentType,
      content,
      metadata,
    );
    return { node };
  }
  return null;
}

export class ArtifactNode extends DecoratorNode<JSX.Element> {
  __contentType: ArtifactContentType;
  __content: string;
  __metadata?: {
    title?: string;
    description?: string;
  };

  static getType(): string {
    return 'artifact';
  }

  static clone(node: ArtifactNode): ArtifactNode {
    return new ArtifactNode(node.__contentType, node.__content, node.__metadata, node.__key);
  }

  static importJSON(serializedNode: SerializedArtifactNode): ArtifactNode {
    const node = $createArtifactNode(
      serializedNode.contentType,
      serializedNode.content,
      serializedNode.metadata,
    );
    return node;
  }

  constructor(
    contentType: ArtifactContentType,
    content: string,
    metadata?: {
      title?: string;
      description?: string;
    },
    key?: NodeKey,
  ) {
    super(key);
    this.__contentType = contentType;
    this.__content = content;
    this.__metadata = metadata;
  }

  exportJSON(): SerializedArtifactNode {
    return {
      contentType: this.__contentType,
      content: this.__content,
      metadata: this.__metadata,
      type: 'artifact',
      version: 1,
    };
  }

  // Convert node to DOM representation
  createDOM(config: EditorConfig): HTMLElement {
    const div = document.createElement('div');
    div.style.display = 'contents'; // Use contents display to avoid extra div affecting layout
    // Store data in attributes for potential DOM conversion
    div.setAttribute('data-artifact-content-type', this.__contentType);
    div.setAttribute('data-artifact-content', this.__content);
    if (this.__metadata?.title) {
      div.setAttribute('data-artifact-title', this.__metadata.title);
    }
    if (this.__metadata?.description) {
      div.setAttribute('data-artifact-description', this.__metadata.description);
    }
    return div;
  }

  // Since createDOM returns a container, updateDOM can return false
  updateDOM(
    prevNode: ArtifactNode,
    dom: HTMLElement,
    config: EditorConfig,
  ): boolean {
    // Returning false indicates that the decorator component handles updates.
    return false;
  }

  // Define how to import this node from DOM elements
  static importDOM(): DOMConversionMap | null {
    return {
      div: (node: Node) => ({
        conversion: convertArtifactElement,
        priority: 1, // Higher priority if multiple converters match
      }),
    };
  }

  // Define how to export this node to DOM
  exportDOM(): DOMExportOutput {
    const element = document.createElement('div');
    element.setAttribute('data-artifact-content-type', this.__contentType);
    element.setAttribute('data-artifact-content', this.__content);
    if (this.__metadata?.title) {
      element.setAttribute('data-artifact-title', this.__metadata.title);
    }
    if (this.__metadata?.description) {
      element.setAttribute('data-artifact-description', this.__metadata.description);
    }
    // The actual rendering is handled by the decorate method's React component
    return { element };
  }

  getTextContent(): string {
    // Provide a textual representation, e.g., for copy/paste or plain text export
    if (this.__metadata?.title) {
      return `[Artifact: ${this.__metadata.title}]`;
    }
    return `[Artifact: ${this.__contentType}]`;
  }

  isInline(): false {
    return false; // Artifacts are block-level elements
  }

  // The core rendering logic using a React component
  decorate(editor: LexicalEditor, config: EditorConfig): JSX.Element {
    return React.createElement(
      React.Suspense, 
      { fallback: null },
      React.createElement(ArtifactRenderer, {
        contentType: this.__contentType,
        content: this.__content,
        nodeKey: this.getKey(),
        metadata: this.__metadata
      })
    );
  }
}

export function $createArtifactNode(
  contentType: ArtifactContentType,
  content: string,
  metadata?: {
    title?: string;
    description?: string;
  },
): ArtifactNode {
  return new ArtifactNode(contentType, content, metadata);
}

export function $isArtifactNode(
  node: LexicalNode | null | undefined,
): node is ArtifactNode {
  return node instanceof ArtifactNode;
}