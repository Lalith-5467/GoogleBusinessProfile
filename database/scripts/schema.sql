-- =============================================================================
-- Google Business Profile & Scraper Database Schema (MySQL)
-- Database: googlebusinessprofile
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `googlebusinessprofile`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `googlebusinessprofile`;

-- -----------------------------------------------------------------------------
-- 1. Table: google_business_accounts
-- Stores Google OAuth 2.0 connection credentials & account status
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `google_business_accounts` (
  `id` VARCHAR(191) NOT NULL,
  `application_user_id` VARCHAR(191) NULL,
  `google_account_id` VARCHAR(255) NOT NULL,
  `account_name` VARCHAR(255) NULL,
  `email` VARCHAR(255) NULL,
  `access_token` TEXT NULL,
  `refresh_token` TEXT NULL,
  `token_expiry` DATETIME NULL,
  `connection_status` VARCHAR(50) DEFAULT 'CONNECTED',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_google_account_id` (`google_account_id`),
  KEY `idx_accounts_user_id` (`application_user_id`),
  KEY `idx_accounts_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Table: google_business_locations
-- Stores synced business profile locations from official Google Business Profile API
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `google_business_locations` (
  `id` VARCHAR(191) NOT NULL,
  `google_business_account_id` VARCHAR(191) NULL,
  `google_location_id` VARCHAR(255) NULL,
  `business_name` VARCHAR(255) NOT NULL,
  `area` VARCHAR(255) NULL,
  `city` VARCHAR(255) NULL,
  `address` TEXT NULL,
  `source` VARCHAR(191) DEFAULT 'Google API',
  `status` VARCHAR(50) DEFAULT 'ACTIVE',
  `last_synced_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_google_location_id` (`google_location_id`),
  KEY `idx_locations_account_id` (`google_business_account_id`),
  KEY `idx_locations_city` (`city`),
  KEY `idx_locations_status` (`status`),
  CONSTRAINT `fk_locations_account` FOREIGN KEY (`google_business_account_id`)
    REFERENCES `google_business_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. Table: scraped_businesses
-- Stores extracted business profile data harvested via Playwright
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `scraped_businesses` (
  `id` VARCHAR(191) NOT NULL,
  `source_url` TEXT NOT NULL,
  `business_name` VARCHAR(255) NOT NULL,
  `alternate_name` VARCHAR(255) NULL,
  `primary_category` VARCHAR(255) NULL,
  `additional_categories` TEXT NULL,
  `description` TEXT NULL,
  `about_us` TEXT NULL,
  `rating` VARCHAR(50) NULL,
  `review_count` VARCHAR(50) NULL,
  `price_level` VARCHAR(50) NULL,
  `business_status` VARCHAR(50) NULL,
  `open_now` VARCHAR(50) NULL,

  -- Location fields
  `address` TEXT NULL,
  `address_line_1` VARCHAR(255) NULL,
  `address_line_2` VARCHAR(255) NULL,
  `area` VARCHAR(255) NULL,
  `neighborhood` VARCHAR(255) NULL,
  `city` VARCHAR(255) NULL,
  `district` VARCHAR(255) NULL,
  `state` VARCHAR(255) NULL,
  `country` VARCHAR(255) NULL,
  `postal_code` VARCHAR(100) NULL,
  `latitude` VARCHAR(100) NULL,
  `longitude` VARCHAR(100) NULL,
  `plus_code` VARCHAR(100) NULL,

  -- Contact fields
  `phone` VARCHAR(100) NULL,
  `secondary_phone` VARCHAR(100) NULL,
  `phone_landline` VARCHAR(100) NULL,
  `phone_mobile` VARCHAR(100) NULL,
  `email` VARCHAR(255) NULL,
  `website` TEXT NULL,
  `google_maps_url` TEXT NULL,

  -- Opening Hours
  `monday_hours` VARCHAR(255) NULL,
  `tuesday_hours` VARCHAR(255) NULL,
  `wednesday_hours` VARCHAR(255) NULL,
  `thursday_hours` VARCHAR(255) NULL,
  `friday_hours` VARCHAR(255) NULL,
  `saturday_hours` VARCHAR(255) NULL,
  `sunday_hours` VARCHAR(255) NULL,
  `opening_hours` TEXT NULL,
  `today_open_status` VARCHAR(100) NULL,

  -- Google attributes
  `services` TEXT NULL,
  `amenities` TEXT NULL,
  `accessibility` TEXT NULL,
  `payment_options` TEXT NULL,
  `delivery` VARCHAR(50) NULL,
  `dine_in` VARCHAR(50) NULL,
  `pickup` VARCHAR(50) NULL,
  `reservation_url` TEXT NULL,
  `menu_url` TEXT NULL,

  -- Source & Tracking
  `source_type` VARCHAR(50) DEFAULT 'WEBSITE_SCRAPE',
  `search_keyword` VARCHAR(255) NULL,
  `search_area` VARCHAR(255) NULL,
  `google_place_id` VARCHAR(255) NULL,
  `google_cid` VARCHAR(255) NULL,
  `data_source` VARCHAR(100) NULL,
  `enrichment_status` VARCHAR(100) NULL,
  `status` VARCHAR(50) DEFAULT 'ACTIVE',
  `scraped_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_scraped_business_name` (`business_name`),
  KEY `idx_scraped_city` (`city`),
  KEY `idx_scraped_category` (`primary_category`),
  KEY `idx_scraped_status` (`status`),
  KEY `idx_scraped_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
