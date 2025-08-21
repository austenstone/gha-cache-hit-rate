# gh actions-cache-hit-rate

[![GitHub](https://img.shields.io/github/license/austenstone/gh-actions-cache-hit-rate)](https://github.com/austenstone/gh-actions-cache-hit-rate/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/v/gh-actions-cache-hit-rate)](https://www.npmjs.com/package/gh-actions-cache-hit-rate)

> **GitHub CLI extension to analyze cache hit rates across GitHub Actions workflows** 🚀

Get detailed insights into your GitHub Actions cache performance with beautiful reports showing hit rates, cache sizes, time saved, and optimization recommendations.

## 🎯 Features

- **📊 Comprehensive Analytics**: Overall cache hit rates, miss rates, and partial hits
- **🔧 Workflow-level Breakdown**: Detailed analysis per workflow
- **📈 Time Series Data**: Cache performance over time
- **💾 Cache Size Tracking**: Monitor cache storage usage
- **⏱️ Performance Metrics**: Time saved through caching
- **📋 Multiple Output Formats**: Table, CSV, and JSON with insights
- **🎨 Beautiful CLI Interface**: Colorized output with progress indicators
- **🔍 Smart Repository Detection**: Auto-detects current repository context

## 📦 Installation

### As a GitHub CLI Extension (Recommended)

```bash
gh extension install austenstone/gh-actions-cache-hit-rate
```

### Via npm

```bash
npm install -g gh-actions-cache-hit-rate
```

```bash
gh cache-hit-rate --help
```

## � Usage

### Basic Usage

```bash
# Analyze current repository
gh actions-cache-hit-rate

# Analyze specific repository
gh actions-cache-hit-rate --owner facebook --repo react

# With custom date range
gh actions-cache-hit-rate --since 2024-01-01 --until 2024-01-31
```

### Advanced Options

```bash
# Limit analysis scope
gh actions-cache-hit-rate --max-runs-per-workflow 10 --max-age-days 30

# Different output formats
gh actions-cache-hit-rate --format csv --output cache-report.csv
gh actions-cache-hit-rate --format json --output cache-data.json

# Verbose output with progress
gh actions-cache-hit-rate --verbose

# Higher concurrency for faster analysis
gh actions-cache-hit-rate --concurrency 5
```

## 📋 Command Reference

```bash
gh actions-cache-hit-rate [options]

Options:
  -o, --owner <owner>                 Repository owner (auto-detected)
  -r, --repo <repo>                   Repository name (auto-detected)  
  -s, --since <date>                  Start date (YYYY-MM-DD)
  -u, --until <date>                  End date (YYYY-MM-DD)
      --max-runs-per-workflow <num>   Limit runs per workflow (default: 50)
      --max-age-days <days>           Only analyze runs from last N days
      --format <type>                 Output format: table|csv|json (default: table)
      --output <file>                 Output file path
      --concurrency <num>             Concurrent requests (default: 3)
  -v, --verbose                       Detailed progress output
      --version                       Show version
  -h, --help                          Show help
```

## 📊 Sample Output

### Table Format
```
🔍 GitHub Actions Cache Hit Rate Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 Repository: facebook/react
📅 Analysis Period: 2024-01-01 → 2024-01-31  
🏃 Total Runs Analyzed: 245

📊 Overall Statistics
──────────────────────────────
┌─────────────────────────┬───────────────┐
│ Metric                  │ Value         │
├─────────────────────────┼───────────────┤
│ Total Cache Operations  │ 2,847         │
├─────────────────────────┼───────────────┤
│ Cache Hits              │ 2,456 (86.3%) │
├─────────────────────────┼───────────────┤
│ Cache Misses            │ 321 (11.3%)   │
├─────────────────────────┼───────────────┤
│ Partial Hits            │ 70 (2.5%)     │
├─────────────────────────┼───────────────┤
│ Hit Rate                │ 86.3%         │
├─────────────────────────┼───────────────┤
│ Effective Hit Rate      │ 88.8%         │
└─────────────────────────┴───────────────┘

🔧 Workflow Breakdown
──────────────────────────────────────────────────
┌─────────────────────────┬────────────┬────────────┬────────────┬────────────┐
│ Workflow                │ Operations │ Hit Rate   │ Avg Size   │ Time Saved │
├─────────────────────────┼────────────┼────────────┼────────────┼────────────┤
│ CI                      │ 1,245      │ 89.2%      │ 156.3MB    │ 2.1h       │
├─────────────────────────┼────────────┼────────────┼────────────┼────────────┤
│ Build and Test          │ 856        │ 84.1%      │ 203.7MB    │ 1.8h       │
├─────────────────────────┼────────────┼────────────┼────────────┼────────────┤
│ Lint                    │ 425        │ 91.8%      │ 89.2MB     │ 45m        │
├─────────────────────────┼────────────┼────────────┼────────────┼────────────┤
│ Release                 │ 321        │ 79.4%      │ 124.5MB    │ 23m        │
└─────────────────────────┴────────────┴────────────┴────────────┴────────────┘
```

### JSON Format with Insights
```json
{
  "repository": "facebook/react",
  "analyzedPeriod": {
    "start": "2024-01-01",
    "end": "2024-01-31"
  },
  "summary": {
    "totalOperations": 2847,
    "hitRate": 86.3,
    "effectiveHitRate": 88.8,
    "totalTimeSaved": "4.9h"
  },
  "insights": [
    "🎯 Overall hit rate of 86.3% is above the recommended 80% threshold",
    "⚡ CI workflow shows excellent 89.2% hit rate - keep it up!",
    "🔧 Release workflow at 79.4% could benefit from optimization",
    "💡 Consider reviewing cache keys for Build and Test workflow"
  ],
  "recommendations": [
    "📈 Focus on optimizing Release workflow cache strategy",
    "🗂️ Review cache key patterns for better hit rates",
    "📊 Monitor cache size growth in CI workflow (156.3MB avg)"
  ]
}
```

## 🔧 Development

### Prerequisites
- Node.js 18+
- GitHub CLI (`gh`)
- GitHub personal access token with appropriate permissions

### Setup
```bash
git clone https://github.com/austenstone/gh-actions-cache-hit-rate
cd gh-actions-cache-hit-rate
npm install
npm run build
```

### Testing
```bash
npm test
npm run test:watch
```

### Local Development
```bash
# Install locally as extension
gh extension install .

# Test with your repository  
gh actions-cache-hit-rate --verbose
```

## 📚 How It Works

1. **🔍 Discovery**: Fetches all workflows and recent runs from GitHub API
2. **📥 Log Analysis**: Downloads workflow run logs and extracts cache operations  
3. **🧮 Processing**: Parses cache hits, misses, and metadata using regex patterns
4. **📊 Aggregation**: Calculates statistics, hit rates, and performance metrics
5. **🎨 Presentation**: Formats results in beautiful, actionable reports

The tool supports multiple cache action versions and patterns:
- `actions/cache@v3` and `v4`
- Custom cache implementations
- Node.js/npm/yarn dependency caching
- Docker layer caching
- And more!

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [GitHub CLI](https://cli.github.com/) for the excellent extension framework
- [Octokit](https://github.com/octokit/octokit.js) for GitHub API integration  
- The GitHub Actions team for building an amazing platform

---

**⭐ If this tool helps optimize your workflows, please consider giving it a star!**
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
