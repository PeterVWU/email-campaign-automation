#!/bin/sh
set -e

echo "Running Payload migrations..."
npx payload migrate
echo "Migrations complete. Starting server..."
exec node server.js
