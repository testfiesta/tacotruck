const auth = require('./auth.js');
const fs = require('fs');

const credentialedTypes = ['api'];
const validSourceTypes = ['api', 'junit'];
const validTargetTypes = ['api'];
const defaultEndpoints = {
  "source": "index"
};

class EndpointConfig {
  direction;
  overrides;
  authSchema;
  authPayload;
  baseUrl;
  credentials;
  throttleCap = 2;
  type;
  typeConfig;
  typeLocation;
  endpointSet = [];
  gitRepo;
  gitBranch;
  gitSha;
  ignoreConfig;
  progressIncrement;
  offsets = {};

  constructor(args, integration, direction) {
    this.direction = direction;
    this.integration = integration;

    // Pull git info if this is run via CLI
    if (require.main === module && !args.no_git) {

      if (fs.existsSync('.git/config')) {
        const gitConfig = fs.readFileSync('.git/config', { encoding: 'utf-8' });
        this.gitRepo = gitConfig.split('\n\t').find(config => config.includes('url')).trim().split('/').pop();

        if (fs.existsSync('.git/HEAD')) {
          const gitHEAD = fs.readFileSync('.git/HEAD', { encoding: 'utf-8' });
          this.gitBranch = gitHEAD.trim().split('refs/heads/').pop();
        }

        if (fs.existsSync('.git/logs/HEAD')) {
          let gitLogSha = fs.readFileSync('.git/logs/HEAD', { encoding: 'utf-8' });
          gitLogSha = gitLogSha.trim().split('\n');
          this.gitSha = gitLogSha.length > 0 ? gitLogSha[gitLogSha.length - 1].split(' ')[0] : '';
        }
      } else {
        console.error('Git config not found');
      }
    }

    if (args.overrides) {
      this.overrides = args.overrides;
    }

    // Parse the integration config files.
    try {
      let integrationSplit = this.integration.split(':');
      if (integrationSplit.length > 1) {
        if (integrationSplit.length > 2) {
          console.error(`Invalid local file integration [${this.integration}].`);
          process.exit();
        }
        this.integration = integrationSplit[1];
        if (fs.existsSync(this.integration)) {
          // Check if this is a custom type
          this.typeConfig = {
            name: integrationSplit[0],
            type: integrationSplit[0],
          };
        }
      } else {
        if (fs.existsSync(this.integration)) {
          this.typeConfig = JSON.parse(fs.readFileSync(`${this.integration}.json`));
        } else if (fs.existsSync(`${packageRoot}/configs/${this.integration}.json`)) {
          // Fall back to defaults
          this.typeConfig = JSON.parse(fs.readFileSync(`${packageRoot}/configs/${this.integration}.json`));
        } else if (this.integration) {
          console.error(`Integration config not found: ${this.integration}`);
          process.exit();
        }
      }
    } catch (err) {
      console.error(`Invalid integration config: ${err}`);
      process.exit();
    }

    // Ensure the "type" for the integration is valid.
    if (!this.typeConfig?.type) {
      console.error(`Missing 'type' for [${this.integration}]`);
      process.exit();
    } else {
      if (this.direction === 'source' &&
          !validSourceTypes.includes(this.typeConfig.type)) { 
        console.error(`Invalid source type: ${this.typeConfig.type}`);
        process.exit();
      }
      if (this.direction === 'target' &&
          !validTargetTypes.includes(this.typeConfig.type)) { 
        console.error(`Invalid target type: ${this.typeConfig.type}`);
        process.exit();
      }
    }

    if (!this.typeConfig.name) {
      console.error('Configuration file must specify a "name" to identify the service.');
      process.exit();
    }


    // Parse credentials file and ensure it matches expected data based on
    // type provided in the config
    if (credentialedTypes.includes(this.typeConfig.type)) {
      try {
        if (args.credentials && fs.existsSync(args.credentials)) {
          let creds = JSON.parse(fs.readFileSync(args.credentials));
          this.credentials = creds[this.integration][this.direction];
          this.baseUrl = creds[this.integration][this.direction].base_url;
        } else {
          let creds = JSON.parse(
            process.env[
              this.integration.toUpperCase() + '_' +
              this.direction.toUpperCase() + '_CREDENTIALS'
            ]
          );
          this.credentials = creds[this.direction];
          this.baseUrl = creds[this.direction].base_url;
        }

        if (!this.credentials && !this.baseUrl) {
          console.error(
            `Credentials missing for [${this.integration} - ${this.direction}]`
          );
          process.exit();
        }
      } catch (err) {
        console.error(`Issue reading ${this.integration} credentials: ${err}`);
        process.exit();
      }

      try {
        this.authSchema =
          auth.authSchemas[this.typeConfig.auth.type];
      } catch(err) {
        console.error('Invalid auth configuration: ' + err);
        process.exit();
      }

      // Build our credentials
      for (const key of this.authSchema.inputs) {
        if (!this.credentials[key]) {
          console.error(
            `Invalid credentials for ${this.integration} - ${this.direction}.` +
            `\n Missing input: ${key}`);
          process.exit();
        } else {
          let keyIndex = this.authSchema.payload.indexOf(key);
          if (keyIndex < 0) {
            console.error(`Key [${key}] not found in payload.`);
            process.exit();
          }
          // Do our substitutions to build the payload.
          this.authPayload =
            this.authSchema.payload.substring(0, keyIndex-1)
            + this.credentials[key]
            + this.authSchema.payload.substring(
              keyIndex+key.length+1, this.authSchema.payload.length
            );
        }
      }
    } 

    // Handle integration type specifics
    if (this.typeConfig.type === 'api') {
      if (this.typeConfig.requests_per_second) {
        if (isNaN(this.typeConfig.requests_per_second)) {
          console.error(
            `Invalid config "requests_per_second" on [${this.integration}] API.`
          );
        } else {
          this.throttleCap = this.typeConfig.requests_per_second;
        }
      }

      // Parse integration config and build dependency graph to determine
      //   access order
      var endpointOrder = [];
      var endpoints = [];
      if (args.dataTypes && args.dataTypes.length > 0) {
        //// If data types are specified, only check those endpoints.
        //for (const type of dataTypes) {
        //  endpoints[type] = this.typeConfig[this.direction][type];
        //} CTODO - remove if this works
        for (const type of args.dataTypes) {
          if (!this.typeConfig?.[this.direction]?.[type]) {
            console.error(
              `Invalid data type [${type}] for [${this.integration}]. Ignoring.`
            );
          } else {
            endpoints.push(type);
          }
        }
      } else {
        endpoints = Object.keys(this.typeConfig[this.direction]); 
      }

      if (defaultEndpoints[this.direction]) {
        for (const name of endpoints) {
          endpointOrder.push(...buildDependencyChain(
            this.typeConfig[this.direction],
            name,
            defaultEndpoints[this.direction]
          ));
        }
      } else {
        endpointOrder = endpoints;
      }

      if (endpointOrder.length < 1) {
        console.error(
          `No valid data types provided for [${this.integration}].`
        );
        process.exit();
      }

      endpointOrder.forEach(endpoint => {
        if (!this.endpointSet.includes(endpoint)) {
          this.endpointSet.push(endpoint);
        } 
      });
      this.progressIncrement = 100/this.endpointSet.size;

      // If incremental, get last offsets from target config
      for (const endpoint of this.endpointSet) {
        if (args.incremental) {
          // TODO
        } else {
          this.offsets[endpoint] = 0;
          // TODO use this
        } 
      } 
    } else if (this.typeConfig.type === 'junit') {
      // NOOP
    }

    // Parse the ignore file
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
  }
}

class PipeConfig {
  sourceConfigs = [];
  targetConfigs = [];

  constructor(args) {

    let sources = args.source.split(',');
    for (const source of sources) {
      this.sourceConfigs.push(new EndpointConfig(args, source, 'source'));
    }
    if (this.sourceConfigs.length < 1) {
      console.error('You must specify at least one data source.');
      process.exit();
    }

    let targets = args.target.split(',');
    for (const target of targets) {
      this.targetConfigs.push(new EndpointConfig(args, target, 'target'));
    }
    if (this.targetConfigs.length < 1) {
      console.error('You must specify at least one data target.');
      process.exit();
    }

  }
}

// Find all dependencies in chain
function buildDependencyChain(keyMap, name, endpointSelector) {
  let path = keyMap[name]?.endpoints?.[endpointSelector]?.path;
  path ||= keyMap[name]?.endpoints?.[endpointSelector]?.bulk_path;
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
      console.error('Unmatched brackets in API path: ' + name);
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
}
