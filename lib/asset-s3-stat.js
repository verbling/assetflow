/*jshint camelcase:false */
/**
 * Will check S3 for each file in the manifest and see if it needs upload
 * using the HEAD s3 API call.
 *
 */
var grunt    = require('grunt'),
    gruntS3   = require('grunt-s3')(),
    path     = require('path'),
    knox     = require('knox'),
    helpers  = require('grunt-ss-helpers'),
    log      = helpers.log,
    _ = grunt.util._,
    assets = require('./asset-pipeline'),
    async = require('async'),
    when     = require('when');


var s3stat = module.exports = {};

/**
 * [run description]
 * @param  {Object} fileObj
 * @param  {Object} options
 * @param  {string} target
 * @param {Object} s3ops An object with s3 operations.
 * @return {when.Promise} a promise.
 */
s3stat.run = function( fileObj, options, target, s3ops ) {
  var task = new s3stat.Task(fileObj, options, target, s3ops);

  return task.run();
};

/**
 * [Task description]
 * @param  {Object} fileObj
 * @param  {Object} options
 * @param  {string} target
 * @param {Object} s3ops An object with s3 operations.
 * @return {when.Promise} a promise.
 * @constructor
 */
s3stat.Task = function( fileObj, options, target, s3ops ) {
  this.fileObj = fileObj;
  this.target = target;

  this.debug = false;

  // count operations
  this._opCount = 0;

  // hold the assets that need to be uploaded
  this.uploadLineup = [];

  // sanitized upload options object
  this.uploadOpts = {};
  this.destPath = '';

  this.s3lib = gruntS3.s3.init(grunt);
  this.s3Task = new gruntS3.S3Task({}, this.s3lib);

  this.options = this._getConfig( options, s3ops );

  this.base = new assets.Task(fileObj, this.options, target);

  // Pick out the configuration options we need for the client.
  this.s3client = knox.createClient(_(this.options).pick([
    'region', 'endpoint', 'port', 'key', 'secret', 'access', 'bucket', 'secure'
  ]));

};


/**
 * [run description]
 * @return {when.Promise} a promise.
 */
s3stat.Task.prototype.run = function() {
  var defS3head = when.defer().resolve();
  var def = when.defer();


  if ( !this.base.initManifest()) {
    return def.reject('manifest file error');
  }

  if ( !this.validateOptions()) {
    return def.reject('validation error');
  }

  var manifestArray = this.base.manifestArray();

  if ( this.options.checkS3Head ) {
    log.info('\nCheck of S3 Head requested.' + ' Starting...'.cyan);


    // check for limit
    if ( 0 < this.options.maxOperations ) {
      var alldefs = [];
      async.eachLimit(manifestArray, this.options.maxOperations,
        function(item, cb){
          alldefs.push( this._s3Head(item) );
          cb();
      }.bind(this));

      defS3head = when.all(alldefs);

    } else {
      defS3head = when.map(manifestArray, this._s3Head.bind(this));
    }

    defS3head.then(function(){
      log.info('S3 Check complete.' + ' New files to upload: '.cyan +
        (this.uploadLineup.length + '').cyan);
    }.bind(this));

  } else {
    this.uploadLineup = manifestArray;
  }

  // wait for s3 head check to finish if it was enabled
  // and then start uploading task
  return when(defS3head).then( function() {
    // get proper paths
    var uploadFiles = this._parseUploadFiles();

    return when.map(uploadFiles, this._startUpload.bind(this));
  }.bind(this));

};

/**
 *
 * @param  {Object} assetObj A manifest item.
 * @return {when.Promise} a promise.
 * @private
 */
s3stat.Task.prototype._startUpload = function( assetObj ) {

  var def = when.defer();

  log.info('Uploading: ' + assetObj.file.blue + ' to ' + assetObj.dest.yellow);

  var _def = this.s3lib.upload(assetObj.file, assetObj.dest, assetObj.upload);
  _def.done(function(msg){
    log.info(msg);
    def.resolve();
  });
  _def.fail(function(err) {
    log.error(err);
    def.reject(err);
  });

  return def.promise;

};

