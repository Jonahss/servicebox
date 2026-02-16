#!/usr/bin/env bash
# healthcheck.sh — Check if a service is healthy
# Usage: ./healthcheck.sh <host> <port>
# Exit code: 0 = healthy, 1 = unhealthy/unreachable

set -e

HOST="${1:-localhost}"
PORT="${2}"

if [ -z "$PORT" ]; then
  echo "Usage: ./healthcheck.sh <host> <port>" >&2
  exit 1
fi

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 --max-time 5 "http://${HOST}:${PORT}/health" 2>/dev/null || echo "000")

if [ "$RESPONSE" = "200" ]; then
  exit 0
else
  exit 1
fi
