# GitHub CLI Extension: gha-cache-hit-rate

A GitHub CLI extension that analyzes cache hit rates across GitHub Actions workflows to help repository owners make informed decisions about caching strategies vs. custom Docker images.

[![npm version](https://badge.fury.io/js/gha-cache-hit-rate.svg)](https://badge.fury.io/js/gha-cache-hit-rate)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 Features

- **Comprehensive Analysis**: Analyzes cache hit rates across all workflows in a repository
- **Multiple Output Formats**: Table, CSV, and JSON outputs for different use cases
- **Advanced Filtering**: Filter by date range, workflow runs, and cache operation thresholds
- **Performance Insights**: Detailed statistics with actionable recommendations
- **Concurrent Processing**: Configurable concurrency for efficient API usage
- **Progress Tracking**: Real-time progress indicators for long-running analyses
- **Error Handling**: Robust error handling with graceful degradation

## 📊 What It Analyzes

- **Cache Hit Rates**: Percentage of successful cache retrievals
- **Partial Hits**: Cache restored from fallback restore-keys
- **Cache Misses**: Operations where no cache was found
- **Performance Metrics**: Cache sizes, time saved, and efficiency trends
- **Workflow Comparison**: Side-by-side analysis of different workflows

## 🚀 Installation

### Prerequisites

- [GitHub CLI](https://cli.github.com/) installed and authenticated
- Node.js 16+ 
- npm or yarn

### Install as GitHub CLI Extension

```bash
# Install from npm
npm install -g gha-cache-hit-rate

# Or install locally for development
git clone https://github.com/austenstone/gha-cache-hit-rate.git
cd gha-cache-hit-rate
npm install
npm run build
npm link
```

### GitHub CLI Integration

Once installed, the extension is available as a GitHub CLI command:

```bash
gh cache-hit-rate --help
```

## 📚 Usage

### Basic Usage

```bash
# Analyze current repository
gh cache-hit-rate

# Analyze specific repository
gh cache-hit-rate --owner octocat --repo Hello-World

# Analyze with date range
gh cache-hit-rate --since 2023-01-01 --until 2023-12-31
```

### Advanced Usage

```bash
# Export to CSV
gh cache-hit-rate --format csv --output cache-report.csv

# Export to JSON for further processing
gh cache-hit-rate --format json --output cache-data.json

# Limit analysis scope
gh cache-hit-rate --max-runs-per-workflow 50 --min-cache-ops 5

# Increase concurrency for large repos
gh cache-hit-rate --concurrency 5 --verbose
```

### Command Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--owner` | `-o` | Repository owner | Current repo |
| `--repo` | `-r` | Repository name | Current repo |
| `--since` | `-s` | Start date (YYYY-MM-DD) | 30 days ago |
| `--until` | `-u` | End date (YYYY-MM-DD) | Today |
| `--max-runs-per-workflow` | `-m` | Max runs to analyze per workflow | 100 |
| `--format` | `-f` | Output format (table/csv/json) | table |
| `--concurrency` | `-c` | Concurrent API requests | 3 |
| `--successful-only` | | Include only successful runs | true |
| `--min-cache-ops` | | Min cache operations to include workflow | 1 |
| `--output` | | Output file path (for CSV/JSON) | - |
| `--verbose` | `-v` | Enable verbose logging | false |

## 📈 Output Examples

### Table Output

```
🔍 GitHub Actions Cache Hit Rate Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 Repository: octocat/Hello-World
📅 Analysis Period: 2023-01-01 → 2023-12-31
🏃 Total Runs Analyzed: 245

📊 Overall Statistics
──────────────────────────────
┌─────────────────────────┬───────────────┐
│ Metric                  │ Value         │
├─────────────────────────┼───────────────┤
│ Total Cache Operations  │ 1,247         │
│ Cache Hits              │ 891 (71.4%)   │
│ Cache Misses            │ 289 (23.2%)   │
│ Partial Hits            │ 67 (5.4%)     │
│ Hit Rate                │ 71.4%         │
│ Effective Hit Rate      │ 76.8%         │
└─────────────────────────┴───────────────┘

🔧 Workflow Breakdown
──────────────────────────────────────────────────
┌─────────────────────────┬────────────┬────────────┬─────────────┬────────────┬────────────┐
│ Workflow                │ Operations │ Hit Rate   │ Partial Rate│ Avg Size   │ Time Saved │
├─────────────────────────┼────────────┼────────────┼─────────────┼────────────┼────────────┤
│ CI                      │ 456        │ 78.5%      │ 12.3%       │ 125.3MB    │ 2.4m       │
│ Build                   │ 234        │ 65.2%      │ 8.1%        │ 89.7MB     │ 1.8m       │
│ Test                    │ 345        │ 82.1%      │ 6.7%        │ 45.2MB     │ 1.2m       │
│ Deploy                  │ 212        │ 70.8%      │ 15.6%       │ 78.4MB     │ 1.1m       │
└─────────────────────────┴────────────┴────────────┴─────────────┴────────────┴────────────┘

💡 Recommendations
──────────────────────────────
✅ Good overall hit rate! Your caching strategy is working well.
🎯 2 workflow(s) have room for improvement (<70% hit rate).
   • Review cache key generation logic
   • Consider using more stable cache keys
🔄 Moderate partial hit rate suggests some cache key instability.
   • Consider using more stable primary keys
```

### CSV Output

The CSV output includes detailed per-workflow statistics:

```csv
Repository,Workflow Name,Total Cache Operations,Cache Hits,Cache Misses,Partial Hits,Hit Rate (%),Partial Hit Rate (%),Effective Hit Rate (%)
octocat/Hello-World,OVERALL SUMMARY,1247,891,289,67,71.4,5.4,76.8
octocat/Hello-World,CI,456,358,76,22,78.5,4.8,83.3
octocat/Hello-World,Build,234,153,65,16,65.4,6.8,72.2
```

### JSON Output

The JSON output provides comprehensive data including insights and recommendations:

```json
{
  "metadata": {
    "generatedAt": "2023-12-01T10:30:00.000Z",
    "tool": "gha-cache-hit-rate",
    "version": "0.1.0",
    "repository": {
      "owner": "octocat",
      "repo": "Hello-World",
      "fullName": "octocat/Hello-World"
    }
  },
  "summary": {
    "overall": {
      "totalCacheOperations": 1247,
      "hitRate": 71.4,
      "effectiveHitRate": 76.8
    }
  },
  "workflows": [...],
  "recommendations": [...],
  "insights": [...]
}
```

## 🔧 Configuration

### Authentication

The extension uses GitHub CLI's authentication automatically. Ensure you're logged in:

```bash
gh auth login
```

Alternatively, set environment variables:

```bash
export GITHUB_TOKEN=your_token_here
# or
export GH_TOKEN=your_token_here
```

### Rate Limiting

The extension automatically handles GitHub API rate limits:

- Monitors remaining requests
- Implements exponential backoff
- Waits for rate limit reset when needed
- Configurable concurrency to stay within limits

## 🏗️ Architecture

### Core Components

- **CLI Interface**: Yargs-based command-line interface
- **GitHub API Client**: Octokit wrapper with authentication and rate limiting
- **Log Parser**: Regex-based cache operation detection from workflow logs
- **Statistics Calculator**: Hit rate analysis and aggregation
- **Output Formatters**: Table, CSV, and JSON output generators

### Cache Detection

The tool detects cache operations by parsing workflow logs for patterns from:

- `actions/cache@v3` and `actions/cache@v4`
- Custom cache implementations
- Various cache result types (hit, miss, partial)

### Performance Optimizations

- Concurrent API requests with configurable limits
- Streaming log processing for memory efficiency
- Intelligent caching of API responses
- Progress reporting for long-running operations

## 🧪 Development

### Setup

```bash
git clone https://github.com/austenstone/gha-cache-hit-rate.git
cd gha-cache-hit-rate
npm install
```

### Development Workflow

```bash
# Build TypeScript
npm run build

# Run tests
npm test

# Watch mode for development
npm run dev

# Lint code
npm run lint
npm run lint:fix
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Test specific workflow
npm run test -- --grep "CacheLogParser"
```

### Project Structure

```
src/
├── index.ts              # CLI entry point
├── lib/
│   ├── analyzer.ts       # Main analysis orchestrator
│   ├── github-api.ts     # GitHub API client
│   └── cache-parser.ts   # Log parsing logic
├── output/
│   ├── table.ts          # Table formatter
│   ├── csv.ts            # CSV formatter
│   └── json.ts           # JSON formatter
├── types/
│   └── index.ts          # TypeScript interfaces
└── utils/
    ├── git.ts            # Git repository utilities
    ├── format.ts         # Formatting utilities
    └── errors.ts         # Error handling
```

## 📝 Use Cases

### 1. Cache Strategy Optimization

Identify workflows with poor cache performance and optimize cache keys:

```bash
gh cache-hit-rate --format json --output analysis.json
# Review workflows with <50% hit rates
```

### 2. Docker Image vs Caching Decision

For workflows with consistently low hit rates, consider custom Docker images:

```bash
gh cache-hit-rate --min-cache-ops 20 --verbose
# Look for workflows with high operation count but low hit rates
```

### 3. Historical Performance Tracking

Track cache performance over time:

```bash
# Last quarter analysis
gh cache-hit-rate --since 2023-10-01 --until 2023-12-31 --format csv --output q4-2023.csv

# Compare with previous quarter
gh cache-hit-rate --since 2023-07-01 --until 2023-09-30 --format csv --output q3-2023.csv
```

### 4. Team Performance Reports

Generate reports for team meetings:

```bash
gh cache-hit-rate --format json --output team-report.json
# Use insights and recommendations sections for action items
```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

### Reporting Issues

Please use the [GitHub Issues](https://github.com/austenstone/gha-cache-hit-rate/issues) page to report bugs or request features.

### Development Guidelines

- Follow TypeScript best practices
- Add tests for new features
- Update documentation for API changes
- Use conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- GitHub Actions team for the cache action
- GitHub CLI team for the extension framework
- Octokit contributors for the excellent GitHub API client

## 🔗 Related Projects

- [actions/cache](https://github.com/actions/cache) - Official GitHub Actions caching
- [GitHub CLI](https://github.com/cli/cli) - Official GitHub command line tool
- [workflow-telemetry-action](https://github.com/runforesight/workflow-telemetry-action) - Workflow performance monitoring

---

**Made with ❤️ by [Austen Stone](https://github.com/austenstone)**
