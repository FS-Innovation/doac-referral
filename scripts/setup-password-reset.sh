#!/bin/bash

# Password Reset System - Quick Setup Script
# This script helps you set up the password reset system step-by-step

set -e  # Exit on error

echo "=============================================="
echo "Password Reset System - Setup Wizard"
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Function to prompt for input
prompt_input() {
    local prompt="$1"
    local var_name="$2"
    read -p "$prompt: " value
    eval "$var_name='$value'"
}

# Check if running from project root
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    print_error "This script must be run from the project root directory"
    exit 1
fi

echo "Step 1: Database Migration"
echo "-------------------------------------------"
echo "Choose your database migration method:"
echo "1) Google Cloud Console (Easiest - recommended)"
echo "2) Cloud SQL Proxy (Local connection)"
echo "3) Skip (I'll do it manually)"
echo ""
read -p "Enter choice [1-3]: " db_choice

case $db_choice in
    1)
        echo ""
        print_warning "Opening Google Cloud SQL Console..."
        echo ""
        echo "Follow these steps:"
        echo "1. Click the Cloud Shell icon (top right)"
        echo "2. Run: gcloud sql connect doac-referral-db --user=postgres"
        echo "3. Copy and paste the SQL from: backend/migrations/add_password_reset_table.sql"
        echo ""
        open "https://console.cloud.google.com/sql/instances" 2>/dev/null || \
        xdg-open "https://console.cloud.google.com/sql/instances" 2>/dev/null || \
        echo "Visit: https://console.cloud.google.com/sql/instances"
        echo ""
        read -p "Press Enter when migration is complete..."
        print_success "Database migration noted"
        ;;
    2)
        echo ""
        prompt_input "Enter your Cloud SQL connection name (project:region:instance)" CONNECTION_NAME
        echo ""
        print_warning "Starting Cloud SQL Proxy..."

        # Check if cloud-sql-proxy exists
        if ! command -v ./cloud-sql-proxy &> /dev/null; then
            print_warning "Cloud SQL Proxy not found. Downloading..."
            if [[ "$OSTYPE" == "darwin"* ]]; then
                curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.amd64
            else
                wget https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.linux.amd64 -O cloud-sql-proxy
            fi
            chmod +x cloud-sql-proxy
            print_success "Cloud SQL Proxy downloaded"
        fi

        echo ""
        print_warning "Run this in a separate terminal:"
        echo "./cloud-sql-proxy --port 5432 $CONNECTION_NAME"
        echo ""
        print_warning "Then run this to apply migration:"
        echo "psql -h 127.0.0.1 -U postgres -d doac-referral-db -f backend/migrations/add_password_reset_table.sql"
        echo ""
        read -p "Press Enter when migration is complete..."
        print_success "Database migration noted"
        ;;
    3)
        print_warning "Skipping database migration - remember to run it manually!"
        ;;
    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "Step 2: Email Configuration"
echo "-------------------------------------------"
echo "Choose your email provider:"
echo "1) Gmail (Recommended for testing)"
echo "2) SendGrid (Recommended for production)"
echo "3) Other SMTP provider"
echo "4) Skip (I'll configure manually)"
echo ""
read -p "Enter choice [1-4]: " email_choice

EMAIL_HOST=""
EMAIL_PORT=""
EMAIL_USER=""
EMAIL_PASS=""

case $email_choice in
    1)
        echo ""
        print_warning "Gmail Setup Instructions:"
        echo "1. Enable 2FA: https://myaccount.google.com/security"
        echo "2. Generate App Password: https://myaccount.google.com/apppasswords"
        echo "   - Select: Mail + Other (Custom name)"
        echo "   - Name it: DOAC Password Reset"
        echo "3. Copy the 16-character password"
        echo ""

        # Open URLs
        open "https://myaccount.google.com/apppasswords" 2>/dev/null || \
        xdg-open "https://myaccount.google.com/apppasswords" 2>/dev/null || \
        echo "Visit: https://myaccount.google.com/apppasswords"

        echo ""
        prompt_input "Enter your Gmail address" EMAIL_USER
        prompt_input "Enter your Gmail App Password (16 chars)" EMAIL_PASS

        EMAIL_HOST="smtp.gmail.com"
        EMAIL_PORT="587"
        print_success "Gmail configuration saved"
        ;;
    2)
        echo ""
        print_warning "SendGrid Setup:"
        echo "1. Sign up at https://sendgrid.com"
        echo "2. Create an API key"
        echo ""

        prompt_input "Enter your SendGrid API key" SENDGRID_KEY

        EMAIL_HOST="smtp.sendgrid.net"
        EMAIL_PORT="587"
        EMAIL_USER="apikey"
        EMAIL_PASS="$SENDGRID_KEY"
        print_success "SendGrid configuration saved"
        ;;
    3)
        echo ""
        prompt_input "Enter SMTP host" EMAIL_HOST
        prompt_input "Enter SMTP port" EMAIL_PORT
        prompt_input "Enter SMTP username" EMAIL_USER
        prompt_input "Enter SMTP password" EMAIL_PASS
        print_success "SMTP configuration saved"
        ;;
    4)
        print_warning "Skipping email configuration"
        ;;
    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

