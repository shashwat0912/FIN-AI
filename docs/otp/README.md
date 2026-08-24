# OTP authentication

Finance AI supports email addresses and Indian phone numbers as login
identifiers. The backend stores hashed, expiring one-time codes, applies request
and verification limits, and issues access and refresh tokens after successful
verification.

## Local development

In non-production environments, delivery is simulated and the API may return a
development-only OTP for the frontend to use. Start the normal local stack and
open `/login`; no external provider is required.

Email delivery uses SMTP when `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and
`SMTP_PASS` are configured. Production fails closed when email delivery is not
available.

Phone-number parsing is implemented, but a production SMS provider is not.
Production phone OTP requests therefore fail closed until an audited provider
is integrated. Do not add provider credentials to source control.

Relevant implementation:

- `backend/src/services/otpService.ts`
- `backend/src/services/notificationService.ts`
- `backend/src/routes/auth.ts`
- `frontend/components/OtpLoginForm.tsx`
