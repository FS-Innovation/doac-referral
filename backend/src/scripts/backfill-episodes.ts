import pool from '../config/database';

/**
 * Backfill episodes from YouTube API with Spotify and Apple Podcast links
 *
 * - Filters out Shorts (videos < 5 minutes)
 * - Numbers episodes by release date (oldest = 1, newest = 10)
 * - Matches across platforms by release date (within 2 days tolerance)
 *
 * Usage:
 *   YOUTUBE_API_KEY=your_key SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=xxx npx ts-node src/scripts/backfill-episodes.ts
 */

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// DOAC Channel ID - "The Diary Of A CEO" (@thediaryofaceo)
const DOAC_CHANNEL_ID = 'UCGq-a57w-aPwyi3pW7XLiHw';

// DOAC Podcast IDs
const DOAC_SPOTIFY_SHOW_ID = '7iQXmUT7XGuZSzAMjoNWlX';
const DOAC_APPLE_PODCAST_ID = '1291423644';

// Number of long-form episodes to fetch
const EPISODES_TO_FETCH = 10;

// Minimum duration in seconds to be considered a full episode (5 minutes)
const MIN_EPISODE_DURATION = 300;

interface YouTubeVideo {
  id: string;
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    channelId: string;
  };
  contentDetails: {
    duration: string;
  };
  statistics: {
    viewCount: string;
  };
}

interface SpotifyEpisode {
  id: string;
  name: string;
  external_urls: {
    spotify: string;
  };
  release_date: string;
}

interface AppleEpisode {
  trackId: number;
  trackName: string;
  trackViewUrl: string;
  releaseDate: string;
}

let spotifyAccessToken: string | null = null;

/**
 * Parse ISO 8601 duration to seconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Get date string (YYYY-MM-DD) from various date formats
 */
function getDateString(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toISOString().split('T')[0];
}

/**
 * Get Spotify access token using client credentials flow
 */
async function getSpotifyAccessToken(): Promise<string | null> {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    console.log('   ⚠️  Spotify credentials not provided, skipping Spotify links');
    return null;
  }

  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')
      },
      body: 'grant_type=client_credentials'
    });

    const data = await res.json() as any;
    return data.access_token || null;
  } catch (err) {
    console.error('   ⚠️  Failed to get Spotify access token:', err);
    return null;
  }
}

/**
 * Fetch Spotify episodes for the DOAC show
 */
async function fetchSpotifyEpisodes(): Promise<SpotifyEpisode[]> {
  if (!spotifyAccessToken) return [];

  try {
    const res = await fetch(
      `https://api.spotify.com/v1/shows/${DOAC_SPOTIFY_SHOW_ID}/episodes?market=GB&limit=50`,
      {
        headers: {
          'Authorization': `Bearer ${spotifyAccessToken}`
        }
      }
    );

    const data = await res.json() as any;
    return (data.items || []).filter((ep: any) => ep && ep.name && ep.release_date);
  } catch (err) {
    console.error('   ⚠️  Failed to fetch Spotify episodes:', err);
    return [];
  }
}

/**
 * Fetch Apple Podcast episodes using iTunes Search API
 */
async function fetchAppleEpisodes(): Promise<AppleEpisode[]> {
  try {
    const res = await fetch(
      `https://itunes.apple.com/lookup?id=${DOAC_APPLE_PODCAST_ID}&media=podcast&entity=podcastEpisode&limit=50`
    );

    const data = await res.json() as any;
    return (data.results || []).slice(1).filter((ep: any) => ep && ep.trackName && ep.releaseDate);
  } catch (err) {
    console.error('   ⚠️  Failed to fetch Apple episodes:', err);
    return [];
  }
}

/**
 * Match YouTube videos to Spotify/Apple episodes by date proximity
 *
 * Strategy: Since every YouTube episode has a corresponding podcast version
 * released within 1-2 days, we match by finding the closest date match
 * and remove matched episodes to prevent double-matching.
 */
interface MatchedEpisode {
  spotifyUrl: string | null;
  appleUrl: string | null;
}

