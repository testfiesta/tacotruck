#!/usr/bin/env node
'use strict';

const { ArgumentParser } = require('argparse');
const auth = require('auth.js')
const cliProgress = require('cli-progress');
const http = require('http');
const fs = require('fs');
const { version } = require('./package.json');
 
const parser = new ArgumentParser({
  description: 'YATTPipe'
});

const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
 
let availableConfigs = fs.readdirSync('configs')
  .filter(file => !(/(^|\/)\.[^\/\.]/g).test(file))
  .map(file => {
    return file.split('.')[0];
  }).join(', ');

parser.add_argument('-c', '--credentials', {
  required: true,
  help: 'Path to credentials file for API connections. (See README.)'
});
parser.add_argument('-i', '--incremental', {
   action: 'store_true',
   help: 'Only pull incremental data based on the last ID uploaded to target'
});
parser.add_argument('-o', '--overwrite', {
   help: 'JSON including configs to include or overwrite'
});
parser.add_argument('-s', '--source', {
  required: true,
  help: 'One of: ' + availableConfigs
});
parser.add_argument('-v', '--verbose', { action: 'store_true' });
parser.add_argument('--version', { action: 'version', version });


let args = parser.parse_args();

let sourceApi, creds, authPayload, sourceEndpointOrder, sourceOffsets;
let progressIncrement;
var requestsQueue = [];
var generatingQueueData = false;
var throttleCounter = [];
var throttlePerSecondCap = 2;

// Parse credentials file and ensure it matches expected data based on type
// provided in the config
try {
  sourceApi = fs.readaddirSync('configs/' + args.source + '.json');
} catch (err) {
  console.error('Invalid source: ' + args.source +
    '\n Source must be one of the following: ' + availableConfigs);
  process.exit();
}

try {
  creds = fs.readdirSync(args.credentials);

  try {
    authPayload = auth.authSchemas[sourceApi.auth.type].payload;
  } catch {
    console.error('Invalid auth configuration.  Payload not found.');
    process.exit();
  }

  for (const key of auth.authSchemas[sourceApi.auth.type].inputs) {
    if (!creds[key]) {
      console.error('Invalid credentials.' +
        '\n Missing input: ' + key);
      process.exit();
    } else {
      let keyIndex = authPayload.indexOf(key);
      if (keyIndex < 0) {
        console.error('Key [' + key + '] not found in payload.');
        process.exit();
        
      }
      // Do our substitutions to build the payload.
      authPayload = authPayload.substring(0, keyIndex) +
        creds[key] +
        authPayload.substring(keyIndex+key.length, authPayload.length);
    }
  } 

} catch (err) {
  console.error('Invalid credentials file: ' + args.credentials);
  process.exit();
}

