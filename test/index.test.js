const { expect } = require('chai');
const { getData, putData } = require('../index');
const credentials = require('../creds.json');

describe('Call to get data from remote service or put data to it', function() {
  it('should return the error your credentials missing when do not send credentials', async () => {
    try {
      await getData('projects', { source: 'testrail' });  
    } catch (err) {
      expect(err).to.equal('You must provide your testrail credentials.');
    }
  });

  it('should return the error service missing when sending an incorrect source', async () => {
    try {
      await getData('projects', { source: 'xray', credentials });
    } catch (err) {
      expect(err).to.equal('Service configuration file api_configs/xray.json is missing.');
    }
  });

  it('should return the error unsupported test type when sending an incorrect test type', async () => {
    try {
      await getData('nodejs', { source: 'testrail', credentials });
    } catch (err) {
      expect(err).to.equal('Unsupported type for data retrieval: nodejs. Please check your source config for testrail.');
    }
  });

  it('should return the error missing field projects_id when get list plan', async () => {
    try {
      await getData('plans', { source: 'testrail', credentials })
    } catch (err) {
      expect(err).to.equal('You missing param projects_id.');
    }
  });

  it('should return the error missing key in credentials when sending an incorrect credentials', async () => {
    try {
      await getData('plans', { source: 'testrail', credentials: {}, projects_id: 1 })
    } catch (err) {
      expect(err).to.equal('Credentials missing key base64Credentials.');
    }
  });

  it('should return the error missing field name when create new projects', async () => {
    try {
      const custom_fields = {
        announcement: "Welcome to project Yatt",
        show_announcement: true
      };
  
      await putData('projects', { target: 'testrail', credentials, custom_fields });
    } catch (err) {
      expect(err).to.equal('You missing param name.');
    }
  });

  it('should return the error missing field name when update projects', async () => {
    try {
      const custom_fields = {
        announcement: "Welcome to project Yatt",
        show_announcement: true
      };
  
      await putData('projects', { target: 'testrail', credentials, custom_fields, external_id: 1 });
    } catch (err) {
      expect(err).to.equal('You missing param name.');
    }
  });

  it('should return the error missing field name when create suites', async () => {
    try {
      const custom_fields = {};

      await putData('suites', { target: 'testrail', credentials, custom_fields });
    } catch (err) {
      expect(err).to.equal('You missing param name.');
    }
  });

  it('should return the error missing field projects_id when create suites', async () => {
    try {
      const custom_fields = {
        name: 'New suite Yatt'
      };

      await putData('suites', { target: 'testrail', credentials, custom_fields });
    } catch (err) {
      expect(err).to.equal('You missing param projects_id.');
    }
  });
});