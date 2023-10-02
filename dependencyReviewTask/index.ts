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

async function run() {
    try {
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
        const sourceBranchName = tl.getVariable('Build.SourceBranchName');
        const targetBranchName = tl.getVariable('Build.TargetBranchName');
        const url = `https://advsec.dev.azure.com/${orgSlug}/${project}/_apis/AdvancedSecurity/repositories/${repository}/alerts?criteria.alertType=1&criteria.ref=${sourceBranchName}&criteria.onlyDefaultBranchAlerts=true&useDatabaseProvider=true`;

        console.log(`Retrieving alerts with token: [${token}], organization: [${organization}], orgSlug: [${orgSlug}], project: [${project}], sourceBranchName: [${sourceBranchName}], targetBranchName: [${targetBranchName}]`);
        console.log('url:', url);

        try {
            interface IResult {
                count: number;
            }

            interface IResponse {
                result: IResult;
            }

            const response: IResponse = await connection.rest.get<IResult>(url);
            console.log('response: ', JSON.stringify(response));

            if (response.result.count == 0) {
                console.log('No alerts found for this branch');

                tl.setResult(tl.TaskResult.Succeeded, `Found no alerts for the source branch`);
                return;
            }
            else {
                // todo: support configuration for checking with the target branch for a delta
                console.log(`Found [${response.result.count}] alerts for the source branch [${sourceBranchName}]`);
                tl.setResult(tl.TaskResult.Failed, `Found [${response.result.count}] alerts for the source branch [${sourceBranchName}]`);
            }
        }
        catch (err: unknown) {
            if (err instanceof Error) {
                if (err.message.includes('Branch does not exist')) {
                    console.log(`Branch [${sourceBranchName}] does not exist in GHAzDo yet. Make sure to run the Dependency Scan task first on this branch (easies to do in the same pipeline).`);
                }
                else {
                    tl.setResult(tl.TaskResult.Failed, JSON.stringify(err.message));
                }
            } else {
                tl.setResult(tl.TaskResult.Failed, 'An unknown error occurred:' + JSON.stringify(err));
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