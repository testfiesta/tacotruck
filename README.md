yatt-pipe
========
A tool for moving testing/quality data.

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

### TestRail
### Zephyr Scale
### TestComplete
### Xray
### Zephyr Cloud
