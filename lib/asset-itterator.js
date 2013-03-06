/*jshint camelcase:false */
/**
 * The asset files itterator.
 *
 */
var grunt    = require('grunt'),
    path     = require('path'),
    helpers  = require('grunt-ss-helpers'),
    log      = helpers.log,
    _        = grunt.util._,
    Map      = require('../node_modules/collections/map'),
    when     = require('when');

var assetItter = module.exports = function(){
  // the manifest local object
  this.manifest = new Map();

  this._newCount = 0;
  this._updCount = 0;

  // count operations
  this._opCount = 0;

  // the queue'd ops
  this._opQueue = [];

};

/**
 * [itterateFiles description]
 * @return {when.Promise} [description]
 */
assetItter.prototype.itterateFiles = function() {

  log.debug(this.debug, 'assetItter.itterateFiles() :: init');

  return when.map(this._assetFiles, this._hasChanged.bind(this));
};

/**
 * Called everytime an operation finishes, will check if there are ops
 * in queue and run them...
 *
 * @private
 */
assetItter.prototype._onOpFinish = function() {

  var freeSlots = this.opThrottle - this._opCount;
  var op;
  while(0 < freeSlots && 0 < this._opQueue.length ) {

    op = this._opQueue.shift();
    if ( !_.isObject(op) ) {
      break;
    }
    this._hasChanged(op.rawFilename, op.def);
    // recalc freeslots to avoid race conditions
    freeSlots = this.opThrottle - this._opCount;
  }
};

/**
 * Checks if the source file has changed compared to the manifest and the
 * copy that exists.
 *
 * @param  {string}  rawFilename Filename as passed from grunt.file.expand
 * @param  {when.Promise=} optDef when an op is resumed after being throttled
 *   the original deferred is provided so it can be resolved.
 * @return {when.Promise}
 */
assetItter.prototype._hasChanged = function( rawFilename, optDef ) {

  log.debug(this.debug, 'assetItter._hasChanged() :: Init. ' +
     ' opCount: ' + (this._opCount + '').blue + ' throttle: ' +
    (this.opThrottle + '').red + ' Queued ops: ' +
    (this._opQueue.length + '').yellow + ' :: ' + rawFilename);

  var def = optDef || when.defer();

  //
  //
  // All these ops are async. Take care of total concurent operations
  //
  //

  // check if op needs to be throttled
  if ( this._opCount > this.opThrottle && this.opThrottle) {
    this._opQueue.push({
      rawFilename: rawFilename,
      def: def
    });
    return def.promise;
  }

  this._opCount++;
  def.promise.always(function() {
    this._opCount--;
    this._onOpFinish();
  }.bind(this));

  // remove './' from beggining of filename
  var filename = path.normalize(rawFilename);

  if (grunt.file.isFile(filename)) {
    log.debug(this.debug, 'assetItter._hasChanged() :: Examining file: ' + filename);
  } else {
    log.debug(this.debug, 'assetItter._hasChanged() :: skipping directory: ' + filename);
    return def.resolve();
  }


  when.all([helpers.getStat(filename), helpers.md5file(filename)])
    .otherwise(function(err){
      log.warn('fs.stat or md5 failed:' + err);
      def.reject(err);
    })
    .then(function( results ){

    var hash = results[1];
    var stat = results[0];

    var manifestItem = this.manifest.get(filename);

    //
    // Check if there is no record in the manifest
    //
    if ( !_.isObject(manifestItem)) {
      // new asset go
      this._newCount++;
      return when.chain( this._newAsset( filename, stat, hash ), def.resolver);
    }

    //
    // Check if there is no modified time in the manifest
    //
    if ( !manifestItem.mtime ) {
      // new asset!
      this._newCount++;
      return when.chain( this._newAsset( filename, stat, hash ), def.resolver);
    }

    //
    // Check if copied file is there
    //
    if ( !grunt.file.isFile( manifestItem.abspath )) {
      this._newCount++;
      return when.chain( this._newAsset( filename, stat, hash ), def.resolver);
    }

    //
    // Compare the modified times of the source and manifest
    // and Check MD5 of copied file
    //
    var mfile = new Date(stat.mtime);
    var mmanf = new Date(manifestItem.mtime);
    if ( mfile > mmanf && hash !== manifestItem.hash ) {
      // updated asset
      this._updCount++;
      return when.chain( this._newAsset( filename, stat, hash ), def.resolver);
    }

    def.resolve();
  }.bind(this));

  return def.promise;
};


/**
 * Checks if the file has changed compared to the manifest.
 *
 * @param {string}  filename
 * @param {Object} stat
 * @param {string} hash md5.
 * @return {when.Promise}
 */
assetItter.prototype._newAsset = function( filename, stat, hash ) {
  var def = when.defer();
  log.debug(this.debug, 'assetItter._newAsset() :: init. File: ' + filename);


  var useHash;
  if ( 0 < this.options.truncateHash && _.isNumber( this.options.truncateHash )) {
    useHash = hash.substr(0, this.options.truncateHash);
  }

  //
  // prepare to copy
  //
  var basename = path.basename(filename);
  var ext = path.extname(basename);

  // remove the filename from file
  var filePath = filename.substr(0, filename.length - basename.length);

  // remove the ext from basename
  var filenameNoExt = basename.substr(0, basename.length - ext.length);

  // stick them together
  var hashName = filenameNoExt + '-' + useHash + ext;
  var dest = path.join( this.destFolder, filePath, hashName);

  log.info('Copying ' + filename.yellow + ' -> ' + dest.cyan);
  grunt.file.copy(filename, dest);

  //
  // Create the manifest item and store
  //
  var assetManifest = {
    mtime: stat.mtime,
    abspath: dest,
    relpath: path.join( filePath, hashName ),
    hash: hash
  };
  this.manifest.set(filename, assetManifest);

  def.resolve(filename);


  return def.promise;
};
