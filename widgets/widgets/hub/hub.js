async function createCharts({chartService, containerElement, titleElement, projectName, organization}) {

    await createHubChart({chartService, containerElement, titleElement, organization, projectName});
}

async function createHubChart({chartService, containerElement, titleElement, organization, projectName}) {

    consoleLog(`Starting to create chart for organization: [${organization}] and project: [${projectName}]`);

    if (!chartService) {
        consoleLog("chartService is null");
        return;
    }

    const data = {
            chartType: 1,
            alertType: 1,
            repo: "eShopOnWeb",
            repoId: "5e5195e1-1b44-4d4b-9310-5d33ee2c4d6c"
        }

    let repoName
    let repoId
    // init empty object first
    let alertTrendLines = {secretAlertTrend: [], dependencyAlertTrend: [], codeAlertsTrend: []};
    let chartType = 1;
    let alertTypeConfig = 1;
    if (data && data.chartType && data.chartType !== "") {
        chartType = data.chartType;
        consoleLog('loaded chartType from widgetSettings: ' + chartType);
    }
    else {
        consoleLog('chartType is not set, using default value: ' + chartType);
    }

    if (data && data.alertType) {
        alertTypeConfig = data.alertType;
        consoleLog('loaded alertType from widgetSettings: ' + alertTypeConfig);
    }

    if (data && data.repo && data.repo !== "") {
        repoName = data.repo;
        repoId = data.repoId;

        containerElement.textContent = `${data.repo}`

        const chartSize = {
            columnSpan: 2
        }

        switch (chartType) {
            case "2":
                try {
                    const alertType = GetAlertTypeFromValue(alertTypeConfig)
                    titleElement.textContent = `${alertType.display} Alerts by Severity`
                    await renderPieChart(organization, projectName, repoId, containerElement, chartService, alertType, chartSize)
                }
                catch (err) {
                    consoleLog(`Error loading the alerts pie: ${err}`)
                }
                break;
            default:
                try {
                    titleElement.textContent = `Advanced Security Alerts Trend`
                    await renderTrendLine(organization, projectName, repoId, containerElement, chartService, chartSize)
                }
                catch (err) {
                    consoleLog(`Error loading the alerts trend: ${err}`)
                }
                break
        }
        consoleLog('rendered chart')
    }
    else {
        consoleLog('configuration is needed first, opening with empty values')
        // set the tile to indicate config is needed
        titleElement.textContent = `Configure the widget to get Advanced Security alerts trend information`
    }
}