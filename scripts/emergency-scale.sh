#!/bin/bash
# Emergency Scaling Script
# Run this if you're hitting capacity limits during viral traffic

set -e

echo "=========================================="
echo "EMERGENCY SCALING SCRIPT"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_ID=$(gcloud config get-value project)

echo "Current time: $(date)"
echo "Project: $PROJECT_ID"
echo ""

# Menu
echo "Select scaling action:"
echo ""
echo "1) Quick scale - Increase to 250 instances (handles ~20,000 concurrent)"
echo "2) Mega scale - Increase to 500 instances (handles ~40,000 concurrent)"
echo "3) Upgrade database - Switch to db-custom-4-15360 (1,000 connections)"
echo "4) Upgrade Redis - Switch to 10GB"
echo "5) All of the above (FULL EMERGENCY SCALE)"
echo "6) Scale back down (save money after spike)"
echo "7) Check current status"
echo ""
read -p "Enter choice [1-7]: " choice

case $choice in
  1)
    echo ""
    echo "Scaling Cloud Run to 250 instances..."
    gcloud run services update doac-referral-backend \
      --max-instances 250 \
      --vpc-connector vpc-connector \
      --vpc-egress private-ranges-only \
      --region us-central1
    echo -e "${GREEN}✅ Cloud Run scaled to 250 instances${NC}"
    echo "Capacity: ~20,000 concurrent users"
    ;;

  2)
    echo ""
    echo "Scaling Cloud Run to 500 instances..."
    echo -e "${YELLOW}⚠️  This requires quota approval. May fail if not pre-approved.${NC}"
    read -p "Continue? [y/N]: " confirm
    if [ "$confirm" == "y" ]; then
      gcloud run services update doac-referral-backend \
        --max-instances 500 \
        --vpc-connector vpc-connector \
        --vpc-egress private-ranges-only \
        --region us-central1
      echo -e "${GREEN}✅ Cloud Run scaled to 500 instances${NC}"
      echo "Capacity: ~40,000 concurrent users"
    fi
    ;;

  3)
    echo ""
    echo "Upgrading database to db-custom-4-15360..."
    echo "This will take 5-10 minutes with brief downtime."
    echo "Cost: ~\$350/month (vs current ~\$175/month)"
    read -p "Continue? [y/N]: " confirm
    if [ "$confirm" == "y" ]; then
      gcloud sql instances patch doac-referral-db \
        --tier=db-custom-4-15360
      echo -e "${GREEN}✅ Database upgraded to db-custom-4-15360${NC}"
      echo "Connections: 1,000 (was 500)"
    fi
    ;;

  4)
    echo ""
    echo "Upgrading Redis to 10GB..."
    echo "This will take 5-10 minutes."
    echo "Cost: ~\$500/month (vs current ~\$250/month)"
    read -p "Continue? [y/N]: " confirm
    if [ "$confirm" == "y" ]; then
      gcloud redis instances update doac-referral-redis \
        --size=10 \
        --region=us-central1
      echo -e "${GREEN}✅ Redis upgraded to 10GB${NC}"
    fi
    ;;

  5)
    echo ""
    echo -e "${RED}FULL EMERGENCY SCALE${NC}"
    echo ""
    echo "This will:"
    echo "  - Scale Cloud Run to 500 instances (~40k concurrent)"
    echo "  - Upgrade DB to db-custom-4-15360 (1,000 connections)"
    echo "  - Upgrade Redis to 10GB"
    echo ""
    echo "Total time: ~10-15 minutes"
    echo "Cost increase: ~\$650/month (from \$425 to \$1,075)"
    echo ""
    read -p "Are you sure? Type 'YES' to confirm: " confirm
    if [ "$confirm" == "YES" ]; then
      echo ""
      echo "Step 1/3: Scaling Cloud Run..."
      gcloud run services update doac-referral-backend \
        --max-instances 500 \
        --vpc-connector vpc-connector \
        --vpc-egress private-ranges-only \
        --region us-central1
      echo -e "${GREEN}✅ Cloud Run scaled${NC}"

      echo ""
      echo "Step 2/3: Upgrading database (this takes 5-10 min)..."
      gcloud sql instances patch doac-referral-db \
        --tier=db-custom-4-15360
      echo -e "${GREEN}✅ Database upgraded${NC}"

      echo ""
      echo "Step 3/3: Upgrading Redis (this takes 5-10 min)..."
      gcloud redis instances update doac-referral-redis \
        --size=10 \
        --region=us-central1
      echo -e "${GREEN}✅ Redis upgraded${NC}"

      echo ""
      echo -e "${GREEN}=========================================="
      echo "EMERGENCY SCALE COMPLETE"
      echo "==========================================${NC}"
      echo ""
      echo "New capacity: ~40,000 concurrent users"
      echo "New cost: ~\$1,075-1,500/month during peak"
      echo ""
    else
      echo "Cancelled."
    fi
    ;;

  6)
    echo ""
    echo "Scaling back down to save money..."
    echo ""
    echo "This will:"
    echo "  - Set Cloud Run min-instances to 0 (scale to zero)"
    echo "  - Set max-instances back to 100"
    echo "  - Optionally downgrade DB and Redis"
    echo ""
    read -p "Continue? [y/N]: " confirm
    if [ "$confirm" == "y" ]; then
      echo ""
      echo "Scaling Cloud Run..."
      gcloud run services update doac-referral-backend \
        --min-instances 0 \
        --max-instances 100 \
        --vpc-connector vpc-connector \
        --vpc-egress private-ranges-only \
        --region us-central1
      echo -e "${GREEN}✅ Cloud Run scaled back${NC}"

      echo ""
      read -p "Downgrade database to db-custom-2-7680? [y/N]: " db_confirm
      if [ "$db_confirm" == "y" ]; then
        gcloud sql instances patch doac-referral-db \
          --tier=db-custom-2-7680
        echo -e "${GREEN}✅ Database downgraded${NC}"
      fi

      echo ""
      read -p "Downgrade Redis to 5GB? [y/N]: " redis_confirm
      if [ "$redis_confirm" == "y" ]; then
        gcloud redis instances update doac-referral-redis \
          --size=5 \
          --region=us-central1
        echo -e "${GREEN}✅ Redis downgraded${NC}"
      fi

      echo ""
      echo -e "${GREEN}Scale-back complete. Cost should drop to ~\$425-600/month${NC}"
    fi
    ;;

  7)
    echo ""
    echo "Current status:"
    echo ""

    echo "Cloud Run:"
    MAX_INSTANCES=$(gcloud run services describe doac-referral-backend \
      --region us-central1 \
      --format="value(spec.template.metadata.annotations.'autoscaling.knative.dev/maxScale')")
    MIN_INSTANCES=$(gcloud run services describe doac-referral-backend \
      --region us-central1 \
      --format="value(spec.template.metadata.annotations.'autoscaling.knative.dev/minScale')")
    echo "  Min instances: $MIN_INSTANCES"
    echo "  Max instances: $MAX_INSTANCES"
    echo "  Capacity: ~$((MAX_INSTANCES * 80)) concurrent users"

    echo ""
    echo "Database:"
    DB_TIER=$(gcloud sql instances describe doac-referral-db \
      --format="value(settings.tier)")
    echo "  Tier: $DB_TIER"

    echo ""
    echo "Redis:"
    REDIS_SIZE=$(gcloud redis instances describe doac-referral-redis \
      --region=us-central1 \
      --format="value(memorySizeGb)")
    echo "  Size: ${REDIS_SIZE}GB"

    echo ""
    echo "Backend URL:"
    BACKEND_URL=$(gcloud run services describe doac-referral-backend \
      --region us-central1 \
      --format="value(status.url)")
    echo "  $BACKEND_URL"
    ;;

  *)
    echo "Invalid choice"
    exit 1
    ;;
esac

echo ""
echo "Done!"
echo ""
