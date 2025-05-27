import { createPlugin, LogLevel, ExtismPluginOptions } from 'extism';

export interface WasmExecutorOptions {
  useWasi?: boolean;
  config?: Record<string, any>;
  allowedHosts?: string[];
  allowedPaths?: Record<string, string>;
  logLevel?: LogLevel;
  runInWorker?: boolean;
}

export interface WasmExecutorResult {
  output: string;
  error?: string;
}

/**
 * Check if SharedArrayBuffer is available (required for threaded WASM)
 */
export function isSharedArrayBufferAvailable(): boolean {
  return typeof SharedArrayBuffer !== 'undefined' && typeof window !== 'undefined' && window.crossOriginIsolated === true;
}

export class WasmExecutor {
  private plugin: any;

  // Make constructor private to force use of static factory methods
  private constructor() {
    this.plugin = null;
  }

  // Static factory method that properly handles async initialization
  static async create(wasmBuffer: ArrayBuffer, options: WasmExecutorOptions = {}): Promise<WasmExecutor> {
    const executor = new WasmExecutor();
    await executor.initialize(wasmBuffer, options);
    return executor;
  }

  private async initialize(wasmBuffer: ArrayBuffer, options: WasmExecutorOptions): Promise<void> {
    const pluginOptions: ExtismPluginOptions = {
      useWasi: options.useWasi ?? true,
      config: options.config || {},
    };
    
    // Use the provided runInWorker option, defaulting to true for client-side
    pluginOptions.runInWorker = options.runInWorker ?? (typeof window !== 'undefined');

    if (options.allowedHosts?.length) {
      pluginOptions.allowedHosts = options.allowedHosts;
    }

    // Handle allowed paths more carefully for server environments
    if (options.allowedPaths && Object.keys(options.allowedPaths).length > 0) {
      // On server-side, be more conservative with paths
      if (typeof window === 'undefined') {
        // Server-side: only allow paths that actually exist
        const fs = await import('fs');
        const filteredPaths: Record<string, string> = {};
        
        for (const [hostPath, guestPath] of Object.entries(options.allowedPaths)) {
          try {
            // Check if the host path exists and is accessible
            await fs.promises.access(hostPath, fs.constants.F_OK);
            filteredPaths[hostPath] = guestPath;
            // console.log(`WASI path allowed: ${hostPath} -> ${guestPath}`);
          } catch (error) {
            // console.warn(`WASI path skipped (not accessible): ${hostPath} -> ${guestPath}`);
          }
        }
        
        if (Object.keys(filteredPaths).length > 0) {
          pluginOptions.allowedPaths = filteredPaths;
        } else {
          // console.log('No accessible WASI paths found, disabling WASI');
          pluginOptions.useWasi = false;
        }
      } else {
        // Client-side: use paths as provided
        pluginOptions.allowedPaths = options.allowedPaths;
      }
    }

    // Set up logging if logLevel is provided
    if (options.logLevel) {
      pluginOptions.logger = console;
      pluginOptions.logLevel = options.logLevel;
    }

    // console.log('Initializing WASM plugin with options:', pluginOptions);
    
    try {
      this.plugin = await createPlugin(wasmBuffer, pluginOptions);
      // console.debug('WASM plugin initialized successfully');
    } catch (error) {
      console.error('Failed to initialize WASM plugin:', error);
      
      // If WASI initialization failed, try without WASI
      if (pluginOptions.useWasi) {
        // console.log('Retrying WASM initialization without WASI...');
        const fallbackOptions = { ...pluginOptions };
        delete fallbackOptions.allowedPaths;
        fallbackOptions.useWasi = false;
        
        try {
          this.plugin = await createPlugin(wasmBuffer, fallbackOptions);
          // console.log('WASM plugin initialized successfully without WASI');
        } catch (fallbackError) {
          console.error('Failed to initialize WASM plugin even without WASI:', fallbackError);
          throw fallbackError;
        }
      } else {
        throw error;
      }
    }
  }

  async execute(functionName: string, input: string): Promise<WasmExecutorResult> {
    if (!this.plugin) {
      return {
        output: '',
        error: 'WASM plugin not initialized'
      };
    }

    try {
      // console.debug(`Executing WASM function: ${functionName}`);
      const outputBuffer = await this.plugin.call(functionName, input);
      // console.debug(`WASM function ${functionName} executed successfully`);
      return {
        output: outputBuffer?.text() || ''
      };
    } catch (error) {
      console.error(`Error executing WASM function ${functionName}:`, error);
      return {
        output: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async free(): Promise<void> {
    if (this.plugin) {
      // Clean up resources if needed
      this.plugin = null;
    }
  }
}

// Helper function to create a WASM executor from a file
export async function createWasmExecutorFromFile(
  file: File,
  options: WasmExecutorOptions = {}
): Promise<WasmExecutor> {
  const arrayBuffer = await file.arrayBuffer();
  return WasmExecutor.create(arrayBuffer, options);
}

// Helper function to create a WASM executor from a buffer
export async function createWasmExecutorFromBuffer(
  buffer: ArrayBuffer,
  options: WasmExecutorOptions = {}
): Promise<WasmExecutor> {
  return WasmExecutor.create(buffer, options);
} 