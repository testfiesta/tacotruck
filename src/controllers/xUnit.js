const axios = require('axios');
const configUtils = require('../utils/configuration.js');
const models = require('../models/core.js');
const xUnitParser = require('../utils/xUnitParser.js');


async function pullData(config) {
  //config.progressBar.start(200, 0);

  // Pull data
  let data = new xUnitParser()
    .parseFile(config.sourceLocation);

   
  return data;
}

function pushData(conf, data) {
  console.log(data);
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
