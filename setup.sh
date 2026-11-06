#!/bin/bash

# AgriAI Assistant Setup Script (Global Environment)
# This script sets up the complete agricultural AI system using the current global environment

echo "🌾 Setting up AgriAI Assistant (Global Environment)..."

# Check Python version
python_version=$(python3 --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
required_version="3.8"

if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]; then
    echo "❌ Python 3.8+ is required. Found: $python_version"
    exit 1
fi

# Check Node.js version
node_version=$(node --version 2>&1 | sed 's/v//')
required_node="16.0.0"

if [ "$(printf '%s\n' "$required_node" "$node_version" | sort -V | head -n1)" != "$required_node" ]; then
    echo "❌ Node.js 16+ is required. Found: $node_version"
    exit 1
fi

echo "✅ System requirements met"

# Setup Backend
echo "🔧 Setting up backend..."
cd backend

# Install Python dependencies in global environment
echo "Installing Python dependencies (global environment)..."
pip install --upgrade pip
pip install -r requirements.txt

# Copy environment file
if [ ! -f .env ]; then
    cp .env.example .env
    echo "📝 Created backend .env file - please configure as needed"
fi

cd ..

# Setup Frontend
echo "🔧 Setting up agriculture-ai-frontend..."
cd agriculture-ai-frontend

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install

# Copy environment file
if [ ! -f .env ]; then
    cp .env.example .env
    echo "📝 Created agriculture-ai-frontend .env file - please configure as needed"
fi

cd ..

echo "✅ Setup complete!"
echo ""
echo "🚀 To start the application:"
echo "1. Start backend: cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000"
echo "2. Start frontend: cd agriculture-ai-frontend && npm run dev"
echo ""
echo "📱 Access the frontend at: http://localhost:5173"
echo "📚 API documentation at: http://localhost:8000/docs"
echo ""
echo "⚠️  Important:"
echo "- Configure your .env files with API keys if needed"
echo "- Ensure all ML models are in the models/ directory"
echo "- Check that the backend is running before starting the frontend"