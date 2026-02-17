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
