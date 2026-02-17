# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Docker Deployment

For production deployment with Obsidian sync and Nextcloud integration:

1. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

2. **Set up Claude MCP:**
   ```bash
   cp claude-config/mcp_settings.json.example ~/.claude/mcp_settings.json
   # Edit with your Nextcloud credentials
   ```

3. **Initial sync:**
   ```bash
   ./scripts/initial-sync.sh
   ```

4. **Start services:**
   ```bash
   docker-compose up -d
   ```

See [Docker Setup Guide](docs/DOCKER_SETUP.md) for complete instructions.

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
