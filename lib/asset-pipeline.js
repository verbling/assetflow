/*jshint camelcase:false */
/**
 * The bootstrap file.
 *
 */
var grunt    = require('grunt'),
    path     = require('path'),
    helpers  = require('grunt-ss-helpers'),
    log      = helpers.log,
    util     = require('util'),
    assetIter = require('./asset-itterator'),
    Map       = require('../node_modules/collections/map'),
    when     = require('when');

var assets = module.exports = {
  Map: Map
};

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
 */
assets.Task = function( fileObj, options, target ) {
  assetIter.apply(this, arguments);

  this.fileObj = fileObj;
  this.options  = options;
  this.target = target;

  this._assetFiles = [];
  // internal, sanitized parameters
  this._params = {};
  this.destFolder = null;

  this.debug = false;
};
util.inherits(assets.Task, assetIter);

/**
 * [run description]
 * @return {when.Promise} a promise.
 */
assets.Task.prototype.run = function() {
  var def = when.defer(),
      promise   = def.promise;

  //
  // Validate input
  //
  if ( !this.validate() ) {
    def.reject('validation error');
    return promise;
  }
  if ( 0 === this._assetFiles.length ) {
    helpers.log.info('No source files found. Done.');
    def.resolve('No source files');
    return promise;
  }

  //
  // read or initialize manifest
  //
  if ( !this.initManifest() ) {
    def.reject('No manifest file');
    return promise;
  }

  //
  // Go through each file and md5 it...
  //

  return this.itterateFiles()
    .always( this._onItterateFinish.bind(this) );
};

/**
 * like the name sais.
 */
assets.Task.prototype._onItterateFinish = function() {
  // write the manifest file
  var manifestContents = JSON.stringify( this._manifest.toObject(), null, 4 );
  grunt.file.write(this._params.manifestFile, manifestContents);

  log.info('All finished.');
};


/**
 * [initManifest description]
 * @return {boolean} [description]
 */
assets.Task.prototype.initManifest = function() {
  if ( !grunt.file.exists( this._params.manifestFile ) ) {
    // touch it
    grunt.file.write( this._params.manifestFile, '{}');
  }

  if ( !grunt.file.isFile( this._params.manifestFile ) ) {
    helpers.log.error('Could not create manifest file: ' + this._params.manifestFile);
    return false;
  }

  // read the manifest
  var fileManifest;
  try {
    fileManifest = grunt.file.readJSON( this._params.manifestFile );
  } catch (ex) {
    helpers.log.error('Error reading manifest file "' +
      this._params.manifestFile + '" :: ' + ex);
    return false;
  }

  this._manifest.addEach(fileManifest);

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

  // good to assign
  this.destFolder = dest;

  //
  // expand the source files
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

  this.debug = !!this.options.debug;

  return true;
};
