-- Migration: 014_update_marketing_channels.sql
-- Date: 2026-01-19
-- Purpose: Update marketing channels to match business requirements

-- Clear existing channels and insert correct ones
TRUNCATE marketing_channels CASCADE;

INSERT INTO marketing_channels (slug, display_name, description, display_order) VALUES
  ('email_marketing', 'Email marketing', 'Receive email marketing communications', 1),
  ('mobile_marketing', 'Mobile marketing', 'Receive SMS and mobile notifications', 2),
  ('community_events', 'News about Community events', 'Stay updated on community events and meetups', 3),
  ('steven_bartlett', 'News about Steven Bartlett', 'Updates about Steven Bartlett', 4),
  ('flight_news', 'News about Flight', 'Updates about Flight Group and portfolio companies', 5),
  ('books', 'Books', 'Book recommendations and new releases', 6);
