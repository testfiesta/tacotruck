yatt-pipe
========
A tool for moving testing/quality data.

## Download & Installation

```shell
$ npm i yatt-pipe
```

## Guides
### CLI Usage
`node index.js -c creds.json -s testrail -T api -t yatt -p`

This will pull all (up to configured limits) data from a TestRail instance and push it into YATT.

The `creds.json` should look something like this:
```
{
  "source": {
    "base64Credentials": "eW91cmVtYWlsQGVtYWlsLmNvbTp5b3VycGFzc3dvcmQK",
    "base_url": "https://YourTestrailAccont.testrail.com/"
  },
  "target": {
    "token": "yatt_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "base_url": "http://localhost:5000/"
  }
}
```
But replace the `base64Credentials` key with your email address, followed by a ":", followed by your TestRail password and then the whole string should be base64 encoded. Ex: `echo -n "myemail@email.com:mypassword" | base64 -w0` (*Don't forget the '-n' to remove the default new line added by 'echo'.*)

Then replace the YATT token with a valid YATT token for your YATT user.

### Code Usage
```javascript
const { pushData } = require("yatt-pipe");

const config = {
  "credentials": "./creds.json",
  "target": "yatt",
  "targetType": "api",
};

const pushableData = {
  "executions": [{
    "id": 123,
    "source": "testrail",
    "custom_fields": {
      "suite_id": 456,
      "status": "success"
    }
  }]
};

const pullableData = {
  "executions": [{
    "id": 123,
    }
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
    const response = await pushData(config, data);
    console.log(response);
  } catch (error) {
    console.error(error);
  }
}


sendDataToTestRail(config, pushableData);
record = await getDataFromTestRail(config, pullableData);
```

### TestRail
### Zephyr Scale
### TestComplete
### Xray
### Zephyr Cloud
