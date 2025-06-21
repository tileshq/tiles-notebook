import { NextApiRequest, NextApiResponse } from 'next';
import { MCPClientManager, RemoteServerConfig, ConnectionState } from '../../lib/mcp-client-manager';

interface ConnectRequest {
  action: 'connect' | 'disconnect' | 'list-connections' | 'get-tools' | 'refresh-states';
  serverConfig?: RemoteServerConfig;
  serverId?: string;
}

interface ConnectResponse {
  success: boolean;
  error?: string;
  connectionState?: ConnectionState;
  connections?: Record<string, ConnectionState>;
  tools?: Array<{ name: string; description?: string; inputSchema?: any }>;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ConnectResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { action, serverConfig, serverId }: ConnectRequest = req.body;

    if (!action) {
      return res.status(400).json({ 
        success: false, 
        error: 'action is required' 
      });
    }

    const mcpManager = MCPClientManager.getInstance();

    switch (action) {
      case 'connect':
        if (!serverConfig) {
          return res.status(400).json({ 
            success: false, 
            error: 'serverConfig is required for connect action' 
          });
        }

        try {
          const connectionState = await mcpManager.connectServer(serverConfig);
          
          return res.status(200).json({
            success: true,
            connectionState
          });

        } catch (error) {
          console.error(`Failed to connect to ${serverConfig.name}:`, error);
          return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Connection failed'
          });
        }

      case 'disconnect':
        if (!serverId) {
          return res.status(400).json({ 
            success: false, 
            error: 'serverId is required for disconnect action' 
          });
        }

        try {
          await mcpManager.disconnectServer(serverId);
          
          return res.status(200).json({
            success: true
          });

        } catch (error) {
          console.error(`Failed to disconnect from ${serverId}:`, error);
          return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Disconnect failed'
          });
        }

      case 'list-connections':
        try {
          console.log('Listing connections...');
          const allConnections = mcpManager.getAllConnections();
          console.log('All connections from manager:', allConnections);
          
          const connectionsObj: Record<string, ConnectionState> = {};
          
          allConnections.forEach((state, id) => {
            // Remove the client instance for serialization
            connectionsObj[id] = {
              status: state.status,
              tools: state.tools,
              lastConnected: state.lastConnected,
              errorMessage: state.errorMessage
            };
          });
          
          console.log('Serialized connections:', connectionsObj);

          return res.status(200).json({
            success: true,
            connections: connectionsObj
          });

        } catch (error) {
          console.error('Failed to list connections:', error);
          return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to list connections'
          });
        }

      case 'get-tools':
        if (!serverId) {
          return res.status(400).json({ 
            success: false, 
            error: 'serverId is required for get-tools action' 
          });
        }

        try {
          const tools = mcpManager.getAvailableTools(serverId);
          
          return res.status(200).json({
            success: true,
            tools
          });

        } catch (error) {
          console.error(`Failed to get tools for ${serverId}:`, error);
          return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get tools'
          });
        }

      case 'refresh-states':
        try {
          console.log('Manually refreshing connection states...');
          const allConnections = mcpManager.getAllConnections();
          console.log('Refreshed connections:', allConnections);
          
          const connectionsObj: Record<string, ConnectionState> = {};
          
          allConnections.forEach((state, id) => {
            connectionsObj[id] = {
              status: state.status,
              tools: state.tools,
              lastConnected: state.lastConnected,
              errorMessage: state.errorMessage
            };
          });
          
          return res.status(200).json({
            success: true,
            connections: connectionsObj
          });

        } catch (error) {
          console.error('Failed to refresh connection states:', error);
          return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to refresh connection states'
          });
        }

      default:
        return res.status(400).json({ 
          success: false, 
          error: `Unsupported action: ${action}` 
        });
    }

  } catch (error) {
    console.error('MCP connection API error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};