import type { NextApiRequest, NextApiResponse } from 'next';
import https from 'https';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const targetUrl = 'https://www.mcp.run';
  const path = req.query.path as string[];
  const url = `${targetUrl}/api/servlets/${path.join('/')}`;

  try {
    const response = await new Promise((resolve, reject) => {
      const request = https.request(
        url,
        {
          method: req.method,
          headers: {
            ...req.headers,
            host: 'www.mcp.run',
          },
          rejectUnauthorized: false,
        },
        (response) => {
          let data = '';
          response.on('data', (chunk) => {
            data += chunk;
          });
          response.on('end', () => {
            resolve({
              status: response.statusCode,
              headers: response.headers,
              body: data,
            });
          });
        }
      );

      request.on('error', (error) => {
        reject(error);
      });

      if (req.body) {
        request.write(JSON.stringify(req.body));
      }
      request.end();
    });

    const { status, headers, body } = response as any;
    res.status(status || 500);
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value as string);
    });
    res.send(body);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy request failed' });
  }
} 