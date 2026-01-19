import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../types';

/**
 * Get assigned variant for an experiment
 * If user doesn't have an assignment, creates one based on traffic split
 */
export const getExperimentVariant = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { slug } = req.params;

  try {
    // Check if user already has assignment
    const existingResult = await pool.query(`
      SELECT uea.variant
      FROM user_experiment_assignments uea
      JOIN experiments e ON e.id = uea.experiment_id
      WHERE uea.user_id = $1 AND e.slug = $2
    `, [userId, slug]);

    if (existingResult.rows.length > 0) {
      return res.json({ variant: existingResult.rows[0].variant });
    }

    // Get experiment and assign variant
    const experimentResult = await pool.query(
      'SELECT id, variants, traffic_split FROM experiments WHERE slug = $1 AND is_active = true',
      [slug]
    );

    if (experimentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Experiment not found' });
    }

    const experiment = experimentResult.rows[0];
    const variants = experiment.variants as string[];
    const split = experiment.traffic_split as Record<string, number>;

    // Weighted random selection based on traffic_split
    const rand = Math.random() * 100;
    let cumulative = 0;
    let selectedVariant = variants[0];

    for (const variant of variants) {
      cumulative += split[variant] || (100 / variants.length);
      if (rand < cumulative) {
        selectedVariant = variant;
        break;
      }
    }

    // Save assignment
    await pool.query(`
      INSERT INTO user_experiment_assignments (user_id, experiment_id, variant)
      VALUES ($1, $2, $3)
      ON CONFLICT ON CONSTRAINT user_experiment_unique DO NOTHING
    `, [userId, experiment.id, selectedVariant]);

    console.log(`📊 A/B Test: User ${userId} assigned to variant '${selectedVariant}' for experiment '${slug}'`);

    res.json({ variant: selectedVariant });
  } catch (error) {
    console.error('Error getting experiment variant:', error);
    res.status(500).json({ error: 'Failed to get experiment variant' });
  }
};

/**
 * Record experiment conversion
 */
export const recordConversion = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { slug } = req.params;
  const { conversionData } = req.body;

  try {
    const result = await pool.query(`
      UPDATE user_experiment_assignments
      SET converted_at = CURRENT_TIMESTAMP, conversion_data = $1
      WHERE user_id = $2 AND experiment_id = (SELECT id FROM experiments WHERE slug = $3)
      RETURNING variant
    `, [conversionData || {}, userId, slug]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No experiment assignment found' });
    }

    console.log(`📊 A/B Test: User ${userId} converted in experiment '${slug}' (variant: ${result.rows[0].variant})`);

    res.json({ message: 'Conversion recorded' });
  } catch (error) {
    console.error('Error recording conversion:', error);
    res.status(500).json({ error: 'Failed to record conversion' });
  }
};

/**
 * Get experiment stats (admin only)
 */
export const getExperimentStats = async (req: AuthRequest, res: Response) => {
  const { slug } = req.params;

  try {
    const result = await pool.query(`
      SELECT
        uea.variant,
        COUNT(*) as total_assigned,
        COUNT(CASE WHEN uea.converted_at IS NOT NULL THEN 1 END) as conversions,
        ROUND(COUNT(CASE WHEN uea.converted_at IS NOT NULL THEN 1 END)::numeric / COUNT(*) * 100, 2) as conversion_rate
      FROM user_experiment_assignments uea
      JOIN experiments e ON e.id = uea.experiment_id
      WHERE e.slug = $1
      GROUP BY uea.variant
      ORDER BY uea.variant
    `, [slug]);

    const experimentResult = await pool.query(
      'SELECT name, description, is_active, start_date FROM experiments WHERE slug = $1',
      [slug]
    );

    if (experimentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Experiment not found' });
    }

    res.json({
      experiment: experimentResult.rows[0],
      stats: result.rows
    });
  } catch (error) {
    console.error('Error getting experiment stats:', error);
    res.status(500).json({ error: 'Failed to get experiment stats' });
  }
};

/**
 * List all experiments
 */
export const listExperiments = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT slug, name, description, variants, traffic_split, is_active, start_date, end_date
      FROM experiments
      ORDER BY created_at DESC
    `);

    res.json({ experiments: result.rows });
  } catch (error) {
    console.error('Error listing experiments:', error);
    res.status(500).json({ error: 'Failed to list experiments' });
  }
};
