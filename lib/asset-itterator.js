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
 * Checks if the source file has changed compared to the manifest and the
 * copy that exists.
 *
 * @param  {string}  rawFilename Filename as passed from grunt.file.expand
 * @return {when.Promise}
 */
assetItter.prototype._hasChanged = function( rawFilename ) {
  var def = when.defer();

  // remove './' from beggining of filename
  var filename = path.normalize(rawFilename);

  log.debug(this.debug, 'assetItter._hasChanged() :: init. File: ' + filename);

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
      return when.chain( this._newAsset( filename, stat, hash ), def.resolver);
    }

    //
    // Check if there is no modified time in the manifest
    //
    if ( !manifestItem.mtime ) {
      // new asset!
      return when.chain( this._newAsset( filename, stat, hash ), def.resolver);
    }

    //
    // Check if copied file is there
    //
    if ( !grunt.file.isFile( manifestItem.path )) {
      return when.chain( this._newAsset( filename, stat, hash ), def.resolver);
    }

    //
    // Compare the modified times of the source and manifest
    // and Check MD5 of copied file
    //
    var mfile = new Date(stat.mtime);
    var mmanf = new Date(manifestItem.mtime);
    if ( mfile > mmanf && hash !== manifestItem.hash ) {
      // new asset
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

  // prepare to copy
  var basename = path.basename(filename);

  // remove the filename from file
  var filePath = filename.substr(0, filename.length - basename.length);
  var hashName = useHash + '-' + basename;
  var dest = path.join( this.destFolder, filePath, hashName);

  log.info('Copying ' + filename.yellow + ' -> ' + dest.cyan);
  grunt.file.copy(filename, dest);

  //
  // Create the manifest item and store
  //
  var assetManifest = {
    mtime: stat.mtime,
    path: dest,
    hash: hash
  };
  this.manifest.set(filename, assetManifest);

  def.resolve(filename);


  return def.promise;
};
