// global variables
const areaName = "alert" // old: 'AdvancedSecurity', new: 'alert' todo: rename to alerts when CORS issues are fixed
const apiVersion = "7.2-preview.1"

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

var callCounter = 0;
var getProjectCalls = [];
var getAlertCalls = [];
var activeCalls = 0;
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
            callCounter++;

            // Handle 404 error
            if (response.status === 404) {
                console.error(`Resource not found on url [${url}]`);
            }

            // only show the response headers on httpOk
            if (response.status == !200 && response.status == !400 && response.status == !403) {
                console.log(`Headers for [${url}] with status [${response.status}]:`)
                response.headers.forEach((value, name) => console.log(`${name}: ${value}`))
            }

            if (response.status === 200) {
                return response.json()
            }
            else {
                // return null so the caller can handle the result themselves
                return null
            }
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

function fillSelectRepoDropdown(dropDown, repos, showAllRepos = false) {
    // add a top option to select no repo
    dropDown.append(`<option value="0">Select a repository</option>`);
    if (showAllRepos) {
        dropDown.append(`<option value="1">All repos in this project</option>`);
    }
    // sort the repo alphabetically
    repos.sort((a, b) => a.name.localeCompare(b.name));
    repos.forEach(r => {
        dropDown.append(`<option value=${r.id}>${r.name}</option>`);
    });
}

function getSelectedRepoIdFromDropdown(dropDown) {
    return dropDown.val();
}

function getSelectedRepoNameFromDropdown(dropDown) {
    return dropDown.find("option:selected").text();
}

async function getAlerts(organization, projectName, repoId, repos, project, repo) {
    if (repoId) {
        // run normally for a single repo
        return await getAlertsForRepo(organization, projectName, repoId, project, repo)
    }
    else {
        // todo: run for ALL repositories in the current project
        // load all repos in the project
        return {
            organization, project, repo,
            values: {
                count: -1,
                dependencyAlerts: -1,
                secretAlerts: -1,
                codeAlerts: -1
            }
        }
    }
}

let storedAlertData = null
async function getAlertsForRepo(organization, projectName, repoId, project, repo) {
    //consoleLog('getAlerts');
    let values = {
        count: 0,
        dependencyAlerts: 0,
        secretAlerts: 0,
        codeAlerts: 0
    };

    try {
        // first check if GHAzDo is enabled or not
        url = `https://advsec.dev.azure.com/${organization}/${projectName}/_apis/management/repositories/${repoId}/enablement?api-version=${apiVersion}`;
        const featuresEnabledResult = await authenticatedGet(url);

        //authenticatedGet(url).then(featuresEnabledResult => {
            if (!featuresEnabledResult || !featuresEnabledResult.advSecEnabled) {
                consoleLog(`GHAzDo is not enabled for this repo [${repoId}]`);
                return ({organization, project, repo, values});
            }

            // todo: use pagination option, now: get the first 5000 alerts
            console.log(`Getting alerts for repo [${repoId}]`);
            url = `https://advsec.dev.azure.com/${organization}/${projectName}/_apis/${areaName}/repositories/${repoId}/alerts?top=5000&criteria.onlyDefaultBranchAlerts=true&criteria.states=1&api-version=${apiVersion}`;
            //consoleLog(`Calling url: [${url}]`);
            const alertResult = await authenticatedGet(url);
            //authenticatedGet(url).then(alertResult => {
                if (!alertResult || !alertResult.count) {
                    //consoleLog('alertResult is null');
                    return ({organization, project, repo, values});
                }
                else {
                    //consoleLog('alertResult count: ' + alertResult.count);

                    const dependencyAlerts = alertResult.value.filter(alert => alert.alertType === AlertType.DEPENDENCY.name);
                    const secretAlerts = alertResult.value.filter(alert => alert.alertType === AlertType.SECRET.name);
                    const codeAlerts = alertResult.value.filter(alert => alert.alertType === AlertType.CODE.name);

                    values.count = alertResult.count;
                    values.dependencyAlerts = dependencyAlerts.length;
                    values.secretAlerts = secretAlerts.length;
                    values.codeAlerts = codeAlerts.length;

                    // Store alerts with repository information for grouping
                    const repoName = repo && repo.name ? repo.name : null;
                    await storeAlerts(repoId, alertResult, repoName);

                    return ({organization, project, repo, values});
                }
            //});
        //});

    }
    catch (err) {
        consoleLog('error in calling the advec api: ' + err);
    }
    return (organization, project, repo, values);
}

