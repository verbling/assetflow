/**
 * @fileOverview The bundle task test.
 */

var sinon  = require('sinon'),
    expect = require('chai').expect,
    grunt  = require('grunt'),
    assert = require('chai').assert;


var tmp = 'temp/bundles/';
var expectedPath = 'test/expected/bundles/';

describe('Grunt task :: assetsBundle', function(){

  beforeEach(function() {
  });

  afterEach(function() {
  });

  it('should produce the correct bundle file with no export options', function(){
    var actualFile = 'noexport.js';
    var actual = grunt.file.read(tmp + actualFile);
    var expected = grunt.file.read(expectedPath + actualFile);
    assert.equal(actual, expected, 'task output should equal: ' + actualFile);
  });
  it('should produce the correct bundle file with amd export option', function(){
    var actualFile = 'amd.js';
    var actual = grunt.file.read(tmp + actualFile);
    var expected = grunt.file.read(expectedPath + actualFile);
    assert.equal(actual, expected, 'task output should equal: ' + actualFile);
  });
  it('should produce the correct bundle file with commonjs export option', function(){
    var actualFile = 'commonjs.js';
    var actual = grunt.file.read(tmp + actualFile);
    var expected = grunt.file.read(expectedPath + actualFile);
    assert.equal(actual, expected, 'task output should equal: ' + actualFile);
  });
  it('should produce the correct bundle file with namespace export option', function(){
    var actualFile = 'namespace.js';
    var actual = grunt.file.read(tmp + actualFile);
    var expected = grunt.file.read(expectedPath + actualFile);
    assert.equal(actual, expected, 'task output should equal: ' + actualFile);
  });

});
