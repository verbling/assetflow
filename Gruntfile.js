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
        debug: true,
        truncateHash: 8,
        manifest: 'temp/manifest.json',
        cdnurl: 'http://s3.aws.com/testdelete/',
        maxOperations: 0,
        progress: false,
        rel: 'lib/'
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
        src: [
          'test/case/**',
          '!test/case/less/**',
          '!test/case/handlebars/**'
        ],
        dest: 'temp/testCase'
      },

      testCaseAbs: {
        options: {
          rel: 'test/case/',
          truncateHash: 6,
          manifest: 'temp/testManifestAbs.json',
          // force serialization of files so their order won't change on the
          // manifest file.
          maxOperations: 1,
          prepend: '/'
        },
        src: [
          'test/case/**',
          '!test/case/less/**',
          '!test/case/handlebars/**'
        ],
        dest: 'temp/testCaseAbs'
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
      },
      testCaseHbs: {
        options: {
          key: '{{asset "%"}}'
        },
        files: {
          'temp/handlebars/': ['test/case/handlebars/*.hbs']
        }
      },
      testCasePrepend: {
        options: {
          key: '__ASSET(%)',
          manifest: 'temp/testManifestAbs.json',
          prepend: '/'
        },
        files: {
          'temp/replace-prepend/': ['test/case/less/*.less']
        }
      }
    },

    assetsBundle: {
      options: {
        manifest: 'temp/testManifest.json',
        debug: false,
        assets:[
          'img/coding-weapons.png',
          'img/social-white-v2.png',
          'img/pdf-icon-bare.png'
        ]
      },
      testCase: {
        options: {
        },
        dest: 'temp/bundles/noexport.js'
      },
      testCaseNS: {
        options: {
          ns: 'car.zit.pof',
        },
        dest: 'temp/bundles/namespace.js'
      },
      testCaseAMD: {
        options: {
          amd: true,
        },
        dest: 'temp/bundles/amd.js'
      }


    },
    assetsS3: {
      options: {
        debug: false,
        checkS3Head: true,
        manifest: 'temp/testManifest.json',
        key: config.aws_key,
        secret: config.aws_secret,
        bucket: config.aws_static_bucket,
        access: 'public-read',
        progress: false
      },
      // Files to be uploaded.
      target: {
        // These options override the defaults
        options: {
          maxOperations: 0
        },
        upload: {
          src: 'temp/testCase/**',
          dest:  'testdelete/',
          rel: 'temp/testCase/test/case',
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
        'assetsBundle:testCase'
        //'assetsReplace:testCaseHbs'
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
    'assets:testCaseAbs',
    'assetsBundle:testCase',
    'assetsBundle:testCaseNS',
    'assetsBundle:testCaseAMD',
    'assetsReplace:testCase',
    'assetsReplace:testCasePrepend',
    'mochaTest'
  ]);

  grunt.registerTask('default', ['test']);


};

