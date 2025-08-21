import { describe, it, expect } from 'vitest';
import { parseDate, formatDate, formatBytes, percentage } from '../src/utils/format.js';

describe('Format Utilities', () => {
  describe('parseDate', () => {
    it('should parse valid ISO date strings', () => {
      const date = parseDate('2023-12-01');
      expect(date).toBeInstanceOf(Date);
      expect(date.getFullYear()).toBe(2023);
      expect(date.getMonth()).toBe(11); // December (0-indexed)
      expect(date.getDate()).toBe(1);
    });

    it('should throw error for invalid date strings', () => {
      expect(() => parseDate('invalid-date')).toThrow('Invalid date format');
      expect(() => parseDate('2023-13-01')).toThrow('Invalid date format');
    });
  });

  describe('formatDate', () => {
    it('should format dates correctly', () => {
      const date = new Date('2023-12-01T10:30:00Z');
      expect(formatDate(date)).toBe('2023-12-01');
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0B');
      expect(formatBytes(1024)).toBe('1KB');
      expect(formatBytes(1024 * 1024)).toBe('1MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1GB');
      expect(formatBytes(1536)).toBe('1.5KB'); // 1.5 KB
    });
  });

  describe('percentage', () => {
    it('should calculate percentages correctly', () => {
      expect(percentage(25, 100)).toBe(25.0);
      expect(percentage(1, 3, 2)).toBe(33.33);
      expect(percentage(0, 100)).toBe(0);
    });

    it('should handle division by zero', () => {
      expect(percentage(10, 0)).toBe(0);
    });
  });
});
