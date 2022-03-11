const authSchemas = {
  "basic": {
    "inputs": ["base64Credentials"],
    "location": "header",
    "key": "Authorization",
    "payload": "Basic {base64Credentials}"
  },
  "bearer": {
    "inputs": ["token"],
    "location": "header",
    "key": "Authorization",
    "payload": "Bearer {token}"
  },
};

module.exports = {
  authSchemas
}; 
