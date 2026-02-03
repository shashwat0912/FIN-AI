# Database Setup Guide

## Overview

The application uses **PostgreSQL** for production and supports **SQLite** for local development.

## Schema Compatibility

The Prisma schema is designed to work with both SQLite (development) and PostgreSQL (production):
- Uses `String` instead of enums (compatible with both)
- Uses standard data types that work in both databases
- All foreign keys and constraints are properly defined

## Production Database Setup

### Option 1: Using Docker Compose (Recommended)

1. **Start PostgreSQL container:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d postgres
   ```

2. **Set environment variable:**
   ```bash
   export DATABASE_URL="postgresql://financeai:changeme@localhost:5432/financeai?schema=public"
   ```

3. **Run migrations:**
   ```bash
   npm run db:migrate:deploy
   ```

4. **Verify migration:**
   ```bash
   npm run db:migrate:status
   ```

### Option 2: Using Managed PostgreSQL Service

1. **Create database** on your provider (AWS RDS, Heroku, etc.)

2. **Set DATABASE_URL** in your environment:
   ```bash
   DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"
   ```

3. **Run migrations:**
   ```bash
   npm run db:migrate:deploy
   ```

## Development Database Setup

For local development, you can use SQLite:

1. **Update schema.prisma temporarily:**
   ```prisma
   datasource db {
     provider = "sqlite"
     url      = "file:./dev.db"
   }
   ```

2. **Or use PostgreSQL locally:**
   - Use Docker Compose
   - Or install PostgreSQL locally

## Migration Files

### Initial Migration
- **Location**: `prisma/migrations/20250101000000_init/migration.sql`
- **Contains**: All table definitions, indexes, and foreign keys
- **Status**: Ready for production deployment

### Migration Commands

- **Development**: `npm run db:migrate` - Creates and applies migration
- **Production**: `npm run db:migrate:deploy` - Applies existing migrations
- **Status**: `npm run db:migrate:status` - Check migration status

## Database Schema

### Tables Created

1. **users** - User accounts and authentication
2. **refresh_tokens** - JWT refresh token storage
3. **transactions** - Financial transactions
4. **budgets** - Budget tracking
5. **goals** - Financial goals
6. **ai_sessions** - AI advice history

### Indexes Created

- `users.email` - Unique index for email
- `refresh_tokens.token` - Unique index for tokens
- `transactions.userId` - Index for user queries
- `transactions.date` - Index for date filtering
- `transactions.category` - Index for category filtering
- `budgets.userId` - Index for user queries
- `goals.userId` - Index for user queries
- `ai_sessions.userId` - Index for user queries
- `ai_sessions.createdAt` - Index for date sorting

### Foreign Keys

All foreign keys use `ON DELETE CASCADE` to maintain referential integrity:
- `refresh_tokens.userId` → `users.id`
- `transactions.userId` → `users.id`
- `budgets.userId` → `users.id`
- `goals.userId` → `users.id`
- `ai_sessions.userId` → `users.id`

## Data Types

- **String** - TEXT in PostgreSQL
- **Decimal** - DECIMAL(65,30) for precise financial calculations
- **Boolean** - BOOLEAN
- **DateTime** - TIMESTAMP(3) with millisecond precision

## Production Checklist

- [ ] PostgreSQL database created
- [ ] DATABASE_URL environment variable set
- [ ] Migrations deployed (`npm run db:migrate:deploy`)
- [ ] Migration status verified (`npm run db:migrate:status`)
- [ ] Database connection tested
- [ ] Backup strategy configured
- [ ] Connection pooling configured (if needed)

## Troubleshooting

### Migration Fails
- Check DATABASE_URL is correct
- Verify database exists and is accessible
- Check user has CREATE TABLE permissions

### Connection Issues
- Verify PostgreSQL is running
- Check firewall rules
- Verify credentials in DATABASE_URL

### Schema Mismatch
- Run `npm run db:generate` to regenerate Prisma client
- Check migration status
- Review migration SQL files

