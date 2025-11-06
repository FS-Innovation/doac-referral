# Deploying to Vercel

This guide will walk you through deploying your referral system to Vercel.

## Prerequisites

1. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
2. **GitHub Account** - To connect your repository
3. **PostgreSQL Database** - You'll need a hosted database

## Step 1: Set Up PostgreSQL Database

You have several options:

### Option A: Vercel Postgres (Recommended)
1. Go to your Vercel dashboard
2. Click "Storage" → "Create Database" → "Postgres"
3. Follow the setup wizard
4. Save the connection string

### Option B: Supabase (Free Tier Available)
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Get the PostgreSQL connection string from Settings → Database
4. Format: `postgresql://postgres:[password]@[host]:5432/postgres`

### Option C: Railway (Free Tier Available)
1. Go to [railway.app](https://railway.app)
2. Create a new PostgreSQL database
3. Get the connection string from the database settings

## Step 2: Push Code to GitHub

```bash
cd /Users/isaac.martin/Desktop/doac-referral-link

# Initialize git repository
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - DOAC Referral System"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

## Step 3: Deploy to Vercel

### Easy Way (Recommended):

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Vercel will auto-detect the project settings

### Configure Environment Variables:

In your Vercel project settings, add these environment variables:

**Backend Variables:**
```
DATABASE_URL=postgresql://user:password@host:5432/database
JWT_SECRET=your-random-secret-key-minimum-32-characters
FRONTEND_URL=https://your-vercel-app.vercel.app
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
ADMIN_EMAIL=admin@example.com
DEFAULT_REDIRECT_URL=https://yourwebsite.com
```

**Frontend Variables:**
```
REACT_APP_API_URL=https://your-vercel-app.vercel.app
```

## Step 4: Run Database Migrations

After deploying, you need to set up your database:

### Option A: Run Locally Against Production DB

```bash
# Temporarily update backend/.env with production DATABASE_URL
cd backend
npm run migrate
```

### Option B: Use Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Run migration
vercel env pull
cd backend && npm run migrate
```

## Step 5: Verify Deployment

1. Visit your Vercel URL
2. Try creating an account
3. Test the referral link system
4. Login as admin (admin@example.com / admin123) and change password

## Important Notes

### Build Settings for Vercel:

If auto-detection doesn't work, manually configure:

**Root Directory:** Leave empty or set to `/`

**Framework Preset:** Other

**Build Command:**
```
cd backend && npm install && cd ../frontend && npm install && npm run build
```

**Output Directory:** `frontend/build`

**Install Command:**
```
npm install && cd backend && npm install && cd ../frontend && npm install
```

### Custom Domain

1. Go to your Vercel project settings
2. Click "Domains"
3. Add your custom domain
4. Update DNS records as instructed
5. Update `FRONTEND_URL` environment variable

### Security Reminders

1. ✅ Change the default admin password immediately
2. ✅ Use a strong JWT_SECRET (32+ characters)
3. ✅ Never commit `.env` files to git
4. ✅ Set up proper CORS in production
5. ✅ Enable SSL/HTTPS (Vercel does this automatically)

## Troubleshooting

### Build Fails
- Check that all environment variables are set
- Verify PostgreSQL connection string is correct
- Check build logs in Vercel dashboard

### API Not Working
- Ensure environment variables are set correctly
- Check that DATABASE_URL includes the correct database name
- Verify serverless functions are deployed

### Database Connection Issues
- Check if your database allows connections from Vercel's IP ranges
- Verify connection string format
- Ensure database is running and accessible

## Alternative: Split Deployment

If you prefer to deploy frontend and backend separately:

### Frontend Only to Vercel:
1. Deploy only the `frontend` folder
2. Point `REACT_APP_API_URL` to your backend URL

### Backend to Railway/Render:
1. Deploy backend to Railway, Render, or Heroku
2. Set up PostgreSQL on the same platform
3. Update frontend's `REACT_APP_API_URL`

## Cost Estimates

- **Vercel Free Tier:** Sufficient for small to medium traffic
- **Vercel Postgres:** $0.28/GB storage, $0.102/GB transfer (or use free tier)
- **Supabase Free Tier:** 500MB database, 2GB transfer
- **Railway Free Tier:** 500 hours/month, $5 credit

## Support

For issues with:
- **Vercel:** [vercel.com/support](https://vercel.com/support)
- **This App:** Check the logs in Vercel dashboard

Good luck with your deployment! 🚀
