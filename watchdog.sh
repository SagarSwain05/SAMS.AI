#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# SAMS.AI Backend Watchdog
# Keeps run.py alive: auto-restarts after crash/segfault with exponential backoff.
# Usage: ./backend/watchdog.sh
# ──────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

source venv/bin/activate
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"

RESTART_DELAY=3
MAX_DELAY=30
CRASH_COUNT=0

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SAMS.AI Backend Watchdog started"
echo "  Working dir: $SCRIPT_DIR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

while true; do
    echo "[$(date '+%H:%M:%S')] Starting backend (crash #$CRASH_COUNT)..."
    python run.py
    EXIT_CODE=$?

    if [ $EXIT_CODE -eq 0 ]; then
        # Clean exit (Ctrl-C / SIGTERM) — stop the watchdog too
        echo "[$(date '+%H:%M:%S')] Backend exited cleanly (code 0). Watchdog stopping."
        break
    fi

    CRASH_COUNT=$((CRASH_COUNT + 1))
    echo "[$(date '+%H:%M:%S')] ⚠ Backend crashed (exit=$EXIT_CODE). Restart #$CRASH_COUNT in ${RESTART_DELAY}s..."
    sleep "$RESTART_DELAY"

    # Exponential backoff: 3 → 6 → 12 → 24 → 30 → 30 ...
    RESTART_DELAY=$((RESTART_DELAY * 2))
    if [ $RESTART_DELAY -gt $MAX_DELAY ]; then
        RESTART_DELAY=$MAX_DELAY
    fi
done
