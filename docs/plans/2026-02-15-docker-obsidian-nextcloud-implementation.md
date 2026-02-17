# Docker + Obsidian + Nextcloud Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Docker Compose setup with bidirectional Obsidian sync, Nextcloud MCP integration, and network security isolation.

**Architecture:** Three-container Docker Compose stack (app, postgres, sync-service) with custom networks for security isolation. App container runs Claude Code with firewall rules blocking local networks while allowing internet and whitelisted services. rclone bisync daemon syncs Obsidian vault with Nextcloud bidirectionally.

**Tech Stack:** Docker Compose, rclone, iptables, Nextcloud MCP Server, PostgreSQL, Express, Claude Code CLI

**Design Document:** `docs/plans/2026-02-15-docker-obsidian-nextcloud-design.md`

---

## Task 1: Update Environment Configuration

**Files:**
- Modify: `.env` (add Nextcloud variables)
- Modify: `.env.example` (add Nextcloud variables)

**Step 1: Add Nextcloud environment variables to .env**

Add these lines to `.env`:

```bash
# Nextcloud Configuration
NEXTCLOUD_URL=https://your-nextcloud.com
NEXTCLOUD_USERNAME=your-username
NEXTCLOUD_PASSWORD=app-password-here
NEXTCLOUD_IP=1.2.3.4  # IP of your Nextcloud server

# PostgreSQL
POSTGRES_PASSWORD=secure_random_password_here

# Obsidian Vault Path
OBSIDIAN_VAULT_PATH=/home/chris/Documents/Obsidian/General Notebook/General Notebook
```

**Step 2: Update .env.example with placeholders**

Replace entire `.env.example` content:

```bash
# Database
DATABASE_URL=postgresql://remoteclaudecode:${POSTGRES_PASSWORD}@postgres:5432/remoteclaudecode

# PostgreSQL
POSTGRES_PASSWORD=change_this_password

# Nextcloud Configuration
NEXTCLOUD_URL=https://your-nextcloud.com
NEXTCLOUD_USERNAME=your-username
NEXTCLOUD_PASSWORD=your-nextcloud-app-password
NEXTCLOUD_IP=1.2.3.4

# Docker volume paths
OBSIDIAN_VAULT_PATH=/path/to/obsidian/General Notebook/General Notebook
REPOS_PATH=/home/user/Documents/Github
CLAUDE_CONFIG=/home/user/.claude
```

**Step 3: Commit environment configuration**

```bash
git add .env.example
git commit -m "config: add Nextcloud and PostgreSQL environment variables

- Add NEXTCLOUD_URL, USERNAME, PASSWORD, IP for MCP and sync
- Add POSTGRES_PASSWORD for database security
- Add OBSIDIAN_VAULT_PATH for explicit vault location
- Update .env.example with all new variables"
```

---

## Task 2: Create rclone Filter Configuration

**Files:**
- Create: `rclone-config/bisync-filter.txt`
- Create: `rclone-config/.gitignore`

**Step 1: Create rclone-config directory**

```bash
mkdir -p rclone-config
```

**Step 2: Create bisync filter file**

Create `rclone-config/bisync-filter.txt`:

```
# Exclude Obsidian workspace and cache
- .obsidian/workspace*
- .obsidian/cache/
- .obsidian/plugins/*/node_modules/

# Exclude trash
- .trash/

# Exclude system files
- .DS_Store
- Thumbs.db
- desktop.ini

# Exclude version control
- .git/
- .gitignore
```

**Step 3: Create .gitignore for rclone config**

Create `rclone-config/.gitignore`:

```
# Ignore rclone runtime files
rclone.conf
*.lock
*.log
```

**Step 4: Commit rclone configuration**

```bash
git add rclone-config/
git commit -m "config: add rclone bisync filter configuration

- Exclude Obsidian workspace and cache files
- Exclude trash and system files
- Exclude version control files
- Add .gitignore for rclone runtime files"
```

---

## Task 3: Create Firewall Setup Script

**Files:**
- Create: `docker/setup-firewall.sh`
- Create: `docker/.gitignore`

**Step 1: Create docker directory**

```bash
mkdir -p docker
```

**Step 2: Write firewall setup script**

Create `docker/setup-firewall.sh`:

