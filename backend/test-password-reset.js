require('dotenv').config();
const { sendPasswordResetEmail } = require('./dist/services/emailService');

// Test the password reset email function
const testEmail = 'innovation@flightstory.com';
const testCode = '123456';

console.log('Testing password reset email...');
console.log('To:', testEmail);
console.log('Code:', testCode);
console.log('EMAIL_PASS starts with SG.:', process.env.EMAIL_PASS?.startsWith('SG.'));
console.log('EMAIL_PASS value:', process.env.EMAIL_PASS?.substring(0, 10) + '...');

sendPasswordResetEmail(testEmail, testCode)
  .then(() => {
    console.log('\n✅ Password reset email sent successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error sending password reset email:');
    console.error(error.response ? error.response.body : error);
    process.exit(1);
  });
