async function loadWidget(widgetSettings, organization, projectName) {
    consoleLog(`WidgetSettings inside loadWidget: ${JSON.stringify(widgetSettings)}`);
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
        consoleLog('loaded repoName from widgetSettings: ' + repoName);

        // set the tile
        var title = $('h2.ghazdo-title');
        title.text(`Security Alerts for ${repoName}`);
        alerts = await getAlerts(organization, projectName, repoId);
        consoleLog('alerts: ' +  JSON.stringify(alerts));

        // GHAS is only available on the SaaS version, so we can hardcode the domain
        linkBase = `https://dev.azure.com/${organization}/${projectName}/_git/${repoName}/alerts`;
    }
    else {
        consoleLog('configuration is needed first, opening with empty values');
        // set the tile to indicate config is needed
        var title = $('h2.ghazdo-title');
        title.text(`Configure the widget to get Security Alerts`);
    }

    // set the alert counts
    var dependencyAlertCount = $('p.dependencyAlertCount');
    dependencyAlertCount.text(alerts.dependencyAlerts);
    const dependencyLinkValue = `${linkBase}?_t=dependencies`;
    const dependencyLink = $('a.dependency-link');
    dependencyLink.attr('href', dependencyLinkValue);

    var secretAlertCount = $('p.secretAlertCount');
    secretAlertCount.text(alerts.secretAlerts);
    const secretLinkValue = `${linkBase}?_t=secrets`;
    const secretLink = $('a.secret-link');
    secretLink.attr('href', secretLinkValue);

    var codeAlertCount = $('p.codeAlertCount');
    codeAlertCount.text(alerts.codeAlerts);
    const codeLinkValue = `${linkBase}?_t=codescanning`;
    const codeLink = $('a.code-link');
    codeLink.attr('href', codeLinkValue);
}