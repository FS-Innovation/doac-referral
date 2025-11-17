import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import pool from '../config/database';
import redisClient from '../config/redis';
import { User } from '../types';
import crypto from 'crypto';

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

    // Store user's fingerprints in Redis for self-click prevention (expires in 24 hours)
    const userIp = req.ip || req.socket.remoteAddress || 'unknown';
    const deviceId = req.get('x-device-id') || '';
    const deviceFingerprint = req.get('x-device-fingerprint') || '';
    const browserFingerprint = req.get('x-browser-fingerprint') || '';

    await redisClient.setex(`user:${user.id}:ip`, 86400, userIp);
    if (deviceId) await redisClient.setex(`user:${user.id}:deviceid`, 86400, deviceId);
    if (deviceFingerprint) await redisClient.setex(`user:${user.id}:devicefp`, 86400, deviceFingerprint);
    if (browserFingerprint) await redisClient.setex(`user:${user.id}:browserfp`, 86400, browserFingerprint);

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
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
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

    // Store user's fingerprints in Redis for self-click prevention (expires in 24 hours)
    const userIp = req.ip || req.socket.remoteAddress || 'unknown';
    const deviceId = req.get('x-device-id') || '';
    const deviceFingerprint = req.get('x-device-fingerprint') || '';
    const browserFingerprint = req.get('x-browser-fingerprint') || '';

    await redisClient.setex(`user:${user.id}:ip`, 86400, userIp);
    if (deviceId) await redisClient.setex(`user:${user.id}:deviceid`, 86400, deviceId);
    if (deviceFingerprint) await redisClient.setex(`user:${user.id}:devicefp`, 86400, deviceFingerprint);
    if (browserFingerprint) await redisClient.setex(`user:${user.id}:browserfp`, 86400, browserFingerprint);

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

// Generate cryptographically secure 6-digit code
const generateResetCode = (): string => {
  // Generate a random number between 100000 and 999999
  const buffer = crypto.randomBytes(4);
  const num = buffer.readUInt32BE(0);
  const code = (num % 900000) + 100000;
  return code.toString();
};

// Hash the reset code for secure storage
const hashResetCode = (code: string): string => {
  return crypto.createHash('sha256').update(code).digest('hex');
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

    // Get device fingerprint for security
    const deviceFingerprint = req.get('x-device-fingerprint') ||
                             req.get('x-device-id') ||
                             req.ip ||
                             'unknown';

    // Always return success to prevent email enumeration attacks
    // This prevents attackers from discovering which emails are registered
    const genericResponse = {
      message: 'If an account exists with this email, a password reset code has been sent.'
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

    // Invalidate any existing active reset tokens for this user
    await pool.query(
      'UPDATE password_reset_tokens SET used = true, used_at = NOW() WHERE user_id = $1 AND used = false',
      [user.id]
    );

    // Generate 6-digit reset code
    const resetCode = generateResetCode();
    const codeHash = hashResetCode(resetCode);

    // Store hashed code in database with 10-minute expiration
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, code_hash, device_fingerprint, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [user.id, codeHash, deviceFingerprint, expiresAt]
    );

    // Send email with reset code
    console.log(`📨 Sending password reset email to ${email}`);
    console.log(`🔑 Reset code: ${resetCode}`);
    console.log(`⏰ Expires at: ${expiresAt}`);

    const { sendPasswordResetEmail } = await import('../services/emailService.js');
    await sendPasswordResetEmail(email, resetCode);

    console.log(`✅ Email sent successfully to ${email}`);

    res.json(genericResponse);
  } catch (error) {
    console.error('Forgot password error:', error);
    // Generic error to prevent information leakage
    res.status(500).json({ error: 'Unable to process request. Please try again later.' });
  }
};

export const verifyResetCode = async (req: Request, res: Response) => {
  const { email, code } = req.body;

  try {
    // Validate input
    if (!email || !code || typeof code !== 'string' || code.length !== 6) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Get device fingerprint
    const deviceFingerprint = req.get('x-device-fingerprint') ||
                             req.get('x-device-id') ||
                             req.ip ||
                             'unknown';

    // Find user
    const userResult = await pool.query<User>(
      'SELECT id, email FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired verification code' });
    }

    const user = userResult.rows[0];
    const codeHash = hashResetCode(code);

    // Find valid reset token
    const tokenResult = await pool.query(
      `SELECT id, code_hash, device_fingerprint, expires_at, used
       FROM password_reset_tokens
       WHERE user_id = $1
       AND used = false
       AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired verification code' });
    }

    const token = tokenResult.rows[0];

    // Verify the code hash matches (timing-safe comparison)
    if (!timingSafeCompare(token.code_hash, codeHash)) {
      return res.status(401).json({ error: 'Invalid or expired verification code' });
    }

    // Verify device fingerprint matches (prevents code theft)
    if (token.device_fingerprint !== deviceFingerprint) {
      console.warn(`Device fingerprint mismatch for user ${user.id}. Original: ${token.device_fingerprint}, Current: ${deviceFingerprint}`);
      return res.status(401).json({ error: 'Verification code must be used from the same device' });
    }

    // Generate a temporary session token for password reset (valid for 5 minutes)
    const resetToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        purpose: 'password_reset',
        tokenId: token.id
      },
      process.env.JWT_SECRET!,
      { expiresIn: '5m' }
    );

    res.json({
      message: 'Verification successful',
      resetToken
    });
  } catch (error) {
    console.error('Verify reset code error:', error);
    res.status(500).json({ error: 'Unable to verify code. Please try again.' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  const { resetToken, newPassword } = req.body;

  try {
    // Validate input
    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Verify reset token
    let decoded: any;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET!);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired reset token' });
    }

    // Verify token purpose
    if (decoded.purpose !== 'password_reset') {
      return res.status(401).json({ error: 'Invalid reset token' });
    }

    const { userId, tokenId } = decoded;

    // Verify the reset token hasn't been used
    const tokenResult = await pool.query(
      'SELECT used FROM password_reset_tokens WHERE id = $1 AND user_id = $2',
      [tokenId, userId]
    );

    if (tokenResult.rows.length === 0 || tokenResult.rows[0].used) {
      return res.status(401).json({ error: 'Reset token has already been used' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, userId]
    );

    // Mark reset token as used
    await pool.query(
      'UPDATE password_reset_tokens SET used = true, used_at = NOW() WHERE id = $1',
      [tokenId]
    );

    // Invalidate all other reset tokens for this user
    await pool.query(
      'UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND id != $2',
      [userId, tokenId]
    );

    res.json({ message: 'Password reset successful. You can now login with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Unable to reset password. Please try again.' });
  }
};
