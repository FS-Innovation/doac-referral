// SendGrid Email Test Script
// This script tests the SendGrid email functionality
// Make sure to set SENDGRID_API_KEY in your environment or .env file

require('dotenv').config({ path: './sendgrid.env' });

const sgMail = require('@sendgrid/mail');

// Set API key from environment variable
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Uncomment the line below if you are sending mail using a regional EU subuser
// sgMail.setDataResidency('eu');

const msg = {
  to: 'marcus@flightstory.com', // Change to your recipient email
  from: 'team@doac-perks.com', // Change to your verified sender email
  subject: 'Sending with SendGrid is Fun',
  text: 'and easy to do anywhere, even with Node.js',
  html: '<strong>and easy to do anywhere, even with Node.js</strong>',
};

console.log('Testing SendGrid email configuration...');
console.log('API Key present:', !!process.env.SENDGRID_API_KEY);
console.log('Attempting to send test email...\n');

sgMail
  .send(msg)
  .then(() => {
    console.log('✓ Email sent successfully!');
    console.log('Check your inbox for the test email.');
  })
  .catch((error) => {
    console.error('✗ Error sending email:');
    console.error('Status:', error.code);
    console.error('Message:', error.message);
    if (error.response) {
      console.error('Response body:', error.response.body);
    }
  });
