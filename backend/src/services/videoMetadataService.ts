import pool from '../config/database';

// Extract video ID from YouTube URL
const extractYouTubeId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
};

// Extract episode ID from Spotify URL
const extractSpotifyId = (url: string): string | null => {
  const match = url.match(/spotify\.com\/episode\/([^?&\n]+)/);
  return match ? match[1] : null;
};

// Extract podcast ID and episode ID from Apple Podcasts URL
const extractApplePodcastsId = (url: string): { podcastId: string | null, episodeId: string | null } => {
  // Format: https://podcasts.apple.com/rs/podcast/{name}/id{podcastId}?i={episodeId}
  const match = url.match(/id(\d+)\?i=(\d+)/);
  return {
    podcastId: match ? match[1] : null,
    episodeId: match ? match[2] : null
  };
};

// Fetch YouTube video metadata using YouTube Data API v3
export const fetchYouTubeMetadata = async (videoUrl: string): Promise<any> => {
  const videoId = extractYouTubeId(videoUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn('⚠️  YOUTUBE_API_KEY not set - using fallback metadata');
    return getFallbackMetadata('youtube', videoUrl, videoId);
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet,contentDetails,statistics`
    );

    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data: any = await response.json();

    if (!data.items || data.items.length === 0) {
      throw new Error('Video not found');
    }

    const video: any = data.items[0];
    const snippet = video.snippet;
    const statistics = video.statistics;

    // Parse ISO 8601 duration (e.g., "PT1H2M10S" -> seconds)
    const duration = parseDuration(video.contentDetails.duration);

    return {
      platform: 'youtube',
      video_url: videoUrl,
      video_id: videoId,
      title: snippet.title,
      description: snippet.description,
      thumbnail_url: snippet.thumbnails.maxres?.url || snippet.thumbnails.high?.url || snippet.thumbnails.default?.url,
      duration,
      channel_name: snippet.channelTitle,
      published_at: snippet.publishedAt,
      view_count: parseInt(statistics.viewCount || '0')
    };
  } catch (error) {
    console.error('YouTube API fetch error:', error);
    return getFallbackMetadata('youtube', videoUrl, videoId);
  }
};

// Decode HTML entities for safe display
const decodeHtmlEntities = (text: string): string => {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
};

// Fetch Apple Podcasts metadata using web scraping (no public API available)
export const fetchApplePodcastsMetadata = async (episodeUrl: string): Promise<any> => {
  const { podcastId, episodeId } = extractApplePodcastsId(episodeUrl);

  if (!podcastId || !episodeId) {
    throw new Error('Invalid Apple Podcasts URL');
  }

  // SECURITY: Validate URL domain to prevent SSRF attacks
  if (!episodeUrl.startsWith('https://podcasts.apple.com/')) {
    throw new Error('Invalid Apple Podcasts URL - must be from podcasts.apple.com');
  }

  try {
    // Fetch with timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(episodeUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DOACBot/1.0)'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Apple Podcasts fetch error: ${response.status}`);
    }

    const html = await response.text();

    // SECURITY: Limit HTML size to prevent memory exhaustion
    if (html.length > 5000000) { // 5MB limit
      throw new Error('Response too large');
    }

    // Extract metadata from HTML using safe regex (Apple Podcasts embeds JSON-LD)
    // Look for og:title, og:description, og:image meta tags
    const titleMatch = html.match(/<meta property="og:title" content="([^"]{1,500})"/);
    const descriptionMatch = html.match(/<meta property="og:description" content="([^"]{1,2000})"/);
    const imageMatch = html.match(/<meta property="og:image" content="(https:\/\/[^"]{1,500})"/);
    const showNameMatch = html.match(/<meta property="music:musician" content="([^"]{1,200})"/);

    return {
      platform: 'apple',
      video_url: episodeUrl,
      video_id: episodeId,
      title: titleMatch ? decodeHtmlEntities(titleMatch[1]) : 'Apple Podcasts Episode',
      description: descriptionMatch ? decodeHtmlEntities(descriptionMatch[1]) : '',
      thumbnail_url: imageMatch ? imageMatch[1] : 'https://storage.googleapis.com/doac-perks/doac-icon.png',
      duration: null, // Not easily available from HTML
      channel_name: showNameMatch ? decodeHtmlEntities(showNameMatch[1]) : 'Death of a Cheerleader',
      published_at: null,
      view_count: null // Apple doesn't provide view counts
    };
  } catch (error) {
    console.error('Apple Podcasts fetch error:', error);
    return getFallbackMetadata('apple', episodeUrl, episodeId);
  }
};

