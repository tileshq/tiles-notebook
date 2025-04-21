'use client';

import { LexicalComposer } from '@lexical/react/LexicalComposer';
import PlaygroundNodes from '@/nodes/PlaygroundNodes';
import PlaygroundEditorTheme from '@/themes/PlaygroundEditorTheme';
import { useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { ClickableLinkPlugin } from '@lexical/react/LexicalClickableLinkPlugin';
import { HashtagPlugin } from '@lexical/react/LexicalHashtagPlugin';
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { SelectionAlwaysOnDisplay } from '@lexical/react/LexicalSelectionAlwaysOnDisplay';
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import * as React from 'react';
import { CAN_USE_DOM } from '@/shared/canUseDOM';
import ContentEditable from '@/ui/ContentEditable';
import { useSettings } from '@/context/SettingsContext';
import { useSharedHistoryContext } from '@/context/SharedHistoryContext';
import useFlashMessage from '@/hooks/useFlashMessage';
import { FlashMessageContext } from '@/context/FlashMessageContext';
import AutoEmbedPlugin from '@/plugins/AutoEmbedPlugin';
import AutoLinkPlugin from '@/plugins/AutoLinkPlugin';
import CodeHighlightPlugin from '@/plugins/CodeHighlightPlugin';
import CollapsiblePlugin from '@/plugins/CollapsiblePlugin';
import EmojisPlugin from '@/plugins/EmojisPlugin';
import EquationsPlugin from '@/plugins/EquationsPlugin';
import FigmaPlugin from '@/plugins/FigmaPlugin';
import KeywordsPlugin from '@/plugins/KeywordsPlugin';
import { LayoutPlugin } from '@/plugins/LayoutPlugin/LayoutPlugin';
import LinkPlugin from '@/plugins/LinkPlugin';
import PageBreakPlugin from '@/plugins/PageBreakPlugin';
import PollPlugin from '@/plugins/PollPlugin';
import SpecialTextPlugin from '@/plugins/SpecialTextPlugin';
import TableOfContentsPlugin from '@/plugins/TableOfContentsPlugin';
import TreeViewPlugin from '@/plugins/TreeViewPlugin';
import TwitterPlugin from '@/plugins/TwitterPlugin';
import YouTubePlugin from '@/plugins/YouTubePlugin';
import { TableContext } from '@/plugins/TablePlugin';
import { ToolbarContext } from '@/context/ToolbarContext';
import '@/styles/editor.css';

interface SharedEditorProps {
  documentId: string;
  initialContent: any;
}

function SharedToolbar() {
  const showFlashMessage = useFlashMessage();
  
  return (
    <div className="toolbar shared-toolbar">
      <div className="toolbar-item" style={{ flex: 1 }}>
        <a href="https://tiles.run" target="_blank" rel="noreferrer" style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
          <img
            src="/icon.png"
            alt="Tiles Logo"
            style={{height: 'auto', width: '32px'}}
          />
        </a>
      </div>
      <div className="toolbar-item">
        <button 
          className="toolbar-button"
          onClick={() => {
            // Copy the current URL to clipboard
            navigator.clipboard.writeText(window.location.href);
            showFlashMessage('Share URL copied to clipboard');
          }}
        >
          Share
        </button>
      </div>
    </div>
  );
}

function SharedEditorContent({ documentId, initialContent }: SharedEditorProps) {
  const { historyState } = useSharedHistoryContext();
  const {
    settings: {
      isCollab,
      hasLinkAttributes,
      isRichText,
      showTreeView,
      showTableOfContents,
      tableCellMerge,
      tableCellBackgroundColor,
      tableHorizontalScroll,
      shouldAllowHighlightingWithBrackets,
      selectionAlwaysOnDisplay,
    },
  } = useSettings();
  const isEditable = false;
  const placeholder = 'This is a shared document. You can view but not edit.';
  const [floatingAnchorElem, setFloatingAnchorElem] = useState<HTMLDivElement | null>(null);
  const [isSmallWidthViewport, setIsSmallWidthViewport] = useState<boolean>(false);
  const [editor] = useLexicalComposerContext();

  const onRef = (_floatingAnchorElem: HTMLDivElement) => {
    if (_floatingAnchorElem !== null) {
      setFloatingAnchorElem(_floatingAnchorElem);
    }
  };

  useEffect(() => {
    if (initialContent) {
      try {
        const parsedContent = typeof initialContent === 'string'
          ? JSON.parse(initialContent)
          : initialContent;

        if (editor) {
          const editorState = editor.parseEditorState(parsedContent);
          editor.setEditorState(editorState);
        }
      } catch (error) {
        console.error('Error parsing editor content:', error);
      }
    }
  }, [editor, initialContent]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(false);
    }
  }, [editor]);

  useEffect(() => {
    const updateViewPortWidth = () => {
      const isNextSmallWidthViewport =
        CAN_USE_DOM && window.matchMedia('(max-width: 1025px)').matches;

      if (isNextSmallWidthViewport !== isSmallWidthViewport) {
        setIsSmallWidthViewport(isNextSmallWidthViewport);
      }
    };
    updateViewPortWidth();
    window.addEventListener('resize', updateViewPortWidth);

    return () => {
      window.removeEventListener('resize', updateViewPortWidth);
    };
  }, [isSmallWidthViewport]);

  return (
    <>
      <SharedToolbar />
      <div className={`editor-container ${showTreeView ? 'tree-view' : ''} ${!isRichText ? 'plain-text' : ''} read-only shared-view`}>
        <AutoFocusPlugin />
        {selectionAlwaysOnDisplay && <SelectionAlwaysOnDisplay />}
        <AutoEmbedPlugin />
        <EmojisPlugin />
        <HashtagPlugin />
        <KeywordsPlugin />
        <AutoLinkPlugin />

        {isRichText ? (
          <>
            <RichTextPlugin
              contentEditable={
                <div className="editor-scroller">
                  <div className="editor" ref={onRef}>
                    <ContentEditable placeholder={placeholder} />
                  </div>
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <CodeHighlightPlugin />
            <ListPlugin />
            <CheckListPlugin />
            <TablePlugin
              hasCellMerge={tableCellMerge}
              hasCellBackgroundColor={tableCellBackgroundColor}
              hasHorizontalScroll={tableHorizontalScroll}
            />
            <LinkPlugin hasLinkAttributes={hasLinkAttributes} />
            <PollPlugin />
            <TwitterPlugin />
            <YouTubePlugin />
            <FigmaPlugin />
            <ClickableLinkPlugin disabled={isEditable} />
            <HorizontalRulePlugin />
            <EquationsPlugin />
            <TabIndentationPlugin />
            <CollapsiblePlugin />
            <PageBreakPlugin />
            <LayoutPlugin />
          </>
        ) : (
          <>
            <PlainTextPlugin
              contentEditable={<ContentEditable placeholder={placeholder} />}
              ErrorBoundary={LexicalErrorBoundary}
            />
          </>
        )}

        <div>{showTableOfContents && <TableOfContentsPlugin />}</div>
        {shouldAllowHighlightingWithBrackets && <SpecialTextPlugin />}
      </div>
      {showTreeView && <TreeViewPlugin />}
      <footer
        style={{
          borderTop: '1px solid #eee',
          color: '#666',
          fontSize: '14px',
          marginTop: '20px',
          padding: '20px',
          textAlign: 'center',
        }}>
        <p>A new kind of notebook for making personal software.</p>
        <p>Technically it's a local-first, multiplayer enabled MCP client with notebook interface.</p>
        <p>
          Check out{' '}
          <a
            href="https://tilekit.dev"
            target="_blank"
            rel="noreferrer"
            style={{color: '#007bff', textDecoration: 'none'}}>
            Tilekit
          </a>{' '}
          for the underlying personal software framework.
        </p>
      </footer>
    </>
  );
}

export default function SharedEditor(props: SharedEditorProps) {
  const initialConfig = {
    namespace: 'Playground',
    nodes: [...PlaygroundNodes],
    onError: (error: Error) => {
      throw error;
    },
    theme: PlaygroundEditorTheme,
  };

  return (
    <FlashMessageContext>
      <LexicalComposer initialConfig={initialConfig}>
        <TableContext>
          <ToolbarContext>
            <SharedEditorContent {...props} />
          </ToolbarContext>
        </TableContext>
      </LexicalComposer>
    </FlashMessageContext>
  );
} 