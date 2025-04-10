import { Analytics } from '@vercel/analytics/react';
import type { Metadata } from 'next';
import './globals.css';
import { McpProvider } from '../contexts/McpContext';

export const metadata: Metadata = {
  title: 'Tiles: A new kind of notebook for making personal software',
  description: 'A new kind of notebook for making personal software',
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