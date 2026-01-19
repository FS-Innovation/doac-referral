import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest, ProfileCompletionData, ProfileCompletionStatus } from '../types';

// E.164 phone validation regex
const E164_REGEX = /^\+[1-9]\d{1,14}$/;

// Valid gender values
const VALID_GENDERS = ['male', 'female', 'non_binary', 'prefer_not_to_say'];

// Valid age ranges
const VALID_AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55+'];

/**
 * Get profile completion status - what does user still need to fill?
 */
export const getCompletionStatus = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const userResult = await pool.query(`
      SELECT email_verified, profile_completed_at, profile_completion_skipped,
             first_name, phone, gender, date_of_birth, age_range, country
      FROM users WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Check what's completed
    const interestsResult = await pool.query(
      'SELECT COUNT(*) FROM user_interests WHERE user_id = $1', [userId]
    );

    const marketingResult = await pool.query(
      'SELECT COUNT(*) FROM user_marketing_preferences WHERE user_id = $1 AND opted_in = true', [userId]
    );

    // Determine which step user is on
    let currentStep: 'verify_email' | 'profile_completion' | 'complete' = 'complete';
    if (!user.email_verified) {
      currentStep = 'verify_email';
    } else if (!user.profile_completed_at && !user.profile_completion_skipped) {
      currentStep = 'profile_completion';
    }

    const status: ProfileCompletionStatus = {
      currentStep,
      emailVerified: user.email_verified,
      profileCompleted: !!user.profile_completed_at,
      profileSkipped: user.profile_completion_skipped || false,
      completedFields: {
        firstName: !!user.first_name,
        phone: !!user.phone,
        gender: !!user.gender,
        dob: !!(user.date_of_birth || user.age_range),
        country: !!user.country,
        interests: parseInt(interestsResult.rows[0].count) > 0,
        marketingPrefs: parseInt(marketingResult.rows[0].count) > 0
      }
    };

    res.json(status);
  } catch (error) {
    console.error('Error getting completion status:', error);
    res.status(500).json({ error: 'Failed to get completion status' });
  }
};

/**
 * Complete profile (Page 2) - save all profile data
 */
export const completeProfile = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const data: ProfileCompletionData = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const completedFields: string[] = [];

    // Validate and save phone (E.164)
    if (data.phone) {
      if (!E164_REGEX.test(data.phone)) {
        throw new Error('Invalid phone number format. Use E.164 format (+14155551234)');
      }
      await client.query(
        'UPDATE users SET phone = $1 WHERE id = $2',
        [data.phone, userId]
      );
      completedFields.push('phone');
    }

    // Validate and save gender
    if (data.gender) {
      if (!VALID_GENDERS.includes(data.gender)) {
        throw new Error('Invalid gender value');
      }
      await client.query(
        'UPDATE users SET gender = $1 WHERE id = $2',
        [data.gender, userId]
      );
      completedFields.push('gender');
    }

    // Validate and save DOB (based on variant)
    if (data.dobVariant === 'date_picker' && data.dateOfBirth) {
      const dob = new Date(data.dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      if (age < 18) {
        throw new Error('You must be 18 or older');
      }
      if (age > 120) {
        throw new Error('Please enter a valid date of birth');
      }
      await client.query(
        'UPDATE users SET date_of_birth = $1, dob_variant = $2 WHERE id = $3',
        [data.dateOfBirth, 'date_picker', userId]
      );
      completedFields.push('dob');
    } else if (data.dobVariant === 'age_range' && data.ageRange) {
      if (!VALID_AGE_RANGES.includes(data.ageRange)) {
        throw new Error('Invalid age range');
      }
      await client.query(
        'UPDATE users SET age_range = $1, dob_variant = $2 WHERE id = $3',
        [data.ageRange, 'age_range', userId]
      );
      completedFields.push('dob');
    }

    // Save interests (many-to-many)
    if (data.interests && Array.isArray(data.interests) && data.interests.length > 0) {
      // Delete existing interests first
      await client.query('DELETE FROM user_interests WHERE user_id = $1', [userId]);

      // Get interest IDs
      const interestResult = await client.query(
        'SELECT id, slug FROM interests WHERE slug = ANY($1) AND is_active = true',
        [data.interests]
      );

      for (const interest of interestResult.rows) {
        await client.query(
          'INSERT INTO user_interests (user_id, interest_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [userId, interest.id]
        );
      }
      completedFields.push('interests');
    }

    // Save marketing preferences
    if (data.marketingPreferences && Array.isArray(data.marketingPreferences)) {
      // Get all channel IDs
      const channelResult = await client.query(
        'SELECT id, slug FROM marketing_channels WHERE is_active = true'
      );

      for (const channel of channelResult.rows) {
        const optedIn = data.marketingPreferences.includes(channel.slug);
        await client.query(`
          INSERT INTO user_marketing_preferences (user_id, channel_id, opted_in, opted_in_at)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT ON CONSTRAINT user_marketing_prefs_unique DO UPDATE SET
            opted_in = $3,
            opted_in_at = CASE WHEN $3 = true THEN CURRENT_TIMESTAMP ELSE user_marketing_preferences.opted_in_at END,
            opted_out_at = CASE WHEN $3 = false THEN CURRENT_TIMESTAMP ELSE user_marketing_preferences.opted_out_at END,
            updated_at = CURRENT_TIMESTAMP
        `, [userId, channel.id, optedIn, optedIn ? new Date() : null]);
      }
      completedFields.push('marketing_preferences');
    }

    // Mark profile as completed
    await client.query(`
      UPDATE users SET
        profile_completed_at = CURRENT_TIMESTAMP,
        profile_completion_step = 2,
        profile_completion_skipped = false,
        completed_fields = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [JSON.stringify(completedFields), userId]);

    // Record conversion for A/B test if DOB variant was used
    if (data.dobVariant) {
      await client.query(`
        UPDATE user_experiment_assignments
        SET converted_at = CURRENT_TIMESTAMP,
            conversion_data = $1
        WHERE user_id = $2 AND experiment_id = (SELECT id FROM experiments WHERE slug = 'dob_input_type')
      `, [JSON.stringify({ completed: true, fields: completedFields }), userId]);
    }

    // Log analytics
    await client.query(`
      INSERT INTO profile_completion_analytics (user_id, step, action, fields_completed)
      VALUES ($1, 'page_2', 'completed', $2)
    `, [userId, JSON.stringify(completedFields)]);

    await client.query('COMMIT');

    res.json({
      message: 'Profile completed successfully',
      completedFields
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error completing profile:', error);
    res.status(400).json({ error: error.message || 'Failed to complete profile' });
  } finally {
    client.release();
  }
};

