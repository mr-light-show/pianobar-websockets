#!/bin/bash

# Build script for pianobar with WebSocket support
# Usage: ./build.sh [debug]

set -e  # Exit on error

BUILD_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$BUILD_DIR"

# Function to run pianobar with crash capture under lldb
run_with_crash_capture() {
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local session_file="pianobar-session-${timestamp}.log"
    local crash_file="pianobar-crash-${timestamp}.log"
    local lldb_script="debug-commands.lldb"
    
    # Create lldb command script
    cat > "$lldb_script" << 'EOF'
env PIANOBAR_DEBUG=8
settings set target.process.stop-on-crash true
run
thread backtrace all
quit
EOF
    
    echo "Running pianobar with crash capture..."
    echo "  Session log: $session_file"
    echo "  (Debug output will display in console)"
    echo ""
    
    # Run under lldb - output to BOTH console AND log file using tee
    lldb -s "$lldb_script" ./pianobar 2>&1 | tee "$session_file"
    
    # Check if crashed by looking for stop reason in log
    if grep -q "stop reason" "$session_file"; then
        echo ""
        echo "=== CRASH DETECTED ==="
        echo "Full backtrace saved to: $crash_file"
        grep -A 50 "stop reason" "$session_file" > "$crash_file"
        echo ""
        echo "Session log: $session_file"
        echo "Crash log: $crash_file"
    fi
    
    # Cleanup temporary script
    rm -f "$lldb_script"
}

# Check if debug mode is requested
if [ "$1" = "debug" ]; then
    echo "=== Building pianobar with WebSocket + Debug support ==="
    echo ""
    
    # Clean previous build
    echo "Cleaning previous build..."
    make clean WEBSOCKET=1
    echo ""
    
    # Build with debug flags
    echo "Building with debug symbols..."
    make WEBSOCKET=1 CFLAGS="-g -O0 -DWEBSOCKET_ENABLED"
    echo ""
    
    echo "✓ Debug build complete!"
    echo ""
    echo "Debug output enabled. Run with:"
    echo "  PIANOBAR_DEBUG=8 ./pianobar"
    echo ""
else
    echo "=== Building pianobar with WebSocket support ==="
    echo ""
    
    # Clean previous build
    echo "Cleaning previous build..."
    make clean WEBSOCKET=1
    echo ""
    
    # Build with optimization
    echo "Building optimized version..."
    make WEBSOCKET=1
    echo ""
    
    echo "✓ Production build complete!"
    echo ""
    echo "Run with: ./pianobar"
    echo ""
fi

# Build web UI
    echo "=== Building Web UI ==="
    echo ""
    cd webui
    
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
        echo ""
    fi
    
    echo "Building web UI..."
    npm run build
    echo ""
    
    cd "$BUILD_DIR"
    echo "✓ Web UI build complete!"
    echo ""

echo "=========================================="
echo "Build finished successfully!"
echo "=========================================="
echo ""
echo "Web interface will be available at:"
echo "  http://localhost:8080"
echo ""

# If debug mode, run with crash capture under lldb
if [ "$1" = "debug" ]; then
    echo "Starting pianobar with debug output and crash capture..."
    echo ""
    run_with_crash_capture
else    
    echo "Starting pianobar..."
    echo ""
    ./pianobar
fi