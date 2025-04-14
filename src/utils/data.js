function mapData(mapping, data) {
  let finalData = data;
  for (const mapKey of Object.keys(mapping)) {
    if (finalData[mapKey]) {
      finalData[mapping[mapKey]] = finalData[mapKey];
      if (mapKey !== mapping[mapKey]) {
        delete finalData[mapKey];
      }
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
    // Update to use the key inside the entity object.
    // For example: { executions: { entries: [] } } — here, "entries" is the key.
    return Object.keys(finalData).reduce((acc, curr) => {
      acc[curr] = {
        [key]: finalData[curr]
      }
    return acc
    }, {})

  } else {
    return finalData;
  }
}

module.exports = {
  mapData,
  mapDataWithIgnores,
  buildRequestData
}; 
