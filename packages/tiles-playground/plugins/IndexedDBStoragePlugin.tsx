import { useCallback, useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { EditorState } from 'lexical';
import debounce from 'lodash-es/debounce';
import { restoreEditorState, serializeEditorState } from './utils/stateRestoration';

interface IndexedDBStoragePluginProps {
  documentId?: string;
  autoSaveInterval?: number;
}

const DB_NAME = 'tilesEditor';
const STORE_NAME = 'documents';
const DB_VERSION = 1;

export function IndexedDBStoragePlugin({ 
  documentId = 'default',
  autoSaveInterval = 1000 
}: IndexedDBStoragePluginProps) {
  const [editor] = useLexicalComposerContext();
  const [isInitialized, setIsInitialized] = useState(false);
  const [db, setDb] = useState<IDBDatabase | null>(null);

  // Initialize IndexedDB
  useEffect(() => {
    const initDB = () => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('IndexedDBStoragePlugin: Error opening DB:', event);
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        setDb(db);
        setIsInitialized(true);
        console.log('IndexedDBStoragePlugin: DB initialized successfully');
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          console.log('IndexedDBStoragePlugin: Object store created');
        }
      };
    };

    initDB();

    return () => {
      if (db) {
        db.close();
      }
    };
  }, []);

  // Save editor state to IndexedDB
  const saveEditorState = useCallback(async (editorState: EditorState) => {
    if (!db || !isInitialized) {
      console.log('IndexedDBStoragePlugin: Cannot save - db or initialization not ready');
      return;
    }

    try {
      const editorStateJSON = serializeEditorState(editorState);
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const doc = {
        id: documentId,
        content: editorStateJSON,
        lastModified: Date.now()
      };

      return new Promise<void>((resolve, reject) => {
        const request = store.put(doc);
        
        request.onsuccess = () => {
          console.log(`IndexedDBStoragePlugin: Document ${documentId} saved successfully`);
          resolve();
        };

        request.onerror = () => {
          console.error('IndexedDBStoragePlugin: Failed to save document:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('IndexedDBStoragePlugin: Failed to save editor state:', error);
    }
  }, [db, documentId, isInitialized]);

  // Load editor state from IndexedDB
  const loadEditorState = useCallback(async () => {
    if (!db || !isInitialized) return;

    try {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      return new Promise<void>((resolve, reject) => {
        const request = store.get(documentId);

        request.onsuccess = () => {
          const doc = request.result;
          if (doc) {
            const editorStateJSON = JSON.parse(doc.content);
            restoreEditorState(editor, editorStateJSON);
            console.log(`Document ${documentId} loaded successfully`);
          } else {
            console.log(`No saved document found for ID: ${documentId}`);
          }
          resolve();
        };

        request.onerror = () => {
          console.error('Failed to load document:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Failed to load editor state:', error);
    }
  }, [db, documentId, editor, isInitialized]);

  // Auto-save with debounce
  const debouncedSave = useCallback(
    debounce((editorState: EditorState) => {
      saveEditorState(editorState);
    }, autoSaveInterval),
    [saveEditorState]
  );

  // Set up auto-save
  useEffect(() => {
    if (!isInitialized) return;
    
    return editor.registerUpdateListener(({ editorState }) => {
      debouncedSave(editorState);
    });
  }, [editor, debouncedSave, isInitialized]);

  // Load initial state
  useEffect(() => {
    if (isInitialized) {
      loadEditorState();
    }
  }, [loadEditorState, isInitialized]);

  return null;
} 