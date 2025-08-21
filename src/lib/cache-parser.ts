import StreamZip from 'node-stream-zip';
import { CacheLogEntry, CacheHitResult } from '../types/index.js';

export class CacheLogParser {
  // Regex patterns for different cache actions and versions
  private static readonly CACHE_PATTERNS = {
    // actions/cache@v3 and v4 patterns
    cacheHit: /Cache restored from key: (.+)/i,
    cacheMiss: /Cache not found for input key: (.+)/i,
    cachePartialHit: /Cache restored from key: (.+) \(partial key match\)/i,
    cacheSave: /Cache saved with key: (.+)/i,
    cacheSkipSave: /Cache hit occurred on the primary key .+, not saving cache/i,
    
    // Alternative patterns for different versions
    restoreSuccess: /Received \d+ of \d+ \(\d+%\), downloaded (\d+) MB in (\d+) ms/,
    restoreCache: /Restore cache with key: (.+)/i,
    savingCache: /Saving cache with key: (.+)/i,
    uploadSuccess: /Uploaded \d+ of \d+ \(\d+%\), uploaded (\d+) MB in (\d+) ms/,
    
    // Job and step identification
    jobName: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z ##\[group\](.+)/,
    stepName: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z (.+)/,
  };

  /**
   * Extract and parse logs from a workflow run zip file
   */
  async parseRunLogs(
    logData: Buffer,
    runId: number,
    workflowName: string,
    runDate: Date,
    runUrl: string
  ): Promise<CacheHitResult[]> {
    const results: CacheHitResult[] = [];

    try {
      // Create a temporary buffer to work with the zip
      const zip = new StreamZip.async({ buffer: logData } as any);
      const entries = await zip.entries();

      // Process each log file in the zip
      for (const [filename, entry] of Object.entries(entries)) {
        if ((entry as any).isFile && filename.endsWith('.txt')) {
          const logContent = await zip.entryData(filename);
          const logText = logContent.toString('utf8');
          
          // Extract job name from filename (format: "1_JobName.txt")
          const jobNameMatch = filename.match(/^\d+_(.+)\.txt$/);
          const jobName = jobNameMatch ? jobNameMatch[1] : filename;

          const cacheOperations = this.parseLogContent(logText, jobName);
          
          // Convert cache operations to results
          for (const op of cacheOperations) {
            results.push({
              runId,
              workflowName,
              jobName: op.jobName || jobName,
              stepName: op.stepName || 'Unknown',
              cacheKey: op.key,
              isHit: op.resultType === 'hit',
              cacheResultType: op.resultType,
              cacheSize: op.sizeBytes,
              timeMs: op.timeMs,
              runDate,
              runUrl,
            });
          }
        }
      }

      await zip.close();
    } catch (error) {
      console.warn(`Warning: Failed to parse logs for run ${runId}: ${error}`);
    }

    return results;
  }

  /**
   * Parse log content to extract cache operations
   */
  private parseLogContent(logText: string, defaultJobName: string): CacheLogEntry[] {
    const operations: CacheLogEntry[] = [];
    const lines = logText.split('\n');
    
    let currentJobName = defaultJobName;
    let currentStepName = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {continue;}

      // Extract job name
      const jobMatch = line.match(CacheLogParser.CACHE_PATTERNS.jobName);
      if (jobMatch) {
        currentJobName = jobMatch[1];
        continue;
      }

      // Extract step name
      const stepMatch = line.match(CacheLogParser.CACHE_PATTERNS.stepName);
      if (stepMatch) {
        currentStepName = stepMatch[1];
      }

      // Parse cache operations
      const operation = this.parseCacheLine(line, currentJobName, currentStepName);
      if (operation) {
        operations.push(operation);
        
        // Look ahead for timing/size information
        const nextOperation = this.parseFollowingLines(lines, i + 1);
        if (nextOperation) {
          operations[operations.length - 1] = { ...operation, ...nextOperation };
        }
      }
    }

