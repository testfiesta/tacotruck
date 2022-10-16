#!/usr/bin/env node
'use strict';

const { ArgumentParser } = require('argparse');
const apiController = require('./src/controllers/api.js');
const cliProgress = require('cli-progress');
const configUtils = require('./src/utils/configuration.js');
const fs = require('fs');
const { version } = require('./package.json');
const xUnitController = require('./src/controllers/xUnit.js');

global.root = __dirname;

const credentialsFileName = 'creds.json';
 
const parser = new ArgumentParser({
  description: 'YATTPipe'
});

const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

let args;
let config;

let availableConfigs = fs.readdirSync('api_configs')
  .filter(file => !(/(^|\/)\.[^\/\.]/g).test(file))
  .map(file => {
    return file.split('.')[0];
  }).join(', ');

async function configCredentials(data) {
  return fs.writeFileSync(`${root}/${credentialsFileName}`, JSON.stringify(data));
}

async function pullThenPushData() {
  config.progressBar = progressBar;
  const data = await pullData(config);
  return pushData(config, data)
}

async function push(
  credentials,
  source = 'testrail',
  source_type = 'api',
  target = 'yatt',
  target_type = undefined,
  verbose = false,
  incremental = false,
  ignore = undefined,
  overwrite = undefined
) {
  if (!credentials) {
    throw('You must provide credentials includes source and target');
  }

  if (source !== 'testrail') {
    throw(`${source} source is not supported! Currently, only testrail source is supported`);
  }

  if (!source_type) {
    throw('You must provide source type is: api or junit');
  }

  if (target !== 'yatt') {
    throw('Currently, package is only support target yatt');
  }

  try {
    await configCredentials(credentials);

    if (!fs.existsSync(`${root}/${credentialsFileName}`)) {
      throw('Not found credentials config');
    }

    args = {
      credentials: credentialsFileName,
      incremental,
      ignore,
      overwrite,
      source,
      source_type,
      target,
      target_type,
      verbose
    };

    config = new configUtils.PipeConfig(args, false);

    await pullThenPushData();

    return { success: true };
  } catch (err) {
    return new Error(err.message);
  }
}

if (require.main === module) {
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
  
  args = parser.parse_args();
  
  config = new configUtils.PipeConfig(args);

  config.progressBar = progressBar;
  pullData(config).then((data) => pushData(config, data));
}

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

module.exports = {
  push,
};