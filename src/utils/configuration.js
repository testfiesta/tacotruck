const auth = require('./auth.js');
const fs = require('fs');

const credentialedTypes = ['api'];
const validSourceTypes = ['api', 'junit'];
const validTargetTypes = ['api'];

class PipeConfig {
  sourceAuthSchema;
  sourceAuthPayload;
  sourceBaseUrl;
  sourceCredentials;
  sourceThrottleCap = 2;
  sourceType;
  sourceTypeConfig;
  sourceTypeLocation;
  sourceEndpointSet = new Set();
  sourceProgressIncrement;
  sourceOffsets = {};

  // TODO Target config

  constructor(args) {
    // If a source type is provided, set it.
    if (validSourceTypes.includes(args.source_type)) {
      this.sourceType = args.source_type;
    } else {
      console.error('Invalid source type: ' + args.source_type);
      process.exit();
    }

    this.sourceLocation = args.source;

    // If a target type is provided, set it.
    if (args.target_type) {
      if (validSourceTypes.includes(args.target_type)) {
        targetType = args.target_type;
      } else {
        console.error('Invalid target type: ' + args.target_type);
        process.exit();
      }
    }

    // Parse the source config files.
    if (this.sourceType === 'api') {
      try {
        if (fs.existsSync(args.source)) {
          // Check if this is a custom type
          this.sourceTypeConfig = JSON.parse(fs.readFileSync(args.source));
        } else if (fs.existsSync('./api_configs/' + args.source + '.json')) {
          // Fall back to defaults
          this.sourceTypeConfig = JSON.parse(fs.readFileSync('./api_configs/' + args.source + '.json'));
        } else if (args.source) {
          console.error('Source config not found: ' + args.source);
          process.exit();
        }
      } catch (err) {
        console.error('Invalid source config: ' + err);
        process.exit();
      }
    }

    // Default target type to api if no config was provided
    if (!this.targetType) {
      this.targetType = 'api';
    }

    // Default target to YATT
    if (!args.target) {
      args.target = 'yatt';
    }

    // Parse the target config files.
    if (this.targetType === 'api') {
      try {
        if (fs.existsSync(args.target)) {
          // Check if this is a custom type
          this.targetTypeConfig = JSON.parse(fs.readFileSync(args.target));
        } else if (fs.existsSync('./api_configs/' + args.target + '.json')) {
          // Fall back to defaults
          this.targetTypeConfig = JSON.parse(fs.readFileSync('./api_configs/' + args.target + '.json'));
        } else {
          console.error('Source config not found: ' + args.target);
          process.exit();
        }
      } catch (err) {
        console.error('Invalid target config: ' + err);
        process.exit();
      }
    }

    if (credentialedTypes.includes(this.sourceType)) {
      // Parse credentials file and ensure it matches expected data based on type
      // provided in the config
      try {
        let creds = JSON.parse(fs.readFileSync(args.credentials));
        this.sourceCredentials = creds.source;
        this.sourceBaseUrl = creds.source.base_url;
      } catch (err) {
        console.error('Issue reading source credentials file: ' + err);
        process.exit();
      }

      try {
        this.sourceAuthSchema =
          auth.authSchemas[this.sourceTypeConfig.auth.type];
      } catch(err) {
        console.error('Invalid auth configuration: ' + err);
        process.exit();
      }

      // Build our source API credentials
      for (const key of this.sourceAuthSchema.inputs) {
        if (!this.sourceCredentials[key]) {
          console.error('Invalid source credentials.' +
            '\n Missing input: ' + key);
          process.exit();
        } else {
          let keyIndex = this.sourceAuthSchema.payload.indexOf(key);
          if (keyIndex < 0) {
            console.error('Key [' + key + '] not found in payload.');
            process.exit();
          }
          // Do our substitutions to build the payload.
          this.sourceAuthPayload =
            this.sourceAuthSchema.payload.substring(0, keyIndex-1)
            + this.sourceCredentials[key]
            + this.sourceAuthSchema.payload.substring(
              keyIndex+key.length+1, this.sourceAuthSchema.payload.length
            );
        }
      }
    }

    // CTODO - Build our target API credentials

    if (this.sourceType === 'api') {
      if (this.sourceTypeConfig.requests_per_second) {
        if (isNaN(this.sourceTypeConfig.requests_per_second)) {
          console.error('Invalid config "requests_per_second" on source API.');
        } else {
          this.sourceThrottleCap = this.sourceTypeConfig.requests_per_second;
        }
      }


      // Parse source config and build dependency graph to determine access order
      var sourceEndpointOrder = [];
      for (const name in this.sourceTypeConfig.source) {
        sourceEndpointOrder.push(...buildDependencyChain(
          this.sourceTypeConfig.source, name
        ));
      }

      sourceEndpointOrder.forEach(endpoint =>
        this.sourceEndpointSet.add(endpoint)
      );
      this.sourceProgressIncrement = 100/this.sourceEndpointSet.size;

      // If incremental, get last offsets from target config
      for (const endpoint of this.sourceEndpointSet) {
        if (args.incremental) {
          // CTODO
        } else {
          this.sourceOffsets[endpoint] = 0;
          // CTODO use this
        } 
      } 
    } else if (this.sourceType === 'junit') {
    }
  }
}

// Find all dependencies in chain
function buildDependencyChain(keyMap, name) {
  if (!keyMap[name] || !keyMap[name].path) {
    console.error('Invalid key [' + name + '].');
    process.exit();
  }
  if (keyMap[name].path.indexOf('{') < 0) {
    return [name];
  } else {
    let keys = findSubstitutionKeys(keyMap[name].path);
    let dependencyMap = [];
    for (const dependency of keys) {
      dependencyMap.push(
        ...buildDependencyChain(keyMap, dependency.split('.')[0])
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
    if (endIndex < 0) {
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


module.exports = {
  buildDependencyChain,
  findSubstitutionKeys,
  PipeConfig,
  validSourceTypes,
  validTargetTypes,
}
