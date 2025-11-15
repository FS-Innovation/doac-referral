#!/bin/bash
# Complete Google Cloud Platform Deployment Script
# Deploys backend to Cloud Run and frontend to Firebase Hosting

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
PROJECT_ID=""
REGION="us-central1"
SERVICE_NAME="doac-referral-backend"

# Helper functions
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_step() { echo -e "${MAGENTA}🚀 $1${NC}"; }

# Banner
show_banner() {
    echo ""
    echo -e "${MAGENTA}╔════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║  DOAC Referral - GCP Deployment  ║${NC}"
    echo -e "${MAGENTA}╚════════════════════════════════════════╝${NC}"
    echo ""
}

# Check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."

    # Check gcloud
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI not found. Install from: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi

    # Check firebase
    if ! command -v firebase &> /dev/null; then
        log_error "Firebase CLI not found. Run: npm install -g firebase-tools"
        exit 1
    fi

    # Check docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found. Install from: https://www.docker.com/products/docker-desktop"
        exit 1
    fi

    # Check node
    if ! command -v node &> /dev/null; then
        log_error "Node.js not found"
        exit 1
    fi

    log_success "All prerequisites installed"
}

# Get project ID
get_project_id() {
    if [ -z "$PROJECT_ID" ]; then
        # Try to get from gcloud config
        PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

        if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" == "(unset)" ]; then
            log_info "Please enter your GCP Project ID:"
            read -r PROJECT_ID
        fi
    fi

    if [ -z "$PROJECT_ID" ]; then
        log_error "Project ID is required"
        exit 1
    fi

    log_info "Using project: $PROJECT_ID"
    gcloud config set project "$PROJECT_ID"
}

# Enable required APIs
enable_apis() {
    log_step "Enabling required GCP APIs..."

    APIS=(
        "run.googleapis.com"
        "cloudbuild.googleapis.com"
        "sqladmin.googleapis.com"
        "redis.googleapis.com"
        "secretmanager.googleapis.com"
        "compute.googleapis.com"
    )

    for api in "${APIS[@]}"; do
        log_info "Enabling $api..."
        gcloud services enable "$api" --project="$PROJECT_ID" 2>/dev/null || true
    done

    log_success "APIs enabled"
}

# Setup Cloud SQL
setup_cloud_sql() {
    log_step "Setting up Cloud SQL PostgreSQL..."

    INSTANCE_NAME="doac-referral-db"

    # Check if instance exists
    if gcloud sql instances describe "$INSTANCE_NAME" --project="$PROJECT_ID" &>/dev/null; then
        log_info "Cloud SQL instance already exists"
    else
        log_info "Creating Cloud SQL instance (this takes 5-10 minutes)..."

        gcloud sql instances create "$INSTANCE_NAME" \
            --database-version=POSTGRES_15 \
            --tier=db-f1-micro \
            --region="$REGION" \
            --storage-type=SSD \
            --storage-size=10GB \
            --storage-auto-increase \
            --backup-start-time=03:00 \
            --enable-bin-log \
            --project="$PROJECT_ID"

        log_success "Cloud SQL instance created"
    fi

    # Create database
    log_info "Creating database..."
    gcloud sql databases create doac_referral \
        --instance="$INSTANCE_NAME" \
        --project="$PROJECT_ID" 2>/dev/null || log_info "Database already exists"

    # Get connection name
    CONNECTION_NAME=$(gcloud sql instances describe "$INSTANCE_NAME" \
        --project="$PROJECT_ID" \
        --format="value(connectionName)")

    log_info "Connection name: $CONNECTION_NAME"

    # Set database password
    log_info "Please enter a password for the postgres user (or press Enter to generate one):"
    read -rs DB_PASSWORD

    if [ -z "$DB_PASSWORD" ]; then
        DB_PASSWORD=$(openssl rand -base64 32)
        log_info "Generated password (save this): $DB_PASSWORD"
    fi

    gcloud sql users set-password postgres \
        --instance="$INSTANCE_NAME" \
        --password="$DB_PASSWORD" \
        --project="$PROJECT_ID"

    # Build DATABASE_URL
    DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@localhost/doac_referral?host=/cloudsql/${CONNECTION_NAME}"

    log_success "Cloud SQL setup complete"
}

