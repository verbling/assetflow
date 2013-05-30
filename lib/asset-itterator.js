/*jshint camelcase:false */
/**
 * The asset files itterator.
 *
 */
var grunt    = require('grunt'),
    path     = require('path'),
    crypto   = require('crypto'),
    helpers  = require('grunt-ss-helpers'),
    log      = helpers.log,
    _        = grunt.util._,
    Map      = require('../node_modules/collections/map'),
    async    = require('async'),
    manifest = require('./asset-manifest'),
    when     = require('when');

var assetItter = module.exports = function(){

  this._newCount = 0;
  this._updCount = 0;

  // count operations
  this._opCount = 0;

  // the queue'd ops
  this._opQueue = [];

  this._execTime = null;

};

/**
 * [itterateFiles description]
 * @param  {Array} assetFiles An array of filenames.
 * @return {when.Promise} [description]
 */
assetItter.prototype.itterateFiles = function( assetFiles ) {

  log.debug(this.debug, 'assetItter.itterateFiles() :: init');

  this._execTime = helpers.execTime('assets');

  var def = when.defer();

  // check for limit
  if ( 0 < this.options.maxOperations ) {
    var alldefs = [];
    async.eachLimit( assetFiles, this.options.maxOperations,
      function(item, cb){

        alldefs.push( this._hasChanged(item).always(cb) );

    }.bind(this), function(){
      when.all(alldefs).then(def.resolve, def.reject);
    });

  } else {
    when.map(assetFiles, this._hasChanged.bind(this))
      .then(def.resolve, def.reject);
  }

  return def.then(function() {
      log.info('\nScanning Complete. New assets: ' + (this._newCount + '').blue +
        ' Updated: ' + (this._updCount + '').blue + ' Total: ' +
        ((this._newCount + this._updCount) + '').yellow + ' Elapsed time: ' +
        this._execTime().yellow );

      this._execTime.reset();
    }.bind(this));

};


/**
 * Checks if the source file has changed compared to the manifest and the
 * copy that exists.
 *
 * @param  {string}  rawFilename Filename as passed from grunt.file.expand
 * @return {when.Promise}
 */
assetItter.prototype._hasChanged = function( rawFilename ) {

  log.debug(this.debug, 'assetItter._hasChanged() :: Init. ' +
     ' opCount: ' + (this._opCount + '').blue + ' throttle: ' +
    (this.opThrottle + '').red + ' Queued ops: ' +
    (this._opQueue.length + '').yellow + ' :: ' + rawFilename);

  var def = when.defer();

  // remove './' from beggining of filename
  var filename = path.normalize(rawFilename);

  when.all([
    helpers.getStat(filename),
    helpers.md5file(filename),
    // this needs a condition if gzip is used and honor exclusions.
    helpers.gzipfile(filename)
    ])
    .otherwise(function(err){
      log.warn('fs.stat or md5 failed:' + err);
      def.reject(err);
    })
    .then(function( results ) {

    var hash = results[1];
    var stat = results[0];
    var gzipFile = results[2];

    var gzipHash = crypto.createHash('md5').update( gzipFile ).digest('hex');


    //
    // prepare to copy --
    //
    // TODO refactor
    var basename = path.basename(filename);
    // remove the filename from file
    var filePath = filename.substr(0, filename.length - basename.length);
    var assetName = filename;

    if (this.options.rel) {
      var relPath = path.relative( this.relPath, filePath);
      assetName = path.join( relPath, basename );
    }
    assetName = this.prepend + assetName;

    var manifestItem = manifest.get(assetName);
    //
    // Check if there is no record in the manifest
    //
    if ( !_.isObject(manifestItem)) {
      // new asset go
      log.debug(this.debug, 'assetItter._hasChanged() :: ' + ' new asset'.blue +
        ' :: ' + rawFilename);
      this._newCount++;
      this._newAsset( filename, stat, hash, gzipHash )
        .then(def.resolve, def.reject);
      return;
    }

    //
    // Check if there is no modified time in the manifest
    //
    if ( !manifestItem.mtime ) {
      // new asset!
      this._newCount++;
      return when.chain( this._newAsset( filename, stat, hash, gzipHash ),
        def.resolver);
    }

    //
    // Check if copied file is there
    //
    if ( !grunt.file.isFile( manifestItem.absPath )) {
      this._newCount++;
      return when.chain( this._newAsset( filename, stat, hash, gzipHash ),
        def.resolver);
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
      return when.chain( this._newAsset( filename, stat, hash, gzipHash ),
        def.resolver);
    }

    if (this._progress) { this._paceScan.op(); }

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
 * @param  {string} md5 hash of gzipped file.
 * @return {when.Promise}
 */
assetItter.prototype._newAsset = function( filename, stat, hash, gzipHash ) {
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
  var hashName
 // add hash only if defined
  if(useHash)
    hashName = filenameNoExt + '-' + useHash + ext;
  else
    hashName= filenameNoExt + ext;

  // full path to the new asset.
  var dest = path.join( this.destFolder, filePath, hashName);

  if (this._progress) {
    this._paceScan.op();
  } else {
    log.info('Copying ' + filename.yellow + ' -> ' + dest.cyan);
  }
  grunt.file.copy(filename, dest);

  //
  // Create the manifest item and store
  //
  var assetName = filename;
  var assetHashName = path.join( filePath, hashName );

  if (this.options.rel) {
    var relPath = path.relative( this.relPath, filePath);
    assetName = path.join( relPath, basename );
    assetHashName = path.join( relPath, hashName );
  }

  var assetManifest = {
    mtime: stat.mtime,
    absPath: dest,
    relPath: this.prepend + assetHashName,
    hash: hash,
    gzipHash: gzipHash
  };
  manifest.set( this.prepend + assetName, assetManifest);

  return def.resolve();
};
