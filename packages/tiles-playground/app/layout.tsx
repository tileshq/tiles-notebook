import { Analytics } from '@vercel/analytics/react';
import type { Metadata } from 'next';
import './globals.css';
import { McpProvider } from '../contexts/McpContext';

export const metadata: Metadata = {
  title: 'Tiles Playground',
  description: 'A new kind of notebook for making personal software',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
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