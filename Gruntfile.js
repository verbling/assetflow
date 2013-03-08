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
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-contrib-clean');

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
        cdnurl: 'http://s3.aws.com/testdelete/',
        maxOperations: 0,
        progress: false,
        rel: 'lib/'
      },
      targetName: {
        src: ['lib/asset-*.js', '!./node_modules/**/*.js', '!./temp/**/*.js'],
        dest: 'temp/assets'
      },

      testCase: {
        options: {
          rel: 'test/case/',
          truncateHash: 6,
          manifest: 'temp/testManifest.json',
          // force serialization of files so their order won't change on the
          // manifest file.
          maxOperations: 1
        },
        src: ['test/case/**', '!test/case/less/**'],
        dest: 'temp/testCase'
      }
    },

    assetsReplace: {
      options: {
        manifest: 'temp/testManifest.json'
      },
      testCase: {
        options: {
          key: '__ASSET(%)'
        },
        files: {
          'temp/replace-testCase/': ['test/case/less/*.less']
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
      debug: {
        files: ['*.js', 'lib/**/*.js', 'tasks/**/*.js'],
        tasks: [
        'assets'
        //'assetsS3'
        ]
      },
      test: {
        files: ['*.js', 'lib/**/*.js', 'tasks/**/*.js', 'test/spec/**/*.js'],
        tasks: ['test']
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
    clean: ['temp/*'],
    mochaTest: {
      gruntTasks: [ 'test/spec/**/*.js' ]
    },

    mochaTestConfig: {
      gruntTasks: {
        options: {
          reporter: 'nyan'
        }
      }
    }


  });

  grunt.registerTask('test', [
    'clean',
    'assets:testCase',
    'assetsReplace:testCase',
    'mochaTest'
  ]);

  grunt.registerTask('default', ['test']);


};