if (sourceApi["requests_per_second"]) {
  if (isNaN(sourceApi["requests_per_second"])) {
    console.error('Invalid configuration "requests_per_second" on source API.")
  } else {
    throttlePerSecondCap = sourceApi["requests_per_second"];
  }
}

// Parse source config and build dependency graph to determine access order
sourceEndpointOrder = [];
for (const name in sourceApi.source) {
  sourceEndpointOrder.push(...buildDependencyChain(sourceApi.source, name);
}

sourceEndpointSet = new Set();
sourceEndpointOrder.forEach(endpoint => sourceEndpointSet.add(endpoint));
progressIncrement = 100/sourceEndpointSet.length;

// If incremental, get last offsets from target config
for (const endpoint of sourceEndpointSet) {
  if (args.incremental) {
    // CTODO
  } else {
    sourceOffsets[endpoint] = 0;
  }
}

progressBar.start(200, 0);
// Start our async queue processor
// Pull data
let data = {};
let generatedPaths = {};
for (const endpoint of sourceEndpointSet) {
  generatingQueueData = true;
  processNetworkQueue(endpoint);
  let rawPath = sourceApi.source[endpoint].path;
  let referenceRecordIds = []; //Array of maps eg.[{project_id: 1, suite_id: 1}]
    let options = {
      host: creds.host,
      port: '443'
    };

  // Add authn to the request
  if (auth.authSchemas[sourceApi.auth.type].location === "header") {
    options.headers = {
      auth.authSchemas[sourceApi.auth.type].key:
        auth.authSchemas[sourceApi.auth.type].payload
    };
  }

  if (rawPath.indexOf('{') < 0) {
    options.path = sourceApi.base_path + rawPath;
    requestsQueue.push(options);
  } else {
    let keys = findSubstitutionKeys(rawPath);

    // Loop through the replacement keys (in {}) on this endpoint
    for (const key of keys) {
      // Pull the entity type of the key
      let refEndpoint = key.split('.')[0];

      // Loop through our current data to find ids to substitute into the path
      for (const record of data[refEndpoint]) {

        // Check for odd case around denormalized APIs like TR's "test cases"
        if (!refEndpoint in sourceApi.denormalized_keys[endpoint]) {
          // Build path and push

          // Pull identifier
          options.path = sourceApi.base_path +
            bracketSubstitution(
              rawPath,
              key,
              record[sourceApi.source[refEndpoint].identifier]
            );

          for (const denormKey in sourceApi.denormalized_keys[endpoint]) {
            if ( denormKey[refEndpoint] ) {
              options.path = bracketSubstitution(
                  options.path, 
                  key, 
                  denormKey[refEndpoint]
                );
            }
          }
          requestsQueue.push(options);
        }
      } // else continue
    }

  }

  generatingQueueData = false;
  // Wait for all calls to this endpoint to finish before proceding
  while (requestsQueue.length > 0) {
    await delay((1000/throttlePerSecondCap)*requestsQueue.length);
  }
  progressBar.update(progressIncrement);
}


// TODO Parse target config and transform data based on keys

// TODO Push data

progressBar.update(200);
progressBar.stop();

console.log('Data successfully piped!');

// Loop to make API calls
async function processNetworkQueue(endpoint) {
  if (requestsQueue > 0) {
    // Discard timestamps > 1 second ago
    for (const t of throttleCounter) {
      if (t < Date.now()-1000) {
        throttleCounter.shift();
      } else {
        break;
      }
    }

    // If we're over our throttle, wait.
    if (throttleCounter.length > throttlePerSecondCap) {
      setTimeout(processNetworkQueue(endpoint), 1000/throttlePerSecondCap);
      return;
    } else {
      // Make request
      throttleCounter.push(Date.now());
      let options = requestsQueue.shift();
      const request = https.request(options, response => {
        if (response.statusCode < 200 || response.statusCode > 299) {
          console.error('The API responded with something other than 200.\n' +
            'Status code: ' + response.statusCode);
          process.exit();
        }

        response.on('data', body => {
          // Parse and save our data
          let bodyData = JSON.parse(body);
          let key = ( sourceApi.data_key === "{endpoint}" :
            endpoint ? sourceApi.data_key );
          data.endpoint.push( (key ? bodyData.key : bodyData) );

          // Handle paging
          if (sourceApi.paging.location === "response") {
            options.path = bodyData.paging.link_key;
            requestQueue.push(options);
          }
        });
      }.bind( {endpoint: endpoint, options: options} ));
      request.end();
    }
  } else if (generatingQueue) {
    // Wait for more data
    setTimeout(processNetworkQueue(endpoint), 1000/throttlePerSecondCap);
    return;
  }
}


// Find all dependencies in chain
function buildDependencyChain(keyMap, name) {
  if (!keyMap[name] || !keyMap[name].path) {
    console.error('Invalid key [' + name + '].');
    process.exit();
  }
  if (keyMap[name].path.indexOf('{') < 0 ) {
    return [name];
  } else {
    let keys = findSubstitutionKeys(keyMap[name].path);
    dependencyMap = [];
    for (const dependency of keys) {
      dependencyMap.push(
        ...buildDependencyChain(keyMap, dependency.split['.'][0])
      );
    }
    dependencyMap.push(name);
    return dependencyMap;
  }
}
 

function findSubstitutionKeys(keyString) {
  let keys = [];
  // Find keys on the path in brackets
  let fragment = keyString;
  let startIndex = fragment.indexOf('{');
  while (startIndex > -1) {
    let endIndex = fragment.indexOf('}');
    if (endIndex < 0 ) {
      console.error('Unmatched brackets in source API path: ' + name);
      process.exit();
    }
    keys.push(fragment.substring(startIndex+1, endIndex));
    fragment = fragment.substring(endIndex+1, fragment.length);
    startIndex = fragment.indexOf('{');
  }
  return keys;
}


function bracketSubstitution(baseString, oldKey, newKey) {
  return baseString.substring(0, baseString.indexOf('{' + oldKey)) +
    newKey +
    baseString.substring(
      baseString.indexOf('{' + oldKey) + oldKey.length + 2,
      baseString.length
    );
}
