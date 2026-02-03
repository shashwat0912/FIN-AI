# OTP-Based Login Implementation - Complete Guide

## Overview

The Finance AI application has been successfully updated to use OTP-based authentication instead of traditional email/password login. Users can now log in using either their **Indian phone number** or **email address** by receiving a 4-digit OTP that is valid for 5 minutes.

---

## ✅ What's Been Implemented

### Backend Changes

#### 1. Database Schema Updates
- **New Tables:**
  - `otps`: Stores OTP records with hashed values, expiration times, and attempt tracking
  - `otp_rate_limits`: Tracks OTP request frequency to prevent abuse

#### 2. New Services

**OtpService** (`server/src/services/otpService.ts`)
- Generates 4-digit numeric OTPs
- Validates and normalizes Indian phone numbers (supports formats: 9876543210, +919876543210, 0919876543210)
- Validates email addresses
- Stores OTPs securely (hashed with bcrypt)
- Verifies OTPs with attempt tracking (max 3 attempts)
- Implements rate limiting (max 5 OTP requests per hour per identifier)
- Auto-expires OTPs after 5 minutes

**NotificationService** (`server/src/services/notificationService.ts`)
- Sends OTP via email (with beautiful HTML template)
- Sends OTP via SMS (placeholder implementation with integration instructions)
- Supports both simulated (development) and real (production) sending
- Includes clear instructions for integrating SMS providers (Twilio, AWS SNS, MSG91)

#### 3. API Endpoints

**POST /api/auth/send-otp**
- Request: `{ identifier: string }` (email or phone)
- Response: `{ type: 'email' | 'phone', identifier: string, expiresIn: 300 }`
- Validates identifier format
- Generates and stores OTP
- Sends OTP via email or SMS
- Enforces rate limiting

**POST /api/auth/verify-otp**
- Request: `{ identifier: string, otp: string, name?: string }`
- Response: `{ user: User, accessToken: string, refreshToken: string }`
- Verifies OTP
- Creates new user if doesn't exist (requires name)
- Generates JWT tokens
- Returns authenticated session

#### 4. Security Features
- ✅ OTPs are hashed before storage (never stored in plain text)
- ✅ Rate limiting: Max 5 OTP requests per hour per identifier
- ✅ Max 3 verification attempts per OTP
- ✅ OTPs expire after 5 minutes
- ✅ Used OTPs are immediately deleted
- ✅ Previous OTPs are invalidated when new one is requested

### Frontend Changes

#### 1. New OTP Login Component
**OtpLoginForm** (`src/components/OtpLoginForm.tsx`)
- Beautiful, modern UI matching the existing dark mode theme
- Two-step flow:
  1. Enter email or phone number
  2. Enter 4-digit OTP
- Real-time countdown timer showing OTP validity
- Resend OTP functionality
- Auto-detects new users and prompts for name
- Responsive design with smooth animations
- Clear error messaging

#### 2. Updated App Router
- Replaced `SimpleLoginForm` with `OtpLoginForm` in App.tsx
- Maintains same authentication flow and session management

#### 3. API Client Updates
- Added `sendOtp(identifier)` method
- Added `verifyOtp(identifier, otp, name?)` method
- Integrated with existing token management and session sync

---

## 📱 Phone Number Support

### Supported Formats
The system accepts Indian phone numbers in multiple formats:
- `9876543210` (10 digits starting with 6-9)
- `+919876543210` (with country code)
- `0919876543210` (with 00 prefix)
- `91 9876543210` (with spaces)
- `9876-543-210` (with dashes)

All formats are normalized to: `+91XXXXXXXXXX`

### Validation Rules
- Must be exactly 10 digits
- Must start with 6, 7, 8, or 9 (valid Indian mobile prefixes)
- Automatically strips spaces, dashes, and normalizes country code

---

## 📧 Email/SMS Integration

### Email (Ready to Use)
The system uses **nodemailer** for sending emails. To enable real email sending:

