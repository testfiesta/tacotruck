const axios = require('axios');
const configUtils = require('../utils/configuration.js');
const dataUtils = require('../utils/data.js');
const FormData = require('form-data');
const fs = require('fs');

let sourceRequestsQueue = [];
let sourceThrottleCounter = [];
let sourceResponseCounter = {};

let targetRequestsQueue = [];
let targetThrottleCounter = [];

/* ids - an object with endpoints as keys and lists of objects with identifying
         data as values: e.g. { executions: [ { id: 1 } ] }
*/
async function pullData(config, ids) {
  //config.progressBar.start(200, 0);

  // Pull data
  let data = {
    source: config.typeConfig.name
  };
  let endpoints = [];
  let fetchType = 'index';

  if (Object.keys(ids).length > 0) {
    // This means we're doing individual 'gets'.
    endpoints = Object.keys(ids);
    fetchType = 'get';
  } else {
    // Pull our preconstructed endpoint set.
    endpoints = config.endpointSet;
  }

  for (const endpoint of endpoints) {
    let rawPath = (
      fetchType === 'index' ?
        config.typeConfig.source[endpoint].endpoints.index.path :
        config.typeConfig.source[endpoint].endpoints.get.path
    );
    let options = {};

    // Add authn to the request
    if (config.authSchema.location === "header") {
      options.headers = {};
      let keys =
        configUtils.findSubstitutionKeys(config.authSchema.payload);
      // Loop through the replacement keys (in {}) on this endpoint
      for (const key of keys) {
        // Pull identifier
        options.headers[config.authSchema.key] =
          config.authPayload;
      }
    }

    if (rawPath.indexOf('{') < 0) {
      // No keys means a simple index.
      let url = config.baseUrl
        + config.typeConfig.base_path
        + rawPath;

      sourceRequestsQueue.push(processNetworkGetRequest(config, url, options, endpoint));
    } else {
      let unsortedKeys = configUtils.findSubstitutionKeys(rawPath);
      let denormalizedConfigKeys =
        config.typeConfig.denormalized_keys?.[endpoint] || {};
      let keys = [];

      if (Object.keys(denormalizedConfigKeys).length < 1) {
        keys = unsortedKeys;
      } else {
        // Move our denormalized keys to the front of the line for URL building
        for (let i=Object.keys(denormalizedConfigKeys).length-1; i>-1; i--) {
          for (const key of unsortedKeys) {
            if (key.indexOf(Object.keys(denormalizedConfigKeys)[i]) > -1) {
              keys.unshift(key);
            } else {
              keys.push(key);
            }
          }
        }
      }

      let urlList = [];
      urlList.push(config.baseUrl
                    + config.typeConfig.base_path
                    + rawPath);

      if (fetchType === 'index') {
        // Loop through the replacement keys (in {}) on this endpoint
        for (const key of keys) {
          // Pull the entity type of the key
          let splitKey = key.split('.');
          let refEndpoint = splitKey[0]; // i.e. the "projects" in "projects.id"
          let refLocation = (
            splitKey[1] && splitKey[1] !== 'id' ?
              splitKey[1] :
              'source_id'
          );
  
          if (data[refEndpoint]) {
  
            for (let i=urlList.length-1; i>-1; i--) {
              let url = urlList[i];
              // Loop through our source data to find ids for child paths
              for (const record of data[refEndpoint]) {
                // Build path and push
  
                // For odd case around denormalized APIs like TR's "test cases"
                if (config.typeConfig.denormalized_keys[endpoint] &&
                    (refEndpoint in
                      config.typeConfig.denormalized_keys[endpoint])) {
  
                  for (const fullDenormKey in
                      config.typeConfig.denormalized_keys[endpoint][refEndpoint]) {
                    let splitDenormKey = fullDenormKey.split('.');
                    let denormEndpoint = splitKey[0]; // i.e. the "projects" in "projects.id"
  
                    // For poorly designed APIs, you can end up with multiple keys
                    //  that need to match.  For instance, needing to define both
                    //  the project and the suite a test belongs to (when the
                    //  suite belongs to the project as well).
                    denormValue =
                      config.typeConfig.denormalized_keys[endpoint][refEndpoint][fullDenormKey];
  
                    // Look for the matching record in the second type (suites)
                    //  based on the key in the denorm keys table (project_id).
                    //  Then pull that record's refLocation for substitution.
                    for (const denormRecord of data[denormEndpoint]) {
                      if (denormRecord?.[denormValue] === record[refLocation]) {
  
                        // Replace our base key before handing denorm keys.
                        let newURL = configUtils.bracketSubstitution(
                          url,
                          key,
                          denormRecord[refLocation]
                        );
                        for (const [secondaryReplacementKey, secondaryKey] of
                            Object.entries(denormalizedConfigKeys[refEndpoint])) {
                          newURL = configUtils.bracketSubstitution(
                            newURL,
                            secondaryReplacementKey,
                            denormRecord?.[secondaryKey]
                          );
                          let removalIndex = keys.indexOf(secondaryReplacementKey);
                          if (removalIndex > -1) {
                            keys.splice(removalIndex, 1);
                          }
                        }
                        urlList.push(newURL);
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
          }
        }
      } else if (fetchType === 'get') {
        for (let i=urlList.length-1; i>-1; i--) {
          let url = urlList[i];
          for (const record of ids[endpoint]) {
            let newURL = url;
            for (const [secondaryReplacementKey, secondaryKey] of
                Object.entries(record)) {
              newURL = configUtils.bracketSubstitution(
                newURL,
                secondaryReplacementKey,
                secondaryKey
              );
            }
            urlList.push(newURL);
          }
          urlList.splice(i, 1);
        }
      }

      for (const url of urlList) {
        sourceRequestsQueue.push(processNetworkGetRequest(config, url, options, endpoint));
      }
    }

    // Wait for all calls to this endpoint to finish before proceding
    await Promise.all(sourceRequestsQueue).then(responses => {
      for( var i=responses.length-1; i>=0; i-- ) {
        let response = responses[i];

        if (Array.isArray(response.data) && response.data.length < 1) {
          continue;
        }
        if (!Array.isArray(response.data)) {
          response.data = [response.data];
        }
        for (const record of response.data) {
          let dataPoint = dataUtils.mapDataWithIgnores(
            config.typeConfig.source[response.source_type].mapping,
            record,
            (
              config.ignoreConfig ?
                config.ignoreConfig[response.source_type] :
                {}
            )
          );
          if( !data[response.target_type] ) {
            data[response.target_type] = [];
          }
          if (dataPoint) {
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
  // Check for any data that will be dropped and warn
  for (const dataEndpoint of Object.keys(data)) {
    if (!config.endpointSet.includes(dataEndpoint)) {
      console.error(`Data found for [${dataEndpoint}], but no configuration ` +
        `for this data type exists for target [${config.name}] so the data` +
        `will not be sent.`);
    }
  }

  let multiTarget = config.typeConfig.multi_target;
  let multiBulkData = {};
  for (const endpoint of config.endpointSet) {
    if (data[endpoint]) {
      let bulkData = [];
      let updateKey = config.typeConfig.target[endpoint].endpoints?.update?.update_key || undefined;
      let payloadKey = config.typeConfig.target[endpoint].endpoints?.create?.payload_key || undefined;
      let options = {};
      let mapping = config.typeConfig.target[endpoint].mapping || {};

      // Add authn to the request
      if (config.authSchema.location === "header") {
        options.headers = {};
        let keys =
          configUtils.findSubstitutionKeys(config.authSchema.payload);
        // Loop through the replacement keys (in {}) on this endpoint
        for (const key of keys) {
          // Pull identifier
          options.headers[config.authSchema.key] =
            config.authPayload;
        }
      }

      for (const datapoint of data[endpoint]) {
        // Move keys based on mapping
        mappedDatapoint = dataUtils.mapData(mapping, datapoint);

        if (updateKey && mappedDatapoint?.[updateKey]) {
          // Update record.
          let rawPath =
            config.typeConfig.target[endpoint].endpoints.update.path;
          let dataKey =
            config.typeConfig.target[endpoint].endpoints.update.data_key;
          let url = config.baseUrl
            + config.typeConfig.base_path
            + rawPath;
          let requiredKeys =
            config.typeConfig.target[endpoint].endpoints.update.required_keys
            ?? [];
          let missingKeys = [];
          for (const rKey of requiredKeys) {
            if (!mappedDatapoint[rKey]) {
              missingKeys.push(rKey);
            }
          }
          if (missingKeys.length > 0) {
            console.error(
              `Update record missing required keys: (${
                JSON.stringify(missingKeys)
               }) for data point: ${JSON.stringify(datapoint)}`);
            continue;
          }
          if (rawPath.indexOf('{') >= 0) {
            // Handle substitutions
            let keys = configUtils.findSubstitutionKeys(rawPath);
            for (const key of keys) {
              if (mappedDatapoint[key]) {
                url = configUtils.bracketSubstitution(
                  url,
                  key,
                  mappedDatapoint[key]
                );
              } else {
                console.error(
                  `Update record missing key [${key}] for data point: ${
                    JSON.stringify(datapoint)
                  }`);
                continue;
              }
            }
          }
          options.data = dataUtils.buildRequestData(
            dataKey,
            mapping,
            mappedDatapoint
          );

          if (config.gitRepo || config.gitBranch || config.gitSha) {
            options.data.source_control = {
              'repo': config.gitRepo,
              'branch': config.gitBranch,
              'sha': config.gitSha
            };
          }

          // Add our override data on update
          if (config.overrides?.[endpoint]) {
            for (const[key, value] of config.overrides[endpoint]) {
              options.data[key] = value;
            }
          }

          targetRequestsQueue.push(
            processNetworkPostRequest(config, url, options)
          );
        } else if (config.typeConfig.target[endpoint].endpoints.create?.bulk_path || multiTarget) {
          // Bulk creation
          bulkData.push(mappedDatapoint);
        } else {
          // Individual creation
          let rawPath =
            config.typeConfig.target[endpoint].endpoints.create.single_path;
          let dataKey =
            config.typeConfig.target[endpoint].endpoints.create?.data_key;
          let url = config.baseUrl
            + config.typeConfig.base_path
            + rawPath;

          if (payloadKey && mappedDatapoint?.[payloadKey]) {
            // Creation with payload
            const filePath = mappedDatapoint?.[payloadKey];
            if (!fs.existsSync(filePath)) {
              console.error(`File ${filePath} does not exist. Skipping...`);
              continue;
            }

            const form = new FormData();
            const stats = fs.statSync(filePath);
            const fileSizeInBytes = stats.size;
            const fileStream = fs.createReadStream(filePath);

            form.append('file', fileStream, {knownLength: fileSizeInBytes});
            options.data = form;
          } else {    
            options.data = dataUtils.buildRequestData(
              dataKey,
              mapping,
              mappedDatapoint
            );

            if (config.typeConfig.target[endpoint].endpoints.create.include_source) {
              options.data.source = data.source;
            }

            if (config.gitRepo || config.gitBranch || config.gitSha) {
              options.data.source_control = {
                'repo': config.gitRepo,
                'branch': config.gitBranch,
                'sha': config.gitSha
              };
            }

            // Add our override data on create
            if (config.overrides?.[endpoint]) {
              for (const[key, value] of config.overrides[endpoint]) {
                options.data[key] = value;
              }
            }

          }
          targetRequestsQueue.push(
            processNetworkPostRequest(config, url, options)
          );

        }
      }

      // After our loop, run bulk creation.
      if (bulkData.length > 0 ){
        if (!multiTarget) {
          let rawPath =
            config.typeConfig.target[endpoint].endpoints.create.bulk_path;
          let dataKey =
            config.typeConfig.target[endpoint].endpoints.create?.data_key;
          let url = config.baseUrl
            + config.typeConfig.base_path
            + rawPath;

          options.data = dataUtils.buildRequestData(
            dataKey,
            mapping,
            mappedDatapoint
          );

          if (config.typeConfig.target[endpoint].endpoints.create.include_source) {
            options.data.source = data.source;
          }

          if (config.gitRepo || config.gitBranch || config.gitSha) {
            options.data.source_control = {
              'repo': config.gitRepo,
              'branch': config.gitBranch,
              'sha': config.gitSha
            };
          }

          // Add our override data on create
          if (config.overrides?.[endpoint]) {
            for (const[key, value] of config.overrides[endpoint]) {
              options.data[key] = value;
            }
          }


          targetRequestsQueue.push(processNetworkPostRequest(config, url, options));

        } else {
          multiBulkData[endpoint] = bulkData;
        }
      }
    }
  }

  if (multiTarget) {
    let options= {};

    // Add authn to the request
    if (config.authSchema.location === "header") {
      options.headers = {};
      let keys =
        configUtils.findSubstitutionKeys(config.authSchema.payload);
      // Loop through the replacement keys (in {}) on this endpoint
      for (const key of keys) {
        // Pull identifier
        options.headers[config.authSchema.key] =
          config.authPayload;
      }
    }

    let rawPath =
      config.typeConfig.multi_target.path;
    let dataKey =
      config.typeConfig.multi_target.data_key;
    let url = config.baseUrl
      + config.typeConfig.base_path
      + rawPath;

    // TODO - data is already mapped - why pass mapping?
    options.data = dataUtils.buildRequestData(
      dataKey,
      {},
      multiBulkData
    );

    if (config.typeConfig.multi_target.include_source) {
      options.data.source = data.source;
    }

    if (config.gitRepo || config.gitBranch || config.gitSha) {
      options.data.source_control = {
        'repo': config.gitRepo,
        'branch': config.gitBranch,
        'sha': config.gitSha
      };
    }

    // Note: Overrides don't currently work on multi_target data

    targetRequestsQueue.push(processNetworkPostRequest(config, url, options));

  }

  // Wait for all calls to this endpoint to finish before proceding
  await Promise.all(targetRequestsQueue).then(responses => {
    // TODO - Add a backflow option - if we insert individually into the
    //        target and get entity info back, then use that to update the
    //        source record somehow.
    for( var i=responses.length-1; i>=0; i-- ) {
      let response = responses[i];
    }
  });
  //progressBar.update(200);
  // config.progressBar.stop();
}

async function processNetworkGetRequest(config, url, options, type) {
  // If we're over our throttle, wait.
  while (sourceThrottleCounter.length > config.throttleCap) {
    // Discard timestamps > 1 second ago
    for (const t of sourceThrottleCounter) {
      if (t < Date.now()-1000) {
        sourceThrottleCounter.shift();
      } else {
        break;
      }
    }

    if (sourceThrottleCounter.length > config.throttleCap) {
      await new Promise(resolve => setTimeout(resolve, 1000/config.throttleCap));
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
      dataSet = ( config.typeConfig.source[type].data_key &&
                     response.data[
                       config.typeConfig.source[type].data_key
                     ] ?
                     response.data[
                       config.typeConfig.source[type].data_key
                     ] :
                     response.data );
      // If this is our first request of this type, count how many entries we recieve at the data_key.
      if (!sourceResponseCounter[type]) {
        sourceResponseCounter[type] = 0 ;
      }
      sourceResponseCounter[type] += ( Array.isArray(dataSet) ? dataSet.length : 1 );
    }

    // Handle paging
    if (config.typeConfig.paging.location === "response") {
      let keepPaging = true;
      // If we have a limit, check before paging.
      if (config.typeConfig.source[type].limit) {
        switch (config.typeConfig.source[type].limit.type) {
          case 'count':
            // If it is a raw count
            if (sourceResponseCounter[type] >=
                config.typeConfig.source[type].limit.value) {
              // TODO - Move default to config setup
              if (!config.typeConfig.source[type].limit.cutoff ||
                  (config.typeConfig.source[type].limit.cutoff &&
                  config.typeConfig.source[type].limit.cutoff === 'hard')) {
                let overage = sourceResponseCounter[type]
                  - parseInt(config.typeConfig.source[type].limit.value);
                dataSet.splice(dataSet.length-overage, dataSet.length-overage+1);
              }
              keepPaging = false;
            }
            break;
          case 'match':
            // If it is based on an id
            let i=0;
            while (i < dataSet.length) {
              let kvPair = config.typeConfig.source[type].limit.value.split(':');
              if (kvPair.length === 2) { // TODO - Check for this in config setup
                if (dataSet[i][kvPair[0]] == kvPair[1]) {
                  if (!config.typeConfig.source[type].limit.cutoff ||
                      (config.typeConfig.source[type].limit.cutoff &&
                      config.typeConfig.source[type].limit.cutoff === 'hard')) {
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
        if (response.data[config.typeConfig.paging.link_key]) {
          processNetworkGetRequest(config, response.data[config.typeConfig.paging.link_key], options);
        }
        // TODO: Support for paging without handy links returned by the API.
      }
    }

    if (response.status >= 200 && response.status < 400) {
      return {
        data: dataSet,
        source_type: type,
        target_type: config.typeConfig.source[type].target
      }
    } // CTOOD else retry/backoff/what?
  }).bind( {options: options, type: type} )).catch(error => {
      console.error(error);
      process.exit();
  });
}


async function processNetworkPostRequest(config, url, options) {

  // If we're over our throttle, wait.
  while (targetThrottleCounter.length > config.throttleCap) {
    // Discard timestamps > 1 second ago
    for (const t of targetThrottleCounter) {
      if (t < Date.now()-1000) {
        targetThrottleCounter.shift();
      } else {
        break;
      }
    }

    if (targetThrottleCounter.length > config.throttleCap) {
      await new Promise(resolve => setTimeout(resolve, 1000/config.throttleCap));
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
