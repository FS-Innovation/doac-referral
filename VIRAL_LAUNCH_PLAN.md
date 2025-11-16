# Viral Launch Plan - 13M Follower Video Campaign

## Quick Reference

**Your Setup:**
- 13M followers
- Referral system for new video
- Expected: 2,000-20,000 concurrent users during launch spike
- Budget: ~$425-800/month

---

## Timeline

### 1 Week Before Launch

#### Request Quota Increase
```bash
# Go to GCP Console
# https://console.cloud.google.com/iam-admin/quotas

# Filter for: "Cloud Run API" → "Max instances per region"
# Current: 100
# Request: 250-500

# Justification to provide:
"Launching referral campaign for video content with 13M audience.
Expect 20,000-40,000 concurrent users in first 24 hours."
```

**Status:** Approval usually takes 1-3 business days

#### Deploy Infrastructure
```bash
# Follow the deployment guide
# See: DEPLOY_GCP_GUIDE.md

# Key configuration:
# - Cloud Run: 0-100 instances (handles 8,000 concurrent)
# - Database: db-custom-2-7680 (500 connections)
# - Redis: 5GB
# - Cost: ~$425/month base
```

---

### 1-2 Days Before Launch

#### Run Pre-Launch Checklist
```bash
./scripts/pre-launch-checklist.sh
```

This checks:
- ✅ Cloud Run configuration
- ✅ Database tier
- ✅ Redis size
- ✅ Backend health
- ✅ Frontend deployment
- ✅ Quotas
- ✅ Billing alerts

#### Load Test
```bash
cd loadtest

# Test with 5,000 users
locust -f locustfile.py \
  --host="https://YOUR_PROJECT_ID.web.app" \
  --users 5000 \
  --spawn-rate 100 \
  --run-time 5m \
  --headless \
  --html report-prelaunch.html

# Check results
open report-prelaunch.html
```

**Pass criteria:**
- 95th percentile < 500ms
- Error rate < 1%
- No database connection errors

#### Test Referral Flow End-to-End
1. Register a new account
2. Get referral link from dashboard
3. Open referral link in incognito window
4. Verify:
   - Link redirects properly
   - Points are awarded
   - Rate limiting works (try clicking 10x)
   - Fraud detection works (test with bot user-agent)

---

### 30 Minutes Before Video Goes Live

#### Pre-warm Instances
```bash
# Keep 5 instances always running (prevents cold starts)
gcloud run services update doac-referral-backend \
  --min-instances 5 \
  --region us-central1
```

**Cost:** ~$30/month extra, only during launch period

#### Start Monitoring
```bash
# In a terminal window, start real-time monitor
./scripts/monitor-traffic.sh
```

This shows:
- Active instances
- Requests per minute
- Error rate
- Health status
- Alerts

---

### During Video Launch (First 6 Hours)

#### What to Watch

**Monitor Dashboard:**
```bash
./scripts/monitor-traffic.sh
```

**Key Metrics:**
- Instance count: Should stay < 80% of max
- Error rate: Should stay < 1%
- Response time: Should stay < 500ms

**Alert Thresholds:**
- 🟢 Green: 0-60% capacity
- 🟡 Yellow: 60-80% capacity (watch closely)
- 🔴 Red: 80%+ capacity (consider scaling)

#### If You Hit 80%+ Capacity

**Option 1: Quick Scale (5 minutes)**
```bash
./scripts/emergency-scale.sh
# Select option 1: Scale to 250 instances
```

**Option 2: Full Emergency Scale (15 minutes)**
```bash
./scripts/emergency-scale.sh
# Select option 5: Full emergency scale
```

This upgrades:
- Cloud Run: 500 instances (~40k concurrent)
- Database: db-custom-4-15360 (1,000 connections)
- Redis: 10GB

**Cost:** Increases to ~$1,075-1,500/month (only during peak)

---

### Expected Traffic Patterns

```
Hour 0-1:   ████████████████████ 40% of total traffic (MASSIVE spike)
Hour 1-6:   ██████████           30% of total traffic
Hour 6-24:  ████                 20% of total traffic
Day 2-7:    ██                   10% of total traffic
Week 2+:    ▌                    Minimal ongoing traffic
```

**This is perfect for Cloud Run's pay-per-use model!**

---

### After Launch Spike (Day 2+)

#### Scale Back Down
```bash
./scripts/emergency-scale.sh
# Select option 6: Scale back down

# This sets:
# - min-instances: 0 (scale to zero when idle)
# - max-instances: 100
# - Optionally downgrade DB and Redis
```

**Result:** Cost drops back to ~$425-600/month

---

## Cost Breakdown

### Scenario 1: Moderate Success (Most Likely)
**Peak:** 2,000-5,000 concurrent users

**Configuration:**
- Cloud Run: 0-100 instances (default)
- Database: db-custom-2-7680
- Redis: 5GB

**Cost:**
- Base (idle): $425/month
- During spike: $500-600/month
- After spike: $425/month

### Scenario 2: Viral Success
**Peak:** 5,000-10,000 concurrent users

**Configuration:**
- Cloud Run: 0-250 instances (after quota increase)
- Database: db-custom-2-7680
- Redis: 5GB

**Cost:**
- During spike: $650-800/month
- After spike: $425/month