```bash
#!/bin/bash
set -e

echo "Setting up firewall rules for Claude container..."

# Only apply rules if NET_ADMIN capability is available
if ! iptables -L > /dev/null 2>&1; then
    echo "Warning: iptables not available, skipping firewall setup"
    exit 0
fi

# Flush existing rules for this chain (idempotent)
iptables -F OUTPUT 2>/dev/null || true

# Allow established connections
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow loopback
iptables -A OUTPUT -o lo -j ACCEPT

# Whitelist specific internal services BEFORE blocking private ranges
# (These rules must come first to take precedence)

# Allow postgres
iptables -A OUTPUT -d postgres -p tcp --dport 5432 -j ACCEPT

# Allow sync-service (all ports for internal communication)
iptables -A OUTPUT -d sync-service -j ACCEPT

# Allow Nextcloud server (if NEXTCLOUD_IP is set)
if [ -n "$NEXTCLOUD_IP" ]; then
    echo "Whitelisting Nextcloud IP: $NEXTCLOUD_IP"
    iptables -A OUTPUT -d "$NEXTCLOUD_IP" -p tcp --dport 443 -j ACCEPT
    iptables -A OUTPUT -d "$NEXTCLOUD_IP" -p tcp --dport 80 -j ACCEPT
fi

# Block private network ranges (after whitelisting specific services)
echo "Blocking private network ranges..."
iptables -A OUTPUT -d 127.0.0.0/8 -j REJECT --reject-with icmp-host-prohibited
iptables -A OUTPUT -d 10.0.0.0/8 -j REJECT --reject-with icmp-host-prohibited
iptables -A OUTPUT -d 172.16.0.0/12 -j REJECT --reject-with icmp-host-prohibited
iptables -A OUTPUT -d 192.168.0.0/16 -j REJECT --reject-with icmp-host-prohibited

# Allow all other traffic (internet)
iptables -A OUTPUT -j ACCEPT

echo "Firewall rules applied successfully"
echo "Current OUTPUT chain rules:"
iptables -L OUTPUT -n -v
```

**Step 3: Make script executable**

```bash
chmod +x docker/setup-firewall.sh
```

**Step 4: Create docker/.gitignore**

Create `docker/.gitignore`:

```
# Ignore any generated files
*.log
*.tmp
```

**Step 5: Commit firewall script**

```bash
git add docker/
git commit -m "feat: add firewall setup script for container isolation

- Block private network ranges (127.x, 10.x, 172.16.x, 192.168.x)
- Whitelist postgres, sync-service, Nextcloud IP
- Allow all internet traffic
- Idempotent script with error handling"
```

---

## Task 4: Update Dockerfile with Firewall and MCP

**Files:**
- Modify: `Dockerfile`

**Step 1: Read current Dockerfile**

Run: `cat Dockerfile`

**Step 2: Update Dockerfile with MCP and firewall support**

Replace entire `Dockerfile` content:

```dockerfile
FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    iptables \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Install Nextcloud MCP server globally
RUN npm install -g @cbcoutinho/nextcloud-mcp-server

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
```

**Step 3: Commit Dockerfile changes**

```bash
git add Dockerfile
git commit -m "feat: add firewall and Nextcloud MCP to Dockerfile

- Install iptables for firewall rules
- Install @cbcoutinho/nextcloud-mcp-server globally
- Copy firewall setup script into container
- Create entrypoint that applies firewall before starting app
- Add error handling for firewall failures"
```

---

