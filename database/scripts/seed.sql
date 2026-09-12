-- =============================================================================
-- Seed Fixture Data for Google Business Profile Database
-- =============================================================================

USE `googlebusinessprofile`;

-- Sample Google Business Account
INSERT IGNORE INTO `google_business_accounts` (
  `id`,
  `google_account_id`,
  `account_name`,
  `email`,
  `connection_status`,
  `created_at`,
  `updated_at`
) VALUES (
  'acc-demo-001',
  'accounts/109823487192837',
  'Acme Global Enterprises',
  'admin@acmeglobal.com',
  'CONNECTED',
  NOW(),
  NOW()
);

-- Sample Google Business Location
INSERT IGNORE INTO `google_business_locations` (
  `id`,
  `google_business_account_id`,
  `google_location_id`,
  `business_name`,
  `area`,
  `city`,
  `address`,
  `source`,
  `status`,
  `last_synced_at`,
  `created_at`,
  `updated_at`
) VALUES (
  'loc-demo-001',
  'acc-demo-001',
  'locations/4561237890',
  'Acme HQ - Downtown Branch',
  'Downtown Central',
  'Metropolis',
  '100 Market St, Suite 400, Metropolis',
  'Google API',
  'ACTIVE',
  NOW(),
  NOW(),
  NOW()
);

-- Sample Scraped Business
INSERT IGNORE INTO `scraped_businesses` (
  `id`,
  `source_url`,
  `business_name`,
  `alternate_name`,
  `primary_category`,
  `rating`,
  `review_count`,
  `price_level`,
  `business_status`,
  `open_now`,
  `address`,
  `city`,
  `state`,
  `country`,
  `postal_code`,
  `phone`,
  `email`,
  `website`,
  `source_type`,
  `status`,
  `scraped_at`,
  `created_at`,
  `updated_at`
) VALUES (
  'scraped-demo-001',
  'https://www.examplebakery.com',
  'Artisan Daily Bakery & Cafe',
  'Daily Bakery',
  'Bakery & Cafe',
  '4.8',
  '342',
  '$$',
  'OPERATIONAL',
  'Open',
  '45 Artisan Way, Sector 5',
  'Austin',
  'TX',
  'United States',
  '78701',
  '+1 512-555-0199',
  'hello@examplebakery.com',
  'https://www.examplebakery.com',
  'WEBSITE_SCRAPE',
  'ACTIVE',
  NOW(),
  NOW(),
  NOW()
);
