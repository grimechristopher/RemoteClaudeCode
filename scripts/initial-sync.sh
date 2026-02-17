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
