async function createChart($container, chartService, alertTrendLines, widgetSize, daysToGoBack = 21, summaryBucket = 1) {

    const datePoints = getDatePoints(daysToGoBack, summaryBucket);
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
        // Support both severity and confidence fields
        const label = item.severity || item.confidence
        labels.push(label)
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
    consoleLog(`renderDurationChart for alertType: [${alertType.name}]`)
    try {
        // get the trend data for alerts first
        const showClosed = true
        const overviewType = true
        const daysToGoBack = 21
        const summaryBucket = 1
        const alertTrendLines = await getAlertsTrendLines(organization, projectName, repoId, daysToGoBack, summaryBucket, alertType, overviewType, showClosed)

        createDurationChart($container, chartService, alertTrendLines, widgetSize)
    }
    catch (err) {
        consoleLog(`Error loading the alerts trend: ${err}`)
    }
}

async function renderConfidencePieChart(organization, projectName, repoId, $container, chartService, alertType, widgetSize) {
    consoleLog('renderConfidencePieChart')
    try {
        // get the confidence data for alerts first
        const alertConfidenceCount = await getAlertConfidenceCounts(organization, projectName, repoId, alertType)

        createPieChart($container, chartService, alertConfidenceCount, widgetSize)
    }
    catch (err) {
        consoleLog(`Error loading the alerts confidence pie: ${err}`)
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

async function renderTrendLine(organization, projectName, repoId, $container, chartService, widgetSize, daysToGoBack = 21, summaryBucket = 1) {
    consoleLog('renderTrendLine');
    try {
        // get the trend data for alerts first
        const alertTrendLines = await getAlertsTrendLines(organization, projectName, repoId, daysToGoBack, summaryBucket)
        consoleLog('Dependencies AlertTrend: ' +  JSON.stringify(alertTrendLines.dependencyAlertsTrend));
        consoleLog('Code scanning AlertTrend: ' +  JSON.stringify(alertTrendLines.codeAlertsTrend));
        consoleLog('Secrets AlertTrend: ' +  JSON.stringify(alertTrendLines.secretAlertsTrend));

        createChart($container, chartService, alertTrendLines, widgetSize, daysToGoBack, summaryBucket);
    }
    catch (err) {
        consoleLog(`Error loading the alerts trend: ${err}`)
    }
}

async function createStackedBarChart($container, chartService, groupedData, widgetSize) {
    consoleLog(`createStackedBarChart with ${groupedData.series.length} repositories`);
    
    var chartOptions = {
        "hostOptions": {
            "height": "290",
            "width": getChartWidthFromWidgetSize(widgetSize)
        },
        "chartType": "stackedBar",
        "series": groupedData.series,
        "xAxis": {
            "labelValues": groupedData.datePoints,
            "labelFormatMode": "dateTime"
        },
        "specializedOptions": {
            "showLabels": "true"
        }
    };

    try {
        chartService.createChart($container, chartOptions);
    }
    catch (err) {
        console.log(`Error creating stacked bar chart: ${err}`);
    }
}

async function renderGroupedByRepoChart(organization, projectName, $container, chartService, alertType, widgetSize, daysToGoBack = 21, summaryBucket = 1) {
    consoleLog(`renderGroupedByRepoChart for alertType: [${alertType ? alertType.name : 'all'}]`);
    try {
        // Get the grouped data
        const groupedData = getAlertsGroupedByRepo(organization, projectName, daysToGoBack, summaryBucket, alertType);
        
        if (groupedData.series.length === 0) {
            consoleLog('No data available for grouped by repo chart');
            $container.text('No data available. Please ensure alerts are loaded for all repositories in the project.');
            return;
        }
        
        createStackedBarChart($container, chartService, groupedData, widgetSize);
    }
    catch (err) {
        consoleLog(`Error loading the grouped by repo chart: ${err}`);
    }
}

async function createScatterPlot($container, $chartInfo, chartService, timeToCloseData, widgetSize) {
    consoleLog(`createScatterPlot with ${timeToCloseData.dataPoints.length} data points`)
    
    if (timeToCloseData.dataPoints.length === 0) {
        $container.text('No fixed alerts available for time to close visualization.')
        return
    }

    // Group data into buckets for column chart (since scatter plot is not supported)
    const buckets = [
        { label: '0-7 days', min: 0, max: 7, count: 0 },
        { label: '8-30 days', min: 8, max: 30, count: 0 },
        { label: '31-90 days', min: 31, max: 90, count: 0 },
        { label: '91-180 days', min: 91, max: 180, count: 0 },
        { label: '181-365 days', min: 181, max: 365, count: 0 },
        { label: '365+ days', min: 366, max: Infinity, count: 0 }
    ]

    // Count alerts in each bucket
    timeToCloseData.dataPoints.forEach(days => {
        for (const bucket of buckets) {
            if (days >= bucket.min && days <= bucket.max) {
                bucket.count++
                break
            }
        }
    })

    const labels = buckets.map(b => b.label)
    const data = buckets.map(b => b.count)

    var chartOptions = {
        "hostOptions": {
            "height": "250",  // Reduced from 290 to leave room for statistics below
            "width": getChartWidthFromWidgetSize(widgetSize)
        },
        "chartType": "column",
        "series": [{
            "name": "Alerts Fixed",
            "data": data
        }],
        "xAxis": {
            "labelValues": labels
        },
        "yAxis": {
            "title": "Number of Alerts"
        },
        "specializedOptions": {
            "showLabels": "true"
        }
    }

    try {
        chartService.createChart($container, chartOptions)
        
        consoleLog('[STATS] Chart created, now adding statistics')
        consoleLog('[STATS] $chartInfo exists: ' + ($chartInfo && $chartInfo.length > 0))
        
        // Add summary statistics to the info container (separate from chart container)
        const avg = Math.round(timeToCloseData.dataPoints.reduce((a, b) => a + b, 0) / timeToCloseData.dataPoints.length)
        const min = Math.min(...timeToCloseData.dataPoints)
        const max = Math.max(...timeToCloseData.dataPoints)
        const median = timeToCloseData.dataPoints.sort((a, b) => a - b)[Math.floor(timeToCloseData.dataPoints.length / 2)]
        
        // Calculate the period covered by the fixed alerts
        const sortedDates = timeToCloseData.labels.slice().sort()
        const oldestFixDate = sortedDates[0]
        const newestFixDate = sortedDates[sortedDates.length - 1]
        
        consoleLog(`[STATS] Period: ${oldestFixDate} to ${newestFixDate}, Min: ${min}, Median: ${median}, Avg: ${avg}, Max: ${max}`)
        
        $chartInfo.empty()
        $chartInfo.html(`
            <div style="font-size: 11px; color: #333; line-height: 1.4;">
                <div><strong>Analysis Period:</strong> Last ${timeToCloseData.daysBack} days (${timeToCloseData.analysisStartDate} to ${timeToCloseData.analysisEndDate})</div>
                <div><strong>Stats:</strong> Min: ${min}d | Median: ${median}d | Avg: ${avg}d | Max: ${max}d | Total: ${timeToCloseData.dataPoints.length} closed</div>
            </div>
        `)
        consoleLog('[STATS] Statistics appended to $chartInfo')
    }
    catch (err) {
        console.log(`Error creating time to close chart: ${err}`)
    }
}

async function renderTimeToCloseChart(organization, projectName, repoId, repoName, $container, $chartInfo, chartService, alertType, widgetSize) {
    consoleLog(`renderTimeToCloseChart for alertType: [${alertType.name}]`)
    try {
        const daysBack = 90  // Show alerts closed in the last 90 days
        const timeToCloseData = await getTimeToCloseData(organization, projectName, repoId, alertType, daysBack)
        
        if (timeToCloseData.dataPoints.length === 0) {
            consoleLog('No data available for time to close chart')
            $container.html(`
                <div style="display: flex; align-items: center; justify-content: center; height: 250px; color: #666; text-align: center; padding: 20px;">
                    <div>No alerts closed in the last ${daysBack} days for ${repoName}.<br>This chart shows the time taken to close alerts.</div>
                </div>
            `)
            $chartInfo.html(`
                <div style="font-size: 11px; color: #333; line-height: 1.4;">
                    <div><strong>Analysis Period:</strong> Last ${timeToCloseData.daysBack} days (${timeToCloseData.analysisStartDate} to ${timeToCloseData.analysisEndDate})</div>
                    <div style="margin-top: 5px; color: #666;">No closed alerts found in this period.</div>
                </div>
            `)
            return
        }
        
        createScatterPlot($container, $chartInfo, chartService, timeToCloseData, widgetSize)
    }
    catch (err) {
        consoleLog(`Error loading the time to close chart: ${err}`)
    }
}