# Setup Redis (Memorystore)
setup_redis() {
    log_step "Setting up Redis (Memorystore)..."

    REDIS_INSTANCE="doac-referral-redis"

    # Check if exists
    if gcloud redis instances describe "$REDIS_INSTANCE" \
        --region="$REGION" \
        --project="$PROJECT_ID" &>/dev/null; then
        log_info "Redis instance already exists"
    else
        log_info "Creating Redis instance (this takes 5-10 minutes)..."

        gcloud redis instances create "$REDIS_INSTANCE" \
            --size=1 \
            --region="$REGION" \
            --redis-version=redis_6_x \
            --tier=basic \
            --project="$PROJECT_ID"

        log_success "Redis instance created"
    fi

    # Get Redis host
    REDIS_HOST=$(gcloud redis instances describe "$REDIS_INSTANCE" \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --format="value(host)")

    REDIS_PORT=$(gcloud redis instances describe "$REDIS_INSTANCE" \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --format="value(port)")

    REDIS_URL="redis://${REDIS_HOST}:${REDIS_PORT}"

    log_success "Redis setup complete"
}

# Store secrets in Secret Manager
store_secrets() {
    log_step "Storing secrets in Secret Manager..."

    # Generate JWT secret if needed
    JWT_SECRET=$(openssl rand -base64 64)

    # Store DATABASE_URL
    echo -n "$DATABASE_URL" | gcloud secrets create database-url \
        --data-file=- \
        --project="$PROJECT_ID" 2>/dev/null || \
    echo -n "$DATABASE_URL" | gcloud secrets versions add database-url \
        --data-file=- \
        --project="$PROJECT_ID"

    # Store JWT_SECRET
    echo -n "$JWT_SECRET" | gcloud secrets create jwt-secret \
        --data-file=- \
        --project="$PROJECT_ID" 2>/dev/null || \
    echo -n "$JWT_SECRET" | gcloud secrets versions add jwt-secret \
        --data-file=- \
        --project="$PROJECT_ID"

    # Store REDIS_URL
    echo -n "$REDIS_URL" | gcloud secrets create redis-url \
        --data-file=- \
        --project="$PROJECT_ID" 2>/dev/null || \
    echo -n "$REDIS_URL" | gcloud secrets versions add redis-url \
        --data-file=- \
        --project="$PROJECT_ID"

    # Email configuration
    log_info "Enter email configuration (or press Enter to skip):"
    read -p "Email user: " EMAIL_USER
    read -sp "Email password: " EMAIL_PASS
    echo ""
    read -p "Admin email: " ADMIN_EMAIL

    if [ -n "$EMAIL_USER" ]; then
        echo -n "$EMAIL_USER" | gcloud secrets create email-user --data-file=- --project="$PROJECT_ID" 2>/dev/null || \
        echo -n "$EMAIL_USER" | gcloud secrets versions add email-user --data-file=- --project="$PROJECT_ID"
    fi

    if [ -n "$EMAIL_PASS" ]; then
        echo -n "$EMAIL_PASS" | gcloud secrets create email-pass --data-file=- --project="$PROJECT_ID" 2>/dev/null || \
        echo -n "$EMAIL_PASS" | gcloud secrets versions add email-pass --data-file=- --project="$PROJECT_ID"
    fi

    if [ -n "$ADMIN_EMAIL" ]; then
        echo -n "$ADMIN_EMAIL" | gcloud secrets create admin-email --data-file=- --project="$PROJECT_ID" 2>/dev/null || \
        echo -n "$ADMIN_EMAIL" | gcloud secrets versions add admin-email --data-file=- --project="$PROJECT_ID"
    fi

    log_success "Secrets stored in Secret Manager"
}

