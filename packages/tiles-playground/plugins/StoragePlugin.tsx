import { useCallback, useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { EditorState } from 'lexical';
import debounce from 'lodash-es/debounce';
import { nanoid } from 'nanoid';
import { restoreEditorState, serializeEditorState } from './utils/stateRestoration';

interface StoragePluginProps {
  documentId?: string;
  autoSaveInterval?: number;
}

const DB_NAME = 'tilesEditor';
const STORE_NAME = 'documents';
const DB_VERSION = 1;

export function StoragePlugin({ 
  documentId: initialDocumentId = 'default',
  autoSaveInterval = 1000 
}: StoragePluginProps) {
  const [editor] = useLexicalComposerContext();
  const [isInitialized, setIsInitialized] = useState(false);
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [documentId, setDocumentId] = useState<string>(initialDocumentId);

  // Initialize IndexedDB
  useEffect(() => {
    const initDB = () => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('StoragePlugin: Error opening DB:', event);
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        setDb(db);
        setIsInitialized(true);
        console.log('StoragePlugin: DB initialized successfully');
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          console.log('StoragePlugin: Object store created');
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

  // Create initial document if it doesn't exist
  const createDocument = useCallback(async (content: string) => {
    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: nanoid(), // Generate a new ID
          title: 'Untitled',
          content,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create document');
      }

      const doc = await response.json();
      setDocumentId(doc.id); // Update the document ID
      return doc;
    } catch (error) {
      console.error('Failed to create document:', error);
      return null;
    }
  }, []);

  // Save to both IndexedDB and server
  const saveEditorState = useCallback(async (editorState: EditorState) => {
    if (!db || !isInitialized) {
      console.log('StoragePlugin: Cannot save - db or initialization not ready');
      return;
    }

    try {
      const editorStateJSON = serializeEditorState(editorState);
      
      // Save to IndexedDB
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const doc = {
        id: documentId,
        content: editorStateJSON,
        lastModified: Date.now()
      };

      const idbPromise = new Promise<void>((resolve, reject) => {
        const request = store.put(doc);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Save to server
      const serverPromise = fetch(`/api/documents/${documentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: editorStateJSON,
        }),
      });

      // Wait for both operations to complete
      await Promise.all([idbPromise, serverPromise]);
      console.log(`StoragePlugin: Document ${documentId} saved successfully`);
    } catch (error) {
      console.error('StoragePlugin: Failed to save editor state:', error);
    }
  }, [db, documentId, isInitialized]);

  // Load from server first, fall back to IndexedDB
  const loadEditorState = useCallback(async () => {
    if (!db || !isInitialized) return;

    try {
      // Try loading from server first
      const serverResponse = await fetch(`/api/documents/${documentId}`);
      
      if (serverResponse.ok) {
        const doc = await serverResponse.json();
        const editorStateJSON = JSON.parse(doc.content);
        restoreEditorState(editor, editorStateJSON);
        console.log(`Document ${documentId} loaded from server successfully`);
        return;
      }

      // If document doesn't exist on server and this is the default document,
      // create a new one
      if (documentId === initialDocumentId) {
        const currentState = editor.getEditorState();
        const serializedState = JSON.stringify(currentState);
        const newDoc = await createDocument(serializedState);
        if (newDoc) {
          console.log('Created new document:', newDoc.id);
          return;
        }
      }

      // Fall back to IndexedDB if server fails
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      return new Promise<void>((resolve, reject) => {
        const request = store.get(documentId);

        request.onsuccess = () => {
          const doc = request.result;
          if (doc) {
            const editorStateJSON = JSON.parse(doc.content);
            restoreEditorState(editor, editorStateJSON);
            console.log(`Document ${documentId} loaded from IndexedDB successfully`);
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
  }, [db, documentId, editor, isInitialized, createDocument, initialDocumentId]);

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