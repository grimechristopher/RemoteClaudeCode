# Docker + Obsidian + Nextcloud Integration Design

**Date:** 2026-02-15
**Status:** Approved
**Target:** Server deployment with security isolation

## Overview

Design for running RemoteClaudeCode in Docker with:
- Bidirectional Obsidian vault sync via Nextcloud
- Nextcloud MCP server integration (calendar, contacts, tasks)
- Network security isolation with controlled internet access
- Production-ready for server deployment

## Requirements

1. Claude Code runs in Docker container
2. Obsidian "General Notebook" vault stays synced bidirectionally with Nextcloud
3. Desktop Remotely Save plugin continues to work
4. Claude can create calendar events, contacts, and tasks via Nextcloud MCP
5. Security: Claude has internet access but blocked from local network (except whitelisted services)
6. Works on both local machine and remote server

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│  Docker Compose Stack                                   │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   postgres   │  │ sync-service │  │     app      │ │
│  │  (database)  │  │   (rclone)   │  │(Claude Code) │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│         ↑                 ↑                  ↑          │
│         └─────────────────┴──────────────────┘          │
│                  Internal Network                       │
└─────────────────────────────────────────────────────────┘
         ↓                   ↓                    ↓
    Database            Nextcloud           Internet
    (internal)          (allowed)           (allowed)
                                                  ↓
                                          Anthropic API
                                          Web Searches
                                          URL Fetching
```

### Component Details

**1. RemoteClaudeCode App Container:**
- Express backend + Vue frontend
- Claude Code CLI installed globally
- Exposed on port 3000
- Mounts: Obsidian vault, Claude config, code repos
- Has internet access for web searches, Anthropic API
- Blocked from local networks except postgres, sync-service, Nextcloud

**2. rclone Sync Service Container:**
- Lightweight Alpine-based container
- Runs `rclone bisync` in continuous daemon mode
- Syncs `/data/notes` ↔ Nextcloud WebDAV
- Conflict resolution: newer file wins
- Syncs every 60 seconds

**3. PostgreSQL Container:**
- Stores sessions, messages, scheduled jobs
- Volume for data persistence
- Internal network only

**4. Nextcloud MCP Server:**
- Integrated via Claude Code config
- NPM package: `@cbcoutinho/nextcloud-mcp-server`
- Provides 90+ tools for calendar, contacts, tasks, notes, files
- Connects to user's Nextcloud instance

## Docker Compose Configuration

### Services

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

  sync-service:
    image: rclone/rclone:latest
    command: >
      bisync /data/notes nextcloud:Obsidian/General\ Notebook
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
      - obsidian_vault:/data/notes
      - ./rclone-config:/config
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
      - obsidian_vault:/data/notes
      - ${REPOS_PATH}:/data/repos
      - ${CLAUDE_CONFIG}:/root/.claude:ro
    networks:
      - internal
      - internet
    cap_add:
      - NET_ADMIN  # For iptables rules
    restart: unless-stopped

volumes:
  postgres_data:
  obsidian_vault:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${OBSIDIAN_VAULT_PATH}

networks:
  internal:
    driver: bridge
    internal: true
  internet:
    driver: bridge
```

### Volume Mounts

- `/data/notes` → User's "General Notebook" Obsidian vault
- `/data/repos` → User's code repositories (optional)
- `/root/.claude` → Claude config (read-only, includes MCP server config)

### Environment Variables

Required in `.env`:
```bash
# Database
POSTGRES_PASSWORD=secure_password_here

# Nextcloud
NEXTCLOUD_URL=https://your-nextcloud.com
NEXTCLOUD_USERNAME=your-username
NEXTCLOUD_PASSWORD=app-password-here
NEXTCLOUD_IP=1.2.3.4  # IP of Nextcloud server for firewall whitelist

# Paths (local machine)
OBSIDIAN_VAULT_PATH=/home/user/Documents/Obsidian/General Notebook/General Notebook
REPOS_PATH=/home/user/Documents/Github
CLAUDE_CONFIG=/home/user/.claude

# Paths (server deployment)
# OBSIDIAN_VAULT_PATH=/mnt/data/obsidian-vault
# REPOS_PATH=/mnt/data/repos
# CLAUDE_CONFIG=/opt/claude-config
```

## Security Model

### Network Isolation

**Firewall Rules (applied via iptables in app container startup script):**

```bash
# Block private network ranges
iptables -A OUTPUT -d 127.0.0.0/8 -j REJECT      # Localhost
iptables -A OUTPUT -d 10.0.0.0/8 -j REJECT       # Private class A
iptables -A OUTPUT -d 172.16.0.0/12 -j REJECT    # Docker networks
iptables -A OUTPUT -d 192.168.0.0/16 -j REJECT   # Private class C

# Whitelist specific services (BEFORE reject rules)
iptables -I OUTPUT -d postgres -p tcp --dport 5432 -j ACCEPT
iptables -I OUTPUT -d sync-service -j ACCEPT
iptables -I OUTPUT -d ${NEXTCLOUD_IP} -p tcp --dport 443 -j ACCEPT

# Allow all other internet traffic (default policy)
```

