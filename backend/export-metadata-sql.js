// Quick script to export metadata as SQL INSERT statements
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function exportMetadata() {
  try {
    const result = await pool.query(
      `SELECT
        platform,
        video_url,
        video_id,
        title,
        description,
        thumbnail_url,
        duration,
        channel_name,
        published_at,
        view_count
       FROM video_metadata
       ORDER BY platform`
    );

    console.log('-- Video Metadata SQL Insert Statements for Production');
    console.log('-- Generated:', new Date().toISOString());
    console.log('');

    result.rows.forEach(row => {
      const sql = `INSERT INTO video_metadata (platform, video_url, video_id, title, description, thumbnail_url, duration, channel_name, published_at, view_count)
VALUES (
  '${row.platform}',
  '${row.video_url}',
  '${row.video_id}',
  ${row.title ? `'${row.title.replace(/'/g, "''")}'` : 'NULL'},
  ${row.description ? `'${row.description.substring(0, 200).replace(/'/g, "''")}'` : 'NULL'},
  ${row.thumbnail_url ? `'${row.thumbnail_url}'` : 'NULL'},
  ${row.duration || 'NULL'},
  ${row.channel_name ? `'${row.channel_name.replace(/'/g, "''")}'` : 'NULL'},
  ${row.published_at ? `'${row.published_at}'` : 'NULL'},
  ${row.view_count || 'NULL'}
)
ON CONFLICT (platform, video_id) DO UPDATE SET
  video_url = EXCLUDED.video_url,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  thumbnail_url = EXCLUDED.thumbnail_url,
  duration = EXCLUDED.duration,
  channel_name = EXCLUDED.channel_name,
  published_at = EXCLUDED.published_at,
  view_count = EXCLUDED.view_count,
  last_updated = CURRENT_TIMESTAMP;

`;
      console.log(sql);
    });

    console.log('-- Done! Copy the above SQL and run it on your production database.');

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

exportMetadata();
