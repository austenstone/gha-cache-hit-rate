#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { analyzeRepository } from './lib/analyzer.js';
import { getCurrentRepository } from './utils/git.js';
import { CliOptions } from './types/index.js';

const packageInfo = {
  name: 'gh-actions-cache-hit-rate',
  version: '0.1.0',
  description: 'GitHub CLI extension to analyze cache hit rates across GitHub Actions workflows'
};

async function main() {
  let argv: any;
  
  try {
    argv = await yargs(hideBin(process.argv))
      .scriptName('gh actions-cache-hit-rate')
      .usage('$0 [options]')
      .version(packageInfo.version)
      .option('owner', {
        alias: 'o',
        type: 'string',
        description: 'Repository owner (defaults to current repo)',
      })
      .option('repo', {
        alias: 'r',
        type: 'string',
        description: 'Repository name (defaults to current repo)',
      })
      .option('since', {
        alias: 's',
        type: 'string',
        description: 'Start date for analysis (ISO format: YYYY-MM-DD)',
        coerce: (value: string) => {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            throw new Error(`Invalid date format: ${value}. Use YYYY-MM-DD format.`);
          }
          return value;
        }
      })
      .option('until', {
        alias: 'u',
        type: 'string',
        description: 'End date for analysis (ISO format: YYYY-MM-DD)',
        coerce: (value: string) => {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            throw new Error(`Invalid date format: ${value}. Use YYYY-MM-DD format.`);
          }
          return value;
        }
      })
      .option('max-runs-per-workflow', {
        alias: 'm',
        type: 'number',
        description: 'Maximum number of runs to analyze per workflow',
        default: 100,
        coerce: (value: number) => {
          if (value < 1) {
            throw new Error('max-runs-per-workflow must be at least 1');
          }
          if (value > 1000) {
            throw new Error('max-runs-per-workflow cannot exceed 1000');
          }
          return value;
        }
      })
      .option('format', {
        alias: 'f',
        type: 'string',
        choices: ['table', 'csv', 'json'] as const,
        description: 'Output format',
        default: 'table' as const
      })
      .option('concurrency', {
        alias: 'c',
        type: 'number',
        description: 'Number of concurrent API requests',
        default: 3,
        coerce: (value: number) => {
          if (value < 1) {
            throw new Error('concurrency must be at least 1');
          }
          if (value > 10) {
            throw new Error('concurrency cannot exceed 10 to respect API rate limits');
          }
          return value;
        }
      })
      .option('max-repos', {
        type: 'number',
        description: 'Maximum number of repositories to analyze (for organization-wide analysis)',
        default: 50,
        coerce: (value: number) => {
          if (value < 1) {
            throw new Error('max-repos must be at least 1');
          }
          if (value > 200) {
            throw new Error('max-repos cannot exceed 200 to respect API rate limits');
          }
          return value;
        }
      })
      .option('successful-only', {
        type: 'boolean',
        description: 'Include only successful workflow runs',
        default: true
      })
      .option('min-cache-ops', {
        type: 'number',
        description: 'Minimum cache operations to include workflow in results',
        default: 1,
        coerce: (value: number) => {
          if (value < 0) {
            throw new Error('min-cache-ops must be non-negative');
          }
          return value;
        }
      })
      .option('output', {
        type: 'string',
        description: 'Output file path (for CSV/JSON formats)',
      })
      .option('verbose', {
        alias: 'v',
        type: 'boolean',
        description: 'Enable verbose logging',
        default: false
      })
      .example('$0', 'Analyze cache hit rates for the current repository')
      .example('$0 --owner=octocat --repo=Hello-World', 'Analyze a specific repository')
      .example('$0 --since=2023-01-01 --until=2023-12-31', 'Analyze a specific date range')
      .example('$0 --format=csv --output=cache-report.csv', 'Export results to CSV')
      .example('$0 --max-runs-per-workflow=50 --concurrency=5', 'Limit runs and increase concurrency')
      .help('h')
      .alias('h', 'help')
      .wrap(Math.min(120, process.stdout.columns || 80))
      .strict()
      .parse();

    const options: CliOptions = {
      owner: argv.owner,
      repo: argv.repo,
      since: argv.since,
      until: argv.until,
      maxRunsPerWorkflow: argv['max-runs-per-workflow'],
      maxRepos: argv['max-repos'],
      format: argv.format,
      concurrency: argv.concurrency,
      successfulOnly: argv['successful-only'],
      minCacheOps: argv['min-cache-ops'],
      output: argv.output,
      verbose: argv.verbose
    };

    // Get current repository if owner/repo not specified
    if (!options.owner && !options.repo) {
      try {
        const currentRepo = await getCurrentRepository();
        options.owner = currentRepo.owner;
        options.repo = currentRepo.repo;
      } catch {
        console.error(chalk.red('❌ Error: Could not determine repository from current directory.'));
        console.error(chalk.yellow('💡 Please specify --owner and optionally --repo options, or run from within a git repository.'));
        process.exit(1);
      }
    } else if (!options.owner && options.repo) {
      // If only repo is specified, try to get owner from current git repo
      try {
        const currentRepo = await getCurrentRepository();
        options.owner = currentRepo.owner;
      } catch {
        console.error(chalk.red('❌ Error: Could not determine repository owner from current directory.'));
        console.error(chalk.yellow('💡 Please specify --owner option or run from within a git repository.'));
        process.exit(1);
      }
    }

    // Validate required options
    if (!options.owner) {
      console.error(chalk.red('❌ Error: Repository owner is required.'));
      console.error(chalk.yellow('💡 Use --owner option or run from within a git repository.'));
      process.exit(1);
    }

    // Validate output file for CSV/JSON formats
    if ((options.format === 'csv' || options.format === 'json') && !options.output) {
      console.error(chalk.red(`❌ Error: Output file path is required for ${options.format} format.`));
      console.error(chalk.yellow(`💡 Use --output option to specify the output file path.`));
      process.exit(1);
    }

    // Display startup information
    if (options.verbose) {
      if (options.repo) {
        console.log(chalk.blue(`🔍 Analyzing cache hit rates for ${options.owner}/${options.repo}`));
      } else {
        console.log(chalk.blue(`🔍 Analyzing cache hit rates for organization: ${options.owner}`));
        console.log(chalk.gray(`📊 Max repositories: ${options.maxRepos}`));
      }
      console.log(chalk.gray(`📊 Format: ${options.format}`));
      console.log(chalk.gray(`🔄 Concurrency: ${options.concurrency}`));
      console.log(chalk.gray(`📅 Max runs per workflow: ${options.maxRunsPerWorkflow}`));
      if (options.since) {
        console.log(chalk.gray(`📅 Since: ${options.since}`));
      }
      if (options.until) {
        console.log(chalk.gray(`📅 Until: ${options.until}`));
      }
      console.log();
    }

    // Run the analysis
    await analyzeRepository(options);

  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      if (argv?.verbose) {
        console.error(chalk.gray(error.stack));
      }
    } else {
      console.error(chalk.red('❌ An unexpected error occurred'));
    }
    process.exit(1);
  }
}

// Handle process signals gracefully
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n⚡ Analysis interrupted by user'));
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log(chalk.yellow('\n⚡ Analysis terminated'));
  process.exit(143);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(chalk.red('💥 Uncaught exception:'), error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('💥 Unhandled rejection at:'), promise, 'reason:', reason);
  process.exit(1);
});

main().catch((error) => {
  console.error(chalk.red('💥 Fatal error:'), error);
  process.exit(1);
});
