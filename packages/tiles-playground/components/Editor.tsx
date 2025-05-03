'use client';

/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {AutoFocusPlugin} from '@lexical/react/LexicalAutoFocusPlugin';
import {CharacterLimitPlugin} from '@lexical/react/LexicalCharacterLimitPlugin';
import {CheckListPlugin} from '@lexical/react/LexicalCheckListPlugin';
import {ClearEditorPlugin} from '@lexical/react/LexicalClearEditorPlugin';
import {ClickableLinkPlugin} from '@lexical/react/LexicalClickableLinkPlugin';
import {CollaborationPlugin} from '@lexical/react/LexicalCollaborationPlugin';
import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {LexicalErrorBoundary} from '@lexical/react/LexicalErrorBoundary';
import {HashtagPlugin} from '@lexical/react/LexicalHashtagPlugin';
import {HistoryPlugin} from '@lexical/react/LexicalHistoryPlugin';
import {HorizontalRulePlugin} from '@lexical/react/LexicalHorizontalRulePlugin';
import {ListPlugin} from '@lexical/react/LexicalListPlugin';
import {PlainTextPlugin} from '@lexical/react/LexicalPlainTextPlugin';
import {RichTextPlugin} from '@lexical/react/LexicalRichTextPlugin';
import {SelectionAlwaysOnDisplay} from '@lexical/react/LexicalSelectionAlwaysOnDisplay';
import {TabIndentationPlugin} from '@lexical/react/LexicalTabIndentationPlugin';
import {TablePlugin} from '@lexical/react/LexicalTablePlugin';
import {useLexicalEditable} from '@lexical/react/useLexicalEditable';
import * as React from 'react';
import {useEffect, useState} from 'react';
import {CAN_USE_DOM} from '@/shared/canUseDOM';

import {createWebsocketProvider} from '@/utils/collaboration';
import {useSettings} from '@/context/SettingsContext';
import {useSharedHistoryContext} from '@/context/SharedHistoryContext';
import ActionsPlugin from '@/plugins/ActionsPlugin';
import AutocompletePlugin from '@/plugins/AutocompletePlugin';
import AutoEmbedPlugin from '@/plugins/AutoEmbedPlugin';
import AutoLinkPlugin from '@/plugins/AutoLinkPlugin';
import CodeActionMenuPlugin from '@/plugins/CodeActionMenuPlugin';
import CodeHighlightPlugin from '@/plugins/CodeHighlightPlugin';
import CollapsiblePlugin from '@/plugins/CollapsiblePlugin';
//import CommentPlugin from '@/plugins/CommentPlugin';
import ComponentPickerPlugin from '@/plugins/ComponentPickerPlugin';
import ContextMenuPlugin from '@/plugins/ContextMenuPlugin';
import DragDropPaste from '@/plugins/DragDropPastePlugin';
import DraggableBlockPlugin from '@/plugins/DraggableBlockPlugin';
import EmojiPickerPlugin from '@/plugins/EmojiPickerPlugin';
import EmojisPlugin from '@/plugins/EmojisPlugin';
import EquationsPlugin from '@/plugins/EquationsPlugin';
//import ExcalidrawPlugin from '@/plugins/ExcalidrawPlugin';
import FigmaPlugin from '@/plugins/FigmaPlugin';
import FloatingLinkEditorPlugin from '@/plugins/FloatingLinkEditorPlugin';
import FloatingTextFormatToolbarPlugin from '@/plugins/FloatingTextFormatToolbarPlugin';
import ImagesPlugin from '@/plugins/ImagesPlugin';
//import InlineImagePlugin from '@/plugins/InlineImagePlugin';
import KeywordsPlugin from '@/plugins/KeywordsPlugin';
import {LayoutPlugin} from '@/plugins/LayoutPlugin/LayoutPlugin';
import LinkPlugin from '@/plugins/LinkPlugin';
import ListMaxIndentLevelPlugin from '@/plugins/ListMaxIndentLevelPlugin';
import MarkdownShortcutPlugin from '@/plugins/MarkdownShortcutPlugin';
import {MaxLengthPlugin} from '@/plugins/MaxLengthPlugin';
import MentionsPlugin from '@/plugins/MCPServerletListPlugin';
import PageBreakPlugin from '@/plugins/PageBreakPlugin';
import PollPlugin from '@/plugins/PollPlugin';
import ShortcutsPlugin from '@/plugins/ShortcutsPlugin';
import SpecialTextPlugin from '@/plugins/SpecialTextPlugin';
//import SpeechToTextPlugin from '@/plugins/SpeechToTextPlugin';
import TabFocusPlugin from '@/plugins/TabFocusPlugin';
import TableCellActionMenuPlugin from '@/plugins/TableActionMenuPlugin';
//import TableCellResizer from '@/plugins/TableCellResizer';
import TableHoverActionsPlugin from '@/plugins/TableHoverActionsPlugin';
import TableOfContentsPlugin from '@/plugins/TableOfContentsPlugin';
import ToolbarPlugin from '@/plugins/ToolbarPlugin';
import TreeViewPlugin from '@/plugins/TreeViewPlugin';
import TwitterPlugin from '@/plugins/TwitterPlugin';
import YouTubePlugin from '@/plugins/YouTubePlugin';
import ContentEditable from '@/ui/ContentEditable';
import '../styles/editor.css';
import {IndexedDBStoragePlugin} from '@/plugins/IndexedDBStoragePlugin';
import {StoragePlugin} from '@/plugins/StoragePlugin';

