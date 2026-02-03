# Full Stack Testing Guide - Frontend + Backend

## 🚀 Both Servers Running!

### Frontend (Vite + React)
- **URL**: http://localhost:5173
- **Status**: ✅ Running
- **Features**: Design tokens, dark mode, dashboard

### Backend (Express + TypeScript)
- **URL**: http://localhost:3000
- **Status**: ✅ Running  
- **Features**: REST API, Auth, Transactions, AI

---

## 🔗 Testing Full Stack Integration

### Test 1: Backend Health Check (1 minute)

**Test the API is running:**

1. Open a new terminal tab
2. Run:
```bash
curl http://localhost:3000/health
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-03T..."
}
```

Or visit in browser: http://localhost:3000/health

---

### Test 2: Frontend ↔ Backend Connection (2 minutes)

**Your app has a Backend Test component!**

1. Open http://localhost:5173 (Dashboard)
2. Look for "Backend Connection Test" section
3. Should show:
   - ✅ Backend Status: Connected
   - Server health info
   - Database connection status

**If you see this, full stack is working!** 🎉

---

### Test 3: Authentication Flow (3 minutes)

**Test Login/Register:**

1. Open http://localhost:5173
2. If not logged in, you'll see the login form
3. Try registering a new user:
   - Email: `test@example.com`
   - Password: `Test123!@#`
   - Phone: `+1234567890`

4. Backend should:
   - Create user in database
   - Generate JWT token
   - Return user data

5. Try logging in with same credentials

**Check browser console (F12) for API responses**

---

### Test 4: Transaction API (3 minutes)

**Test creating transactions:**

1. Once logged in, go to Dashboard
2. Click "Add Transaction" quick action
3. Should navigate to /transactions
4. Create a new transaction:
   - Amount: 5000
   - Type: Income
   - Category: Salary
   - Description: Test transaction

5. Backend should:
   - Save to database (SQLite)
   - Return transaction with ID
   - Update analytics

---

### Test 5: AI Advisor (3 minutes)

**Test AI integration:**

1. On Dashboard, look for "AI Advisor" card
2. Click to get AI advice
3. Backend should:
   - Fetch your transactions
   - Analyze spending patterns
   - Return AI suggestions

**Note:** Requires OpenAI API key in `.env`
- If not configured, you'll see mock/demo suggestions
- Check `server/.env` for `OPENAI_API_KEY`

---

## 📊 API Endpoints Available

### Health & Status
```bash
GET  http://localhost:3000/health
```

### Authentication
```bash
POST http://localhost:3000/api/v1/auth/register
POST http://localhost:3000/api/v1/auth/login
POST http://localhost:3000/api/v1/auth/refresh
POST http://localhost:3000/api/v1/auth/logout
```

### Transactions
```bash
GET    http://localhost:3000/api/v1/transactions
POST   http://localhost:3000/api/v1/transactions
GET    http://localhost:3000/api/v1/transactions/:id
PUT    http://localhost:3000/api/v1/transactions/:id
DELETE http://localhost:3000/api/v1/transactions/:id
GET    http://localhost:3000/api/v1/transactions/analytics/:days
```

### AI Advisor
```bash
POST http://localhost:3000/api/v1/ai/advice
POST http://localhost:3000/api/v1/ai/insights
```

---

## 🧪 Testing with cURL

### Example: Get Health Status
```bash
curl http://localhost:3000/health
```

### Example: Register New User
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
    "name": "Test User",
    "phone": "+1234567890"
  }'
```

### Example: Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'
```

### Example: Get Transactions (with auth token)
```bash
curl http://localhost:3000/api/v1/transactions \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🔍 Debugging Tools

### 1. Check Backend Logs

Backend logs are in:
```
/server/logs/combined.log
/server/logs/error.log
```

Or watch live in terminal where backend is running

### 2. Database Explorer

View your SQLite database:
```bash
cd server
npm run db:studio
```

Opens Prisma Studio at http://localhost:5555
- View all tables
- See user data
- Check transactions
- Edit data directly

### 3. Browser DevTools

**Frontend debugging:**
```
F12 or Cmd+Opt+I
→ Console: See API calls and responses
→ Network: Monitor API requests
→ Application: Check localStorage (auth tokens)
```

### 4. API Testing with Postman/Insomnia

Import these endpoints:
- Base URL: `http://localhost:3000`
- Add routes from API section above
- Set Authorization header: `Bearer <token>`

---

## 🐛 Common Issues & Solutions

### Issue: Backend not starting

**Error**: "Port 3000 already in use"

