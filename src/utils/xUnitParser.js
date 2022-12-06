const crypto = require('crypto');
const fs = require('fs');
const models = require('../models/core.js');
const xmlParser = require('xml2js-parser').parseStringSync;

function collapse(inputData) {
  const data = {};

  if (typeof inputData === 'string') {
    return inputData;
  }
  if (Array.isArray(inputData)) {
    if (inputData.length === 1 && Object.keys(inputData[0]).length === 0) {
      return inputData[0];
    }
    if (inputData.length == 1 && typeof inputData[0] === 'string') {
      return inputData[0];
    }
    if (inputData.length > 1) {
      return inputData.map(element => collapse(element));
    }

    const keys = Object.keys(inputData[0]);
    if (keys.some(key => key !== '' + parseInt(key))) {
      return collapse(inputData[0]);
    }
    return keys.sort((a, b) => parseInt(b) - parseInt(a)).reduce((prev, cur) => prev + cur).trim();
  }

  Object.keys(inputData).forEach(key => {
    const value = inputData[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (key === '$') {
        Object.assign(data, collapse(value));
      } else {
        data[key] = collapse(value);
      }
    } else if (Array.isArray(value)) {
      if (key === 'error' && value.length > 0 && typeof value[0] === 'object' && value[0]['$']) {
        data[key] = {
          message: value[0]['$']['message'],
          '$t': (value[0]['_'] || '').trim(),
        };
      } else if (key === 'system-out' && value.length > 0) {
        data[key] = value[0].trim();
      } else if (['properties', 'skipped'].includes(key) && value.length === 1) {
        data[key] = typeof value[0] === 'string' ? value[0].trim() : collapse(value[0]);
      } else {
        data[key] = collapse(value);
      }
    } else {
      data[key] = value;
    }
  });
  return data;
}

function parseJSONData(data, ignoreConfig, config) {
  const testRunId = crypto.randomUUID();
  let newTestRun = new models.TestRun();
  newTestRun.source_id = testRunId;
  let parsedData = { suites: [], executions: [], runs: [] };
  parsedData.runs.push(newTestRun);
  let suiteData = data.testsuites || (data.testsuite || []);
  if (data.testsuites && !data.testsuites.testsuite) {
      suiteData = [];
  }
  if (data.testsuites && data.testsuites.testsuite) {
      suiteData = data.testsuites.testsuite;
  }

  for (suite of suiteData) {
    let caseData = suite.testcase || [];
    if (caseData && !Array.isArray(caseData)) {
      caseData = [caseData];
    }
    delete suite.testcase;
    let newTestSuite = new models.TestSuite();
    newTestSuite.custom_fields["test_run_id"] = testRunId;
    if (config.gitRepo) {
      newTestSuite.custom_fields["git_repo"] = config.gitRepo;
      newTestSuite.custom_fields["git_branch"] = config.gitBranch;
      newTestSuite.custom_fields["git_sha"] = config.gitSha;
    }
    let suiteBuilt = newTestSuite.build(
      xUnitParser.TEST_SUITES_MAPPING,
      suite,
     ( ignoreConfig ? ignoreConfig["testsuites"] : {} )
    );

    if (suiteBuilt) {
      if (!newTestSuite.source_id) {
        newTestSuite.source_id = "yatt-pipe_" + crypto.randomBytes(12).toString('hex');
      } // TODO - Do something with this ID to pull things together.
      parsedData.suites.push(newTestSuite);

      for (tcase of caseData) {
        let newTestCase = new models.TestCase()
        newTestCase.custom_fields["test_suite_id"] = newTestSuite.source_id;
        newTestCase.custom_fields["test_run_id"] = testRunId;
        if (config.gitRepo) {
          newTestCase.custom_fields["git_repo"] = config.gitRepo;
          newTestCase.custom_fields["git_branch"] = config.gitBranch;
          newTestCase.custom_fields["git_sha"] = config.gitSha;
        }
        let caseBuilt = newTestCase.build(
          xUnitParser.TEST_CASES_MAPPING,
          tcase,
          ( ignoreConfig ? ignoreConfig["testcases"] : {} )
        );
        if (caseBuilt) {
          parsedData.executions.push(newTestCase);
        }
      }
    }
  }

  return parsedData;
}

class xUnitParser {

  static TEST_SUITES_MAPPING = {
        name: "name",
        timestamp: "created_at"
  };

  static TEST_CASES_MAPPING = {
        name: "name",
  };

  parseFile(path, ignoreConfig, config) {
    return parseJSONData(collapse(xmlParser(fs.readFileSync(path))), ignoreConfig, config);
  }

}

module.exports = xUnitParser;