// Handle window access safely with Next.js
const skipCollaborationInit = typeof window !== 'undefined' ? 
  // @ts-expect-error
  window.parent != null && window.parent.frames.right === window : 
  false;

interface EditorProps {
  documentId?: string;
  initialContent?: any;
  readOnly?: boolean;
  isSharedView?: boolean;
}

export default function Editor({
  documentId = 'main-editor',
  initialContent,
  readOnly = false,
  isSharedView = false,
}: EditorProps): JSX.Element {
  const {historyState} = useSharedHistoryContext();
  const {
    settings: {
      isCollab,
      isAutocomplete,
      isMaxLength,
      isCharLimit,
      hasLinkAttributes,
      isCharLimitUtf8,
      isRichText,
      showTreeView,
      showTableOfContents,
      shouldUseLexicalContextMenu,
      shouldPreserveNewLinesInMarkdown,
      tableCellMerge,
      tableCellBackgroundColor,
      tableHorizontalScroll,
      shouldAllowHighlightingWithBrackets,
      selectionAlwaysOnDisplay,
    },
  } = useSettings();
  const [isEditable, setIsEditable] = useState(!readOnly);
  const placeholder = isSharedView 
    ? 'You can edit this document, but changes won\'t be saved...'
    : isCollab
    ? 'Enter some collaborative rich text...'
    : isRichText
    ? 'Enter some rich text. Use @ to call MCP servers.'
    : 'Enter some plain text...';
  const [floatingAnchorElem, setFloatingAnchorElem] =
    useState<HTMLDivElement | null>(null);
  const [isSmallWidthViewport, setIsSmallWidthViewport] =
    useState<boolean>(false);
  const [editor] = useLexicalComposerContext();
  const [activeEditor, setActiveEditor] = useState(editor);
  const [isLinkEditMode, setIsLinkEditMode] = useState<boolean>(false);

  // Set initial editor state if provided
  useEffect(() => {
    if (initialContent) {
      editor.setEditorState(editor.parseEditorState(initialContent));
    }
  }, [editor, initialContent]);

  // Set read-only mode
  useEffect(() => {
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  const onRef = (_floatingAnchorElem: HTMLDivElement) => {
    if (_floatingAnchorElem !== null) {
      setFloatingAnchorElem(_floatingAnchorElem);
    }
  };

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
      {isRichText && !readOnly && !isSharedView && (
        <ToolbarPlugin
          editor={editor}
          activeEditor={activeEditor}
          setActiveEditor={setActiveEditor}
          setIsLinkEditMode={setIsLinkEditMode}
        />
      )}
      {isRichText && !readOnly && !isSharedView && (
        <ShortcutsPlugin
          editor={activeEditor}
          setIsLinkEditMode={setIsLinkEditMode}
        />
      )}
      <div
        className={`editor-container ${showTreeView ? 'tree-view' : ''} ${
          !isRichText ? 'plain-text' : ''
        } ${readOnly ? 'read-only' : ''} ${isSharedView ? 'shared-view' : ''}`}>
        {isMaxLength && <MaxLengthPlugin maxLength={30} />}
        <DragDropPaste />
        <AutoFocusPlugin />
        {selectionAlwaysOnDisplay && <SelectionAlwaysOnDisplay />}
        <ClearEditorPlugin />
        <ComponentPickerPlugin />
        <EmojiPickerPlugin />
        <AutoEmbedPlugin />
        <MentionsPlugin />
        <EmojisPlugin />
        <HashtagPlugin />
        <KeywordsPlugin />
        {/*<SpeechToTextPlugin />*/}
        <AutoLinkPlugin />
        {/*<CommentPlugin
          providerFactory={isCollab ? createWebsocketProvider : undefined}
        />*/}
        {isRichText ? (
          <>
            {isCollab ? (
              <CollaborationPlugin
                id="main"
                providerFactory={createWebsocketProvider}
                shouldBootstrap={!skipCollaborationInit}
              />
            ) : null}
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
            <HistoryPlugin />
            <MarkdownShortcutPlugin />
            <CodeHighlightPlugin />
            <ListPlugin />
            <CheckListPlugin />
            <ListMaxIndentLevelPlugin maxDepth={7} />
            <TablePlugin
              hasCellMerge={tableCellMerge}
              hasCellBackgroundColor={tableCellBackgroundColor}
              hasHorizontalScroll={tableHorizontalScroll}
            />
            {/*<TableCellResizer />*/}
            <ImagesPlugin />
            {/*<InlineImagePlugin />*/}
            <LinkPlugin hasLinkAttributes={hasLinkAttributes} />
            <PollPlugin />
            <TwitterPlugin />
            <YouTubePlugin />
            <FigmaPlugin />
            <ClickableLinkPlugin disabled={isEditable} />
            <HorizontalRulePlugin />
            <EquationsPlugin />
            {/*<ExcalidrawPlugin />*/}
            <TabFocusPlugin />
            <TabIndentationPlugin />
            <CollapsiblePlugin />
            <PageBreakPlugin />
            <LayoutPlugin />
            {floatingAnchorElem && !isSmallWidthViewport && (
              <>
                <DraggableBlockPlugin anchorElem={floatingAnchorElem} />
                <CodeActionMenuPlugin anchorElem={floatingAnchorElem} />
                <FloatingLinkEditorPlugin
                  anchorElem={floatingAnchorElem}
                  isLinkEditMode={isLinkEditMode}
                  setIsLinkEditMode={setIsLinkEditMode}
                />
                <TableCellActionMenuPlugin
                  anchorElem={floatingAnchorElem}
                  cellMerge={true}
                />
                <TableHoverActionsPlugin anchorElem={floatingAnchorElem} />
                <FloatingTextFormatToolbarPlugin
                  anchorElem={floatingAnchorElem}
                  setIsLinkEditMode={setIsLinkEditMode}
                />
              </>
            )}
          </>
        ) : (
          <>
            <PlainTextPlugin
              contentEditable={<ContentEditable placeholder={placeholder} />}
              ErrorBoundary={LexicalErrorBoundary}
            />
          </>
        )}
        {(isCharLimit || isCharLimitUtf8) && (
          <CharacterLimitPlugin
            charset={isCharLimit ? 'UTF-16' : 'UTF-8'}
            maxLength={5}
          />
        )}
        {isAutocomplete && <AutocompletePlugin />}
        <div>{showTableOfContents && <TableOfContentsPlugin />}</div>
        {shouldUseLexicalContextMenu && <ContextMenuPlugin />}
        {shouldAllowHighlightingWithBrackets && <SpecialTextPlugin />}
        {!isSharedView && (
          <ActionsPlugin
            isRichText={isRichText}
            shouldPreserveNewLinesInMarkdown={shouldPreserveNewLinesInMarkdown}
          />
        )}
        {!isSharedView && (
          <StoragePlugin documentId={documentId} autoSaveInterval={1000} />
        )}
      </div>
      {showTreeView && !readOnly && !isSharedView && <TreeViewPlugin />}
    </>
  );
}