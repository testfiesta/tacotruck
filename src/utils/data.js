function mapData (mapping, data) {
  let finalData = data;
  for (const mapKey of Object.keys(mapping)) {
    if (finalData[mapKey]) {
      finalData[mapping[mapKey]] = finalData[mapKey];
      delete finalData[mapKey];
    }
  }
  return finalData;
}

function buildRequestData (key, mapping, data) {
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
  buildRequestData
}; 
