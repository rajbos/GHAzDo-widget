async function createChart($container, chartService, alertTrendLines){

    const datePoints = getDatePoints();
    var chartOptions = {
        "hostOptions": {
            "height": "290",
            "width": "300"
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
        chartService.createChart($container, chartOptions);
    }
    catch (err) {
        console.log(`Error creating chart: ${err}`);
    }
}