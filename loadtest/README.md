# Load Testing Suite for DOAC Referral System

Complete load testing suite using Locust to validate scalability and security of the referral system.

## Prerequisites

```bash
# Install Python 3.8+
python3 --version

# Install dependencies
pip install -r requirements.txt
```

## Test Scenarios

### 1. Normal Load Test (`locustfile.py`)

Simulates realistic user behavior:
- 60% normal users (register, browse, check stats)
- 30% referral clickers
- 10% quick browsers
- 2% admin users

**Run test:**
```bash
# Web UI mode (recommended for visualization)
locust -f locustfile.py --host=https://your-app.web.app

# Then open: http://localhost:8089
```

**Command-line mode:**
```bash
# Test with 1,000 users, spawning 50 per second
locust -f locustfile.py --host=https://your-app.web.app \
  --users 1000 --spawn-rate 50 --run-time 10m --headless

# Test with 10,000 users (stress test)
locust -f locustfile.py --host=https://your-app.web.app \
  --users 10000 --spawn-rate 100 --run-time 30m --headless
```

### 2. Referral Fraud Test (`referral-fraud-test.py`)

Simulates bot attacks on the referral system:
- Rapid-fire clicking
- Multiple codes from same IP
- Suspicious user agents
- High-velocity attacks

**Run fraud test:**
```bash
locust -f referral-fraud-test.py --host=https://your-app.web.app \
  --users 100 --spawn-rate 10 --run-time 5m --headless
```

**Expected Results:**
- ✅ **95%+ blocked** = Fraud protection working well
- ⚠️ **80-95% blocked** = Needs improvement
- ❌ **<80% blocked** = Fraud protection failing

## Load Testing Scenarios

### Baseline Test (Establish Performance Baseline)

**Goal:** Establish baseline performance metrics

```bash
locust -f locustfile.py --host=https://your-app.web.app \
  --users 100 --spawn-rate 10 --run-time 5m --headless \
  --html report-baseline.html --csv report-baseline
```

**Success Criteria:**
- 95th percentile response time < 500ms
- Error rate < 1%
- Server stays healthy

### Stress Test (Find Breaking Point)

**Goal:** Find the maximum capacity

```bash
# Gradually increase load
locust -f locustfile.py --host=https://your-app.web.app \
  --users 1000 --spawn-rate 50 --run-time 15m --headless \
  --html report-stress.html --csv report-stress
```

**Continue increasing until:**
- Response times exceed 2 seconds
- Error rate exceeds 5%
- Or server becomes unstable

### Spike Test (Sudden Traffic Surge)

**Goal:** Test auto-scaling response

```bash
# Simulate sudden traffic spike (Black Friday, viral post, etc.)
locust -f locustfile.py --host=https://your-app.web.app \
  --users 5000 --spawn-rate 500 --run-time 10m --headless \
  --html report-spike.html
```

**Success Criteria:**
- Cloud Run scales up within 60 seconds
- No failed requests during scale-up
- Response times recover quickly

### Soak Test (24-Hour Endurance)

**Goal:** Detect memory leaks and degradation

```bash
# Run for 24 hours at moderate load
locust -f locustfile.py --host=https://your-app.web.app \
  --users 2000 --spawn-rate 20 --run-time 24h --headless \
  --html report-soak.html --csv report-soak
```

**Success Criteria:**
- Performance remains stable over 24 hours
- No memory leaks
- No connection pool exhaustion

## Distributed Load Testing

For testing beyond 10,000 users, use distributed mode:

### Master Node

```bash
locust -f locustfile.py --host=https://your-app.web.app --master
```

### Worker Nodes (run on separate machines/containers)

```bash
# Worker 1
locust -f locustfile.py --worker --master-host=<master-ip>

# Worker 2
locust -f locustfile.py --worker --master-host=<master-ip>

# Worker N...
```

### Using Docker Compose

```bash
docker-compose up --scale worker=4
```

## Monitoring During Tests

### 1. Google Cloud Console

