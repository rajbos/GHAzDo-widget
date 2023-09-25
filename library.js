function getAuthHeader() {
    return new Promise((resolve, reject) => {
        VSS.require(["VSS/Authentication/Services"], function(
            VSS_Auth_Service
            ) {
            VSS.getAccessToken().then(token => {
                // Format the auth header
                let authHeader = VSS_Auth_Service.authTokenManager.getAuthorizationHeader(
                    token
                );
                resolve(authHeader);
            });
        });
    });
}

function authenticatedGet(url) {
    return getAuthHeader()
        .then(authHeader =>
        fetch(url, {
            headers: {
            "Content-Type": "application/json",
            Authorization: authHeader
            }
        })
        )
        .then(x => x.json());
}
class AlertType {
    constructor(name, value, display, displayPlural) {
        this.name = name;
        this.value = value;
        this.display = display;
        this.displayPlural = displayPlural;
    }

    static get DEPENDENCY() {
        return new AlertType('dependency', 1, 'Dependency', 'dependencies');
    }

    static get SECRET() {
        return new AlertType('secret', 2, 'Secret', 'secrets');
    }

    static get CODE() {
        return new AlertType('code', 3, 'Code scanning', 'code');
    }
}

function GetAlertTypeFromValue(value) {
    switch (value) {
        case "1":
            return AlertType.DEPENDENCY;
        case "2":
            return AlertType.SECRET;
        case "3":
            return AlertType.CODE;
        default:
            return null;
    }
}

async function getAlerts(organization, projectName, repoId) {
    consoleLog('getAlerts');

    let values = {
        count: 0,
        dependencyAlerts: 0,
        secretAlerts: 0,
        codeAlerts: 0
    };

    try {
        // no pagination option, so just get the first 5000 alerts
        url = `https://advsec.dev.azure.com/${organization}/${projectName}/_apis/AdvancedSecurity/repositories/${repoId}/alerts?top=5000&criteria.onlyDefaultBranchAlerts=true&criteria.states=1&api-version=7.2-preview.1`;
        consoleLog(`Calling url: [${url}]`);
        const alertResult = await authenticatedGet(url);
        if (!alertResult) {
            consoleLog('alertResult is null');
        }
        else {
            //consoleLog('alertResult: ' + JSON.stringify(alertResult));
            consoleLog('alertResult count: ' + alertResult.count);

            const dependencyAlerts = alertResult.value.filter(alert => alert.alertType === AlertType.DEPENDENCY.name);
            const secretAlerts = alertResult.value.filter(alert => alert.alertType === AlertType.SECRET.name);
            const codeAlerts = alertResult.value.filter(alert => alert.alertType === AlertType.CODE.name);

            values.count = alertResult.count;
            values.dependencyAlerts = dependencyAlerts.length;
            values.secretAlerts = secretAlerts.length;
            values.codeAlerts = codeAlerts.length;
        }
    }
    catch (err) {
        consoleLog('error in calling the advec api: ' + err);
    }

    return values;
}

async function getAlertsTrendLines(organization, projectName, repoId) {
    consoleLog(`getAlertsTrend for organization [${organization}], project [${projectName}], repo [${repoId}]`);

    try {
        url = `https://advsec.dev.azure.com/${organization}/${projectName}/_apis/AdvancedSecurity/repositories/${repoId}/alerts?top=5000&criteria.onlyDefaultBranchAlerts=true&api-version=7.2-preview.1`;
        consoleLog(`Calling url: [${url}]`);
        const alertResult = await authenticatedGet(url);
        //consoleLog('alertResult: ' + JSON.stringify(alertResult));
        consoleLog('alertResult count: ' + alertResult.count);

        // load the Secret alerts and create a trend line over the last 3 weeks
        const secretAlerts = alertResult.value.filter(alert => alert.alertType === AlertType.SECRET.name);
        const secretAlertsTrend = getAlertsTrendLine(secretAlerts, 'secret');
        console.log('');
        // load the Dependency alerts and create a trend line over the last 3 weeks
        const dependencyAlerts = alertResult.value.filter(alert => alert.alertType === AlertType.DEPENDENCY.name);
        const dependencyAlertsTrend = getAlertsTrendLine(dependencyAlerts, 'dependency');
        console.log('');
        // load the Code alerts and create a trend line over the last 3 weeks
        const codeAlerts = alertResult.value.filter(alert => alert.alertType === AlertType.CODE.name);
        const codeAlertsTrend = getAlertsTrendLine(codeAlerts, 'code');

        return {
                secretAlertsTrend: secretAlertsTrend,
                dependencyAlertsTrend: dependencyAlertsTrend,
                codeAlertsTrend: codeAlertsTrend
        };
    }
    catch (err) {
        consoleLog('error in calling the advec api: ' + err);
        return {
            secretAlertsTrend: [],
            dependencyAlertsTrend: [],
            codeAlertsTrend: []
        }
    }
}

