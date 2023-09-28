"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tl = require("azure-pipelines-task-lib/task");
//async function run() {
try {
    const inputString = tl.getInput('samplestring', true);
    if (inputString == 'bad') {
        tl.setResult(tl.TaskResult.Failed, 'Bad input was given');
        //return;
        // stop the task execution
    }
    console.log('Hello', inputString);
}
catch (err) {
    if (err instanceof Error) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
    else {
        tl.setResult(tl.TaskResult.Failed, 'An unknown error occurred');
    }
}
//}
//run();
