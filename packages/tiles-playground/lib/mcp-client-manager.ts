import { MCPClient, BrowserOAuthHandler } from 'mcp-client-toolkit';

export interface RemoteServerConfig {
  id: string;
  name: string;
  url: string;
  requiresAuth: boolean;
  enabled: boolean;
  category?: 'payments' | 'development' | 'productivity' | 'data';
  description?: string;
  icon?: string;
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    uri?: string;
  }>;
  isError?: boolean;
}

export interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'auth-required';
  client?: MCPClient;
  tools?: Array<{ name: string; description?: string; inputSchema?: any }>;
  lastConnected?: Date;
  errorMessage?: string;
}

export class MCPClientManager {
  private connections = new Map<string, ConnectionState>();
  private static instance: MCPClientManager;

  static getInstance(): MCPClientManager {
    if (!MCPClientManager.instance) {
      MCPClientManager.instance = new MCPClientManager();
    }
    return MCPClientManager.instance;
  }

  async connectServer(config: RemoteServerConfig): Promise<ConnectionState> {
    console.log(`Connecting to MCP server: ${config.name} (${config.url})`);

    // Update status to connecting
    this.connections.set(config.id, {
      status: 'connecting',
      tools: [],
      lastConnected: new Date()
    });

    try {
      const client = new MCPClient({
        callbackPort: 8090,
        oauthHandler: config.requiresAuth ? new BrowserOAuthHandler(8090) : undefined,
        transportPriority: ['streamable-http', 'sse'],
        connectionTimeout: 30000
      });

      // Set up event listeners
      client.addEventListener('connected', (event: CustomEvent) => {
        const transport = event.detail;
        console.log(`Connected to ${config.name} via ${transport}`);
        this.updateConnectionStatus(config.id, 'connected');
        this.refreshTools(config.id);
      });

      client.addEventListener('disconnected', () => {
        console.log(`Disconnected from ${config.name}`);
        this.updateConnectionStatus(config.id, 'disconnected');
      });

      client.addEventListener('error', (event: CustomEvent) => {
        const error = event.detail;
        console.error(`Error with ${config.name}:`, error);
        this.updateConnectionStatus(config.id, 'error', error?.message);
      });

      client.addEventListener('oauth-redirect', (event: CustomEvent) => {
        const url = event.detail;
        console.log(`OAuth redirect required for ${config.name}: ${url}`);
        console.log(`🌐 OAuth URL generated: ${url}`);
        // This will be handled by the client-side
        this.updateConnectionStatus(config.id, 'auth-required');
      });

      await client.connect(config.url);

      const connectionState: ConnectionState = {
        status: 'connected',
        client,
        tools: [],
        lastConnected: new Date()
      };

      this.connections.set(config.id, connectionState);

      // Fetch available tools
      await this.refreshTools(config.id);

      return connectionState;

    } catch (error) {
      console.error(`Failed to connect to ${config.name}:`, error);
      const errorState: ConnectionState = {
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown connection error',
        tools: []
      };
      
      this.connections.set(config.id, errorState);
      return errorState;
    }
  }

  async disconnectServer(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (connection?.client) {
      try {
        await connection.client.close();
      } catch (error) {
        console.error(`Error closing connection to ${serverId}:`, error);
      }
    }
    
    this.connections.set(serverId, {
      status: 'disconnected',
      tools: []
    });
  }

  async refreshTools(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection?.client || connection.status !== 'connected') {
      return;
    }

