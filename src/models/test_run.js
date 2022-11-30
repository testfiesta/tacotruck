const BaseModel = require('./base.js');

class TestRun extends BaseModel {

  updated_at;

  constructor(uid, updated_at=undefined) {
    super();
    this.updated_at = updated_at;
    this.external_id = uid;
  }
}

module.exports = TestRun;
