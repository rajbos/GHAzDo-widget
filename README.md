
Extension for Azure DevOps that shows the number of open security alerts for the configured repository. Please install it and let me know what you think! Create an issue for feedback or feature requests.
Install the extension from the Azure DevOps marketplace: https://marketplace.visualstudio.com/items?itemName=RobBos.GHAzDoWidget

[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/rajbos/GHAzDo-widget/badge)](https://securityscorecards.dev/viewer/?uri=github.com/rajbos/GHAzDo-widget)

## Widgets:
* Show all three alert counts in one widget in 2 by 1 layout
* Split it into three separate widgets with just the single value you scan for (1x1 or 2x1)
* Show a trend line of all alerts in the last 3 weeks (2x2,3x2,4x2)

![Screenshot of the widget showing the repository name and the alert count for dependencies, secrets, and code scanning](/img/overview_600.png)

# Things that I can think of to add:

- show the total number of alerts for the whole project
- group trend line by months
- stacked trend line (open/closed) per alert type

## How to build the package

### Prerequisites
- Node.js (v16 or higher)
- Install tfx-cli globally: `npm install -g tfx-cli`
- **For publishing:** Azure DevOps PAT with **both Marketplace scopes:**
  - **Marketplace (Acquire)** - needed to read extension info
  - **Marketplace (Publish)** - needed to publish extension
  - Create at: https://dev.azure.com/_usersSettings/tokens
  - Set environment variable: `$env:AZURE_DEVOPS_PAT = "your-pat-token"`

### Build Steps

**Option 1: Using PowerShell script (recommended)**
```powershell
.\make.ps1 -command build     # Build DEV version (requires AZURE_DEVOPS_PAT)
.\make.ps1 -command publish   # Build PROD version (requires AZURE_DEVOPS_PAT)
```
*Note: Both build and publish commands auto-publish to the marketplace. They require a PAT with 'Marketplace (Publish)' scope.*

**Option 2: Manual build**
```bash
# 1. Install widget dependencies
cd widgets
npm install
cd ..

# 2. Build the pipeline task
cd dependencyReviewTask
npm run build
cd ..

# 3. Package the extension (auto-increments version)
tfx extension create --manifest-globs vss-extension-dev.json --rev-version
```
*This creates a local `.vsix` file without publishing.*

### Publishing to Marketplace

```bash
# Publish the created .vsix file
tfx extension publish --vsix RobBos.GHAzDoWidget-DEV-{version}.vsix --service-url https://marketplace.visualstudio.com --token "your-pat-token"
```

Or manually upload the `.vsix` file at the [Azure DevOps Marketplace Publisher Portal](https://marketplace.visualstudio.com/manage).
