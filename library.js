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

async function getAlerts (organization, projectName, repoId) {
    consoleLog('getAlerts');

    try{
        // todo: add pagination
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


async function getAlertsTrend (organization, projectName, repoId) {
    consoleLog(`getAlertsTrend for organization [${organization}], project [${projectName}], repo [${repoId}]`);

    try{
        // todo: add pagination
        url = `https://advsec.dev.azure.com/${organization}/${projectName}/_apis/AdvancedSecurity/repositories/${repoId}/alerts?top=5000&criteria.onlyDefaultBranchAlerts=truen&api-version=7.2-preview.1`;
        consoleLog(`Calling url: [${url}]`);
        const alertResult = await authenticatedGet(url);
        //consoleLog('alertResult: ' + JSON.stringify(alertResult));
        consoleLog('alertResult count: ' + alertResult.count);

        // load the secret alerts and create a trend line over the last 3 weeks
        const secretAlerts = alertResult.value.filter(alert => alert.alertType === "secret");
        const secretAlertsTrend = getAlertsTrendLine(secretAlerts);

        return secretAlertsTrend;
    }
    catch (err) {
        consoleLog('error in calling the advec api: ' + err);
    }
}

function getAlertsTrendLine(alerts) {
    consoleLog('getAlertsTrendLine');

    const trendLine = [];
    const trendLineSimple = [];
    const today = new Date();
    const threeWeeksAgo = new Date();
    threeWeeksAgo.setDate(today.getDate() - 21);

    for (let d = threeWeeksAgo; d <= today; d.setDate(d.getDate() + 1)) {
        const date = new Date(d);
        const dateStr = date.toISOString().split('T')[0];
        const alertsOnDate = alerts.filter(alert => alert.createdDate.split('T')[0] === dateStr);
        trendLine.push({
            date: dateStr,
            count: alertsOnDate.length
        });

        trendLineSimple.push(alertsOnDate.length);
    }

    consoleLog('trendLine: ' + JSON.stringify(trendLine));
    return trendLine;

}