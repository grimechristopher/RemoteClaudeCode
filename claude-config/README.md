# Claude Configuration for Docker

This directory contains configuration templates for Claude Desktop running inside the Docker container.

## Overview

When you run Claude Desktop in the Docker container, it needs to be configured with MCP (Model Context Protocol) servers to access external services like Nextcloud.

## Setup Instructions

### 1. Create Your Configuration File

Copy the example configuration:

```bash
cp claude-config/mcp_settings.json.example claude-config/mcp_settings.json
```

### 2. Set Environment Variables

The configuration file uses environment variables for credentials. Add these to your `.env` file:

```env
# Nextcloud MCP Server Configuration
NEXTCLOUD_URL=https://your-nextcloud-instance.com
NEXTCLOUD_USERNAME=your-username
NEXTCLOUD_PASSWORD=your-app-password
```

**Important**: Use an app password, not your main Nextcloud password.

### 3. Create a Nextcloud App Password

1. Log into your Nextcloud instance
2. Go to Settings > Security
3. Scroll to "Devices & sessions"
4. Under "Create new app password", enter a name (e.g., "Claude MCP")
5. Click "Create new app password"
6. Copy the generated password and use it as `NEXTCLOUD_PASSWORD`

### 4. Mount Configuration in Docker

The `docker-compose.yml` is already configured to mount the Claude configuration:

```yaml
volumes:
  - ./claude-config:/home/appuser/.config/Claude
```

When you start the container, Claude Desktop will automatically load the MCP settings.

## Available MCP Servers

### Nextcloud MCP Server

Provides Claude with access to your Nextcloud files and data.

**Command**: `nextcloud-mcp-server`

**Environment Variables**:
- `NEXTCLOUD_URL`: Your Nextcloud instance URL
- `NEXTCLOUD_USERNAME`: Your Nextcloud username
- `NEXTCLOUD_PASSWORD`: Your Nextcloud app password (recommended) or account password

## Troubleshooting

### Claude Can't Connect to Nextcloud

1. Verify your environment variables are set correctly in `.env`
2. Check that the app password is valid and hasn't expired
3. Ensure your Nextcloud URL is accessible from the Docker container
4. Check Claude Desktop logs in the container

### Environment Variables Not Loading

Make sure:
1. Your `.env` file is in the project root
2. Docker Compose is reading the `.env` file (it does this automatically)
3. The variables are referenced in `docker-compose.yml` for the container

### MCP Server Not Starting

Check the Claude Desktop logs in the container:

```bash
docker-compose exec app cat /home/appuser/.config/Claude/logs/mcp.log
```

## Security Notes

- Never commit `mcp_settings.json` with real credentials
- Always use app passwords instead of main account passwords
- Keep your `.env` file out of version control (it's in `.gitignore`)
- Rotate your app passwords periodically
