# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-08-21

### Added
- Initial release of gha-cache-hit-rate GitHub CLI extension
- Comprehensive cache hit rate analysis across GitHub Actions workflows
- Multiple output formats: table, CSV, and JSON
- GitHub API integration with authentication and rate limiting
- Workflow log parsing for cache operation detection
- Configurable date range filtering
- Concurrent processing for performance
- Progress tracking and verbose logging
- Error handling with graceful degradation
- Actionable recommendations based on analysis
- Support for actions/cache v3 and v4 patterns
- Detailed documentation and examples
- Comprehensive test suite
- CI/CD pipeline with GitHub Actions

### Features
- Analyze cache hit rates across all repository workflows
- Filter analysis by date range and workflow run limits
- Export results to CSV or JSON for further processing
- Get performance insights and optimization recommendations
- Handle GitHub API rate limits automatically
- Detect cache operations from workflow logs
- Calculate detailed statistics including partial hits
- Support for both successful and failed workflow runs
- Configurable concurrency for API requests
- Git repository auto-detection

[Unreleased]: https://github.com/austenstone/gha-cache-hit-rate/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/austenstone/gha-cache-hit-rate/releases/tag/v0.1.0
