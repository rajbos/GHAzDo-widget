async function createCharts({chartService, projectName, organization}) {

    // load the overall trend chart
    const lineData = {
        chartType: "1",
        alertType: 1,
        repo: "All repos",
        repoId: "-1",
        widgetWidth: 4,
        containerName: "ChartContainerOverallTrend",
        titleName: "TitleOverallTrend"
    }
    await createHubChart({chartService, organization, projectName, data: lineData});

    // load the overall dependency pie chart
    const dependencyPieData = {
        chartType: "2",
        alertType: "1",
        repo: "All repos",
        repoId: "-1",
        containerName: "ChartContainerOverallDependencyPie",
        titleName: "TitleOverallDependencyPie"
    }
    await createHubChart({chartService, organization, projectName, data: dependencyPieData});

    // load the overall code scanning chart
    const codeScanningPieData = {
        chartType: "2",
        alertType: AlertType.CODE.value.toString(),
        repo: "All repos",
        repoId: "-1",
        containerName: "ChartContainerOverallCodeScanningPie",
        titleName: "TitleOverallCodeScanningPie"
    }
    await createHubChart({chartService, organization, projectName, data: codeScanningPieData});

    // load the overall secret confidence chart
    const secretPieData = {
        chartType: "2",
        alertType: AlertType.SECRET.value.toString(),
        repo: "All repos",
        repoId: "-1",
        containerName: "ChartContainerOverallSecretPie",
        titleName: "TitleOverallSecretPie",
        useConfidence: true
    }
    await createHubChart({chartService, organization, projectName, data: secretPieData});
}

async function createHubChart({chartService, organization, projectName, data}) {

    consoleLog(`Starting to create chart for organization: [${organization}] and project: [${projectName}]`);
    const containerElement = document.getElementById(data.containerName);
    if (!containerElement) {
        consoleLog(`containerElement is null for containerName: [${data.containerName}]`);
    }
    const titleElement = document.getElementById(data.titleName);
    if (!titleElement) {
        consoleLog(`titleElement is null for titleName: [${data.titleName}]`);
    }

    // check if the containerElement is empty, if not, clear it first
    if (containerElement && containerElement.hasChildNodes()) {
        while (containerElement.firstChild) {
            containerElement.removeChild(containerElement.firstChild);
        }
    }

    if (!chartService) {
        consoleLog("chartService is null");
        return;
    }

    let chartType = 1;
    let alertTypeConfig = 1;
    if (data && data.chartType && data.chartType !== "") {
        chartType = data.chartType;
        consoleLog(`loaded chartType from widgetSettings: ${chartType}`);
    }
    else {
        consoleLog(`chartType is not set, using default value: ${chartType}`);
    }

    if (data && data.alertType) {
        alertTypeConfig = data.alertType;
        consoleLog(`loaded alertType from widgetSettings: ${alertTypeConfig}`);
    }

    if (data && data.repo && data.repo !== "") {
        const repoId = data.repoId;
        const chartSize = {
            columnSpan: 2
        }

        if (data.widgetWidth) {
            chartSize.columnSpan = data.widgetWidth;
        }

        switch (chartType) {
            case "2":
                try {
                    const alertType = GetAlertTypeFromValue(alertTypeConfig)
                    if (data.useConfidence) {
                        // Use confidence levels for secret alerts
                        if (titleElement) {
                            titleElement.textContent = `${alertType.display} alerts by confidence`
                        }
                        await renderConfidencePieChart(organization, projectName, repoId, containerElement, chartService, alertType, chartSize)
                    }
                    else {
                        // Use severity levels for dependency and code scanning alerts
                        if (titleElement) {
                            titleElement.textContent = `${alertType.display} alerts by severity`
                        }
                        await renderPieChart(organization, projectName, repoId, containerElement, chartService, alertType, chartSize)
                    }
                }
                catch (err) {
                    consoleLog(`Error loading the alerts pie: ${err}`)
                }
                break;
            default:
                try {
                    if (titleElement) {
                        titleElement.textContent = `Advanced Security alerts trend for ${projectName}`
                    }
                    const daysToGoBack = 26 * 7 // look back half a year in chunks that count up to today
                    const summaryBucket = 7
                    await renderTrendLine(organization, projectName, repoId, containerElement, chartService, chartSize, daysToGoBack, summaryBucket)
                }
                catch (err) {
                    consoleLog(`Error loading the alerts trend: ${err}`)
                }
                break
        }
        consoleLog('Rendered chart')
    }
    else {
        consoleLog('Configuration is needed first, opening with empty values')
        // set the tile to indicate config is needed
        if (containerElement) {
            titleElement.textContent = `Configure the widget to get Advanced Security alerts trend information`
        }
    }
}