1. Configure SMTP settings in `server/.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

2. For Gmail, create an App Password:
   - Go to Google Account Settings → Security
   - Enable 2-Factor Authentication
   - Generate an App Password
   - Use that password in SMTP_PASS

**Development Mode:** Emails are simulated and OTPs are printed to console.

### SMS (Integration Required)
The SMS functionality is implemented with clear placeholders. To integrate a real SMS provider:

#### Option 1: Twilio (Popular globally)
```typescript
// In notificationService.ts, replace the placeholder with:
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

await client.messages.create({
  body: message,
  from: process.env.TWILIO_PHONE_NUMBER,
  to: phone
});
```

Add to `.env`:
```env
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_number
```

#### Option 2: MSG91 (Popular in India)
```typescript
const axios = require('axios');

await axios.get('https://api.msg91.com/api/v5/flow/', {
  params: {
    authkey: process.env.MSG91_AUTH_KEY,
    mobile: phone.replace('+91', ''),
    otp: otp,
    template_id: process.env.MSG91_TEMPLATE_ID
  }
});
```

Add to `.env`:
```env
SMS_PROVIDER=msg91
MSG91_AUTH_KEY=your_auth_key
MSG91_TEMPLATE_ID=your_template_id
```

#### Option 3: AWS SNS
```typescript
const AWS = require('aws-sdk');
const sns = new AWS.SNS();

await sns.publish({
  Message: message,
  PhoneNumber: phone,
  MessageAttributes: {
    'AWS.SNS.SMS.SMSType': {
      DataType: 'String',
      StringValue: 'Transactional'
    }
  }
}).promise();
```

**Development Mode:** SMS messages are simulated and OTPs are printed to console.

---

## 🧪 Testing

### Running Tests
```bash
cd server
npm test tests/otp.test.ts
```

### Test Coverage
- ✅ Phone number validation (all formats)
- ✅ Email validation
- ✅ Identifier type detection
- ✅ OTP generation and storage
- ✅ OTP verification (success and failure cases)
- ✅ Expiration handling
- ✅ Attempt tracking
- ✅ Rate limiting
- ✅ Notification service (simulated)

---

## 🚀 Running the Application

### 1. Start the Backend
```bash
cd server
npm install
npm run dev
```

The backend will run on `http://localhost:3000`

### 2. Start the Frontend
```bash
cd ..
npm install
npm run dev
```

The frontend will run on `http://localhost:5173`

### 3. Test the OTP Login

#### Using Email:
1. Enter any email address (e.g., `test@example.com`)
2. Click "Send OTP"
3. Check the console output for the OTP (in development mode)
4. Enter the 4-digit OTP
5. If it's a new user, enter your name
6. Click "Verify & Sign In"

#### Using Phone:
1. Enter an Indian phone number (e.g., `9876543210`)
2. Click "Send OTP"
3. Check the console output for the OTP (in development mode)
4. Enter the 4-digit OTP
5. If it's a new user, enter your name
6. Click "Verify & Sign In"

---

## 🔐 Security Considerations

### Implemented
- ✅ OTPs are hashed before storage
- ✅ Rate limiting prevents brute force attacks
- ✅ OTPs expire after 5 minutes
- ✅ Maximum 3 verification attempts
- ✅ Used OTPs are immediately deleted
- ✅ CSRF protection maintained
- ✅ JWT token authentication
- ✅ Secure session management

### Production Recommendations
1. **Enable HTTPS** - Essential for production
2. **Configure Real Email/SMS** - Set up proper SMTP and SMS providers
3. **Monitor Rate Limits** - Adjust based on usage patterns
4. **Set Up Logging** - Track OTP requests and failures
5. **Add Captcha** - Consider adding captcha for additional security
6. **Implement 2FA** - For high-security operations
7. **Regular Security Audits** - Review and update security measures

---

## 📝 Database Migrations

The database has been updated with new tables. If you need to reset:

```bash
cd server
npx prisma db push
```

This will sync your database with the updated schema.

---

## 🎨 UI/UX Features

