var pg = require('pg');

/*
 * Given a test result data, save it.
 * Asked for a test result, retrieve it.
 */

var debug   = require('debug')('wptc:data_store');
var moment  = require('moment');
var async   = require('async');
var config  = {conString: 'postgres://bigethan:@localhost/bigethan'}

dataStore = {

  /*
   * Given a test and some results, save to the db:
   * the json
   * for the intial view and the refresh view.
   */
  saveDatapoint: function saveDatapointTest_anon(test, results) {

    //the internet is flaky sometimes
    if (!goodTestResults(results)){
      console.error('Test Died on: ' + results.data.testUrl);
      return;
    }

    var response = results.data
      , testId = test.testId
      , suiteId = test.suiteId
      , conString = config.conString
      , client = new pg.Client(conString)
      , insertQuery = "\
        INSERT INTO \
          webpagetestcharts \
          (data, \
           date, \
           datapointid, \
           testid, \
           suiteid) \
        VALUES \
          ('" + JSON.stringify(response) + "', \
          'now()', \
          DEFAULT, \
          '" + testId +"', \
          '" + suiteId +"')"
      ;

    client.connect(function(err) {
      if(err) {
        return console.error('could not connect to postgres', err);
      }

      client.query(insertQuery, function(err, result) {
        if(err) {
          return console.error('error running query:' + insertQuery, err);
        }
        client.end();
        debug('Saved results for ' + response.testUrl);
      });
    });




  },

  getDatapoint: function getTestData_anon(suiteId, testId, datapointId, callback) {

    var data = {foo: 'bar'}
     , complete = false
     , nextTest
     , prevTest
     , conString = config.conString
     , client = new pg.Client(conString)
     , testQuery = " \
        SELECT \
         data, \
         date, \
         datapointid, \
         testid, \
         suiteid \
         LEAD(i.id) OVER (ORDER BY i.datapointid DESC) AS nextitemid,
         LAG(i.id) OVER (ORDER BY i.datapointid DESC) AS previtemid,
        FROM \
          webpagetestcharts \
        WHERE \
          datapointid = '" + datapointId + "'"
     ;

      client.connect(function(err) {
         if(err) {
           return console.error('could not connect to postgres', err);
         }

         var query = client.query(testQuery, function(err, result) {
           if(err) {
             return console.error('error running query', err);
           }
           debug('fetched results for ' + datapointId);
           client.end();
           data = {
             datapointId: result.rows[0].datapointid,
             suiteId: result.rows[0].suiteid,
             testId: result.rows[0].testid,
             testResults: result.rows[0].data,
           };
           callback(data);
         });
       });
  },

  /*
   * Return the data for a suite of tests
   */
  getSuite: function (suiteId, callback) {
    debug("getting suite: " + suiteId);

    suite = {
      suite: suiteName,
      tests: testDirs
    };

    var suite = {foo: 'bar'}
     , conString = config.conString
     , client = new pg.Client(conString)
     , testQuery = " \
        SELECT \
         DISTINCT testid as tests \
        FROM \
          webpagetestcharts \
        WHERE \
          suiteid = '" + suiteId "'"
     ;

      client.connect(function(err) {
         if(err) {
           return console.error('could not connect to postgres', err);
         }

         var query = client.query(testQuery, function(err, result) {
           if(err) {
             return console.error('error running query', err);
           }
           debug('fetched results for ' + datapointId);
           client.end();
           suite = {
             suiteId: suiteId,
             tests: result.rows[0].tests
           };
           callback(data);
         });
       });
  },

  getSuiteTest: function getChartData_anon (suiteName, testName) {

    debug("getting suite test: " + suiteName + ' - ' + testName);

    suiteTests = {
      suite: suiteName,
      testName: testName,
      datapoints: []
    };

    var testDirBase = resultsPath + suiteName + path.sep + testName;

    testDirs = fs.readdirSync(testDirBase).filter(junk.not);
    testDirs.forEach(function(testDir){
      var datapoint = {
            id: testDir,
            //sync to keep the array of results in order. lil lazy/slow
            data: jf.readFileSync(testDirBase + path.sep + testDir + path.sep + 'results.json').data
          }
        ;
      suiteTests.datapoints.push(datapoint);
    });
    return suiteTests;
  }
};


module.exports = dataStore;

/*
 * An overly verbose debugged method for helping
 * with occasional network service inconsistencies
 */
function goodTestResults (results) {
    var msg = 'goodTestResults suceeeded'
      , res = true
      ;

    if (!results.data.runs[1]) {
      msg = 'no results.data.runs[1]';
      res = false;
    } else if (!results.data.runs[1].firstView) {
      msg = 'no results.data.runs[1].firstView';
      res = false;
    } else if (!results.data.runs[1].repeatView) {
      msg = 'no results.data.runs[1].repeatView';
      res = false;
    } else if (!results.data.runs[1].firstView.images) {
      msg = 'no results.data.runs[1].firstView.images';
      res = false;
    } else if (!results.data.runs[1].repeatView.images) {
      msg = 'no results.data.runs[1].repeatView.images';
      res = false;
    } else if (!results.data.runs[1].firstView.SpeedIndex) {
      msg = 'no results.data.runs[1].firstView.SpeedIndex';
      res = false;
    } else if (!results.data.runs[1].repeatView.SpeedIndex) {
      msg = 'no results.data.runs[1].repeatView.SpeedIndex';
      res = false;
    }

    debug(msg);
    debug(results);
    return res;
}