**Solution**:
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port in server/.env:
PORT=3001
```

---

### Issue: Database errors

**Error**: "Cannot find Prisma Client"

**Solution**:
```bash
cd server
npm run db:generate
npm run db:push
npm run dev
```

---

### Issue: CORS errors

**Error**: "CORS policy blocked"

**Check** `server/.env`:
```
CORS_ORIGIN=http://localhost:5173
CORS_CREDENTIALS=true
```

**Check** frontend is running on port 5173

---

### Issue: Authentication fails

**Error**: "Invalid token" or "Unauthorized"

**Solutions**:
1. Check JWT_SECRET is set in `server/.env`
2. Clear browser localStorage:
   ```javascript
   // In browser console:
   localStorage.clear()
   ```
3. Re-login to get fresh token
4. Check token expiry (default 7 days)

---

### Issue: AI features not working

**Error**: "OpenAI API error"

**Check**:
1. `server/.env` has `OPENAI_API_KEY`
2. API key is valid and has credits
3. Falls back to mock data if not configured

---

## 📈 Performance Monitoring

### Backend Performance

**Check logs for response times:**
```bash
tail -f server/logs/combined.log
```

Look for:
- API response times (should be < 100ms for most routes)
- Database query times
- Error rates

### Frontend Performance

**Browser DevTools → Performance tab:**
- Record page load
- Check for slow components
- Monitor re-renders

### Database Performance

**Monitor SQLite:**
```bash
cd server
npm run db:studio
```

Check:
- Number of records
- Query performance
- Index usage

---

## ✅ Full Stack Success Checklist

After testing, verify:

- [ ] Frontend loads at http://localhost:5173
- [ ] Backend responds at http://localhost:3000/health
- [ ] Backend Test component shows "Connected"
- [ ] Can register new user
- [ ] Can login successfully
- [ ] Auth token is stored
- [ ] Can create transaction
- [ ] Transaction appears in database
- [ ] AI advisor loads (or shows mock data)
- [ ] Dark mode works
- [ ] No console errors
- [ ] No CORS errors
- [ ] API calls are fast (< 500ms)

---

## 🎯 Real-World Testing Scenarios

### Scenario 1: New User Journey

1. ✅ Visit app → see login
2. ✅ Register new account
3. ✅ Auto-login after registration
4. ✅ See empty dashboard
5. ✅ Add first transaction
6. ✅ Dashboard updates with data
7. ✅ Get AI advice based on transaction

### Scenario 2: Returning User

1. ✅ Visit app
2. ✅ Already logged in (token persisted)
3. ✅ See dashboard with data
4. ✅ View transaction history
5. ✅ Get analytics for last 30 days
6. ✅ Logout → redirect to login

### Scenario 3: Mobile Responsive

1. ✅ Open DevTools
2. ✅ Toggle device toolbar
3. ✅ Test on iPhone/Android sizes
4. ✅ Sidebar works on mobile
5. ✅ Charts are responsive
6. ✅ Forms are usable

---

## 🚀 Advanced Testing

### Load Testing

**Test multiple concurrent users:**

```bash
# Install Apache Bench
brew install ab

# Test 100 requests, 10 concurrent
ab -n 100 -c 10 http://localhost:3000/health
```

### API Testing with Scripts

**Create test script:**

```bash
#!/bin/bash
# test-api.sh

# Register user
echo "Testing registration..."
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123!","name":"Tester"}'

# Login
echo "\nTesting login..."
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123!"}'
```

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────┐
│         Browser (localhost:5173)        │
│  ┌──────────────────────────────────┐   │
│  │   React + Vite Frontend          │   │
│  │   - Design Tokens ✅             │   │
│  │   - Dark Mode ✅                 │   │
│  │   - Dashboard Components         │   │
│  └──────────────────────────────────┘   │
└──────────────┬──────────────────────────┘
               │ HTTP/HTTPS
               │ API Calls
               ↓
┌─────────────────────────────────────────┐
│      Express Server (localhost:3000)    │
│  ┌──────────────────────────────────┐   │
│  │   REST API                       │   │
│  │   - Auth (JWT)                   │   │
│  │   - Transactions CRUD            │   │
│  │   - AI Advisor                   │   │
│  └──────────────────────────────────┘   │
└──────────────┬──────────────────────────┘
               │ Prisma ORM
               ↓
┌─────────────────────────────────────────┐
│     SQLite Database (dev.db)            │
│  - Users                                │
│  - Transactions                         │
│  - Sessions                             │
└─────────────────────────────────────────┘
```

---

## 🎉 You're Running Full Stack!

**Both servers are now running:**

1. **Frontend** (http://localhost:5173)
   - Design token system ✅
   - Dark mode ✅
   - Responsive UI ✅

2. **Backend** (http://localhost:3000)
   - REST API ✅
   - Authentication ✅
   - Database ✅
   - AI Integration ✅

**Test the full stack integration and let me know how it goes!** 🚀

---

## 📝 Next Steps

1. Test the backend connection in your browser
2. Try creating a user and logging in
3. Add some transactions
4. Check the AI advisor
5. Test both light and dark mode
6. Review the token system examples

**Everything should work seamlessly together!** ✨


