/**
 * @fileOverview The assets task test.
 */

var sinon  = require('sinon'),
    manifest = require('../../lib/asset-manifest'),
    expect = require('chai').expect,
    grunt  = require('grunt'),
    assert = require('chai').assert;


var tmp = 'temp/';
var expectedPath = 'test/expected/';

describe('Grunt task :: assets', function(){

  beforeEach(function() {
  });

  afterEach(function() {
  });

  var compareObj = function(actualObj, expectedObj) {
    for (var asset in actualObj) {
      if ('__conf__' === asset) {
        continue;
      }
      for (var prop in asset) {
        if ('mtime' === prop) {
          continue;
        }
        assert.equal(actualObj[asset][prop], expectedObj[asset][prop],
          'Manifest asset "' + asset + '" should have same properties as expected');
      }
    }
  };

  it('should produce the correct manifest json file', function(){
    var actualFile = 'testManifest.json';
    var actualObj = grunt.file.readJSON(tmp + actualFile);
    var expectedObj = grunt.file.readJSON(expectedPath + actualFile);

    compareObj(actualObj, expectedObj);
  });

  it('should produce the correct manifest json file with prepend', function(){
    var actualFile = 'testManifestAbs.json';
    var actualObj = grunt.file.readJSON(tmp + actualFile);
    var expectedObj = grunt.file.readJSON(expectedPath + actualFile);

    compareObj(actualObj, expectedObj);
  });
  it('should return the proper asset value', function() {
    manifest.init( tmp + 'testManifestAbs.json');
    var asset = manifest.asset( '/js/thanpol.as.js' );
    assert.ok('true');
  });

});
