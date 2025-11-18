import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import pool from '../config/database';
import redisClient from '../config/redis';
import { User } from '../types';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '../services/emailService';

export const register = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate unique referral code
    const referralCode = nanoid(10);

    // Create user
    const result = await pool.query<User>(
      `INSERT INTO users (email, password_hash, referral_code)
       VALUES ($1, $2, $3)
       RETURNING id, email, referral_code, points, is_admin, created_at`,
      [email, hashedPassword, referralCode]
    );

    const user = result.rows[0];

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

    // Find user
    const result = await pool.query<User>(
      'SELECT * FROM users WHERE email = $1',
      [email]
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
