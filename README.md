
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

* `npm install`
* `npm run package`
