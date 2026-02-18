FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    iptables \
    && rm -rf /var/lib/apt/lists/*

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
RUN mkdir -p /data/notes /data/repos

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

# Create entrypoint script
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# Apply firewall rules\n\
/usr/local/bin/setup-firewall.sh || echo "Firewall setup failed, continuing anyway"\n\
\n\
# Start application\n\
exec "$@"\n\
' > /entrypoint.sh && chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npx", "tsx", "server/index.ts"]
