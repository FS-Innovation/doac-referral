# Quick Reference - Local Development

## Start Development

```bash
# 1. Start databases (Docker containers)
docker-compose up -d

# 2. Start the application (from project root)
npm run dev
```

**URLs:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Backend Health: http://localhost:5000/health

**Default Admin Login:**
- Email: `admin@example.com`
- Password: `admin123`

## Stop Development

```bash
# Stop the app (Ctrl+C in the terminal running npm run dev)

# Stop databases
docker-compose down
```

## Database Access

```bash
# Connect to PostgreSQL
docker exec -it doac-postgres psql -U doac_user -d referral_system

# Common queries:
SELECT * FROM users;
SELECT * FROM products;
SELECT * FROM referral_clicks;

# Exit: \q
```

## Redis Access

```bash
# Connect to Redis
docker exec -it doac-redis redis-cli

# Common commands:
KEYS *                  # View all keys
GET key_name           # Get value
KEYS *rate-limit*      # View rate limit keys

# Exit: exit
```

## Troubleshooting

### Backend won't start
```bash
# Check logs
docker-compose logs postgres redis

# Restart databases
docker-compose restart

# Check if port 5000 is in use
lsof -i :5000
```

### Database connection errors
```bash
# Reset database (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d
sleep 10
cd backend && npm run migrate
```

### Clear Redis cache
```bash
docker exec -it doac-redis redis-cli FLUSHALL
```

## Testing Features

### 1. Register a User
1. Go to http://localhost:3000
2. Click "Register"
3. Create account

### 2. Test Referrals
1. Log in and copy your referral code
2. Open http://localhost:5000/api/referral/YOUR_CODE in incognito
3. Check your dashboard - you should see 1 click and points!

### 3. Test Admin
1. Log in as admin@example.com / admin123
2. Go to Admin Dashboard
3. Create products, view users, etc.

## Project Structure

```
doac-referral/
├── backend/              # Express API (port 5000)
│   ├── src/
│   │   ├── controllers/  # Business logic
│   │   ├── routes/       # API endpoints
│   │   ├── middleware/   # Rate limiting, auth
│   │   └── config/       # Database, Redis
│   └── .env             # Backend config
├── frontend/            # React app (port 3000)
│   ├── src/
│   │   ├── components/
│   │   └── pages/
│   └── .env            # Frontend config
└── docker-compose.yml  # PostgreSQL + Redis
```

## Useful Commands

```bash
# Install all dependencies
npm run install-all

# Run migrations
cd backend && npm run migrate

# Backend only
cd backend && npm run dev

# Frontend only
cd frontend && npm start

# Check Docker status
docker-compose ps

# View backend logs (when using npm run dev)
# Just look at the terminal output!

# Test API health
curl http://localhost:5000/health

# Test Redis connection
docker exec doac-redis redis-cli ping
```

## Environment Variables

**Backend (.env):**
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `JWT_SECRET` - Token signing key
- `PORT` - Server port (5000)
- `FRONTEND_URL` - CORS origin

**Frontend (.env):**
- `REACT_APP_API_URL` - Backend API URL

## What's Running?

After `npm run dev`:
- **PostgreSQL** (Docker) - Database on port 5432
- **Redis** (Docker) - Cache on port 6379
- **Backend** (Node) - API server on port 5000
- **Frontend** (React) - Dev server on port 3000

## Rate Limiting (Built-in Fraud Protection)

The app has built-in rate limiting:
- **Auth endpoints:** 5 attempts per 15 minutes
- **General API:** 100 requests per 15 minutes
- **Referral clicks:** 1 per IP per hour (disabled in development)
- **Admin endpoints:** 200 requests per 15 minutes

Fraud detection also tracks:
- Bot user agents
- Click velocity (max 3/minute)
- Duplicate clicks from same IP
- Mass fraud (5+ different codes from same IP)

## Fraud Protection

**All fraud scenarios redirect to your YouTube video, just without awarding points.**

This means:
- ✅ Everyone gets to watch your content
- ✅ Only legitimate clicks earn points
- ✅ Great user experience + fraud prevention

**Fraud Protection Features:**
- Rate limiting: 1 click per IP per hour
- Duplicate detection: 24 hour window
- Bot detection: Blocks automated scripts
- High velocity: Max 3 clicks/minute
- Mass fraud: Max 5 different codes per hour

**Set Your YouTube URL:**
```bash
# Via database
docker exec -it doac-postgres psql -U doac_user -d referral_system

UPDATE settings
SET value = 'https://www.youtube.com/watch?v=YOUR_VIDEO_ID'
WHERE key = 'redirect_url';
```

Or via Admin Dashboard → Settings → Update Redirect URL

**Learn more:** [FRAUD_PROTECTION.md](FRAUD_PROTECTION.md)

## Need More Help?

- Full guide: [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)
- Deployment: [QUICK_START.md](QUICK_START.md)
- Fraud protection: [FRAUD_PROTECTION.md](FRAUD_PROTECTION.md)
- Main docs: [README.md](README.md)
