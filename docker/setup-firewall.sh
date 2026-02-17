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
