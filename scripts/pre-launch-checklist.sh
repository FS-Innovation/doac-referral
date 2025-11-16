#!/bin/bash
# Pre-Launch Checklist for Video Drop
# Run this 1-2 days before your video goes live

set -e

echo "=========================================="
echo "PRE-LAUNCH CHECKLIST - 13M FOLLOWER CAMPAIGN"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PROJECT_ID=$(gcloud config get-value project)

echo "Project: $PROJECT_ID"
echo ""

# 1. Check Cloud Run Configuration
echo "1. Checking Cloud Run configuration..."
CURRENT_MAX=$(gcloud run services describe doac-referral-backend \
  --region us-central1 \
  --format="value(spec.template.spec.containers[0].resources.limits.cpu)" 2>/dev/null || echo "0")

MAX_INSTANCES=$(gcloud run services describe doac-referral-backend \
  --region us-central1 \
  --format="value(spec.template.metadata.annotations.'autoscaling.knative.dev/maxScale')" 2>/dev/null || echo "0")

if [ "$MAX_INSTANCES" -ge 100 ]; then
  echo -e "${GREEN}✅ Cloud Run max-instances: $MAX_INSTANCES (Good!)${NC}"
else
  echo -e "${RED}❌ Cloud Run max-instances: $MAX_INSTANCES (Should be 100+)${NC}"
fi

# 2. Check Database Tier
echo ""
echo "2. Checking Database configuration..."
DB_TIER=$(gcloud sql instances describe doac-referral-db \
  --format="value(settings.tier)" 2>/dev/null || echo "none")

if [[ "$DB_TIER" == *"custom-2"* ]] || [[ "$DB_TIER" == *"custom-4"* ]]; then
  echo -e "${GREEN}✅ Database tier: $DB_TIER (Good for viral traffic)${NC}"
elif [[ "$DB_TIER" == *"f1-micro"* ]]; then
  echo -e "${YELLOW}⚠️  Database tier: $DB_TIER (May need upgrade for >5k concurrent)${NC}"
else
  echo -e "${GREEN}✅ Database tier: $DB_TIER${NC}"
fi

# 3. Check Redis Size
echo ""
echo "3. Checking Redis configuration..."
REDIS_SIZE=$(gcloud redis instances describe doac-referral-redis \
  --region=us-central1 \
  --format="value(memorySizeGb)" 2>/dev/null || echo "0")

if [ "$REDIS_SIZE" -ge 5 ]; then
  echo -e "${GREEN}✅ Redis size: ${REDIS_SIZE}GB (Good!)${NC}"
else
  echo -e "${YELLOW}⚠️  Redis size: ${REDIS_SIZE}GB (Recommended: 5GB+)${NC}"
fi

# 4. Check Backend Health
echo ""
echo "4. Checking backend health..."
BACKEND_URL=$(gcloud run services describe doac-referral-backend \
  --region us-central1 \
  --format="value(status.url)" 2>/dev/null)

if [ -n "$BACKEND_URL" ]; then
  HEALTH_STATUS=$(curl -s "$BACKEND_URL/health" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
  if [ "$HEALTH_STATUS" == "ok" ]; then
    echo -e "${GREEN}✅ Backend health: OK${NC}"
  else
    echo -e "${RED}❌ Backend health: FAILED${NC}"
  fi
else
  echo -e "${RED}❌ Backend not deployed${NC}"
fi

# 5. Check Frontend Deployment
echo ""
echo "5. Checking frontend deployment..."
FRONTEND_URL="https://${PROJECT_ID}.web.app"
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" || echo "000")

if [ "$FRONTEND_STATUS" == "200" ]; then
  echo -e "${GREEN}✅ Frontend deployed: $FRONTEND_URL${NC}"
else
  echo -e "${RED}❌ Frontend not accessible (HTTP $FRONTEND_STATUS)${NC}"
fi

# 6. Check Quotas
echo ""
echo "6. Checking Cloud Run quotas..."
echo -e "${YELLOW}⚠️  Go to: https://console.cloud.google.com/iam-admin/quotas?project=$PROJECT_ID${NC}"
echo "   Filter for: Cloud Run API > Max instances per region"
echo "   Current should be: 100+"
echo "   Request increase to: 250-500 for mega-viral scenarios"

# 7. Check Billing Budget
echo ""
echo "7. Checking billing alerts..."
echo -e "${YELLOW}⚠️  Verify budget alerts are set:${NC}"
echo "   Go to: https://console.cloud.google.com/billing/budgets?project=$PROJECT_ID"
echo "   Recommended: \$500/month with alerts at 50%, 90%, 100%"

# 8. Test Referral Flow
echo ""
echo "8. Manual tests to perform:"
echo "   [ ] Register a new account"
echo "   [ ] Get referral link from dashboard"
echo "   [ ] Open referral link in incognito"
echo "   [ ] Verify points are awarded"
echo "   [ ] Test rate limiting (click link 10x quickly)"
echo "   [ ] Check fraud detection logs"

# 9. Warm-up instances (optional)
echo ""
echo "9. Pre-warm instances before video drop?"
echo "   Run this command 30 minutes before video goes live:"
echo ""
echo "   gcloud run services update doac-referral-backend \\"
echo "     --min-instances 5 \\"
echo "     --region us-central1"
echo ""

# 10. Summary
echo ""
echo "=========================================="
echo "SUMMARY"
echo "=========================================="
echo ""
echo "Backend URL: $BACKEND_URL"
echo "Frontend URL: $FRONTEND_URL"
echo ""
echo "Estimated capacity with current config:"
echo "  - Max concurrent users: ~8,000"
echo "  - Can upgrade to: ~20,000 (with quota increase)"
echo ""
echo "Cost estimate:"
echo "  - Idle: ~\$425/month"
echo "  - During spike: ~\$600-800/month"
echo ""
echo "Emergency scaling commands ready at:"
echo "  scripts/emergency-scale.sh"
echo ""
echo "Real-time monitoring:"
echo "  scripts/monitor-traffic.sh"
echo ""
echo -e "${GREEN}Good luck with your video launch! 🚀${NC}"
echo ""
