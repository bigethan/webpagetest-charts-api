/*
 * Given a test result jsonresults, save it.
 * Asked for a test result, retrieve it.
 */

var debug   = require('debug')('wpt-api:data_store');
var moment  = require('moment');
var async   = require('async');
var db = require('any-db');

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

    //trim results data, the JSON is too big
    //for this sync file system based
    //dataStore implementation.
    try {
      delete results.data.average;
      delete results.data.median;
      delete results.data.standardDeviation;
      delete results.data.runs[1].firstView.requests;
      delete results.data.runs[1].repeatView.requests;
    } catch(e) {
      debug('ran into trouble deleting extra data.');
    }

    var response = results.data
      , testId = test.testId
      , suiteId = test.suiteId
      , conString = config.conString
      , conn = new db.createConnection(conString)
      , insertQuery = "\
        INSERT INTO \
          webpagetestcharts \
          (jsonresults, \
           date, \
           testid, \
           suiteid) \
        VALUES \
          ('" + JSON.stringify(results) + "', \
          'now()', \
          '" + testId + "', \
          '" + suiteId + "')"
      ;


      conn.query(insertQuery, function(err, result) {
        if(err) {
          return console.error('error running query:' + insertQuery, err);
        }
        debug('Saved results for ' + response.testUrl);
      });
  },

  getDatapoint: function getDatapoint_anon(suiteId, testId, datapointId, callback) {

    var data = {}
     , pageString
     , conString = config.conString
     , conn = new db.createConnection(conString)
     , testQuery = " \
       SELECT * \
       FROM webpagetestcharts \
       WHERE datapointid = '" + datapointId + "' \
       AND suiteid = '" + suiteId + "' \
       AND testid = '" + testId + "' \
       UNION ALL \
       (SELECT * \
         FROM webpagetestcharts \
         WHERE datapointid < '" + datapointId + "' \
         AND suiteid = '" + suiteId + "' \
         AND testid = '" + testId + "' \
         ORDER BY datapointid \
         DESC limit 1) \
       UNION ALL \
       (SELECT * \
         FROM webpagetestcharts \
         WHERE datapointid > '" + datapointId + "' \
         AND suiteid = '" + suiteId + "' \
         AND testid = '" + testId + "' \
         ORDER BY datapointid \
         ASC limit 1) "
     ;

       conn.query(testQuery, function(err, result) {
         if(err) {
           return console.error('error running query: ' + testQuery, err);
         }
         debug('fetched results for ' + datapointId);

         data = {
           datapointId: result.rows[0].datapointid,
           suiteId: result.rows[0].suiteid,
           testId: result.rows[0].testid,
           testResults: JSON.parse(result.rows[0].jsonresults)
         };

         //next result?
         if (result.rows[1]) {
           pageString = 'nextTest';
           if (result.rows[1].datapointid < result.rows[0].datapointid) {
             pageString = 'prevTest';
           }
           data[pageString] = {
             suiteId: result.rows[1].suiteid,
             testId: result.rows[1].testid,
             datapointId: result.rows[1].datapointid
           };
         }

         //prev result?
         if (result.rows[2]) {
           pageString = 'nextTest';
           if (result.rows[2].datapointid < result.rows[0].datapointid) {
             pageString = 'prevTest';
           }
           data[pageString] = {
             suiteId: result.rows[2].suiteid,
             testId: result.rows[2].testid,
             datapointId: result.rows[2].datapointid
           };
         }

         callback(data);
       });
  },

  /*
   * Return the data for a suite of tests
   */
  getSuite: function (suiteId, callback) {
    debug("getting suite: " + suiteId);

    var data
     , conString = config.conString
     , conn = new db.createConnection(conString)
     , testQuery = " \
        SELECT \
         DISTINCT testid as test \
        FROM \
          webpagetestcharts \
        WHERE \
          suiteid = '" + suiteId + "'"
     ;

       var query = conn.query(testQuery, function(err, result) {
         if(err) {
           return console.error('error running query', err);
         }
         debug('fetched results for ' + suiteId);

         data = {
           suiteId: suiteId,
           tests: result.rows.map(function(r){ return r.test; })
         };
         callback(data);
       });
  },

  getSuiteTest: function getSuiteTest_anon(suiteId, testId, callback) {

    var data = {
          suite: suiteId,
          testName: testId,
          datapoints: []
       }
     , conString = config.conString
     , conn = new db.createConnection(conString)
     , testsQuery = " \
        SELECT \
         jsonresults, \
         date, \
         datapointid, \
         testid, \
         suiteid \
        FROM \
          webpagetestcharts \
        WHERE \
          suiteid = '" + suiteId + "' \
        AND \
          testid = '" + testId + "' \
        ORDER BY \
          date ASC"
     ;

    var query = conn.query(testsQuery, function(err, result) {
     if(err) {
       return console.error('error running query', err);
     }
     debug('fetched results for ' + suiteId + ' - ' + testId);

     result.rows.forEach(function(row){
       datapoint = {
         datapointId: row.datapointid,
         data: JSON.parse(row.jsonresults).data,
       };
       data.datapoints.push(datapoint);
     })

     callback(data);
    });
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
