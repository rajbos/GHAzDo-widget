async function createChart($container, chartService, alertTrendLines, widgetSize) {

    const datePoints = getDatePoints();
    var chartOptions = {
        "hostOptions": {
            "height": "290",
            "width": getChartWidthFromWidgetSize(widgetSize)
        },
        "chartType": "line",
        "series":
        [
            {
                "name": "Dependencies",
                "data": alertTrendLines.dependencyAlertsTrend
            },
            {
                "name": "Code scanning",
                "data": alertTrendLines.codeAlertsTrend
            },
            {
                "name": "Secrets",
                "data": alertTrendLines.secretAlertsTrend
            }
        ],
        "xAxis": {
            "labelValues": datePoints,
            "labelFormatMode": "dateTime", // format is 2023-09-17
        },
        "specializedOptions": {
            "includeMarkers": "true"
        }
    };

    try {
        chartService.createChart($container, chartOptions)
    }
    catch (err) {
        console.log(`Error creating line chart: ${err}`)
    }
}

function getChartWidthFromWidgetSize(widgetSize) {
    // a column is 160px wide, and gutters are 10px wide, and there is 1 14px margins on the right side to handle
    return 160 * widgetSize.columnSpan + (10 * (widgetSize.columnSpan -1)) - (1 * 14)
}

async function createPieChart($container, chartService, alertSeverityCount, widgetSize) {
    // convert alertSeverityCount to two arrays, one for the labels and one for the data
    consoleLog(`createPieChart for alertSeverityCount: ${JSON.stringify(alertSeverityCount)}`)
    const data = []
    const labels = []
    for (const index in alertSeverityCount) {
        const item = alertSeverityCount[index]
        labels.push(item.severity)
        data.push(item.count)
    }

    var chartOptions = {
        "hostOptions": {
            "height": "290",
            "width": getChartWidthFromWidgetSize(widgetSize)
        },
        "chartType": "pie",
        "series": [{
            "data": data
        }],
        "xAxis": {
            "labelValues": labels
        },
        "specializedOptions": {
            "showLabels": "true",
            "size": 200
        }
    }

    try {
        chartService.createChart($container, chartOptions)
    }
    catch (err) {
        console.log(`Error creating pie chart: ${err}`)
    }
}

async function createDurationChart($container, chartService, alertSeverityCount, widgetSize) {
    consoleLog(`createDurationChart for alertSeverityCount: ${JSON.stringify(alertSeverityCount)}`)
    const datePoints = getDatePoints();
    const alertsOpenTrend = alertSeverityCount.alertsOpenTrend
    const alertsDismissedTrend = alertSeverityCount.alertsDismissedTrend
    const alertFixedTrend = alertSeverityCount.alertFixedTrend

    var chartOptions = {
        "hostOptions": {
            "height": "290",
            "width": getChartWidthFromWidgetSize(widgetSize)
        },
        "chartType": "stackedArea",
        "series": [
            {
                "name": "Open",
                "data": alertsOpenTrend
            },
            {
                "name": "Dismissed",
                "data": alertsDismissedTrend
            },
            {
                "name": "Fixed",
                "data": alertFixedTrend
            }
        ],
        "xAxis": {
            "labelValues": datePoints,
            "labelFormatMode": "dateTime", // format is 2023-09-17
        },
        "specializedOptions": {
            "showLabels": "true",
            "size": 200
        }
    }

    try {
        chartService.createChart($container, chartOptions)
    }
    catch (err) {
        console.log(`Error creating pie chart: ${err}`)
    }
}

async function renderDurationChart({organization, projectName, repoId, $container, chartService, alertType, widgetSize}) {
    consoleLog('renderTrendLine')
    try {
        // get the trend data for alerts first
        const showClosed = true
        const alertTrendLines = await getAlertsTrendLines(organization, projectName, repoId, alertType, showClosed)

        createDurationChart($container, chartService, alertTrendLines, widgetSize)
    }
    catch (err) {
        consoleLog(`Error loading the alerts trend: ${err}`)
    }
}

async function renderPieChart(organization, projectName, repoId, $container, chartService, alertType, widgetSize) {
    consoleLog('renderPieChart')
    try {
        // get the trend data for alerts first
        const alertSeverityCount = await getAlertSeverityCounts(organization, projectName, repoId, alertType)

        createPieChart($container, chartService, alertSeverityCount, widgetSize)
    }
    catch (err) {
        consoleLog(`Error loading the alerts pie: ${err}`)
    }
}

async function renderTrendLine(organization, projectName, repoId, $container, chartService, widgetSize) {
    consoleLog('renderTrendLine')
    try {
        // get the trend data for alerts first
        const alertTrendLines = await getAlertsTrendLines(organization, projectName, repoId)
        consoleLog('Dependencies AlertTrend: ' +  JSON.stringify(alertTrendLines.dependencyAlertsTrend))
        consoleLog('Code scanning AlertTrend: ' +  JSON.stringify(alertTrendLines.codeAlertsTrend))
        consoleLog('Secrets AlertTrend: ' +  JSON.stringify(alertTrendLines.secretAlertsTrend))

        createChart($container, chartService, alertTrendLines, widgetSize)
    }
    catch (err) {
        consoleLog(`Error loading the alerts trend: ${err}`)
    }
}