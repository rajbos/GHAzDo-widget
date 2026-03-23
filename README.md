
Extension for Azure DevOps that shows the number of open security alerts for the configured repository. Please install it and let me know what you think! Create an issue for feedback or feature requests.
Install the extension from the Azure DevOps marketplace: https://marketplace.visualstudio.com/items?itemName=RobBos.GHAzDoWidget

[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/rajbos/GHAzDo-widget/badge)](https://securityscorecards.dev/viewer/?uri=github.com/rajbos/GHAzDo-widget)

## Widgets:
* Show all three alert counts in one widget in 2 by 1 layout
* Split it into three separate widgets with just the single value you scan for (1x1 or 2x1)
* Show a trend line of all alerts in the last 3 weeks (2x2,3x2,4x2)
* Show a pie chart of alerts by severity (2x2,3x2,4x2)
* Show alert status trend line (open/dismissed/fixed) (2x2,3x2,4x2)
* Show alerts grouped by repository (2x2,3x2,4x2)
* **NEW:** Show time to close scatterplot - visualize how long it takes to fix alerts (2x2,3x2,4x2)

![Screenshot of the widget showing the repository name and the alert count for dependencies, secrets, and code scanning](/img/overview_600.png)

# Things that I can think of to add:

- show the total number of alerts for the whole project
- group trend line by months
- stacked trend line (open/closed) per alert type

## Release process

Releases are published automatically to the [Azure DevOps Marketplace](https://marketplace.visualstudio.com/items?itemName=RobBos.GHAzDoWidget) by the [release workflow](.github/workflows/release.yml) when a version tag is pushed.

### Steps to release

1. **Bump the version** in `vss-extension.json` — update the `"version"` field (e.g. `"0.0.1.23"`):
   ```json
   "version": "0.0.1.23",
   ```

2. **Commit and push** the version change:
   ```bash
   git add vss-extension.json
   git commit -m "chore: bump version to 0.0.1.23"
   git push
   ```

3. **Push a tag** matching `v*` to trigger the release workflow:
   ```bash
   git tag v0.0.1.23
   git push origin v0.0.1.23
   ```

The workflow will pick up the version from `vss-extension.json` and publish the extension to the marketplace automatically.

### Prerequisites (one-time setup)

Add a `MARKETPLACE_TOKEN` secret to this repository containing an Azure DevOps PAT with the **`Marketplace (publish)`** scope.  
Create a PAT at: https://dev.azure.com/_usersSettings/tokens

## How to build the package locally

### Prerequisites
- Node.js (v24 or higher)
- Install dependencies: `npm install` (this will install the pinned version of tfx-cli)

### Build Steps

```bash
# 1. Install widget dependencies
cd widgets
npm install
cd ..

# 2. Build the pipeline task
cd dependencyReviewTask
npm run build
cd ..

# 3. Package the extension
tfx extension create --manifest-globs vss-extension-dev.json --rev-version
```
*This creates a local `.vsix` file without publishing.*
