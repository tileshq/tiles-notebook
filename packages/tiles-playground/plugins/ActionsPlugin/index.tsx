'use client';

/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {LexicalEditor} from 'lexical';

import {$createCodeNode, $isCodeNode} from '@lexical/code';
import {
  editorStateFromSerializedDocument,
  exportFile,
  importFile,
  SerializedDocument,
  serializedDocumentFromEditorState,
} from '@lexical/file';
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
} from '@lexical/markdown';
import {useCollaborationContext} from '@lexical/react/LexicalCollaborationContext';
import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {mergeRegister} from '@lexical/utils';
import {CONNECTED_COMMAND, TOGGLE_CONNECT_COMMAND} from '@lexical/yjs';
import {
  $createTextNode,
  $getRoot,
  $isParagraphNode,
  CLEAR_EDITOR_COMMAND,
  CLEAR_HISTORY_COMMAND,
  COMMAND_PRIORITY_EDITOR,
} from 'lexical';
import {useCallback, useEffect, useState} from 'react';

import {INITIAL_SETTINGS} from '@/utils/appSettings';
import useFlashMessage from '@/hooks/useFlashMessage';
import useModal from '@/hooks/useModal';
import Button from '@/ui/Button';
import {docFromHash, docToHash} from '@/utils/docSerialization';
import {PLAYGROUND_TRANSFORMERS} from '../MarkdownTransformers';
/*import {
  SPEECH_TO_TEXT_COMMAND,
  SUPPORT_SPEECH_RECOGNITION,
} from '../SpeechToTextPlugin';*/

async function sendEditorState(editor: LexicalEditor): Promise<void> {
  const stringifiedEditorState = JSON.stringify(editor.getEditorState());
  try {
    await fetch('http://localhost:1235/setEditorState', {
      body: stringifiedEditorState,
      headers: {
        Accept: 'application/json',
        'Content-type': 'application/json',
      },
      method: 'POST',
    });
  } catch {
    // NO-OP
  }
}

async function validateEditorState(editor: LexicalEditor): Promise<void> {
  const stringifiedEditorState = JSON.stringify(editor.getEditorState());
  let response: Response | null = null;
  try {
    response = await fetch('http://localhost:1235/validateEditorState', {
      body: stringifiedEditorState,
      headers: {
        Accept: 'application/json',
        'Content-type': 'application/json',
      },
      method: 'POST',
    });
  } catch {
    // NO-OP
  }
  if (response !== null && response.status === 403) {
    throw new Error(
      'Editor state validation failed! Server did not accept changes.',
    );
  }
}

async function shareDoc(doc: SerializedDocument): Promise<void> {
  const url = new URL(window.location.toString());
  url.hash = await docToHash(doc);
  const newUrl = url.toString();
  window.history.replaceState({}, '', newUrl);
  await window.navigator.clipboard.writeText(newUrl);
}

