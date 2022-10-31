const axios = require('axios');
const configUtils = require('../utils/configuration.js');
const models = require('../models/core.js');

let sourceRequestsQueue = [];
let sourceThrottleCounter = [];
let sourceResponseCounter = {};

let targetRequestsQueue = [];
let targetThrottleCounter = [];

async function pullData(config, ids) {
  //config.progressBar.start(200, 0);

  // Pull data
  let data = {
    source: config.sourceTypeConfig.name
  };
  let endpoints = [];
  let fetchType = 'index';

  if (Object.keys(ids).length > 0) {
    // This means we're doing individual 'gets'.
    endpoints = Object.keys(ids);
    fetchType = 'get';
  } else {
    // Pull our preconstructed endpoint set.
    endpoints = config.sourceEndpointSet;
  }

  for (const endpoint of endpoints) {
    let rawPath = (
      fetchType === 'index' ?
        config.sourceTypeConfig.source[endpoint].endpoints.index.path :
        config.sourceTypeConfig.source[endpoint].endpoints.get.path
    );
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
      // No keys means a simple index.
      let url = config.sourceBaseUrl
        + config.sourceTypeConfig.base_path
        + rawPath;

      sourceRequestsQueue.push(processNetworkGetRequest(config, url, options, endpoint));
    } else {
      let keys = configUtils.findSubstitutionKeys(rawPath);
      let urlList = [];
      urlList.push(config.sourceBaseUrl
                    + config.sourceTypeConfig.base_path
                    + rawPath);

      // Loop through the replacement keys (in {}) on this endpoint
      for (const key of keys) {
        // Pull the entity type of the key
        let splitKey = key.split('.');
        let refEndpoint = splitKey[0]; // i.e. the "projects" in "projects.id"
        let refLocation = ( splitKey[1] && splitKey[1] !== 'id' ? splitKey[1] : 'external_id' );

        if (data[refEndpoint]) {

          for (let i=urlList.length-1; i>-1; i--) {
            let url = urlList[i];
            // Loop through our source data to find ids for child paths
            for (const record of data[refEndpoint]) {
              // Build path and push

              // For odd case around denormalized APIs like TR's "test cases"
              if (config.sourceTypeConfig.denormalized_keys[endpoint] &&
                  (refEndpoint in
                    config.sourceTypeConfig.denormalized_keys[endpoint])) {

                for (const denormKey in
                  config.sourceTypeConfig.denormalized_keys[endpoint][refEndpoint]) {
                  // For poorly designed APIs, you can end up with multiple keys
                  //  that need to match.  For instance, needing to define both
                  //  the project and the suite a test belongs to (when the
                  //  suite belongs to the project as well).
                  denormValue = config.sourceTypeConfig.denormalized_keys[endpoint][refEndpoint][denormKey];
                  // Look for the matching record in the second type (suites)
                  //  based on the key in the denorm keys table (project_id).
                  //  Then pull that record's refLocation for substitution.
                  for (const denormRecord of data[denormKey]) {
                    if (denormRecord.custom_fields[denormValue] === record[refLocation]) {
                      urlList.push(configUtils.bracketSubstitution(
                        url,
                        key,
                        denormRecord[refLocation]
                      ));
                    }
                  }
                }
              } else {
                // Not a denormalized key
                urlList.push(configUtils.bracketSubstitution(
                    url,
                    key,
                    record[refLocation]
                  ));
              }
            } // else continue
            // Remove the original record that has since had variables
            //  substituted.
            urlList.splice(i, 1);
          }
        } else if (fetchType === 'get') {
          let url = config.sourceBaseUrl
            + config.sourceTypeConfig.base_path
            + rawPath;
          for (const record of ids[endpoint]) {
            // CTODO - Copy above - how are we creating an item for each key in
            //  the urlList?
            // Why is above so weird???? Pushing then splicing?
            urlList.push(configUtils.bracketSubstitution(
              url,
              key,
              record
            ));
          }
        }
      }
      for (const url of urlList) {
        console.log('Pulling: ' + url);
        sourceRequestsQueue.push(processNetworkGetRequest(config, url, options, endpoint));
      }
    }
    }

    // Wait for all calls to this endpoint to finish before proceding
    await Promise.all(sourceRequestsQueue).then(responses => {
      for( var i=responses.length-1; i>=0; i-- ) {
        let response = responses[i];

        if (Array.isArray(response.data) && response.data.length < 1) {
          continue;
        }
        for (const record of response.data) {

          let dataPoint = new models.modelTypes[response.target_type];
          let built = dataPoint.build(
            config.sourceTypeConfig.source[response.source_type].mapping,
            record,
            ( config.ignoreConfig ? config.ignoreConfig[response.source_type] : {} )
          );
          if( !data[response.target_type] ) {
            data[response.target_type] = [];
          }
          if (built) {
            data[response.target_type].push(dataPoint);
          }
        }
        sourceRequestsQueue.splice(i, 1);
      }
      //config.progressBar.update(config.sourceProgressIncrement);
    });
  }
  return data;
}

