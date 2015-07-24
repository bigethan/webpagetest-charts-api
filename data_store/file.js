/*
 * Given a test result data, save it.
 * Asked for a test result, retrieve it.
 */

var debug   = require('debug')('wpt-api:data_store');
var moment  = require('moment');
var request = require('request');
var mkdirp  = require('mkdirp');
var fs      = require('fs');
var path    = require('path');
var jf      = require('jsonfile');
var os      = require('os');
var junk    = require('junk');
var async   = require('async');

//this should probably come from config
var resultsPath = 'public' + path.sep + 'results' + path.sep;

dataStore = {

  /*
   * Given a test and some results, save to the file system:
   * the json
   * filmstrip image
   * waterfall image
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
      , datePath = moment().format('YYYY-MM-DD-HH-mm-ss')
      , datapointPath = test.suiteId + path.sep + test.testId + path.sep + datePath
      , datapointDir  = resultsPath + datapointPath
      ;

    //make the new dir structure
    mkdirp.sync(datapointDir);

    //save the json test data to a file
    jf.writeFile(datapointDir + path.sep + 'results.json', results, function(err) {
      if (err) console.error(err);
    });

    debug('Saved results for ' + response.testUrl);

  },

  getDatapoint: function getDatapoint_anon(suiteId, testId, datapointId, callback) {

    fs.readdir(resultsPath + suiteId + path.sep + testId, function(err, tests){
      if (err || !tests) {
        debug('no tests found for datapoint: ' + suiteId + ' - ' + testId + ' - ' + datapointId);
        callback({});
        return;
      }
      tests = tests.filter(junk.not);
      var testIndex = tests.indexOf(datapointId)
      , testDir = resultsPath + suiteId + path.sep + testId + path.sep + tests[testIndex] + path.sep
      , data = {}
      , resourceBase = '/results/' + suiteId + '/' + testId + '/' + datapointId + '/'
      ;

      jf.readFile(testDir + 'results.json', function(err, jsonResults){
        data = {
          datapointId: datapointId,
          suiteId: suiteId,
          testId: testId,
          jsonLink: resourceBase + 'results.json',
          testResults: jsonResults,
          testDate: tests[testIndex],
          nextTest: testIndex < tests.length - 1 ?  {suiteId: suiteId, testId: testId, datapointId: tests[testIndex + 1]} : null,
          prevTest: testIndex > 0 ? {suiteId: suiteId, testId: testId, datapointId: tests[testIndex - 1]} : null,
        };
        callback(data);
      });
    });
  },

  /*
   * Return the data for a suite of tests
   */
  getSuite: function getSuite_anon (suiteId, callback) {
    debug("getting suite: " + suiteId);

    var suiteDir = resultsPath + suiteId;
    fs.readdir(suiteDir, function(err, testDirsRaw){
      var testDirs = testDirsRaw.filter(junk.not);

      suite = {
        suiteId: suiteId,
        tests: testDirs
      };

      callback(suite);
    });
  },

  getSuiteTest: function getSuiteTest_anon (suiteName, testName, callback) {

    debug("getting suite test: " + suiteName + ' - ' + testName);

    var suiteTests = {
      suite: suiteName,
      testName: testName,
      datapoints: []
    };

    var testDirBase = resultsPath + suiteName + path.sep + testName;

    fs.readdir(testDirBase, function(err, testDirs){
      var testDirs = testDirs.filter(junk.not);
      async.map(testDirs, function(testDir, asyncCallback){
        jf.readFile(testDirBase + path.sep + testDir + path.sep + 'results.json', function(err, jsonData){
          var datapoint = {
                datapointId: testDir,
                data: jsonData.data
              }
            ;
          suiteTests.datapoints.push(datapoint);
          asyncCallback();
        });
      }, function(){
        callback(suiteTests);
      });

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
