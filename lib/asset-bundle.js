/**
 * The Bundler task reads the manifest and produces a bundle optimized
 * for use on the client.
 *
 *
 */
var grunt = require('grunt'),
    _        = require('underscore'),
    when = require('when'),
    helpers  = require('grunt-ss-helpers'),
    log      = helpers.log,
    manifest = require('./asset-manifest');

var bundle = module.exports = {};

/**
 * @param  {Object} fileObj
 * @param  {Object} options
 * @param  {string} target
 * @return {when.Promise} a promise.
 */
bundle.run = function( fileObj, options, target ) {
  var task = new bundle.Task(fileObj, options, target);

  return task.run();
};

/** @const {string} file to write result if eval breaks */
bundle.BROKEN_FILE = 'assetsBundle.broken.js';

/**
 * @param  {Object} fileObj
 * @param  {Object} options
 * @param  {string} target
 * @return {when.Promise} a promise.
 * @constructor
 */
bundle.Task = function( fileObj, options, target ) {
  this.fileObj = fileObj;
  this.options = options;
  this.target = target;

  this.debug = this.options.debug || false;

};

/**
 * @return {when.Promise} a promise.
 */
bundle.Task.prototype.run = function() {
  var def = when.defer();

  if ( !manifest.init( this.options.manifest )) {
    return def.reject('manifest file error');
  }

  var assetsToBundle = this.options.assets;

  if ( !_.isArray( assetsToBundle )) {
    log.error('option "assets" is not an array');
    return def.reject('assets option not an array');
  }

  // options
  this.nl = this.debug ? '\n' : '';

  var manifestBundle = {};
  assetsToBundle.forEach(function(asset) {
    manifestBundle[asset] = manifest.asset( asset );
  });

  return this.createJS( manifestBundle );
};

/**
 * @param  {Object} manifestBundle key/value pairs of strings.
 * @return {when.Promise}
 */
bundle.Task.prototype.createJS = function( manifestBundle ) {
  var def = when.defer();

  var nl = this.nl;

  var script = ';(function(){' + nl;

  script += 'var assets={};' + nl;

  for (var key in manifestBundle) {
    script += 'assets["' + key + '"]="' + manifestBundle[key] + '";' + nl;
  }

  // try to evaluate the output
  var tryScript = script + '})();' + nl;

  try {
    eval(tryScript);
  } catch(ex) {
    grunt.file.write(bundle.BROKEN_FILE, tryScript);
    log.error('Fatal: bundle output did not pass eval. Find output in' +
      ' "' + bundle.BROKEN_FILE +  '" file.');
    log.error('Eval Error: ' + (ex + '').red);
    return def.reject('result did not pass eval');
  }

  script = this.exportScript( script );

  script += '})();' + nl;

  grunt.file.write(this.fileObj.dest, script);

  return def.resolve();
};

/**
 * @param  {string} script script output.
 * @return {string} the script with the export.
 */
bundle.Task.prototype.exportScript = function( script ) {
  var nl = this.nl;

  var exported = false;

  if (this.options.amd) {
    script += 'define(function(){return assets;});' + nl;
    exported = true;
  }

  if (this.options.commonjs) {
    script += 'module.exports=assets;' + nl;
    exported = true;
  }

  if (this.options.ns) {
    var parts = this.options.ns.split('.');
    if (!_.isArray(parts)) {
      log.warning('Invalid namespace :' + (this.options.ns + '').red );
    } else {
      var paths = [];
      // pop out last item
      parts.pop();
      parts.forEach(function(part) {
        paths.push(part);
        script += 'window.' + paths.join('.') + '=window.' + paths.join('.') +
          '||{};' + nl;
      });

      script += 'window.' + this.options.ns + '=assets;' + nl;
      exported = true;
    }
  }

  if (!exported) {
    log.info('Exporting assets to defeault global namespace "ASSETS"');

    script += 'window.ASSETS=assets;' + nl;
  }

  return script;
};
