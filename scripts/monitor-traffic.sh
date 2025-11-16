#!/bin/bash
# Real-time Traffic Monitoring Script
# Run this during your video launch to monitor traffic in real-time

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"

echo "=========================================="
echo "REAL-TIME TRAFFIC MONITOR"
echo "=========================================="
echo ""
echo "Project: $PROJECT_ID"
echo "Press Ctrl+C to exit"
echo ""

# Function to get metrics
get_metrics() {
  # Get current instance count
  INSTANCES=$(gcloud run services describe doac-referral-backend \
    --region $REGION \
    --format="value(status.traffic[0].latestRevision)" 2>/dev/null | wc -l || echo "0")

  # Get timestamp from 1 minute ago (cross-platform)
  if date --version >/dev/null 2>&1; then
    # GNU date (Linux)
    ONE_MIN_AGO=$(date -u -d '1 minute ago' '+%Y-%m-%dT%H:%M:%SZ')
  else
    # BSD date (macOS)
    ONE_MIN_AGO=$(date -u -v-1M '+%Y-%m-%dT%H:%M:%SZ')
  fi

  # Get request count (last 1 minute)
  REQUESTS=$(gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=doac-referral-backend AND timestamp>=\"$ONE_MIN_AGO\"" \
    --format="value(httpRequest.requestUrl)" \
    --limit 1000 2>/dev/null | wc -l || echo "0")

  # Get error count (last 1 minute)
  ERRORS=$(gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=doac-referral-backend AND severity>=ERROR AND timestamp>=\"$ONE_MIN_AGO\"" \
    --limit 100 2>/dev/null | wc -l || echo "0")

  # Get backend URL
  BACKEND_URL=$(gcloud run services describe doac-referral-backend \
    --region $REGION \
    --format="value(status.url)" 2>/dev/null)

  # Calculate metrics
  ERROR_RATE=0
  if [ "$REQUESTS" -gt 0 ]; then
    ERROR_RATE=$(echo "scale=2; ($ERRORS / $REQUESTS) * 100" | bc 2>/dev/null || echo "0")
  fi

  EST_CONCURRENT=$(echo "$INSTANCES * 80" | bc)
}

# Function to display dashboard
display_dashboard() {
  clear
  echo "=========================================="
  echo "REAL-TIME TRAFFIC DASHBOARD"
  echo "=========================================="
  echo ""
  echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""

  # Cloud Run Status
  echo -e "${BLUE}CLOUD RUN STATUS${NC}"
  echo "────────────────────────────────────────"

  MAX_INSTANCES=$(gcloud run services describe doac-referral-backend \
    --region $REGION \
    --format="value(spec.template.metadata.annotations.'autoscaling.knative.dev/maxScale')" 2>/dev/null || echo "0")

  INSTANCE_PERCENT=$(echo "scale=0; ($INSTANCES / $MAX_INSTANCES) * 100" | bc 2>/dev/null || echo "0")

  echo "Active instances: $INSTANCES / $MAX_INSTANCES ($INSTANCE_PERCENT%)"

  # Progress bar for instances
  BARS=$(echo "$INSTANCE_PERCENT / 5" | bc)
  printf "["
  for i in $(seq 1 20); do
    if [ $i -le $BARS ]; then
      printf "█"
    else
      printf " "
    fi
  done
  printf "]"
  echo ""

  echo "Est. concurrent users: ~$EST_CONCURRENT"
  echo ""

  # Traffic Metrics
  echo -e "${BLUE}TRAFFIC METRICS (Last minute)${NC}"
  echo "────────────────────────────────────────"
  echo "Total requests: $REQUESTS"
  echo "Errors: $ERRORS"

  if (( $(echo "$ERROR_RATE > 5" | bc -l) )); then
    echo -e "Error rate: ${RED}${ERROR_RATE}%${NC} (⚠️  HIGH!)"
  elif (( $(echo "$ERROR_RATE > 1" | bc -l) )); then
    echo -e "Error rate: ${YELLOW}${ERROR_RATE}%${NC}"
  else
    echo -e "Error rate: ${GREEN}${ERROR_RATE}%${NC}"
  fi
  echo ""

  # Health Check
  echo -e "${BLUE}HEALTH CHECK${NC}"
  echo "────────────────────────────────────────"
  HEALTH=$(curl -s "$BACKEND_URL/health" 2>/dev/null | grep -o '"status":"[^"]*' | cut -d'"' -f4 || echo "FAILED")
  if [ "$HEALTH" == "ok" ]; then
    echo -e "Backend: ${GREEN}✅ HEALTHY${NC}"
  else
    echo -e "Backend: ${RED}❌ DOWN${NC}"
  fi
  echo ""

  # Alerts
  echo -e "${BLUE}ALERTS${NC}"
  echo "────────────────────────────────────────"

  if [ $INSTANCE_PERCENT -gt 80 ]; then
    echo -e "${RED}⚠️  CRITICAL: Using $INSTANCE_PERCENT% of max instances!${NC}"
    echo "   Consider running: ./scripts/emergency-scale.sh"
  elif [ $INSTANCE_PERCENT -gt 60 ]; then
    echo -e "${YELLOW}⚠️  WARNING: Using $INSTANCE_PERCENT% of max instances${NC}"
  else
    echo -e "${GREEN}✅ Capacity OK ($INSTANCE_PERCENT% used)${NC}"
  fi

  if (( $(echo "$ERROR_RATE > 5" | bc -l) )); then
    echo -e "${RED}⚠️  CRITICAL: Error rate is ${ERROR_RATE}%!${NC}"
  fi
  echo ""

  # Quick Actions
  echo -e "${BLUE}QUICK ACTIONS${NC}"
  echo "────────────────────────────────────────"
  echo "View logs:    gcloud logging read \"resource.type=cloud_run_revision AND resource.labels.service_name=doac-referral-backend\" --limit 50"
  echo "Emergency scale: ./scripts/emergency-scale.sh"
  echo "GCP Console: https://console.cloud.google.com/run/detail/$REGION/doac-referral-backend?project=$PROJECT_ID"
  echo ""
  echo "Refreshing in 10 seconds... (Ctrl+C to exit)"
}

# Main monitoring loop
while true; do
  get_metrics
  display_dashboard
  sleep 10
done
