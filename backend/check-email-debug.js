require('dotenv').config();

console.log('\n🔍 Environment Check:\n');
console.log('EMAIL_HOST:', process.env.EMAIL_HOST);
console.log('EMAIL_PORT:', process.env.EMAIL_PORT);
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS exists:', !!process.env.EMAIL_PASS);
console.log('EMAIL_PASS starts with SG.:', process.env.EMAIL_PASS?.startsWith('SG.'));
console.log('SENDGRID_FROM_EMAIL:', process.env.SENDGRID_FROM_EMAIL);
console.log('\n');

const sgMail = require('@sendgrid/mail');

if (process.env.EMAIL_PASS && process.env.EMAIL_PASS.startsWith('SG.')) {
  console.log('✅ SendGrid is configured');
  sgMail.setApiKey(process.env.EMAIL_PASS);
  
  console.log('\nSending test email...\n');
  
  sgMail.send({
    to: 'innovation@flightstory.com',
    from: process.env.SENDGRID_FROM_EMAIL || 'doacperks@gmail.com',
    subject: 'Test - Password Reset Debug',
    text: 'Testing SendGrid from localhost',
    html: '<strong>Your reset code: 123456</strong>'
  })
  .then((response) => {
    console.log('✅ Email sent! Status:', response[0].statusCode);
    console.log('Check inbox at: innovation@flightstory.com');
  })
  .catch((error) => {
    console.error('❌ SendGrid Error:');
    console.error(error.response ? error.response.body : error);
  });
} else {
  console.log('❌ SendGrid NOT configured - EMAIL_PASS does not start with SG.');
}
