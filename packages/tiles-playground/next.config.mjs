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
        
    return config;
  },
  // Transpile modules from the monorepo
  transpilePackages: ['wasm-runner'],
  distDir: '.next',
};

export default nextConfig;