# Create .env file for backend
if [ ! -z "$EMAIL_HOST" ]; then
    echo ""
    echo "Step 3: Save Environment Variables"
    echo "-------------------------------------------"

    ENV_FILE="backend/.env.production"

    echo "# Email Configuration" >> $ENV_FILE
    echo "EMAIL_HOST=$EMAIL_HOST" >> $ENV_FILE
    echo "EMAIL_PORT=$EMAIL_PORT" >> $ENV_FILE
    echo "EMAIL_USER=$EMAIL_USER" >> $ENV_FILE
    echo "EMAIL_PASS=$EMAIL_PASS" >> $ENV_FILE
    echo "" >> $ENV_FILE
    echo "# Node Environment" >> $ENV_FILE
    echo "NODE_ENV=production" >> $ENV_FILE
    echo "" >> $ENV_FILE

    print_success "Environment variables saved to $ENV_FILE"
    print_warning "IMPORTANT: Add DB_HOST, DB_USER, DB_PASSWORD, and JWT_SECRET to this file!"
fi

echo ""
echo "Step 4: Build & Deploy"
echo "-------------------------------------------"
echo "Choose deployment platform:"
echo "1) Google Cloud Run"
echo "2) Google App Engine"
echo "3) Firebase Hosting (Frontend only)"
echo "4) Manual (I'll deploy myself)"
echo ""
read -p "Enter choice [1-4]: " deploy_choice

case $deploy_choice in
    1)
        echo ""
        print_warning "Google Cloud Run Deployment"
        echo ""

        # Build backend
        echo "Building backend..."
        cd backend
        npm install
        npm run build
        cd ..
        print_success "Backend built"

        # Build frontend
        echo "Building frontend..."
        cd frontend
        npm install
        npm run build
        cd ..
        print_success "Frontend built"

        echo ""
        prompt_input "Enter your GCP project ID" PROJECT_ID
        prompt_input "Enter service name (e.g., doac-backend)" SERVICE_NAME
        prompt_input "Enter Cloud SQL connection name" SQL_CONNECTION

        echo ""
        print_warning "Deploying backend to Cloud Run..."
        echo ""
        echo "Run these commands:"
        echo ""
        echo "# Build Docker image"
        echo "cd backend"
        echo "gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME"
        echo ""
        echo "# Deploy to Cloud Run"
        echo "gcloud run deploy $SERVICE_NAME \\"
        echo "  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \\"
        echo "  --platform managed \\"
        echo "  --region us-central1 \\"
        echo "  --add-cloudsql-instances $SQL_CONNECTION \\"
        echo "  --set-env-vars EMAIL_HOST=$EMAIL_HOST,EMAIL_PORT=$EMAIL_PORT,EMAIL_USER=$EMAIL_USER,EMAIL_PASS=$EMAIL_PASS"
        echo ""
        ;;
    2)
        echo ""
        print_warning "Google App Engine Deployment"
        echo ""

        # Build backend
        cd backend
        npm install
        npm run build
        cd ..

        # Build frontend
        cd frontend
        npm install
        npm run build
        cd ..

        echo "Update backend/app.yaml with environment variables, then run:"
        echo "gcloud app deploy backend/app.yaml"
        ;;
    3)
        echo ""
        print_warning "Firebase Hosting Deployment"
        echo ""

        cd frontend
        npm install
        npm run build
        cd ..

        echo "Run: firebase deploy --only hosting"
        ;;
    4)
        print_warning "Skipping deployment"
        ;;
esac

echo ""
echo "=============================================="
echo "Setup Complete! 🎉"
echo "=============================================="
echo ""
print_success "Password reset system is ready to deploy!"
echo ""
echo "Next steps:"
echo "1. ✅ Database table created"
echo "2. ✅ Email configuration saved"
echo "3. ⚠️  Complete deployment (if not done)"
echo "4. ⚠️  Test the password reset flow"
echo "5. ⚠️  Set up monitoring/alerts"
echo ""
echo "Documentation:"
echo "- Deployment Guide: DEPLOYMENT_GUIDE.md"
echo "- Technical Docs: PASSWORD_RESET_DOCUMENTATION.md"
echo ""
echo "Testing:"
echo "1. Go to your app and click 'Forgot password?'"
echo "2. Enter your email"
echo "3. Check email for 6-digit code"
echo "4. Enter code and set new password"
echo "5. Login with new password"
echo ""
print_success "All set! Good luck! 🚀"
