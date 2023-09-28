import tl = require('azure-pipelines-task-lib/task');

//async function run() {
    try {
        const inputString: string | undefined = tl.getInput('samplestring', true);
        if (inputString == 'bad') {
            tl.setResult(tl.TaskResult.Failed, 'Bad input was given');
            //return;
            // stop the task execution
        }
        console.log('Hello', inputString);
    }
    catch (err: unknown) {
        if (err instanceof Error) {
            tl.setResult(tl.TaskResult.Failed, err.message);
        } else {
            tl.setResult(tl.TaskResult.Failed, 'An unknown error occurred');
        }
    }
//}


//run();