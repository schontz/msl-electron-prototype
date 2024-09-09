#!/usr/bin/env node

/**
 * This script transpiles `RedundantAudioEncoder.ts` into JavaScript code and generates a file that stores the
 * JavaScript code as a string which can be used to run a redundant audio worker. This script is meant to be run before
 * building the entire project so that the generated file also gets built.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create a temporary tsconfig file to only transpile `RedundantAudioEncoder.ts` and `InsertableStreamWorker.ts`.
const configDir = 'config';
const redTsconfig = 'tsconfig.red.json';
const redTsconfigContent = `{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "outDir": "../build",
    "rootDir": "../src"
  },
  "include": [
    "../src/redundantaudioencoder/RedundantAudioEncoder.ts",
    "../src/insertablestreamworker/InsertableStreamWorker.ts",
  ]
}
`;
fs.writeFileSync(`${configDir}/${redTsconfig}`, redTsconfigContent);

// Run the `prebuild` script to generate `node_modules` since we will be using the `tsc` command from `node_modules`.
function runCommandWithLogs(command) {
  try {
    console.log(`Running command: ${command}`);
    const output = execSync(command).toString();
    console.log(output);
    return output;
  } catch (error) {
    console.log(error.stdout.toString());
    console.error(error.toString());
    process.exit(1);
  }
}
runCommandWithLogs('npm run prebuild');

// Transpile `RedundantAudioEncoder.ts` and `InsertableStreamWorker.ts`.
let tscPath = path.resolve(`${runCommandWithLogs('npm root').replace(/\n/g, "")}/.bin/tsc`);
runCommandWithLogs(`${tscPath} --build config/tsconfig.red.json`);

// Remove the temporary tsconfig file.
fs.unlinkSync(`${configDir}/${redTsconfig}`);

// Generate the file that contains the worker code string.
const RedundantAudioEncoder = require('../build/redundantaudioencoder/RedundantAudioEncoder.js').default;
const redundantAudioEncoderWorkerCode = `${RedundantAudioEncoder.toString()}
RedundantAudioEncoder.shouldLog = true;
RedundantAudioEncoder.shouldReportStats = true;
RedundantAudioEncoder.initializeWorker();
`.replace(/"/g, '\'').replace(/\n/g, "\\n").replace(/\r/g, "\\r");

const redundantAudioEncoderWorkerFileContent = `// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * This file was generated with the \`generate-red-worker-code.js\` script.
 */

/**
 * Redundant audio worker code string.
 */
// eslint-disable-next-line
const RedundantAudioEncoderWorkerCode = "${redundantAudioEncoderWorkerCode}";

export default RedundantAudioEncoderWorkerCode;
`;
const redundantAudioEncoderWorkerDir = './src/redundantaudioencoderworkercode';
if (!fs.existsSync(redundantAudioEncoderWorkerDir )) fs.mkdirSync(redundantAudioEncoderWorkerDir , { recursive: true });
const redundantAudioEncoderWorkerFile = 'RedundantAudioEncoderWorkerCode.ts';
fs.writeFileSync(`${redundantAudioEncoderWorkerDir }/${redundantAudioEncoderWorkerFile}`, redundantAudioEncoderWorkerFileContent);


// Generate the file that contains the insertable stream worker worker code string.
const InsertableStreamWorker = require('../build/insertablestreamworker/InsertableStreamWorker.js').default;
const insertableStreamWorkerWorkerCode = `${InsertableStreamWorker.toString()}
InsertableStreamWorker.initializeWorker();
`.replace(/"/g, '\'').replace(/\n/g, "\\n").replace(/\r/g, "\\r");

const insertableStreamWorkerWorkerFileContent = `// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * This file was generated with the \`generate-red-worker-code.js\` script.
 */

/**
 * Insertable Stream worker worker code string.
 */
// eslint-disable-next-line
const InsertableStreamWorkerWorkerCode = "${insertableStreamWorkerWorkerCode}";

export default InsertableStreamWorkerWorkerCode;
`;
const insertableStreamWorkerWorkerDir = './src/insertablestreamworkerworkercode';
if (!fs.existsSync(insertableStreamWorkerWorkerDir)) fs.mkdirSync(insertableStreamWorkerWorkerDir, { recursive: true });
const insertableStreamWorkerWorkerFile = 'InsertableStreamWorkerWorkerCode.ts';
fs.writeFileSync(`${insertableStreamWorkerWorkerDir}/${insertableStreamWorkerWorkerFile}`, insertableStreamWorkerWorkerFileContent);