Monitor in real-time:
- Cloud Run metrics: https://console.cloud.google.com/run
- Cloud SQL metrics: https://console.cloud.google.com/sql
- Redis metrics: https://console.cloud.google.com/memorystore

### 2. Locust Web UI

Open http://localhost:8089 to see:
- Real-time request statistics
- Response time graphs
- Failure rate
- Requests per second

### 3. Key Metrics to Watch

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Response Time (p95) | <500ms | 500ms-1s | >1s |
| Response Time (p99) | <1s | 1-2s | >2s |
| Error Rate | <1% | 1-5% | >5% |
| RPS per instance | <100 | 100-150 | >150 |
| CPU Usage | <70% | 70-85% | >85% |
| Memory Usage | <80% | 80-90% | >90% |
| DB Connections | <80 | 80-95 | >95 |
| Redis Hit Rate | >80% | 60-80% | <60% |

## Interpreting Results

### Good Performance

```
Name                              # reqs  # fails  Avg   Min   Max   Med   p95   p99
/api/auth/register                1000    0        120   50    300   110   200   250
/api/referral/:code               5000    25       80    20    500   70    150   200
```

- Low failure rate (<1%)
- Fast response times
- Consistent performance

### Performance Issues

```
Name                              # reqs  # fails  Avg    Min   Max    Med    p95    p99
/api/auth/register                1000    150      1200   50    5000   900    3000   4500
/api/referral/:code               5000    800      2000   20    10000  1500   5000   8000
```

- High failure rate (>5%)
- Slow response times
- High variance

**Common Causes:**
1. Database connection pool exhausted
2. Redis not caching effectively
3. Cloud Run not scaling fast enough
4. Insufficient resources

## Troubleshooting

### High Response Times

1. Check Cloud Run auto-scaling:
   ```bash
   gcloud run services describe doac-referral-backend --region us-central1
   ```

2. Check database connections:
   ```sql
   SELECT count(*) FROM pg_stat_activity;
   ```

3. Check Redis hit rate:
   ```bash
   redis-cli info stats | grep keyspace
   ```

### High Error Rates

1. Check Cloud Run logs:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision" --limit 50
   ```

2. Check rate limiting:
   - If seeing many 429 errors, rate limits may be too strict

3. Check database health:
   ```bash
   gcloud sql operations list --instance=doac-referral-db
   ```

## Performance Targets

### For 1,000 Concurrent Users
- Response Time (p95): <300ms
- Error Rate: <0.5%
- Throughput: 1,000+ RPS

### For 10,000 Concurrent Users
- Response Time (p95): <500ms
- Error Rate: <1%
- Throughput: 5,000+ RPS

### For 100,000 Concurrent Users
- Response Time (p95): <1s
- Error Rate: <2%
- Throughput: 10,000+ RPS
- Cloud Run instances: 20-50
- Database connections: 80-100

## Reporting

Generate comprehensive reports:

```bash
# HTML report
locust -f locustfile.py --host=https://your-app.web.app \
  --users 5000 --spawn-rate 100 --run-time 30m --headless \
  --html report-$(date +%Y%m%d-%H%M%S).html \
  --csv report-$(date +%Y%m%d-%H%M%S)
```

Reports include:
- Request statistics
- Response time distribution
- Failures analysis
- Charts and graphs

## Best Practices

1. **Start Small:** Begin with 100 users, then scale up
2. **Monitor Costs:** Load testing can incur GCP charges
3. **Use Staging:** Test on staging environment first
4. **Schedule Tests:** Run during off-peak hours
5. **Document Results:** Save reports for comparison
6. **Test Regularly:** Run weekly/monthly to catch regressions

## Next Steps

After successful load testing:

1. ✅ Validate all success criteria met
2. ✅ Document baseline performance
3. ✅ Set up alerting based on metrics
4. ✅ Create runbook for handling traffic spikes
5. ✅ Schedule regular load tests

## Support

For issues or questions:
- Check Cloud Run logs: `gcloud logging read`
- Review test reports: `report-*.html`
- Monitor GCP console: https://console.cloud.google.com
