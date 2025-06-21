// Shared MCP connection manager for server-side API routes
// In production, this should use Redis or a database for persistence

class McpConnectionManager {
  private connections = new Map<string, any>();

  setConnection(slug: string, client: any) {
    this.connections.set(slug, client);
  }

  getConnection(slug: string) {
    return this.connections.get(slug);
  }

  removeConnection(slug: string) {
    const client = this.connections.get(slug);
    this.connections.delete(slug);
    return client;
  }

  hasConnection(slug: string): boolean {
    return this.connections.has(slug);
  }

  getAllConnections(): Array<{ slug: string; connected: boolean }> {
    return Array.from(this.connections.entries()).map(([slug, client]) => ({
      slug,
      connected: !!client,
    }));
  }

  async closeAllConnections() {
    const promises = Array.from(this.connections.entries()).map(async ([slug, client]) => {
      try {
        if (client && typeof client.close === 'function') {
          await client.close();
        }
      } catch (error) {
        console.error(`Error closing connection for ${slug}:`, error);
      }
    });

    await Promise.all(promises);
    this.connections.clear();
  }
}

// Singleton instance
export const mcpConnectionManager = new McpConnectionManager();