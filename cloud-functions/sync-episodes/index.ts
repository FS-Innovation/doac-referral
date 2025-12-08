import { HttpFunction } from '@google-cloud/functions-framework';
import { Pool } from 'pg';

/**
 * Cloud Function to sync latest DOAC episodes from YouTube, Spotify, and Apple Podcasts
 * Runs on schedule (Monday & Thursday at 8am) via Cloud Scheduler
 */

// DOAC Channel/Show IDs
const DOAC_CHANNEL_ID = 'UCGq-a57w-aPwyi3pW7XLiHw';
const DOAC_SPOTIFY_SHOW_ID = '7iQXmUT7XGuZSzAMjoNWlX';
const DOAC_APPLE_PODCAST_ID = '1291423644';

const EPISODES_TO_FETCH = 10;
const MIN_EPISODE_DURATION = 300; // 5 minutes

interface YouTubeVideo {
  id: string;
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
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
  external_urls: { spotify: string };
  release_date: string;
}

interface AppleEpisode {
  trackId: number;
  trackName: string;
  trackViewUrl: string;
  releaseDate: string;
}

let spotifyAccessToken: string | null = null;

function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

async function getSpotifyAccessToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log('Spotify credentials not provided');
    return null;
  }

  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      },
      body: 'grant_type=client_credentials'
    });
    const data = await res.json() as any;
    return data.access_token || null;
  } catch (err) {
    console.error('Failed to get Spotify token:', err);
    return null;
  }
}

async function fetchSpotifyEpisodes(): Promise<SpotifyEpisode[]> {
  if (!spotifyAccessToken) return [];

  try {
    const res = await fetch(
      `https://api.spotify.com/v1/shows/${DOAC_SPOTIFY_SHOW_ID}/episodes?market=GB&limit=50`,
      { headers: { 'Authorization': `Bearer ${spotifyAccessToken}` } }
    );
    const data = await res.json() as any;
    return (data.items || []).filter((ep: any) => ep?.name && ep?.release_date);
  } catch (err) {
    console.error('Failed to fetch Spotify episodes:', err);
    return [];
  }
}

async function fetchAppleEpisodes(): Promise<AppleEpisode[]> {
  try {
    const res = await fetch(
      `https://itunes.apple.com/lookup?id=${DOAC_APPLE_PODCAST_ID}&media=podcast&entity=podcastEpisode&limit=50`
    );
    const data = await res.json() as any;
    return (data.results || []).slice(1).filter((ep: any) => ep?.trackName && ep?.releaseDate);
  } catch (err) {
    console.error('Failed to fetch Apple episodes:', err);
    return [];
  }
}

async function fetchRecentVideoIds(apiKey: string): Promise<string[]> {
  const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${DOAC_CHANNEL_ID}&key=${apiKey}`;
  const channelRes = await fetch(channelUrl);
  const channelData = await channelRes.json() as any;

  if (!channelData.items?.length) {
    throw new Error('Could not find channel');
  }

  const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;
  const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50&key=${apiKey}`;

  const playlistRes = await fetch(playlistUrl);
  const playlistData = await playlistRes.json() as any;

  if (!playlistData.items) {
    throw new Error('Could not fetch playlist items');
  }

  return playlistData.items.map((item: any) => item.snippet.resourceId.videoId);
}

async function fetchVideoDetails(videoIds: string[], apiKey: string): Promise<YouTubeVideo[]> {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds.join(',')}&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json() as any;

  if (!data.items) {
    throw new Error('Could not fetch video details');
  }

  return data.items;
}

