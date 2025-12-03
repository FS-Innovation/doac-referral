import pool from '../config/database';
import { fetchYouTubeMetadata, fetchSpotifyMetadata, fetchApplePodcastsMetadata, saveVideoMetadata } from './videoMetadataService';

/**
 * Fetch the latest YouTube video from a channel
 * @param channelId - YouTube channel ID (e.g., "UCxxxxxxxxxxxxxxxx")
 * @returns YouTube video URL of the latest upload
 */
export const fetchLatestYouTubeEpisode = async (channelId: string): Promise<{
  url: string;
  title: string;
  thumbnail: string;
  metadata: any;
}> => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY not configured');
  }

  try {
    // Step 1: Get the channel's uploads playlist ID
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?id=${channelId}&key=${apiKey}&part=contentDetails`
    );

    if (!channelResponse.ok) {
      throw new Error(`YouTube API error: ${channelResponse.status}`);
    }

    const channelData: any = await channelResponse.json();

    if (!channelData.items || channelData.items.length === 0) {
      throw new Error('Channel not found');
    }

    const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

    // Step 2: Get the latest video from the uploads playlist
    const playlistResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?playlistId=${uploadsPlaylistId}&key=${apiKey}&part=snippet&maxResults=1&order=date`
    );

    if (!playlistResponse.ok) {
      throw new Error(`YouTube API error: ${playlistResponse.status}`);
    }

    const playlistData: any = await playlistResponse.json();

    if (!playlistData.items || playlistData.items.length === 0) {
      throw new Error('No videos found in channel');
    }

    const latestVideo = playlistData.items[0];
    const videoId = latestVideo.snippet.resourceId.videoId;
    const videoUrl = `https://youtu.be/${videoId}`;

    // Step 3: Fetch full metadata for this video
    const metadata = await fetchYouTubeMetadata(videoUrl);

    console.log(`📺 Latest YouTube episode: ${metadata.title}`);

    return {
      url: videoUrl,
      title: metadata.title,
      thumbnail: metadata.thumbnail_url,
      metadata
    };
  } catch (error) {
    console.error('Error fetching latest YouTube episode:', error);
    throw error;
  }
};

/**
 * Fetch the latest Spotify episode from a show
 * @param showId - Spotify show ID (e.g., "1a2b3c4d5e6f7g8h9i0j")
 * @returns Spotify episode URL of the latest episode
 */
export const fetchLatestSpotifyEpisode = async (showId: string): Promise<{
  url: string;
  title: string;
  thumbnail: string;
  metadata: any;
}> => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials not configured');
  }

  try {
    // Step 1: Get access token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
      },
      body: 'grant_type=client_credentials'
    });

    const tokenData: any = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Step 2: Get latest episode from the show (sorted by release date)
    const episodesResponse = await fetch(
      `https://api.spotify.com/v1/shows/${showId}/episodes?limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!episodesResponse.ok) {
      throw new Error(`Spotify API error: ${episodesResponse.status}`);
    }

    const episodesData: any = await episodesResponse.json();

    if (!episodesData.items || episodesData.items.length === 0) {
      throw new Error('No episodes found for this show');
    }

    const latestEpisode = episodesData.items[0];
    const episodeUrl = `https://open.spotify.com/episode/${latestEpisode.id}`;

    // Step 3: Fetch full metadata for this episode
    const metadata = await fetchSpotifyMetadata(episodeUrl);

    console.log(`🎵 Latest Spotify episode: ${metadata.title}`);

    return {
      url: episodeUrl,
      title: metadata.title,
      thumbnail: metadata.thumbnail_url,
      metadata
    };
  } catch (error) {
    console.error('Error fetching latest Spotify episode:', error);
    throw error;
  }
};

/**
 * Fetch the latest Apple Podcasts episode from a podcast RSS feed
 * @param rssFeedUrl - Podcast RSS feed URL (most podcasts have this)
 * @param podcastId - Apple Podcasts show ID for constructing the episode URL
 * @returns Apple Podcasts episode URL of the latest episode
 */
