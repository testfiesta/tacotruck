const axios = require('axios');
const configUtils = require('../utils/configuration.js');
const xUnitParser = require('../utils/xUnitParser.js');


async function pullData(config, ids={}) {
  // TODO - Pulling individual data points with `ids` is not currently supported
  //config.progressBar.start(200, 0);
  // Pull data
  let data = new xUnitParser()
    .parseFile(config);

   
  return data;
}

function pushData(conf, data) {
  console.log('Invalid target config: Data cannot be pushed into xUnit format');
  process.exit();
}

module.exports = {
  pullData,
  pushData,
};
