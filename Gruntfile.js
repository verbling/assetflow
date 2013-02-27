/*jshint camelcase:false */
/*
 * node-asset-pipeline
 * https://github.com/thanpolas/node-asset-pipeline
 *
 * Copyright (c) 2013 Thanasis Polychronakis
 * Licensed under the MIT license.
 */


module.exports = function( grunt ) {
  'use strict';


  var externsPath = 'build/externs/';

  //
  // Grunt configuration:
  //
  //
  grunt.initConfig({
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

