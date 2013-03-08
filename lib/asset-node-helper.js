/**
 * The node helper provides convinience methods for handling assets in node.
 *
 *
 */

var manifest = require('./asset-manifest');

var node = module.exports = {};

/**
 * The configuration for node
 *
 * @param  {Object} conf the config object.
 * @return {boolean} If config parsed ok.
 * @throws {Error} If manifest file not found.
 */
node.config = function(conf) {

  if ( !manifest.init( conf.manifest ) ) {
    throw new Error('manifest file failed to initialize. Manifest: ' +
      conf.manifest);
  }
  return true;
};

/**
 * @param  {string} asset the asset's name (key).
 * @return {string} asset full path to proper asset.
 */
node.asset = function(asset) {
  return manifest.asset(asset);
};
