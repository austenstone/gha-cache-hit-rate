# Installation Guide for gh-actions-cache-hit-rate

## Publishing as a GitHub CLI Extension

### Step 1: Create the Repository
1. Create a new repository on GitHub named `gh-actions-cache-hit-rate`
2. Push this code to that repository

### Step 2: Make the Repository Public
GitHub CLI extensions must be in public repositories.

### Step 3: Tag a Release
```bash
git tag v0.1.0
git push origin v0.1.0
```

### Step 4: Users Can Install
Once published, users can install with:
```bash
gh extension install austenstone/gh-actions-cache-hit-rate
```

## Alternative: Manual Installation

### For Development/Testing
```bash
# Clone the repository
git clone https://github.com/austenstone/gh-actions-cache-hit-rate
cd gh-actions-cache-hit-rate

# Install dependencies and build
npm install
npm run build

# Install locally as extension
gh extension install .

# Test it
gh actions-cache-hit-rate --help
```

### Via npm
```bash
npm install -g gh-actions-cache-hit-rate
```

## Usage
Once installed, the extension is available as:
```bash
gh actions-cache-hit-rate
```

The tool will automatically detect the current repository context when run from within a git repository, or you can specify repository details manually.