async function pushData(config, data) {

  console.log(JSON.stringify(data, null, 2));

  for (const endpoint of config.targetEndpointSet) {
    if (data[endpoint]) {
      let rawPath = config.targetTypeConfig.target[endpoint].endpoints.create.path;
      let options = {};

      // Add authn to the request
      if (config.targetAuthSchema.location === "header") {
        options.headers = {};
        let keys =
          configUtils.findSubstitutionKeys(config.targetAuthSchema.payload);
        // Loop through the replacement keys (in {}) on this endpoint
        for (const key of keys) {
          // Pull identifier
          options.headers[config.targetAuthSchema.key] =
            config.targetAuthPayload;
        }
      }

      options.data = {
        source: data.source,
        type: endpoint
      };

      if (rawPath.indexOf('{') < 0) {
        let url = config.targetBaseUrl
          + config.targetTypeConfig.base_path
          + rawPath;
        options.data.entries = data[endpoint];

        targetRequestsQueue.push(processNetworkPostRequest(config, url, options, endpoint));
      } else {
        /*
        // CTODO - handle APIs that require references
        let keys = configUtils.findSubstitutionKeys(rawPath);
        let urlList = [];
        urlList.push(config.targetBaseUrl
                      + config.targetTypeConfig.base_path
                      + rawPath);


        // Loop through the replacement keys (in {}) on this endpoint
        for (const key of keys) {
          // Pull the entity type of the key
          let splitKey = key.split('.');
          let refEndpoint = splitKey[0];
          let refLocation = ( splitKey[1] && splitKey[1] !== 'id' ? splitKey[1] : 'external_id' );

          if (data[refEndpoint]) {

            for (let i=urlList.length-1; i>-1; i--) {
              let url = urlList[i];
              // Loop through our target data to find ids for child paths
              for (const record of data[refEndpoint]) {
                // Build path and push

                // For odd case around denormalized APIs like TR's "test cases"
                if (config.targetTypeConfig.denormalized_keys[endpoint] &&
                    (refEndpoint in
                      config.targetTypeConfig.denormalized_keys[endpoint])) {

                  for (const denormKey in
                    config.targetTypeConfig.denormalized_keys[endpoint][refEndpoint]) {
                    // For poorly designed APIs, you can end up with multiple keys that need to match.  For instance,
                    //  needing to define both the project and the suite a test belongs to (when the suite belongs to
                    //  the project as well).
                    denormValue = config.targetTypeConfig.denormalized_keys[endpoint][refEndpoint][denormKey];
                    // Look for the matching record in the second type (suites) based on the key in the denorm
                    //  keys table (project_id).  Then pull that record's refLocation for substitution.
                    for (const denormRecord of data[denormKey]) {
                      if (denormRecord.custom_fields[denormValue] === record[refLocation]) {
                        urlList.push(configUtils.bracketSubstitution(
                          url,
                          key,
                          denormRecord[refLocation]
                        ));
                      }
                    }
                  }
                } else {
                  // Not a denormalized key
                  urlList.push(configUtils.bracketSubstitution(
                      url,
                      key,
                      record[refLocation]
                    ));
                }
              } // else continue
              // Remove the original record that has since had variables substituted.
              urlList.splice(i, 1);
            }
          }
        }
        for (const url of urlList) {
          console.log('Pulling: ' + url);
          targetRequestsQueue.push(processNetworkGetRequest(config, url, options, endpoint));
        }
      */
      }

      // Wait for all calls to this endpoint to finish before proceding
      await Promise.all(targetRequestsQueue).then(responses => {
        // CTODO - If we insert individually and get entity info back, then use that to update dependencies.
        for( var i=responses.length-1; i>=0; i-- ) {
          let response = responses[i];
        }
      });
    }
    //progressBar.update(200);
    // config.progressBar.stop();
    //console.log('Data successfully piped!');
  }
}

