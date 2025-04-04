# Lexical Playground in Next.js

This is a comprehensive Next.js implementation of the Lexical editor playground. It provides better integration with Vercel deployment and modern React features.

## Features

- Full Lexical editor functionality
- Server-side rendering with Next.js
- Optimized for Vercel deployment
- SEO optimized with metadata

## Project Structure

```
nextjs-lexical-full/
├── app/                  # Next.js App Router
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── components/           # React components
├── context/              # React context providers
├── hooks/                # React hooks
├── images/               # Static images
├── nodes/                # Lexical custom nodes
├── plugins/              # Lexical plugins
├── public/               # Static assets
├── themes/               # Editor themes
├── ui/                   # UI components
└── utils/                # Utility functions
```

## Getting Started

First, install the dependencies:

```bash
npm install
# or
yarn install
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deployment on Vercel

This app is optimized for deployment on Vercel. When deploying to Vercel:

1. Connect your GitHub repository
2. Use the following settings:
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`

## Migration from Vite to Next.js

This project is a migration of the original Lexical playground from Vite to Next.js. The migration process involved:

1. Setting up a Next.js project structure with app router
2. Adapting components for server-side rendering
3. Converting client-side only code with 'use client' directives
4. Updating image and asset handling for Next.js
5. Configuring webpack for compatibility with Lexical

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.