// Fetch Spotify episode metadata using Spotify Web API
export const fetchSpotifyMetadata = async (episodeUrl: string): Promise<any> => {
  const episodeId = extractSpotifyId(episodeUrl);
  if (!episodeId) {
    throw new Error('Invalid Spotify URL');
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('⚠️  Spotify credentials not set - using fallback metadata');
    return getFallbackMetadata('spotify', episodeUrl, episodeId);
  }

  try {
    // Get access token
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

    // Get episode metadata
    const episodeResponse = await fetch(
      `https://api.spotify.com/v1/episodes/${episodeId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!episodeResponse.ok) {
      throw new Error(`Spotify API error: ${episodeResponse.status}`);
    }

    const episode: any = await episodeResponse.json();

    return {
      platform: 'spotify',
      video_url: episodeUrl,
      video_id: episodeId,
      title: episode.name,
      description: episode.description,
      thumbnail_url: episode.images[0]?.url,
      duration: Math.floor(episode.duration_ms / 1000), // Convert ms to seconds
      channel_name: episode.show.name,
      published_at: episode.release_date,
      view_count: null // Spotify doesn't provide view counts
    };
  } catch (error) {
    console.error('Spotify API fetch error:', error);
    return getFallbackMetadata('spotify', episodeUrl, episodeId);
  }
};

// Fallback metadata when API fails or keys not configured
const getFallbackMetadata = (platform: string, url: string, videoId: string) => {
  const titles: Record<string, string> = {
    youtube: 'Death of a Cheerleader - Latest Episode',
    spotify: 'Listen on Spotify',
    apple: 'Listen on Apple Podcasts'
  };

  return {
    platform,
    video_url: url,
    video_id: videoId,
    title: titles[platform] || 'Death of a Cheerleader - Latest Episode',
    description: `Watch the latest episode of Death of a Cheerleader podcast`,
    thumbnail_url: platform === 'youtube'
      ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
      : 'https://storage.googleapis.com/doac-perks/doac-icon.png',
    duration: null,
    channel_name: 'Death of a Cheerleader',
    published_at: null,
    view_count: null
  };
};

// Parse ISO 8601 duration (YouTube format: PT1H2M10S)
const parseDuration = (duration: string): number => {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');

  return hours * 3600 + minutes * 60 + seconds;
};

// Save or update metadata in database
export const saveVideoMetadata = async (metadata: any): Promise<void> => {
  await pool.query(
    `INSERT INTO video_metadata
      (platform, video_url, video_id, title, description, thumbnail_url, duration, channel_name, published_at, view_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (platform, video_id)
     DO UPDATE SET
       video_url = EXCLUDED.video_url,
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       thumbnail_url = EXCLUDED.thumbnail_url,
       duration = EXCLUDED.duration,
       channel_name = EXCLUDED.channel_name,
       published_at = EXCLUDED.published_at,
       view_count = EXCLUDED.view_count,
       last_updated = CURRENT_TIMESTAMP`,
    [
      metadata.platform,
      metadata.video_url,
      metadata.video_id,
      metadata.title,
      metadata.description,
      metadata.thumbnail_url,
      metadata.duration,
      metadata.channel_name,
      metadata.published_at,
      metadata.view_count
    ]
  );
};

// Get metadata from database (cache)
export const getVideoMetadata = async (platform: string, videoUrl: string): Promise<any> => {
  let videoId: string | null = null;

  if (platform === 'youtube') {
    videoId = extractYouTubeId(videoUrl);
  } else if (platform === 'spotify') {
    videoId = extractSpotifyId(videoUrl);
  } else if (platform === 'apple') {
    const { episodeId } = extractApplePodcastsId(videoUrl);
    videoId = episodeId;
  }

  if (!videoId) return null;

  const result = await pool.query(
    'SELECT * FROM video_metadata WHERE platform = $1 AND video_id = $2',
    [platform, videoId]
  );

  return result.rows[0] || null;
};

// Fetch and cache metadata (call this when admin updates video URL)
export const fetchAndCacheMetadata = async (platform: string, videoUrl: string): Promise<any> => {
  console.log(`🔍 Fetching ${platform} metadata for: ${videoUrl}`);

  let metadata;
  if (platform === 'youtube') {
    metadata = await fetchYouTubeMetadata(videoUrl);
  } else if (platform === 'spotify') {
    metadata = await fetchSpotifyMetadata(videoUrl);
  } else if (platform === 'apple') {
    metadata = await fetchApplePodcastsMetadata(videoUrl);
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  await saveVideoMetadata(metadata);

  console.log(`✅ Cached ${platform} metadata: ${metadata.title}`);

  return metadata;
};