## Task 5: Create Production Docker Compose

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.dev.yml`

**Step 1: Backup existing docker-compose files**

```bash
cp docker-compose.yml docker-compose.yml.backup
cp docker-compose.dev.yml docker-compose.dev.yml.backup
```

**Step 2: Replace docker-compose.yml with production config**

Replace entire `docker-compose.yml` content:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: remoteclaudecode
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: remoteclaudecode
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - internal
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U remoteclaudecode"]
      interval: 10s
      timeout: 5s
      retries: 5

  sync-service:
    image: rclone/rclone:latest
    command: >
      bisync /data/notes nextcloud:Obsidian/General Notebook
      --conflict-resolve newer
      --resilient
      --recover
      --check-access
      --filters-file /config/bisync-filter.txt
      --verbose
    environment:
      RCLONE_CONFIG_NEXTCLOUD_TYPE: webdav
      RCLONE_CONFIG_NEXTCLOUD_URL: ${NEXTCLOUD_URL}
      RCLONE_CONFIG_NEXTCLOUD_VENDOR: nextcloud
      RCLONE_CONFIG_NEXTCLOUD_USER: ${NEXTCLOUD_USERNAME}
      RCLONE_CONFIG_NEXTCLOUD_PASS: ${NEXTCLOUD_PASSWORD}
    volumes:
      - ${OBSIDIAN_VAULT_PATH}:/data/notes
      - ./rclone-config:/config:ro
    networks:
      - internal
    restart: unless-stopped

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://remoteclaudecode:${POSTGRES_PASSWORD}@postgres:5432/remoteclaudecode
      NEXTCLOUD_URL: ${NEXTCLOUD_URL}
      NEXTCLOUD_USERNAME: ${NEXTCLOUD_USERNAME}
      NEXTCLOUD_PASSWORD: ${NEXTCLOUD_PASSWORD}
      NEXTCLOUD_IP: ${NEXTCLOUD_IP}
    volumes:
      - ${OBSIDIAN_VAULT_PATH}:/data/notes
      - ${REPOS_PATH}:/data/repos
      - ${CLAUDE_CONFIG}:/root/.claude:ro
    networks:
      - internal
      - internet
    cap_add:
      - NET_ADMIN
    depends_on:
      postgres:
        condition: service_healthy
      sync-service:
        condition: service_started
    restart: unless-stopped

volumes:
  postgres_data:

networks:
  internal:
    driver: bridge
  internet:
    driver: bridge
```

**Step 3: Update docker-compose.dev.yml for development**

Replace entire `docker-compose.dev.yml` content:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: remoteclaudecode
      POSTGRES_PASSWORD: dev_password
      POSTGRES_DB: remoteclaudecode
    ports:
      - "5432:5432"
    volumes:
      - postgres_data_dev:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data_dev:
```

**Step 4: Commit Docker Compose configuration**

```bash
git add docker-compose.yml docker-compose.dev.yml
git commit -m "feat: implement production Docker Compose with security isolation

Production setup (docker-compose.yml):
- Add postgres with health checks
- Add sync-service with rclone bisync daemon
- Update app with network isolation and firewall
- Use custom networks (internal + internet)
- Add service dependencies and health checks

Development setup (docker-compose.dev.yml):
- Keep simple postgres for local dev
- No sync service or firewall in dev mode"
```

---

## Task 6: Create MCP Server Configuration Template

**Files:**
- Create: `claude-config/mcp_settings.json.example`
- Create: `claude-config/README.md`

**Step 1: Create claude-config directory**

```bash
mkdir -p claude-config
```

**Step 2: Create MCP settings template**

Create `claude-config/mcp_settings.json.example`:

```json
{
  "mcpServers": {
    "nextcloud": {
      "command": "nextcloud-mcp-server",
      "env": {
        "NEXTCLOUD_URL": "${NEXTCLOUD_URL}",
        "NEXTCLOUD_USERNAME": "${NEXTCLOUD_USERNAME}",
        "NEXTCLOUD_PASSWORD": "${NEXTCLOUD_PASSWORD}"
      }
    }
  }
}
```

**Step 3: Create configuration README**

Create `claude-config/README.md`:

```markdown
# Claude Configuration for Docker

This directory contains configuration templates for running Claude Code in Docker with Nextcloud MCP.

## Setup

1. Copy this template to your `~/.claude` directory:
   ```bash
   cp claude-config/mcp_settings.json.example ~/.claude/mcp_settings.json
   ```

2. Edit `~/.claude/mcp_settings.json` and replace placeholders with actual values:
   - `${NEXTCLOUD_URL}` → Your Nextcloud URL (e.g., `https://cloud.example.com`)
   - `${NEXTCLOUD_USERNAME}` → Your Nextcloud username
   - `${NEXTCLOUD_PASSWORD}` → Your Nextcloud app password

3. The Docker container mounts `~/.claude` as read-only, so Claude Code will use this configuration.

## Creating Nextcloud App Password

