import { describe, it, expect } from 'vitest';
import { CacheLogParser } from '../src/lib/cache-parser.js';

describe('CacheLogParser', () => {
  describe('getCacheStats', () => {
    it('should calculate statistics correctly', () => {
      const results = [
        {
          runId: 1,
          workflowName: 'test',
          jobName: 'build',
          stepName: 'cache',
          cacheKey: 'key1',
          isHit: true,
          cacheResultType: 'hit' as const,
          runDate: new Date(),
          runUrl: 'https://github.com/test/test/runs/1',
          timeMs: 1000,
          cacheSize: 1024
        },
        {
          runId: 2,
          workflowName: 'test',
          jobName: 'build',
          stepName: 'cache',
          cacheKey: 'key2',
          isHit: false,
          cacheResultType: 'miss' as const,
          runDate: new Date(),
          runUrl: 'https://github.com/test/test/runs/2'
        },
        {
          runId: 3,
          workflowName: 'test',
          jobName: 'build',
          stepName: 'cache',
          cacheKey: 'key3',
          isHit: true,
          cacheResultType: 'partial' as const,
          runDate: new Date(),
          runUrl: 'https://github.com/test/test/runs/3',
          timeMs: 500
        }
      ];

      const stats = CacheLogParser.getCacheStats(results);

      expect(stats.totalOperations).toBe(3);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.partialHits).toBe(1);
      expect(stats.hitRate).toBeCloseTo(33.33, 1);
      expect(stats.partialHitRate).toBeCloseTo(33.33, 1);
    });

    it('should handle empty results', () => {
      const stats = CacheLogParser.getCacheStats([]);
      
      expect(stats.totalOperations).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.partialHits).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.partialHitRate).toBe(0);
    });
  });
});
