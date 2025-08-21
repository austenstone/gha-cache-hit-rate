# Contributing to gha-cache-hit-rate

Thank you for your interest in contributing to `gha-cache-hit-rate`! 🎉

## 🚀 Quick Start

1. **Fork** the repository
2. **Clone** your fork locally
3. **Install** dependencies: `npm install`
4. **Build** the project: `npm run build`
5. **Run** tests: `npm test`

## 🏗️ Development Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- GitHub CLI (for testing)
- Git

### Local Development

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/gha-cache-hit-rate.git
cd gha-cache-hit-rate

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Run linter
npm run lint
```

### Project Structure

```
src/
├── index.ts              # CLI entry point
├── lib/                  # Core logic
│   ├── analyzer.ts       # Main orchestrator
│   ├── github-api.ts     # GitHub API client
│   └── cache-parser.ts   # Log parsing
├── output/               # Output formatters
├── types/                # TypeScript definitions
└── utils/                # Utilities

tests/                    # Test files
.github/                  # GitHub workflows
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test cache-parser.test.ts

# Run with coverage
npm run test:coverage
```

### Writing Tests

- Use Vitest for testing framework
- Place tests in `tests/` directory
- Name test files `*.test.ts`
- Mock external dependencies when necessary

Example test:

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../src/utils/helper.js';

describe('myFunction', () => {
  it('should return expected result', () => {
    expect(myFunction('input')).toBe('expected output');
  });
});
```

## 📝 Code Style

### TypeScript Guidelines

- Use strict TypeScript configuration
- Define interfaces for all data structures
- Prefer explicit types over `any`
- Use meaningful variable and function names
- Document complex functions with JSDoc

### Formatting

- Use Prettier for code formatting
- 2 spaces for indentation
- Single quotes for strings
- Trailing commas where applicable

### Linting

```bash
# Check for lint errors
npm run lint

# Auto-fix lint errors
npm run lint:fix
```

## 🔄 Git Workflow

### Branching Strategy

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/feature-name` - New features
- `fix/bug-description` - Bug fixes
- `docs/documentation-update` - Documentation changes

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type(scope): description

[optional body]

[optional footer]
```

Examples:
- `feat(parser): add support for cache v4 log format`
- `fix(api): handle rate limit errors gracefully`
- `docs(readme): update installation instructions`
- `test(utils): add tests for date formatting`

### Pull Request Process

1. **Create** a feature branch from `develop`
2. **Make** your changes with appropriate tests
3. **Ensure** all tests pass and code is linted
4. **Update** documentation if needed
5. **Submit** a pull request to `develop`

### PR Guidelines

- Include a clear description of changes
- Reference any related issues
- Add screenshots for UI changes
- Ensure CI checks pass
- Request review from maintainers

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Clear description** of the issue
2. **Steps to reproduce** the bug
3. **Expected vs actual behavior**
4. **Environment details** (OS, Node.js version, etc.)
5. **Log output** if applicable
6. **Minimal reproduction case** if possible

Use the bug report template in GitHub Issues.

## ✨ Feature Requests

For new features:

1. **Check existing issues** to avoid duplicates
2. **Describe the use case** and problem being solved
3. **Propose a solution** if you have ideas
4. **Consider backwards compatibility**
5. **Be open to discussion** about implementation

## 🔧 Types of Contributions

### Code Contributions

- **New features** - Add functionality to improve the tool
- **Bug fixes** - Fix issues or improve reliability
- **Performance** - Optimize existing code
- **Tests** - Improve test coverage
- **Refactoring** - Improve code quality

### Non-Code Contributions

- **Documentation** - Improve README, guides, or code comments
- **Examples** - Add usage examples or tutorials
- **Issue triage** - Help categorize and respond to issues
- **Community** - Answer questions and help other users

## 📦 Release Process

### Versioning

We use [Semantic Versioning](https://semver.org/):

- **MAJOR** - Breaking changes
- **MINOR** - New features (backward compatible)
- **PATCH** - Bug fixes (backward compatible)

### Release Checklist

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create release PR to `main`
4. Tag release after merge
5. Publish to npm
6. Create GitHub release

## 🤝 Code of Conduct

### Our Standards

- **Be respectful** and inclusive
- **Be constructive** in feedback
- **Be patient** with newcomers
- **Be collaborative** and helpful

### Unacceptable Behavior

- Harassment or discrimination
- Offensive or inappropriate language
- Personal attacks or trolling
- Publishing private information

## 📞 Getting Help

### Resources

- 📖 [README](README.md) - Project overview and usage
- 🐛 [Issues](https://github.com/austenstone/gha-cache-hit-rate/issues) - Bug reports and feature requests
- 💬 [Discussions](https://github.com/austenstone/gha-cache-hit-rate/discussions) - Questions and community

### Contact

- **GitHub Issues** - For bugs and feature requests
- **GitHub Discussions** - For questions and general discussion
- **Email** - For security issues: austen@austenstone.com

## 🏆 Recognition

Contributors will be:

- Added to the [Contributors](https://github.com/austenstone/gha-cache-hit-rate/graphs/contributors) page
- Mentioned in release notes for significant contributions
- Invited to be maintainers for sustained contributions

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to `gha-cache-hit-rate`! Your efforts help make GitHub Actions caching more efficient for everyone. 🚀
