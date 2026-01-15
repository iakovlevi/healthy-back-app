#!/bin/bash

echo "🚀 Starting Full Deployment of Healthy Back App..."

# 1. Backend
echo "--- Backend ---"
cd backend
./deploy.sh
cd ..

# 2. Frontend
echo "--- Frontend ---"
cd frontend
./deploy.sh
cd ..

echo "🎉 All components deployed successfully!"
