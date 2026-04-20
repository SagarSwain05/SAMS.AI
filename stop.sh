#!/bin/bash
# Stop script for Student Attendance System

echo "=========================================="
echo "  Stopping Attendance System"
echo "=========================================="

# Kill backend
echo "Stopping backend (port 5001)..."
if lsof -ti:5001 >/dev/null 2>&1; then
    lsof -ti:5001 | xargs kill -9
    echo "✓ Backend stopped"
else
    echo "  Backend was not running"
fi

# Kill frontend
echo "Stopping frontend (port 5173)..."
if lsof -ti:5173 >/dev/null 2>&1; then
    lsof -ti:5173 | xargs kill -9
    echo "✓ Frontend stopped"
else
    echo "  Frontend was not running"
fi

# Wait a moment
sleep 2

# Check camera
echo ""
echo "Checking camera status..."
if lsof 2>/dev/null | grep -qi "python.*camera"; then
    echo "⚠️  Camera may still be in use"
    echo "   Run: pkill -9 python"
else
    echo "✓ Camera released"
fi

echo ""
echo "=========================================="
echo "  System Stopped!"
echo "=========================================="
echo ""
echo "To start again: Run ./start.sh"
echo "=========================================="
