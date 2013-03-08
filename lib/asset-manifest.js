/**
 * The Manifest file class
 *
 */
var grunt    = require('grunt'),
    _        = grunt.util._,
    path     = require('path'),
    helpers  = require('grunt-ss-helpers'),
    Map       = require('../node_modules/collections/map');

//
// local vars
//
var _manifestAr = false;
// the config object
var _config = {cdnurl: ''};

var _manifestFile = '';

var manifest = module.exports = {};

manifest.DEFAULT_MANIFEST = 'manifest.json';

manifest.MANIFEST_CONFIG = '__conf__';

// the manifest local object
manifest.map = new Map();
manifest.get = function(){};
manifest.set = function(){};
manifest.has = function(){};

/**
 * Initialize the manifest.
 * If it's not there or if it is corrupted a new manifest will be created.
 *
 * @param  {string} optManifestFile Location to the manifest file.
 * @return {boolean} [description]
 */
manifest.init = function( optManifestFile ) {

  // clear all
  manifest.reset();

  //
  // look in the options for the manifest file
  //
  _manifestFile = optManifestFile || manifest.DEFAULT_MANIFEST;

  if ('.json' !== path.extname( _manifestFile )) {
    helpers.log.error('_manifestFile file should have a ".json" extension');
    return false;
  }

  if ( !grunt.file.exists( _manifestFile ) ) {
    // touch it
    grunt.file.write( _manifestFile, '{}');
  }
  if ( !grunt.file.isFile( _manifestFile ) ) {
    helpers.log.error('Could not create manifest file: ' + _manifestFile);
    return false;
  }

  // read the manifest
  var rawManifest;
  try {
    rawManifest = grunt.file.readJSON( _manifestFile );
  } catch (ex) {
    helpers.log.warn('Error reading manifest file "' +
      _manifestFile + '" :: ' + ex);
    helpers.log.warn('Creating new one...');
    rawManifest = {};
  }

  // check if config is in the object and remove it
  if (_.has(rawManifest, manifest.MANIFEST_CONFIG)) {
    _config = _.extend({}, rawManifest[manifest.MANIFEST_CONFIG]);
    delete rawManifest[manifest.MANIFEST_CONFIG];
  }

  manifest.map.addEach(rawManifest);

  return true;
};

/**
 * Kill all
 */
manifest.reset = function() {
  manifest.map = new Map();
  _manifestAr = false;
  _config = {cdnurl: ''};
  _manifestFile = '';
  // helper shortcuts
  manifest.get = manifest.map.get.bind(manifest.map);
  manifest.set = manifest.map.set.bind(manifest.map);
  manifest.has = manifest.map.has.bind(manifest.map);

};

/**
 * write back to the manifest file.
 *
 * @return {boolean} op success.
 */
manifest.save = function() {
  var manifestObj = manifest.map.toObject();
  manifestObj[ manifest.MANIFEST_CONFIG ] = _config;

  return grunt.file.write( _manifestFile, JSON.stringify( manifestObj, null, 4 ));
};

/**
 * Returns the manifest as an array including a new key 'asset' that contains
 * the original asset name (ie key)
 *
 * @return {Array} the manifest.
 */
manifest.toArray = function() {
  return this._manifestAr ||  (
    this._manifestAr = manifest.map.map( function(item, key) {
        item.asset = key;
        return item;
      }).toArray()
    );
};

/**
 * Set a manifest config param
 * @param {string} key
 * @param {*} value
 */
manifest.setConf = function( key, value ) {
  _config[key] = value;
};

/**
 * Get a config param.
 * @param  {string} key the key.
 * @return {*} any value.
 */
manifest.getConf = function ( key ) {
  return _config[key];
};

/**
 * @param  {string} asset the asset's name (key).
 * @return {string} asset full path to proper asset.
 */
manifest.asset = function(asset) {

  if (!manifest.map.has( asset )) { return asset; }

  var assetObj = manifest.get( asset );

  return ( path.join(_config.cdnurl + assetObj.relPath) ) || asset;
};
