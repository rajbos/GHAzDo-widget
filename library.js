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

async function getAlerts(organization, projectName, repoId) {
    consoleLog('getAlerts');

    try{
        // no pagination option, so just get the first 5000 alerts
        url = `https://advsec.dev.azure.com/${organization}/${projectName}/_apis/AdvancedSecurity/repositories/${repoId}/alerts?top=5000&criteria.onlyDefaultBranchAlerts=truen&criteria.states=1&api-version=7.2-preview.1`;
        consoleLog(`Calling url: [${url}]`);
        const alertResult = await authenticatedGet(url);
        //consoleLog('alertResult: ' + JSON.stringify(alertResult));
        consoleLog('alertResult count: ' + alertResult.count);

        const dependencyAlerts = alertResult.value.filter(alert => alert.alertType === "dependency");
        const secretAlerts = alertResult.value.filter(alert => alert.alertType === "secret");
        const codeAlerts = alertResult.value.filter(alert => alert.alertType === "code");
        return {
            count: alertResult.count,
            dependencyAlerts: dependencyAlerts.length,
            secretAlerts: secretAlerts.length,
            codeAlerts: codeAlerts.length
        };
    }
    catch (err) {
        consoleLog('error in calling the advec api: ' + err);
    }
}

async function getAlertsTrendLines(organization, projectName, repoId) {
    consoleLog(`getAlertsTrend for organization [${organization}], project [${projectName}], repo [${repoId}]`);

    try {
        url = `https://advsec.dev.azure.com/${organization}/${projectName}/_apis/AdvancedSecurity/repositories/${repoId}/alerts?top=5000&criteria.onlyDefaultBranchAlerts=truen&api-version=7.2-preview.1`;
        consoleLog(`Calling url: [${url}]`);
        const alertResult = await authenticatedGet(url);
        //consoleLog('alertResult: ' + JSON.stringify(alertResult));
        consoleLog('alertResult count: ' + alertResult.count);

        // load the Secret alerts and create a trend line over the last 3 weeks
        const secretAlerts = alertResult.value.filter(alert => alert.alertType === "secret");
        const secretAlertsTrend = getAlertsTrendLine(secretAlerts, 'secret');
        console.log('');
        // load the Dependency alerts and create a trend line over the last 3 weeks
        const dependencyAlerts = alertResult.value.filter(alert => alert.alertType === "dependency");
        const dependencyAlertsTrend = getAlertsTrendLine(dependencyAlerts, 'dependency');console.log('');
        console.log('');
        // load the Code alerts and create a trend line over the last 3 weeks
        const codeAlerts = alertResult.value.filter(alert => alert.alertType === "code");
        const codeAlertsTrend = getAlertsTrendLine(codeAlerts, 'code');

        return {
                secretAlertsTrend: secretAlertsTrend,
                dependencyAlertsTrend: dependencyAlertsTrend,
                codeAlertsTrend: codeAlertsTrend
        };
    }
    catch (err) {
        consoleLog('error in calling the advec api: ' + err);
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

async function getRepos(VSS, Service, GitWebApi) {
    try {
        const webContext = VSS.getWebContext();
        const project = webContext.project;

        // todo: load the available repos in this project
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