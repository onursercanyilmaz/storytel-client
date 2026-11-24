#!/usr/bin/env bash
echo "========================================================"
echo "  storytel-client - Starting Desktop Player..."
echo "  Address: http://127.0.0.1:3000"
echo "========================================================"

if [[ "$OSTYPE" == "darwin"* ]]; then
  open "http://127.0.0.1:3000" &
elif command -v xdg-open > /dev/null 2>&1; then
  xdg-open "http://127.0.0.1:3000" &
fi

npm run start
