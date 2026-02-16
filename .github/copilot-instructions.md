# GitHub Advanced Security for Azure DevOps Widget - Copilot Instructions

## Repository Overview

This repository contains an **Azure DevOps extension** that integrates GitHub Advanced Security (GHAS) into Azure DevOps. The extension displays security alerts from GitHub Advanced Security in Azure DevOps dashboards and provides pull request analysis capabilities.

**Marketplace:** https://marketplace.visualstudio.com/items?itemName=RobBos.GHAzDoWidget

### What This Extension Does

- Displays open security alert counts (dependency scanning, code scanning, secret scanning)
- Shows trend charts of alerts over time
- Provides pull request security analysis
- Integrates build result information with alert details
- Offers Azure Pipeline task for automated security checks

## Key Directories & Components

### `/widgets/` - Main Extension Widgets
The core UI components and dashboard widgets for Azure DevOps.

- **`/widgets/widgets/widget_2x1/`** - 2x1 dashboard widget displaying all 3 alert types (dependency, code, secrets)
- **`/widgets/widgets/widget_1x1/`** - 1x1 dashboard widget for single alert type display
- **`/widgets/widgets/chart/`** - Trend chart widget (supports 2x2, 3x2, 4x2 layouts)
- **`/widgets/widgets/hub/`** - Overall project dashboard hub view
- **`/widgets/pr-tab/`** - Pull request tab showing security alerts for the current PR
- **`/widgets/build-info/`** - Build results tab displaying advanced security alerts
- **`/widgets/library.js`** - Shared widget utilities and helper functions
- **`/widgets/styles.css`** - Shared CSS styling for widgets

### `/dependencyReviewTask/` - Azure Pipeline Task
Azure Pipelines task for automated PR dependency and code scanning checks.

- **`index.ts`** - Main entry point for the pipeline task
- **`task.json`** - Task definition and metadata (current version: 0.1.37)

### `/.github/workflows/` - CI/CD Automation
GitHub Actions workflows for continuous integration and deployment.

- **`ci.yml`** - Runs on PRs to main branch, builds and validates the extension
- **`handle-versioning-accross-branches.yml`** - Manages semantic versioning across branches
- **`dependency-review.yml`** - Dependency security scanning
- **`scorecards.yml`** - OpenSSF scorecard security checks
- **`createExampleRepos.yml`** - Creates example repositories for testing

## Technologies & Frameworks

- **Language:** TypeScript, JavaScript
- **Azure DevOps SDK:**
  - VSS Web Extension SDK v5.141.0
  - Azure DevOps Node API v12.1.0
  - Azure Pipelines Task Library v4.6.0
- **Build Tools:**
  - TypeScript compiler (tsc)
  - tfx-cli (Team Foundation Extension CLI) for packaging
- **Runtime:** Node.js v16 (as per CI configuration)

## Main Entry Points & Important Files

| File | Purpose |
|------|---------|
| `vss-extension-dev.json` | Development extension manifest - defines all contributions, widgets, tasks, and required scopes |
| `vss-extension.json` | Production extension manifest |
| `widgets/widgets/*/widget_*.html` | Widget UI entry points (HTML templates) |
| `widgets/widgets/*/configuration_*.html` | Widget configuration pages |
| `dependencyReviewTask/index.ts` | Pipeline task main entry point |
| `dependencyReviewTask/task.json` | Task definition with inputs, outputs, and metadata |
| `make.ps1` | PowerShell build/provision script for local development |
| `package.json` | Node.js dependencies and build scripts |

## Build, Test & Deployment

### Build Process

**Commands:**
```bash
npm run build      # Install dependencies
npm run package    # Create extension package with version bump
npm run publish    # Create production extension package
```

**Build Script:**
- `make.ps1` - PowerShell script that provisions, builds, and can publish the extension

**Output:**
- Creates `.vsix` extension package files via `tfx extension create`

### Extension Contributions

The extension provides the following contributions to Azure DevOps:

1. **Dashboard Widgets:**
   - 1x1 widget (single alert type)
   - 2x1 widget (all alert types)
   - 2x2, 3x2, 4x2 chart widgets (trend visualization)

2. **Pull Request Integration:**
   - "GHAzDo Alerts" tab showing security alerts for the current PR

3. **Build Results:**
   - Custom tab displaying security alerts found during builds

4. **Hub/Dashboard:**
   - Overall project security dashboard view

5. **Pipeline Task:**
   - "Advanced-Security-Review" task for automated security checks in pipelines

### Publishing

The extension is manually published to the Azure DevOps Marketplace:
1. Package the extension using `npm run publish`
2. Upload the `.vsix` file to https://marketplace.visualstudio.com/manage

## Development Workflow

1. Make changes to widget TypeScript/HTML files or pipeline task
2. Build locally using `npm run package`
3. Test the extension in a development Azure DevOps environment
4. CI runs on pull requests to validate builds
5. After merge, package and manually publish to marketplace

## Important Notes

- The extension requires specific Azure DevOps scopes defined in the manifest files
- Widget configurations are stored in Azure DevOps widget settings
- The pipeline task integrates with GitHub Advanced Security APIs
- Version management is handled through the versioning workflow
