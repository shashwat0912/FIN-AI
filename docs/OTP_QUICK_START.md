# OTP Login - Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Start the Backend
```bash
cd server
npm install
npm run dev
```

Backend runs on: `http://localhost:3000`

### Step 2: Start the Frontend
```bash
cd ..
npm install
npm run dev
```

Frontend runs on: `http://localhost:5173`

### Step 3: Test the Login

1. Open `http://localhost:5173` in your browser
2. Enter an email or phone number:
   - Email: `test@example.com`
   - Phone: `9876543210`
3. Click "Send OTP"
4. **Check your terminal/console** for the OTP (in development mode, OTPs are printed to console)
5. Enter the 4-digit OTP
6. If you're a new user, enter your name
7. Click "Verify & Sign In"

---

## 📱 Supported Phone Formats

All these formats work:
- `9876543210`
- `+919876543210`
- `0919876543210`
- `91 9876543210`

---

## 🔑 Finding Your OTP (Development Mode)

### Backend Terminal
Look for output like this:
```
============================================================
📧 OTP EMAIL (SIMULATED)
============================================================
To: test@example.com
OTP: 1234
Valid for: 5 minutes
============================================================
```

or for phone:
```
============================================================
📱 OTP SMS (SIMULATED)
============================================================
To: +919876543210
Message: Your Finance AI login OTP is: 1234...
Valid for: 5 minutes
============================================================
```

---

## ⚙️ Enable Real Email Sending (Optional)

Edit `server/.env` and add:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

For Gmail App Password:
1. Go to Google Account → Security
2. Enable 2-Factor Authentication
3. Create an App Password
4. Use that password in `SMTP_PASS`

---

## 📱 Enable Real SMS Sending (Optional)

### Option 1: Twilio
1. Sign up at https://www.twilio.com
2. Get your Account SID, Auth Token, and Phone Number
3. Add to `server/.env`:
```env
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=your_number
```
4. Uncomment Twilio code in `server/src/services/notificationService.ts`

### Option 2: MSG91 (India)
1. Sign up at https://msg91.com
2. Get your Auth Key and Template ID
3. Add to `server/.env`:
```env
SMS_PROVIDER=msg91
MSG91_AUTH_KEY=your_key
MSG91_TEMPLATE_ID=your_template_id
```
4. Uncomment MSG91 code in `server/src/services/notificationService.ts`

---

## 🐛 Common Issues

### "Too many OTP requests"
- Wait 1 hour, or
- Clear rate limits: Delete records from `otp_rate_limits` table

### "OTP has expired"
- Request a new OTP (valid for 5 minutes only)

### "Invalid OTP"
- Check the OTP in your terminal/console
- Ensure you're entering all 4 digits correctly
- Maximum 3 attempts allowed

### Backend not starting
- Check if port 3000 is available
- Verify `server/.env` file exists
- Run `cd server && npm install`

### Frontend not starting
- Check if port 5173 is available
- Verify `node_modules` exists
- Run `npm install`

---

## 🎯 Key Features

✅ **No password required** - Just email or phone  
✅ **4-digit OTP** - Easy to remember and type  
✅ **5-minute validity** - Secure and time-limited  
✅ **Rate limiting** - Max 5 requests per hour  
✅ **Dark mode** - Beautiful UI in light and dark themes  
✅ **Responsive** - Works on mobile and desktop  
✅ **Secure** - OTPs are hashed, never stored in plain text  

---

## 📖 Need More Details?

See the complete documentation in `OTP_LOGIN_IMPLEMENTATION.md`

---

## 🎉 That's It!

You're now ready to use OTP-based authentication in Finance AI!

**Happy testing! 🚀**

