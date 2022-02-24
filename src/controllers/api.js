const axios = require('axios');
const configUtils = require('../utils/configuration.js');
const models = require('../models/core.js');

let sourceRequestsQueue = [];
let sourceThrottleCounter = [];

async function pullData(config) {
  //config.progressBar.start(200, 0);

  // Pull data
  let data = {};
  for (const endpoint of config.sourceEndpointSet) {
    //console.log('Building options...');
    let rawPath = config.sourceTypeConfig.source[endpoint].path;
    let options = {};

    // Add authn to the request
    if (config.sourceAuthSchema.location === "header") {
      options.headers = {};
      let keys =
        configUtils.findSubstitutionKeys(config.sourceAuthSchema.payload);
      // Loop through the replacement keys (in {}) on this endpoint
      for (const key of keys) {
        // Pull identifier
        options.headers[config.sourceAuthSchema.key] =
          config.sourceAuthPayload;
      }
    }

    if (rawPath.indexOf('{') < 0) {
      let url = config.sourceBaseUrl
        + config.sourceTypeConfig.base_path
        + rawPath;
      //console.log('Pushing request to queue: ' + options);
      sourceRequestsQueue.push(processNetworkGetRequest(config, url, options, endpoint));
    } else {
      let keys = configUtils.findSubstitutionKeys(rawPath);

      // Loop through the replacement keys (in {}) on this endpoint
      for (const key of keys) {

        // Pull the entity type of the key
        let refEndpoint = key.split('.')[0];
        if (data[refEndpoint]) {

          // Loop through our source data to find ids for child paths
          for (const record of data[refEndpoint]) {

            // For odd case around denormalized APIs like TR's "test cases"
            if (config.sourceTypeConfig.denormalized_keys[endpoint] &&
                !(refEndpoint in
                  config.sourceTypeConfig.denormalized_keys[endpoint])) {
              // Build path and push

              // Pull identifier
              let url = config.sourceBaseUrl
                + config.sourceTypeConfig.base_path
                + bracketSubstitution(
                  rawPath,
                  key,
                  record[config.sourceTypeConfig.source[refEndpoint].identifier]
                );

              for (const denormKey in
                  config.sourceTypeConfig.denormalized_keys[endpoint]) {
                if ( denormKey[refEndpoint] ) {
                  url = bracketSubstitution(
                    url,
                    key,
                    denormKey[refEndpoint]
                  );
                }
              }
              //console.log('Pushing request to queue: ' + options);
              sourceRequestsQueue.push(processNetworkGetRequest(config, url, options, endpoint));
            }
          } // else continue
        }
      }
    }

    // Wait for all calls to this endpoint to finish before proceding
    await Promise.all(sourceRequestsQueue).then(responses => {
        //console.log('Gathering promises...');
      for( var i=responses.length-1; i>=0; i-- ) {
        let response = responses[i];
        let dataSet = ( config.sourceTypeConfig.source[response.type].key ?
                        response.data[
                          config.sourceTypeConfig.source[response.type].key
                        ] :
                        response.data );
        for( const record of dataSet ) {
          let dataPoint = new models.modelTypes[response.type];
          dataPoint.build(
            config.sourceTypeConfig.source[response.type].mapping, record
          );
          if( !data[response.type] ) {
            data[response.type] = [];
          }
          data[response.type].push(dataPoint);
        }
      }
      //config.progressBar.update(config.sourceProgressIncrement);
      sourceRequestsQueue.splice(i, 1);
    });
  }
  return data;
}

function pushData(conf, data) {
  // Parse target config and build dependency graph to determine push order
  /*targetEndpointOrder = [];
  for (const name in targetApi.target) {
    targetEndpointOrder.push(...buildDependencyChain(targetApi.target, name));
  }

  targetEndpointSet = new Set();
  targetEndpointOrder.forEach(endpoint => targetEndpointSet.add(endpoint));
  targetProgressIncrement = 100/targetEndpointSet.length;
  */
  // TODO Parse target config and transform data based on keys
  //console.log(data);

  // TODO Push data

  //console.log("Length: " + data.projects.length);
  //progressBar.update(200);
 // config.progressBar.stop();

  //console.log('Data successfully piped!');
}

async function processNetworkGetRequest(config, url, options, type) {
  //console.log('Request found in queue.');
  // Discard timestamps > 1 second ago
  for (const t of sourceThrottleCounter) {
    if (t < Date.now()-1000) {
      sourceThrottleCounter.shift();
    } else {
      break;
    }
  }

  // If we're over our throttle, wait.
  while (sourceThrottleCounter.length > config.sourceThrottleCap) {
    await delay(1000/config.sourceThrottleCap);
  }

  // Make request
  sourceThrottleCounter.push(Date.now());
  //console.log('Making request');

  return axios.get(url, options).then((response => {

    //console.log('Response received.');
    // Handle paging
    if (config.sourceTypeConfig.paging.location === "response") {
      //console.log('Looking for page indicator.');
      if (response.data[config.sourceTypeConfig.paging.link_key]) {
        //console.log('New page provided, initiating request: ' + response.data[sourceApi.paging.link_key]);
        processNetworkGetRequest(config, response.data[config.sourceTypeConfig.paging.link_key], options);
      }
    }

    return {
      data: response.data,
      type: type
    }
  }).bind( {options: options, type: type} )).catch(error => {
      console.error(error);
      process.exit();
  });
}


module.exports = {
  pullData,
  pushData,
};
