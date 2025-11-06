# DOAC Referral Link System

A full-stack referral link system where users can create accounts, get unique referral links, earn points from clicks, and redeem points for products.

## Features

- User registration and authentication
- Unique referral links for each user
- Point tracking for referral clicks with detailed analytics
- Product marketplace where users can redeem points
- Admin dashboard for managing products, users, and settings
- Email notifications for purchases

## Tech Stack

- **Frontend**: React
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL
- **Authentication**: JWT
- **Email**: Nodemailer

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v13 or higher)
- npm or yarn

### Installation

1. Install all dependencies:
```bash
npm run install-all
```

2. Set up PostgreSQL database:
```bash
createdb referral_system
```

3. Configure environment variables:

Create `backend/.env` file:
```
DATABASE_URL=postgresql://username:password@localhost:5432/referral_system
JWT_SECRET=your-secret-key-change-this
PORT=5000
FRONTEND_URL=http://localhost:3000
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-email-password
ADMIN_EMAIL=admin@example.com
```

Create `frontend/.env` file:
```
REACT_APP_API_URL=http://localhost:5000
```

4. Run database migrations:
```bash
cd backend
npm run migrate
```

5. Start the development servers:
```bash
npm run dev
```

The frontend will run on http://localhost:3000 and the backend on http://localhost:5000.

## Project Structure

```
doac-referral-link/
├── backend/           # Express API server
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── services/
│   │   └── config/
│   └── package.json
├── frontend/          # React application
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.js
│   └── package.json
└── package.json       # Root package.json
```

## Default Admin Account

After running migrations, a default admin account will be created:
- Email: admin@example.com
- Password: admin123

**Please change this password immediately after first login!**

## API Endpoints

### Authentication
- POST `/api/auth/register` - Register new user
- POST `/api/auth/login` - Login user

### Referrals
- GET `/api/referral/:code` - Track referral click and redirect
- GET `/api/user/referral` - Get user's referral stats

### Products
- GET `/api/products` - Get all products
- POST `/api/products/purchase/:id` - Purchase product with points

### Admin
- POST `/api/admin/products` - Create product
- PUT `/api/admin/products/:id` - Update product
- DELETE `/api/admin/products/:id` - Delete product
- GET `/api/admin/users` - Get all users with stats
- PUT `/api/admin/settings/redirect-url` - Update global redirect URL

## License

ISC
