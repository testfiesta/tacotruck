const BaseModel = require('./base.js');

class TestRun extends BaseModel {

  updated_at;

  constructor(updated_at=undefined) {
    super();
    this.updated_at = updated_at;
  }
}

module.exports = TestRun;
