# Setup Guide

This guide will walk you through setting up the Referral Link System on your local machine.

## Prerequisites

Before you begin, make sure you have the following installed:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **PostgreSQL** (v13 or higher) - [Download here](https://www.postgresql.org/download/)
- **npm** or **yarn** (comes with Node.js)

## Step 1: Clone and Install Dependencies

```bash
# Navigate to the project directory
cd doac-referral-link

# Install all dependencies (root, backend, and frontend)
npm run install-all
```

This will install dependencies for:
- Root package (for running both servers concurrently)
- Backend (Express API)
- Frontend (React app)

## Step 2: Set Up PostgreSQL Database

### Create the Database

```bash
# Using psql (PostgreSQL command line)
psql -U postgres

# Inside psql, create the database
CREATE DATABASE referral_system;

# Exit psql
\q
```

Or using a GUI tool like pgAdmin:
1. Right-click on "Databases"
2. Select "Create" → "Database"
3. Name it `referral_system`

## Step 3: Configure Environment Variables

### Backend Environment Variables

Create a `.env` file in the `backend` directory:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your settings:

```env
# Database Configuration
DATABASE_URL=postgresql://your_username:your_password@localhost:5432/referral_system

# JWT Secret (use a strong random string)
JWT_SECRET=your-super-secret-jwt-key-change-this

# Server Configuration
PORT=5000
FRONTEND_URL=http://localhost:3000

# Email Configuration (for purchase notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password
ADMIN_EMAIL=admin@example.com

# Default redirect URL for referral links
DEFAULT_REDIRECT_URL=https://yourwebsite.com
```

#### Gmail Setup for Email Notifications (Optional)

If you want email notifications to work:

1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password:
   - Go to Google Account → Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
   - Use this password in `EMAIL_PASS`

Or skip email setup and notifications will be logged to console instead.

### Frontend Environment Variables

Create a `.env` file in the `frontend` directory:

```bash
cd ../frontend
cp .env.example .env
```

Edit `frontend/.env`:

```env
REACT_APP_API_URL=http://localhost:5000
```

## Step 4: Run Database Migrations

This will create all necessary tables and seed initial data:

```bash
cd backend
npm run migrate
```

This creates:
- All database tables
- Default admin account (email: admin@example.com, password: admin123)
- Sample products
- Default settings

**Important:** Change the default admin password after first login!

## Step 5: Start the Application

### Option 1: Run Both Servers Together (Recommended)

From the root directory:

```bash
npm run dev
```

This starts:
- Backend API on http://localhost:5000
- Frontend app on http://localhost:3000

### Option 2: Run Servers Separately

Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

Terminal 2 (Frontend):
```bash
cd frontend
npm start
```

## Step 6: Access the Application

1. Open your browser and go to: http://localhost:3000
2. Register a new account or login with admin credentials:
   - Email: `admin@example.com`
   - Password: `admin123`

## Testing the System

### As a Regular User

1. Register a new account
2. Go to Dashboard to see your unique referral link
3. Copy your referral link
4. Open it in a new incognito/private window
5. Watch your points increase!

### As an Admin

1. Login with admin credentials
2. Navigate to Admin → Product Management
3. Create, edit, or delete products
4. Go to Admin → Settings to change the global redirect URL
5. Check Admin → User Management to see all users and their stats

## Troubleshooting

### Database Connection Issues

**Error:** "Connection refused" or "ECONNREFUSED"

**Solution:**
- Make sure PostgreSQL is running: `pg_ctl status`
- Check your `DATABASE_URL` in `backend/.env`
- Verify database exists: `psql -l`

### Port Already in Use

**Error:** "Port 5000 (or 3000) is already in use"

**Solution:**
- Kill the process using the port: `lsof -ti:5000 | xargs kill` (Mac/Linux)
- Or change the port in `backend/.env` (for backend) or `frontend/.env` (for frontend)

### Migration Fails

**Error:** "relation already exists" or migration errors

**Solution:**
```bash
# Drop and recreate the database
psql -U postgres
DROP DATABASE referral_system;
CREATE DATABASE referral_system;
\q

# Run migrations again
cd backend
npm run migrate
```

### Frontend Can't Connect to Backend

**Error:** Network errors or CORS issues

**Solution:**
- Make sure backend is running on port 5000
- Check `FRONTEND_URL` in `backend/.env` is set to `http://localhost:3000`
- Check `REACT_APP_API_URL` in `frontend/.env` is set to `http://localhost:5000`

## Production Deployment

For production deployment, you'll need to:

1. **Build the frontend:**
   ```bash
   cd frontend
   npm run build
   ```

2. **Set production environment variables**

3. **Use a process manager like PM2:**
   ```bash
   npm install -g pm2
   pm2 start backend/dist/index.js --name referral-api
   ```

4. **Set up a reverse proxy (nginx or similar)**

5. **Use a proper PostgreSQL instance** (not localhost)

6. **Enable HTTPS** with SSL certificates

## Support

If you encounter any issues:
1. Check the console logs for error messages
2. Verify all environment variables are set correctly
3. Make sure PostgreSQL is running
4. Ensure you ran the migrations successfully

## Next Steps

- Change the default admin password
- Update the redirect URL in Admin → Settings
- Customize the product offerings
- Update styling in `frontend/src/index.css`
- Add your branding and logo

Enjoy your referral system!
