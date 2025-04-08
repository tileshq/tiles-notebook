/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['via.placeholder.com'],
  },
  experimental: {
    // Enable ESM for better compatibility with Lexical's modules
    esmExternals: true,
  },
  // Handle special file types used in the playground
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(svg|png|jpg|jpeg|gif|webp)$/i,
      type: 'asset/resource',
    });
    
    // Handle Lexical packages
    config.resolve.fallback = { 
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };
    
    // Include wasm-runner package in transpilation
    config.module.rules.push({
      test: /\.(ts|tsx)$/,
      include: [/node_modules\/wasm-runner/, /\.\.\/\.\.\/wasm-runner/],
      use: [
        {
          loader: 'babel-loader',
          options: {
            presets: ['next/babel'],
          },
        },
      ],
    });
    
    return config;
  },
  // Transpile the wasm-runner package
  transpilePackages: ['wasm-runner'],
};

export default nextConfig;