"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { RemoteServerConfig, ConnectionState, REMOTE_MCP_SERVERS } from '../lib/mcp-client-manager';

// Define the MCP Servlet interface
export interface McpServlet {
  slug: string;
  name?: string;
  description?: string;
  meta?: {
    lastContentAddress?: string;
    description?: string;
    schema?: {
      tools?: Array<{
        name: string;
        description: string;
        inputSchema: {
          type: string;
          properties: Record<string, any>;
          required?: string[];
        };
      }>;
    };
  };
  binding?: {
    contentAddress?: string;
  };
  // Add other relevant fields if needed
}

// Enhanced servlet interface for unified handling
export interface UnifiedServer {
  slug: string;
  name?: string;
  description?: string;
  type: 'local' | 'remote';
  available: boolean;
  
  // Local servlet properties
  meta?: McpServlet['meta'];
  binding?: McpServlet['binding'];
  
  // Remote server properties
  serverUrl?: string;
  serverId?: string;
  requiresAuth?: boolean;
  status?: ConnectionState['status'];
  tools?: Array<{ name: string; description?: string; inputSchema?: any }>;
}

// Define the context type
interface McpContextType {
  // Local servlets (existing)
  servlets: McpServlet[];
  isLoading: boolean;
  error: string | null;
  refreshServlets: () => Promise<void>;
  fetchWasmContent: (contentAddress: string) => Promise<ArrayBuffer>;
  
  // Remote servers (new)
  remoteServers: RemoteServerConfig[];
  connectionStates: Map<string, ConnectionState>;
  allServers: UnifiedServer[];
  
  // Remote server management
  addRemoteServer: (config: RemoteServerConfig) => void;
  removeRemoteServer: (serverId: string) => void;
  updateServerEnabled: (serverId: string, enabled: boolean) => void;
  connectToServer: (serverId: string) => Promise<void>;
  disconnectFromServer: (serverId: string) => Promise<void>;
  refreshConnectionStates: () => Promise<void>;
  findServerBySlug: (slug: string) => UnifiedServer | null;
}

// Create the context with default values
const McpContext = createContext<McpContextType>({
  // Local servlets (existing)
  servlets: [],
  isLoading: false,
  error: null,
  refreshServlets: async () => {},
  fetchWasmContent: async () => new ArrayBuffer(0),
  
  // Remote servers (new)
  remoteServers: [],
  connectionStates: new Map(),
  allServers: [],
  addRemoteServer: () => {},
  removeRemoteServer: () => {},
  updateServerEnabled: () => {},
  connectToServer: async () => {},
  disconnectFromServer: async () => {},
  refreshConnectionStates: async () => {},
  findServerBySlug: () => null,
});

// Module-level cache for servlets
let servletCache: McpServlet[] | null = null;
let servletFetchPromise: Promise<McpServlet[]> | null = null;

// Function to fetch servlets with caching
async function fetchServlets(): Promise<McpServlet[]> {
  if (servletCache !== null) {
    return servletCache;
  }

  if (servletFetchPromise !== null) {
    return servletFetchPromise;
  }

  servletFetchPromise = (async () => {
    try {
      const response = await fetch('/api/servlets');
      if (!response.ok) {
        throw new Error(`MCP API error: ${response.statusText} (Status: ${response.status})`);
      }
      
      const text = await response.text();
      if (!text) {
        throw new Error('Empty response received from server');
      }
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('Failed to parse JSON:', parseError);
        throw new Error('Invalid JSON response from server');
      }
      
      if (!Array.isArray(data)) {
        throw new Error('Expected array of servlets but received: ' + typeof data);
      }
      
      servletCache = data;
      return data;
    } catch (err) {
      console.error("Error fetching MCP servlets:", err);
      throw err;
    } finally {
      servletFetchPromise = null;
    }
  })();

  return servletFetchPromise;
}

// Function to fetch WASM content
async function fetchWasmContent(contentAddress: string): Promise<ArrayBuffer> {
  try {
    const response = await fetch(`/api/wasm/${contentAddress}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM content: ${response.statusText} (Status: ${response.status})`);
    }
    
    return await response.arrayBuffer();
  } catch (err) {
    console.error("Error fetching WASM content:", err);
    throw err;
  }
}

