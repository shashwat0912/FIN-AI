# Fix Invalid Token Error

## Quick Fix

If you're getting "INVALID TOKEN" errors, follow these steps:

### Option 1: Clear tokens from browser console (Recommended)

1. Open your browser's Developer Console (F12 or Cmd+Option+I)
2. Run this command:
```javascript
clearTokens()
```
3. The page will automatically reload
4. Login again with your credentials

### Option 2: Clear localStorage manually

1. Open browser Developer Console (F12)
2. Run:
```javascript
localStorage.removeItem('accessToken');
localStorage.removeItem('refreshToken');
location.reload();
```

### Option 3: Clear all browser data

1. Open browser settings
2. Clear browsing data
3. Select "Cookies and other site data" and "Cached images and files"
4. Clear data for your localhost domain

## What Changed

I've added automatic token refresh handling to your API client. Now:

✅ **Automatic Token Refresh**: When a token expires, the app will automatically try to refresh it
✅ **Better Error Messages**: Clear error messages when tokens are invalid
✅ **Auto Token Cleanup**: Invalid tokens are automatically cleared
✅ **Console Helper**: `clearTokens()` function available in browser console

## How It Works

1. When you make an API request and get a 401 (Unauthorized) error
2. The app automatically tries to refresh your token using the refresh token
3. If refresh succeeds, it retries your original request
4. If refresh fails, it clears all tokens and asks you to login again

## Still Having Issues?

If the problem persists:

1. Make sure your backend is running on port 3000
2. Check that JWT_SECRET in backend .env matches what was used when tokens were created
3. Try creating a new account
4. Check browser console for any other errors

## Test Credentials

If you used the seed script, you can login with:
- Email: `test@example.com`
- Password: `password123`



