# Local Development Setup

This guide will help you get the DOAC Referral System running locally for development and testing.

## Prerequisites

Make sure you have these installed:
- Node.js (v16 or higher)
- Docker Desktop
- npm or yarn

## Quick Start (5 minutes)

### 1. Install Dependencies

```bash
npm run install-all
```

This will install dependencies for the root project, backend, and frontend.

### 2. Start Database & Redis

```bash
docker-compose up -d
```

This starts PostgreSQL and Redis in Docker containers. The `-d` flag runs them in the background.

**Check if they're running:**
```bash
docker-compose ps
```

You should see both `doac-postgres` and `doac-redis` with status "Up".

### 3. Run Database Migrations

```bash
cd backend
npm run migrate
```

This creates all the database tables and inserts default data including an admin account.

### 4. Start the Application

From the root directory:
```bash
npm run dev
```

This starts both the backend and frontend servers concurrently.

**URLs:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## Default Admin Account

After running migrations, you can log in with:
- **Email:** admin@example.com
- **Password:** admin123

**Important:** Change this password after first login!

## Development Workflow

### Starting Your Dev Environment

```bash
# Start databases
docker-compose up -d

# Start app (in another terminal)
npm run dev
```

### Stopping Everything

```bash
# Stop the app (Ctrl+C in the terminal where npm run dev is running)

# Stop databases
docker-compose down
```

### Restart Databases (if needed)

```bash
docker-compose restart
```

### View Database Logs

```bash
docker-compose logs postgres
```

### View Redis Logs

```bash
docker-compose logs redis
```

## Making Changes

### Backend Changes

The backend uses `ts-node-dev` which automatically restarts when you save files.

Just edit files in `backend/src/` and save - changes will be live!

### Frontend Changes

The frontend uses React's development server with hot reload.

Just edit files in `frontend/src/` and save - changes will appear immediately!

### Database Schema Changes

If you modify the database schema in `backend/src/database/schema.sql`:

```bash
# Reset the database
docker-compose down -v
docker-compose up -d

# Wait a few seconds for DB to be ready
sleep 5

# Run migrations again
cd backend
npm run migrate
```

**Warning:** This deletes all data! Only do this in development.

## Connecting to the Database

### Using Docker

```bash
docker exec -it doac-postgres psql -U doac_user -d referral_system
```

Common queries:
```sql
-- View all users
SELECT id, email, username, points, is_admin FROM users;

-- View all referral codes
SELECT u.username, r.code, r.total_clicks, r.total_points
FROM referrals r
JOIN users u ON r.user_id = u.id;

-- View all products
SELECT * FROM products;

-- Exit
\q
```

### Using a GUI Tool

