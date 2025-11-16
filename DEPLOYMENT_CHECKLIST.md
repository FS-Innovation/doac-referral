# 📋 DEPLOYMENT CHECKLIST - Quick Reference

**For 13M Follower Video Launch**

---

## ⏰ TIMELINE

### 1 Week Before Launch

- [ ] **Request Cloud Run quota increase**
  - Go to: https://console.cloud.google.com/iam-admin/quotas
  - Filter: "Cloud Run API" → "Max instances per region"
  - Request: 250-500 instances
  - Reason: "Viral referral campaign for 13M follower video"
  - ⏱️ Takes 1-3 business days

- [ ] **Deploy infrastructure** (follow [DEPLOY_GCP_GUIDE.md](DEPLOY_GCP_GUIDE.md))
  - Run all steps 1-10
  - **CRITICAL:** Don't skip Step 4.5 (VPC connector)
  - Verify VPC connector is READY before continuing
  - ⏱️ Takes 45-60 minutes total

- [ ] **Set up billing alerts**
  - Budget: $500-800/month
  - Alerts: 50%, 90%, 100%

### 2 Days Before Launch

- [ ] **Run pre-launch checklist**
  ```bash
  ./scripts/pre-launch-checklist.sh
  ```
  - All items should be ✅ green

- [ ] **Load test**
  ```bash
  cd loadtest
  locust -f locustfile.py \
    --host="https://YOUR_PROJECT.web.app" \
    --users 5000 \
    --spawn-rate 100 \
    --run-time 5m \
    --headless \
    --html report-prelaunch.html
  ```
  - **Pass criteria:**
    - [ ] p95 < 500ms
    - [ ] Error rate < 1%
    - [ ] No connection errors
    - [ ] Max instances < 80

- [ ] **Test referral flow end-to-end**
  - [ ] Register new account
  - [ ] Get referral link
  - [ ] Open link in incognito
  - [ ] Verify points awarded
  - [ ] Test rate limiting (click 10x)
  - [ ] Check fraud detection logs

### 1 Day Before Launch

- [ ] **Verify quota increase approved**
  - Check: https://console.cloud.google.com/iam-admin/quotas
  - Should show: 250-500 max instances

- [ ] **Review monitoring dashboards**
  - GCP Console: Cloud Run metrics
  - GCP Console: Cloud SQL metrics
  - Test scripts/monitor-traffic.sh

- [ ] **Prepare emergency contacts**
  - GCP Support: https://cloud.google.com/support
  - Team contacts with access

### 30 Minutes Before Video Launch

- [ ] **Pre-warm instances**
  ```bash
  gcloud run services update doac-referral-backend \
    --min-instances 5 \
    --vpc-connector vpc-connector \
    --region us-central1
  ```

- [ ] **Start monitoring dashboard**
  ```bash
  ./scripts/monitor-traffic.sh
  ```
  - Keep this running in terminal
  - Watch for alerts

- [ ] **Open emergency scale script**
  ```bash
  # In separate terminal, keep ready
  ./scripts/emergency-scale.sh
  ```

- [ ] **Test health check**
  ```bash
  curl https://YOUR_BACKEND_URL/health
  # Should return: {"status":"ok"}
  ```

---

## 🚀 DURING LAUNCH (First 6 Hours)

### Monitor Every 10 Minutes

- [ ] **Check instance count**
  - Dashboard shows current/max
  - Alert if >80% (80/100 instances)

- [ ] **Check error rate**
  - Should stay <1%
  - Alert if >5%

- [ ] **Check response times**
  - Should stay <500ms
  - Alert if >1000ms

### If Capacity Reaches 80%

- [ ] **Quick scale to 250 instances**
  ```bash
  ./scripts/emergency-scale.sh
  # Select option 1
  ```

### If Errors Spike >5%

- [ ] **Check logs**
  ```bash
  gcloud logging tail \
    "resource.type=cloud_run_revision AND severity>=ERROR" \
    --limit 50
  ```

- [ ] **Common fixes:**
  - Database connections high → Upgrade DB tier (option 3)
  - Redis errors → Check VPC connector status
  - Rate limit errors → Normal, fraud protection working

---

## 📉 AFTER LAUNCH (Day 2+)

### Scale Back Down

- [ ] **Reduce to 0 min instances**
  ```bash
  ./scripts/emergency-scale.sh
  # Select option 6 (scale back down)
  ```

