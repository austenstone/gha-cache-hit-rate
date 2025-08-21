/**
 * Utility functions for date handling and formatting
 */

import { format, parseISO, isValid, subDays, startOfDay, endOfDay } from 'date-fns';

/**
 * Parse and validate a date string
 */
export function parseDate(dateString: string): Date {
  const date = parseISO(dateString);
  if (!isValid(date)) {
    throw new Error(`Invalid date format: ${dateString}. Use YYYY-MM-DD format.`);
  }
  return date;
}

/**
 * Format a date for display
 */
export function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Format a date and time for display
 */
export function formatDateTime(date: Date): string {
  return format(date, 'yyyy-MM-dd HH:mm:ss');
}

/**
 * Get default date range (last 30 days)
 */
export function getDefaultDateRange(): { from: Date; to: Date } {
  const to = endOfDay(new Date());
  const from = startOfDay(subDays(to, 30));
  return { from, to };
}

/**
 * Calculate the number of days between two dates
 */
export function daysBetween(from: Date, to: Date): number {
  const diffTime = Math.abs(to.getTime() - from.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format a duration in milliseconds to human readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else if (ms < 3600000) {
    return `${(ms / 60000).toFixed(1)}m`;
  } else {
    return `${(ms / 3600000).toFixed(1)}h`;
  }
}

/**
 * Format bytes to human readable format
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) {return '0B';}
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))}${sizes[i]}`;
}

/**
 * Calculate percentage with specified decimal places
 */
export function percentage(part: number, total: number, decimals: number = 1): number {
  if (total === 0) {return 0;}
  return parseFloat(((part / total) * 100).toFixed(decimals));
}
