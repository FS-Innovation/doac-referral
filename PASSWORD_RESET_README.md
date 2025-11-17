# Password Reset System - Quick Start

## 🚀 You now have an industry-leading password reset system!

This system includes:
- ✅ 6-digit email verification codes
- ✅ 10-minute expiration (auto-void)
- ✅ Resend code functionality (60s cooldown)
- ✅ Device fingerprinting security
- ✅ Rate limiting protection
- ✅ Beautiful email templates
- ✅ Smart code input with paste support
- ✅ Mobile-responsive UI

---

## Quick Deployment (3 Steps)

### Option A: Automated Setup (Recommended)

Run the interactive setup wizard:

```bash
./scripts/setup-password-reset.sh
```

This will guide you through:
1. Database migration
2. Email configuration
3. Deployment

### Option B: Manual Setup

1. **Database Migration:**
   ```bash
   gcloud sql connect doac-referral-db --user=postgres
   # Then paste SQL from: backend/migrations/add_password_reset_table.sql
   ```

2. **Email Setup (Gmail):**
   - Enable 2FA: https://myaccount.google.com/security
   - Create App Password: https://myaccount.google.com/apppasswords
   - Add to environment variables:
     ```env
     EMAIL_HOST=smtp.gmail.com
     EMAIL_PORT=587
     EMAIL_USER=your-email@gmail.com
     EMAIL_PASS=your-16-char-app-password
     ```

3. **Deploy:**
   ```bash
   # Backend
   cd backend
   npm install && npm run build
   # Deploy to your platform (Cloud Run, App Engine, etc.)

   # Frontend
   cd frontend
   npm install && npm run build
   firebase deploy --only hosting
   ```

---

## Testing the Flow

1. Open your app
2. Click "Forgot password?"
3. Enter your email
4. Check email for 6-digit code
5. Enter code (or paste it)
6. Set new password
7. Login with new password

---

## Files Modified

### Backend
- `src/controllers/authController.ts` - Password reset endpoints
- `src/routes/auth.ts` - New routes
- `src/middleware/rateLimiter.ts` - Rate limiting
- `src/services/emailService.ts` - Email templates
- `src/database/schema.sql` - New table

### Frontend
- `src/components/AuthModal.js` - Reset UI
- `src/services/api.js` - API methods
- `src/index.css` - Code input styling

### Database
- New table: `password_reset_tokens`
- Indexes for performance

---

## Environment Variables Required

```env
# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Database (Google Cloud SQL)
DB_HOST=your-cloud-sql-host
DB_NAME=doac-referral-db
DB_USER=postgres
DB_PASSWORD=your-db-password

# JWT Secret
JWT_SECRET=your-secret-key

# Environment
NODE_ENV=production
```

---

## Security Features

✅ **Cryptographically secure codes** - No sequential patterns
✅ **SHA-256 hashed storage** - Codes never stored in plaintext
✅ **10-minute expiration** - Automatic code voiding
✅ **One-time use** - Codes voided immediately after use
✅ **Device fingerprinting** - Must use from same device
✅ **Rate limiting** - Prevents brute force attacks
✅ **Email enumeration protection** - Generic responses
✅ **Timing attack prevention** - Crypto.timingSafeEqual
✅ **Code invalidation** - Old codes voided on resend

---

## Documentation

- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Complete deployment instructions
- **[PASSWORD_RESET_DOCUMENTATION.md](./PASSWORD_RESET_DOCUMENTATION.md)** - Technical implementation details
- **[backend/migrations/add_password_reset_table.sql](./backend/migrations/add_password_reset_table.sql)** - Database migration

---

## Troubleshooting

### Email not sending?
1. Check EMAIL_* environment variables are set
2. Verify Gmail app password is correct
3. Check backend logs for errors
4. Test SMTP: `telnet smtp.gmail.com 587`

### Database errors?
1. Verify migration ran successfully
2. Check DB_* environment variables
3. Test connection: `gcloud sql connect doac-referral-db --user=postgres`
4. Run: `\dt password_reset_tokens` to verify table exists

### Code not verifying?
1. Check code isn't expired (10 minutes)
2. Verify using same device that requested code
3. Request new code if needed
4. Check backend logs for detailed errors

---

## Support

For detailed help, see:
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Step-by-step deployment
- [PASSWORD_RESET_DOCUMENTATION.md](./PASSWORD_RESET_DOCUMENTATION.md) - Technical details

---

## Next Steps

1. ✅ Run database migration
2. ✅ Configure email service
3. ✅ Set environment variables
4. ✅ Deploy backend + frontend
5. ✅ Test password reset flow
6. ⚠️ Set up monitoring/alerts
7. ⚠️ Configure production email provider (SendGrid/AWS SES)

**You're ready to go! 🎉**
