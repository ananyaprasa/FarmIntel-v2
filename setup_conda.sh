#!/bin/bash

# AgriAI Assistant Setup Script for Conda Environment
# This script sets up the complete agricultural AI system using existing conda env

echo "🌾 Setting up AgriAI Assistant with Conda Environment..."

# Check if conda is available
if ! command -v conda &> /dev/null; then
    echo "❌ Conda is not installed or not in PATH"
    exit 1
fi

# Check if ml environment exists
if ! conda env list | grep -q "ml"; then
    echo "❌ Conda environment 'ml' not found"
    echo "Available environments:"
    conda env list
    exit 1
fi

echo "✅ Conda environment 'ml' found"

# Activate conda environment
echo "🔧 Activating conda environment 'ml'..."
source $(conda info --base)/etc/profile.d/conda.sh
conda activate ml

# Check Python version
python_version=$(python --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
required_version="3.8"

if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]; then
    echo "❌ Python 3.8+ is required. Found: $python_version"
    exit 1
fi

echo "✅ Python version check passed: $python_version"

# Install Python dependencies in conda environment
echo "📦 Installing Python dependencies in conda environment..."
pip install fastapi uvicorn python-multipart pydantic scikit-learn numpy pandas Pillow torch torchvision openai python-dotenv

# Check Node.js version
if command -v node &> /dev/null; then
    node_version=$(node --version 2>&1 | sed 's/v//')
    required_node="16.0.0"
    
    if [ "$(printf '%s\n' "$required_node" "$node_version" | sort -V | head -n1)" != "$required_node" ]; then
        echo "⚠️  Node.js 16+ is recommended. Found: $node_version"
    else
        echo "✅ Node.js version check passed: $node_version"
    fi
else
    echo "⚠️  Node.js not found - frontend development server won't work"
fi

# Setup Frontend
echo "🔧 Setting up agriculture-ai-frontend..."
cd agriculture-ai-frontend

# Install Node.js dependencies if npm is available
if command -v npm &> /dev/null; then
    echo "Installing Node.js dependencies..."
    npm install
else
    echo "⚠️  npm not found - please install Node.js for frontend development"
fi

cd ..

echo "✅ Setup complete!"
echo ""
echo "🚀 To start the application:"
echo "1. Activate conda environment: conda activate ml"
echo "2. Start backend: cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000"
echo "3. Start frontend: cd agriculture-ai-frontend && npm run dev (if Node.js is available)"
echo ""
echo "📱 Access the frontend at: http://localhost:5173"
echo "📚 API documentation at: http://localhost:8000/docs"
echo ""
echo "⚠️  Important:"
echo "- Ensure your Groq API key is set in the environment: export GROQ_API_KEY='your-key'"
echo "- All ML models should be in the models/ directory"
echo "- Use conda activate ml before running the backend"