1. Log into Nextcloud web interface
2. Go to Settings → Security
3. Scroll to "Devices & sessions"
4. Enter name: "Claude MCP Server"
5. Click "Create new app password"
6. Copy the generated password
7. Use this password in `mcp_settings.json`

## MCP Server Capabilities

The Nextcloud MCP server provides 90+ tools including:

- **Calendar**: Create events, list upcoming events, manage recurring events
- **Tasks**: Create todos, mark complete, set due dates
- **Contacts**: Create/search contacts, manage address books
- **Files**: Upload/download files, manage folders
- **Notes**: Create/edit Nextcloud notes

## Testing

Test the MCP connection from Claude Code:
```
Ask Claude: "Show me my calendar for this week"
Ask Claude: "Create a todo: Test Nextcloud MCP integration"
```

## Troubleshooting

If MCP server fails to connect:
1. Check Nextcloud URL is accessible from Docker container
2. Verify app password is correct
3. Check Docker logs: `docker-compose logs app`
4. Verify NEXTCLOUD_IP is whitelisted in firewall
```

**Step 4: Commit MCP configuration templates**

```bash
git add claude-config/
git commit -m "docs: add Claude MCP configuration templates

- Add mcp_settings.json.example for Nextcloud MCP
- Add README with setup instructions
- Document app password creation
- Add troubleshooting guide"
```

---

## Task 7: Create Initial Sync Script

**Files:**
- Create: `scripts/initial-sync.sh`
- Create: `scripts/.gitignore`

**Step 1: Create scripts directory**

```bash
mkdir -p scripts
```

**Step 2: Write initial sync script**

Create `scripts/initial-sync.sh`:

```bash
#!/bin/bash
set -e

echo "=================================="
echo "Initial Obsidian Vault Sync Setup"
echo "=================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "Error: .env file not found"
    echo "Please create .env from .env.example and configure it"
    exit 1
fi

# Source environment variables
set -a
source .env
set +a

# Verify required variables
if [ -z "$NEXTCLOUD_URL" ] || [ -z "$NEXTCLOUD_USERNAME" ] || [ -z "$NEXTCLOUD_PASSWORD" ]; then
    echo "Error: Nextcloud credentials not set in .env"
    exit 1
fi

if [ -z "$OBSIDIAN_VAULT_PATH" ]; then
    echo "Error: OBSIDIAN_VAULT_PATH not set in .env"
    exit 1
fi

# Check if vault directory exists
if [ ! -d "$OBSIDIAN_VAULT_PATH" ]; then
    echo "Error: Vault directory does not exist: $OBSIDIAN_VAULT_PATH"
    exit 1
fi

echo "Vault path: $OBSIDIAN_VAULT_PATH"
echo "Nextcloud: $NEXTCLOUD_URL"
echo ""
echo "This will perform initial bidirectional sync with Nextcloud."
echo "Files on both sides will be merged, with newer files taking precedence."
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted"
    exit 1
fi

echo ""
echo "Starting initial sync (this may take a few minutes)..."
echo ""

# Run rclone bisync with --resync flag for first-time sync
docker-compose run --rm sync-service \
    bisync /data/notes "nextcloud:Obsidian/General Notebook" \
    --resync \
    --conflict-resolve newer \
    --filters-file /config/bisync-filter.txt \
    --verbose

echo ""
echo "=================================="
echo "Initial sync complete!"
echo "=================================="
echo ""
echo "The sync-service container will now run continuously,"
echo "syncing changes every 60 seconds."
echo ""
echo "Start the full stack with: docker-compose up -d"
```

**Step 3: Make script executable**

```bash
chmod +x scripts/initial-sync.sh
```

**Step 4: Create scripts/.gitignore**

Create `scripts/.gitignore`:

```
*.log
*.tmp
```

**Step 5: Commit initial sync script**

```bash
git add scripts/
git commit -m "feat: add initial Obsidian vault sync script

- Interactive script for first-time rclone bisync
- Validates .env configuration
- Checks vault directory exists
- Uses --resync flag for baseline establishment
- User confirmation before syncing"
```

---

## Task 8: Update Documentation

**Files:**
- Create: `docs/DOCKER_SETUP.md`
- Modify: `README.md`

**Step 1: Create Docker setup documentation**

Create `docs/DOCKER_SETUP.md`:

```markdown
# Docker Setup Guide

