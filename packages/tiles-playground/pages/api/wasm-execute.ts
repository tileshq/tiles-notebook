import { NextApiRequest, NextApiResponse } from 'next';
import { createWasmExecutorFromBuffer, WasmExecutorOptions } from '../../lib/wasm-executor';

interface WasmExecuteRequest {
  contentAddress: string;
  functionName: string;
  input: string;
  config?: Record<string, string>;
  executorOptions?: Partial<WasmExecutorOptions>;
}

interface WasmExecuteResponse {
  output?: string;
  error?: string;
  logs?: string[];
  executionTime?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WasmExecuteResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      contentAddress, 
      functionName, 
      input, 
      config = {}, 
      executorOptions = {} 
    }: WasmExecuteRequest = req.body;

    if (!contentAddress || !functionName) {
      return res.status(400).json({ 
        error: 'contentAddress and functionName are required' 
      });
    }

    const startTime = Date.now();

    // Fetch WASM content server-side
    const wasmBuffer = await fetchWasmContentServerSide(contentAddress);
    
    // Configure executor options with server-appropriate defaults
    const serverExecutorOptions: WasmExecutorOptions = {
      useWasi: true,
      allowedPaths: {
        '/tmp': '/tmp',
        '/data': '/data'
      },
      logLevel: 'debug',
      runInWorker: false, // Server-side doesn't need worker threads
      allowedHosts: ['*'],
      config,
      ...executorOptions
    };

    // Create executor
    const executor = await createWasmExecutorFromBuffer(wasmBuffer, serverExecutorOptions);
    
    // Execute with timeout
    const result = await Promise.race([
      executor.execute(functionName, input),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Execution timeout')), 30000)
      )
    ]);

    const executionTime = Date.now() - startTime;

    // Clean up
    await executor.free();

    if (result.error) {
      return res.status(500).json({
        error: result.error,
        executionTime
      });
    }

    return res.status(200).json({
      output: result.output,
      executionTime
    });

  } catch (error) {
    console.error('WASM execution error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}

// Server-side WASM content fetching
async function fetchWasmContentServerSide(contentAddress: string): Promise<ArrayBuffer> {
  try {
    // Use the same endpoint that the middleware proxies to
    const response = await fetch(`https://www.mcp.run/api/c/${contentAddress}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM content: ${response.statusText}`);
    }
    return await response.arrayBuffer();
  } catch (error) {
    console.error('Error fetching WASM content server-side:', error);
    throw error;
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Adjust based on your WASM file sizes
    },
    responseLimit: false,
  },
} 