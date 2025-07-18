#!/bin/bash

# Deployment script for IT Infrastructure Management Bot
# This script simplifies deployment on external servers

echo "🚀 Starting deployment of IT Infrastructure Management Bot..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm and try again."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  Creating .env file..."
    cat > .env << EOL
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/database_name

# Telegram Bot Configuration
BOT_TOKEN=your_telegram_bot_token_here

# Session Configuration
SESSION_SECRET=your_session_secret_here

# Server Configuration
PORT=5000
NODE_ENV=production
EOL
    echo "✅ .env file created. Please update it with your actual values."
    echo "📝 Edit .env file and run this script again."
    exit 1
fi

# Source .env file
export $(cat .env | grep -v ^# | xargs)

# Check if required environment variables are set
if [ -z "$DATABASE_URL" ] || [ "$DATABASE_URL" = "postgresql://username:password@localhost:5432/database_name" ]; then
    echo "❌ DATABASE_URL is not configured in .env file"
    exit 1
fi

# Build the application
echo "🔨 Building application..."
npm run build || {
    echo "❌ Build failed"
    exit 1
}

# Push database schema
echo "🗄️  Setting up database schema..."
npm run db:push || {
    echo "❌ Database schema setup failed"
    exit 1
}

# Seed database
echo "🌱 Seeding database with initial data..."
npm run db:seed || {
    echo "❌ Database seeding failed"
    exit 1
}

# Create admin user
echo "👤 Creating admin user..."
npm run create-admin -- --username=admin --password=admin123 --domain=localhost || {
    echo "⚠️  Admin user creation failed or user already exists"
}

echo "✅ Deployment completed successfully!"
echo ""
echo "🎉 Your IT Infrastructure Management Bot is ready!"
echo ""
echo "📋 Next steps:"
echo "1. Start the application: npm start"
echo "2. Access admin panel: http://localhost:5000"
echo "3. Login with: username=admin, password=admin123"
echo "4. Configure Telegram bot token in Settings"
echo ""
echo "🔧 Admin credentials:"
echo "   Username: admin"
echo "   Password: admin123"
echo ""