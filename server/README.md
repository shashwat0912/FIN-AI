# Finance AI Backend

A production-ready, scalable backend API for the Finance AI Dashboard built with Node.js, TypeScript, Express, and PostgreSQL.

## 🚀 Features

- **Authentication & Authorization**: JWT-based auth with refresh tokens
- **Transaction Management**: CRUD operations with categorization and analytics
- **AI Integration**: Financial advice with usage tracking and rate limiting
- **Budget Tracking**: Monthly/yearly budget management
- **Goal Management**: Financial goals with progress tracking
- **Security**: Rate limiting, CORS, input validation, error handling
- **Database**: PostgreSQL with Prisma ORM
- **Testing**: Comprehensive test suite with Vitest
- **Docker**: Containerized with Docker Compose
- **Logging**: Structured logging with Winston
- **API Versioning**: v1 API with clear versioning

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL 15+
- Docker & Docker Compose (optional)

## 🛠️ Installation

### Option 1: Local Development

1. **Clone and navigate to the server directory:**
   ```bash
   cd server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   NODE_ENV=development
   PORT=3000
   DATABASE_URL="postgresql://username:password@localhost:5432/finance_ai_db?schema=public"
   JWT_SECRET=your-super-secret-jwt-key
   JWT_REFRESH_SECRET=your-super-secret-refresh-key
   CORS_ORIGIN=http://localhost:5173
   ```

4. **Set up the database:**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Run database migrations
   npm run db:migrate
   
   # Seed the database with test data
   npm run db:seed
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

### Option 2: Docker Compose (Recommended)

1. **Navigate to the server directory:**
   ```bash
   cd server
   ```

2. **Start all services:**
   ```bash
   docker-compose up -d
   ```

3. **Run database migrations:**
   ```bash
   docker-compose exec api npm run db:migrate
   ```

4. **Seed the database:**
   ```bash
   docker-compose exec api npm run db:seed
   ```

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login user | No |
| POST | `/auth/refresh-token` | Refresh access token | No |
| POST | `/auth/logout` | Logout user | Yes |
| POST | `/auth/logout-all` | Logout all sessions | Yes |

### Transaction Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/transactions` | Get user transactions | Yes |
| POST | `/transactions` | Create transaction | Yes |
| GET | `/transactions/:id` | Get transaction by ID | Yes |
| PUT | `/transactions/:id` | Update transaction | Yes |
| DELETE | `/transactions/:id` | Delete transaction | Yes |
| GET | `/transactions/analytics` | Get transaction analytics | Yes |
| GET | `/transactions/categories` | Get transaction categories | Yes |

### AI Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/ai/advice` | Get AI financial advice | Yes |
| GET | `/ai/history` | Get AI conversation history | Yes |
| DELETE | `/ai/sessions/:id` | Delete AI session | Yes |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | API health status |

## 🔧 Available Scripts

```bash
# Development
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm start           # Start production server

# Database
npm run db:generate # Generate Prisma client
npm run db:push     # Push schema to database
npm run db:migrate  # Run database migrations
npm run db:seed     # Seed database with test data
npm run db:studio   # Open Prisma Studio

# Testing
npm test            # Run tests
npm run test:coverage # Run tests with coverage

# Code Quality
npm run lint        # Run ESLint
npm run lint:fix    # Fix ESLint errors
npm run format      # Format code with Prettier
```

## 🧪 Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test tests/auth.test.ts
```

## 🐳 Docker

### Build and run with Docker Compose:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down

# Rebuild and start
docker-compose up --build -d
```

### Individual Docker commands:

```bash
# Build image
docker build -t finance-ai-backend .

# Run container
docker run -p 3000:3000 --env-file .env finance-ai-backend
```

## 📊 Database Schema

The application uses PostgreSQL with the following main entities:

- **Users**: User accounts with authentication
- **Transactions**: Financial transactions (income/expenses)
- **Budgets**: Budget tracking and management
- **Goals**: Financial goals and progress
- **AiSessions**: AI conversation history
- **RefreshTokens**: JWT refresh token management

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Prevents API abuse
- **Input Validation**: Joi schema validation
- **CORS Protection**: Configurable cross-origin requests
- **Helmet**: Security headers
- **Error Handling**: Structured error responses
- **Logging**: Comprehensive request/error logging

## 🌐 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `JWT_SECRET` | JWT signing secret | Required |
| `JWT_REFRESH_SECRET` | Refresh token secret | Required |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:5173` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `900000` (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |

## 🚀 Deployment

### Production Checklist

1. Set `NODE_ENV=production`
2. Use strong, unique JWT secrets
3. Configure proper CORS origins
4. Set up database backups
5. Configure monitoring and logging
6. Use HTTPS in production
7. Set up proper firewall rules

### Cloud Deployment

The application is ready for deployment on:
- **AWS**: ECS, EKS, or EC2
- **Google Cloud**: Cloud Run, GKE
- **Azure**: Container Instances, AKS
- **DigitalOcean**: App Platform, Droplets
- **Heroku**: Container deployment
- **Railway**: Direct deployment

## 📝 API Examples

### Register User
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "John Doe"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### Create Transaction
```bash
curl -X POST http://localhost:3000/api/v1/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "amount": 1000,
    "description": "Salary",
    "category": "Income",
    "type": "INCOME",
    "date": "2024-01-01T00:00:00Z"
  }'
```

### Get AI Advice
```bash
curl -X POST http://localhost:3000/api/v1/ai/advice \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "query": "How should I budget my monthly income?",
    "context": {
      "monthlyIncome": 5000,
      "monthlyExpenses": 3000
    }
  }'
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Run the test suite
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the API documentation
- Review the test files for usage examples

---

**Built with ❤️ for the Finance AI Dashboard**
