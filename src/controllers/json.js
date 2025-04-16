const fs = require('fs');


async function pullData(config, ids = {}) {
  try {
    const fileContent = fs.readFileSync(config.integration);
    let data;

    try {
      data = JSON.parse(fileContent);
    } catch (error) {
      throw new Error(`Error parsing JSON: ${error.message}`);
    }

    if (typeof data !== 'object' || data === null) {
      throw new Error(`Invalid file content in ${config.integration}`);
    }

    if (!data) {
      throw new Error(`No data found in file: ${config.integration}`);
    }

    return data;
  } catch (error) {
    console.error(error.message);
    process.exit();
  }
}

module.exports = {
  pullData,
};
