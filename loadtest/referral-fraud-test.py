"""
Referral Click Fraud Simulation Test
=====================================

This test simulates bot/fraud attacks on the referral system to validate:
- Rate limiting is working (1 click per IP per hour)
- Fraud detection catches suspicious patterns
- System stays stable under attack
- Legitimate users are not affected

Run with: locust -f referral-fraud-test.py --host=https://your-app.web.app --users 100 --spawn-rate 10
"""

from locust import HttpUser, task, between, events
import random
import time

# Statistics tracking
fraud_blocked = 0
fraud_succeeded = 0
total_attempts = 0


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print("\n" + "="*60)
    print("🚨 FRAUD SIMULATION TEST STARTED")
    print("="*60)
    print("This test will attempt to exploit the referral system.")
    print("Expected behavior: Most requests should be blocked (429/403)")
    print("="*60 + "\n")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    print("\n" + "="*60)
    print("📊 FRAUD TEST RESULTS")
    print("="*60)
    print(f"Total attempts: {total_attempts}")
    print(f"Blocked: {fraud_blocked} ({(fraud_blocked/total_attempts*100) if total_attempts > 0 else 0:.1f}%)")
    print(f"Succeeded: {fraud_succeeded} ({(fraud_succeeded/total_attempts*100) if total_attempts > 0 else 0:.1f}%)")
    print("="*60)

    # Success criteria
    if total_attempts > 0:
        block_rate = (fraud_blocked / total_attempts * 100)
        if block_rate >= 95:
            print("✅ PASS: Fraud protection is working effectively!")
        elif block_rate >= 80:
            print("⚠️  WARNING: Fraud protection is working but could be improved")
        else:
            print("❌ FAIL: Fraud protection is insufficient!")
    print("="*60 + "\n")


class FraudBotSimulator(HttpUser):
    """
    Simulates a bot attempting to generate fake referral clicks
    """
    wait_time = between(0.1, 0.5)  # Very fast clicks (bot behavior)

    # Test referral code (you'll need to create one first)
    TARGET_CODES = [
        "v6mE8FLLON",  # Replace with actual codes
        "TESTCODE01",
        "TESTCODE02",
    ]

    def on_start(self):
        """Initialize bot"""
        self.click_count = 0
        self.blocked_count = 0

    @task
    def rapid_fire_clicks(self):
        """Attempt rapid-fire clicking of referral links (fraud pattern)"""
        global fraud_blocked, fraud_succeeded, total_attempts

        code = random.choice(self.TARGET_CODES)

        response = self.client.get(
            f"/api/referral/{code}",
            allow_redirects=False,
            name="Fraud Attempt: Rapid Clicks",
            catch_response=True
        )

        total_attempts += 1
        self.click_count += 1

        if response.status_code == 429:
            # Rate limited - GOOD!
            fraud_blocked += 1
            self.blocked_count += 1
            response.success()
            print(f"✅ Rate limit working: {self.blocked_count}/{self.click_count}")
        elif response.status_code == 403:
            # Fraud detected - GOOD!
            fraud_blocked += 1
            self.blocked_count += 1
            response.success()
            print(f"✅ Fraud detected: {self.blocked_count}/{self.click_count}")
        elif response.status_code in [200, 302]:
            # Click succeeded - BAD if happening too often!
            fraud_succeeded += 1
            response.failure(f"⚠️  Fraud attempt succeeded (attempt #{self.click_count})")
        else:
            response.failure(f"Unexpected status: {response.status_code}")


class SophisticatedFraudBot(HttpUser):
    """
    Simulates a more sophisticated bot that tries to evade detection
    """
    wait_time = between(2, 5)  # Mimics human timing

    def on_start(self):
        """Initialize sophisticated bot with randomized user agent"""
        self.session.headers.update({
            'User-Agent': random.choice([
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
            ])
        })
        self.codes_clicked = []

    @task
    def click_multiple_codes(self):
        """Try to click multiple different codes (fraud pattern)"""
        global fraud_blocked, fraud_succeeded, total_attempts

        # Generate or use different codes
        codes = ["CODE" + str(i) for i in range(1, 20)]
        code = random.choice(codes)

        response = self.client.get(
            f"/api/referral/{code}",
            allow_redirects=False,
            name="Fraud Attempt: Multiple Codes",
            catch_response=True
        )

        total_attempts += 1
        self.codes_clicked.append(code)

        if response.status_code in [429, 403]:
            fraud_blocked += 1
            response.success()
            if len(self.codes_clicked) > 5:
                print(f"✅ Mass fraud detected after {len(self.codes_clicked)} different codes")
        elif response.status_code in [200, 302]:
            fraud_succeeded += 1
            if len(set(self.codes_clicked)) > 3:
                response.failure(f"⚠️  Bot clicked {len(set(self.codes_clicked))} different codes without blocking!")
            else:
                response.success()


class SuspiciousUserAgentBot(HttpUser):
    """
    Bot with obviously suspicious user agent (should be blocked immediately)
    """
    wait_time = between(0.5, 1)

    def on_start(self):
        """Set suspicious user agent"""
        self.session.headers.update({
            'User-Agent': random.choice([
                'python-requests/2.31.0',
                'curl/7.68.0',
                'axios/1.6.0',
                'Go-http-client/1.1',
                'Java/11.0.1',
            ])
        })

    @task
    def click_with_bot_agent(self):
        """Attempt click with bot user agent"""
        global fraud_blocked, fraud_succeeded, total_attempts

        response = self.client.get(
            "/api/referral/TESTCODE01",
            allow_redirects=False,
            name="Fraud Attempt: Bot User-Agent",
            catch_response=True
        )

        total_attempts += 1

        if response.status_code == 403:
            # Should be blocked due to user agent
            fraud_blocked += 1
            response.success()
            print("✅ Bot user-agent blocked")
        elif response.status_code == 429:
            fraud_blocked += 1
            response.success()
        elif response.status_code in [200, 302]:
            fraud_succeeded += 1
            response.failure("❌ Bot user-agent NOT blocked!")
        else:
            response.failure(f"Unexpected status: {response.status_code}")


class HighVelocityAttacker(HttpUser):
    """
    Simulates high-velocity attack (many clicks in short time)
    """
    wait_time = between(0.05, 0.2)  # Very fast - 5-20 requests per second

    @task
    def spam_clicks(self):
        """Spam clicks as fast as possible"""
        global fraud_blocked, fraud_succeeded, total_attempts

        for i in range(10):  # 10 clicks in burst
            response = self.client.get(
                "/api/referral/TESTCODE01",
                allow_redirects=False,
                name="Fraud Attempt: High Velocity",
                catch_response=True
            )

            total_attempts += 1

            if response.status_code in [429, 403]:
                fraud_blocked += 1
                response.success()
            elif response.status_code in [200, 302]:
                fraud_succeeded += 1
                if i > 2:  # Should be blocked by 3rd attempt
                    response.failure(f"⚠️  High velocity not blocked (attempt {i+1}/10)")
                else:
                    response.success()

            time.sleep(0.1)  # Tiny delay between burst
