"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

// Define the context type
interface McpContextType {
  servlets: McpServlet[];
  isLoading: boolean;
  error: string | null;
  refreshServlets: () => Promise<void>;
  fetchWasmContent: (contentAddress: string) => Promise<ArrayBuffer>;
}

// Create the context with default values
const McpContext = createContext<McpContextType>({
  servlets: [],
  isLoading: false,
  error: null,
  refreshServlets: async () => {},
  fetchWasmContent: async () => new ArrayBuffer(0),
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
  const [servlets, setServlets] = useState<McpServlet[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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

  // Initialize servlets on mount
  useEffect(() => {
    refreshServlets();
  }, []);

  return (
    <McpContext.Provider value={{ 
      servlets, 
      isLoading, 
      error, 
      refreshServlets,
      fetchWasmContent
    }}>
      {children}
    </McpContext.Provider>
  );
};

// Custom hook to use the context
export const useMcpContext = () => useContext(McpContext); 