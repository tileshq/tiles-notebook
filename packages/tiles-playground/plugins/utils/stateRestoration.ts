import { EditorState, LexicalEditor } from 'lexical';

export async function restoreEditorState(
  editor: LexicalEditor,
  editorStateJSON: any
): Promise<void> {
  const editorState = editor.parseEditorState(JSON.stringify(editorStateJSON));
  editor.setEditorState(editorState);
}

export function serializeEditorState(editorState: EditorState): string {
  return JSON.stringify(editorState.toJSON());
} 