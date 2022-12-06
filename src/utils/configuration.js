const auth = require('./auth.js');
const fs = require('fs');

const credentialedTypes = ['api'];
const validSourceTypes = ['api', 'junit'];
const validTargetTypes = ['api'];
const validDataTypes = [
  'cases',
  'plans',
  'runs',
  'executions',
  'projects',
  'suites',
  'folders',
  'issues',
];

class PipeConfig {
  ignoreConfig;
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

  targetAuthSchema;
  targetAuthPayload;
  targetBaseUrl;
  targetCredentials;
  targetThrottleCap = 2;
  targetType;
  targetTypeConfig;
  targetTypeLocation;
  targetEndpointSet = new Set();
  targetProgressIncrement;

  constructor(args) {
    // If data types are provided, validate them.
    this.dataTypes = [];
    this.gitRepo;
    this.gitBranch;
    this.gitSha;

    if (!args.no_git) {
      const gitConfig = fs.readFileSync('.git/config', { encoding: 'utf-8' });
      this.gitRepo = gitConfig.trim().split('\n\t').find(config => config.includes('url')).split('/').pop();

      const gitHEAD = fs.readFileSync('.git/HEAD', { encoding: 'utf-8' });
      this.gitBranch = gitHEAD.trim().split('refs/heads/').pop();

      let gitLogSha = fs.readFileSync('.git/logs/HEAD', { encoding: 'utf-8' });
      gitLogSha = gitLogSha.trim().split('\n');
      this.gitSha = gitLogSha.length > 0 ? gitLogSha[gitLogSha.length - 1].split(' ')[0] : '';
    }

    if (args.data_types) {
      this.dataTypes = [];
      for (const type of args.data_types.split(',')) {
        if (validDataTypes.includes(type)) {
          this.dataTypes.push(type);
        } else {
          console.error('Invalid data type: ' + type +'. Ignoring...');
        }
      }
      if (this.dataTypes.length === 0) {
        console.error('No valid data types provided.');
        process.exit();
      }
    }

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
        this.targetType = args.target_type;
      } else {
        console.error('Invalid target type: ' + args.target_type);
        process.exit();
      }
    }

    try {
      if (args.ignore) {
        if (fs.existsSync(args.ignore)) {
          // Check if this is a custom type
          this.ignoreConfig = JSON.parse(fs.readFileSync(args.ignore));
        }
      }
    } catch (err) {
      console.error('Invalid ignore config: ' + err);
    }

    // Parse the source config files.
    if (this.sourceType === 'api') {
      try {
        if (fs.existsSync(args.source)) {
          // Check if this is a custom type
          this.sourceTypeConfig = JSON.parse(fs.readFileSync(args.source));
        } else if (fs.existsSync(`${packageRoot}/api_configs/${args.source}.json`)) {
          // Fall back to defaults
          this.sourceTypeConfig = JSON.parse(fs.readFileSync(`${packageRoot}/api_configs/${args.source}.json`));
        } else if (args.source) {
          console.error('Source config not found: ' + args.source);
          process.exit();
        }
      } catch (err) {
        console.error('Invalid source config: ' + err);
        process.exit();
      }
    } else {
      console.error('Invalid source type: ' + this.sourceType);
      process.exit();
    }

    if (!this.sourceTypeConfig.name) {
      console.error('Source configuration file must specify a "name" to identify the service.');
      process.exit();
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
        } else if (fs.existsSync(`${packageRoot}/api_configs/${args.target}.json`)) {
          // Fall back to defaults
          this.targetTypeConfig = JSON.parse(fs.readFileSync(`${packageRoot}/api_configs/${args.target}.json`));
        } else {
          console.error('Source config not found: ' + args.target);
          process.exit();
        }
      } catch (err) {
        console.error('Invalid target config: ' + err);
        process.exit();
      }
    } else {
      console.error('Invalid target type: ' + this.targetType);
      process.exit();
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

    // Build our target API credentials

    if (credentialedTypes.includes(this.targetType)) {
      // Parse credentials file and ensure it matches expected data based on type
      // provided in the config
      try {
        let creds = JSON.parse(fs.readFileSync(args.credentials));
        this.targetCredentials = creds.target;
        this.targetBaseUrl = creds.target.base_url;
      } catch (err) {
        console.error('Issue reading target credentials file: ' + err);
        process.exit();
      }

      try {
        this.targetAuthSchema =
          auth.authSchemas[this.targetTypeConfig.auth.type];
      } catch(err) {
        console.error('Invalid auth configuration: ' + err);
        process.exit();
      }

      // Build our target API credentials
      for (const key of this.targetAuthSchema.inputs) {
        if (!this.targetCredentials[key]) {
          console.error('Invalid target credentials.' +
            '\n Missing input: ' + key);
          process.exit();
        } else {
          let keyIndex = this.targetAuthSchema.payload.indexOf(key);
          if (keyIndex < 0) {
            console.error('Key [' + key + '] not found in payload.');
            process.exit();
          }
          // Do our substitutions to build the payload.
          this.targetAuthPayload =
            this.targetAuthSchema.payload.substring(0, keyIndex-1)
            + this.targetCredentials[key]
            + this.targetAuthSchema.payload.substring(
              keyIndex+key.length+1, this.targetAuthSchema.payload.length
            );
        }
      }
    }

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
      var sourceEndpoints = [];
      if (this.dataTypes.length > 0) {
        // If data types are specified, only check those endpoints.
        for (const type of this.dataTypes) {
          sourceEndpoints[type] = this.sourceTypeConfig.source[type];
        }
      } else {
        sourceEndpoints = this.sourceTypeConfig.source; 
      }
      for (const name in sourceEndpoints) {
        sourceEndpointOrder.push(...buildDependencyChain(
          this.sourceTypeConfig.source, name, 'index'
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

    if (this.targetType === 'api') {
      if (this.targetTypeConfig.requests_per_second) {
        if (isNaN(this.targetTypeConfig.requests_per_second)) {
          console.error('Invalid config "requests_per_second" on target API.');
        } else {
          this.targetThrottleCap = this.targetTypeConfig.requests_per_second;
        }
      }

      // Parse source config and build dependency graph to determine access order
      var targetEndpoints = [];
      if (this.dataTypes.length > 0) {
        // If data types are specified, only check those endpoints.
        targetEndpoints = this.dataTypes;
      } else {
        targetEndpoints = this.targetTypeConfig.target;
      }

      Object.keys(targetEndpoints).forEach(endpoint =>
        this.targetEndpointSet.add(endpoint)
      );
      this.targetProgressIncrement = 100/this.targetEndpointSet.size;
    }
  }
}

// Find all dependencies in chain
function buildDependencyChain(keyMap, name, endpointSelector) {
  let path = keyMap[name]?.endpoints?.[endpointSelector]?.path;
  path ||= keyMap[name]?.endpoints?.[endpointSelector]?.multi_path;
  path ||= keyMap[name]?.endpoints?.[endpointSelector]?.single_path;
  if (!keyMap[name] || !path) {
    console.error('Invalid key [' + name + '].');
    process.exit();
  }
  if (path.indexOf('{') < 0) {
    return [name];
  } else {
    let keys = findSubstitutionKeys(path);
    let dependencyMap = [];
    for (const dependency of keys) {
      dependencyMap.push(
        ...buildDependencyChain(keyMap, dependency.split('.')[0], endpointSelector)
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
  bracketSubstitution,
  buildDependencyChain,
  findSubstitutionKeys,
  PipeConfig,
  validSourceTypes,
  validTargetTypes,
  validDataTypes,
}