Complete guide for running RemoteClaudeCode in Docker with Obsidian sync and Nextcloud MCP integration.

## Prerequisites

1. Docker and Docker Compose installed
2. Nextcloud instance accessible from your network
3. Obsidian vault synced with Remotely Save plugin
4. Nextcloud app password created

## Quick Start

### 1. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env and set:
# - NEXTCLOUD_URL (your Nextcloud URL)
# - NEXTCLOUD_USERNAME (your username)
# - NEXTCLOUD_PASSWORD (app password from Nextcloud)
# - NEXTCLOUD_IP (IP address of Nextcloud server)
# - POSTGRES_PASSWORD (generate a secure password)
# - OBSIDIAN_VAULT_PATH (path to your General Notebook vault)
# - REPOS_PATH (path to your code repos)
# - CLAUDE_CONFIG (usually ~/.claude)
```

### 2. Configure Claude MCP

```bash
# Copy MCP template to your Claude config
cp claude-config/mcp_settings.json.example ~/.claude/mcp_settings.json

# Edit ~/.claude/mcp_settings.json and replace:
# - ${NEXTCLOUD_URL} with your actual Nextcloud URL
# - ${NEXTCLOUD_USERNAME} with your username
# - ${NEXTCLOUD_PASSWORD} with your app password
```

### 3. Initial Vault Sync

```bash
# Run initial sync to establish baseline
./scripts/initial-sync.sh

# This will:
# - Validate your configuration
# - Perform first-time bidirectional sync
# - Merge files from desktop and Nextcloud
```

### 4. Start Services

```bash
# Start all services in background
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

### 5. Access Application

Open browser: http://localhost:3000

## Architecture

```
┌─────────────────────────────────────────┐
│  Docker Compose Stack                   │
│                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────┐ │
│  │ postgres │  │  sync-   │  │ app  │ │
│  │          │  │ service  │  │      │ │
│  └──────────┘  └──────────┘  └──────┘ │
│       ↑             ↑            ↑      │
│       └─────────────┴────────────┘      │
│            Internal Network             │
└─────────────────────────────────────────┘
         ↓              ↓           ↓
     Database      Nextcloud    Internet
```

## Services

### app
- RemoteClaudeCode web interface
- Claude Code CLI
- Nextcloud MCP server
- Port: 3000

### postgres
- PostgreSQL 16 database
- Stores sessions, messages, jobs
- Internal network only

### sync-service
- rclone bisync daemon
- Syncs vault ↔ Nextcloud every 60 seconds
- Automatic conflict resolution (newer wins)

## Security

### Network Isolation

The app container has restricted network access:

**✅ Allowed:**
- Internet (for Anthropic API, web searches)
- postgres:5432 (database)
- sync-service (internal)
- Nextcloud IP on ports 80/443

**❌ Blocked:**
- Host filesystem (except mounted volumes)
- Local network (192.168.x.x, 10.x.x.x)
- Other containers
- Host services

### Firewall Rules

Implemented via iptables in container startup:
```bash
# Block private networks
BLOCK: 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16

# Allow whitelisted services
ALLOW: postgres, sync-service, ${NEXTCLOUD_IP}

# Allow internet
ALLOW: 0.0.0.0/0
```

## Obsidian Sync Workflow

### Desktop → Server
1. Edit note in desktop Obsidian
2. Remotely Save pushes to Nextcloud
3. Server rclone detects change (~60s)
4. rclone pulls to server vault
5. Claude sees updated note

### Server → Desktop
1. Claude edits note
2. rclone detects change (~60s)
3. rclone pushes to Nextcloud
4. Remotely Save syncs to desktop
5. You see Claude's changes

### Conflict Resolution

- **Strategy**: Newer file wins automatically
- **Lost versions**: Saved as `.conflict` files
- **Manual merge**: Possible if needed

## MCP Server Features

Claude can interact with Nextcloud:

**Calendar:**
- "Schedule meeting for Tuesday at 2pm"
- "Show my calendar for this week"
- "Create recurring weekly team standup"

**Contacts:**
- "Add John's email: john@example.com"
- "Show me all contacts"
- "Update Sarah's phone number"

