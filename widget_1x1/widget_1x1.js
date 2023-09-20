async function loadWidget(widgetSettings, organization, projectName) {
    consoleLog(`WidgetSettings inside loadWidget_1x1: ${JSON.stringify(widgetSettings)}`);
    consoleLog(`Running for organization [${organization}], projectName [${projectName}]`);

    // data contains a stringified json object, so we need to make a json object from it
    const data = JSON.parse(widgetSettings.customSettings.data);

    // init with default values
    let alerts = {
        dependencyAlerts: 0,
        secretAlerts: 0,
        codeAlerts: 0
    };
    let linkBase = 'https://dev.azure.com';

    if (data && data.repo) {
        const repoName = data.repo;
        const repoId = data.repoId;
        consoleLog(`loaded repoName from widgetSettings_1x1: [${repoName}] and id [${repoId}]`);

        // set the tile
        var title = $('h2.ghazdo-title');
        title.text(`${repoName}`);
        title.attr('title', repoName);

        consoleLog(`title set to [${repoName}]`);
        alerts = await getAlerts(organization, projectName, repoId);
        consoleLog('alerts: ' +  JSON.stringify(alerts));

        // GHAS is only available on the SaaS version, so we can hardcode the domain
        linkBase = `https://dev.azure.com/${organization}/${projectName}/_git/${repoName}/alerts`;
    }
    else {
        consoleLog('configuration_1x1 is needed first, opening with empty values');
        // set the tile to indicate config is needed
        var title = $('h2.ghazdo-title');
        title.text(`Configure the widget to get Security Alerts`);
    }

    let alertTypeToShow = 1
    if (data && data.repoAlertType) {
        alertTypeToShow = data.repoAlertType;
    }

    // set the alert count
    consoleLog(`Setting the alert count 1x1 for type ${alertTypeToShow}`);
    const alertCountEl = $('p.alertCount');
    let alertCount = 0;
    let alertTypeLink = ""
    let alertTypeDescripion = "";
    switch (alertTypeToShow) {
        case "1":
            alertCount = alerts.dependencyAlerts;
            alertTypeLink = `${linkBase}?_t=dependencies`;
            alertTypeDescripion = "Dependency Alerts";
            break;
        case "2":
            alertCount = alerts.secretAlerts;
            alertTypeLink = `${linkBase}?_t=secrets`;
            alertTypeDescripion = "Secret Scanning Alerts";
            break;
        case "3":
            alertCount = alerts.codeAlerts;
            alertTypeLink = `${linkBase}?_t=codescanning`;
            alertTypeDescripion = "Code Scanning Alerts";
            break;
        default:
            alertCount = alerts.dependencyAlerts;
            alertTypeLink = `${linkBase}?_t=dependencies`;
            alertTypeDescripion = "Dependency Alerts";
            break;
    }

    consoleLog(`Setting the alert count to [${alertCount}] with description [${alertTypeDescripion}] and link [${alertTypeLink}]`);
    try {
        alertCountEl.text(alertCount);
        const alertLinkEl = $('a.alert-link');
        alertLinkEl.attr('href', alertTypeLink);

        // set the alert type
        const alertType = $('h3.alertType');
        alertType.text(alertTypeDescripion);
    }
    catch (err) {
        consoleLog(`Error setting the alert count 1x1: ${err}`);
    }
}