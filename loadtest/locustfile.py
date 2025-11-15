"""
Locust Load Testing Suite for DOAC Referral System
===================================================

This comprehensive test suite simulates real user behavior including:
- User registration and login
- Browsing products
- Clicking referral links
- Making purchases
- Admin dashboard access

Run with: locust -f locustfile.py --host=https://your-app.web.app
"""

from locust import HttpUser, task, between, SequentialTaskSet
import random
import string
import json

# Test data
REFERRAL_CODES = []  # Will be populated during test
TEST_USERS = []


def generate_random_email():
    """Generate a unique email address for testing"""
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))
    return f"test_{random_str}@example.com"


def generate_random_password():
    """Generate a secure random password"""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=12))


class UserJourneyTaskSet(SequentialTaskSet):
    """
    Sequential task set representing a complete user journey
    """

    def on_start(self):
        """Initialize user data when task set starts"""
        self.email = generate_random_email()
        self.password = generate_random_password()
        self.token = None
        self.user_data = None
        self.referral_code = None

    @task
    def register(self):
        """Task 1: User registration"""
        response = self.client.post("/api/auth/register", json={
            "email": self.email,
            "password": self.password
        }, name="Register")

        if response.status_code == 201:
            data = response.json()
            self.token = data.get('token')
            self.user_data = data.get('user')
            self.referral_code = self.user_data.get('referralCode')

            # Add to global list for other users to click
            if self.referral_code and self.referral_code not in REFERRAL_CODES:
                REFERRAL_CODES.append(self.referral_code)

            print(f"✅ Registered: {self.email} with code: {self.referral_code}")
        else:
            print(f"❌ Registration failed: {response.status_code}")

    @task
    def view_dashboard(self):
        """Task 2: View user dashboard"""
        if not self.token:
            return

        headers = {"Authorization": f"Bearer {self.token}"}
        response = self.client.get("/api/auth/profile", headers=headers, name="View Dashboard")

        if response.status_code == 200:
            print(f"📊 Dashboard loaded for: {self.email}")

    @task
    def get_referral_stats(self):
        """Task 3: Check referral statistics"""
        if not self.token:
            return

        headers = {"Authorization": f"Bearer {self.token}"}
        response = self.client.get("/api/user/referral-stats", headers=headers, name="Referral Stats")

        if response.status_code == 200:
            stats = response.json()
            print(f"📈 {self.email} - Points: {stats.get('points')}, Clicks: {stats.get('totalClicks')}")

    @task
    def browse_products(self):
        """Task 4: Browse available products"""
        if not self.token:
            return

        headers = {"Authorization": f"Bearer {self.token}"}
        response = self.client.get("/api/products", headers=headers, name="Browse Products")

        if response.status_code == 200:
            products = response.json()
            print(f"🛍️  {self.email} viewing {len(products)} products")

    @task
    def get_purchase_history(self):
        """Task 5: View purchase history"""
        if not self.token:
            return

        headers = {"Authorization": f"Bearer {self.token}"}
        response = self.client.get("/api/user/purchase-history", headers=headers, name="Purchase History")

        if response.status_code == 200:
            print(f"🛒 Purchase history loaded for: {self.email}")


class ReferralClickerTaskSet(SequentialTaskSet):
    """
    Task set simulating users clicking referral links
    """

    @task
    def click_random_referral(self):
        """Click a random referral link"""
        if not REFERRAL_CODES:
            print("⚠️  No referral codes available yet")
            return

        code = random.choice(REFERRAL_CODES)
        response = self.client.get(f"/api/referral/{code}",
                                   allow_redirects=False,
                                   name="Click Referral Link")

        if response.status_code in [200, 302]:
            print(f"🔗 Clicked referral code: {code}")
        elif response.status_code == 429:
            print(f"⚠️  Rate limited on code: {code}")
        else:
            print(f"❌ Referral click failed: {response.status_code}")


class NormalUser(HttpUser):
    """
    Normal user behavior - registration, browsing, checking stats
    Weight: 60% of users
    """
    wait_time = between(2, 5)
    weight = 60
    tasks = [UserJourneyTaskSet]


class ReferralClicker(HttpUser):
    """
    User who primarily clicks referral links
    Weight: 30% of users
    """
    wait_time = between(1, 3)
    weight = 30
    tasks = [ReferralClickerTaskSet]


class QuickBrowser(HttpUser):
    """
    User who quickly browses without registering
    Weight: 10% of users
    """
    wait_time = between(0.5, 2)
    weight = 10

    @task(3)
    def quick_browse_products(self):
        """Quick anonymous browsing (will fail - requires auth)"""
        self.client.get("/api/products", name="Anonymous Browse (Expected Fail)")

    @task(1)
    def check_health(self):
        """Check if server is healthy"""
        response = self.client.get("/health", name="Health Check")
        if response.status_code == 200:
            data = response.json()
            print(f"❤️  Server healthy: {data.get('environment')}")


# For distributed testing
class AdminUser(HttpUser):
    """
    Admin user accessing admin endpoints
    Weight: 2% of users (rare, but should be tested)
    """
    wait_time = between(5, 10)
    weight = 2

    def on_start(self):
        """Login as admin"""
        # Note: You'll need to create an admin user first
        self.client.post("/api/auth/login", json={
            "email": "admin@example.com",
            "password": "admin123"
        })

    @task
    def view_analytics(self):
        """View admin analytics"""
        self.client.get("/api/admin/analytics", name="Admin Analytics")

    @task
    def view_all_users(self):
        """View all users"""
        self.client.get("/api/admin/users", name="Admin View Users")

    @task
    def view_all_products_admin(self):
        """View all products (admin view)"""
        self.client.get("/api/admin/products", name="Admin View Products")