**Implementation:** Add to Dockerfile entrypoint script:
```bash
#!/bin/bash
# Apply firewall rules
/usr/local/bin/setup-firewall.sh

# Start application
exec npm start
```

### What Claude CAN Access

✅ Internet (for web searches, Anthropic API, URL fetching)
✅ PostgreSQL database (sessions, messages)
✅ Sync service (internal communication)
✅ Nextcloud server (via whitelisted IP)
✅ Obsidian vault (read/write to `/data/notes`)
✅ Code repositories (read/write to `/data/repos`)

### What Claude CANNOT Access

❌ Host filesystem (except mounted volumes)
❌ Host processes or services
❌ Local network devices (192.168.x.x, 10.x.x.x)
❌ Other Docker containers (except postgres, sync-service)
❌ SSH keys, browser data, system credentials
❌ Modify Claude config (mounted read-only)

## Obsidian Sync Strategy

### Bidirectional Sync Flow

**Desktop → Server:**
1. User edits note on desktop Obsidian
2. Remotely Save pushes to Nextcloud (WebDAV)
3. Server rclone bisync detects changes (~60s delay)
4. rclone pulls changes to server `/data/notes`
5. Claude sees updated notes

**Server → Desktop:**
1. Claude edits note in `/data/notes`
2. rclone bisync detects file change (~60s)
3. rclone pushes to Nextcloud
4. Desktop Remotely Save syncs (auto or manual)
5. User sees Claude's changes

### Conflict Resolution

**Strategy:** `--conflict-resolve newer`
- Most recent modification timestamp wins
- Losing version saved as `.conflict` file
- User can manually merge if needed

**Edge Cases:**
- If edit happens within 60-second window on both sides, newer timestamp wins
- Network failures: rclone retries with `--resilient` and `--recover` flags
- First sync: requires `--resync` flag to establish baseline

### rclone Configuration

**Sync Command:**
```bash
rclone bisync /data/notes nextcloud:Obsidian/General\ Notebook \
  --conflict-resolve newer \
  --resilient \
  --recover \
  --check-access \
  --filters-file /config/bisync-filter.txt \
  --verbose
```

**Filter File (`/config/bisync-filter.txt`):**
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

**Daemon Behavior:**
- Runs in continuous loop
- Checks for changes every 60 seconds
- Logs all operations to stdout (captured by Docker)
- Auto-recovers from network failures
- Verifies both sides accessible before syncing

### Initial Setup

**First-time sync requires resync flag:**
```bash
rclone bisync /data/notes nextcloud:Obsidian/General\ Notebook \
  --resync \
  --conflict-resolve newer \
  --filters-file /config/bisync-filter.txt
```

After baseline established, remove `--resync` flag for normal operation.

## Nextcloud MCP Server Integration

### MCP Server Selection