function WaitlistPanel({
  onClose,
}: {
  onClose: () => void;
}): JSX.Element {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const showFlashMessage = useFlashMessage();

  const handleSubmit = async () => {
    if (!email) {
      showFlashMessage('Please enter an email address');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error('Failed to join waitlist');
      }

      showFlashMessage('Successfully joined the waitlist!');
      onClose();
    } catch (error) {
      console.error('Error joining waitlist:', error);
      showFlashMessage('Failed to join waitlist. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="waitlist-panel">
      <div className="waitlist-panel-header">
        <h3>Join Waitlist</h3>
        <button
          className="close-button"
          onClick={onClose}
          aria-label="Close waitlist panel">
          ×
        </button>
      </div>
      <div className="waitlist-panel-content">
        <p>Enter your email to join our waitlist and be notified when we launch.</p>
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSubmit();
            }
          }}
        />
        <div className="button-container">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}>
            {isSubmitting ? 'Joining...' : 'Join Waitlist'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ActionsPlugin({
  isRichText,
  shouldPreserveNewLinesInMarkdown,
}: {
  isRichText: boolean;
  shouldPreserveNewLinesInMarkdown: boolean;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const [isEditable, setIsEditable] = useState(() => editor.isEditable());
  const [connected, setConnected] = useState(false);
  const [isEditorEmpty, setIsEditorEmpty] = useState(true);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [modal, showModal] = useModal();
  const showFlashMessage = useFlashMessage();
  const {isCollabActive} = useCollaborationContext();
  useEffect(() => {
    if (INITIAL_SETTINGS.isCollab) {
      return;
    }
    docFromHash(window.location.hash).then((doc) => {
      if (doc && doc.source === 'Playground') {
        editor.setEditorState(editorStateFromSerializedDocument(editor, doc));
        editor.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined);
      }
    });
  }, [editor]);
  useEffect(() => {
    return mergeRegister(
      editor.registerEditableListener((editable) => {
        setIsEditable(editable);
      }),
      editor.registerCommand<boolean>(
        CONNECTED_COMMAND,
        (payload) => {
          const isConnected = payload;
          setConnected(isConnected);
          return false;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
    );
  }, [editor]);

  useEffect(() => {
    return editor.registerUpdateListener(
      ({dirtyElements, prevEditorState, tags}) => {
        // If we are in read only mode, send the editor state
        // to server and ask for validation if possible.
        if (
          !isEditable &&
          dirtyElements.size > 0 &&
          !tags.has('historic') &&
          !tags.has('collaboration')
        ) {
          validateEditorState(editor);
        }
        editor.getEditorState().read(() => {
          const root = $getRoot();
          const children = root.getChildren();

          if (children.length > 1) {
            setIsEditorEmpty(false);
          } else {
            if ($isParagraphNode(children[0])) {
              const paragraphChildren = children[0].getChildren();
              setIsEditorEmpty(paragraphChildren.length === 0);
            } else {
              setIsEditorEmpty(false);
            }
          }
        });
      },
    );
  }, [editor, isEditable]);

  const handleMarkdownToggle = useCallback(() => {
    editor.update(() => {
      const root = $getRoot();
      const firstChild = root.getFirstChild();
      if ($isCodeNode(firstChild) && firstChild.getLanguage() === 'markdown') {
        $convertFromMarkdownString(
          firstChild.getTextContent(),
          PLAYGROUND_TRANSFORMERS,
          undefined, // node
          shouldPreserveNewLinesInMarkdown,
        );
      } else {
        const markdown = $convertToMarkdownString(
          PLAYGROUND_TRANSFORMERS,
          undefined, //node
          shouldPreserveNewLinesInMarkdown,
        );
        const codeNode = $createCodeNode('markdown');
        codeNode.append($createTextNode(markdown));
        root.clear().append(codeNode);
        if (markdown.length === 0) {
          codeNode.select();
        }
      }
    });
  }, [editor, shouldPreserveNewLinesInMarkdown]);

  return (
    <>
      <div className="actions">
        <button
          className="action-button waitlist"
          onClick={() => setShowWaitlist(!showWaitlist)}
          title="Join Waitlist"
          aria-label="Join the waitlist"
          style={{ color: '#444' }}>
          <i className="users" />
          <span>Join Waitlist</span>
        </button>
        <button
          className="action-button share"
          disabled={isCollabActive || INITIAL_SETTINGS.isCollab}
          onClick={async () => {
            try {
              const editorStateJSON = JSON.stringify(editor.getEditorState());
              const createResponse = await fetch('/api/documents', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  content: editorStateJSON,
                }),
              });

              if (!createResponse.ok) {
                throw new Error('Failed to create document');
              }

              const doc = await createResponse.json();
              const shareResponse = await fetch(`/api/documents/${doc.id}/share`, {
                method: 'POST',
              });

              if (!shareResponse.ok) {
                throw new Error('Failed to create share link');
              }

              const { shareUrl } = await shareResponse.json();
              await navigator.clipboard.writeText(shareUrl);
              showFlashMessage('Share URL copied to clipboard');
            } catch (error) {
              console.error('Error sharing document:', error);
              showFlashMessage('Failed to create share link');
            }
          }}
          title="Share"
          aria-label="Share document link">
          <i className="share" />
        </button>
      </div>
      {showWaitlist && (
        <WaitlistPanel onClose={() => setShowWaitlist(false)} />
      )}
    </>
  );
}

function ShowClearDialog({
  editor,
  onClose,
}: {
  editor: LexicalEditor;
  onClose: () => void;
}): JSX.Element {
  return (
    <>
      Are you sure you want to clear the editor?
      <div className="Modal__content">
        <Button
          onClick={() => {
            editor.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined);
            editor.focus();
            onClose();
          }}>
          Clear
        </Button>{' '}
        <Button
          onClick={() => {
            editor.focus();
            onClose();
          }}>
          Cancel
        </Button>
      </div>
    </>
  );
}