// Provider component
export const McpProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Local servlets (existing)
  const [servlets, setServlets] = useState<McpServlet[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Remote servers (new)
  const [remoteServers, setRemoteServers] = useState<RemoteServerConfig[]>(() => {
    // Initialize with remote MCP servers
    return REMOTE_MCP_SERVERS.map(server => ({ ...server }));
  });
  const [connectionStates, setConnectionStates] = useState<Map<string, ConnectionState>>(new Map());

  const refreshServlets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchServlets();
      setServlets(data);
    } catch (err) {
      console.error("Error refreshing MCP servlets:", err);
      setError(err instanceof Error ? err.message : 'Failed to fetch servlets');
    } finally {
      setIsLoading(false);
    }
  };

  // Remote server management functions
  const addRemoteServer = (config: RemoteServerConfig) => {
    setRemoteServers(prev => [...prev, config]);
  };

  const removeRemoteServer = (serverId: string) => {
    setRemoteServers(prev => prev.filter(server => server.id !== serverId));
    setConnectionStates(prev => {
      const newStates = new Map(prev);
      newStates.delete(serverId);
      return newStates;
    });
  };

  const updateServerEnabled = (serverId: string, enabled: boolean) => {
    setRemoteServers(prev => prev.map(server => 
      server.id === serverId ? { ...server, enabled } : server
    ));
  };

  const connectToServer = async (serverId: string) => {
    const serverConfig = remoteServers.find(s => s.id === serverId);
    if (!serverConfig) {
      throw new Error(`Server config not found for ${serverId}`);
    }

    try {
      const response = await fetch('/api/mcp-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'connect',
          serverConfig
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Connection failed');
      }

      if (result.connectionState) {
        setConnectionStates(prev => new Map(prev).set(serverId, result.connectionState));
      }

      // Refresh connection states to get latest status
      await refreshConnectionStates();
      
    } catch (error) {
      console.error(`Failed to connect to ${serverId}:`, error);
      throw error;
    }
  };

  const disconnectFromServer = async (serverId: string) => {
    try {
      const response = await fetch('/api/mcp-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'disconnect',
          serverId
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Disconnect failed');
      }

      setConnectionStates(prev => {
        const newStates = new Map(prev);
        newStates.set(serverId, { status: 'disconnected', tools: [] });
        return newStates;
      });
      
    } catch (error) {
      console.error(`Failed to disconnect from ${serverId}:`, error);
      throw error;
    }
  };

  const refreshConnectionStates = async () => {
    try {
      const response = await fetch('/api/mcp-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list-connections' })
      });

      const result = await response.json();
      
      if (result.success && result.connections) {
        const newStates = new Map<string, ConnectionState>();
        Object.entries(result.connections).forEach(([id, state]) => {
          newStates.set(id, state as ConnectionState);
        });
        setConnectionStates(newStates);
      }
    } catch (error) {
      console.error('Failed to refresh connection states:', error);
    }
  };


  // Create unified server list
  const allServers: UnifiedServer[] = React.useMemo(() => {
    const localServers: UnifiedServer[] = servlets.map(servlet => ({
      slug: servlet.slug,
      name: servlet.name,
      description: servlet.description || servlet.meta?.description,
      type: 'local',
      available: !!servlet.meta?.lastContentAddress || !!servlet.binding?.contentAddress,
      meta: servlet.meta,
      binding: servlet.binding
    }));

    const remoteServersList: UnifiedServer[] = remoteServers
      .filter(server => server.enabled)
      .map(server => {
        const connectionState = connectionStates.get(server.id);
        return {
          slug: server.id,
          name: server.name,
          description: server.description,
          type: 'remote',
          available: connectionState?.status === 'connected',
          serverUrl: server.url,
          serverId: server.id,
          requiresAuth: server.requiresAuth,
          status: connectionState?.status || 'disconnected',
          tools: connectionState?.tools || []
        };
      });

    return [...localServers, ...remoteServersList];
  }, [servlets, remoteServers, connectionStates]);

  const findServerBySlug = (slug: string): UnifiedServer | null => {
    return allServers.find(server => server.slug === slug) || null;
  };

  // Initialize servlets and connection states on mount
  useEffect(() => {
    refreshServlets();
    refreshConnectionStates();
  }, []);


  // Auto-connect to enabled remote servers
  useEffect(() => {
    const enabledServers = remoteServers.filter(server => server.enabled);
    enabledServers.forEach(server => {
      const connectionState = connectionStates.get(server.id);
      if (!connectionState || connectionState.status === 'disconnected') {
        // Auto-connect to enabled servers
        connectToServer(server.id).catch(error => {
          console.error(`Failed to auto-connect to ${server.name}:`, error);
        });
      }
    });
  }, [remoteServers]);

  return (
    <McpContext.Provider value={{ 
      // Local servlets (existing)
      servlets, 
      isLoading, 
      error, 
      refreshServlets,
      fetchWasmContent,
      
      // Remote servers (new)
      remoteServers,
      connectionStates,
      allServers,
      addRemoteServer,
      removeRemoteServer,
      updateServerEnabled,
      connectToServer,
      disconnectFromServer,
      refreshConnectionStates,
      findServerBySlug
    }}>
      {children}
    </McpContext.Provider>
  );
};

// Custom hook to use the context
export const useMcpContext = () => useContext(McpContext); 