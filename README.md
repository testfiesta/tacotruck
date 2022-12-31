yatt-pipe
========
A tool for moving testing/quality data.

# About
## Summary
`yatt-pipe` exists to make it easy to move quality data to wherever you need it. Whether you are looking to report test results to your various quality systems or trying to migrate historical databetween test case management tools, yatt-pipe provides a simple, easily extendable interface for doing so.

Since it's written in NodeJS, yatt-pipe can be utilized as either a JS module (link to NPM) or CLI tool (link to packages). Likewise, it has been conveniently packaged into a Docker container, GitHub Action, CircleCI Orb, etc.

Consider the following use-cases and examples:
- Reporting test results to Zephyr and YATT for test access and improved reporting. (See examples on [our GitHub](https://github.com/yatt-ai/).)
- Migrating data between TestRail and XRay to change TCM providers. `yatt-pipe` can be used to keep data in sync during and after test runs and migrate historical data from the original system.
- Programmatically uploading testing evidence and attachments to your TCM. This is what [YATTIE](https://docs.yattie.com) does.

## Integrations
Integrations are easy to create and customize with just a configuration file. Simply review the `configs/sample_config.json` file and default integrations to understand how to create your own.

By default, `yatt-pipe` currently supports:
|             | Data Sources | Data Targets |
|-------------|:------------:|:------------:|
| JIRA        |      X       |      X       |
| JUnit Files |      X       |              |
| TestRail    |      X       |      X       |
| YATT        |      X       |      X       |

For more info on how these work, see [Sources and Targets](#sources-and-targets).

## CLI Flags
  -c, --credentials
    required: false
    description: Path to credentials file for API connections. Credentials can also be passed via ENV variables (see [Authentication](#authentication)).

  -I, --ignore
    required: false
    description: Path to a config file specifying data on records to ignore (see [Ignoring Records](#ignoring-records)).

  -o, --overrides
    required: false
    description: JSON data to add onto the source data when exporting to the target (see [Data Overrides](#data-overrides).

  -s, --source
    required: Either source or target is required.
    description: Integration to pull data from.

  -t, --target
    required: Either source or target is required.
    description: Integration to push data to.

  -d, --data-types
    required: false
    description: Data type keys to use from source config. By default, data is pulled from all endpoints specified in the configuration. This list can be lmited with the `--data-types` parameter.

  --offset
    required: false
    description: Paging offset value.

  --limit
    required: false
    description: Paging limit value.

  --count
    required: false
    description: Maximum record count to return.

  --no-git
    required: false
    description: (CLI only) Don't include git repo information when reporting data.

  -v, --verbose

  --version


# Guides
## Download & Installation
### As a NodeJS package
```shell
$ npm i yatt-pipe
```
### As a CLI tool
Releases and packages [on GitHub](https://github.com/yatt-ai/yatt-pipe/releases).

1. Download the release appropriate for your OS/Architecture
2. Install it or save it on your system path
3. Call `yatt-pipe --help` from the terminal

### Usage on the CLI
`node index.js -c creds.json -s testrail -t yatt -o '{"cases":{"service":"microservice-1"}}'`
`node index.js -c creds.json -s junit:./results.xml -t yatt -o '{"cases":{"service":"microservice-1"}}'`

This will pull all (up to configured limits) data from a TestRail instance and push it into YATT.

The `creds.json` should look something like this:
```
{
  "testrail": {
    "source": {
      "base64Credentials": "eW91cmVtYWlsQGVtYWlsLmNvbTp5b3VycGFzc3dvcmQK",
      "base_url": "https://YourTestrailAccont.testrail.com/"
    }
  },
  "yatt": {
    "target": {
      "token": "yatt_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      "base_url": "http://localhost:5000/"
    }
  }
}
```
But replace the `base64Credentials` key with your email address, followed by a ":", followed by your TestRail password and then the whole string should be base64 encoded. Ex: `echo -n "myemail@email.com:mypassword" | base64 -w0` (*Don't forget the '-n' to remove the default new line added by 'echo'.*)

Then replace the YATT token with a valid YATT token for your YATT user.

Alternatively, you can supply credentials via ENV variables in the format:
```
${INTEGRATION NAME}_${DIRECTION}_CREDENTIALS <= Containing JSON with all credential info
```
e.g.:
```
TESTRAIL_SOURCE_CREDENTIALS='{"base64Credentials":"eW91cmVtYWlsQGVtYWlsLmNvbTp5b3VycGFzc3dvcmQK","base_url":"https://YourTestrailAccount.testrail.com/"}'
```

### Usage as a NodeJS Package
```javascript
const { pushData, pullData } = require("yatt-pipe");

const config = {
  "credentials": "./creds.json",
  "source": "testrail",
  "target": "testrail",
};

const pushableData = {
  "projects": [{
    "target_id": 1,
    "name": "API Proj",
    "announcement": "Test announcement!"
  }]
};

const pullableData = {
  "cases": [{
    "id": 1,
  },
  {
    "id": 2,
  }]
};

async function sendDataToTestRail(config, data) {
  try {
    const response = await pushData(config, data);
    console.log(response);
  } catch (error) {
    console.error(error);
  }
}

async function getDataFromTestRail(config, data) {
  try {
    const response = await pullData(config, data);
    console.log(response);
  } catch (error) {
    console.error(error);
  }
}


sendDataToTestRail(config, pushableData);
getDataFromTestRail(config, pullableData);
```

## Ignoring Data
Source data can be selectively ignored by `yatt-pipe` based off of data type and a provied JavaScript regex. (I recommend using something like [Regexr](https://regexr.com/) if you need to hone your regex for usage here.)

For example, if you want to ignore all "projects" with "Example" or "example" in their name, you could pass the following ignore JSON:
```
{
  "projects": {
    "name": [ "[Ee]xample" ]
  }
}
```

## Data Overrides
In addition to directly transferring data between the source and target, you can override or inject new data into the output with the override option and `-o` flag.

This data is injected directly into the data after all [translations](#translations) are completed - overwriting any duplicate keys that already exist and adding new keys when they don't exist.

For example - say your source data has some test "runs" that look like this:
```
{
  runs: [
    {
      "id": 1,
      "started_at": "2019-10-12T07:20:50.52Z",
      "ended_at": "2019-10-12T07:25:32.52Z
    },
    {
      "id": 2,
      "started_at": "2019-10-12T07:30:50.52Z",
      "ended_at": "2019-10-12T07:35:32.52Z
    }
  ]
}
```
If you want to inject the name of the instance that ran the jobs - say it's named "jenkins-runner-1".

You could provide the following override to accomplish this:
```
{
  "runs":{
    "runner":"jenkins-runner-1"
  }
}
```

The following data would then be sent to  your target:
```
{
  runs: [
    {
      "id": 1,
      "started_at": "2019-10-12T07:20:50.52Z",
      "ended_at": "2019-10-12T07:25:32.52Z
      "runner":"jenkins-runner-1"
    },
    {
      "id": 2,
      "started_at": "2019-10-12T07:30:50.52Z",
      "ended_at": "2019-10-12T07:35:32.52Z
      "runner":"jenkins-runner-1"
    }
  ]
}
```

# Sources and Targets
## About
The primary configuration options when using `yatt-pipe` are the data sources (where the data is coming _from_ - passed with the `-s` flag or in the `source` field) and data targets (where the data is going _to_ passed with the `-t` flag or in the `target` field). 

Default integrations can be used simply by referencing their name (e.g `-s testrail`) and [custom integrations](#custom-integrations) can be used by passing the relative path to their configuration file (e.g. `-s ./my-integration.json`).

Multiple sources and/or targets can be passed as a comma-delimited list.

File-type integrations such as JUnit results files must called with the format: `${type}:${relative_file_path}` (e.g. `-s junit:./test-results.xml`).

## Authentication
Authentication methods are specific to the various sources and targets you use. Further information can be found in the "Configuring" section of the [integrations](#included-integrations) you are using. 

### Configuring Credentials
Regardless of which type of authentication your integrations use, the credentials are always passed to `yatt-pipe` in one of two ways:
- Your credentials JSON can be stored in a configuration file, the path of which is passed to `yatt-pipe` via the `-c` option. (e.g. `-c ./my-creds.json`).
- Credential JSON can be stored in environment variables with the naming convention: `${INTEGRATION_NAME}_{INTEGRATION_DIRECTION}_CREDENTIALS`. (e.g. `TESTRAIL_SOURCE_CREDENTIALS` or `TESTRAIL_TARGET_CREDENTIALS`)

### Credentials JSON Format
While the auth information will vary by integration, the general format of the credentials JSON is:
```
{
  "${INTEGRATION_NAME}": {
    "${DIRECTION}": {
      "${AUTH_KEY_1}: ${AUTH_VALUE_1},
      "${AUTH_KEY_2}: ${AUTH_VALUE_2}
    }
  }
}
```

An example would be:
```
{
  "testrail": {
    "source": {
      "base64Credentials": "dXNlcm5hbWU6cGFzc3dvcmQ=",
      "base_url": "https://fake-instance.testrail.com/"
    }
  },
  "yatt": {
    "target": {
      "token": "yatt_99866737272422404.7f879e26fd76d09ce9ca263f9231f2cf",
      "base_url": "http://app.yatt.ai/"
    }
  }
}
```

## Included Integrations
### JIRA
#### Configuring
JIRA uses HTTP basic authentication with either a password or an [API token](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/#Create-an-API-token).

To configure with `yatt-pipe`, you must base64 encode your username followed by a colon (":") followed by your password or API key. In the terminal, you could run the following:
```
$ echo -n "username:password" | base64 -w0
dXNlcm5hbWU6cGFzc3dvcmQ=
```

You then would place this string ("dXNlcm5hbWU6cGFzc3dvcmQ=" in the example above) into the `base64Credentials` field in your credentials JSON. In the example above, if we wanted to use JIRA as a source for data, and our JIRA instance was located at 'fake-instance.atlassian.net', our credentials JSON would look like:
```
{
  "jira": {
    "source": {
      "base64Credentials": "dXNlcm5hbWU6cGFzc3dvcmQ=",
      "base_url": "https://fake-instance.atlassian.net/"
    }
  }
}
```

#### Supported Types
|             | Source | Target |
|-------------|:------:|:------:|
| Projects    |   X    |   X    |
| Issues      |   X    |   X    |
| Attachments |        |   X    |

### JUnit Files
#### Configuring
No configuration is required for JUnit files.
#### Supported Types
|             | Source | Target |
|-------------|:------:|:------:|
| Suites      |   X    |        |
| Runs        |   X    |        |
| Tests       |   X    |        |

### TestRail
#### Configuring
TestRail uses HTTP basic authentication with [either a password or an API token](https://support.gurock.com/hc/en-us/articles/7077039051284-Accessing-the-TestRail-API#authentication-0-0).

To configure with `yatt-pipe`, you must base64 encode your username followed by a colon (":") followed by your password or API key. In the terminal, you could run the following:
```
$ echo -n "username:password" | base64 -w0
dXNlcm5hbWU6cGFzc3dvcmQ=
```

You then would place this string ("dXNlcm5hbWU6cGFzc3dvcmQ=" in the example above) into the `base64Credentials` field in your credentials JSON. In the example above, if we wanted to use JIRA as a source for data, and our JIRA instance was located at 'fake-instance.atlassian.net', our credentials JSON would look like:
```
{
  "testrail": {
    "source": {
      "base64Credentials": "dXNlcm5hbWU6cGFzc3dvcmQ=",
      "base_url": "https://fake-instance.testrail.com/"
    }
  }
}
```

#### Supported Types
|             | Source | Target |
|-------------|:------:|:------:|
| Projects    |   X    |   X    |
| Suites      |   X    |   X    |
| Sections    |   X    |   X    |
| Cases       |   X    |   X    |
| Plans       |   X    |   X    |
| Runs        |   X    |   X    |
| Tests       |   X    |   X    |

### YATT
#### Configuring
YATT uses bearer token authentication with [tokens](https://docs.yatt.ai/api/authentication).

To configure with `yatt-pipe`, you must create a token and add it to your credentials JSON.

Your token goes into the `token` field in your credentials JSON. For example, if we wanted to use YATT as a target for data, and our token was "yatt_99866737272422404.7f879e26fd76d09ce9ca263f9231f2cf" then our credentials JSON would look like:
```
{
  "yatt": {
    "target": {
      "token": "yatt_99866737272422404.7f879e26fd76d09ce9ca263f9231f2cf",
      "base_url": "https://api.yatt.ai/"
    }
  }

```
#### Supported Types
|             | Source | Target |
|-------------|:------:|:------:|
| Projects    |   X    |   X    |
| Suites      |   X    |   X    |
| Sections    |   X    |   X    |
| Cases       |   X    |   X    |
| Plans       |   X    |   X    |
| Runs        |   X    |   X    |
| Tests       |   X    |   X    |
| Issues      |   X    |   X    |
| Repos       |        |   X    |
| Branches    |        |   X    |

## Custom Integrations
Custom API integrations can easily be created with just a few pieces of information:
- The authentication scheme
- The paging mechanism (if applicable)
- The API structure

All most custom integrations require is a simple JSON configuration file with the following format: (_Note: If you need further details, the definitive example lives in `configs/sample_config.json`._)
```
{
  "name": ...,        // The name to identify this integration
  "requests_per_second": 2, // Allows for rate limiting requests
  "base_path": "index.php?", // Base path for API to be appended to configured `base_url`.
  "paging": { ... },
  "auth": { ... },
  "source": { ... },
  "target": { ... }
}
```

### Paging
This section contains the parameters required for managing paging on API integrations.

Example:
```
  "paging": {
    "location": "response",
    "link_key": "_links.next",
    "options": {
      "location": "querystring",
      "limit": {
        "key": "limit",
        "value": "250"
      },
      "offset": {
        "key": "offset"
      }
    }
  },
```
| Key                   | Type / Options | Description |
|-----------------------|:--------------:|:-----------:|
| `location`            | `response`     | Where paging details are provided by source APIs. |
| `link_key`            | String         | The key in the response where paging details an be found. _Note: Sub keys in the JSON be nested with a `.`._    |
| `options.location`    | `querystring`  | Where paging details are passed to source APIs. |
| `options.limit.key`   | String         | The key used to pass a page limit to source APIs. |
| `options.limit.value` | Integer        | The actual limit integer for source APIs. |
| `optionsl.offset.key` | String         | They key used to pass a paging offset to source APIs. |

### Auth
This section contains the parameters required for managing authentication with API integrations.

Example:
```
  "auth": {
    "type": "basic"
  }
```
| Key    | Type / Options  | Description |
|--------|:---------------:|:-----------:|
| `type` | `basic`/`token` | The type of authentication required by the API. |

#### Basic
Basic auth uses HTTP basic auth. The auth JSON (either in the configuration file or the environment variable) requires one parameter: `base64Credentials`.

To determine the correct value for this paramter, you must base64 encode your username followed by a colon (":") followed by your password or API key. In the terminal, you could run something like the following:
```
$ echo -n "username:password" | base64 -w0
dXNlcm5hbWU6cGFzc3dvcmQ=
```
`dXNlcm5hbWU6cGFzc3dvcmQ=` is then the value for `base64Credentials`.

#### Token
Token auth uses HTTP bearer tokens. The auth JSON (either in the configuration file or the environment variable) requires one parameter: `token`.

The value for this parameter is your bearer token for the service.

### Source
A `source` integraiton provides all of the information required to connect to a data source API.

Example:
```
  "source": {
    "projects": {
      "data_key": "projects",
      "target": "projects",
      "endpoints": {
        "index": {
          "path": "api/v2/get_projects"
        },
        "get": {
          "path": "api/v2/get_project/{id}"
        }
      },
      "mapping": {
        "id": "source_id",
        "name": "name"
      },
      "limit": {
        "type": "count",
        "value": "1000"
      }
    }
  }
```

| Key    | Type / Options  | Description |
|--------------------------|:---------------:|:-----------:|
| {Endpoint Name}                              | String          | Within the source block, the first key is the name of the endpoint. (Above, it is "projects".) |
| `data_key`                                   | String          | This is the key in a response JSON where the data can be found. Often times, it is something like "entries". If the data is provided directly at the root of the response JSON (i.e. no metadata is included in the response), this can be left blank. |
| `target`                                     | String          | If we want to transform the name of the data type internally (rather than use the endpoint name), we can supply that value. |
| `endpoints`                                  | Map             | In this key, we can specify the various types of endpoints (e.g. endpoints for listing all data or individual data points). |
| `endpoints.index.path`/`endpoints.show.path` | String          | This is the API path for the endpoint/type combination. |
| `mapping`                                    | Map             | This field allows us to map values to other values in the internal representation of the data (e.g. If we want to change the `id` field to be named `source_id`. |
| `limit`                                      | Map             | This is the limit on the number of records to pull. |
| `limit.type`                                 | `count`/`match` | This specifies whether our limit is a raw count of records or continuing until we match a provided `id`. |
| `limit.value`                                | Integer/String  | The number of records or matching ID. _Note: IDs are specified by the format `{field_name_to_match}:{id}`. e.g.: `id:1234`.|


### Target
A `target` integraiton is substantially similar to a `source` integration - it provides all of the information required to connect to a data target API.

Example:
```
  "target": {
    "projects": {
      "target": "projects",
      "endpoints": {
        "create": {
          "single_path": "api/v2/add_project",
          "required": ["name"]
        },
        "update": {
          "path": "api/v2/update_project/{id}",
          "required": ["id", "name"],
          "update_key": "id"
        }
      }
    }
  }

```
| Key    | Type / Options  | Description |
|--------------------------|:---------------:|:-----------:|
| {Endpoint Name}                                                                     | String          | Within the source block, the first key is the name of the endpoint. (Above, it is "projects".) |
| `target`                                                                            | String          | If we want to transform the name of the data type from what the internal representation (usually the endpoint name), we can supply that value. |
| `endpoints`                                                                         | Map             | In this key, we can specify the various types of endpoints (e.g. endpoints for creating new data versus updating current data points). |
| `endpoints.create.single_path`/`endpoints.create.bulk_path`/`endpoints.update.path` | String          | This is the API path for the endpoint/type combination. |
| `endpoints.create.required`/`endpoints.update.required`                             | List          | A list of required fields to create/update data. |
| `endpoints.create.data_key`                                                         | String          | This is the key in a POST JSON where the data can be found. Often times, it is something like "entries". This only applies to bulk creation endpoints. |
| `endpoints.update.update_key`                                                       | String          | The key used to identify which data to update (e.g. the `id`). |
| `mapping`                                                                           | Map             | This field allows us to map values to other values in the internal representation of the data (e.g. If we want to change the `id` field to be named `source_id`. |

