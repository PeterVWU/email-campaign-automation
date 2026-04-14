#!/bin/sh
set -e

echo "Running Payload migrations..."
echo "y" | npx payload migrate || echo "Migration skipped or already up to date."
echo "Migrations complete. Starting server..."
exec node server.js