async function storeAlerts(repoId, alertResult, repoName = null) {
    // Tag each alert with repository information
    if (alertResult && alertResult.value) {
        alertResult.value.forEach(alert => {
            alert.repositoryId = repoId;
            if (repoName) {
                alert.repositoryName = repoName;
            }
        });
    }
    
    if (!storedAlertData) {
        storedAlertData = alertResult;
    }
    else {
        storedAlertData.value = storedAlertData.value.concat(alertResult.value);
        storedAlertData.count += alertResult.count;
    }
}

async function getAlertsTrendLines(organization, projectName, repoId, daysToGoBack, summaryBucket, alertType, overviewType = false, showClosed = false) {
    consoleLog(`getAlertsTrend for organization [${organization}], project [${projectName}], repo [${repoId}]`)
    try {
        alertResult = null
        if (repoId === '-1') {
            // load data from previously stored info
            consoleLog('loading data from previously stored info')
            alertResult = storedAlertData
        }
        else {
            // load the alerts for the given repo
            url = `https://advsec.dev.azure.com/${organization}/${projectName}/_apis/${areaName}/repositories/${repoId}/alerts?top=5000&criteria.onlyDefaultBranchAlerts=true&api-version=${apiVersion}`
            consoleLog(`Calling url: [${url}]`)
            alertResult = await authenticatedGet(url)
            //consoleLog('alertResult: ' + JSON.stringify(alertResult))
        }
        if (alertResult) {
            consoleLog('alertResult count: ' + alertResult.count)
        }
        else {
            consoleLog('alertResult is null')
            return {
                secretAlertsTrend: [],
                dependencyAlertsTrend: [],
                codeAlertsTrend: []
            }
        }
        if (overviewType === false) {
            consoleLog('Loading all alerts trend lines')
            // load the Secret alerts and create a trend line over the last 3 weeks
            const secretAlerts = alertResult.value.filter(alert => alert.alertType === AlertType.SECRET.name)
            const secretAlertsTrend = getAlertsTrendLine(secretAlerts, AlertType.SECRET.name, daysToGoBack, summaryBucket)
            consoleLog('')
            // load the Dependency alerts and create a trend line over the last 3 weeks
            const dependencyAlerts = alertResult.value.filter(alert => alert.alertType === AlertType.DEPENDENCY.name)
            const dependencyAlertsTrend = getAlertsTrendLine(dependencyAlerts, AlertType.DEPENDENCY.name, daysToGoBack, summaryBucket)
            consoleLog('')
            // load the Code alerts and create a trend line over the last 3 weeks
            const codeAlerts = alertResult.value.filter(alert => alert.alertType === AlertType.CODE.name)
            const codeAlertsTrend = getAlertsTrendLine(codeAlerts, AlertType.CODE.name, daysToGoBack, summaryBucket)

            return {
                    secretAlertsTrend: secretAlertsTrend,
                    dependencyAlertsTrend: dependencyAlertsTrend,
                    codeAlertsTrend: codeAlertsTrend
            }
        }
        else {
            consoleLog(`Loading alerts trend lines for alert type: [$alertType.name}]`)
            // filter the alerts based on the alertType
            const alerts = alertResult.value.filter(alert => alert.alertType === alertType.name)
            // create a trend line over the last 3 weeks for number of open alerts
            const alertsOpenTrend = getAlertsTrendLine(alerts, alertType.name, daysToGoBack, summaryBucket, 'open')
            const alertsDismissedTrend = getAlertsTrendLine(alerts, alertType.name, daysToGoBack, summaryBucket, 'dismissed')
            const alertFixedTrend = getAlertsTrendLine(alerts, alertType.name, daysToGoBack, summaryBucket, 'fixed')

            return {
                alertsOpenTrend: alertsOpenTrend,
                alertsDismissedTrend: alertsDismissedTrend,
                alertFixedTrend: alertFixedTrend
            }
        }
    }
    catch (err) {
        consoleLog('error in calling the advec api: ' + err)
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

function checkAlertDismissedOnDate(alert, dateStr) {
    // check if the alert.firstSeenDate is within the date range
    // and if fixedDate is not set or is after the date range
    const seenClosed = (alert.firstSeenDate.split('T')[0] <= dateStr && (!alert.fixedDate || alert.fixedDate.split('T')[0] > dateStr));
    if (seenClosed) {
        // check the dismissal.requestedOn date as well
        if (alert.dismissal && alert.dismissal.requestedOn) {
            const dismissed = (alert.dismissal.requestedOn.split('T')[0] <= dateStr);
            return dismissed;
        }
    }

    return false;
}

function checkAlertFixedOnDate(alert, dateStr) {
    // check if the alert.firstSeenDate is within the date range
    // and if fixedDate is not set or is after the date range
    const seenClosed = (alert.firstSeenDate.split('T')[0] <= dateStr && (alert.fixedDate && alert.fixedDate.split('T')[0] < dateStr));
    return seenClosed;
}

function getAlertsTrendLine(alerts, type, daysToGoBack = 21, summaryBucket = 1, filter = 'open') {
    consoleLog(`getAlertsTrendLine for type ${type}`);

    const trendLine = [];
    const trendLineSimple = [];
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - daysToGoBack);

    for (let d = startDate; d <= today; d.setDate(d.getDate() + summaryBucket)) {
        const date = new Date(d);
        const dateStr = date.toISOString().split('T')[0];
        let alertsOnDate = []
        switch (filter) {
            case 'open':
                alertsOnDate = alerts.filter(alert => checkAlertActiveOnDate(alert, dateStr));
                break;
            case 'dismissed':
                alertsOnDate = alerts.filter(alert => checkAlertDismissedOnDate(alert, dateStr));
                break;
            case 'fixed':
                alertsOnDate = alerts.filter(alert => checkAlertFixedOnDate(alert, dateStr));
                break;
            default:
                // get all active alerts on this date
                alertsOnDate = alerts.filter(alert => checkAlertActiveOnDate(alert, dateStr));
                break;
        }
        console.log(`On [${dateStr}] there were [${alertsOnDate.length}] [${filter}] [${type}] alerts`);
        trendLine.push({
            date: dateStr,
            count: alertsOnDate.length
        });

        trendLineSimple.push(alertsOnDate.length);
    }

    consoleLog('trendLine: ' + JSON.stringify(trendLineSimple));
    return trendLineSimple;
}

function getAlertsGroupedByRepo(organization, projectName, daysToGoBack = 21, summaryBucket = 1, alertType = null) {
    consoleLog(`getAlertsGroupedByRepo for alertType: [${alertType ? alertType.name : 'all'}]`);
    
    if (!storedAlertData || !storedAlertData.value) {
        consoleLog('No stored alert data available');
        return {
            repoNames: [],
            datePoints: [],
            series: []
        };
    }

    // Filter alerts by type if specified
    let alerts = storedAlertData.value;
    if (alertType) {
        alerts = alerts.filter(alert => alert.alertType === alertType.name);
    }
    
    // Group alerts by repository
    const repoGroups = {};
    alerts.forEach(alert => {
        const repoId = alert.repositoryId;
        let repoName = alert.repositoryName;
        
        // Fallback for alerts without repository names (shouldn't normally happen)
        if (!repoName) {
            repoName = `Unknown Repository (ID: ${repoId})`;
            consoleLog(`Warning: Alert found without repository name, using fallback for repo ID: ${repoId}`);
        }
        
        if (!repoGroups[repoId]) {
            repoGroups[repoId] = {
                name: repoName,
                alerts: []
            };
        }
        repoGroups[repoId].alerts.push(alert);
    });
    
    // Get repository names sorted alphabetically
    const repoIds = Object.keys(repoGroups);
    const repoNames = repoIds.map(id => repoGroups[id].name).sort();
    
    // Create a mapping from name to id for easy lookup
    const nameToId = {};
    repoIds.forEach(id => {
        nameToId[repoGroups[id].name] = id;
    });
    
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - daysToGoBack);
    
    // Create series data for each repository
    const series = [];
    repoNames.forEach(repoName => {
        const repoId = nameToId[repoName];
        const repoAlerts = repoGroups[repoId].alerts;
        const trendData = [];
        
        // Calculate number of data points
        const totalDays = daysToGoBack + 1;
        const dataPoints = Math.ceil(totalDays / summaryBucket);
        
        for (let i = 0; i < dataPoints; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + (i * summaryBucket));
            if (currentDate > today) break;
            
            const dateStr = currentDate.toISOString().split('T')[0];
            const alertsOnDate = repoAlerts.filter(alert => checkAlertActiveOnDate(alert, dateStr));
            trendData.push(alertsOnDate.length);
        }
        
        series.push({
            name: repoName,
            data: trendData
        });
    });
    
    // Get date points
    const datePoints = getDatePoints(daysToGoBack, summaryBucket);
    
    consoleLog(`Found ${repoNames.length} repositories with alerts`);
    return {
        repoNames: repoNames,
        datePoints: datePoints,
        series: series
    };
}


