yatt-pipe
========
A tool for moving testing/quality data.

## Download & Installation

```shell
$ npm i yatt-pipe
```
## Guides
A sample run via CLI: `node index.js -c creds.json -s testrail -T api -t yatt`

The `credis.json` should look something like this:
```
{
  "source": {
    "base64Credentials": "eW91cmVtYWlsQGVtYWlsLmNvbTp5b3VycGFzc3dvcmQK",
    "base_url": "https://YourTestrailAccont.testrail.com/"
  },
  "target": {
    "token": "yatt_99866737272422404.7f879e26fd76d09ce9ca263f9231f2cf",
    "base_url": "http://localhost:5000/"
  }
}
```
But replace the `base64Credentials` key with your email address, followed by a ":", followed by your TestRail password and then the whole string should be base64 encoded. Ex: `echo -n "myemail@email.com:mypassword" | base64 -w0` (*Don't forget the '-n' to remove the default new line added by 'echo'.*)

Then replace the YATT token with a valid YATT token for your YATT user.

## Example run CLI
```
npx yatt-pipe -c creds.json -s testrail -T api -t yatt
```
## Code Demo
```html
const { push } = require("yatt-pipe");

const dataCredentials = {
  "source": {
    "base64Credentials": "API_KEY_YOUR_TESTRAIL",
    "base_url": "YOUR_TESTRAIL_URL"
  },
  "target": {
    "token": "TARGET_TOKEN",
    "base_url": "TARGET_URL"
  }
};

async function test() {
  try {
    const response = await push(dataCredentials);
    console.log(response);
  } catch (error) {
    console.error(error);
  }
}

test();
```

## Supported Source:
### TestRail (supported)
### Zephyr Scale
### TestComplete
### Xray
### Zephyr Cloud
