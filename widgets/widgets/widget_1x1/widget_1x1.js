async function loadWidget(widgetSettings, organization, projectName, VSS, Service, GitWebApi) {
    consoleLog(`WidgetSettings inside loadWidget_1x1: ${JSON.stringify(widgetSettings)}`);
    consoleLog(`Running for organization [${organization}], projectName [${projectName}]`);

    // data contains a stringified json object, so we need to make a json object from it
    const data = JSON.parse(widgetSettings.customSettings.data);
    consoleLog(`data from the widgetSettings: ${JSON.stringify(data)}`);

    // init with default values
    let alerts = {
        dependencyAlerts: 0,
        secretAlerts: 0,
        codeAlerts: 0
    };
    let linkBase = 'https://dev.azure.com';

    if (data) {
        const repoId = data.repoId;
        let repoName = "";
        if (data.repo) {
            repoName = data.repo
            consoleLog(`loaded repoName from widgetSettings_1x1: [${repoName}] and id [${repoId}]`);

            alerts = (await getAlerts(organization, projectName, repoId)).values;
        }
        else {
            // load alerts for ALL repos in the project
            repoName = `${projectName}`;
            // todo: load all
            consoleLog(`loading alerts for all repos in the project [${repoName}]`);

            const repos = await getRepos(VSS, Service, GitWebApi, projectName, useCache = true)
            for (let repoIndex in repos) {
                const repo = repos[repoIndex];
                consoleLog(`loading alerts for repo [${repo.name}] with id [${repo.id}]`);
                // call and let the promise handle the rest
                const repoAlerts = await getAlerts(organization, projectName, repo.id)

                alerts.codeAlerts += repoAlerts.values.codeAlerts;
                alerts.dependencyAlerts += repoAlerts.values.dependencyAlerts;
                alerts.secretAlerts += repoAlerts.values.secretAlerts;
            }
        }
        consoleLog('alerts: ' +  JSON.stringify(alerts));

        // set the title
        var title = $('h2.ghazdo-title');
        title.text(`${repoName}`);

        // set the color
        const color = data.color ? data.color : '#68217a'; // default to purple
        const widget = document.getElementById('GHAzDo-widget');
        widget.style.backgroundColor = `${color}`;

        // GHAS is only available on the SaaS version, so we can hardcode the domain
        repoName = handleNames(repoName); // handle spaces and other characters in the repo name
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
        consoleLog(`loaded repoAlertType from widgetSettings_1x1: [${data.repoAlertType}]`);
        alertTypeToShow = data.repoAlertType;
    }
    else {
        consoleLog(`repoAlertType not found in widgetSettings_1x1, defaulting to [${alertTypeToShow}]`);
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