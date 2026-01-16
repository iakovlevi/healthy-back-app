#!/bin/bash

# Configuration
FUNCTION_NAME="healthy-back-api"
DEFAULT_FOLDER_ID="b1g9ln2cl40c2fbcgdq0"
FOLDER_ID="${FOLDER_ID:-$DEFAULT_FOLDER_ID}"

# Try to find a key file to extract Service Account ID
KEY_FILE=""
if [ -f "../authorized_key.json" ]; then
    KEY_FILE="../authorized_key.json"
elif [ -f "../sa-key.json" ]; then
    KEY_FILE="../sa-key.json"
fi

SA_FLAG=""
if [ -n "$KEY_FILE" ]; then
    # Simple grep extraction for local compatibility
    SA_ID=$(grep -o '"service_account_id": *"[^"]*"' "$KEY_FILE" | cut -d'"' -f4)
    KEY_FOLDER_ID=$(grep -o '"folder_id": *"[^"]*"' "$KEY_FILE" | cut -d'"' -f4)
    if [ -n "$SA_ID" ]; then
        echo "🔑 Found Service Account ID: $SA_ID"
        SA_FLAG="--service-account-id=$SA_ID"
    fi
    if [ -n "$KEY_FOLDER_ID" ]; then
        FOLDER_ID="$KEY_FOLDER_ID"
    fi
fi

FOLDER_FLAG=""
if [ -n "$FOLDER_ID" ]; then
    FOLDER_FLAG="--folder-id=$FOLDER_ID"
fi

echo "🚀 Deploying Backend to Yandex Cloud..."

# 1. Zip the backend
echo "📦 Zipping backend..."
rm -f backend.zip
zip -r backend.zip . -x "node_modules/*" "__tests__/*" "jest.config.js" ".gitignore" "deploy.sh"

# 2. Create a new version of the function
echo "☁️ Uploading to Yandex Cloud Functions..."
yc serverless function version create \
  --function-name=$FUNCTION_NAME \
  $FOLDER_FLAG \
  --runtime=nodejs18 \
  --entrypoint=server.handler \
  --memory=256m \
  --execution-timeout=30s \
  $SA_FLAG \
  --source-path=./backend.zip

echo "✅ Backend deployment complete!"
rm backend.zip
