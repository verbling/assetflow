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
    manifest = require('./asset-manifest'),
    async = require('async'),
    pace  = require('pace'),
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
  this.relPath = '';

  // show progress
  this._progress = false;

  // head counters, measure progress
  this._headCount = 0;
  this._paceHead = null;

  // s3 upload transfer
  this._paceUpload = null;

  this.s3lib = gruntS3.s3.init(grunt);
  this.s3Task = new gruntS3.S3Task({}, this.s3lib);

  this.options = this._getConfig( options, s3ops );

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
  var def = when.defer();

  if ( !manifest.init( this.options.manifest )) {
    return def.reject('manifest file error');
  }

  if ( !this.validateOptions()) {
    return def.reject('validation error');
  }

  var defS3head = this._checkS3Head();

  // wait for s3 head check to finish if it was enabled
  // and then start uploading task
  return when(defS3head).then(this._prepUpload.bind(this));

};


/**s
 * Prepare the execution of _startUpload, checks if there is a max operations
 * limit.
 *
 * @return {when.Promise} a promise.
 * @private
 */
s3stat.Task.prototype._prepUpload = function() {
  // get proper paths
  var uploadFiles = this._parseUploadFiles();

  if (0 === uploadFiles.length) {
    log.info('\nS3 Nothing new to upload.'.blue);
    return when.defer().resolve();
  }

  log.info('\nS3 files to upload: ' + (uploadFiles.length + '').cyan +
    ' Starting...'.green);

  if (this._progress) {
    this._paceUpload = pace( uploadFiles.length );
  }

  var def = when.defer();
  var execTime = helpers.execTime('s3upload');

  // check for limit
  if ( 0 < this.options.maxOperations ) {
    var alldefs = [];
    async.eachLimit(uploadFiles, this.options.maxOperations,
      function(item, cb){
        // execute without stopping on errors
        alldefs.push( this._startUpload(item).always(function(){cb();}) );
    }.bind(this), function() {
      when.all(alldefs).then(def.resolve, def.reject);
    });

  } else {
    when.map(uploadFiles, this._startUpload.bind(this))
      .then(def.resolve, def.reject);
  }

  return def.promise
    .then(function(){
      // execTime
      log.info('\nUpload Complete. Elapsed time: ' +
        execTime().yellow );

      execTime.reset();
    }.bind(this));
};

/**
 * check for S3 Head checking option
 *
 * @return {when.Promise} a promise
 */
s3stat.Task.prototype._checkS3Head = function() {

  var manifestArray = manifest.toArray();
  var def = when.defer();
  var promise;

  if ( !this.options.checkS3Head ) {
    this.uploadLineup = manifestArray;
    return def.resolve();
  }

  var totalAssets = manifestArray.length - 1;

  var execTime = helpers.execTime('s3head');

  log.info('\nCheck of S3 Head requested. ' + (totalAssets + '').cyan +
    ' assets to check.' + ' Starting...'.cyan);

  if ( this._progress ) {
    this._paceHead = pace(totalAssets);
  }

  // check for limit
  if ( 0 < this.options.maxOperations ) {
    var alldefs = [];
    async.eachLimit(manifestArray, this.options.maxOperations,
      function(item, cb){

        alldefs.push( this._s3Head(item).always(cb) );

    }.bind(this), function(){

      when.all(alldefs).then(def.resolve);
    });


    promise = def.promise;
  } else {
    promise = when.map(manifestArray, this._s3Head.bind(this));
  }

  return promise.then(function(){
    log.info('\nS3 Check complete.' + ' Total checks done: ' +
      (this._headCount + '').blue+ ' New files to upload: ' +
      (this.uploadLineup.length + '').cyan +
      ' elapsed time: ' + execTime().yellow);
    execTime.reset();
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

  if (!_.isString(assetObj.file)) {
    log.warn('Bogus. grunt could not expand file: ' + assetObj.absPath);
    return def.resolve();
  }

  if ( !this._progress ) {
    log.info('Uploading: ' + assetObj.file.blue + ' to ' + assetObj.dest.yellow);
  }

  var _def;

  try {
    _def = this.s3lib.upload(assetObj.file, assetObj.dest, assetObj.upload);
  } catch (ex) {
    return def.reject(ex+'');
  }
  _def.done(function(msg){
    if (this._progress) {
      this._paceUpload.op();
    } else {
      log.info(msg);
    }
    def.resolve();
  }.bind(this));

  _def.fail(function(err) {
    if (this._progress) {
      this._paceUpload.op();
    }
    def.reject(err);
  }.bind(this));

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
  var relPath;
  var sourceFile;

  this.uploadLineup.forEach(function(assetObj) {
    if ( !_.isString(assetObj.absPath)) {
      return;
    }
    if (this.uploadOpts.rel) {
      relPath = path.relative( this.relPath, assetObj.absPath);
      dest = path.join( this.destPath, relPath );
    }
    else {
      dest = path.join(this.destPath, path.basename(assetObj.relPath));
    }

    if(this.options.encodePaths === true) {
      dest = encodeURIComponent(dest);
    }

    sourceFile = grunt.file.expand(assetObj.absPath)[0];
    if (!sourceFile) {
      // doesn't exist
      return;
    }

    parsed.push(_.extend({}, assetObj, {
      dest: dest,
      file: sourceFile,
      upload: _.extend({}, this.uploadOpts, this.options, {
        // grunt-s3 treats debug differently.
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

  log.debug( this.debug, 's3stat.Task._s3Head() :: Req s3.HEAD' +
    ' ops,max:' + (this._opCount+'').cyan + ',' +
    (this.opThrottle+'').red + ' for: ' + (asset + '').blue);

  var s3assetPath = this._getS3assetPath( assetObj );

  this.s3client.headFile( s3assetPath, function(err, resp){

    if (err) {
      log.error('s3HEAD response error: ' + err );
      def.reject( err );
    }

    log.debug( this.debug, 's3stat.Task._s3Head() :: AWS Response: ' +
      'err,http,count,asset: ' + (err+'').red + ', ' +
      (resp.statusCode+'').yellow + ', ' + (++this._headCount + '').cyan +
      ', ' + s3assetPath.blue);

    if (this._progress) this._paceHead.op();

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
  s3path += assetObj.relPath;
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

    if ( this.uploadOpts.rel ) {
      this.relPath = grunt.file.expand({ filter: 'isDirectory' }, this.uploadOpts.rel )[0];
      if (!_.isString(this.relPath)) {
        log.error('!!!\nRelative path does not exist: '.red + this.uploadOpts.rel );
        return false;
      }
    }

  }

  this._progress = !!this.options.progress;

  this.opThrottle = Number(this.options.maxOperations);
  if ( isNaN(this.opThrottle) ) {
    this.opThrottle = assets.THROTTLE_OPS;
  }

  return true;
};

