const authSchemas = {
  "basic": {
    "inputs": ["base64Credentials"],
    "location": "header",
    "key": "Authorization",
    "payload": "Basic {base64Credentials}"
  }
};

module.exports = {
  authSchemas
}; 
