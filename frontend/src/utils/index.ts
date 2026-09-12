/**
 * Common Utility Functions
 */

/**
 * Format date string into localized readable format
 */
export function formatDate(dateString?: string | null): string {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleString();
  } catch {
    return dateString;
  }
}

/**
 * Clean and truncate long text
 */
export function truncate(text: string, maxLength: number = 80): string {
  if (!text || text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}

/**
 * Safe link opener
 */
export function openExternalUrl(url?: string | null): void {
  if (!url) return;
  const formattedUrl = url.startsWith('http://') || url.startsWith('https://') 
    ? url 
    : `https://${url}`;
  window.open(formattedUrl, '_blank', 'noopener,noreferrer');
}

export * from './csvExport';
