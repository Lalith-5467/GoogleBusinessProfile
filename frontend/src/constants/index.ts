/**
 * Application Constants
 */
export const APP_NAME = 'Google Business Profile';
export const APP_VERSION = '1.0.0';

export const NAVIGATION_TABS = {
  GOOGLE: 'google',
  SCRAPER: 'scraper',
} as const;

export type NavigationTab = typeof NAVIGATION_TABS[keyof typeof NAVIGATION_TABS];

export const DEFAULT_PAGE_SIZE = 25;