You can also use tools like:
- [pgAdmin](https://www.pgadmin.org/)
- [TablePlus](https://tableplus.com/)
- [DBeaver](https://dbeaver.io/)

**Connection details:**
- Host: localhost
- Port: 5432
- Database: referral_system
- Username: doac_user
- Password: doac_password

## Connecting to Redis

### Using Redis CLI

```bash
docker exec -it doac-redis redis-cli
```

Common commands:
```redis
# View all keys
KEYS *

# Get a value
GET key_name

# View all rate limit keys
KEYS *rate-limit*

# Exit
exit
```

## Testing the Application

### 1. Register a New User

1. Go to http://localhost:3000
2. Click "Register"
3. Fill in the form
4. Submit

### 2. Get Your Referral Link

1. Log in with your new account
2. Go to Dashboard
3. Copy your referral link

### 3. Test Referral Click

1. Open the referral link in a new incognito/private window
2. You should be redirected
3. Check your dashboard - you should see 1 click and points awarded!

### 4. Test the Admin Panel

1. Log out
2. Log in as admin (admin@example.com / admin123)
3. Go to Admin Dashboard
4. Create a product
5. View all users and their stats

### 5. Test Product Purchase

1. Log in as a regular user
2. Make sure you have enough points (click your own referral link in incognito)
3. Go to Products
4. Purchase a product
5. Check that your points decreased

## Environment Variables

### Backend (.env)

Already configured in `backend/.env`:

```bash
# Database
DATABASE_URL=postgresql://doac_user:doac_password@localhost:5432/referral_system

# JWT Secret
JWT_SECRET=dev-secret-key-change-in-production-abc123xyz789

# Server
PORT=5000
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Redis
REDIS_URL=redis://localhost:6379

# Email (optional - leave empty for dev)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=
ADMIN_EMAIL=admin@example.com

# Default redirect for referral links
DEFAULT_REDIRECT_URL=http://localhost:3000/welcome
```

### Frontend (.env)

Already configured in `frontend/.env`:

```bash
REACT_APP_API_URL=http://localhost:5000
```

## Troubleshooting

### Port Already in Use

If you see "Port 5432 already in use" or "Port 6379 already in use":

```bash
# Check what's using the ports
lsof -i :5432
lsof -i :6379

# Stop the conflicting service or change the port in docker-compose.yml
```

### Database Connection Failed

```bash
# Make sure PostgreSQL is running
docker-compose ps

# Check the logs
docker-compose logs postgres

# Restart the database
docker-compose restart postgres

# Wait a few seconds before running migrations
sleep 5
```

### Cannot Connect to Redis

```bash
# Check if Redis is running
docker-compose ps

# Check the logs
docker-compose logs redis

# Restart Redis
docker-compose restart redis
```

### Frontend Won't Load

```bash
# Make sure backend is running
curl http://localhost:5000/health

# Check if frontend is running on the right port
# Should be http://localhost:3000

# Try clearing npm cache and reinstalling
cd frontend
rm -rf node_modules package-lock.json
npm install
npm start
```

### Backend Won't Start

```bash
# Check for TypeScript errors
cd backend
npm run build

# Try reinstalling dependencies
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Migration Errors

```bash
# Reset the database completely
docker-compose down -v
docker-compose up -d

# Wait for DB to be ready
sleep 10

# Run migrations
cd backend
npm run migrate
```

## Clean Slate (Complete Reset)

If you want to start fresh:

```bash
# Stop everything
docker-compose down -v

# Remove node_modules
rm -rf node_modules backend/node_modules frontend/node_modules

# Reinstall everything
npm run install-all

# Start fresh
docker-compose up -d
sleep 10
cd backend && npm run migrate && cd ..
npm run dev
```

## Common Development Tasks

### Add a New API Endpoint

1. Create/update controller in `backend/src/controllers/`
2. Add route in `backend/src/routes/`
3. The server will auto-restart
4. Test at http://localhost:5000/api/your-endpoint

### Add a New Frontend Page

1. Create component in `frontend/src/pages/`
2. Add route in `frontend/src/App.js`
3. Changes will hot-reload automatically

### Modify the Database Schema

1. Edit `backend/src/database/schema.sql`
2. Reset database: `docker-compose down -v && docker-compose up -d`
3. Run migrations: `cd backend && npm run migrate`

### Test Rate Limiting

The backend includes rate limiting for API protection:

```bash
# Make multiple rapid requests
for i in {1..10}; do curl http://localhost:5000/api/products; done
```

You should see rate limit responses after a few requests.

### Test Fraud Detection

Try clicking the same referral link multiple times rapidly:

```bash
# Get your referral code first, then:
for i in {1..5}; do curl "http://localhost:5000/api/referral/YOUR_CODE"; done
```

The fraud detection should block repeated clicks from the same IP.

## VS Code Tips

### Recommended Extensions

- ESLint
- Prettier
- Docker
- PostgreSQL

### Debug Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Backend",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}/backend",
      "console": "integratedTerminal"
    }
  ]
}
```

## Next Steps

Once you have the app running locally:

1. **Explore the codebase:**
   - Backend: `backend/src/`
   - Frontend: `frontend/src/`

2. **Make your first change:**
   - Try modifying the homepage text
   - Add a new product category
   - Customize the point values

3. **Test thoroughly:**
   - Register multiple users
   - Test referral tracking
   - Try purchasing products
   - Test admin features

4. **When ready to deploy:**
   - See [QUICK_START.md](QUICK_START.md) for GCP deployment
   - See [DEPLOY_GCP_GUIDE.md](DEPLOY_GCP_GUIDE.md) for detailed instructions

## Getting Help

- Check the [README.md](README.md) for API documentation
- Check backend logs: `docker-compose logs -f backend`
- Check database: `docker exec -it doac-postgres psql -U doac_user -d referral_system`
- Check Redis: `docker exec -it doac-redis redis-cli`

## Summary

**To start developing:**
```bash
docker-compose up -d    # Start databases
npm run dev             # Start app
```

**To stop:**
```bash
# Ctrl+C to stop the app
docker-compose down     # Stop databases
```

That's it! You're ready to build and test your referral system locally.