    return operations;
  }

  /**
   * Parse a single line for cache operations
   */
  private parseCacheLine(
    line: string, 
    jobName: string, 
    stepName: string
  ): CacheLogEntry | null {
    // Cache hit
    let match = line.match(CacheLogParser.CACHE_PATTERNS.cacheHit);
    if (match) {
      return {
        logLine: line,
        operationType: 'restore',
        key: match[1],
        success: true,
        resultType: 'hit',
        jobName,
        stepName,
      };
    }

    // Cache partial hit (restore key match)
    match = line.match(CacheLogParser.CACHE_PATTERNS.cachePartialHit);
    if (match) {
      return {
        logLine: line,
        operationType: 'restore',
        key: match[1],
        success: true,
        resultType: 'partial',
        jobName,
        stepName,
      };
    }

    // Cache miss
    match = line.match(CacheLogParser.CACHE_PATTERNS.cacheMiss);
    if (match) {
      return {
        logLine: line,
        operationType: 'restore',
        key: match[1],
        success: false,
        resultType: 'miss',
        jobName,
        stepName,
      };
    }

    // Cache save
    match = line.match(CacheLogParser.CACHE_PATTERNS.cacheSave);
    if (match) {
      return {
        logLine: line,
        operationType: 'save',
        key: match[1],
        success: true,
        resultType: 'hit', // Save operations are successful hits
        jobName,
        stepName,
      };
    }

    // Alternative restore patterns
    match = line.match(CacheLogParser.CACHE_PATTERNS.restoreCache);
    if (match) {
      return {
        logLine: line,
        operationType: 'restore',
        key: match[1],
        success: true,
        resultType: 'hit',
        jobName,
        stepName,
      };
    }

    return null;
  }

  /**
   * Parse following lines for additional information about cache operations
   */
  private parseFollowingLines(
    lines: string[], 
    startIndex: number
  ): Partial<CacheLogEntry> | null {
    const additionalInfo: Partial<CacheLogEntry> = {};

    // Look at the next few lines for timing and size information
    for (let i = startIndex; i < Math.min(startIndex + 5, lines.length); i++) {
      const line = lines[i].trim();

      // Parse download/upload success with timing
      let match = line.match(CacheLogParser.CACHE_PATTERNS.restoreSuccess);
      if (match) {
        additionalInfo.sizeBytes = parseInt(match[1]) * 1024 * 1024; // Convert MB to bytes
        additionalInfo.timeMs = parseInt(match[2]);
        continue;
      }

      match = line.match(CacheLogParser.CACHE_PATTERNS.uploadSuccess);
      if (match) {
        additionalInfo.sizeBytes = parseInt(match[1]) * 1024 * 1024; // Convert MB to bytes
        additionalInfo.timeMs = parseInt(match[2]);
        continue;
      }

      // Parse size from other patterns
      const sizeMatch = line.match(/(\d+(?:\.\d+)?)\s*(MB|KB|GB|bytes?)/i);
      if (sizeMatch && !additionalInfo.sizeBytes) {
        const size = parseFloat(sizeMatch[1]);
        const unit = sizeMatch[2].toLowerCase();
        
        switch (unit) {
          case 'gb':
            additionalInfo.sizeBytes = size * 1024 * 1024 * 1024;
            break;
          case 'mb':
            additionalInfo.sizeBytes = size * 1024 * 1024;
            break;
          case 'kb':
            additionalInfo.sizeBytes = size * 1024;
            break;
          case 'bytes':
          case 'byte':
            additionalInfo.sizeBytes = size;
            break;
        }
      }

      // Parse timing from other patterns
      const timeMatch = line.match(/(\d+(?:\.\d+)?)\s*(ms|s|seconds?|milliseconds?)/i);
      if (timeMatch && !additionalInfo.timeMs) {
        const time = parseFloat(timeMatch[1]);
        const unit = timeMatch[2].toLowerCase();
        
        if (unit === 'ms' || unit.startsWith('millisecond')) {
          additionalInfo.timeMs = time;
        } else if (unit === 's' || unit.startsWith('second')) {
          additionalInfo.timeMs = time * 1000;
        }
      }
    }

    return Object.keys(additionalInfo).length > 0 ? additionalInfo : null;
  }

  /**
   * Get cache operation statistics from parsed results
   */
  static getCacheStats(results: CacheHitResult[]) {
    const stats = {
      totalOperations: results.length,
      hits: results.filter(r => r.cacheResultType === 'hit').length,
      misses: results.filter(r => r.cacheResultType === 'miss').length,
      partialHits: results.filter(r => r.cacheResultType === 'partial').length,
      hitRate: 0,
      partialHitRate: 0,
      avgSize: 0,
      totalTimeSaved: 0,
    };

    if (stats.totalOperations > 0) {
      stats.hitRate = (stats.hits / stats.totalOperations) * 100;
      stats.partialHitRate = (stats.partialHits / stats.totalOperations) * 100;
      
      const sizingResults = results.filter(r => r.cacheSize);
      if (sizingResults.length > 0) {
        stats.avgSize = sizingResults.reduce((sum, r) => sum + (r.cacheSize || 0), 0) / sizingResults.length;
      }

      const timingResults = results.filter(r => r.timeMs && r.isHit);
      if (timingResults.length > 0) {
        stats.totalTimeSaved = timingResults.reduce((sum, r) => sum + (r.timeMs || 0), 0);
      }
    }

    return stats;
  }
}
