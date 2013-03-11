/**
 * @fileOverview The assetsReplace task test.
 */

var sinon  = require('sinon'),
    expect = require('chai').expect,
    grunt  = require('grunt'),
    assert = require('chai').assert;


var tmp = 'temp/replace-testCase/test/case/less/';
var expectedPath = 'test/expected/';

describe('Grunt task :: assetsReplace', function(){

  beforeEach(function() {
  });

  afterEach(function() {
  });

  it('should produce the correct less file', function(){
    var actualFile = 'variables.less';
    var actual = grunt.file.read(tmp + actualFile);
    var expected = grunt.file.read(expectedPath + actualFile);
    assert.equal(actual, expected, 'task output should equal: ' + actualFile);
  });

  it('should produce the correct less file with abs paths', function(){
    var actualFile = 'variables.abs.less';
    var actual = grunt.file.read('temp/replace-prepend/test/case/less/variables.less');
    var expected = grunt.file.read(expectedPath + actualFile);
    assert.equal(actual, expected, 'task output should equal: ' + actualFile);
  });


});
