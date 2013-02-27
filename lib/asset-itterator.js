/*jshint camelcase:false */
/**
 * The asset files itterator.
 *
 */
var fs       = require('fs'),
    grunt    = require('grunt'),
    path     = require('path'),
    helpers  = require('grunt-ss-helpers'),
    log      = helpers.log,
    crypto   = require('crypto'),
    _        = grunt.util._,
    when     = require('when');

var assetItter = module.exports = function(){};

/**
 * [itterateFiles description]
 * @return {when.defer.promise} [description]
 */
assetItter.prototype.itterateFiles = function() {
  var def = when.defer(),
      promise   = def.promise;

  log.debug(this.debug, 'assetsItter.itterateFiles() :: init');

  this._assetFiles.forEach(function( file ){
    when.chain( this._hasChanged(file), def.resolver );
  }, this);

  return promise;
};

/**
 * Checks if the file has changed compared to the manifest.
 *
 * @param  {string}  file
 * @return {Promise}
 */
assetItter.prototype._hasChanged = function( file ) {
  var def = when.defer();
  log.debug(this.debug, 'assetsItter._hasChanged() :: init. File: ' + file);
  fs.lstat( file, function(err, stat) {

    var manifestItem = this._manifest.get(file);

    if ( !_.isObject(manifestItem)) {
      // new asset
      when.chain( this._newAsset( file, stat ), def.resolver);
      return;
    }

    if ( !manifestItem.mtime ) {
      // new asset
      when.chain( this._newAsset( file, stat ), def.resolver);
      return;
    }

    if ( stat.mtime > manifestItem.outMtime ) {
      // new asset
      when.chain( this._newAsset( file, stat ), def.resolver);
      return;
    }

    def.resolve();

  }.bind(this));
  return def.promise;
};


/**
 * Checks if the file has changed compared to the manifest.
 *
 * @param {string}  file
 * @param {Object} stat
 * @return {Promise}
 */
assetItter.prototype._newAsset = function( file, stat ) {
  var def = when.defer();
  log.debug(this.debug, 'assetsItter._newAsset() :: init. File: ' + file);

  var md5sum = crypto.createHash('md5');
  var fileContents = '';
  var s = fs.ReadStream(file);
  s.on('data', function(d) {
    fileContents += d;
    md5sum.update(d);
  });

  s.on('end', function() {

    var hash = md5sum.digest('hex');

    if ( 0 < this.options.truncateHash && _.isNumber( this.options.truncateHash )) {
      hash = hash.substr(0, this.options.truncateHash);
    }

    // prepare to copy
    var filename = path.basename(file);
    // remove the filename from file
    var filePath = file.substr(0, file.length - filename.length);

    var dest = path.join( this.destFolder, filePath, hash + '-' + filename);

    log.info('Copying ' + file.yellow + ' -> ' + dest.cyan);


    // grunt.file.copy(file, dest);
    //
    // Create the manifest item and store
    //

    def.resolve(file);

  }.bind(this));

  return def.promise;
};
