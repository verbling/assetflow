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

assets.MANIFEST_CONFIG = '__conf__';

// default throttle of concurent operations
assets.THROTTLE_OPS = 100;

/**
 * [run description]
 * @param  {Array.<Object>} files
 * @param  {Object} options
 * @param  {string} target
 * @return {Object} a promise.
 */
assets.run = function( files, options, target) {
  var task = new assets.Task(files, options, target);

  return task.run();
};

/**
 * [task description]
 * @param  {Array.<Object>} files
 * @param  {Object} options
 * @param  {string} target
 */
assets.Task = function( files, options, target ) {
  assetIter.apply(this, arguments);

  // make a copy of the files array
  this.files = Array.prototype.slice.call(files, 0);
  this.masterDeferred = when.defer();
  this.fileObj;
  this.options  = options;
  this.target = target;

  this._assetFiles = [];
  // internal, sanitized parameters
  this._params = {};
  this.destFolder = null;

  // throttle of concurent operations
  this._opThrottle = 0;

  this.debug = false;
};
util.inherits(assets.Task, assetIter);

/**
 * [run description]
 * @return {when.Promise} a promise.
 */
assets.Task.prototype.run = function() {
  var def = when.defer();

  //
  // read or initialize manifest
  //
  if ( !this.initManifest() ) {
    return def.reject('No manifest file');
  }

  //
  // Check options
  //
  if ( !this.validateOptions() ) {
    return def.reject('options did not pass validations');
  }

  return this._startLoop();
};

/**
 * Will loop through all the 'this.files' array checking on each loop
 * the successful execution of the asset task
 *
 * @return {when.Promise} a promise.
 * @private
 */
assets.Task.prototype._startLoop = function() {

  if ( 0 === this.files.length ) {
    // end of the line...
    this.masterDeferred.resolve();
  }

  this.fileObj = this.files.shift();

  this.runFileObj()
    .then(this._startLoop.bind(this))
    .otherwise( function(err) {
      this.masterDeferred.reject(err);
    });

  return this.masterDeferred.promise;
};

/**
 * Execute the asset task for one fileobject src/dest pair.
 *
 * @return {when.Promise} a promise.
 */
assets.Task.prototype.runFileObj = function() {
  var def = when.defer();

  //
  // Validate file Object
  //
  if ( !this.validate() ) {
    return def.reject('validation error');
  }

  //
  // expand the source files
  //
  this._assetFiles = grunt.file.expand(this.fileObj.src);
  if ( 0 === this._assetFiles.length ) {
    helpers.log.info('No source files found. Done.');
    return def.reject('No source files');
  }

  //
  // Go through each file and md5 it...
  //
  return this.itterateFiles()
    .then( this._onItterateFinish.bind(this) );
};

/**
 * like the name sais.
 */
assets.Task.prototype._onItterateFinish = function() {
  // write the manifest file
  var manifestContents = JSON.stringify( this.manifest.toObject(), null, 4 );
  grunt.file.write(this._params.manifestFile, manifestContents);

  log.info('\nAll finished. New assets: ' + (this._newCount + '').blue +
    ' Updated: ' + (this._updCount + '').blue + ' Total: ' +
  ((this._newCount + this._updCount) + '').yellow );
};

/**
 * [initManifest description]
 * @return {boolean} [description]
 */
assets.Task.prototype.initManifest = function() {

  //
  // look in the options for the manifest file
  //
  this._params.manifestFile = this.options.manifest || assets.DEFAULT_MANIFEST;
  if ('.json' !== path.extname( this._params.manifestFile )) {
    helpers.log.error('manifestFile file should have a ".json" extension');
    return false;
  }

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

  this.manifest.addEach(fileManifest);

  // check if config has been defined
  if ( !this.manifest.has( assets.MANIFEST_CONFIG )) {
    this.manifest.set( assets.MANIFEST_CONFIG, {
      cdnurl: ''
    });
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

  // good to assign
  this.destFolder = dest;

  return true;
};


/**
 * Perform granular validations on options
 * and define the internal params properties.
 *
 * @return {boolean}
 */
assets.Task.prototype.validateOptions = function() {

  this.debug = !!this.options.debug;

  //
  // cdn url
  //
  var cdnurl = this.options.cdnurl || '';

  this.setManifestConf('cdnurl', cdnurl);

  this._opThrottle = Number(this.options.throttle) || assets.THROTTLE_OPS;

  return true;
};

/**
 * Set a manifest config param
 * @param {string} key
 * @param {*} value
 */
assets.Task.prototype.setManifestConf = function( key, value ) {
  var conf = this.manifest.get(assets.MANIFEST_CONFIG);
  conf[key] = value;
  this.manifest.set(assets.MANIFEST_CONFIG, conf);
};
