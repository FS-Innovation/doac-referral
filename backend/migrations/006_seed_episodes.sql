-- Seed episodes table with test data
-- Modify these values to match your actual episodes

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
) VALUES (
    1,
    'Passive Income Expert: How To Make 10k Per Month In 90 Days!',
    'Serial entrepreneur CHRIS KOERNER reveals the exact blueprint he used to build multiple passive income streams.',
    '4QLWlcneJig',
    8247,
    '2025-11-17T08:01:07Z',
    180980,
    'https://www.youtube.com/watch?v=4QLWlcneJig',
    'https://open.spotify.com/episode/2SPAWVe33i3nhZHPBdTU7o',
    'https://podcasts.apple.com/us/podcast/id1291423644'
) ON CONFLICT (episode_number) DO NOTHING;

-- Add more episodes as needed:
-- INSERT INTO episodes (...) VALUES (...);
