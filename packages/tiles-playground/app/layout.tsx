import { Analytics } from '@vercel/analytics/react';
import type { Metadata } from 'next';
import './globals.css';
import { McpProvider } from '../contexts/McpContext';

export const metadata: Metadata = {
  title: 'Tiles Notebook | Note Taking Tool With AI Agents',
  description: 'A notebook interface that makes working with AI agents easier.',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon.png', type: 'image/png' }
    ],
    apple: [
      { url: '/apple-icon.png' }
    ],
    shortcut: ['/favicon.ico'],
  },
  openGraph: {
    title: 'Tiles Notebook | Note Taking Tool With AI Agents',
    description: 'A notebook interface that makes working with AI agents easier.',    
    images: [
      {
        url: '/api/og', // This should point to your OpenGraph route
        width: 1200,
        height: 630,
        alt: 'Tiles',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <McpProvider>
          {children}
          <Analytics />
        </McpProvider>
      </body>
    </html>
  );
}