function matchEpisodesByDate(
  youtubeVideos: YouTubeVideo[],
  spotifyEpisodes: SpotifyEpisode[],
  appleEpisodes: AppleEpisode[]
): Map<string, MatchedEpisode> {
  const matches = new Map<string, MatchedEpisode>();

  // Create mutable copies sorted by date (oldest first)
  const availableSpotify = [...spotifyEpisodes]
    .filter(ep => ep && ep.release_date && ep.name)
    .sort((a, b) => new Date(a.release_date).getTime() - new Date(b.release_date).getTime());

  const availableApple = [...appleEpisodes]
    .filter(ep => ep && ep.releaseDate && ep.trackName)
    .sort((a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime());

  // Sort YouTube videos by date (oldest first) for consistent matching
  const sortedYT = [...youtubeVideos].sort((a, b) =>
    new Date(a.snippet.publishedAt).getTime() - new Date(b.snippet.publishedAt).getTime()
  );

  console.log('\n🔗 Matching episodes across platforms...\n');

  for (const video of sortedYT) {
    const ytDate = new Date(video.snippet.publishedAt);
    const ytDateStr = ytDate.toISOString().split('T')[0];

    let spotifyMatch: SpotifyEpisode | null = null;
    let spotifyIndex = -1;
    let spotifyDaysDiff = Infinity;

    let appleMatch: AppleEpisode | null = null;
    let appleIndex = -1;
    let appleDaysDiff = Infinity;

    // Find closest Spotify match within 5 days
    for (let i = 0; i < availableSpotify.length; i++) {
      const ep = availableSpotify[i];
      const epDate = new Date(ep.release_date);
      const daysDiff = Math.abs(ytDate.getTime() - epDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysDiff <= 5 && daysDiff < spotifyDaysDiff) {
        spotifyDaysDiff = daysDiff;
        spotifyMatch = ep;
        spotifyIndex = i;
      }
    }

    // Find closest Apple match within 5 days
    for (let i = 0; i < availableApple.length; i++) {
      const ep = availableApple[i];
      const epDate = new Date(ep.releaseDate);
      const daysDiff = Math.abs(ytDate.getTime() - epDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysDiff <= 5 && daysDiff < appleDaysDiff) {
        appleDaysDiff = daysDiff;
        appleMatch = ep;
        appleIndex = i;
      }
    }

    // Remove matched episodes from available pool (prevents double-matching)
    if (spotifyIndex >= 0) {
      availableSpotify.splice(spotifyIndex, 1);
    }
    if (appleIndex >= 0) {
      availableApple.splice(appleIndex, 1);
    }

    // Log the match
    const shortTitle = video.snippet.title.substring(0, 45);
    console.log(`   📅 ${ytDateStr}: "${shortTitle}..."`);

    if (spotifyMatch) {
      console.log(`      ✓ Spotify (${spotifyDaysDiff.toFixed(1)}d): "${spotifyMatch.name.substring(0, 40)}..."`);
    } else {
      console.log(`      ✗ Spotify: No match found`);
    }

    if (appleMatch) {
      console.log(`      ✓ Apple (${appleDaysDiff.toFixed(1)}d): "${appleMatch.trackName.substring(0, 40)}..."`);
    } else {
      console.log(`      ✗ Apple: No match found`);
    }

    matches.set(video.id, {
      spotifyUrl: spotifyMatch?.external_urls.spotify || null,
      appleUrl: appleMatch?.trackViewUrl || null
    });
  }

  return matches;
}

/**
 * Fetch video IDs from channel's uploads (fetch extra to account for shorts)
 */
async function fetchRecentVideoIds(): Promise<string[]> {
  const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${DOAC_CHANNEL_ID}&key=${YOUTUBE_API_KEY}`;

  const channelRes = await fetch(channelUrl);
  const channelData = await channelRes.json() as any;

  if (!channelData.items || channelData.items.length === 0) {
    throw new Error('Could not find channel');
  }

  const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

  // Fetch more than needed to account for shorts filtering
  const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50&key=${YOUTUBE_API_KEY}`;

  const playlistRes = await fetch(playlistUrl);
  const playlistData = await playlistRes.json() as any;

  if (!playlistData.items) {
    throw new Error('Could not fetch playlist items');
  }

  return playlistData.items.map((item: any) => item.snippet.resourceId.videoId);
}

/**
 * Fetch detailed video information
 */
async function fetchVideoDetails(videoIds: string[]): Promise<YouTubeVideo[]> {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds.join(',')}&key=${YOUTUBE_API_KEY}`;

  const res = await fetch(url);
  const data = await res.json() as any;

  if (!data.items) {
    throw new Error('Could not fetch video details');
  }

  return data.items;
}

/**
 * Insert episode into database
 */
async function insertEpisode(
  video: YouTubeVideo,
  episodeNumber: number,
  spotifyUrl: string | null,
  appleUrl: string | null
): Promise<void> {
  const duration = parseDuration(video.contentDetails.duration);
  const viewCount = parseInt(video.statistics.viewCount, 10) || 0;

  await pool.query(`
    INSERT INTO episodes (
      episode_number,
      title,
      description,
      youtube_video_id,
      duration,
      published_at,
      view_count,
      youtube_url,
      spotify_url,
      apple_url
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (episode_number) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      youtube_video_id = EXCLUDED.youtube_video_id,
      duration = EXCLUDED.duration,
      published_at = EXCLUDED.published_at,
      view_count = EXCLUDED.view_count,
      youtube_url = EXCLUDED.youtube_url,
      spotify_url = EXCLUDED.spotify_url,
      apple_url = EXCLUDED.apple_url
  `, [
    episodeNumber,
    video.snippet.title,
    video.snippet.description.substring(0, 2000),
    video.id,
    duration,
    video.snippet.publishedAt,
    viewCount,
    `https://www.youtube.com/watch?v=${video.id}`,
    spotifyUrl,
    appleUrl
  ]);
}

