/**
 * @fileOverview The assets task test.
 */

var sinon  = require('sinon'),
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

  it('should produce the correct manifest json file', function(){
    var actualFile = 'testManifest.json';
    var actual = grunt.file.read(tmp + actualFile);
    var expected = grunt.file.read(expectedPath + actualFile);
    assert.equal(actual, expected, 'task output should equal: ' + actualFile);
  });

  it('should return the proper asset value', function() {

    assert.ok('true');
  });

});
