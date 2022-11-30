class BaseModel {
  source_id;
  target_id;
  external_id;

  created_at;

  name;
  custom_fields = {};


  constructor(
      name=undefined,
      source_id=undefined,
      target_id=undefined,
      created_at=undefined
  ) {
    this.name = name;
    this.source_id = source_id;
    this.target_id = target_id;
    this.created_at = created_at;
  }

  build(mapping, data, ignore={}) {
    for (const [key, value] of Object.entries(data)) {
      if (ignore[key]) {
        for (const regex of ignore[key]) {
          if (new RegExp(regex).test(value)) {
            return false;
          }
        }
      }
      if( mapping[key] && this.hasOwnProperty(mapping[key]) ) {
        this[mapping[key]] = value;
      } else {
        this.custom_fields[key] = value;
      }
    }
    return true;
  }

}

module.exports = BaseModel;
