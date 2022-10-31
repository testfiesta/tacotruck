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
parser.add_argument('-d', '--data-types', {
  required: true,
  help: 'One or more of: ' + configUtils.validDataTypes.join(', ') + '. As a comma-delimited list'
});
parser.add_argument('-p', '--pipe', {
  action: 'store_true'
  required: false,
  help: 'A complete pipe - pull data from source and push to target.'
});
parser.add_argument('--offset', {
  required: false,
  help: 'Paging offset value.'
});
parser.add_argument('--limit', {
  required: false,
  help: 'Paging limit value.'
});
parser.add_argument('--count', {
  required: false,
  help: 'Maximum record count to return..'
});
parser.add_argument('-v', '--verbose', { action: 'store_true' });
parser.add_argument('--version', { action: 'version', version });

let args = parser.parse_args();

if (args.pipe) {
  pullData(args).then((data) => pushData(args, data));
}

async function pullData(args, ids={}) {
  const config = new configUtils.PipeConfig(args);
  //config.progressBar = progressBar;
  switch (config.sourceType) {
    case 'api':
      return apiController.pullData(config, ids);
      break;
    case 'junit':
      return xUnitController.pullData(config, ids);
      break;
    default:
      console.log('Unable to process source type: ' + config.sourceType);
      process.exit();
  }
}

function pushData(args, data) {
  const config = new configUtils.PipeConfig(args);
  //config.progressBar = progressBar;
  switch (config.targetType) { 
    case 'api':
      apiController.pushData(config, data);
      break;
    case 'junit':
      xUnitController.pushData(config, data);
      break;
    default:
      console.log('Unable to process target type: ' + config.targetType);
      process.exit();
  }
}

module.exports ={
  pullData,
  pushData
};