/**
 * Skip profile completion
 */
export const skipProfileCompletion = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    await pool.query(`
      UPDATE users SET
        profile_completion_skipped = true,
        profile_completion_step = 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [userId]);

    // Log analytics
    await pool.query(`
      INSERT INTO profile_completion_analytics (user_id, step, action)
      VALUES ($1, 'page_2', 'skipped')
    `, [userId]);

    res.json({ message: 'Profile completion skipped' });
  } catch (error) {
    console.error('Error skipping profile:', error);
    res.status(500).json({ error: 'Failed to skip profile completion' });
  }
};

/**
 * Get available interests
 */
export const getInterests = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT slug, display_name, category_label
      FROM interests
      WHERE is_active = true
      ORDER BY display_order
    `);

    res.json({ interests: result.rows });
  } catch (error) {
    console.error('Error getting interests:', error);
    res.status(500).json({ error: 'Failed to get interests' });
  }
};

/**
 * Get marketing channels
 */
export const getMarketingChannels = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT slug, display_name, description
      FROM marketing_channels
      WHERE is_active = true
      ORDER BY display_order
    `);

    res.json({ channels: result.rows });
  } catch (error) {
    console.error('Error getting marketing channels:', error);
    res.status(500).json({ error: 'Failed to get marketing channels' });
  }
};

/**
 * Get user's current interests
 */
export const getUserInterests = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const result = await pool.query(`
      SELECT i.slug, i.display_name, i.category_label
      FROM user_interests ui
      JOIN interests i ON i.id = ui.interest_id
      WHERE ui.user_id = $1
      ORDER BY i.display_order
    `, [userId]);

    res.json({ interests: result.rows });
  } catch (error) {
    console.error('Error getting user interests:', error);
    res.status(500).json({ error: 'Failed to get user interests' });
  }
};

/**
 * Get user's current marketing preferences
 */
export const getUserMarketingPreferences = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const result = await pool.query(`
      SELECT mc.slug, mc.display_name, ump.opted_in
      FROM marketing_channels mc
      LEFT JOIN user_marketing_preferences ump ON ump.channel_id = mc.id AND ump.user_id = $1
      WHERE mc.is_active = true
      ORDER BY mc.display_order
    `, [userId]);

    res.json({ preferences: result.rows });
  } catch (error) {
    console.error('Error getting marketing preferences:', error);
    res.status(500).json({ error: 'Failed to get marketing preferences' });
  }
};

/**
 * Get full user profile data for editing
 */
export const getUserProfile = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    // Get basic user data
    const userResult = await pool.query(`
      SELECT id, email, first_name, phone, gender, date_of_birth, age_range, dob_variant,
             profile_completed_at, country
      FROM users WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get user's interests
    const interestsResult = await pool.query(`
      SELECT i.slug
      FROM user_interests ui
      JOIN interests i ON i.id = ui.interest_id
      WHERE ui.user_id = $1
    `, [userId]);

    // Get user's marketing preferences (opted-in ones)
    const marketingResult = await pool.query(`
      SELECT mc.slug
      FROM user_marketing_preferences ump
      JOIN marketing_channels mc ON mc.id = ump.channel_id
      WHERE ump.user_id = $1 AND ump.opted_in = true
    `, [userId]);

    res.json({
      profile: {
        email: user.email,
        firstName: user.first_name,
        phone: user.phone,
        gender: user.gender,
        dateOfBirth: user.date_of_birth,
        ageRange: user.age_range,
        dobVariant: user.dob_variant,
        country: user.country,
        interests: interestsResult.rows.map(r => r.slug),
        marketingPreferences: marketingResult.rows.map(r => r.slug),
        profileCompleted: !!user.profile_completed_at
      }
    });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
};

