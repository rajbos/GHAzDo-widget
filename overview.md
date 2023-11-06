Extension for Azure DevOps that shows the number of open security alerts for the configured repository. Please install it and let me know what you think! Create an issue for feedback or feature requests.

Install from the marketplace: https://marketplace.visualstudio.com/items?itemName=RobBos.GHAzDoWidget

## Widgets:
* Show all three alert counts in one widget in 2 by 1 layout
* Split it into three separate widgets with just the single value you scan for (1x1 or 2x1)
* Show a trend line of all alerts in the last 3 weeks (2x2,3x2,4x2)

![Screenshot of the all the widgets with alert count for dependencies, secrets, and code scanning](/img/overview_600.png)

## Pipeline tasks
* Advanced-Security-Review: lets you check the pull request for newly introduced alerts from Dependency Scanning or Code Scanning (configurable). If new alerts are introduced, the task will fail. 
> Note: 
> * Needs to run in a PR context, or it will be skipped.
> * The DependencyScanTask needs to have run on the source branch of the PR **before the PR check runs**

### Advanced Security Review Output
If new alerts are found in the source branch (compared to the target branch), the task will fail:
![Screenshot of the failure message of the review task](/img/dependencyReviewTask.png)

## GitHub repo
Please report issues, feature request, and feedback here: https://github.com/rajbos/GHAzDo-widget.

> Note: only project level dashboards are supported at the moment.