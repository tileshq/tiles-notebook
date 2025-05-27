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

  constructor(wasmBuffer: ArrayBuffer, options: WasmExecutorOptions = {}) {
    this.plugin = null;
    this.initialize(wasmBuffer, options);
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

    if (options.allowedPaths && Object.keys(options.allowedPaths).length > 0) {
      pluginOptions.allowedPaths = options.allowedPaths;
    }

    // Set up logging if logLevel is provided
    if (options.logLevel) {
      pluginOptions.logger = console;
      pluginOptions.logLevel = options.logLevel;
    }

    console.log('Initializing WASM plugin with options:', pluginOptions);
    this.plugin = await createPlugin(wasmBuffer, pluginOptions);
    console.debug('WASM plugin initialized successfully');
  }

  async execute(functionName: string, input: string): Promise<WasmExecutorResult> {
    try {
      console.debug(`Executing WASM function: ${functionName}`);
      const outputBuffer = await this.plugin.call(functionName, input);
      console.debug(`WASM function ${functionName} executed successfully`);
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
  return new WasmExecutor(arrayBuffer, options);
}

// Helper function to create a WASM executor from a buffer
export async function createWasmExecutorFromBuffer(
  buffer: ArrayBuffer,
  options: WasmExecutorOptions = {}
): Promise<WasmExecutor> {
  return new WasmExecutor(buffer, options);
} 