async function main() {
  if (!YOUTUBE_API_KEY) {
    console.error('❌ YOUTUBE_API_KEY environment variable is required');
    console.error('');
    console.error('Usage:');
    console.error('  YOUTUBE_API_KEY=your_key SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=xxx npx ts-node src/scripts/backfill-episodes.ts');
    console.error('');
    console.error('API Keys:');
    console.error('  - YouTube: https://console.cloud.google.com/apis/credentials');
    console.error('  - Spotify: https://developer.spotify.com/dashboard');
    process.exit(1);
  }

  console.log('🎬 Fetching recent DOAC episodes from YouTube...\n');

  try {
    // Get Spotify access token and fetch episodes
    console.log('🎵 Fetching Spotify episodes...');
    spotifyAccessToken = await getSpotifyAccessToken();
    const spotifyEpisodes = await fetchSpotifyEpisodes();
    console.log(`   Found ${spotifyEpisodes.length} Spotify episodes\n`);

    // Fetch Apple Podcast episodes
    console.log('🍎 Fetching Apple Podcast episodes...');
    const appleEpisodes = await fetchAppleEpisodes();
    console.log(`   Found ${appleEpisodes.length} Apple episodes\n`);

    // Fetch video IDs from YouTube (extra to account for shorts)
    console.log('🔍 Fetching videos from YouTube channel...');
    const videoIds = await fetchRecentVideoIds();
    console.log(`   Found ${videoIds.length} total videos\n`);

    // Fetch video details
    console.log('📥 Fetching video details...');
    const allVideos = await fetchVideoDetails(videoIds);

    // Filter out shorts (videos < 5 minutes) and sort by date ascending
    const longFormVideos = allVideos
      .filter(video => {
        const duration = parseDuration(video.contentDetails.duration);
        return duration >= MIN_EPISODE_DURATION;
      })
      .sort((a, b) => {
        // Sort ascending by date (oldest first)
        return new Date(a.snippet.publishedAt).getTime() - new Date(b.snippet.publishedAt).getTime();
      });

    console.log(`   Filtered to ${longFormVideos.length} long-form videos (≥5 min)\n`);

    // Take only the most recent N long-form videos, but keep sorted oldest-first
    const recentLongForm = longFormVideos.slice(-EPISODES_TO_FETCH);

    // Match all episodes across platforms using date-based matching
    const episodeMatches = matchEpisodesByDate(recentLongForm, spotifyEpisodes, appleEpisodes);

    console.log(`\n📋 Inserting ${recentLongForm.length} episodes into database...\n`);

    let inserted = 0;
    let spotifyMatched = 0;
    let appleMatched = 0;

    for (let i = 0; i < recentLongForm.length; i++) {
      const video = recentLongForm[i];
      const episodeNumber = i + 1; // 1 = oldest, 10 = newest

      // Get matched URLs from the map
      const match = episodeMatches.get(video.id);
      const spotifyUrl = match?.spotifyUrl || null;
      const appleUrl = match?.appleUrl || null;

      if (spotifyUrl) spotifyMatched++;
      if (appleUrl) appleMatched++;

      const duration = parseDuration(video.contentDetails.duration);
      const durationMin = Math.floor(duration / 60);
      const publishDate = getDateString(video.snippet.publishedAt);

      await insertEpisode(video, episodeNumber, spotifyUrl, appleUrl);

      const shortTitle = video.snippet.title.substring(0, 45);
      console.log(`   EP ${episodeNumber.toString().padStart(2)}: ${shortTitle}...`);
      console.log(`       📅 ${publishDate} | ⏱️ ${durationMin}min | YT:✓ SP:${spotifyUrl ? '✓' : '✗'} AP:${appleUrl ? '✓' : '✗'}`);
      inserted++;
    }

    console.log('\n📊 Summary:');
    console.log(`   Total episodes: ${inserted}`);
    console.log(`   Spotify matches: ${spotifyMatched}/${inserted}`);
    console.log(`   Apple matches: ${appleMatched}/${inserted}`);
    console.log(`   Episode 1 = oldest, Episode ${inserted} = newest (latest)`);
    console.log('\n✅ Backfill complete!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
