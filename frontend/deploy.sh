#!/bin/bash

# Configuration
BUCKET_NAME="healthy-app"

echo "🚀 Deploying Frontend to Yandex Object Storage..."

# 1. Build the frontend
echo "🏗️ Building frontend..."
npm install
npm run build

# 2. Upload to S3
# Note: This requires the AWS CLI configured for Yandex Cloud S3
# or the yc storage CLI tool.
echo "☁️ Uploading build artifacts to S3 bucket '$BUCKET_NAME'..."

if command -v aws &> /dev/null
then
    aws s3 sync build/ s3://$BUCKET_NAME/ --endpoint-url=https://storage.yandexcloud.net --acl public-read --delete
elif command -v yc &> /dev/null
then
    # yc doesn't have a direct 'sync' like aws cli yet in all versions, 
    # but we can copy the whole folder
    yc storage cp -r build/* s3://$BUCKET_NAME/
else
    echo "❌ Error: Neither 'aws' nor 'yc' CLI tools were found."
    echo "Please install and configure one of them to proceed."
    exit 1
fi

echo "✅ Frontend deployment complete!"