function getDatePoints(daysToGoBack = 21, summaryBucket = 1) {
    const trendDates = [];
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - daysToGoBack);

    for (let d = startDate; d <= today; d.setDate(d.getDate() + summaryBucket)) {
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

        const client = Service.getClient(CoreRestClient.CoreHttpClient);
        if(!client) {
            consoleLog(`client is null`);
        }

        let projects = await client.getProjects(null, 1000);
        //consoleLog(`Found these projects: ${JSON.stringify(projects)}`);

        // convert the repos to a simple list of names and ids:
        projects = projects.map(project => {
            return {
                name: project.name,
                id: project.id
            }
        });

        // sort the projects based on the name
        projects.sort((a, b) => (a.name > b.name) ? 1 : -1);

        //consoleLog(`Converted projects to: ${JSON.stringify(projects)}`);

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

const batchTimeOut = 1000
const repoBatchSize = 50
async function loadAllAlertsFromAllRepos(VSS, Service, GitWebApi, organization, projects, progressDiv, redrawChartsCallback) {
    consoleLog(`Loading all alerts from all repos for organization [${organization}] for [${projects.length}] projects`)
    // prepare the list of project calls to make
    for (let index in projects) {
        const project = projects[index]
        //$queryinfocontainer.append(`<li id="${project.id}">${project.name}</li>\n`);

        // place the repo definition in the array to process later
        getProjectCalls.push({organization, project})
    }
    progressDiv.projectCount.textContent = `${projects.length}`

    // wait for all the project promises to complete
    console.log(`Waiting for [${getProjectCalls.length}] calls to complete`)
    let position = 0
    let waiting = 0
    let alertBatchSize = repoBatchSize // size of the calls to run at once
    activeCalls = 0 // reset the active calls counter
    let i = 0
    while (i < getProjectCalls.length) {
        if (activeCalls < alertBatchSize) {
            let work = getProjectCalls[i]

            // do the work, don't wait for it to complete to speed things up
            getRepos(VSS, Service, GitWebApi, work.project.name, false).then(repos => {
                activeCalls--
                showRepoInfo(repos, work.project, work.organization, progressDiv, activeCalls)
            }).
            catch(error => {
                console.error(`Error handling get repos for ${work.project.name}: ${error}`)
                activeCalls--
            })

            activeCalls++
            i++
        }
        else {
            showCallStatus();
            // wait for the next batch to complete
            await new Promise(resolve => setTimeout(resolve, batchTimeOut))
        }
    }

    while (activeCalls > 0) {
        // wait for the last batch to complete
        console.log(`Waiting for the last [${activeCalls}] project calls to complete`)
        await new Promise(resolve => setTimeout(resolve, 500))
    }
    console.log(`All project calls completed`)
    showCallStatus()

    // loop over the alertCall array and load the alerts for each repo
    position = 0
    waiting = 0
    alertBatchSize = 50 // size of the calls to run at once
    activeCalls = 0
    i = 0
    const repos = null // required param, but not used
    while (i < getAlertCalls.length) {
        if (activeCalls < alertBatchSize) {
            let work = getAlertCalls[i]
            // do the work
            getAlerts(work.organization, work.project.name, work.repo.id, repos, work.project, work.repo).then(repoAlerts => {
                activeCalls--
                showAlertInfo(work.organization, work.project, work.repo, repoAlerts, progressDiv, activeCalls)
                //todo: store the overall results: results.push(repoAlerts);
            }).
            catch(error => {
                console.error(`Error handling get alerts for ${work.repo.name}: ${error}`)
                activeCalls--
            })

            activeCalls++
            i++
        }
        else
        {
            showCallStatus()
            // wait some time before starting the next batch
            await new Promise(resolve => setTimeout(resolve, 500))
        }
    }

    while (activeCalls > 0) {
        // wait for the last batch to complete
        console.log(`Waiting for the last [${activeCalls}] alert calls to complete`)
        await new Promise(resolve => setTimeout(resolve, 500))
    }

    // now all the alerts have been loaded, so we can show the results
    var header = document.querySelector('.loadingTitle')
    // Add the loading class to the header
    header.classList.remove('loading')

    if (redrawChartsCallback) {
        redrawChartsCallback()
    }
}
async function showRepoInfo(repos, project, organization, progressDiv, activeCalls) {
    const repoCount = repos?.length
    consoleLog(`Found [${repoCount}] repos for project [${project.name}] to load alerts for`);

    if (isNaN(repoCount)) {
        // prevent issues with the count (would result in NaN)
        return
    }

    var currentValue = parseInt(progressDiv.repoCount.textContent);
    progressDiv.repoCount.textContent = currentValue + repoCount

    // load the work to load the alerts for all repos
    for (let repoIndex in repos) {
        const repo = repos[repoIndex];
        // only load the alerts if the repo has a size, otherwise it is still an empty repo
        if (repo.size > 0) {
            // add work definition to array
            getAlertCalls.push({organization, project, repo});
        }
    }
}

function handleNames(input) {
    // replace spaces with %20 in the input
    return input.replace(/ /g, '%20')  // space with %20
                .replace(/&/g, "%26")  // & with %26
}

let debugInfo = null
function showCallStatus() {
    if (!debugInfo) {
        debugInfo = document.querySelector('#debugInfo')
        if (debugInfo) {
            // add start time to the debug info objects data-property
            debugInfo.dataset.startTime = new Date()
        }
    }

    if (debugInfo) {
        // calculate the duration
        const startDateTime = new Date(debugInfo.dataset.startTime)
        const endDateTime = new Date()
        const duration = endDateTime - startDateTime
        let seconds = 0
        if (duration < 60000) {
            seconds = Math.round(duration / 1000)
        }
        else {
            seconds = Math.round((duration % 60000) / 1000)
        }

        let durationSecondsText = ''
        if (seconds < 10) {
            durationSecondsText = `0${seconds}`
        }
        else {
            durationSecondsText = `${seconds}`
        }

        const durationMinutes = Math.round(duration / 60000)
        let durationMinutesText = ''
        if (durationMinutes < 10) {
            durationMinutesText = `0${durationMinutes}`
        }
        else {
            durationMinutesText = `${durationMinutes}`
        }
        const durationText = `${durationMinutesText}:${durationSecondsText}`

        let dataSetInfo = ''
        if (storedAlertData) {
            dataSetInfo = ` | Total alerts: ${storedAlertData.count}`
        }
        debugInfo.textContent = `Call counter: ${callCounter} | Active connections: ${activeCalls} | Duration: ${durationText} ${dataSetInfo}`
    }
}

function showAlertInfo(organization, project, repo, repoAlerts, progressDiv, activeCalls) {
    if (repoAlerts && repoAlerts.values) {
        //consoleLog(`Found [${JSON.stringify(repoAlerts)}] dependency alerts for repo [${repo.name}]`)

        // show the alert counts
        // todo: store the current count and skip the parsing
        var currentValue = parseInt(progressDiv.dependencyAlertCount.textContent)
        progressDiv.dependencyAlertCount.textContent =  currentValue + repoAlerts.values.dependencyAlerts

        var currentValue = parseInt(progressDiv.secretAlertCount.textContent)
        progressDiv.secretAlertCount.textContent = currentValue + repoAlerts.values.secretAlerts

        var currentValue = parseInt(progressDiv.codeAlertCount.textContent)
        progressDiv.codeAlertCount.textContent = currentValue + repoAlerts.values.codeAlerts

        // keep track of global state:
        // endDateTime.text('End: ' + (new Date()).toISOString())
        showCallStatus()
    }
}

async function getRepos(VSS, Service, GitWebApi, projectName, useCache = true) {

    //consoleLog(`inside getRepos`)
    const webContext = VSS.getWebContext()
    const project = webContext.project
    let projectNameForSearch = projectName ? projectName : project.name
    //consoleLog($`Searching for repos in project with name [${projectNameForSearch}]`)

    const documentCollection = `repos`
    const documentId = `repositoryList-${projectNameForSearch}`

    // needed to clean up
    //removeDocument(VSS, documentCollection, documentId)

    if (useCache) {
        try {
            const document = await getSavedDocument(VSS, documentCollection, documentId)
            consoleLog(`document inside getRepos: ${JSON.stringify(document)}`)
            if (document || document?.data?.length > 0) {
                consoleLog(`Loaded repos from document store. Last updated [${document.lastUpdated}]`)
                // get the data type of lastUpdated
                consoleLog(`typeof document.lastUpdated: ${typeof document.lastUpdated}`)
                // if data.lastUpdated is older then 1 hour, then refresh the repos
                const diff = new Date() - new Date(document.lastUpdated)
                const diffHours = Math.floor(diff / 1000 / 60 / 60)
                const cacheDuration = 4
                if (diffHours < cacheDuration) {
                    consoleLog(`Repos are less then ${cacheDuration} hour old, so using the cached version. diffHours [${diffHours}]`)
                    return document.data
                }
                else {
                    consoleLog(`Repos are older then ${cacheDuration} hour, so refreshing the repo list is needed. diffHours [${diffHours}]`)
                }
            }
        }
        catch (err) {
            console.log(`Error loading the available repos from document store: ${err}`)
        }
    }

    //consoleLog(`Loading repositories from the API for project [${projectNameForSearch}]`);
    try {
        const gitClient = Service.getClient(GitWebApi.GitHttpClient)
        let repos = await gitClient.getRepositories(projectNameForSearch)
        callCounter++
        //consoleLog(`Found these repos: ${JSON.stringify(repos)}`);

        // convert the repos to a simple list of names and ids:
        repos = repos.map(repo => {
            return {
                name: repo.name,
                id: repo.id,
                size: repo.size,
            }
        })
        //consoleLog(`Found [${repos.length}] repos`)

        if (useCache) {
            // save the repos to the document store for next time
            try {
                await saveDocument(VSS, documentCollection, documentId, repos)
            }
            catch (err) {
                console.log(`Error saving the available repos to document store: ${JSON.stringify(err)}`)
            }
        }
        return repos
    }
    catch (err) {
        console.log(`Error loading the available repos: ${err}`)
        return null
    }
}

async function getAlertSeverityCounts(organization, projectName, repoId, alertType) {

    let severityClasses = [
        { severity: "critical", count: 0 },
        { severity: "high", count: 0 },
        { severity: "medium", count: 0},
        { severity: "low", count: 0}
    ]

    try {
        let alertResult = { count: 0, value: null}
        if (storedAlertData) {
            alertResult.value = storedAlertData.value.filter(alert => alert.alertType === alertType.name)
        }
        else {
            // todo: filter on alertType
            url = `https://advsec.dev.azure.com/${organization}/${projectName}/_apis/${areaName}/repositories/${repoId}/alerts?top=5000&criteria.onlyDefaultBranchAlerts=true&criteria.alertType=${alertType.value}&criteria.states=1&api-version=${apiVersion}`
            //consoleLog(`Calling url: [${url}]`);
            alertResult = await authenticatedGet(url)
        }

        if (alertResult && alertResult.value.length) {
            //consoleLog('alertResult: ' + JSON.stringify(alertResult));
            consoleLog(`total alertResult count: ${alertResult.value.length} for alertType [${alertType.name}]`)

            // group the alerts based on the severity
            try {
                consoleLog(`severityClasses.length: [${severityClasses.length}]`)

                for (let index in severityClasses) {
                    let severityClass = severityClasses[index];
                    const severityAlertCount = alertResult.value.filter(alert => alert.severity === severityClass.severity)
                    consoleLog(`severityClass [${severityClass.severity}] has [${severityAlertCount.length}] alerts`)
                    severityClass.count = severityAlertCount.length
                }
            }
            catch (err) {
                consoleLog('error in grouping the alerts: ' + err)
            }

            consoleLog('severityClasses summarized: ' + JSON.stringify(severityClasses))
        }
    }
    catch (err) {
        consoleLog('error in calling the advec api: ' + err)
    }
    return severityClasses
}

function dumpObject(obj, showMethods = false) {
    if (showMethods) {
        return JSON.stringify(obj, Object.getOwnPropertyNames(obj), 2)
    }
    return JSON.stringify(obj, null, 2)
}