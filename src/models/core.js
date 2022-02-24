const TestProject = require('./test_project.js');
const TestSuite = require('./test_suite.js');
const TestCase = require('./test_case.js');
const TestRun = require('./test_run.js');
const TestPlan = require('./test_plan.js');
const TestExecution = require('./test_execution.js');

const modelTypes = {
  "projects": TestProject,
  "suites": TestSuite,
  "cases": TestCase,
  "runs": TestRun,
  "plans": TestPlan,
  "executions": TestExecution
};

module.exports = {
  TestProject,
  TestSuite,
  TestCase,
  TestRun,
  TestPlan,
  TestExecution,
  modelTypes
}; 