**Tasks:**
- "Create todo: Review PR, due Friday"
- "Mark task complete: Buy groceries"
- "Show my open tasks"

**Files:**
- "Upload this document to Nextcloud"
- "List files in Documents folder"
- "Download report.pdf from Nextcloud"

## Troubleshooting

### Sync not working

1. Check sync-service logs:
   ```bash
   docker-compose logs sync-service
   ```

2. Verify Nextcloud credentials:
   ```bash
   docker-compose run --rm sync-service lsd nextcloud:
   ```

3. Check filter file syntax:
   ```bash
   cat rclone-config/bisync-filter.txt
   ```

### MCP connection fails

1. Verify MCP configuration:
   ```bash
   cat ~/.claude/mcp_settings.json
   ```

2. Test Nextcloud connectivity:
   ```bash
   curl -u username:password https://your-nextcloud.com/remote.php/dav/
   ```

3. Check app container logs:
   ```bash
   docker-compose logs app
   ```

### Firewall issues

1. View iptables rules:
   ```bash
   docker-compose exec app iptables -L OUTPUT -n -v
   ```

2. Test internet access:
   ```bash
   docker-compose exec app curl -I https://anthropic.com
   ```

3. Verify Nextcloud whitelist:
   ```bash
   docker-compose exec app curl -I https://your-nextcloud.com
   ```

## Maintenance

### Update containers

```bash
docker-compose pull
docker-compose up -d --build
```

### Backup database

```bash
docker-compose exec postgres pg_dump -U remoteclaudecode remoteclaudecode > backup.sql
```

### Reset sync (caution!)

```bash
# This re-establishes baseline
./scripts/initial-sync.sh
```

### View sync status

```bash
docker-compose logs sync-service | grep -E "(synced|conflict|error)"
```

## Server Deployment

For production server deployment:

1. Use environment variables from secrets manager
2. Add reverse proxy (nginx/Caddy) for HTTPS
3. Set up automated backups for postgres and vault
4. Configure monitoring and alerts
5. Use Docker secrets instead of .env file
6. Enable Docker logging driver

See design document for detailed server deployment guide.
```

**Step 2: Update main README with Docker info**

Add this section to `README.md` after the "Development Server" section:

```markdown
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
```

**Step 3: Commit documentation**

```bash
git add docs/DOCKER_SETUP.md README.md
git commit -m "docs: add comprehensive Docker setup guide

- Complete Docker Compose setup instructions
- Obsidian sync workflow documentation
- Security model explanation
- MCP server usage examples
- Troubleshooting guide
- Maintenance procedures
- Update main README with Docker section"
```

---

## Task 9: Add Testing Documentation

**Files:**
- Create: `docs/TESTING.md`

**Step 1: Create testing documentation**

Create `docs/TESTING.md`:

```markdown
# Testing Guide

Comprehensive testing checklist for Docker + Obsidian + Nextcloud integration.

## Prerequisites

- Docker stack running: `docker-compose ps` shows all services healthy
- Obsidian vault mounted correctly
- Nextcloud MCP configured

## Local Testing

### 1. Database Connectivity

**Test:** Verify app can connect to postgres

```bash
# Check postgres is healthy
docker-compose ps postgres

# Test connection from app
docker-compose exec app npx tsx -e "
import { db } from './server/utils/db.js';
console.log('Testing database connection...');
const result = await db.execute('SELECT 1 as test');
console.log('✅ Database connection successful');
process.exit(0);
"
```

**Expected:** `✅ Database connection successful`

### 2. Bidirectional Sync

**Test:** Desktop → Server sync

```bash
# 1. Create test file on desktop
echo "Test from desktop $(date)" > "$OBSIDIAN_VAULT_PATH/sync-test.md"

# 2. Wait 60 seconds for sync
sleep 60

# 3. Check file appears in container
docker-compose exec app cat /data/notes/sync-test.md
```

**Expected:** File content appears in container

**Test:** Server → Desktop sync

```bash
# 1. Create test file in container
docker-compose exec app sh -c 'echo "Test from server $(date)" > /data/notes/server-test.md'

# 2. Wait 60 seconds
sleep 60

# 3. Check file on desktop
cat "$OBSIDIAN_VAULT_PATH/server-test.md"
```

