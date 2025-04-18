import { useCallback, useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { EditorState } from 'lexical';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import debounce from 'lodash-es/debounce';
import { restoreEditorState, serializeEditorState } from './utils/stateRestoration';
import './SQLiteStoragePlugin.css';

interface SQLiteStoragePluginProps {
  documentId?: string;
  autoSaveInterval?: number;
}

export function SQLiteStoragePlugin({ 
  documentId = 'default',
  autoSaveInterval = 1000 
}: SQLiteStoragePluginProps) {
  const [editor] = useLexicalComposerContext();
  const [isSaving, setIsSaving] = useState(false);
  const [db, setDb] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize SQLite
  useEffect(() => {
    const initSQLite = async () => {
      try {
        console.log('SQLiteStoragePlugin: Starting initialization...');
        // Initialize SQLite with the correct configuration
        const sqlite3 = await sqlite3InitModule({
          locateFile: (file: string) => {
            console.log('SQLiteStoragePlugin: Locating file:', file);
            // Always use the path from the public directory
            return `/sqlite-wasm/${file}`;
          }
        });
        
        console.log('SQLiteStoragePlugin: SQLite initialized successfully', sqlite3);
        
        // Create a new database using the correct Database constructor path
        const newDb = new sqlite3.oo1.DB(':memory:');
        console.log('SQLiteStoragePlugin: Database created');
        
        // Create tables if they don't exist
        await newDb.exec(`
          CREATE TABLE IF NOT EXISTS tiles (
            id TEXT PRIMARY KEY,
            content TEXT,
            last_modified INTEGER
          );
        `);
        console.log('SQLiteStoragePlugin: Table created or already exists');
        
        setDb(newDb);
        setIsInitialized(true);
        console.log('SQLiteStoragePlugin: Initialization complete');
      } catch (error) {
        console.error('SQLiteStoragePlugin: Failed to initialize SQLite:', error);
      }
    };

    initSQLite();
  }, []);

  // Save editor state to SQLite
  const saveEditorState = useCallback(async (editorState: EditorState) => {
    console.log('SQLiteStoragePlugin: Attempting to save editor state', { 
      dbExists: !!db, 
      isInitialized, 
      documentId 
    });
    
    if (!db || !isInitialized) {
      console.log('SQLiteStoragePlugin: Cannot save - db or initialization not ready');
      return;
    }

    try {
      setIsSaving(true);
      const editorStateJSON = serializeEditorState(editorState);
      const timestamp = Date.now();

      await db.exec(
        `INSERT OR REPLACE INTO tiles (id, content, last_modified) 
         VALUES (?, ?, ?)`,
        [documentId, editorStateJSON, timestamp]
      );
      
      console.log(`SQLiteStoragePlugin: Document ${documentId} saved successfully`);
    } catch (error) {
      console.error('SQLiteStoragePlugin: Failed to save editor state:', error);
    } finally {
      setIsSaving(false);
    }
  }, [db, documentId, isInitialized]);

  // Load editor state from SQLite
  const loadEditorState = useCallback(async () => {
    if (!db || !isInitialized) return;

    try {
      const result = await db.exec(
        'SELECT content FROM tiles WHERE id = ?',
        [documentId]
      );

      if (result.length > 0 && result[0].rows.length > 0) {
        const content = result[0].rows[0].content;
        const editorStateJSON = JSON.parse(content);
        await restoreEditorState(editor, editorStateJSON);
        console.log(`Document ${documentId} loaded successfully`);
      } else {
        console.log(`No saved document found for ID: ${documentId}`);
      }
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

  // Manual save function
  const handleManualSave = useCallback(() => {
    console.log('SQLiteStoragePlugin: Manual save button clicked', { 
      isInitialized, 
      isSaving 
    });
    
    if (!isInitialized) {
      console.log('SQLiteStoragePlugin: Cannot save - not initialized');
      return;
    }
    
    editor.getEditorState().read(() => {
      const editorState = editor.getEditorState();
      saveEditorState(editorState);
    });
  }, [editor, saveEditorState, isInitialized]);

  return (
    <div className="sqlite-storage-plugin">
      <button 
        onClick={handleManualSave}
        disabled={isSaving || !isInitialized}
        className="save-button"
      >
        {isSaving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
} 