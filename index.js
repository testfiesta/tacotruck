#!/usr/bin/env node
'use strict';

const { ArgumentParser } = require('argparse');
const apiController = require('./src/controllers/api.js');
const cliProgress = require('cli-progress');
const configUtils = require('./src/utils/configuration.js');
const fs = require('fs');
const { version } = require('./package.json');
const xUnitController = require('./src/controllers/xUnit.js');
 
const parser = new ArgumentParser({
  description: 'YATTPipe'
});

const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
 
let availableConfigs = fs.readdirSync('api_configs')
  .filter(file => !(/(^|\/)\.[^\/\.]/g).test(file))
  .map(file => {
    return file.split('.')[0];
  }).join(', ');

parser.add_argument('-c', '--credentials', {
  required: false,
  help: 'Path to credentials file for API connections. (See README.)'
});
parser.add_argument('-i', '--incremental', {
   action: 'store_true',
   help: 'Only pull incremental data based on the last ID uploaded to target'
});
parser.add_argument('-I', '--ignore', {
   required: false,
   help: 'Path to a config file specifying source records to ignore.'
});
parser.add_argument('-o', '--overwrite', {
   help: 'JSON including configs to include or overwrite'
});
parser.add_argument('-s', '--source', {
  required: true,
  help: 'For type api - One of: ' + availableConfigs
    + '\nor the path to a custom JSON api config.\n'
    + 'For type junit - the path to a JUnit-style XML file.'
});
parser.add_argument('-T', '--source-type', {
  required: true,
  help: 'One of: '+ configUtils.validSourceTypes.join(', ')
});
parser.add_argument('-t', '--target', {
  required: false,
  help: 'One of: ' + availableConfigs
});
parser.add_argument('-Y', '--target-type', {
  required: false,
  help: 'One of: '+ configUtils.validTargetTypes.join(', ') + '\nIf not provided, it will try to determine based on the `target` argument.'
});
parser.add_argument('-v', '--verbose', { action: 'store_true' });
parser.add_argument('--version', { action: 'version', version });

let args = parser.parse_args();

const config = new configUtils.PipeConfig(args);
config.progressBar = progressBar;
pullData(config).then((data) => pushData(config, data));

async function pullData(conf) {
  switch (conf.sourceType) {
    case 'api':
    return apiController.pullData(conf);
    break;
  case 'junit':
    return xUnitController.pullData(conf);
    break;
  default:
    console.log('Unable to process source type: ' + conf.sourceType);
    process.exit();
  }
}

function pushData(conf, data) {
  switch (conf.targetType) { 
    case 'api':
    apiController.pushData(conf, data);
    break;
  case 'junit':
    xUnitController.pushData(conf, data);
    break;
  default:
    console.log('Unable to process target type: ' + conf.targetType);
    process.exit();
  }
}
