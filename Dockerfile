FROM node:20-slim

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Install git (Claude Code needs it)
RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Create data directories for mounts
RUN mkdir -p /data/notes /data/repos

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
