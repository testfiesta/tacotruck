yatt-pipe
========
A tool for moving testing/quality data.

## Download & Installation

```shell
$ npm i yatt-pipe
```

## Guides
### CLI Usage
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
TESTRAIL_SOURCE_CREDENTIALS='{"base64Credentials":"eW91cmVtYWlsQGVtYWlsLmNvbTp5b3VycGFzc3dvcmQK","base_url":"https://YourTestrailAccont.testrail.com/"}'
```

// CTODO - Update from test
### Code Usage
```javascript
const { pushData, pullData } = require("yatt-pipe");

const config = {
  "credentials": "./creds.json",
  "source": "testrail",
  "target": "testrail",
  "source_type": "api",
  "target_type": "api",
};

const pushableData = {
  "projects": [{
    "target_id": 5,
    "name": "API Proj 2z",
    "announcement": "Test"
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

### Flags
  -c, --credentials
    required: false
    description: Path to credentials file for API connections.

  -i, --incremental
    required: false
    description: Only pull incremental data based on the last ID uploaded to target

  -I, --ignore
    required: false
    description: Path to a config file specifying source records to ignore.

  -o, --overrides
    required: false
    description: JSON data to include in target data

  -s, --source
    required: on CLI

  -t, --target
    required: on CLI

  -d, --data-types
    required: false
    description: Data type keys to use from source config

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

  -v, --verbose

  --version


### TestRail
### Zephyr Scale
### TestComplete
### Xray
### Zephyr Cloud