**Chosen:** [cbcoutinho/nextcloud-mcp-server](https://github.com/cbcoutinho/nextcloud-mcp-server)

**Features:**
- 90+ tools across 8 Nextcloud apps
- Calendar/CalDAV: events, todos, recurring events, attendees
- Contacts/CardDAV: contact and address book management
- Files/WebDAV: file operations (separate from Obsidian vault)
- Notes: Nextcloud Notes app integration
- Tables, Deck, Cookbook: additional app support
- OAuth and app password authentication

### Installation

**In Dockerfile:**
```dockerfile
# Install Nextcloud MCP server globally
RUN npm install -g @cbcoutinho/nextcloud-mcp-server
```

### Configuration

**MCP Settings (`/root/.claude/mcp_settings.json`):**
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

**Note:** Environment variables substituted at container startup.

### Capabilities

**Calendar/CalDAV:**
- Create calendar events with title, start/end times, location, description
- List upcoming events (next 7 days, specific date ranges)
- Manage recurring events (daily, weekly, monthly patterns)
- Add attendees and send invitations
- Set reminders and alarms
- Update or delete events

**Tasks/Todos:**
- Create tasks with title, description, due date
- Mark tasks complete/incomplete
- Set priority levels
- Organize tasks in lists
- Filter by status, due date, priority

**Contacts/CardDAV:**
- Create contacts with name, email, phone, address
- Search contacts by name or email
- Update contact information
- Manage multiple address books
- Add custom fields (birthday, organization, notes)

**Files/WebDAV:**
- List files and folders
- Upload files to Nextcloud
- Download files from Nextcloud
- Create folders
- Move/rename files
- Delete files
- Share files with links or users

**Example Natural Language Commands:**
- "Schedule a team meeting for next Tuesday at 2pm with john@example.com"
- "Add Sarah's contact: sarah@example.com, phone 555-1234"
- "Create a todo: Review pull request, due Friday"
- "Show my calendar for this week"
- "Upload this document to Nextcloud Documents folder"

### Security

- Uses Nextcloud app password (not main account password)
- All MCP operations logged by Claude Code
- MCP server only has access to Nextcloud, no filesystem access
- Credentials stored in environment variables, not in code

## Deployment Scenarios

### Local Development

**Use existing setup with modifications:**
```yaml
# docker-compose.dev.yml
services:
  postgres:
    # ... existing config

  app:
    # ... existing config
    # Add sync-service and firewall rules
```

**Path mappings:**
- Vault: `/home/chris/Documents/Obsidian/General Notebook/General Notebook`
- Repos: `/home/chris/Documents/Github`
- Config: `/home/chris/.claude`

### Server Deployment

**Differences from local:**
1. Vault synced from Nextcloud (no local Obsidian running)
2. Paths adjusted for server filesystem:
   ```
   OBSIDIAN_VAULT_PATH=/mnt/data/obsidian-vault
   REPOS_PATH=/mnt/data/repos
   CLAUDE_CONFIG=/opt/claude-config
   ```
3. Reverse proxy (nginx/Caddy) for HTTPS
4. Backup strategy for postgres data
5. Monitoring and logging setup

**First-time server setup:**
1. Deploy Docker Compose stack
2. Run rclone bisync with `--resync` to pull vault from Nextcloud
3. Verify sync works both directions
4. Configure firewall rules for production
5. Set up automated backups

## Testing Strategy

### Local Testing Checklist

1. **Sync Testing:**
   - [ ] Edit note on desktop → appears on server within 60s
   - [ ] Claude edits note → appears on desktop within 60s
   - [ ] Create new note on desktop → syncs to server
   - [ ] Claude creates new note → syncs to desktop
   - [ ] Conflict resolution: edit same file both sides, verify newer wins

2. **MCP Server Testing:**
   - [ ] Create calendar event via Claude
   - [ ] List upcoming events
   - [ ] Create contact via Claude
   - [ ] Search contacts
   - [ ] Create todo via Claude
   - [ ] Mark todo complete

3. **Security Testing:**
   - [ ] Verify Claude cannot access host filesystem
   - [ ] Verify Claude cannot access 192.168.x.x addresses
   - [ ] Verify Claude CAN access internet (web search)
   - [ ] Verify Claude CAN access Nextcloud
   - [ ] Check iptables rules are applied

4. **Database Testing:**
   - [ ] Create chat session
   - [ ] Messages persist after container restart
   - [ ] Scheduled jobs execute

### Server Deployment Testing

Same as local testing, plus:
- [ ] HTTPS works via reverse proxy
- [ ] Firewall rules at host level
- [ ] Automatic restart after server reboot
- [ ] Backup and restore procedures

## Migration Path

### Phase 1: Local Docker Setup (1-2 days)
1. Update Dockerfile to install rclone MCP server
2. Create docker-compose.yml with all services
3. Add firewall setup script
4. Test locally with existing vault

### Phase 2: Sync Integration (1 day)
1. Configure rclone bisync
2. Create filter file
3. Test bidirectional sync with Remotely Save
4. Verify conflict resolution

### Phase 3: MCP Server Setup (1 day)
1. Configure Nextcloud MCP in Claude config
2. Create Nextcloud app password
3. Test all MCP operations
4. Document example commands

### Phase 4: Security Hardening (1 day)
1. Implement iptables rules
2. Test network restrictions
3. Verify internet access still works
4. Document security model

### Phase 5: Server Deployment (2-3 days)
1. Set up server environment
2. Deploy Docker Compose stack
3. Configure reverse proxy
4. Set up backups and monitoring
5. Final testing

**Total Estimated Time:** 6-8 days

## Open Questions / Future Considerations

1. **Backup Strategy:** Should postgres data and Obsidian vault be backed up separately to Nextcloud or elsewhere?

2. **Monitoring:** What metrics should be tracked? (sync failures, MCP errors, container health)

3. **Scaling:** If multiple users, need separate containers or shared instance?

4. **Updates:** How to handle Claude Code CLI updates without rebuilding container?

5. **Logs:** Centralized logging solution (ELK stack, Loki)?

6. **Obsidian Plugins:** Should sync include all plugins or just Remotely Save config?

## References

- [rclone bisync documentation](https://rclone.org/bisync/)
- [Nextcloud MCP Server](https://github.com/cbcoutinho/nextcloud-mcp-server)
- [Remotely Save Plugin](https://github.com/remotely-save/remotely-save)
- [Docker Network Security](https://docs.docker.com/network/drivers/)
- [iptables Docker Integration](https://docs.docker.com/network/packet-filtering-firewalls/)

## Approval

**Design Approved By:** User
**Date:** 2026-02-15
**Next Step:** Create implementation plan via writing-plans skill
