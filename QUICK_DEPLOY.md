# Quick Deploy to Vercel - 5 Minutes

Follow these steps to get your app live quickly!

## 1. Create PostgreSQL Database (2 min)

### Using Vercel Postgres:
1. Go to [vercel.com](https://vercel.com) and login
2. Click "Storage" → "Create Database" → "Postgres"
3. Name it (e.g., "referral-db")
4. Click "Create"
5. Copy the connection string (looks like: `postgres://...`)

## 2. Push to GitHub (1 min)

```bash
cd /Users/isaac.martin/Desktop/doac-referral-link

git init
git add .
git commit -m "Initial commit"

# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/doac-referral.git
git push -u origin main
```

## 3. Deploy to Vercel (2 min)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click "Import" next to your GitHub repo
3. Click "Deploy"

## 4. Add Environment Variables

In Vercel project → Settings → Environment Variables, add:

```
DATABASE_URL=your-postgres-connection-string-from-step-1
JWT_SECRET=make-this-a-random-long-string-32-chars-minimum
FRONTEND_URL=https://your-app-name.vercel.app
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password
ADMIN_EMAIL=admin@example.com
DEFAULT_REDIRECT_URL=https://yourwebsite.com
REACT_APP_API_URL=https://your-app-name.vercel.app
```

## 5. Run Database Setup

```bash
# Update backend/.env with your production DATABASE_URL
cd backend
npm run migrate
```

## 6. Done! 🎉

Visit your Vercel URL and login:
- Email: `admin@example.com`
- Password: `admin123`

**⚠️ Change this password immediately!**

---

## If Something Goes Wrong

1. Check Vercel deployment logs
2. Verify all environment variables are set
3. Test database connection
4. Check that migrations ran successfully

Need help? The full guide is in `DEPLOYMENT.md`