**Expected:** File appears on desktop

**Test:** Conflict resolution

```bash
# 1. Create same file both places
echo "Desktop version" > "$OBSIDIAN_VAULT_PATH/conflict-test.md"
docker-compose exec app sh -c 'echo "Server version" > /data/notes/conflict-test.md'

# 2. Wait 60 seconds
sleep 60

# 3. Check which version won (should be newer timestamp)
cat "$OBSIDIAN_VAULT_PATH/conflict-test.md"

# 4. Check for conflict file
ls -la "$OBSIDIAN_VAULT_PATH/" | grep conflict
```

**Expected:** Newer version wins, `.conflict` file created for older version

### 3. Nextcloud MCP Integration

**Test:** Calendar creation

```bash
# Open RemoteClaudeCode at http://localhost:3000
# Start a chat and send:
"Create a calendar event: Test MCP Integration, tomorrow at 2pm"

# Verify in Nextcloud Calendar web interface
```

**Expected:** Event appears in Nextcloud calendar

**Test:** Contact creation

```bash
# In RemoteClaudeCode chat:
"Add a contact: Test User, email test@example.com"

# Verify in Nextcloud Contacts
```

**Expected:** Contact appears in Nextcloud

**Test:** Task creation

```bash
# In RemoteClaudeCode chat:
"Create a todo: Test task creation, due tomorrow"

# Verify in Nextcloud Tasks app
```

**Expected:** Task appears in Nextcloud

### 4. Security Testing

**Test:** Internet access (should work)

```bash
docker-compose exec app curl -I https://anthropic.com
```

**Expected:** `200 OK` response

**Test:** Local network blocked

```bash
# Try accessing host machine (should fail)
docker-compose exec app curl --connect-timeout 5 http://192.168.1.1
```

**Expected:** Connection timeout or rejection

**Test:** Nextcloud whitelisted

```bash
docker-compose exec app curl -I $NEXTCLOUD_URL
```

**Expected:** `200 OK` or `302 Redirect` (success)

**Test:** Postgres accessible

```bash
docker-compose exec app nc -zv postgres 5432
```

**Expected:** `Connection to postgres 5432 port [tcp/postgresql] succeeded!`

**Test:** Firewall rules active

```bash
docker-compose exec app iptables -L OUTPUT -n -v
```

**Expected:** Rules showing REJECT for private networks, ACCEPT for whitelisted services

### 5. Application Functionality

**Test:** Health endpoint

```bash
curl http://localhost:3000/api/health
```

**Expected:** `{"status":"ok"}`

**Test:** Sessions endpoint

```bash
curl http://localhost:3000/api/sessions
```

**Expected:** JSON array (may be empty)

**Test:** Create session

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Session"}'
```

**Expected:** JSON object with session ID

**Test:** Web UI loads

```bash
curl -I http://localhost:3000
```

**Expected:** `200 OK` with HTML content

## Automated Testing

Run existing test suite:

```bash
# Unit tests
npm test

# Integration tests with Docker stack
npm run test:integration
```

## Troubleshooting Tests

### Sync test fails

1. Check sync-service logs:
   ```bash
   docker-compose logs sync-service | tail -50
   ```

2. Verify rclone can connect:
   ```bash
   docker-compose run --rm sync-service lsd nextcloud:
   ```

3. Check filter file:
   ```bash
   docker-compose exec sync-service cat /config/bisync-filter.txt
   ```

### MCP test fails

1. Check MCP configuration:
   ```bash
   cat ~/.claude/mcp_settings.json
   ```

2. Verify Nextcloud credentials:
   ```bash
   curl -u "$NEXTCLOUD_USERNAME:$NEXTCLOUD_PASSWORD" \
     "$NEXTCLOUD_URL/remote.php/dav/"
   ```

3. Check app logs:
   ```bash
   docker-compose logs app | grep -i "mcp\|nextcloud"
   ```

### Security test fails

1. Check firewall setup:
   ```bash
   docker-compose logs app | grep -i firewall
   ```

2. Verify NET_ADMIN capability:
   ```bash
   docker-compose exec app capsh --print | grep NET_ADMIN
   ```

3. Check iptables loaded:
   ```bash
   docker-compose exec app iptables --version
   ```

## Test Cleanup

Remove test files after testing:

```bash
# Remove test files from vault
rm "$OBSIDIAN_VAULT_PATH/sync-test.md"
rm "$OBSIDIAN_VAULT_PATH/server-test.md"
rm "$OBSIDIAN_VAULT_PATH/conflict-test.md"
rm "$OBSIDIAN_VAULT_PATH/"*.conflict 2>/dev/null || true

