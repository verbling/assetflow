/**
 * Search and replace task based on  Grunt String Replace
 * by Erick Ruiz de Chavez https://github.com/erickrdch/grunt-string-replace
 *
 *
 */
var grunt = require('grunt'),
    stringReplace = require('grunt-string-replace')(),
    _        = grunt.util._,
    when = require('when'),
    regExpQuote = require('regexp-quote'),
    helpers  = require('grunt-ss-helpers'),
    log      = helpers.log,
    assets = require('./asset-pipeline');

var replace = module.exports = {};

/**
 * @const {string}
 */
replace.ASSET_PATTERN = '%';

/**
 * [run description]
 * @param  {Object} fileObj
 * @param  {Object} options
 * @param  {string} target
 * @return {when.Promise} a promise.
 */
replace.run = function( fileObj, options, target ) {
  var task = new replace.Task(fileObj, options, target);

  return task.run();
};

/**
 * [Task description]
 * @param  {Object} fileObj
 * @param  {Object} options
 * @param  {string} target
 * @return {when.Promise} a promise.
 */
replace.Task = function( fileObj, options, target ) {
  this.fileObj = fileObj;
  this.options = options;
  this.target = target;

  this.debug = false;

  this.base = new assets.Task(fileObj, options, target);

};

/**
 * [run description]
 * @return {when.Promise} a promise.
 */
replace.Task.prototype.run = function() {
  var def = when.defer();

  if ( !this.base.initManifest()) {
    return def.reject('manifest file error');
  }
  if ( !this.base.validateOptions()) {
    return def.reject('validation error');
  }

  var replaceKey = regExpQuote(this.options.key || '');

  var parsedReplace = replaceKey.replace(replace.ASSET_PATTERN, '([^\\)]*)');

  var replacements = [[
    new RegExp( parsedReplace, 'g'),
    this._regexCB.bind(this)
  ]];

  stringReplace.replace(this.fileObj, replacements);

  return def.resolve();
};


/**
 * The regex match callback, will scan the asset manifest for the asset
 * and return proper replacement string or fallback to whatever was there
 *
 * @param {string} matchString the whole matched string.
 * @param {string} asset the path to the asset only, will be used as key.
 * @return {string} The replaced matchString.
 */
replace.Task.prototype._regexCB = function(matchString, asset) {

  var manifestItem = this.base.manifest.get(asset);

  //
  // Check if there is no record in the manifest
  //
  if ( !_.isObject(manifestItem)) {
    // not in manifest (!) return string as is
    log.warn('Asset "' + asset.blue + '" could not be found in manifest. Using value as it is.');
    return asset;
  }

  return manifestItem.path;

};

