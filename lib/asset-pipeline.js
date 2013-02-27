/*jshint camelcase:false */
/**
 * The bootstrap file.
 *
 */

var grunt    = require('grunt'),
    path     = require('path'),
    helpers  = require('grunt-ss-helpers'),
    when     = require('when');

var assets = module.exports = {};

/**
 * [run description]
 * @param  {Object} fileObj
 * @param  {Object} options
 * @param  {string} target
 * @return {Object} a promise.
 */
assets.run = function( fileObj, options, target) {
  var task = new assets.Task(fileObj, options, target);

  return task.run();
};

/**
 * [task description]
 * @param  {Object} fileObj
 * @param  {Object} options
 * @param  {string} target
 * @return {[type]} [description]
 */
assets.Task = function( fileObj, options, target ) {
  this.fileObj = fileObj;
  this.options  = options;
  this.target = target;

  this._assetFiles = [];
};

/**
 * [run description]
 * @return {Object} a promise.
 */
assets.Task.prototype.run = function() {
  var deferred = when.defer(),
      promise   = deferred.promise;

  //
  // Validate input
  //
  if ( !this.validate() ) {
    deferred.reject('validation error');
    return promise;
  }


  //
  // read or initialize manifest
  //
  this.initManifest();

  console.log('The expanded files:\n', assetFiles, '\n--- End\n');

  return deferred.promise;

};

/**
 * [initManifest description]
 * @return {[type]} [description]
 */
assets.Task.prototype.initManifest = function() {

};

/**
 * Validates and prepares paths
 *
 * @return {boolean} error message yielded in this func.
 */
assets.Task.prototype.validate = function() {

  var dest = this.fileObj.dest;

  if ( 'string' !== typeof dest ) {
    helpers.log.error('"dest" must be defined, and be of type "string"');
    return false;
  }

  // check if cwd
  if ( 0 <= ['', '.', './', '..', '../'].indexOf(dest) ) {
    helpers.log.error('"dest" cannot be the current working directory');
    return false;
  }

  // check if it exists and create
  if ( !grunt.file.exists(dest) ) {
    grunt.file.mkdir(dest);
  }

  if ( !grunt.file.isDir(dest)) {
    helpers.log.error('"dest" is not a directory: ' + dest);
    return false;
  }


  //
  // expand the source files and check if any
  //
  this._assetFiles = grunt.file.expand(this.fileObj.src);
  if ( 0 === this._assetFiles.length ) {
    helpers.log.info('No source files found. Done.');
    return false;
  }

  return true;
};