function matchEpisodesByDate(
  youtubeVideos: YouTubeVideo[],
  spotifyEpisodes: SpotifyEpisode[],
  appleEpisodes: AppleEpisode[]
): Map<string, { spotifyUrl: string | null; appleUrl: string | null }> {
  const matches = new Map();

  const availableSpotify = [...spotifyEpisodes]
    .filter(ep => ep?.release_date && ep?.name)
    .sort((a, b) => new Date(a.release_date).getTime() - new Date(b.release_date).getTime());

  const availableApple = [...appleEpisodes]
    .filter(ep => ep?.releaseDate && ep?.trackName)
    .sort((a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime());

  const sortedYT = [...youtubeVideos].sort((a, b) =>
    new Date(a.snippet.publishedAt).getTime() - new Date(b.snippet.publishedAt).getTime()
  );

  for (const video of sortedYT) {
    const ytDate = new Date(video.snippet.publishedAt);

    let spotifyMatch: SpotifyEpisode | null = null;
    let spotifyIndex = -1;
    let spotifyDaysDiff = Infinity;

    let appleMatch: AppleEpisode | null = null;
    let appleIndex = -1;
    let appleDaysDiff = Infinity;

    for (let i = 0; i < availableSpotify.length; i++) {
      const ep = availableSpotify[i];
      const daysDiff = Math.abs(ytDate.getTime() - new Date(ep.release_date).getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff <= 5 && daysDiff < spotifyDaysDiff) {
        spotifyDaysDiff = daysDiff;
        spotifyMatch = ep;
        spotifyIndex = i;
      }
    }

    for (let i = 0; i < availableApple.length; i++) {
      const ep = availableApple[i];
      const daysDiff = Math.abs(ytDate.getTime() - new Date(ep.releaseDate).getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff <= 5 && daysDiff < appleDaysDiff) {
        appleDaysDiff = daysDiff;
        appleMatch = ep;
        appleIndex = i;
      }
    }

    if (spotifyIndex >= 0) availableSpotify.splice(spotifyIndex, 1);
    if (appleIndex >= 0) availableApple.splice(appleIndex, 1);

    matches.set(video.id, {
      spotifyUrl: spotifyMatch?.external_urls.spotify || null,
      appleUrl: appleMatch?.trackViewUrl || null
    });
  }

  return matches;
}

export const syncEpisodes: HttpFunction = async (req, res) => {
  console.log('Starting episode sync...');

  const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!YOUTUBE_API_KEY) {
    console.error('YOUTUBE_API_KEY not configured');
    res.status(500).send('YOUTUBE_API_KEY not configured');
    return;
  }

  if (!DATABASE_URL) {
    console.error('DATABASE_URL not configured');
    res.status(500).send('DATABASE_URL not configured');
    return;
  }

  // Check if running in Cloud Functions (has Cloud SQL socket)
  const INSTANCE_CONNECTION_NAME = process.env.INSTANCE_CONNECTION_NAME;

  let pool: Pool;
  if (INSTANCE_CONNECTION_NAME) {
    // Cloud Functions: connect via Unix socket
    const dbUser = process.env.DB_USER || 'postgres';
    const dbPass = process.env.DB_PASS || '';
    const dbName = process.env.DB_NAME || 'postgres';

    pool = new Pool({
      user: dbUser,
      password: dbPass,
      database: dbName,
      host: `/cloudsql/${INSTANCE_CONNECTION_NAME}`,
      max: 5,
      connectionTimeoutMillis: 30000,
    });
  } else {
    // Local: connect via DATABASE_URL
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      connectionTimeoutMillis: 30000,
    });
  }

  try {
    // Get existing youtube_video_ids from database
    console.log('Checking existing episodes in database...');
    const existingResult = await pool.query('SELECT youtube_video_id FROM episodes');
    const existingVideoIds = new Set(existingResult.rows.map(r => r.youtube_video_id));
    console.log(`Found ${existingVideoIds.size} existing episodes`);

    // Get the current max episode number
    const maxEpResult = await pool.query('SELECT COALESCE(MAX(episode_number), 0) as max_ep FROM episodes');
    let nextEpisodeNumber = maxEpResult.rows[0].max_ep + 1;

    // Fetch from all platforms
    console.log('Fetching Spotify episodes...');
    spotifyAccessToken = await getSpotifyAccessToken();
    const spotifyEpisodes = await fetchSpotifyEpisodes();
    console.log(`Found ${spotifyEpisodes.length} Spotify episodes`);

    console.log('Fetching Apple episodes...');
    const appleEpisodes = await fetchAppleEpisodes();
    console.log(`Found ${appleEpisodes.length} Apple episodes`);

    console.log('Fetching YouTube videos...');
    const videoIds = await fetchRecentVideoIds(YOUTUBE_API_KEY);
    const allVideos = await fetchVideoDetails(videoIds, YOUTUBE_API_KEY);

    // Filter to long-form content only, sorted newest to oldest
    const longFormVideos = allVideos
      .filter(video => parseDuration(video.contentDetails.duration) >= MIN_EPISODE_DURATION)
      .sort((a, b) => new Date(b.snippet.publishedAt).getTime() - new Date(a.snippet.publishedAt).getTime());

    console.log(`Filtered to ${longFormVideos.length} long-form videos`);

    // Only check the 3 most recent videos for new episodes
    const recentVideos = longFormVideos.slice(0, 3);

    // Filter to only NEW episodes (not already in database)
    const newVideos = recentVideos.filter(video => !existingVideoIds.has(video.id));
    console.log(`Found ${newVideos.length} new episodes to add (checked latest 3)`);

    if (newVideos.length === 0) {
      console.log('No new episodes to sync');
      res.status(200).json({
        success: true,
        episodesAdded: 0,
        message: 'No new episodes found',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Match new episodes with Spotify/Apple
    const episodeMatches = matchEpisodesByDate(newVideos, spotifyEpisodes, appleEpisodes);

    let added = 0;
    for (const video of newVideos) {
      const match = episodeMatches.get(video.id);
      const duration = parseDuration(video.contentDetails.duration);
      const viewCount = parseInt(video.statistics.viewCount, 10) || 0;

      await pool.query(`
        INSERT INTO episodes (
          episode_number, title, description, youtube_video_id,
          duration, published_at, view_count,
          youtube_url, spotify_url, apple_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        nextEpisodeNumber,
        video.snippet.title,
        video.snippet.description.substring(0, 2000),
        video.id,
        duration,
        video.snippet.publishedAt,
        viewCount,
        `https://www.youtube.com/watch?v=${video.id}`,
        match?.spotifyUrl || null,
        match?.appleUrl || null
      ]);

      console.log(`Added EP ${nextEpisodeNumber}: ${video.snippet.title.substring(0, 50)}...`);
      nextEpisodeNumber++;
      added++;
    }

    const summary = {
      success: true,
      episodesAdded: added,
      timestamp: new Date().toISOString()
    };

    console.log('Sync complete:', summary);
    res.status(200).json(summary);

  } catch (error) {
    console.error('Sync failed:', error);
    res.status(500).json({ success: false, error: String(error) });
  } finally {
    await pool.end();
  }
};
