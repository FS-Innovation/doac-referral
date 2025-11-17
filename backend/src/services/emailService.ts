import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';

// Initialize SendGrid with API key
if (process.env.EMAIL_PASS && process.env.EMAIL_PASS.startsWith('SG.')) {
  sgMail.setApiKey(process.env.EMAIL_PASS);
}

interface PurchaseNotificationData {
  userEmail: string;
  productName: string;
  pointsSpent: number;
  remainingPoints: number;
}

// Create reusable transporter
const createTransporter = () => {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('Email configuration not complete. Emails will not be sent.');
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

export const sendPurchaseNotification = async (data: PurchaseNotificationData) => {
  const transporter = createTransporter();

  if (!transporter) {
    console.log('Skipping email notification - email not configured');
    return;
  }

  try {
    // Email to user
    await transporter.sendMail({
      from: `"Referral System" <${process.env.EMAIL_USER}>`,
      to: data.userEmail,
      subject: 'Purchase Confirmation',
      html: `
        <h2>Purchase Confirmed!</h2>
        <p>Thank you for your purchase!</p>
        <p><strong>Product:</strong> ${data.productName}</p>
        <p><strong>Points Spent:</strong> ${data.pointsSpent}</p>
        <p><strong>Remaining Points:</strong> ${data.remainingPoints}</p>
        <p>We will process your order shortly.</p>
      `
    });

    // Email to admin
    if (process.env.ADMIN_EMAIL) {
      await transporter.sendMail({
        from: `"Referral System" <${process.env.EMAIL_USER}>`,
        to: process.env.ADMIN_EMAIL,
        subject: 'New Purchase Notification',
        html: `
          <h2>New Purchase</h2>
          <p><strong>User:</strong> ${data.userEmail}</p>
          <p><strong>Product:</strong> ${data.productName}</p>
          <p><strong>Points Spent:</strong> ${data.pointsSpent}</p>
          <p>Please fulfill this order.</p>
        `
      });
    }

    console.log('Purchase notification emails sent successfully');
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
};

export const sendPasswordResetEmail = async (email: string, resetCode: string) => {
  // Use SendGrid SDK if available
  if (process.env.EMAIL_PASS && process.env.EMAIL_PASS.startsWith('SG.')) {
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'innovation@flightstory.com';
    try {
      await sgMail.send({
        to: email,
        from: fromEmail,
        subject: 'Password Reset Code - DOAC Perks',
        text: `Your password reset code is: ${resetCode}. This code expires in 10 minutes.`,
        html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #f9f9f9;
              border-radius: 8px;
              padding: 30px;
              border: 1px solid #e0e0e0;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            h1 {
              color: #2563eb;
              margin: 0;
              font-size: 24px;
            }
            .code-container {
              background-color: #fff;
              border: 2px solid #2563eb;
              border-radius: 8px;
              padding: 20px;
              text-align: center;
              margin: 30px 0;
            }
            .code {
              font-size: 36px;
              font-weight: bold;
              letter-spacing: 8px;
              color: #2563eb;
              font-family: 'Courier New', monospace;
            }
            .warning {
              background-color: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e0e0e0;
              font-size: 12px;
              color: #666;
              text-align: center;
            }
            .security-tips {
              background-color: #fff;
              border-radius: 4px;
              padding: 15px;
              margin: 20px 0;
            }
            .security-tips h3 {
              margin-top: 0;
              color: #2563eb;
              font-size: 16px;
            }
            ul {
              margin: 10px 0;
              padding-left: 20px;
            }
            li {
              margin: 5px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>

            <p>Hello,</p>

            <p>You requested to reset your password. Use the verification code below to continue:</p>

            <div class="code-container">
              <div class="code">${resetCode}</div>
            </div>

            <p style="text-align: center; color: #666; font-size: 14px;">
              This code will expire in <strong>10 minutes</strong>
            </p>

            <div class="warning">
              <strong>⚠️ Security Notice:</strong> If you did not request this password reset, please ignore this email. Your account remains secure.
            </div>

            <div class="security-tips">
              <h3>🔒 Security Tips</h3>
              <ul>
                <li>Never share this code with anyone</li>
                <li>Our support team will never ask for this code</li>
                <li>This code can only be used once</li>
                <li>It must be used from the same device that requested it</li>
              </ul>
            </div>

            <div class="footer">
              <p>This is an automated message from the Referral System.</p>
              <p>If you have any questions or concerns, please contact our support team.</p>
            </div>
          </div>
        </body>
        </html>
      `
      });

      console.log(`✅ Password reset email sent to ${email} via SendGrid`);
      return;
    } catch (error) {
      console.error('❌ Failed to send password reset email via SendGrid:', error);
      throw error;
    }
  }

  // Fallback to SMTP if SendGrid not configured
  const transporter = createTransporter();

  if (!transporter) {
    console.log('Skipping password reset email - email not configured');
    return;
  }

  try {
    await transporter.sendMail({
      from: `"DOAC Perks Security" <innovation@flightstory.com>`,
      to: email,
      subject: 'Password Reset Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #f9f9f9;
              border-radius: 8px;
              padding: 30px;
              border: 1px solid #e0e0e0;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            h1 {
              color: #2563eb;
              margin: 0;
              font-size: 24px;
            }
            .code-container {
              background-color: #fff;
              border: 2px solid #2563eb;
              border-radius: 8px;
              padding: 20px;
              text-align: center;
              margin: 30px 0;
            }
            .code {
              font-size: 36px;
              font-weight: bold;
              letter-spacing: 8px;
              color: #2563eb;
              font-family: 'Courier New', monospace;
            }
            .warning {
              background-color: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e0e0e0;
              font-size: 12px;
              color: #666;
              text-align: center;
            }
            .security-tips {
              background-color: #fff;
              border-radius: 4px;
              padding: 15px;
              margin: 20px 0;
            }
            .security-tips h3 {
              margin-top: 0;
              color: #2563eb;
              font-size: 16px;
            }
            ul {
              margin: 10px 0;
              padding-left: 20px;
            }
            li {
              margin: 5px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>

            <p>Hello,</p>

            <p>You requested to reset your password. Use the verification code below to continue:</p>

            <div class="code-container">
              <div class="code">${resetCode}</div>
            </div>

            <p style="text-align: center; color: #666; font-size: 14px;">
              This code will expire in <strong>10 minutes</strong>
            </p>

            <div class="warning">
              <strong>⚠️ Security Notice:</strong> If you did not request this password reset, please ignore this email. Your account remains secure.
            </div>

            <div class="security-tips">
              <h3>🔒 Security Tips</h3>
              <ul>
                <li>Never share this code with anyone</li>
                <li>Our support team will never ask for this code</li>
                <li>This code can only be used once</li>
                <li>It must be used from the same device that requested it</li>
              </ul>
            </div>

            <div class="footer">
              <p>This is an automated message from the Referral System.</p>
              <p>If you have any questions or concerns, please contact our support team.</p>
            </div>
          </div>
        </body>
        </html>
      `
    });

    console.log(`✅ Password reset email sent to ${email} via SMTP`);
  } catch (error) {
    console.error('❌ Failed to send password reset email:', error);
    throw error;
  }
};
