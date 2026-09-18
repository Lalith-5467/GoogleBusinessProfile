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
  `primary_category` VARCHAR(255) NULL,
  `rating` VARCHAR(50) NULL,
  `review_count` VARCHAR(50) NULL,
  `phone` VARCHAR(100) NULL,
  `website` TEXT NULL,
  `area` VARCHAR(255) NULL,
  `city` VARCHAR(255) NULL,
  `state` VARCHAR(255) NULL,
  `postal_code` VARCHAR(100) NULL,
  `latitude` VARCHAR(100) NULL,
  `longitude` VARCHAR(100) NULL,
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

-- -----------------------------------------------------------------------------
-- 4. Table: users
-- Stores user accounts, administrative roles, and authentication hashes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `salt` VARCHAR(64) NOT NULL,
  `full_name` VARCHAR(255) NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'CUSTOMER',
  `status` VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  `plan_id` VARCHAR(191) NULL,
  `last_login_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. Table: admin_permissions
-- Configurable granular permissions for Admin accounts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_permissions` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `can_manage_users` TINYINT(1) DEFAULT 1,
  `can_manage_businesses` TINYINT(1) DEFAULT 1,
  `can_manage_scrapers` TINYINT(1) DEFAULT 1,
  `can_manage_exports` TINYINT(1) DEFAULT 1,
  `can_manage_plans` TINYINT(1) DEFAULT 0,
  `can_view_analytics` TINYINT(1) DEFAULT 1,
  `can_view_audit_logs` TINYINT(1) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_admin_permissions_user_id` (`user_id`),
  CONSTRAINT `fk_permissions_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. Table: subscription_plans
-- Subscription tiers and usage limit controls
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `subscription_plans` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(50) NOT NULL,
  `display_name` VARCHAR(100) NOT NULL,
  `price_monthly` DOUBLE DEFAULT 0.0,
  `search_limit` INT DEFAULT 50,
  `scrape_limit` INT DEFAULT 20,
  `bulk_scrape_limit` INT DEFAULT 5,
  `export_limit` INT DEFAULT 10,
  `features_json` TEXT NULL,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_plans_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. Table: audit_logs
-- Immutable chronological audit trail of all administrative actions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NULL,
  `actor_email` VARCHAR(255) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `target_type` VARCHAR(50) NULL,
  `target_id` VARCHAR(191) NULL,
  `ip_address` VARCHAR(100) NULL,
  `details_json` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_logs_created_at` (`created_at`),
  KEY `idx_audit_logs_actor` (`actor_email`),
  KEY `idx_audit_logs_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 8. Table: export_logs
-- Logs of CSV and data export requests
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `export_logs` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NULL,
  `user_email` VARCHAR(255) NULL,
  `export_type` VARCHAR(50) NOT NULL,
  `record_count` INT DEFAULT 0,
  `file_name` VARCHAR(255) NOT NULL,
  `file_format` VARCHAR(50) DEFAULT 'CSV',
  `ip_address` VARCHAR(100) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_export_logs_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 9. Table: scraping_jobs
-- Scraping jobs execution history and monitoring
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `scraping_jobs` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NULL,
  `job_type` VARCHAR(50) NOT NULL,
  `query_or_url` TEXT NOT NULL,
  `status` VARCHAR(50) DEFAULT 'COMPLETED',
  `results_count` INT DEFAULT 0,
  `error_message` TEXT NULL,
  `duration_ms` INT DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_scraping_jobs_created_at` (`created_at`),
  KEY `idx_scraping_jobs_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
