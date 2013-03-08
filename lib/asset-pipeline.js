/*jshint camelcase:false */
/**
 * The bootstrap file.
 *
 */
var grunt    = require('grunt'),
    _        = grunt.util._,
    path     = require('path'),
    helpers  = require('grunt-ss-helpers'),
    log      = helpers.log,
    util     = require('util'),
    assetIter = require('./asset-itterator'),
    Map       = require('../node_modules/collections/map'),
    pace  = require('pace'),
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
  this.fileObj = null;
  this._manifestAr = false;
  this.options  = options;
  this.target = target;

  this._assetFiles = [];
  // internal, sanitized parameters
  this._params = {};
  this.destFolder = null;

  this.relPath = '';

  // progress for scan
  this._paceScan = null;

  // throttle of concurent operations
  this.opThrottle = 100;

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

  return when.map(this.files, this.runFileObj.bind(this) );
};


/**
 * Execute the asset task for one fileobject src/dest pair.
 *
 * @param {Object} The grunt file object.
 * @return {when.Promise} a promise.
 */
assets.Task.prototype.runFileObj = function( fileObj ) {
  var def = when.defer();

  //
  // Validate file Object
  //
  if ( !this.validate( fileObj ) ) {
    return def.reject('validation error');
  }

  //
  // expand the source files
  //
  var assetFiles = grunt.file.expand({filter: 'isFile'}, fileObj.src);
  if ( 0 === assetFiles.length ) {
    helpers.log.info('No source files found. Done.');
    return def.resolve('No source files');
  }

  //
  // Go through each file and md5 it...
  //
  log.info('\nStart scanning ' + (assetFiles.length + '').cyan +
    ' files for changes based on m5 hash');

  if (this._progress) { this._paceScan = pace( assetFiles.length ); }

  return this.itterateFiles( assetFiles )
    .then( this._onItterateFinish.bind(this) );
};

/**
 * like the name sais.
 */
assets.Task.prototype._onItterateFinish = function() {
  // write the manifest file
  var manifestContents = JSON.stringify( this.manifest.toObject(), null, 4 );
  grunt.file.write(this._params.manifestFile, manifestContents);

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
    helpers.log.warn('Error reading manifest file "' +
      this._params.manifestFile + '" :: ' + ex);
    helpers.log.warn('Creating new one...');
    fileManifest = {};
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
 * @param  {Object} fileObj grunt file object.
 * @return {boolean} error message yielded in this func.
 */
assets.Task.prototype.validate = function( fileObj ) {

  var dest = fileObj.dest;

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

  this._progress = !!this.options.progress;

  if ( isNaN(this.opThrottle) ) {
    this.opThrottle = assets.THROTTLE_OPS;
  }

  if ( this.options.rel ) {
    this.relPath = grunt.file.expand({ filter: 'isDirectory' }, this.options.rel )[0];
    if (!_.isString(this.relPath)) {
      log.error('\nRelative path does not exist: '.red + this.options.rel );
      return false;
    }
  }

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

/**
 * Returns the manifest as an array including a new key 'asset' that contains
 * the original asset name (ie key)
 *
 * @return {Array} the manifest.
 */
assets.Task.prototype.manifestArray = function() {
  return this._manifestAr ||  (
    this._manifestAr = this.manifest.map( function(item, key) {
        if ( assets.MANIFEST_CONFIG === key ) {
          return {};
        }
        item.asset = key;
        return item;
      }).toArray()
    );
};