async function processNetworkGetRequest(config, url, options, type) {

  // If we're over our throttle, wait.
  while (sourceThrottleCounter.length > config.sourceThrottleCap) {
    // Discard timestamps > 1 second ago
    for (const t of sourceThrottleCounter) {
      if (t < Date.now()-1000) {
        sourceThrottleCounter.shift();
      } else {
        break;
      }
    }

    if (sourceThrottleCounter.length > config.sourceThrottleCap) {
      await new Promise(resolve => setTimeout(resolve, 1000/config.sourceThrottleCap));
    }
  }

  // Make request
  sourceThrottleCounter.push(Date.now());

  return axios.get(url, options).then((response => {

    let dataSet;
    if (Array.isArray(response.data) && response.data.length < 1) {
      dataSet = [];
    } else {
      // If we have a key we expect in the response and it isn't empty, use it.  Otherwise it's the whole data.
      dataSet = ( config.sourceTypeConfig.source[type].response_data_key &&
                     response.data[
                       config.sourceTypeConfig.source[type].response_data_key
                     ] ?
                     response.data[
                       config.sourceTypeConfig.source[type].response_data_key
                     ] :
                     response.data );
      // If this is our first request of this type, count how many entries we recieve at the response_data_key.
      if (!sourceResponseCounter[type]) {
        sourceResponseCounter[type] = 0 ;
      }
      sourceResponseCounter[type] += ( Array.isArray(dataSet) ? dataSet.length : 1 );
    }

    // Handle paging
    if (config.sourceTypeConfig.paging.location === "response") {
      let keepPaging = true;
      // If we have a limit, check before paging.
      if (config.sourceTypeConfig.source[type].limit) {
        switch (config.sourceTypeConfig.source[type].limit.type) {
          case 'count':
            // If it is a raw count
            if (sourceResponseCounter[type] >= config.sourceTypeConfig.source[type].limit.value) {
              if (!config.sourceTypeConfig.source[type].limit.cutoff || // TODO - Move default to config setup
                  (config.sourceTypeConfig.source[type].limit.cutoff &&
                  config.sourceTypeConfig.source[type].limit.cutoff === 'hard')) {
                let overage = sourceResponseCounter[type]
                  - parseInt(config.sourceTypeConfig.source[type].limit.value);
                dataSet.splice(dataSet.length-overage, dataSet.length-overage+1);
              }
              keepPaging = false;
            }
            break;
          case 'match':
            // If it is based on an id
            let i=0;
            while (i < dataSet.length) {
              let kvPair = config.sourceTypeConfig.source[type].limit.value.split(':');
              if (kvPair.length === 2) { // TODO - Check for this in config setup
                if (dataSet[i][kvPair[0]] == kvPair[1]) {
                  if (!config.sourceTypeConfig.source[type].limit.cutoff || // TODO - Move default to config setup
                      (config.sourceTypeConfig.source[type].limit.cutoff &&
                      config.sourceTypeConfig.source[type].limit.cutoff === 'hard')) {
                    dataSet.splice(i, dataSet.length-i);
                  }
                  keepPaging = false;
                  break;
                }
              }
              i++;
            }
            break;
        }
      }
      if (keepPaging) {
        if (response.data[config.sourceTypeConfig.paging.link_key]) {
          processNetworkGetRequest(config, response.data[config.sourceTypeConfig.paging.link_key], options);
        }
        // TODO: Support for paging without handy links returned by the API.
      }
    }

    if (response.status >= 200 && response.status < 400) {
      return {
        data: dataSet,
        source_type: type,
        target_type: config.sourceTypeConfig.source[type].target
      }
    } // CTOOD else retry/backoff/what?
  }).bind( {options: options, type: type} )).catch(error => {
      console.error(error);
      process.exit();
  });
}


async function processNetworkPostRequest(config, url, options, type) {

  // If we're over our throttle, wait.
  while (targetThrottleCounter.length > config.targetThrottleCap) {
    // Discard timestamps > 1 second ago
    for (const t of targetThrottleCounter) {
      if (t < Date.now()-1000) {
        targetThrottleCounter.shift();
      } else {
        break;
      }
    }

    if (targetThrottleCounter.length > config.targetThrottleCap) {
      await new Promise(resolve => setTimeout(resolve, 1000/config.targetThrottleCap));
    }
  }

  // Make request
  targetThrottleCounter.push(Date.now());

  const data = options.data;
  delete options.data;
  return axios.post(url, data, options).then(response => {

    if (response.status >= 200 && response.status < 400) {
      return {
        data: response.data,
      }
    } // CTOOD else retry/backoff/what?
  }).catch(error => {
      console.error(error);
      process.exit();
  });
}

module.exports = {
  pullData,
  pushData
};
