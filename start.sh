#!/bin/bash
# Start script for Student Attendance System

echo "=========================================="
echo "  Starting Attendance System"
echo "=========================================="

# Check PostgreSQL
echo "Checking PostgreSQL..."
if ! brew services list | grep -q "postgresql@15.*started"; then
    echo "Starting PostgreSQL..."
    brew services start postgresql@15
    sleep 2
fi
echo "✓ PostgreSQL is running"

# Start backend via watchdog (auto-restarts on crash/segfault)
echo ""
echo "Starting backend (with watchdog) in new terminal..."
osascript -e 'tell application "Terminal" to do script "cd '$(pwd)'/backend && ./watchdog.sh"'

# Wait a bit for backend to start
sleep 3

# Start frontend in new terminal
echo "Starting frontend in new terminal..."
osascript -e 'tell application "Terminal" to do script "cd '$(pwd)'/frontend && npm run dev"'

echo ""
echo "=========================================="
echo "  System Started!"
echo "=========================================="
echo ""
echo "Access URLs:"
echo "  Admin Panel:    http://localhost:5173"
echo "  Kiosk Mode:     http://localhost:5173/kiosk"
echo ""
echo "Credentials:"
echo "  Admin:          college_admin / Admin@2024"
echo "  Teacher:        tmat001 / Teacher@2024"
echo "  Student:        cse2024001 / Stud@2024"
echo ""
echo "To stop: Run ./stop.sh"
echo "=========================================="