/**
 * Path resolving, combing, massaging etc...
 *
 * @return {Array} Array of Objects with proper values
 */
s3stat.Task.prototype._parseUploadFiles = function() {
  var parsed = [];

  var dest;
  var relResolve;
  var relPath;
  this.uploadLineup.forEach(function(assetObj) {

    if (this.uploadOpts.rel) {
      relResolve = grunt.file.expand({ filter: 'isDirectory' }, this.uploadOpts.rel )[0];
      relPath = path.relative( relResolve, assetObj.abspath);
      dest = path.join( this.destPath, relPath );
    }
    else {
      dest = path.join(this.destPath, path.basename(assetObj.relpath));
    }

    if(this.options.encodePaths === true) {
      dest = encodeURIComponent(dest);
    }


    parsed.push(_.extend({}, assetObj, {
      dest: dest,
      file: grunt.file.expand(assetObj.abspath)[0],
      upload: _.extend({}, this.uploadOpts, this.options, {
        // grunt-s3 treads debug differently.
        debug: false
      })
    }));

  }.bind(this));

  return parsed;
};

/**
 * [_s3Head description]
 * @param  {Object} assetObj A manifest item.
 * @return {when.Promise} a promise.
 * @private
 */
s3stat.Task.prototype._s3Head = function( assetObj ) {

  var def = when.defer();

  // @type {string} asset the asset name (key).
  var asset = assetObj.asset || '';

  if ( assets.MANIFEST_CONFIG === asset ) {
    return def.resolve();
  }

  log.debug( this.debug, 's3stat.Task._s3Head() :: Req s3.HEAD' +
    ' ops,max:' + (this._opCount+'').cyan + ',' +
    (this.opThrottle+'').red + ' for: ' + asset.blue);

  var s3assetPath = this._getS3assetPath( assetObj );

  this.s3client.headFile( s3assetPath, function(err, resp){
    log.debug( this.debug, 's3stat.Task._s3Head() :: AWS Response: ' +
      'err,http,asset: ' + (err+'').red + ', ' +
      (resp.statusCode+'').yellow + ', ' + s3assetPath.blue);

    if ( 200 !== resp.statusCode ) {
      this.uploadLineup.push(assetObj);
      return def.resolve();
    }

    // check for the etag
    var etag = resp.headers.etag || '';

    //
    //
    // The check everyone's waiting for.... !!
    //
    //
    if ( 0 <= [ assetObj.hash, assetObj.gzipHash ].indexOf( etag ) ) {
      this.uploadLineup.push(assetObj);
    }

    def.resolve();
  }.bind(this));

  return def.promise;
};

/**
 * Return the proper path for S3 for the provided asset object.
 *
 * @param  {Object} assetObj The asset object
 * @return {string} the path.
 */
s3stat.Task.prototype._getS3assetPath = function( assetObj ) {
  var s3path = this.uploadOpts.dest || '';
  s3path += assetObj.relpath;
  return s3path;
};


/**
 * // Grab the options for this task
 * @param  {Object} options options object.
 * @param  {Object} data operation instructions.
 * @return {Object} A normalized configuration.
 */
s3stat.Task.prototype._getConfig = function( options, data ) {
  return this.s3Task.getConfig( options, data );
};



/**
 * Perform granular validations on options
 * and define the internal params properties.
 *
 * @return {boolean}
 */
s3stat.Task.prototype.validateOptions = function() {

  this.debug = !!this.options.debug;

  if ( _.isObject(this.options.upload) ) {
    this.uploadOpts = this.options.upload;
    this.destPath = grunt.template.process( this.uploadOpts.dest || '');
  }



  this.opThrottle = Number(this.options.maxOperations);
  if ( isNaN(this.opThrottle) ) {
    this.opThrottle = assets.THROTTLE_OPS;
  }

  return true;
};

