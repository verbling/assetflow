/**
 * Search and replace task based on  Grunt String Replace
 * by Erick Ruiz de Chavez https://github.com/erickrdch/grunt-string-replace
 *
 *
 */
var stringReplace = require('grunt-string-replace')(),
    _        = require('underscore'),
    when = require('when'),
    regExpQuote = require('regexp-quote'),
    helpers  = require('grunt-ss-helpers'),
    log      = helpers.log,
    manifest = require('./asset-manifest');

var replace = module.exports = {};

/**
 * @const {string}
 */
replace.ASSET_PATTERN = '%';

/**
 * @const {string} regex to replace the ASSET_PATTERN, ripped from:
 *   http://regexlib.com/REDetails.aspx?regexp_id=146
 */
replace.REGEX_URL_PATH = '([a-zA-Z0-9\\\-\\\._\\\?\\\,\\\'/\\\\\\\+&amp;%\\\$#\\\=~]*)';

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

  this.prepend = '';

};

/**
 * [run description]
 * @return {when.Promise} a promise.
 */
replace.Task.prototype.run = function() {
  var def = when.defer();

  if (_.isString(this.options.prepend)) {
    this.prepend = this.options.prepend;
  }

  if ( !manifest.init( this.options.manifest )) {
    return def.reject('manifest file error');
  }

  var replaceKey = '';
  if (this.options.keyRegex && this.options.keyRegex.length ) {
    replaceKey = this.options.keyRegex;
  } else {
    replaceKey = regExpQuote(this.options.key || '');
  }

  var parsedReplace = replaceKey.replace(replace.ASSET_PATTERN,
    replace.REGEX_URL_PATH);

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
  var assetUse = this.prepend + asset;
  //
  // Check if there is no record in the manifest
  //
  if ( !manifest.has(assetUse)) {
    // not in manifest (!) return string as is
    log.warn('Asset "' + assetUse.blue + '" could not be found in manifest.' +
      ' Using value as it is.');
    return assetUse;
  }

  return manifest.asset(assetUse);
};
