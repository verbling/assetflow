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
    async = grunt.util.async,
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

  // the queue'd ops
  this._opQueue = [];

  // hold the assets that need to be uploaded
  this.uploadLineup = [];

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

  if ( this.options.checkS3Head ) {
    log.debug( this.options.debug, 'Check of S3 Head requested. Starting...'.cyan);
    defS3head = when.map(this.base.manifestArray(), this._s3Head.bind(this));
  } else {
    this.uploadLineup = this.base.manifestArray();
  }

  // wait for s3 head check to finish if it was enabled
  // and then start uploading task
  return when(defS3head).then( function() {
    return when.map(this.uploadLineup, this._startUpload.bind(this));
  }.bind(this));

};

/**
 *
 * @param  {Object} assetObj A manifest item.
 * @param  {when.Promise=} optDef when an op is resumed after being throttled
 *   the original deferred is provided so it can be resolved.
 * @return {when.Promise} a promise.
 * @private
 */
s3stat.Task.prototype._startUpload = function( assetObj, optDef ) {

  var def = optDef || when.defer();

  console.log(this.uploadLineup.length, assetObj.asset);

  def.resolve();
  return def.promise;

};

/**
 * [_s3Head description]
 * @param  {Object} assetObj A manifest item.
 * @param  {when.Promise=} optDef when an op is resumed after being throttled
 *   the original deferred is provided so it can be resolved.
 * @return {when.Promise} a promise.
 * @private
 */
s3stat.Task.prototype._s3Head = function( assetObj, optDef ) {

  var def = optDef || when.defer();

  // @type {string} asset the asset name (key).
  var asset = assetObj.asset || '';

  if ( assets.MANIFEST_CONFIG === asset ) {
    return def.resolve();
  }
  log.debug( this.debug, 's3stat.Task._s3Head() :: Req s3.HEAD' +
    ' ops,max:' + (this._opCount+'').cyan + ',' +
    (this.opThrottle+'').red + ' for: ' + asset.blue);

  //
  //
  // All these ops are async. Take care of total concurent operations
  //
  //

  // check if op needs to be throttled
  if ( this._opCount > this.opThrottle && 0 < this.opThrottle) {
    this._opQueue.push({
      assetObj: assetObj,
      def: def
    });
    return def.promise;
  }

  this._opCount++;
  def.promise.always(function() {
    this._opCount--;
    this._onOpFinish();
  }.bind(this));

  var s3assetPath = this._getS3assetPath( assetObj );

  log.debug( this.debug, 's3stat.Task._s3Head() :: sending req: '.grey +
    s3assetPath.grey.italic );


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

    if ( etag !== assetObj.hash ) {
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
  var s3path = '';

  if ( _.isObject(this.options.upload) ) {
    s3path += this.options.upload.dest || '';
  }

  s3path += assetObj.relpath;
  return s3path;
};

/**
 * Called everytime an operation finishes, will check if there are ops
 * in queue and run them...
 *
 * @private
 */
s3stat.Task.prototype._onOpFinish = function() {

  var freeSlots = this.opThrottle - this._opCount;
  var op;
  while(0 < freeSlots && 0 < this._opQueue.length ) {

    op = this._opQueue.shift();
    if ( !_.isObject(op) ) {
      break;
    }
    this._s3Head(op.assetObj, op.def);
    // recalc freeslots to avoid race conditions
    freeSlots = this.opThrottle - this._opCount;
  }
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
  this.opThrottle = Number(this.options.maxOperations);
  if ( isNaN(this.opThrottle) ) {
    this.opThrottle = assets.THROTTLE_OPS;
  }

  return true;
};

