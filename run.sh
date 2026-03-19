#!/bin/bash

# Crowd Management System Startup Script

echo "🏙️ Starting Crowd Management System..."

# Check if Docker is available
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    echo "🐳 Docker detected. Starting with Docker Compose..."
    cd docker
    docker-compose up --build -d
    echo "✅ System started with Docker!"
    echo "📊 Frontend: http://localhost:3000"
    echo "🔌 API: http://localhost:8000"
    echo "📚 API Docs: http://localhost:8000/docs"
    echo "🗄️ PostgreSQL: localhost:5432"
    echo "🔄 Redis: localhost:6379"
else
    echo "🐍 Starting with local Python/Node.js..."

    # Start PostgreSQL and Redis with Docker if available
    if command -v docker &> /dev/null; then
        echo "🐳 Starting database services with Docker..."
        docker run -d --name postgres-crowd -p 5432:5432 -e POSTGRES_DB=crowd_management -e POSTGRES_USER=crowd_user -e POSTGRES_PASSWORD=crowd_pass postgres:15-alpine
        docker run -d --name redis-crowd -p 6379:6379 redis:7-alpine
        sleep 5
    fi

    # Start backend
    echo "🔧 Starting backend API..."
    cd backend
    if [ ! -d "venv" ]; then
        python -m venv venv
    fi
    source venv/bin/activate
    pip install -r requirements.txt
    uvicorn src.presentation.api.main:app --reload --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!

    # Start frontend
    echo "🌐 Starting frontend dashboard..."
    cd ../frontend
    npm install
    npm start &
    FRONTEND_PID=$!

    echo "✅ System started locally!"
    echo "📊 Frontend: http://localhost:3000"
    echo "🔌 API: http://localhost:8000"
    echo "📚 API Docs: http://localhost:8000/docs"

    # Wait for user input to stop
    echo "Press Ctrl+C to stop all services..."
    trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; docker stop postgres-crowd redis-crowd 2>/dev/null; exit" INT
    wait
fi