### Login Flow
1. **Step 1: Identifier Entry**
   - Single input field for email or phone
   - Helper text: "Enter your email or Indian phone number"
   - Real-time validation
   - Beautiful gradient background with animated orbs

2. **Step 2: OTP Verification**
   - 4-digit OTP input (numeric only)
   - Countdown timer showing remaining validity
   - Resend OTP button
   - Back button to change identifier
   - Auto-prompts for name if new user

### Design Elements
- ✅ Dark mode support
- ✅ Smooth animations and transitions
- ✅ Responsive design (mobile-friendly)
- ✅ Clear error messages
- ✅ Loading states
- ✅ Premium gradient styling
- ✅ Glass morphism effects

---

## 🔄 Backward Compatibility

### Existing Users
- Users with existing password-based accounts can still use those credentials if needed
- The old login endpoints (`/auth/login`, `/auth/register`) remain functional
- Password-related functionality is preserved in the backend for backward compatibility

### Migration Path
If you want to force all users to OTP-based login:
1. Remove password fields from the UI (already done)
2. Optionally deprecate password endpoints in the future
3. Communicate the change to existing users

---

## 📊 Monitoring and Logs

### What to Monitor
- OTP request frequency (detect abuse)
- Failed verification attempts
- Rate limit hits
- Email/SMS delivery failures
- User registration patterns

### Log Locations
- Backend logs: `server/logs/combined.log`
- Error logs: `server/logs/error.log`
- Console output: OTP values (development only)

---

## 🐛 Troubleshooting

### OTP Not Received
**Email:**
- Check SMTP configuration in `.env`
- Verify email address is valid
- Check spam/junk folder
- In development, check console output

**SMS:**
- Verify SMS provider is configured
- Check phone number format
- Ensure SMS provider has sufficient credits
- In development, check console output

### Rate Limit Errors
- Wait for the rate limit window to expire (1 hour)
- Clear rate limit records from database if needed:
  ```sql
  DELETE FROM otp_rate_limits WHERE identifier = 'your-identifier';
  ```

### OTP Expired
- Request a new OTP
- OTPs are valid for exactly 5 minutes

### Verification Failed
- Ensure OTP is entered correctly (4 digits)
- Check if OTP has expired
- Maximum 3 attempts allowed per OTP

---

## 📦 Dependencies Added

### Backend
- `nodemailer` - Email sending
- `@types/nodemailer` - TypeScript types for nodemailer

### Frontend
- No new dependencies (uses existing React, TypeScript, Tailwind CSS)

---

## 🎯 Next Steps (Optional Enhancements)

1. **SMS Provider Integration**
   - Choose and integrate a real SMS provider (Twilio, MSG91, AWS SNS)
   - Test with real phone numbers

2. **Email Template Customization**
   - Customize the OTP email template with your branding
   - Add company logo and colors

3. **Analytics**
   - Track OTP success rates
   - Monitor user registration patterns
   - Analyze login methods (email vs phone)

4. **Additional Security**
   - Add captcha for OTP requests
   - Implement device fingerprinting
   - Add suspicious activity detection

5. **User Experience**
   - Add "Remember this device" option
   - Implement biometric authentication for mobile
   - Add social login options (Google, Apple)

---

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the console logs for detailed error messages
3. Verify all environment variables are set correctly
4. Ensure database migrations have been applied

---

## ✨ Summary

The OTP-based login system is now fully functional and ready for use. The implementation includes:

- ✅ Complete backend API with OTP generation, validation, and verification
- ✅ Beautiful, responsive frontend UI
- ✅ Support for both email and Indian phone numbers
- ✅ Comprehensive security measures
- ✅ Rate limiting and abuse prevention
- ✅ Email sending capability (ready to use)
- ✅ SMS sending framework (ready for integration)
- ✅ Comprehensive test suite
- ✅ Full TypeScript support
- ✅ Dark mode support
- ✅ Production-ready architecture

The system is designed to be secure, user-friendly, and easy to maintain. All code follows best practices and includes proper error handling, validation, and security measures.

**Happy coding! 🚀**

