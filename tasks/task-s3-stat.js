/**
 * Will query S3 for file existense and create a list of
 * files that need to be uploaded.
 *
 */
var assetsS3  = require('../lib/asset-s3-stat');

module.exports = function(grunt) {

  grunt.registerMultiTask('assetsS3' , function() {
    var done = this.async();
    assetsS3.run(this.files, this.options(), this.target, this.data)
      .then(done)
      .otherwise(function(err){
        grunt.log.error('Operation failed: ' + (err + '').red);
        done(false);
      });

  });

};
