# Automatic Episode Update Setup Guide

This guide will help you set up automatic episode updates for your podcast referral landing page. The system will automatically fetch the latest episodes from YouTube, Spotify, and Apple Podcasts and update the links in your database.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Setup Instructions](#setup-instructions)
4. [Testing Locally](#testing-locally)
5. [Scheduling with Google Cloud Scheduler](#scheduling-with-google-cloud-scheduler)
6. [API Endpoints](#api-endpoints)
7. [Troubleshooting](#troubleshooting)

---

## Overview

The episode update system consists of:

- **Service Layer** ([`latestEpisodeService.ts`](backend/src/services/latestEpisodeService.ts)) - Fetches latest episodes from all platforms
- **Controller** ([`adminController.ts`](backend/src/controllers/adminController.ts)) - HTTP endpoints for triggering updates
- **Routes** ([`admin.ts`](backend/src/routes/admin.ts)) - Admin API routes
- **Test Script** ([`test-episode-update.ts`](backend/src/scripts/test-episode-update.ts)) - Local testing utility

---

## Prerequisites

### 1. YouTube Data API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **YouTube Data API v3**
4. Create credentials → API Key
5. Copy the API key

### 2. YouTube Channel ID

Find your channel ID:
- Go to your YouTube channel
- Click on your profile icon → Settings → Advanced settings
- Copy the Channel ID (e.g., `UCxxxxxxxxxxxxxxxx`)

**OR** use this URL trick:
- Go to your channel page
- View page source (Ctrl+U)
- Search for `"channelId":`
- Copy the ID

### 3. Spotify API Credentials

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click "Create an App"
4. Fill in app name and description
5. Copy **Client ID** and **Client Secret**

### 4. Spotify Show ID

Find your show ID from the Spotify URL:
```
https://open.spotify.com/show/1a2b3c4d5e6f7g8h9i0j
                              ^^^^^^^^^^^^^^^^^^^^
                                  This is your Show ID
```

### 5. Apple Podcasts Information

You need:
- **Podcast ID**: Find it in your Apple Podcasts URL
  ```
  https://podcasts.apple.com/us/podcast/death-of-a-cheerleader/id1000737045389
                                                                 ^^^^^^^^^^^^
                                                                 This is your Podcast ID
  ```

- **RSS Feed URL**: Most podcasts have an RSS feed. Common hosting platforms:
  - **Buzzsprout**: `https://feeds.buzzsprout.com/XXXXXX.rss`
  - **Libsyn**: `https://YOURSHOW.libsyn.com/rss`
  - **Anchor**: `https://anchor.fm/s/XXXXXX/podcast/rss`
  - **Podbean**: `https://feed.podbean.com/YOURSHOW/feed.xml`

To find your RSS feed:
1. Go to your podcast hosting platform
2. Look for "RSS Feed" or "Distribution" settings
3. Copy the RSS feed URL

---

## Setup Instructions

### Step 1: Configure Environment Variables

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Copy `.env.example` to `.env` (if you haven't already):
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and add the following configuration:

   ```bash
   # YouTube Data API (for fetching video metadata)
   YOUTUBE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

   # Spotify API (for Spotify metadata)
   SPOTIFY_CLIENT_ID=1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p
   SPOTIFY_CLIENT_SECRET=7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f

   # Podcast Show/Channel IDs for automatic episode updates
   YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxxxxxx
   SPOTIFY_SHOW_ID=1a2b3c4d5e6f7g8h9i0j
   APPLE_PODCAST_ID=1000737045389
   APPLE_RSS_FEED_URL=https://feeds.buzzsprout.com/XXXXXX.rss

   # Optional: Timezone for scheduled updates (defaults to server timezone)
   EPISODE_UPDATE_TIMEZONE=America/New_York
   ```

4. Save the file

### Step 2: Verify Database Connection

Make sure your PostgreSQL database is configured in `.env`:

```bash
# Local development
DATABASE_URL=postgresql://username:password@localhost:5432/referral_system

# Or for Google Cloud SQL
DATABASE_URL=postgresql://[USERNAME]:[PASSWORD]@/[DATABASE]?host=/cloudsql/[PROJECT_ID]:[REGION]:[INSTANCE_NAME]
```

---

## Testing Locally

### Method 1: Using the Test Script (Recommended)

Run the test script to verify everything is working:

```bash
cd backend
npm run test-episode-update
```

**Expected Output:**
```
🚀 Testing Episode Update Functionality

Environment Configuration:
  Database: ✅ Configured
  YouTube API Key: ✅ Configured
  YouTube Channel ID: ✅ Configured
  Spotify Client ID: ✅ Configured
  Spotify Show ID: ✅ Configured
  Apple RSS Feed: ✅ Configured
  Apple Podcast ID: ✅ Configured

🔌 Testing database connection...
✅ Database connected: 2025-11-26T12:00:00.000Z

🔄 Starting episode update...

📺 Latest YouTube episode: Episode Title Here
🎵 Latest Spotify episode: Episode Title Here
🍎 Latest Apple Podcasts episode: Episode Title Here
✅ YouTube updated: Episode Title Here
✅ Spotify updated: Episode Title Here
✅ Apple Podcasts updated: Episode Title Here
✨ Episode update complete!

📊 Update Results:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ YouTube Updated Successfully
   Title: Episode Title Here
   URL: https://youtu.be/xxxxxxxx
   Thumbnail: https://i.ytimg.com/vi/xxxxxxxx/maxresdefault.jpg

✅ Spotify Updated Successfully
   Title: Episode Title Here
   URL: https://open.spotify.com/episode/xxxxxxxx
   Thumbnail: https://i.scdn.co/image/xxxxxxxx

✅ Apple Podcasts Updated Successfully
   Title: Episode Title Here
   URL: https://podcasts.apple.com/us/podcast/id1000737045389?i=xxxxxxxx
   Thumbnail: https://is1-ssl.mzstatic.com/image/thumb/xxxxxxxx

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ Test completed successfully!
```

### Method 2: Using the API Endpoint

1. Start your backend server:
   ```bash
   npm run dev
   ```

2. Log in as an admin user and get your JWT token

3. Make a POST request to trigger the update:
   ```bash
   curl -X POST http://localhost:8080/api/admin/episodes/update \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

4. Check the current episode links:
   ```bash
   curl http://localhost:8080/api/admin/episodes/current \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

---

## Scheduling with Google Cloud Scheduler

Once you've verified the system works locally, set up automatic updates using Google Cloud Scheduler.

### Step 1: Deploy to Google Cloud Run

Make sure your backend is deployed to Cloud Run (you should already have this set up).

### Step 2: Create a Cloud Scheduler Job

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **Cloud Scheduler**
3. Click **Create Job**

4. Configure the job:

   **Basic Configuration:**
   - **Name**: `update-podcast-episodes`
   - **Region**: Select your region (same as Cloud Run)
   - **Description**: `Automatically update podcast episode links every Monday and Thursday at 8 AM`

   **Schedule Configuration:**
   - **Frequency**: `0 8 * * 1,4` (Monday and Thursday at 8:00 AM)
   - **Timezone**: `America/New_York` (or your preferred timezone)

   **Execution Configuration:**
   - **Target type**: HTTP
   - **URL**: `https://YOUR-CLOUD-RUN-URL.run.app/api/admin/episodes/update`
   - **HTTP method**: POST
   - **Auth header**: OIDC token
   - **Service account**: Select or create a service account with permissions

   **Headers:**
   Add an authorization header with a service account token or API key:
   - **Header 1**: `Authorization: Bearer SERVICE_ACCOUNT_TOKEN`

5. Click **Create**

### Step 3: Create a Service Account for Authentication

Since the endpoint requires admin authentication, you have two options:

**Option A: Use a Service Account Token (Recommended)**

1. Create a service account in Google Cloud
2. Generate a JWT token for that service account
3. Add the service account token to the Cloud Scheduler headers

**Option B: Create a Dedicated API Endpoint (Simpler)**

Add a new endpoint that doesn't require admin auth but is protected by Cloud Scheduler headers:

```typescript
// In backend/src/routes/cron.ts (create this file)
import { Router } from 'express';
import { updateAllPlatformLinks } from '../services/latestEpisodeService';

const router = Router();

// Verify request is from Cloud Scheduler
const validateCloudScheduler = (req: any, res: any, next: any) => {
  const schedulerHeader = req.headers['x-cloudscheduler'];
  if (!schedulerHeader) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

router.post('/update-episodes', validateCloudScheduler, async (req, res) => {
  try {
    const results = await updateAllPlatformLinks();
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: 'Update failed' });
  }
});

export default router;
```

Then use URL: `https://YOUR-CLOUD-RUN-URL.run.app/api/cron/update-episodes`

### Step 4: Test the Scheduler

1. In Cloud Scheduler, click on your job
2. Click **Force Run** to test it immediately
3. Check the logs in Cloud Run to see if it worked
4. Verify the database was updated

---

## API Endpoints

### POST /api/admin/episodes/update

Triggers an immediate update of all platform episode links.

**Authentication**: Required (Admin only)

**Request:**
```bash
POST /api/admin/episodes/update
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "message": "Episode update completed",
  "timestamp": "2025-11-26T12:00:00.000Z",
  "results": {
    "youtube": {
      "success": true,
      "title": "Latest Episode Title",
      "url": "https://youtu.be/xxxxxxxx",
      "thumbnail": "https://i.ytimg.com/vi/xxxxxxxx/maxresdefault.jpg"
    },
    "spotify": {
      "success": true,
      "title": "Latest Episode Title",
      "url": "https://open.spotify.com/episode/xxxxxxxx",
      "thumbnail": "https://i.scdn.co/image/xxxxxxxx"
    },
    "apple": {
      "success": true,
      "title": "Latest Episode Title",
      "url": "https://podcasts.apple.com/us/podcast/id1000737045389?i=xxxxxxxx",
      "thumbnail": "https://is1-ssl.mzstatic.com/image/thumb/xxxxxxxx"
    }
  }
}
```

### GET /api/admin/episodes/current

Returns the current episode links stored in the database.

**Authentication**: Required (Admin only)

**Request:**
```bash
GET /api/admin/episodes/current
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "message": "Current episode links",
  "links": {
    "youtube": {
      "url": "https://youtu.be/xxxxxxxx",
      "lastUpdated": "2025-11-26T12:00:00.000Z"
    },
    "spotify": {
      "url": "https://open.spotify.com/episode/xxxxxxxx",
      "lastUpdated": "2025-11-26T12:00:00.000Z"
    },
    "apple": {
      "url": "https://podcasts.apple.com/us/podcast/id1000737045389?i=xxxxxxxx",
      "lastUpdated": "2025-11-26T12:00:00.000Z"
    }
  }
}
```

---

## Troubleshooting

### YouTube API Errors

**Error**: `YouTube API error: 403`
- **Cause**: API key is invalid or doesn't have YouTube Data API enabled
- **Solution**: Check your API key and ensure YouTube Data API v3 is enabled in Google Cloud Console

**Error**: `Channel not found`
- **Cause**: Channel ID is incorrect
- **Solution**: Double-check your channel ID

### Spotify API Errors

**Error**: `Spotify API error: 401`
- **Cause**: Invalid credentials
- **Solution**: Verify your Client ID and Client Secret

**Error**: `No episodes found for this show`
- **Cause**: Show ID is incorrect or show has no episodes
- **Solution**: Verify your Show ID from the Spotify URL

### Apple Podcasts Errors

**Error**: `Could not extract episode ID from RSS feed`
- **Cause**: RSS feed format is different than expected
- **Solution**: Check your RSS feed URL in a browser to verify it's valid XML

**Error**: `Apple Podcasts fetch error: 404`
- **Cause**: Podcast ID or constructed URL is incorrect
- **Solution**: Verify your Podcast ID from the Apple Podcasts URL

### Database Errors

**Error**: `Connection refused`
- **Cause**: PostgreSQL is not running or connection string is wrong
- **Solution**: Start PostgreSQL locally or verify your DATABASE_URL

**Error**: `relation "settings" does not exist`
- **Cause**: Database migrations haven't been run
- **Solution**: Run `npm run migrate` to create the database schema

### General Debugging

Enable verbose logging by adding this to your `.env`:
```bash
NODE_ENV=development
```

Check the console output for detailed error messages.

---

## Next Steps

1. ✅ Test locally with `npm run test-episode-update`
2. ✅ Verify the database updates correctly
3. ✅ Deploy your backend to Google Cloud Run
4. ✅ Set up Google Cloud Scheduler for automatic updates
5. ✅ Monitor the first few scheduled runs to ensure everything works

---

## Support

If you encounter any issues, check the backend logs:

**Local development:**
```bash
npm run dev
# Watch the console output
```

**Google Cloud Run:**
1. Go to Cloud Console → Cloud Run
2. Click on your service
3. Click on "Logs" tab
4. Filter for "update-episodes" or check around 8 AM on Mondays and Thursdays

---

**Happy podcasting! 🎙️**
