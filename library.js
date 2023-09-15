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