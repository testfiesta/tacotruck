#!/usr/bin/env node
'use strict';

const { ArgumentParser } = require('argparse');
const apiController = require('./src/controllers/api.js');
const cliProgress = require('cli-progress');
const configUtils = require('./src/utils/configuration.js');
const fs = require('fs');
const { version } = require('./package.json');
const xUnitController = require('./src/controllers/xUnit.js');

global.packageRoot = __dirname;
 
if (require.main === module) {
  const parser = new ArgumentParser({
    description: 'YATTPipe'
  });

  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
 
  let availableConfigs = fs.readdirSync(`${packageRoot}/configs`)
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
  parser.add_argument('-o', '--overrides', {
    help: 'JSON data to include in target data'
  });
  parser.add_argument('-s', '--source', {
    required: true,
    help: 'For type api - One of: ' + availableConfigs
      + '\nor the path to a custom JSON api config.\n'
      + 'For type junit - the path to a JUnit-style XML file.'
  });
  parser.add_argument('-t', '--target', {
    required: true,
    help: 'One of: ' + availableConfigs
  });
  parser.add_argument('-d', '--data-types', {
    required: false,
    help: 'Data type keys to use from source config'
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
    help: 'Maximum record count to return.'
  });
  parser.add_argument('--no-git', {
    action: 'store_true',
    required: false,
  });
  parser.add_argument('-v', '--verbose', { action: 'store_true' });
  parser.add_argument('--version', { action: 'version', version });

  let args = parser.parse_args();

  pullData(args).then((data) => pushData(args, data));
}

async function pullData(args, ids={}) {
  const config = new configUtils.PipeConfig(args);
  let responseData = [];
  //config.progressBar = progressBar;
  for (const sourceConfig of config.sourceConfigs) {
    switch (sourceConfig.typeConfig.type) { // CTODO - just pass sourceTypeConfig
      case 'api':
        responseData.push(await apiController.pullData(sourceConfig, ids));
        break;
      case 'junit':
        responseData.push(await xUnitController.pullData(sourceConfig, ids));
        break;
      default:
        console.log(`Unable to process source type: ${sourceConfig.type}`);
        process.exit();
    }
  }
  return responseData;
}

function pushData(args, data) {
  const config = new configUtils.PipeConfig(args);
  if (!Array.isArray(data)) {
    data = [data];
  }
  //config.progressBar = progressBar;
  for (const sourceData of data) {
    for (const targetConfig of config.targetConfigs) {
      switch (targetConfig.typeConfig.type) { 
        case 'api':
          apiController.pushData(targetConfig, sourceData);
          break;
        case 'junit':
          xUnitController.pushData(targetConfig, sourceData);
          break;
        default:
          console.log(`Unable to process target type: ${targetConfig.type}`);
          process.exit();
      }
    }
  }
}

module.exports ={
  pullData,
  pushData
};