- [ ] **Monitor cost reduction**
  - Should drop to ~$439/month baseline

### Review Metrics

- [ ] **Traffic analysis**
  - Peak concurrent users reached
  - Total registrations
  - Referral conversion rate
  - Fraud attempts blocked

- [ ] **Cost analysis**
  - Actual vs estimated costs
  - Most expensive resources
  - Optimization opportunities

- [ ] **Performance analysis**
  - Response time distribution
  - Error rate patterns
  - Database query performance

---

## 🚨 EMERGENCY PROCEDURES

### Site is Down

```bash
# 1. Check health
curl https://YOUR_BACKEND_URL/health

# 2. Check Cloud Run status
gcloud run services describe doac-referral-backend --region us-central1

# 3. Check logs
gcloud logging tail "resource.type=cloud_run_revision AND severity>=ERROR"

# 4. Common fixes:
# - Missing env vars → Re-deploy with secrets
# - VPC connector down → Check connector status
# - Database down → Check Cloud SQL instance
```

### Out of Capacity (503 Errors)

```bash
# IMMEDIATE: Scale up
./scripts/emergency-scale.sh
# Select option 1 (250 instances)

# If still failing, go to option 2 (500 instances)
```

### High Error Rate

```bash
# 1. Check what's failing
gcloud logging read "severity>=ERROR" --limit 100 | grep -i error

# 2. Common issues:
# - Database: Upgrade tier (option 3)
# - Redis: Should fallback automatically (check logs)
# - Rate limiting: Normal for fraud protection
```

### Database Connection Errors

```bash
# 1. Check connection count
gcloud sql connect doac-referral-db --user=postgres --database=doac_referral
# Run: SELECT count(*) FROM pg_stat_activity;

# 2. If >400, upgrade immediately
./scripts/emergency-scale.sh
# Select option 3 (upgrade database)
```

---

## ✅ SUCCESS CRITERIA

### Technical Metrics
- [ ] Uptime >99.9% during spike
- [ ] p95 response time <500ms
- [ ] Error rate <1%
- [ ] No failed deployments

### Business Metrics
- [ ] All referral links work
- [ ] Points awarded correctly
- [ ] Fraud detection active
- [ ] Cost within budget

---

## 📊 EXPECTED TRAFFIC PATTERNS

```
Hour 0-1:   ████████████████████ 40% (MASSIVE spike)
Hour 1-6:   ██████████           30%
Hour 6-24:  ████                 20%
Day 2-7:    ██                   10%
Week 2+:    ▌                    Minimal
```

**Plan for 80% of traffic in first 6 hours.**

---

## 💰 COST TRACKING

### During Launch Week
- **Day 1:** $15-30 (video drop day)
- **Day 2-7:** $5-10/day
- **Week 2+:** ~$15/month (baseline)
- **Total First Month:** $439-800

### After Scale-Down
- **Ongoing:** ~$439/month
  - Database: $175
  - Redis: $250
  - VPC: $14
  - Cloud Run: $0 (scaled to zero)

---

## 📞 CONTACTS

**Your Team:**
- [ ] Team member 1: _____________
- [ ] Team member 2: _____________

**GCP Support:**
- Console: https://console.cloud.google.com
- Support: https://cloud.google.com/support
- Status: https://status.cloud.google.com

**Documentation:**
- Deployment: [DEPLOY_GCP_GUIDE.md](DEPLOY_GCP_GUIDE.md)
- Launch Plan: [VIRAL_LAUNCH_PLAN.md](VIRAL_LAUNCH_PLAN.md)
- Audit: [AUDIT_COMPLETE_FIXES_APPLIED.md](AUDIT_COMPLETE_FIXES_APPLIED.md)
- Issues: [CRITICAL_AUDIT_FINDINGS.md](CRITICAL_AUDIT_FINDINGS.md)

---

## 🎯 FINAL PRE-LAUNCH CHECK

**30 minutes before video goes live, verify:**

- [ ] Cloud Run healthy (200 OK)
- [ ] VPC connector status: READY
- [ ] Redis connected (check logs)
- [ ] Database accessible
- [ ] Min instances: 5 (pre-warmed)
- [ ] Monitoring dashboard running
- [ ] Emergency scale script ready
- [ ] Quota approved (250+ instances)
- [ ] Billing alerts set
- [ ] Team on standby

**IF ALL CHECKED: READY TO LAUNCH** 🚀

---

**Good luck! Your infrastructure is solid. You've got this.** 💪
