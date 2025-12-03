#!/bin/bash

# Quick Episode Update Script
# Double-click or run: ./update-episodes.sh

echo "🎙️  Updating podcast episodes..."
echo ""

cd backend
npm run test-episode-update

echo ""
echo "✅ Done! Press any key to close..."
read -n 1
