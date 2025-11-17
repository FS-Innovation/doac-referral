const axios = require('axios');

async function test() {
  console.log('Testing forgot password endpoint...\n');
  
  try {
    const response = await axios.post('http://localhost:5000/api/auth/forgot-password', {
      email: 'innovation@flightstory.com'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-device-fingerprint': 'test-device-12345'
      }
    });
    
    console.log('✅ API Response:', response.status, response.data);
    console.log('\n📧 Now check:');
    console.log('1. Backend server console for email sending logs');
    console.log('2. Email inbox at innovation@flightstory.com');
    console.log('3. SendGrid activity feed: https://app.sendgrid.com/email_activity');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

test();