# Remove test session from database
curl -X DELETE http://localhost:3000/api/sessions/[session-id]
```

## CI/CD Integration

For automated testing in CI:

```yaml
# .github/workflows/docker-test.yml
name: Docker Integration Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Start Docker stack
        run: docker-compose up -d
      - name: Wait for services
        run: sleep 30
      - name: Run health check
        run: curl -f http://localhost:3000/api/health
      - name: Run tests
        run: npm test
      - name: Stop Docker stack
        run: docker-compose down
```
```

**Step 2: Commit testing documentation**

```bash
git add docs/TESTING.md
git commit -m "docs: add comprehensive testing guide

- Database connectivity tests
- Bidirectional sync tests with conflict resolution
- Nextcloud MCP integration tests
- Security and firewall tests
- Application functionality tests
- Troubleshooting guide for test failures
- CI/CD integration example"
```

---

## Task 10: Final Integration Testing

**Files:**
- None (manual testing)

**Step 1: Build Docker images**

```bash
docker-compose build
```

**Expected:** Build succeeds, all layers cached

**Step 2: Start services**

```bash
docker-compose up -d
```

**Expected:** All three containers start and become healthy

**Step 3: Verify service health**

```bash
docker-compose ps
```

**Expected:** All services show "Up" status, postgres shows "(healthy)"

**Step 4: Check logs for errors**

```bash
docker-compose logs app | grep -i "error\|fail"
docker-compose logs sync-service | grep -i "error\|fail"
docker-compose logs postgres | grep -i "error\|fail"
```

**Expected:** No critical errors (warnings about first-time setup are OK)

**Step 5: Test web UI**

Open browser to `http://localhost:3000`

**Expected:** RemoteClaudeCode UI loads, can create new chat session

**Step 6: Run test suite**

```bash
npm test
```

**Expected:** All tests pass

**Step 7: Commit integration test results**

```bash
git add -A
git commit -m "test: verify Docker integration works end-to-end

Tested:
- Docker build completes successfully
- All services start and reach healthy state
- Web UI accessible on port 3000
- Test suite passes
- No critical errors in logs

Ready for user acceptance testing"
```

---

## Post-Implementation Checklist

After completing all tasks:

- [ ] All tests pass (`npm test`)
- [ ] Docker Compose starts successfully (`docker-compose up -d`)
- [ ] Web UI loads at http://localhost:3000
- [ ] Initial sync script works (`./scripts/initial-sync.sh`)
- [ ] Documentation is complete and accurate
- [ ] `.env` is configured (user action required)
- [ ] MCP settings configured in `~/.claude` (user action required)
- [ ] Firewall rules verified (`docker-compose exec app iptables -L OUTPUT`)

## User Acceptance Testing

User must test:

1. **Obsidian Sync:**
   - [ ] Desktop → Server sync works
   - [ ] Server → Desktop sync works
   - [ ] Remotely Save still works on desktop
   - [ ] Conflict resolution handles simultaneous edits

2. **Nextcloud MCP:**
   - [ ] Can create calendar events via Claude
   - [ ] Can create contacts via Claude
   - [ ] Can create tasks via Claude
   - [ ] All operations appear in Nextcloud web UI

3. **Security:**
   - [ ] Claude can search web
   - [ ] Claude cannot access host machine
   - [ ] Claude can access mounted vault and repos
   - [ ] Firewall blocks local network access

## Rollback Plan

If issues occur, rollback to previous working state:

```bash
# Stop new stack
docker-compose down

# Restore old docker-compose.yml
cp docker-compose.yml.backup docker-compose.yml
cp docker-compose.dev.yml.backup docker-compose.dev.yml

# Start old setup
docker-compose up -d
```

---

**Plan complete and saved to:** `docs/plans/2026-02-15-docker-obsidian-nextcloud-implementation.md`
