/**
 * The node helper provides convinience methods for handling assets in node.
 *
 *
 */

var assets = require('./asset-pipeline');

var node = module.exports = {};

// the private config object.
var config = {};

// will hold an assets.Task instance
var assetTask;

var hasManifest = false;

/**
 * The configuration for node
 *
 * @param  {Object} conf the config object.
 * @return {boolean} If config parsed ok.
 * @throws {Error} If manifest file not found.
 */
node.config = function(conf) {
  config.manifest = conf.manifest || './' + assets.DEFAULT_MANIFEST;

  assetTask = new assets.Task([], {manifest: config.manifest}, '__inter');

  if ( !assetTask.initManifest() ) {
    throw new Error('manifest file failed to initialize. Manifest: ' +
      config.manifest);
  }

  return (hasManifest = true);

};

/**
 * @param  {string} asset the asset's name (key).
 * @return {string} asset full path to proper asset.
 */
node.asset = function(asset) {

  if (!hasManifest) { return asset; }
  if (!assetTask.manifest.has( asset )) { return asset; }

  var assetObj = assetTask.manifest.get( asset );
  var confObj  = {cdnurl: ''};
  if (assetTask.manifest.has( assets.MANIFEST_CONFIG )) {
    confObj = assetTask.manifest.get( assets.MANIFEST_CONFIG );
  }

  return (confObj.cdnurl + assetObj.relPath) || asset;
};