    try {
      const tools = await connection.client.listTools();
      connection.tools = tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }));
      
      console.log(`Refreshed ${tools.length} tools for ${serverId}`);
    } catch (error) {
      console.error(`Failed to refresh tools for ${serverId}:`, error);
    }
  }

  async executeRemoteTool(
    serverId: string, 
    toolName: string, 
    args: Record<string, any>
  ): Promise<MCPToolResult> {
    const connection = this.connections.get(serverId);
    
    if (!connection) {
      throw new Error(`No connection found for server ${serverId}`);
    }

    if (connection.status !== 'connected' || !connection.client) {
      throw new Error(`Server ${serverId} is not connected (status: ${connection.status})`);
    }

    try {
      console.log(`Executing tool ${toolName} on ${serverId} with args:`, args);
      
      const result = await connection.client.callTool(toolName, args);
      
      // Transform the result to our expected format
      return {
        content: Array.isArray(result.content) ? result.content : [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result)
          }
        ]
      };

    } catch (error) {
      console.error(`Tool execution failed for ${toolName} on ${serverId}:`, error);
      
      return {
        content: [{
          type: 'text',
          text: `Error executing ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  getConnectionState(serverId: string): ConnectionState | undefined {
    return this.connections.get(serverId);
  }

  getAllConnections(): Map<string, ConnectionState> {
    return new Map(this.connections);
  }

  getAvailableTools(serverId: string): Array<{ name: string; description?: string; inputSchema?: any }> {
    const connection = this.connections.get(serverId);
    return connection?.tools || [];
  }

  private updateConnectionStatus(serverId: string, status: ConnectionState['status'], errorMessage?: string): void {
    const connection = this.connections.get(serverId);
    if (connection) {
      connection.status = status;
      if (errorMessage) {
        connection.errorMessage = errorMessage;
      }
      this.connections.set(serverId, connection);
    }
  }
}

// Remote MCP server configurations
export const REMOTE_MCP_SERVERS: RemoteServerConfig[] = [
  {
    id: 'fetch',
    name: 'Fetch',
    url: 'https://remote.mcpservers.org/fetch/mcp',
    requiresAuth: false,
    enabled: false,
    category: 'data',
    description: 'Web search tools',
  }, // add https://mcp.kite.trade/sse
  {
    id: 'kite',
    name: 'Kite - Zerodha',
    url: 'https://mcp.kite.trade/sse',
    requiresAuth: true,
    enabled: false,
    category: 'data',
    description: 'Zerodha Kite trade tools',
  }, 
  {
  id: 'github',
  name: 'GitHub',
  url: 'https://api.githubcopilot.com/mcp/',
  requiresAuth: true,
  enabled: false,
  category: 'development',
  description: 'Repository and issue management',
  icon: '🐙'
  },
  {
    id: 'sentry',
    name: 'Sentry',
    url: 'https://mcp.sentry.dev/sse',
    requiresAuth: true,
    enabled: false,
    category: 'development',
    description: 'Developer-first error tracking and performance monitoring platform',
  },
  {
    id: 'linear',
    name: 'Linear',
    url: 'https://mcp.linear.app/sse',
    requiresAuth: true,
    enabled: false,
    category: 'productivity',
    description: 'Project management tool',
  },
  {
    id: 'paypal',
    name: 'PayPal',
    url: 'https://mcp.paypal.com/sse',
    requiresAuth: true,
    enabled: false,
    category: 'payments',
    description: 'Global online payment system',
  },
  {
    id: 'asana',
    name: 'Asana',
    url: 'https://mcp.asana.com/sse',
    requiresAuth: true,
    enabled: false,
    category: 'productivity',
    description: 'Project management tool',
  },
  {
    id: 'sequential-thinking',
    name: 'Sequential Thinking',
    url: 'https://remote.mcpservers.org/sequentialthinking/mcp',
    requiresAuth: false,
    enabled: false,
    category: 'productivity',
    description: 'Dynamic and reflective problem-solving through structured thinking process',
  },
  {
    id: 'edgeone-pages',
    name: 'EdgeOne Pages',
    url: 'https://remote.mcpservers.org/edgeone-pages/mcp',
    requiresAuth: false,
    enabled: false,
    category: 'development',
    description: 'Deploy HTML content to EdgeOne Pages and obtain accessible public URLs',
  }
];