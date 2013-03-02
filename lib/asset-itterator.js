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

  log.debug(this.debug, 'assetItter.itterateFiles() :: init');

  return when.map(this._assetFiles, this._hasChanged.bind(this));
};

/**
 * Checks if the file has changed compared to the manifest.
 *
 * @param  {string}  file
 * @return {Promise}
 */
assetItter.prototype._hasChanged = function( file ) {
  var def = when.defer();
  log.debug(this.debug, 'assetItter._hasChanged() :: init. File: ' + file);
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

    var mfile = new Date(stat.mtime);
    var mmanf = new Date(manifestItem.mtime);

    if ( mfile > mmanf ) {
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
  log.debug(this.debug, 'assetItter._newAsset() :: init. File: ' + file);

  var md5sum = crypto.createHash('md5');
  var fileContents = '';
  var streamFile = fs.ReadStream(file);
  streamFile.on('data', function(d) {
    fileContents += d;
    md5sum.update(d);
  });

  streamFile.on('end', function() {

    var hash = md5sum.digest('hex');

    if ( 0 < this.options.truncateHash && _.isNumber( this.options.truncateHash )) {
      hash = hash.substr(0, this.options.truncateHash);
    }

    // prepare to copy
    var filename = path.basename(file);

    // remove the filename from file
    var filePath = file.substr(0, file.length - filename.length);
    var hashName = hash + '-' + filename;

    var dest = path.join( this.destFolder, filePath, hashName);

    log.info('Copying ' + file.yellow + ' -> ' + dest.cyan);
    // grunt.file.copy(file, dest);



    //
    // Create the manifest item and store
    //
    var assetManifest = {
      mtime: stat.mtime,
      path: dest
    };
    this._manifest.set(file, assetManifest);

    def.resolve(file);

  }.bind(this));

  return def.promise;
};
