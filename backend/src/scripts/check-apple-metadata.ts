import pool from '../config/database';

async function checkMetadata() {
  try {
    console.log('📋 Checking Apple Podcasts metadata in database...\n');

    const result = await pool.query(
      `SELECT platform, title, channel_name, thumbnail_url, video_id
       FROM video_metadata
       WHERE platform = 'apple'`
    );

    if (result.rows.length === 0) {
      console.log('❌ No Apple Podcasts metadata found!');
    } else {
      result.rows.forEach(row => {
        console.log('✅ Apple Podcasts Metadata:');
        console.log(`   Title: ${row.title}`);
        console.log(`   Channel: ${row.channel_name}`);
        console.log(`   Video ID: ${row.video_id}`);
        console.log(`   Thumbnail: ${row.thumbnail_url}`);
      });
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkMetadata();
