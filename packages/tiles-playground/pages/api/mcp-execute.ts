import { NextApiRequest, NextApiResponse } from 'next';
import { MCPClientManager, MCPToolResult } from '../../lib/mcp-client-manager';
import { createWasmExecutorFromBuffer, WasmExecutorOptions } from '../../lib/wasm-executor';

interface MCPExecuteRequest {
  type: 'local-wasm' | 'remote-mcp';
  
  // For remote MCP
  serverId?: string;
  serverConfig?: any; // RemoteServerConfig for auto-connection
  toolName: string;
  args?: Record<string, any>;
  
  // For local WASM (existing fields)
  contentAddress?: string;
  functionName?: string;
  input?: string;
  config?: Record<string, string>;
  executorOptions?: Partial<WasmExecutorOptions>;
}

interface MCPExecuteResponse {
  output?: string;
  error?: string;
  logs?: string[];
  executionTime?: number;
  toolResult?: MCPToolResult;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MCPExecuteResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const requestBody: MCPExecuteRequest = req.body;
    const { type, toolName } = requestBody;

    if (!type || !toolName) {
      return res.status(400).json({ 
        error: 'type and toolName are required' 
      });
    }

    const startTime = Date.now();

    if (type === 'remote-mcp') {
      // Handle remote MCP execution
      const { serverId, serverConfig, args = {} } = requestBody;
      
      if (!serverId) {
        return res.status(400).json({ 
          error: 'serverId is required for remote MCP execution' 
        });
      }

      const mcpManager = MCPClientManager.getInstance();
      let connectionState = mcpManager.getConnectionState(serverId);

      // If not connected and we have server config, try to connect
      if ((!connectionState || connectionState.status !== 'connected') && serverConfig) {
        console.log(`Server ${serverId} not connected, attempting to connect...`);
        try {
          connectionState = await mcpManager.connectServer(serverConfig);
        } catch (error) {
          console.error(`Failed to connect to ${serverId}:`, error);
          return res.status(500).json({ 
            error: `Failed to connect to server ${serverId}: ${error instanceof Error ? error.message : 'Unknown error'}` 
          });
        }
      }

      if (!connectionState || connectionState.status !== 'connected') {
        return res.status(400).json({ 
          error: `Remote server ${serverId} is not connected (status: ${connectionState?.status || 'unknown'})` 
        });
      }

      try {
        const toolResult = await mcpManager.executeRemoteTool(serverId, toolName, args);
        const executionTime = Date.now() - startTime;

        if (toolResult.isError) {
          return res.status(500).json({
            error: toolResult.content[0]?.text || 'Remote tool execution failed',
            executionTime,
            toolResult
          });
        }

        // Convert tool result to output format expected by RunnerPlugin
        const output = toolResult.content.map(item => {
          if (item.type === 'text') {
            return item.text;
          } else if (item.type === 'image') {
            return `[Image: ${item.mimeType || 'unknown'}]`;
          } else if (item.type === 'resource') {
            return `[Resource: ${item.uri}]`;
          }
          return JSON.stringify(item);
        }).join('\n');

        return res.status(200).json({
          output,
          executionTime,
          toolResult
        });

      } catch (error) {
        const executionTime = Date.now() - startTime;
        console.error(`Remote MCP execution error for ${serverId}/${toolName}:`, error);
        
        return res.status(500).json({
          error: error instanceof Error ? error.message : 'Remote execution failed',
          executionTime
        });
      }

    } else if (type === 'local-wasm') {
      // Handle local WASM execution (existing logic from wasm-execute.ts)
      const { 
        contentAddress, 
        functionName = 'call',
        input = '', 
        config = {}, 
        executorOptions = {} 
      } = requestBody;

      if (!contentAddress) {
        return res.status(400).json({ 
          error: 'contentAddress is required for local WASM execution' 
        });
      }

      // Fetch WASM content server-side
      const wasmBuffer = await fetchWasmContentServerSide(contentAddress);
      
      // Configure executor options with server-appropriate defaults
      const serverExecutorOptions: WasmExecutorOptions = {
        useWasi: true,
        allowedPaths: {
          '/tmp': '/tmp',
          '/var/tmp': '/var/tmp',
        },
        logLevel: 'debug',
        runInWorker: false,
        config,
        ...executorOptions
      };

      // Remove allowedHosts if runInWorker is false
      if (!serverExecutorOptions.runInWorker) {
        delete serverExecutorOptions.allowedHosts;
      }

      // Create and execute WASM
      let executor;
      try {
        executor = await createWasmExecutorFromBuffer(wasmBuffer, serverExecutorOptions);
        
        if (!executor) {
          throw new Error('Failed to create WASM executor');
        }
      } catch (initError) {
        console.error('Error creating WASM executor:', initError);
        throw new Error(`Failed to initialize WASM executor: ${initError instanceof Error ? initError.message : String(initError)}`);
      }
      
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

    } else {
      return res.status(400).json({ 
        error: `Unsupported execution type: ${type}` 
      });
    }

  } catch (error) {
    console.error('MCP execution error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}

// Server-side WASM content fetching (copied from wasm-execute.ts)
async function fetchWasmContentServerSide(contentAddress: string): Promise<ArrayBuffer> {
  try {
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
      sizeLimit: '10mb',
    },
    responseLimit: false,
  },
};