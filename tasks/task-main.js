/**
 * The bootstrap grunt file and library API exported
 *
 */
var helpers = require('grunt-ss-helpers'),
    assets  = require('../lib/asset-pipeline'),
    taskReplace = require('./task-replace'),
    nodeHelper = require('../lib/asset-node-helper'),
    manifest = require('../lib/asset-manifest'),
    assetsBundle = require('../lib/asset-bundle'),
    taskS3stat = require('./task-s3-stat.js');

module.exports = function(grunt) {

  // if grunt is not provided, then expose internal API
  if ('object' !== typeof(grunt)) {
    return {
      helpers: helpers,
      assets: assets,
      replace: taskReplace,
      config: nodeHelper.config,
      asset: nodeHelper.asset,
      assetsBundle: assetsBundle,
      manifest: manifest
    };
  }

  // overwrite helper's logging methods
  helpers.log = {
    warn: function(msg) { grunt.log.warn(msg); },
    info: function(msg) { grunt.log.writeln(msg); },
    error: function(msg) { grunt.log.error(msg); },
    debug: function(debug, msg) {
      if ( !debug ) return;
      grunt.log.writeln( 'debug :: '.blue + msg );
    }
  };
  grunt.registerMultiTask('assets' , function() {
    var done = this.async();

    var options = this.options();
    var target = this.target;

    assets.run(this.files, options, target)
      .then(done)
      .otherwise(function(err){
        helpers.log.error(err);
        done(false);
      });

  });


  grunt.registerMultiTask('assetsBundle' , function() {
    var done = this.async();
    assetsBundle.run(this.files.shift(), this.options(), this.target)
      .then(done)
      .otherwise(function(err){
        grunt.log.error('Operation failed: ' + (err + '').red);
        done(false);
      });
  });

  // initialize rest of the tasks
  taskReplace(grunt);
  taskS3stat(grunt);
};
