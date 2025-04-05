import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const runtime = 'experimental-edge';

export async function middleware(request: NextRequest) {
  const targetUrl = 'https://www.mcp.run';
  
  try {
    // Handle /api/proxy requests
    if (request.nextUrl.pathname.startsWith('/api/proxy')) {
      const url = new URL(request.nextUrl.pathname.replace('/api/proxy', '/api'), targetUrl);
      
      // Get the request body if it exists
      const body = request.body ? await request.text() : null;
      
      // Forward the request to the target server
      const response = await fetch(url, {
        method: request.method,
        headers: {
          ...Object.fromEntries(request.headers),
          'Content-Type': request.headers.get('Content-Type') || 'application/json',
          'host': 'www.mcp.run',
        },
        body: body,
      });

      // Return the response from the target server
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    // Handle /api/servlets requests
    if (request.nextUrl.pathname.startsWith('/api/servlets')) {
      const url = new URL(request.nextUrl.pathname, targetUrl);
      
      // Get the request body if it exists
      const body = request.body ? await request.text() : null;
      
      // Forward the request to the target server
      const response = await fetch(url, {
        method: request.method,
        headers: {
          ...Object.fromEntries(request.headers),
          'Content-Type': request.headers.get('Content-Type') || 'application/json',
          'host': 'www.mcp.run',
        },
        body: body,
      });

      // Return the response from the target server
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    // Handle /api/wasm/:contentAddress requests
    if (request.nextUrl.pathname.startsWith('/api/wasm/')) {
      const contentAddress = request.nextUrl.pathname.replace('/api/wasm/', '');
      const url = new URL(`/api/c/${contentAddress}`, targetUrl);
      
      // Forward the request to the target server
      const response = await fetch(url, {
        method: request.method,
        headers: {
          ...Object.fromEntries(request.headers),
          'host': 'www.mcp.run',
        },
      });

      // Return the response from the target server
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }
  } catch (error) {
    console.error('Proxy error:', error);
    return new NextResponse(JSON.stringify({ error: 'Proxy request failed' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  return NextResponse.next();
}

// Configure which paths the middleware should run on
export const config = {
  matcher: ['/api/proxy/:path*', '/api/servlets/:path*', '/api/wasm/:path*'],
}; 