# Build and deploy backend
deploy_backend() {
    log_step "Building and deploying backend to Cloud Run..."

    cd backend

    # Build and submit to Cloud Build
    log_info "Building Docker image..."
    gcloud builds submit \
        --tag "gcr.io/$PROJECT_ID/$SERVICE_NAME" \
        --project="$PROJECT_ID"

    # Deploy to Cloud Run
    log_info "Deploying to Cloud Run..."
    gcloud run deploy "$SERVICE_NAME" \
        --image "gcr.io/$PROJECT_ID/$SERVICE_NAME" \
        --platform managed \
        --region "$REGION" \
        --allow-unauthenticated \
        --port 8080 \
        --min-instances 1 \
        --max-instances 20 \
        --memory 512Mi \
        --cpu 1 \
        --timeout 300 \
        --concurrency 80 \
        --set-env-vars "NODE_ENV=production" \
        --set-secrets "DATABASE_URL=database-url:latest,JWT_SECRET=jwt-secret:latest,REDIS_URL=redis-url:latest,EMAIL_USER=email-user:latest,EMAIL_PASS=email-pass:latest,ADMIN_EMAIL=admin-email:latest" \
        --add-cloudsql-instances "$CONNECTION_NAME" \
        --project="$PROJECT_ID"

    # Get service URL
    BACKEND_URL=$(gcloud run services describe "$SERVICE_NAME" \
        --region "$REGION" \
        --project="$PROJECT_ID" \
        --format="value(status.url)")

    log_success "Backend deployed to: $BACKEND_URL"

    cd ..
}

# Run database migrations
run_migrations() {
    log_step "Running database migrations..."

    cd backend

    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        npm install
    fi

    # Run migration with Cloud SQL Proxy
    log_info "Connecting to Cloud SQL via proxy..."

    # Temporary: set DATABASE_URL for local migration
    export DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@127.0.0.1:5432/doac_referral"

    # Start Cloud SQL Proxy in background
    cloud_sql_proxy -instances="${CONNECTION_NAME}"=tcp:5432 &
    PROXY_PID=$!

    sleep 5  # Wait for proxy to start

    # Run migration
    npm run migrate || log_warning "Migration failed or already completed"

    # Stop proxy
    kill $PROXY_PID 2>/dev/null || true

    log_success "Database migrations complete"

    cd ..
}

# Build and deploy frontend
deploy_frontend() {
    log_step "Building and deploying frontend to Firebase Hosting..."

    cd frontend

    # Install dependencies
    log_info "Installing dependencies..."
    npm ci

    # Set environment variables
    export REACT_APP_API_URL="$BACKEND_URL"
    export REACT_APP_ENVIRONMENT="production"

    # Build
    log_info "Building React app..."
    npm run build

    cd ..

    # Deploy to Firebase
    log_info "Deploying to Firebase Hosting..."
    firebase deploy --only hosting --project "$PROJECT_ID"

    # Get hosting URL
    FRONTEND_URL=$(firebase hosting:channel:list --project "$PROJECT_ID" --json | grep -o '"url":"[^"]*' | cut -d'"' -f4 | head -1)

    log_success "Frontend deployed to Firebase Hosting"
}

# Summary
show_summary() {
    echo ""
    log_success "╔════════════════════════════════════════════════╗"
    log_success "║       DEPLOYMENT COMPLETE! 🎉                 ║"
    log_success "╚════════════════════════════════════════════════╝"
    echo ""
    log_info "📱 Frontend: https://${PROJECT_ID}.web.app"
    log_info "🔧 Backend: $BACKEND_URL"
    log_info "💾 Database: $CONNECTION_NAME"
    log_info "🔴 Redis: $REDIS_URL"
    echo ""
    log_info "Next steps:"
    echo "  1. Test the application"
    echo "  2. Configure custom domain (optional)"
    echo "  3. Set up monitoring and alerts"
    echo "  4. Run load tests"
    echo ""
    log_warning "IMPORTANT: Save these credentials securely!"
    echo "  Database password: $DB_PASSWORD"
    echo "  JWT Secret: (stored in Secret Manager)"
    echo ""
}

# Main deployment flow
main() {
    show_banner
    check_prerequisites
    get_project_id
    enable_apis
    setup_cloud_sql
    setup_redis
    store_secrets
    deploy_backend
    run_migrations
    deploy_frontend
    show_summary
}

# Handle Ctrl+C
trap 'log_error "Deployment interrupted"; exit 1' INT

# Run
main
