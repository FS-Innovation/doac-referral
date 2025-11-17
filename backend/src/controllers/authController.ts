import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import pool from '../config/database';
import redisClient from '../config/redis';
import { User } from '../types';

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
