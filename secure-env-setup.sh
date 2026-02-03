#!/bin/bash

# ===========================================
# SECURE ENVIRONMENT SETUP SCRIPT
# ===========================================
# This script creates a secure .env file for your Finance AI application

echo "🔒 Setting up secure environment configuration..."

# Create secure .env file
cat > server/.env << 'EOF'
# ===========================================
# SECURE ENVIRONMENT CONFIGURATION
# ===========================================
# Generated on $(date)
# DO NOT commit this file to version control!

# Server Configuration
NODE_ENV=development
PORT=3000
API_VERSION=v1

# Database Configuration (SQLite for development)
DATABASE_URL="file:./prisma/dev.db"

# JWT Configuration - SECURE RANDOM SECRETS
JWT_SECRET=REMOVED_HISTORICAL_JWT_SECRET
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=REMOVED_HISTORICAL_JWT_REFRESH_SECRET
JWT_REFRESH_EXPIRES_IN=30d

# CORS Configuration
CORS_ORIGIN=http://localhost:5173,http://localhost:5174,http://localhost:5175
CORS_CREDENTIALS=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# OpenAI Configuration (Set your actual API key)
OPENAI_API_KEY=sk-your-actual-openai-api-key-here
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_MAX_TOKENS=500

# Stripe Configuration (Set your actual keys)
STRIPE_SECRET_KEY=sk_test_your_actual_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_actual_webhook_secret_here

# Email Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-actual-email@gmail.com
SMTP_PASS=your-actual-app-password

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# Redis Configuration (Optional)
REDIS_URL=redis://localhost:6379

# Security Headers
SECURITY_HEADERS=true
HELMET_ENABLED=true

# Session Configuration
SESSION_SECRET=29603f6847c71890856c8f686f38f61e36df70d57d77d472e6742342024483a9

# Encryption Configuration
ENCRYPTION_KEY=4f44b3b446e0fc733ab4cbc1befed98238632353ef38ae3bb87a7d49da32ed92
EOF

echo "✅ Secure .env file created successfully!"
echo ""
echo "🔑 Generated secure secrets:"
echo "   JWT_SECRET: REMOVED_HISTORICAL_JWT_SECRET"
echo "   JWT_REFRESH_SECRET: REMOVED_HISTORICAL_JWT_REFRESH_SECRET"
echo "   SESSION_SECRET: 29603f6847c71890856c8f686f38f61e36df70d57d77d472e6742342024483a9"
echo "   ENCRYPTION_KEY: 4f44b3b446e0fc733ab4cbc1befed98238632353ef38ae3bb87a7d49da32ed92"
echo ""
echo "⚠️  IMPORTANT:"
echo "   1. Set your actual API keys in the .env file"
echo "   2. Make sure .env is in your .gitignore"
echo "   3. Never commit secrets to version control"
echo ""
echo "🚀 Your environment is now secure!"



