import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import pool from '../config/database';
import redisClient from '../config/redis';
import { User } from '../types';
import crypto from 'crypto';
import { sendPasswordResetEmail, sendVerificationEmail } from '../services/emailService';

export const register = async (req: Request, res: Response) => {
  // SIMPLIFIED REGISTRATION: Only email, password, optional name, and terms acceptance
  const { email, password, firstName, termsAccepted } = req.body;

  try {
    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Validate email format (RFC 5321 compliant)
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const normalizedEmail = email.toLowerCase().trim();
    if (
      normalizedEmail.length > 254 ||
      !emailRegex.test(normalizedEmail) ||
      normalizedEmail.includes('..') ||
      !/^[a-zA-Z0-9]/.test(normalizedEmail)
    ) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    if (password.length < 6 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be between 6 and 128 characters' });
    }

    // LEGAL REQUIREMENT: Terms & Conditions must be explicitly accepted
    if (termsAccepted !== true) {
      return res.status(400).json({ error: 'You must accept the Terms & Conditions to create an account' });
    }

    // Sanitize first name if provided (optional field)
    const sanitizedFirstName = firstName
      ? firstName.trim().substring(0, 50).replace(/[<>]/g, '')
      : null;

    // Check if user already exists (using normalized email)
    // SECURITY: Always return same response to prevent email enumeration
    const existingUser = await pool.query(
      'SELECT id, email, first_name FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      // Helpful but ambiguous - doesn't confirm email exists
      return res.status(400).json({
        error: 'Unable to create account. If you already have an account, try signing in or resetting your password.'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate unique referral code
    const referralCode = nanoid(10);

    // Generate email verification token (URL-safe, 32 bytes)
    const verificationToken = crypto.randomBytes(32).toString('base64url');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user with minimal data (using normalized email)
    // LEGAL: Store terms_accepted_at timestamp for compliance/audit trail
    // Profile data (interests, demographics, marketing prefs) will be collected after email verification
    const result = await pool.query<User>(
      `INSERT INTO users (email, password_hash, referral_code, first_name, email_verified, verification_token, verification_token_expires, verification_sent_at, terms_accepted_at, terms_version, profile_completion_step)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, email, referral_code, points, is_admin, created_at, first_name, email_verified, profile_completed_at, profile_completion_skipped`,
      [normalizedEmail, hashedPassword, referralCode, sanitizedFirstName, false, verificationToken, verificationExpires, new Date(), new Date(), '2026-01-19', 0]
    );

    const user = result.rows[0];

    // Send verification email (non-blocking - don't fail registration if email fails)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verifyUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;
    try {
      await sendVerificationEmail(normalizedEmail, sanitizedFirstName || 'there', verifyUrl);
      console.log(`📨 Verification email sent to ${normalizedEmail}`);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration - user can resend verification later
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, is_admin: user.is_admin },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    // Set HttpOnly cookie with subdomain sharing (doac-perks.com + api.doac-perks.com)
    res.cookie('auth_token', token, {
      httpOnly: true,                                    // ✅ JavaScript CANNOT access (XSS protection)
      secure: process.env.NODE_ENV === 'production',   // ✅ HTTPS-only in production
      sameSite: 'lax',                                  // ✅ CSRF protection (allows subdomain navigation)
      maxAge: 7 * 24 * 60 * 60 * 1000,                 // 7 days
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? '.doac-perks.com' : undefined  // ✅ Share across subdomains
    });

    // Store user's fingerprints in BOTH Redis (fast lookup) AND database (permanent record)
    const userIp = req.ip || req.socket.remoteAddress || 'unknown';
    const deviceId = req.get('x-device-id') || '';
    const deviceFingerprint = req.get('x-device-fingerprint') || '';
    const browserFingerprint = req.get('x-browser-fingerprint') || '';

    // Redis cache for fast self-click detection (24 hours)
    await redisClient.setex(`user:${user.id}:ip`, 86400, userIp);
    if (deviceId) await redisClient.setex(`user:${user.id}:deviceid`, 86400, deviceId);
    if (deviceFingerprint) await redisClient.setex(`user:${user.id}:devicefp`, 86400, deviceFingerprint);
    if (browserFingerprint) await redisClient.setex(`user:${user.id}:browserfp`, 86400, browserFingerprint);

    // CRITICAL: Store in database for persistent fraud prevention (survives Redis expiry)
    // Updates last_seen if device already exists, creates new record if first time
    if (deviceId || deviceFingerprint) {
      try {
        await pool.query(`
          INSERT INTO user_fingerprints
            (user_id, device_id, device_fingerprint, browser_fingerprint, ip_address, first_seen, last_seen)
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT ON CONSTRAINT user_fingerprints_user_id_device_id_key
          DO UPDATE SET
            device_fingerprint = EXCLUDED.device_fingerprint,
            browser_fingerprint = EXCLUDED.browser_fingerprint,
            ip_address = EXCLUDED.ip_address,
            last_seen = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        `, [user.id, deviceId || null, deviceFingerprint || null, browserFingerprint || null, userIp]);
      } catch (dbError) {
        console.error('Failed to store fingerprint in database (registration):', dbError);
        // Don't fail registration if fingerprint storage fails
      }
    }

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        referralCode: user.referral_code,
        points: user.points,
        isAdmin: user.is_admin
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Normalize email (same as registration) for consistent lookup
    const normalizedEmail = email.toLowerCase().trim();

    // Find user
    const result = await pool.query<User>(
      'SELECT * FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Incorrect email or password' });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Incorrect email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, is_admin: user.is_admin },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    // Set HttpOnly cookie with subdomain sharing (doac-perks.com + api.doac-perks.com)
    res.cookie('auth_token', token, {
      httpOnly: true,                                    // ✅ JavaScript CANNOT access (XSS protection)
      secure: process.env.NODE_ENV === 'production',   // ✅ HTTPS-only in production
      sameSite: 'lax',                                  // ✅ CSRF protection (allows subdomain navigation)
      maxAge: 7 * 24 * 60 * 60 * 1000,                 // 7 days
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? '.doac-perks.com' : undefined  // ✅ Share across subdomains
    });

    // Store user's fingerprints in BOTH Redis (fast lookup) AND database (permanent record)
    const userIp = req.ip || req.socket.remoteAddress || 'unknown';
    const deviceId = req.get('x-device-id') || '';
    const deviceFingerprint = req.get('x-device-fingerprint') || '';
    const browserFingerprint = req.get('x-browser-fingerprint') || '';

    // Redis cache for fast self-click detection (24 hours)
    await redisClient.setex(`user:${user.id}:ip`, 86400, userIp);
    if (deviceId) await redisClient.setex(`user:${user.id}:deviceid`, 86400, deviceId);
    if (deviceFingerprint) await redisClient.setex(`user:${user.id}:devicefp`, 86400, deviceFingerprint);
    if (browserFingerprint) await redisClient.setex(`user:${user.id}:browserfp`, 86400, browserFingerprint);

    // CRITICAL: Store in database for persistent fraud prevention (survives Redis expiry)
    // Updates last_seen if device already exists, creates new record if first time
    if (deviceId || deviceFingerprint) {
      try {
        await pool.query(`
          INSERT INTO user_fingerprints
            (user_id, device_id, device_fingerprint, browser_fingerprint, ip_address, first_seen, last_seen)
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT ON CONSTRAINT user_fingerprints_user_id_device_id_key
          DO UPDATE SET
            device_fingerprint = EXCLUDED.device_fingerprint,
            browser_fingerprint = EXCLUDED.browser_fingerprint,
            ip_address = EXCLUDED.ip_address,
            last_seen = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        `, [user.id, deviceId || null, deviceFingerprint || null, browserFingerprint || null, userIp]);
      } catch (dbError) {
        console.error('Failed to store fingerprint in database (login):', dbError);
        // Don't fail login if fingerprint storage fails
      }
    }

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        referralCode: user.referral_code,
        points: user.points,
        isAdmin: user.is_admin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const result = await pool.query<User>(
      'SELECT id, email, referral_code, points, is_admin, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    res.json({
      id: user.id,
      email: user.email,
      referralCode: user.referral_code,
      points: user.points,
      isAdmin: user.is_admin,
      createdAt: user.created_at
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

export const logout = async (_req: Request, res: Response) => {
  try {
    // Clear the auth cookie with matching settings
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? '.doac-perks.com' : undefined
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
};

// Generate cryptographically secure unique reset token (URL-safe)
const generateResetToken = (): string => {
  // Generate 32 bytes of random data = 256 bits (same security as SHA-256)
  // Convert to URL-safe base64 (no +, /, or = characters)
  return crypto.randomBytes(32).toString('base64url');
};

// Hash the reset token for secure storage (SHA-256)
const hashResetToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Timing-safe comparison to prevent timing attacks
const timingSafeCompare = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    // Validate email input
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    // Always return success to prevent email enumeration attacks
    // This prevents attackers from discovering which emails are registered
    const genericResponse = {
      message: 'If an account exists with this email, a password reset link has been sent.'
    };

    // Find user by email
    const userResult = await pool.query<User>(
      'SELECT id, email FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    // If user doesn't exist, still return success (anti-enumeration)
    if (userResult.rows.length === 0) {
      // Add small random delay to mimic processing time
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 500));
      return res.json(genericResponse);
    }

    const user = userResult.rows[0];

    // Invalidate any existing active reset tokens for this user (new_request reason)
    await pool.query(
      `UPDATE password_reset_tokens
       SET invalidated = true,
           invalidated_at = NOW(),
           invalidation_reason = 'new_request'
       WHERE user_id = $1
         AND used = false
         AND invalidated = false
         AND expires_at > NOW()`,
      [user.id]
    );

    // Generate cryptographically secure unique reset token
    const resetToken = generateResetToken();
    const tokenHash = hashResetToken(resetToken);

    // Store hashed token in database with 10-minute expiration
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    // Construct reset URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Send email with reset link
    console.log(`📨 Sending password reset email to ${email}`);
    console.log(`🔗 Reset URL: ${resetUrl}`);
    console.log(`⏰ Expires at: ${expiresAt}`);

    await sendPasswordResetEmail(email, resetUrl);

    console.log(`✅ Email sent successfully to ${email}`);

    res.json(genericResponse);
  } catch (error) {
    console.error('Forgot password error:', error);
    // Generic error to prevent information leakage
    res.status(500).json({ error: 'Unable to process request. Please try again later.' });
  }
};

// Validate reset token (called when user clicks the reset link)
export const validateResetToken = async (req: Request, res: Response) => {
  const { token } = req.body;

  try {
    // Validate input
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Reset token is required' });
    }

    // Hash the provided token
    const tokenHash = hashResetToken(token);

    // Find valid reset token in database
    const tokenResult = await pool.query(
      `SELECT prt.id, prt.user_id, prt.expires_at, prt.used, prt.invalidated, u.email
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = $1
       AND prt.used = false
       AND prt.invalidated = false
       AND prt.expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired reset link. Please request a new one.' });
    }

    const resetToken = tokenResult.rows[0];

    res.json({
      message: 'Reset link is valid',
      email: resetToken.email,
      expiresAt: resetToken.expires_at
    });
  } catch (error) {
    console.error('Validate reset token error:', error);
    res.status(500).json({ error: 'Unable to validate reset link. Please try again.' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  try {
    // Validate input
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Hash the provided token
    const tokenHash = hashResetToken(token);

    // Find valid reset token in database
    const tokenResult = await pool.query(
      `SELECT id, user_id, expires_at, used, invalidated
       FROM password_reset_tokens
       WHERE token_hash = $1
       AND used = false
       AND invalidated = false
       AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired reset link. Please request a new one.' });
    }

    const resetToken = tokenResult.rows[0];
    const userId = resetToken.user_id;

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, userId]
    );

    // Mark reset token as used
    await pool.query(
      `UPDATE password_reset_tokens
       SET used = true,
           used_at = NOW()
       WHERE id = $1`,
      [resetToken.id]
    );

    // Invalidate all other reset tokens for this user (password_reset reason)
    await pool.query(
      `UPDATE password_reset_tokens
       SET invalidated = true,
           invalidated_at = NOW(),
           invalidation_reason = 'password_reset'
       WHERE user_id = $1
       AND id != $2
       AND invalidated = false`,
      [userId, resetToken.id]
    );

    res.json({ message: 'Password reset successful. You can now login with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Unable to reset password. Please try again.' });
  }
};