### Scenario 3: Mega Viral
**Peak:** 10,000-20,000 concurrent users

**Configuration:**
- Cloud Run: 0-500 instances
- Database: db-custom-4-15360 (upgraded)
- Redis: 10GB (upgraded)

**Cost:**
- During spike: $1,075-1,500/month
- After spike: $425/month (after scaling back)

---

## Quick Commands Reference

### Check Status
```bash
./scripts/pre-launch-checklist.sh
```

### Monitor Traffic
```bash
./scripts/monitor-traffic.sh
```

### Emergency Scale
```bash
./scripts/emergency-scale.sh
```

### View Logs
```bash
# Last 50 log entries
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=doac-referral-backend" \
  --limit 50 \
  --format json

# Follow logs in real-time
gcloud logging tail \
  "resource.type=cloud_run_revision AND resource.labels.service_name=doac-referral-backend"
```

### Check Database Connections
```bash
# Connect to database
gcloud sql connect doac-referral-db --user=postgres --database=doac_referral

# Check active connections
SELECT count(*) as active_connections FROM pg_stat_activity;

# Check by state
SELECT state, count(*) FROM pg_stat_activity GROUP BY state;
```

### GCP Console Links
```bash
# Cloud Run
https://console.cloud.google.com/run/detail/us-central1/doac-referral-backend?project=YOUR_PROJECT_ID

# Cloud SQL
https://console.cloud.google.com/sql/instances?project=YOUR_PROJECT_ID

# Monitoring
https://console.cloud.google.com/monitoring?project=YOUR_PROJECT_ID

# Logs
https://console.cloud.google.com/logs?project=YOUR_PROJECT_ID
```

---

## Troubleshooting

### High Error Rate (>5%)

**Check logs:**
```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND severity>=ERROR" \
  --limit 50
```

**Common issues:**
1. Database connection pool exhausted → Upgrade database tier
2. Redis memory full → Upgrade Redis size
3. Rate limiting too aggressive → Adjust limits in code

### Slow Response Times (>1s)

**Possible causes:**
1. Database queries slow → Check query performance
2. Cold starts → Increase min-instances
3. Redis cache misses → Check Redis hit rate

**Fix:**
```bash
# Increase min-instances for faster response
gcloud run services update doac-referral-backend \
  --min-instances 5 \
  --region us-central1
```

### Running Out of Capacity

**Symptoms:**
- Instance count at 100%
- 503 errors
- Requests queuing

**Fix:**
```bash
./scripts/emergency-scale.sh
# Select quick scale option
```

---

## Success Metrics

### Technical Metrics
- ✅ 95th percentile response time < 500ms
- ✅ Error rate < 1%
- ✅ Uptime > 99.9%
- ✅ Database connections < 90% of max

### Business Metrics
- Total registrations from referral links
- Conversion rate (clicks → signups)
- Points awarded
- Fraud attempts blocked

### Monitor These
```bash
# In GCP Console → Monitoring
# Create dashboard with:
# - Cloud Run request count
# - Cloud Run error rate
# - Cloud Run instance count
# - Cloud SQL connections
# - Redis memory usage
```

---

## Post-Launch Review

### 1 Week After Launch

**Analyze costs:**
```bash
# Go to: https://console.cloud.google.com/billing
# Check actual costs vs estimates
```

**Review metrics:**
- Peak concurrent users
- Total registrations
- Total referral conversions
- Fraud attempts blocked
- Peak instance count reached
- Error rate during spike

**Optimize:**
- Scale down infrastructure if traffic dropped
- Adjust rate limits based on actual usage
- Review and optimize database queries
- Check for any errors in logs

---

## Support

**If things go wrong during launch:**

1. Run monitoring: `./scripts/monitor-traffic.sh`
2. Check logs for errors
3. Use emergency scale script if needed
4. Check GCP status: https://status.cloud.google.com/

**For help:**
- GCP Support: https://cloud.google.com/support
- Cloud Run docs: https://cloud.google.com/run/docs
- This project: Check scripts/ directory

---

## Checklist

### Week Before
- [ ] Deploy to GCP (follow DEPLOY_GCP_GUIDE.md)
- [ ] Request quota increase to 250-500 instances
- [ ] Set up billing alerts ($500/month with 50%, 90% thresholds)
- [ ] Test deployment end-to-end

### Day Before
- [ ] Run pre-launch checklist script
- [ ] Load test with 5,000 users
- [ ] Test referral flow completely
- [ ] Verify fraud protection works
- [ ] Check quota increase was approved

### 30 Min Before
- [ ] Pre-warm 5 instances
- [ ] Start monitoring dashboard
- [ ] Have emergency-scale.sh ready
- [ ] Double-check frontend URL is correct in video

### During Launch
- [ ] Monitor dashboard every 5-10 minutes
- [ ] Watch for error rate spikes
- [ ] Check capacity usage
- [ ] Scale if needed (>80% capacity)

### After Launch
- [ ] Scale back down after spike
- [ ] Review metrics and costs
- [ ] Document lessons learned
- [ ] Optimize for next launch

---

**Good luck with your launch! 🚀**

Your infrastructure is ready to handle viral traffic while keeping costs low through smart auto-scaling.
