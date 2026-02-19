#!/bin/sh
set -e

echo "Starting continuous bisync daemon..."
echo "Syncing every 60 seconds"

while true; do
    echo "=== Sync starting at $(date) ==="

    rclone bisync /data/notes "nextcloud:Obsidian/General Notebook" \
        --conflict-resolve newer \
        --resilient \
        --recover \
        --filters-file /config/bisync-filter.txt \
        --verbose

    sync_exit_code=$?

    if [ $sync_exit_code -eq 0 ]; then
        echo "✓ Sync successful"
    else
        echo "✗ Sync failed with exit code $sync_exit_code"
    fi

    echo "Sleeping 60 seconds..."
    sleep 60
done