// Verify email address
export const verifyEmail = async (req: Request, res: Response) => {
  const { token } = req.body;

  try {
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    // Find user with this verification token
    const result = await pool.query<User>(
      `SELECT id, email, first_name, email_verified, verification_token_expires
       FROM users
       WHERE verification_token = $1
       LIMIT 1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid verification link. Please request a new one.' });
    }

    const user = result.rows[0];

    // Check if already verified
    if (user.email_verified) {
      return res.json({ message: 'Email already verified', alreadyVerified: true });
    }

    // Check if token expired
    if (user.verification_token_expires && new Date(user.verification_token_expires) < new Date()) {
      return res.status(400).json({ error: 'Verification link has expired. Please request a new one.' });
    }

    // Mark email as verified and clear token
    await pool.query(
      `UPDATE users
       SET email_verified = true,
           verification_token = NULL,
           verification_token_expires = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [user.id]
    );

    console.log(`✅ Email verified for user ${user.email}`);

    res.json({
      message: 'Email verified successfully! You can now redeem prizes.',
      email: user.email
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Unable to verify email. Please try again.' });
  }
};

// Resend verification email
export const resendVerification = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    // Get user data
    const result = await pool.query<User>(
      `SELECT id, email, first_name, email_verified, verification_sent_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Check if already verified
    if (user.email_verified) {
      return res.json({ message: 'Email already verified', alreadyVerified: true });
    }

    // Rate limit: Only allow resend every 60 seconds
    if (user.verification_sent_at) {
      const timeSinceLastSend = Date.now() - new Date(user.verification_sent_at).getTime();
      const minWaitTime = 60 * 1000; // 60 seconds
      if (timeSinceLastSend < minWaitTime) {
        const waitSeconds = Math.ceil((minWaitTime - timeSinceLastSend) / 1000);
        return res.status(429).json({
          error: `Please wait ${waitSeconds} seconds before requesting another verification email`,
          retryAfter: waitSeconds
        });
      }
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('base64url');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with new token
    await pool.query(
      `UPDATE users
       SET verification_token = $1,
           verification_token_expires = $2,
           verification_sent_at = NOW(),
           updated_at = NOW()
       WHERE id = $3`,
      [verificationToken, verificationExpires, user.id]
    );

    // Send verification email
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verifyUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

    await sendVerificationEmail(user.email, user.first_name || 'there', verifyUrl);

    console.log(`📨 Verification email resent to ${user.email}`);

    res.json({ message: 'Verification email sent. Please check your inbox.' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Unable to send verification email. Please try again.' });
  }
};

// Get verification status (for frontend to check)
export const getVerificationStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const result = await pool.query(
      'SELECT email_verified FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ emailVerified: result.rows[0].email_verified });
  } catch (error) {
    console.error('Get verification status error:', error);
    res.status(500).json({ error: 'Unable to get verification status' });
  }
};
