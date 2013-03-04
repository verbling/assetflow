/**
 * Search and replace task based on  Grunt String Replace
 * by Erick Ruiz de Chavez https://github.com/erickrdch/grunt-string-replace
 *
 *
 */
var grunt = require('grunt');
var stringReplace = require('../node_modules/tasks/lib/string-replace')
  .init(grunt);

var replace = module.exports = {};

/**
 * [run description]
 * @param  {Object} fileObj
 * @param  {Object} options
 * @param  {string} target
 * @return {Object} a promise.
 */
replace.run = function( fileObj, options, target ) {
  var task = new replace.Task(fileObj, options, target);

  return task.run();

};

/**
 * [Task description]
 * @param  {Object} fileObj
 * @param  {Object} options
 * @param  {string} target
 * @return {Object} a promise.
 */
replace.Task = function( fileObj, options, target ) {
  this.fileObj = fileObj;
  this.options = options;
  this.target = target;

  this.debug = false;

};

/**
 * [run description]
 * @return {when.Promise} a promise.
 */
replace.Task.prototype.run = function() {
  var def = when.defer();



  return def.promise;
};