export const fetchLatestApplePodcastsEpisode = async (
  rssFeedUrl: string,
  podcastId: string
): Promise<{
  url: string;
  title: string;
  thumbnail: string;
  metadata: any;
}> => {
  try {
    // Step 1: Fetch RSS feed
    const response = await fetch(rssFeedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DOACBot/1.0)'
      }
    });

    if (!response.ok) {
      throw new Error(`RSS feed fetch error: ${response.status}`);
    }

    const xmlText = await response.text();

    // Step 2: Parse RSS XML to find latest episode
    // Look for the first <item> in the feed (RSS feeds are ordered by date, newest first)
    const itemMatch = xmlText.match(/<item>([\s\S]*?)<\/item>/);
    if (!itemMatch) {
      throw new Error('No episodes found in RSS feed');
    }

    const itemXml = itemMatch[1];

    // Extract episode title
    const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
    const title = titleMatch ? titleMatch[1].trim() : 'Latest Episode';

    // Extract episode GUID or link to find Apple episode ID
    // Apple embeds the episode ID in the <guid> tag
    const guidMatch = itemXml.match(/<guid[^>]*>(.*?)<\/guid>/);
    let episodeId = '';

    if (guidMatch) {
      // Apple Podcasts GUIDs often contain the episode ID
      // Format: Buzzsprout-12345678 or similar
      const guidIdMatch = guidMatch[1].match(/(\d{9,})/); // Find long number (episode IDs are typically 9+ digits)
      if (guidIdMatch) {
        episodeId = guidIdMatch[1];
      }
    }

    // If we couldn't extract episode ID from GUID, try to find it in enclosure or link
    if (!episodeId) {
      const enclosureMatch = itemXml.match(/url="([^"]*?)"/);
      if (enclosureMatch) {
        const urlIdMatch = enclosureMatch[1].match(/(\d{9,})/);
        if (urlIdMatch) {
          episodeId = urlIdMatch[1];
        }
      }
    }

    if (!episodeId) {
      throw new Error('Could not extract episode ID from RSS feed');
    }

    // Step 3: Construct Apple Podcasts URL
    // Format: https://podcasts.apple.com/us/podcast/{podcast-name}/id{podcastId}?i={episodeId}
    const episodeUrl = `https://podcasts.apple.com/us/podcast/id${podcastId}?i=${episodeId}`;

    // Step 4: Fetch full metadata by scraping Apple Podcasts page
    const metadata = await fetchApplePodcastsMetadata(episodeUrl);

    console.log(`🍎 Latest Apple Podcasts episode: ${metadata.title}`);

    return {
      url: episodeUrl,
      title: metadata.title,
      thumbnail: metadata.thumbnail_url,
      metadata
    };
  } catch (error) {
    console.error('Error fetching latest Apple Podcasts episode:', error);
    throw error;
  }
};

/**
 * Update all platform links and metadata in the database
 * This function fetches the latest episode from all platforms and updates the settings table
 */
export const updateAllPlatformLinks = async (): Promise<{
  youtube?: any;
  spotify?: any;
  apple?: any;
  errors: string[];
}> => {
  const results: any = {};
  const errors: string[] = [];

  console.log('🔄 Starting automatic episode update...');

  // Get configuration from environment variables
  const youtubeChannelId = process.env.YOUTUBE_CHANNEL_ID;
  const spotifyShowId = process.env.SPOTIFY_SHOW_ID;
  const appleRssFeedUrl = process.env.APPLE_RSS_FEED_URL;
  const applePodcastId = process.env.APPLE_PODCAST_ID;

  // Update YouTube
  if (youtubeChannelId) {
    try {
      const latest = await fetchLatestYouTubeEpisode(youtubeChannelId);

      // Save metadata to database
      await saveVideoMetadata(latest.metadata);

      // Update settings table with new URL
      await pool.query(
        `INSERT INTO settings (key, value)
         VALUES ('redirect_url', $1)
         ON CONFLICT (key)
         DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [latest.url]
      );

      results.youtube = latest;
      console.log(`✅ YouTube updated: ${latest.title}`);
    } catch (error) {
      const errorMsg = `YouTube update failed: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      errors.push(errorMsg);
    }
  } else {
    errors.push('YOUTUBE_CHANNEL_ID not configured');
  }

  // Update Spotify
  if (spotifyShowId) {
    try {
      const latest = await fetchLatestSpotifyEpisode(spotifyShowId);

      // Save metadata to database
      await saveVideoMetadata(latest.metadata);

      // Update settings table with new URL
      await pool.query(
        `INSERT INTO settings (key, value)
         VALUES ('redirect_url_spotify', $1)
         ON CONFLICT (key)
         DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [latest.url]
      );

      results.spotify = latest;
      console.log(`✅ Spotify updated: ${latest.title}`);
    } catch (error) {
      const errorMsg = `Spotify update failed: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      errors.push(errorMsg);
    }
  } else {
    errors.push('SPOTIFY_SHOW_ID not configured');
  }

  // Update Apple Podcasts
  if (appleRssFeedUrl && applePodcastId) {
    try {
      const latest = await fetchLatestApplePodcastsEpisode(appleRssFeedUrl, applePodcastId);

      // Save metadata to database
      await saveVideoMetadata(latest.metadata);

      // Update settings table with new URL
      await pool.query(
        `INSERT INTO settings (key, value)
         VALUES ('redirect_url_apple', $1)
         ON CONFLICT (key)
         DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [latest.url]
      );

      results.apple = latest;
      console.log(`✅ Apple Podcasts updated: ${latest.title}`);
    } catch (error) {
      const errorMsg = `Apple Podcasts update failed: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      errors.push(errorMsg);
    }
  } else {
    errors.push('APPLE_RSS_FEED_URL or APPLE_PODCAST_ID not configured');
  }

  console.log('✨ Episode update complete!');

  return { ...results, errors };
};
