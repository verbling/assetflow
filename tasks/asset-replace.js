/**
 * The asset replacer grunt task
 *
 */
var assetsReplace  = require('../lib/asset-replace');

module.exports = function(grunt) {

  grunt.registerMultiTask('assetsReplace' , function() {
    var done = this.async();

    var options = this.options();
    var target = this.target;

    assetsReplace.run(this.files, options, target).then(done);

  });

};
