FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    iptables \
    gosu \
    && rm -rf /var/lib/apt/lists/*

# Use existing node user (UID 1000) and setup Claude config
RUN mkdir -p /home/node/.claude && \
    chown -R node:node /home/node

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

# Install backend dependencies
COPY package*.json ./
RUN npm ci

# Build frontend
COPY frontend-new ./frontend-new
WORKDIR /app/frontend-new
RUN npm ci && npm run build:prod

# Copy backend code
WORKDIR /app
COPY server ./server

# Copy firewall setup script
COPY docker/setup-firewall.sh /usr/local/bin/setup-firewall.sh
RUN chmod +x /usr/local/bin/setup-firewall.sh

# Create data directories for mounts
RUN mkdir -p /data/notes /data/repos && \
    chown -R node:node /app /data

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

# Create entrypoint script
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# Apply firewall rules (as root)\n\
/usr/local/bin/setup-firewall.sh || echo "Firewall setup failed, continuing anyway"\n\
\n\
# Copy Claude credentials if available\n\
if [ -f /tmp/.credentials.json ]; then\n\
  cp /tmp/.credentials.json /home/node/.claude/.credentials.json\n\
  chown node:node /home/node/.claude/.credentials.json\n\
  chmod 600 /home/node/.claude/.credentials.json\n\
fi\n\
\n\
# Copy MCP servers config if available\n\
if [ -f /app/mcp-servers/mcp-config.json ]; then\n\
  cp /app/mcp-servers/mcp-config.json /home/node/.claude/mcp_servers.json\n\
  chown node:node /home/node/.claude/mcp_servers.json\n\
  chmod 644 /home/node/.claude/mcp_servers.json\n\
fi\n\
\n\
# Drop privileges and start application as node user\n\
exec gosu node "$@"\n\
' > /entrypoint.sh && chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npx", "tsx", "server/index.ts"]
