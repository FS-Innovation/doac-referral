import nodemailer from 'nodemailer';

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
