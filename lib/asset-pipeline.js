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

assets.DEFAULT_MANIFEST = 'manifest.json';

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
  // internal, sanitized parameters
  this._params = {};
  // the manifest local object
  this._manifest = {};
};

/**
 * [run description]
 * @return {Object} a promise.
 */
assets.Task.prototype.run = function() {
  var deferred = when.defer(),
      promise   = deferred.promise;

  console.log('options:\n', this.options, '\n--- End\n');

  //
  // Validate input
  //
  if ( !this.validate() ) {
    deferred.reject('validation error');
    return promise;
  }
  if ( 0 === this._assetFiles.length ) {
    helpers.log.info('No source files found. Done.');
    deferred.reject('No source files');
    return promise;
  }

  //
  // read or initialize manifest
  //
  if ( !this.initManifest() ) {
    deferred.reject('No source files');
    return promise;
  }


  console.log('The expanded files:\n', this._assetFiles, '\n--- End\n');

  return deferred.promise;

};

/**
 * [initManifest description]
 * @return {boolean} [description]
 */
assets.Task.prototype.initManifest = function() {
  if ( !grunt.file.exists( this._params.manifestFile ) ) {
    // touch it
    grunt.file.write( this._params.manifestFile, '');
  }

  if ( !grunt.file.isFile( this._params.manifestFile ) ) {
    helpers.log.error('Could not create manifest file: ' + this._params.manifestFile);
    return false;
  }

  // read the manifest
  try {
    this._manifest = grunt.file.readJSON( this._params.manifestFile );
  } catch (ex) {
    helpers.log.error('Error reading manifest file "' +
      this._params.manifestFile + '" :: ' + ex);
    return false;
  }

  return true;
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

  return this.validateOptions();
};


/**
 * Perform granular validations on options
 * and define the internal params properties.
 *
 * @return {boolean}
 */
assets.Task.prototype.validateOptions = function() {
  this._params.manifestFile = this.options.manifest || assets.DEFAULT_MANIFEST;

  if ('.json' !== path.extname( this._params.manifestFile )) {
    helpers.log.error('manifestFile file should have a ".json" extension');
    return false;
  }

  return true;
};
