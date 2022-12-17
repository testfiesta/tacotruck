function mapData(mapping, data) {
  let finalData = data;
  for (const mapKey of Object.keys(mapping)) {
    if (finalData[mapKey]) {
      finalData[mapping[mapKey]] = finalData[mapKey];
      delete finalData[mapKey];
    }
  }
  return finalData;
}

function mapDataWithIgnores(mapping, data, ignore={}) {
  for (const [key, value] of Object.entries(data)) {
    if (ignore[key]) {
      for (const regex of ignore[key]) {
        if (new RegExp(regex).test(value)) {
          return false;
        }
      }
    }
  }
  return mapData(mapping, data);
}

function buildRequestData(key, mapping, data) {
  let finalData = mapData(mapping, data);
  if (key && key !== "") {
    return {
      [key]: finalData
    };
  } else {
    return finalData;
  }
}

module.exports = {
  mapData,
  mapDataWithIgnores,
  buildRequestData
}; 
