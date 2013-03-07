/*jshint camelcase:false */
/*
 * node-asset-pipeline
 * https://github.com/thanpolas/node-asset-pipeline
 *
 * Copyright (c) 2013 Verbling
 * Licensed under the MIT license.
 */

var config = require('config'),
    gruntAssets = require('./tasks/task-main');

module.exports = function( grunt ) {
  'use strict';

  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-s3');
  gruntAssets(grunt);

  //
  // Grunt configuration:
  //
  //
  grunt.initConfig({

    assets: {
      options: {
        debug: false,
        truncateHash: 8,
        manifest: 'temp/manifest.json',
        cdnurl: 'http://s3.aws.com/',
        maxOperations: 0,
        progress: true
      },
      targetName: {
        src: ['lib/asset-pipeline.js', '!./node_modules/**/*.js', '!./temp/**/*.js'],
        dest: 'temp/assets'
      }
    },

    assetsReplace: {
      options: {
        manifest: 'temp/manifest.json'
      },
      lessFiles: {
        options: {
          key: '__ASSET(%)'
        },
        files: {
          'temp/replace-out/': ['test/case/**/*.less']
        }
      }
    },

    assetsS3: {
      options: {
        debug: false,
        checkS3Head: false,
        manifest: 'temp/manifest.json',
        key: config.aws_key,
        secret: config.aws_secret,
        bucket: config.aws_static_bucket,
        access: 'public-read',
        progress: true
      },
      // Files to be uploaded.
      target: {
        // These options override the defaults
        options: {
          maxOperations: 0
        },
        upload: {
          src: 'temp/assets/**',
          dest:  'testdelete/',
          rel: 'temp/assets',
          gzip: true,
          gzipExclude: ['.jpeg', '.jpg', '.png', '.gif', '.less', '.mp3',
              '.mp4', '.mkv', '.webm', '.gz'],
          headers: {'Cache-Control': 'max-age=31536000, public'}
        }
      }
    },

    watch: {
      test: {
        files: ['*.js', 'lib/**/*.js', 'tasks/**/*.js'],
        tasks: [
        'assets',
        'assetsS3'
        ]
      }
    },

    s3: {
      options: {
        key: config.aws_key,
        secret: config.aws_secret,
        bucket: config.aws_static_bucket,
        access: 'public-read',
        maxOperations: 100
      },

      // Files to be uploaded.
      dev: {
        upload: [
          {
            src: 'temp/assets/**',
            dest:  'v/',
            rel: 'temp/assets',
            headers: {'Cache-Control': 'max-age=31536000, public'}
          }
        ]
      }
    },



    /**
     * TESTING
     *
     */
    mochaTest: {
      gruntTasks: [ 'test/grunt-task/**/*.js' ]
    },

    mochaTestConfig: {
      gruntTasks: {
        options: {
          reporter: 'nyan'
        }
      }
    }


  });


  grunt.registerTask('test', 'Test all or specific targets', function(target) {
    var gruntTest = [
      'mochaTest:gruntTasks'
    ];

    var webTest = [
    ];

    // clear temp folder
    grunt.file.expand( ['temp/*'] )
      .forEach( grunt.file.delete );

    //return;
    switch( target ) {
      case 'tasks':
      case 'grunt':
      case 'node':
        grunt.task.run(gruntTest);
      break;
      case 'web':
        grunt.task.run(webTest);
      break;
      default:
        grunt.task.run(webTest);
        grunt.task.run(gruntTest);
      break;
    }

  });

  grunt.registerTask('default', ['test']);


};

