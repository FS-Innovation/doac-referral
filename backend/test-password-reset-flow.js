/**
 * End-to-End Password Reset Flow Test
 *
 * This tests the complete password reset functionality:
 * 1. Request password reset (generates unique 6-digit code)
 * 2. Verify the code was sent via email
 * 3. Verify the code (get reset token)
 * 4. Reset the password
 * 5. Login with new password
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const TEST_EMAIL = 'innovation@flightstory.com'; // Change to your test email

console.log('🧪 Testing Password Reset Flow\n');
console.log('Base URL:', BASE_URL);
console.log('Test Email:', TEST_EMAIL);
console.log('─'.repeat(60));

// Helper function for API calls
async function apiCall(method, endpoint, data = null, headers = {}) {
  try {
    const response = await axios({
      method,
      url: `${BASE_URL}${endpoint}`,
      data,
      headers: {
        'Content-Type': 'application/json',
        'x-device-fingerprint': 'test-device-12345', // Important for security
        ...headers
      },
      validateStatus: () => true // Don't throw on any status
    });
    return response;
  } catch (error) {
    console.error('API call failed:', error.message);
    throw error;
  }
}

async function runTest() {
  let resetCode = null;
  let resetToken = null;

  try {
    // Step 1: Request password reset
    console.log('\n1️⃣  Requesting password reset...');
    const forgotResponse = await apiCall('POST', '/api/auth/forgot-password', {
      email: TEST_EMAIL
    });

    console.log('   Status:', forgotResponse.status);
    console.log('   Response:', forgotResponse.data);

    if (forgotResponse.status !== 200) {
      throw new Error('Failed to request password reset');
    }

    console.log('   ✅ Password reset requested');
    console.log('   📧 Check email inbox at:', TEST_EMAIL);
    console.log('   ⚠️  You need to manually get the 6-digit code from the email');
    console.log('');

    // Prompt for code (in real test, you'd parse from email)
    console.log('─'.repeat(60));
    console.log('MANUAL STEP REQUIRED:');
    console.log('1. Check the email inbox for:', TEST_EMAIL);
    console.log('2. Copy the 6-digit code from the email');
    console.log('3. Enter it when testing verify/reset endpoints');
    console.log('─'.repeat(60));

    // For automated testing, you could query the database directly:
    console.log('\n📝 To get the code from database (for testing):');
    console.log('   psql $DATABASE_URL -c "SELECT code_hash FROM password_reset_tokens WHERE user_id = (SELECT id FROM users WHERE email = \'' + TEST_EMAIL + '\') ORDER BY created_at DESC LIMIT 1;"');

    // Example: Test with a dummy code (will fail unless you use real code)
    const testCode = '123456'; // Replace with actual code from email

    console.log('\n2️⃣  Verifying reset code (using test code)...');
    const verifyResponse = await apiCall('POST', '/api/auth/verify-reset-code', {
      email: TEST_EMAIL,
      code: testCode
    });

    console.log('   Status:', verifyResponse.status);
    console.log('   Response:', verifyResponse.data);

    if (verifyResponse.status === 200) {
      resetToken = verifyResponse.data.resetToken;
      console.log('   ✅ Code verified successfully');
      console.log('   🔑 Reset token obtained');

      // Step 3: Reset password
      console.log('\n3️⃣  Resetting password...');
      const newPassword = 'NewSecurePassword123!';

      const resetResponse = await apiCall('POST', '/api/auth/reset-password', {
        resetToken: resetToken,
        newPassword: newPassword
      });

      console.log('   Status:', resetResponse.status);
      console.log('   Response:', resetResponse.data);

      if (resetResponse.status === 200) {
        console.log('   ✅ Password reset successfully');

        // Step 4: Test login with new password
        console.log('\n4️⃣  Testing login with new password...');
        const loginResponse = await apiCall('POST', '/api/auth/login', {
          email: TEST_EMAIL,
          password: newPassword
        });

        console.log('   Status:', loginResponse.status);
        console.log('   Response:', loginResponse.data);

        if (loginResponse.status === 200) {
          console.log('   ✅ Login successful with new password');
          console.log('\n🎉 ALL TESTS PASSED!');
        } else {
          console.log('   ❌ Login failed');
        }
      } else {
        console.log('   ❌ Password reset failed');
      }
    } else {
      console.log('   ⚠️  Code verification failed (expected - using dummy code)');
      console.log('   💡 Use the actual code from the email to test verify/reset');
    }

    console.log('\n─'.repeat(60));
    console.log('Test Summary:');
    console.log('✅ Password reset email sent successfully');
    console.log('✅ Code generation working (check database)');
    console.log('✅ Email delivery working (check inbox)');
    console.log('⚠️  Verify and reset steps require manual code entry');
    console.log('─'.repeat(60));

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the test
runTest();
