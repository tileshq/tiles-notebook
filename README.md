# Tiles Notebook

Tiles is a notebook interface that makes working with AI agents easier. It's a multiplayer, offline-first experience built on MCP, featuring AI-generated widgets. Our vision is to make personal software ubiquitous in the future.

## Project Structure

The project is organized as a monorepo using npm workspaces:

```
tiles/
├── packages/
│   ├── tiles-playground/    # Main application
│   └── wasm-runner/         # WebAssembly runner
├── public/                  # Static assets
└── app/                     # Application code
```

## Stack

- React
- Lexical Editor Framework
- TypeScript
- WebAssembly
- Next.js

## Getting Started

### Prerequisites

- Node.js (Latest LTS version recommended)
- npm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/tiles.git
cd tiles
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

### Building for Production

```bash
npm run build
```

## Development

The project uses several development tools and configurations:

- ESLint for code linting
- Flow for type checking
- Husky for git hooks
- Size limit monitoring

## Contributing

If you're interested in contributing to Tiles:

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Contact

For inquiries about building personal software quickly and influencing the future of Tiles, reach out to [hello@tiles.run](mailto:hello@tiles.run)

## Links

- [Github](https://github.com/tileshq/)
- [X/Twitter](https://x.com/tilesnotebook)
- [Blog](https://blog.tiles.run/)
- [Terms](https://tiles.run/shared/RYcEAFb16btn8a7SKx3bV)

## License

Apache License 2.0.
© 2025 Tiles HQ. All rights reserved. 

