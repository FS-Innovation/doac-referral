import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';

// Initialize SendGrid with API key (prefer SENDGRID_API_KEY, fallback to EMAIL_PASS)
const sendgridApiKey = process.env.SENDGRID_API_KEY ||
  (process.env.EMAIL_PASS && process.env.EMAIL_PASS.startsWith('SG.') ? process.env.EMAIL_PASS : null);

if (sendgridApiKey) {
  sgMail.setApiKey(sendgridApiKey);
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

export const sendPasswordResetEmail = async (email: string, resetUrl: string) => {
  // Use SendGrid SDK if available
  if (sendgridApiKey) {
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'innovation@flightstory.com';
    try {
      await sgMail.send({
        to: email,
        from: {
          email: fromEmail,
          name: 'DOAC Team'
        },
        subject: 'Reset Your Password - DOAC Perks',
        text: `You requested to reset your password. Click the link below to reset it:\n\n${resetUrl}\n\nThis link will expire in 10 minutes. If you did not request this, please ignore this email.`,
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
              color: #ffffff;
              max-width: 600px;
              margin: 0 auto;
              padding: 0;
              background-color: #000000;
            }
            .container {
              background-color: #0D0D0D;
              border: 1px solid #333333;
              border-radius: 0;
              padding: 0;
            }
            .logo-header {
              text-align: center;
              padding: 40px 20px 30px;
              background-color: #000000;
            }
            .logo-header img {
              width: 80px;
              height: 80px;
            }
            .content {
              padding: 30px 40px;
              text-align: center;
            }
            h1 {
              color: #ffffff;
              margin: 0 0 20px 0;
              font-size: 24px;
              font-weight: 600;
              text-align: center;
            }
            p {
              color: #cccccc;
              margin: 16px auto;
              font-size: 15px;
              text-align: center;
            }
            .reset-button {
              display: inline-block;
              margin: 30px auto;
              padding: 14px 32px;
              background: #0D0D0D;
              background-clip: padding-box;
              border: 2px solid transparent;
              border-radius: 8px;
              background-image: linear-gradient(#0D0D0D, #0D0D0D), linear-gradient(135deg, #919191 0%, #5A2F30 100%);
              background-origin: border-box;
              background-clip: padding-box, border-box;
              color: #ffffff !important;
              text-align: center;
              text-decoration: none;
              font-size: 16px;
              font-weight: 600;
            }
            .expiry-notice {
              text-align: center;
              color: #999999;
              font-size: 14px;
              margin: 20px 0;
            }
            .expiry-notice strong {
              color: #ffffff;
            }
            .security-notice {
              background-color: #1a1a1a;
              border-left: 3px solid #5A2F30;
              padding: 16px;
              margin: 25px auto;
              max-width: 500px;
              color: #cccccc;
              font-size: 14px;
              text-align: center;
            }
            .security-notice strong {
              color: #ffffff;
            }
            .alt-link {
              background-color: #1a1a1a;
              border: 1px solid #333333;
              border-radius: 8px;
              padding: 16px;
              margin: 25px auto;
              max-width: 500px;
              word-break: break-all;
              text-align: center;
            }
            .alt-link p {
              margin: 0 0 10px 0;
              font-size: 13px;
              color: #999999;
              text-align: center;
            }
            .alt-link a {
              color: #ffffff;
              font-size: 12px;
              text-decoration: underline;
            }
            .footer {
              margin-top: 40px;
              padding: 20px 40px 30px;
              border-top: 1px solid #333333;
              font-size: 13px;
              color: #666666;
              text-align: center;
            }
            .footer p {
              margin: 8px 0;
              color: #666666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo-header">
              <img src="https://storage.googleapis.com/doac-perks/doac-icon.png" alt="DOAC" />
            </div>

            <div class="content">
              <h1>Reset Your Password</h1>

              <p>You requested to reset your password for your DOAC Perks account. Click the button below to create a new password:</p>

              <a href="${resetUrl}" class="reset-button">Reset My Password</a>

              <p class="expiry-notice">
                This link will expire in <strong>10 minutes</strong> for security reasons.
              </p>

              <div class="security-notice">
                <strong>Security Notice:</strong> If you did not request this password reset, please ignore this email. Your account will remain secure and no changes will be made.
              </div>

              <div class="alt-link">
                <p><strong>Button not working?</strong></p>
                <p>Copy and paste this link into your browser:</p>
                <a href="${resetUrl}">${resetUrl}</a>
              </div>
            </div>

            <div class="footer">
              <p>This is an automated message from DOAC Perks.</p>
              <p>Please do not reply to this email.</p>
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
      from: `"DOAC Team" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Reset Your Password - DOAC Perks',
      text: `You requested to reset your password. Click the link below to reset it:\n\n${resetUrl}\n\nThis link will expire in 10 minutes. If you did not request this, please ignore this email.`,
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
              color: #ffffff;
              max-width: 600px;
              margin: 0 auto;
              padding: 0;
              background-color: #000000;
            }
            .container {
              background-color: #0D0D0D;
              border: 1px solid #333333;
              border-radius: 0;
              padding: 0;
            }
            .logo-header {
              text-align: center;
              padding: 40px 20px 30px;
              background-color: #000000;
            }
            .logo-header img {
              width: 80px;
              height: 80px;
            }
            .content {
              padding: 30px 40px;
              text-align: center;
            }
            h1 {
              color: #ffffff;
              margin: 0 0 20px 0;
              font-size: 24px;
              font-weight: 600;
              text-align: center;
            }
            p {
              color: #cccccc;
              margin: 16px auto;
              font-size: 15px;
              text-align: center;
            }
            .reset-button {
              display: inline-block;
              margin: 30px auto;
              padding: 14px 32px;
              background: #0D0D0D;
              background-clip: padding-box;
              border: 2px solid transparent;
              border-radius: 8px;
              background-image: linear-gradient(#0D0D0D, #0D0D0D), linear-gradient(135deg, #919191 0%, #5A2F30 100%);
              background-origin: border-box;
              background-clip: padding-box, border-box;
              color: #ffffff !important;
              text-align: center;
              text-decoration: none;
              font-size: 16px;
              font-weight: 600;
            }
            .expiry-notice {
              text-align: center;
              color: #999999;
              font-size: 14px;
              margin: 20px 0;
            }
            .expiry-notice strong {
              color: #ffffff;
            }
            .security-notice {
              background-color: #1a1a1a;
              border-left: 3px solid #5A2F30;
              padding: 16px;
              margin: 25px auto;
              max-width: 500px;
              color: #cccccc;
              font-size: 14px;
              text-align: center;
            }
            .security-notice strong {
              color: #ffffff;
            }
            .alt-link {
              background-color: #1a1a1a;
              border: 1px solid #333333;
              border-radius: 8px;
              padding: 16px;
              margin: 25px auto;
              max-width: 500px;
              word-break: break-all;
              text-align: center;
            }
            .alt-link p {
              margin: 0 0 10px 0;
              font-size: 13px;
              color: #999999;
              text-align: center;
            }
            .alt-link a {
              color: #ffffff;
              font-size: 12px;
              text-decoration: underline;
            }
            .footer {
              margin-top: 40px;
              padding: 20px 40px 30px;
              border-top: 1px solid #333333;
              font-size: 13px;
              color: #666666;
              text-align: center;
            }
            .footer p {
              margin: 8px 0;
              color: #666666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo-header">
              <img src="https://storage.googleapis.com/doac-perks/doac-icon.png" alt="DOAC" />
            </div>

            <div class="content">
              <h1>Reset Your Password</h1>

              <p>You requested to reset your password for your DOAC Perks account. Click the button below to create a new password:</p>

              <a href="${resetUrl}" class="reset-button">Reset My Password</a>

              <p class="expiry-notice">
                This link will expire in <strong>10 minutes</strong> for security reasons.
              </p>

              <div class="security-notice">
                <strong>Security Notice:</strong> If you did not request this password reset, please ignore this email. Your account will remain secure and no changes will be made.
              </div>

              <div class="alt-link">
                <p><strong>Button not working?</strong></p>
                <p>Copy and paste this link into your browser:</p>
                <a href="${resetUrl}">${resetUrl}</a>
              </div>
            </div>

            <div class="footer">
              <p>This is an automated message from DOAC Perks.</p>
              <p>Please do not reply to this email.</p>
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