/**
 * Update user profile (for existing users editing their profile)
 */
export const updateProfile = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const data: ProfileCompletionData = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const updatedFields: string[] = [];

    // Update first name if provided
    if (data.firstName !== undefined) {
      await client.query(
        'UPDATE users SET first_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [data.firstName || null, userId]
      );
      updatedFields.push('firstName');
    }

    // Validate and update phone (E.164)
    if (data.phone !== undefined) {
      if (data.phone && !E164_REGEX.test(data.phone)) {
        throw new Error('Invalid phone number format. Use E.164 format (+44...)');
      }
      await client.query(
        'UPDATE users SET phone = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [data.phone || null, userId]
      );
      updatedFields.push('phone');
    }

    // Validate and update gender
    if (data.gender !== undefined) {
      if (data.gender && !VALID_GENDERS.includes(data.gender)) {
        throw new Error('Invalid gender value');
      }
      await client.query(
        'UPDATE users SET gender = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [data.gender || null, userId]
      );
      updatedFields.push('gender');
    }

    // Update DOB
    if (data.dateOfBirth !== undefined) {
      if (data.dateOfBirth) {
        const dob = new Date(data.dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
          age--;
        }
        if (age < 18) {
          throw new Error('You must be 18 or older');
        }
        if (age > 120) {
          throw new Error('Please enter a valid date of birth');
        }
      }
      await client.query(
        'UPDATE users SET date_of_birth = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [data.dateOfBirth || null, userId]
      );
      updatedFields.push('dateOfBirth');
    }

    // Update age range
    if (data.ageRange !== undefined) {
      if (data.ageRange && !VALID_AGE_RANGES.includes(data.ageRange)) {
        throw new Error('Invalid age range');
      }
      await client.query(
        'UPDATE users SET age_range = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [data.ageRange || null, userId]
      );
      updatedFields.push('ageRange');
    }

    // Update interests
    if (data.interests !== undefined && Array.isArray(data.interests)) {
      // Delete existing interests first
      await client.query('DELETE FROM user_interests WHERE user_id = $1', [userId]);

      if (data.interests.length > 0) {
        // Get interest IDs
        const interestResult = await client.query(
          'SELECT id, slug FROM interests WHERE slug = ANY($1) AND is_active = true',
          [data.interests]
        );

        for (const interest of interestResult.rows) {
          await client.query(
            'INSERT INTO user_interests (user_id, interest_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [userId, interest.id]
          );
        }
      }
      updatedFields.push('interests');
    }

    // Update marketing preferences
    if (data.marketingPreferences !== undefined && Array.isArray(data.marketingPreferences)) {
      // Get all channel IDs
      const channelResult = await client.query(
        'SELECT id, slug FROM marketing_channels WHERE is_active = true'
      );

      for (const channel of channelResult.rows) {
        const optedIn = data.marketingPreferences.includes(channel.slug);
        await client.query(`
          INSERT INTO user_marketing_preferences (user_id, channel_id, opted_in, opted_in_at)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT ON CONSTRAINT user_marketing_prefs_unique DO UPDATE SET
            opted_in = $3,
            opted_in_at = CASE WHEN $3 = true THEN CURRENT_TIMESTAMP ELSE user_marketing_preferences.opted_in_at END,
            opted_out_at = CASE WHEN $3 = false THEN CURRENT_TIMESTAMP ELSE user_marketing_preferences.opted_out_at END,
            updated_at = CURRENT_TIMESTAMP
        `, [userId, channel.id, optedIn, optedIn ? new Date() : null]);
      }
      updatedFields.push('marketingPreferences');
    }

    await client.query('COMMIT');

    res.json({
      message: 'Profile updated successfully',
      updatedFields
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error updating profile:', error);
    res.status(400).json({ error: error.message || 'Failed to update profile' });
  } finally {
    client.release();
  }
};