function checkAlertActiveOnDate(alert, dateStr) {
    // check if the alert.firstSeenDate is within the date range
    // and if fixedDate is not set or is after the date range
    const seenClosed = (alert.firstSeenDate.split('T')[0] <= dateStr && (!alert.fixedDate || alert.fixedDate.split('T')[0] > dateStr));
    if (seenClosed) {
        // check the dismissal.requestedOn date as well
        if (alert.dismissal && alert.dismissal.requestedOn) {
            const dismissed = (alert.dismissal.requestedOn.split('T')[0] <= dateStr);
            return !dismissed;
        }
    }

    return seenClosed;
}

function getAlertsTrendLine(alerts, type) {
    consoleLog(`getAlertsTrendLine for type ${type}`);

    const trendLine = [];
    const trendLineSimple = [];
    const today = new Date();
    const threeWeeksAgo = new Date();
    threeWeeksAgo.setDate(today.getDate() - 21);

    for (let d = threeWeeksAgo; d <= today; d.setDate(d.getDate() + 1)) {
        const date = new Date(d);
        const dateStr = date.toISOString().split('T')[0];

        const alertsOnDate = alerts.filter(alert => checkAlertActiveOnDate(alert, dateStr));
        console.log(`On [${dateStr}] there were [${alertsOnDate.length}] active ${type} alerts`);
        trendLine.push({
            date: dateStr,
            count: alertsOnDate.length
        });

        trendLineSimple.push(alertsOnDate.length);
    }

    consoleLog('trendLine: ' + JSON.stringify(trendLineSimple));
    return trendLineSimple;
}

function getDatePoints() {
    const trendDates = [];
    const today = new Date();
    const threeWeeksAgo = new Date();
    threeWeeksAgo.setDate(today.getDate() - 21);

    for (let d = threeWeeksAgo; d <= today; d.setDate(d.getDate() + 1)) {
        const date = new Date(d);
        const dateStr = date.toISOString().split('T')[0];
        trendDates.push(dateStr);
    }

    return trendDates;
}

function consoleLog(message) {
    console.log(message);
}

function logWidgetSettings(widgetSettings, VSS, description) {
    const settings = JSON.parse(widgetSettings.customSettings.data);
    const extensionContext = VSS.getExtensionContext();
    console.log(`Loading the ${description} with settings: ${JSON.stringify(settings)}, for extension version [${extensionContext.version}]`)

    return settings
}

function getWidgetId(VSS) {
    const extensionContext = VSS.getExtensionContext();
    const widgetId = extensionContext.publisherId + "." + extensionContext.extensionId + ".GHAzDoWidget.Configuration";
    return widgetId;
}

async function getSavedDocument(VSS, documentCollection, documentId) {
    const dataService = await VSS.getService(VSS.ServiceIds.ExtensionData);
    try {
        const document = await dataService.getDocument(documentCollection, documentId);

        return document.data;
    }
    catch (err) {
        console.log(`Error loading the document with Id [${documentId}]: ${err}`);
        return null;
    }
}

async function getRepos(VSS, Service, GitWebApi) {

    let data;
    try {
        const documentCollection = "repos";
        const documentId = "repositoryList";
        data = getSavedDocument(VSS, documentCollection, documentId);

        return data;
    }
    catch (err) {
        console.log(`Error loading the available repos from document store: ${err}`);
    }

    consoleLog(`Loading repositories from the API`);
    try {
        const webContext = VSS.getWebContext();
        const project = webContext.project;

        const gitClient = Service.getClient(GitWebApi.GitHttpClient);
        repos = await gitClient.getRepositories(project.name);
        console.log(`Found these repos: ${JSON.stringify(repos)}`);

        return repos;
    }
    catch (err) {
        console.log(`Error loading the available repos: ${err}`);
        return [];
    }
}

async function getAlertSeverityCounts(organization, projectName, repoId, alertType) {

    let severityClasses = [
        { severity: "critical", count: 0 },
        { severity: "high", count: 0 },
        { severity: "medium", count: 0},
        { severity: "low", count: 0}
    ];
    try {
        // todo: filter on alertType
        url = `https://advsec.dev.azure.com/${organization}/${projectName}/_apis/AdvancedSecurity/repositories/${repoId}/alerts?top=5000&criteria.onlyDefaultBranchAlerts=true&criteria.alertType=${alertType.value}&criteria.states=1&api-version=7.2-preview.1`;
        consoleLog(`Calling url: [${url}]`);
        const alertResult = await authenticatedGet(url);
        //consoleLog('alertResult: ' + JSON.stringify(alertResult));
        consoleLog(`total alertResult count: ${alertResult.count} for alertType [${alertType.name}]`);

        // group the alerts based on the severity
        try {
            consoleLog(`severityClasses.length: [${severityClasses.length}]`);

            for (let index in severityClasses) {
                let severityClass = severityClasses[index];
                const severityAlertCount = alertResult.value.filter(alert => alert.severity === severityClass.severity);
                consoleLog(`severityClass [${severityClass.severity}] has [${severityAlertCount.length}] alerts`);
                severityClass.count = severityAlertCount.length;
            };
        }
        catch (err) {
            consoleLog('error in grouping the alerts: ' + err);
        }

        consoleLog('severityClasses summarized: ' + JSON.stringify(severityClasses));
    }
    catch (err) {
        consoleLog('error in calling the advec api: ' + err);
    }
    return severityClasses;
}