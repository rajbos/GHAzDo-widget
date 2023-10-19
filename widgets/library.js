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
        .then(response => {
            // only show the response headers on httpOk
            if (response.status == 200) {
                console.log(`Headers for [${url}]:`)
                response.headers.forEach((value, name) => console.log(`${name}: ${value}`));
            }
            return response.json()
        });
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
        if (!alertResult || !alertResult.count) {
            consoleLog('alertResult is null');
        }
        else {
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
        consoleLog(`Loaded document with Id: [${document.id}] and lastUpdated: [${document.lastUpdated}]`);
        consoleLog(`Document data: ${JSON.stringify(document)}`);
        return document;
    }
    catch (err) {
        console.log(`Error loading the document with Id [${documentId}]: ${JSON.stringify(err)}`);
        return null;
    }
}

async function saveDocument(VSS, documentCollection, documentId, data) {

    try {
        //delete document in case it exists, there is an issue with setDocument it seems
        removeDocument(VSS, documentCollection, documentId);
    }
    catch (err) {
        console.log(`Tried deleting the document with Id [${documentId}]: ${JSON.stringify(err)}`);
    }

    const dataService = await VSS.getService(VSS.ServiceIds.ExtensionData);
    try {
        const document = {
            id: documentId,
            lastUpdated: new Date(),
            data: data,
            __eTag: -1
        }

        const savedDocument = await dataService.setDocument(documentCollection, document);
        consoleLog(`New document was created with Id: [${savedDocument.id}]`);
    }
    catch (err) {
        console.log(`Error saving the document with Id [${documentId}]: ${JSON.stringify(err)}`);
    }
}

async function removeDocument(VSS, documentCollection, documentId, data) {
    const dataService = await VSS.getService(VSS.ServiceIds.ExtensionData);
    try {
        await dataService.deleteDocument(documentCollection, documentId);
        consoleLog(`Document with Id: [${documentId}] was deleted`);
    }
    catch (err) {
        console.log(`Error deleting the document with Id [${documentId}]: ${JSON.stringify(err)}`);
    }
}

// VSS.Require "TFS/Core/RestClient"
async function getProjects(VSS, Service, CoreRestClient) {
    consoleLog(`Loading projects from the API`);
    try {
        const webContext = VSS.getWebContext();
        const project = webContext.project;
        consoleLog(`webContext.project.name: [${project.name}]`);

        const client = Service.getClient(CoreRestClient.CoreHttpClient);
        if(!client) {
            consoleLog(`client is null`);
        }

        let projects = await client.getProjects(null, 1000);
        consoleLog(`Found these projects: ${JSON.stringify(projects)}`);

        // convert the repos to a simple list of names and ids:
        projects = projects.map(project => {
            return {
                name: project.name,
                id: project.id
            }
        });
        consoleLog(`Converted projects to: ${JSON.stringify(projects)}`);

        // save the repos to the document store for next time
        // try {
        //     await saveDocument(VSS, documentCollection, documentId, projects);
        // }
        // catch (err) {
        //     console.log(`Error saving the available repos to document store: ${JSON.stringify(err)}`);
        // }
        return projects;
    }
    catch (err) {
        console.log(`Error loading the available projects: ${err}`);
        return null;
    }
}

async function getRepos(VSS, Service, GitWebApi, projectName) {

    const webContext = VSS.getWebContext();
    const project = webContext.project;
    let projectNameForSearch = projectName ? projectName : project.name;
    consoleLog($`Searching for repos in project with name [${projectNameForSearch}]`);

    const documentCollection = `repos`;
    const documentId = `repositoryList-${projectNameForSearch}`;

    // needed to clean up
    //removeDocument(VSS, documentCollection, documentId);

    try {
        const document = await getSavedDocument(VSS, documentCollection, documentId);
        consoleLog(`document inside getRepos: ${JSON.stringify(document)}`);
        if (document || document.data.length > 0) {
            consoleLog(`Loaded repos from document store. Last updated [${document.lastUpdated}]`);
            // get the data type of lastUpdated
            consoleLog(`typeof document.lastUpdated: ${typeof document.lastUpdated}`)
            // if data.lastUpdated is older then 1 hour, then refresh the repos
            const diff = new Date() - new Date(document.lastUpdated);
            const diffHours = Math.floor(diff / 1000 / 60 / 60);
            if (diffHours < 4) {
                consoleLog(`Repos are less then 1 hour old, so using the cached version. diffHours [${diffHours}]`);
                return document.data;
            }
            else {
                consoleLog(`Repos are older then 1 hour, so refreshing the repo list is needed. diffHours [${diffHours}]`);
            }
        }
    }
    catch (err) {
        console.log(`Error loading the available repos from document store: ${err}`);
    }

    consoleLog(`Loading repositories from the API`);
    try {
        const gitClient = Service.getClient(GitWebApi.GitHttpClient);
        let repos = await gitClient.getRepositories(projectNameForSearch);
        consoleLog(`Found these repos: ${JSON.stringify(repos)}`);

        // convert the repos to a simple list of names and ids:
        repos = repos.map(repo => {
            return {
                name: repo.name,
                id: repo.id
            }
        });
        consoleLog(`Converted repos to: ${JSON.stringify(repos)}`);

        // save the repos to the document store for next time
        try {
            await saveDocument(VSS, documentCollection, documentId, repos);
        }
        catch (err) {
            console.log(`Error saving the available repos to document store: ${JSON.stringify(err)}`);
        }
        return repos;
    }
    catch (err) {
        console.log(`Error loading the available repos: ${err}`);
        return null;
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

function dumpObject(obj) {
    return JSON.stringify(obj, null, 2)
}