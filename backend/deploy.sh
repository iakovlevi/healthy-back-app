#!/bin/bash

# Configuration
FUNCTION_NAME="healthy-back-api"
FOLDER_ID="b1g9ln2cl40c2fbcgdq0"

echo "🚀 Deploying Backend to Yandex Cloud..."

# 1. Zip the backend
echo "📦 Zipping backend..."
rm -f backend.zip
zip -r backend.zip . -x "node_modules/*" "__tests__/*" "jest.config.js" ".gitignore" "deploy.sh"

# 2. Create a new version of the function
echo "☁️ Uploading to Yandex Cloud Functions..."
yc serverless function version create \
  --function-name=$FUNCTION_NAME \
  --folder-id=$FOLDER_ID \
  --runtime=nodejs18 \
  --entrypoint=server.handler \
  --memory=256m \
  --execution-timeout=10s \
  --source-path=./backend.zip

echo "✅ Backend deployment complete!"
rm backend.zip
