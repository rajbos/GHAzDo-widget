import * as tl from "azure-pipelines-task-lib/task";
import { getHandlerFromToken, WebApi } from "azure-devops-node-api";

function getSystemAccessToken() : string {
    tl.debug('Getting credentials for local feeds');
    const auth = tl.getEndpointAuthorization('SYSTEMVSSCONNECTION', false);
    if (auth.scheme === 'OAuth') {
        tl.debug('Got an OAuth authentication token');
        return auth.parameters['AccessToken'];
    }
    else {
        tl.warning('Could not determine credentials to use');
    }
}

interface IValue {
    alertId: number;
    title: string;
}
interface IResult {
    count: number;
    value: IValue[];
}

interface IResponse {
    result: IResult;
}

async function getAlerts(connection: WebApi, orgSlug: string, project: string, repository: string, branchName: string) {
    const branchUrl = `https://advsec.dev.azure.com/${orgSlug}/${project}/_apis/AdvancedSecurity/repositories/${repository}/alerts?criteria.alertType=1&criteria.ref=${branchName}&criteria.onlyDefaultBranchAlerts=true&useDatabaseProvider=true`;
    let branchResponse: IResponse

    try {
        branchResponse = await connection.rest.get<IResult>(branchUrl);
    }
    catch (err: unknown) {
        if (err instanceof Error) {
            if (err.message.includes('Branch does not exist')) {
                console.log(`Branch [${branchName}] does not exist in GHAzDo yet. Make sure to run the Dependency Scan task first on this branch (easiest to do in the same pipeline).`);
            }
            else {
                console.log(`An error occurred: ${err.message}`);
            }
        }
    }
    return branchResponse
}

async function run() {
    try {
        // test to see if this build was triggered with a PR context
        const buildReason = tl.getVariable('Build.Reason');
        if (buildReason != 'PullRequest') {
            tl.setResult(tl.TaskResult.Skipped, `This extension only works when triggered by a Pull Request and not by a [${buildReason}]`);
            return
        }

        // todo: convert to some actual setting
        const inputString: string | undefined = tl.getInput('samplestring', true);
        if (inputString == 'bad') {
            tl.setResult(tl.TaskResult.Failed, 'Bad input was given');

            // stop the task execution
            return;
        }
        console.log('Hello', inputString);

        const token = getSystemAccessToken();
        const authHandler = getHandlerFromToken(token);
        const uri = tl.getVariable("System.CollectionUri");
        const connection = new WebApi(uri, authHandler);

        const organization = tl.getVariable('System.TeamFoundationCollectionUri');
        const orgSlug = organization.split('/')[3];
        const project = tl.getVariable('System.TeamProject');
        const repository = tl.getVariable('Build.Repository.ID');
        const sourceBranch = tl.getVariable('System.PullRequest.SourceBranch');
        const sourceBranchName = sourceBranch?.split('/')[2];
        const targetBranchName = tl.getVariable('System.PullRequest.targetBranchName');

        console.log(`Retrieving alerts with token: [${token}], organization: [${organization}], orgSlug: [${orgSlug}], project: [${project}], sourceBranchName: [${sourceBranchName}], targetBranchName: [${targetBranchName}]`);

        const sourceBranchResponse = await getAlerts(connection, orgSlug, project, repository, sourceBranchName);
        const targetBranchResponse = await getAlerts(connection, orgSlug, project, repository, targetBranchName);

        tl.debug(`source response: ${JSON.stringify(sourceBranchResponse)}`);
        tl.debug(`target response: ${JSON.stringify(targetBranchResponse)}`);

        if (sourceBranchResponse.result.count == 0) {
            console.log('No alerts found for this branch');

            tl.setResult(tl.TaskResult.Succeeded, `Found no alerts for the source branch`);
            return;
        }
        else {
            // check by result.alertId if there is a new alert or not (so alert not in targetBranch)

            // first get the only the alertid's from the source branch
            const sourceAlertIds = sourceBranchResponse.result.value.map((alert) => {return alert.alertId;});
            // do the same for the target branch
            const targetAlertIds = targetBranchResponse.result.value.map((alert) => {return alert.alertId;});
            // now find the delta
            const newAlertIds = sourceAlertIds.filter((alertId) => {
                return !targetAlertIds.includes(alertId);
            });

            if (newAlertIds.length > 0) {

                console.log(`Found [${sourceBranchResponse.result.count}] alerts for the source branch [${sourceBranchName}] of which [${newAlertIds.length}] are new:`);
                for (const alertId of newAlertIds) {
                    // get the alert details:
                    const alertUrl = `https://dev.azure.com/${orgSlug}/${project}/_git/${repository}/alerts/${alertId}?branch=refs/heads/${sourceBranchName}`;
                    const alertTitle = sourceBranchResponse.result.value.find((alert) => {return alert.alertId == alertId;})?.title;
                    // and show them:
                    console.log(`- ${alertId}: ${alertTitle}, url: ${alertUrl}`);
                }

                tl.setResult(tl.TaskResult.Failed, `Found [${sourceBranchResponse.result.count}] alerts for the source branch [${sourceBranchName}] of which [${newAlertIds.length}] are new`);
            }
            else {
                console.log(`Found no new alerts for the source branch [${sourceBranchName}]`);
                tl.setResult(tl.TaskResult.Succeeded, `Found no new alerts for the source branch [${sourceBranchName}], only [${targetBranchResponse.result.count}] existing ones`);
            }
        }
    }
    catch (err: unknown) {
        if (err instanceof Error) {
            tl.setResult(tl.TaskResult.Failed, err.message);
        } else {
            tl.setResult(tl.TaskResult.Failed, 'An unknown error occurred');
        }
    }
}

run();