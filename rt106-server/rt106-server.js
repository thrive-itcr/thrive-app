// Copyright (c) General Electric Company, 2017.  All rights reserved.

const PORT = 8306;

// If running with the Seed App as a Docker Container, use the line with 'web:80' below.
//const Rt106_URI = 'http://localhost:80';
const Rt106_URI = 'http://web:8106';

const express = require('express');
const winston = require('winston');
const request = require('request');
const cors    = require('cors');

const rt106server = express();
rt106server.use(cors());          // Allow CORS access.
rt106server.options('*', cors()); // Allow CORS preflight.

winston.debug("At top of local rt106-server.js");

/*
 // default route/interceptor for handling of CORS
 rt106server.use(function(req, res, next) {
 res.header("Access-Control-Allow-Origin", "*");
 res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
 res.header("Access-Control-Allow-Headers", "Authorization,Accept,Content-Type,X-Requested-With");
 next();
 });
 */

/*
 * Dynamically create the config.js file.
 * If the environment variable Rt106_SERVER_HOST is defined, that is used in config.js.  Otherwise localhost is used.
 * If the environment variable Rt106_APP_DIR is defined, that is the location where config.js needs to be.  Otherwise use rt106-app.
 */
var gulp = require('gulp');
var ngConstant = require('gulp-ng-constant');
var Rt106_SERVER_URL = 'http://localhost'; // Default value, may be changed below.
if (process.env.Rt106_SERVER_HOST !== undefined) {
    Rt106_SERVER_URL = 'http://' + process.env.Rt106_SERVER_HOST;
}
console.log("gulp setting Rt106_SERVER_URL to " + Rt106_SERVER_URL);
var Rt106_APP_DIR = 'rt106-app';
//if (process.env.Rt106_SERVE_APP !== undefined) {
//    Rt106_APP_DIR = process.env.Rt106_SERVE_APP;
//}
gulp.task('default', function() {
    gulp.src(Rt106_APP_DIR + '/config.json')
        .pipe(ngConstant({
            name: 'rt106.config',
            constants:
                {
                    Rt106_SERVER_URL: Rt106_SERVER_URL
                }
        }))
        .pipe(gulp.dest(Rt106_APP_DIR));
});
gulp.start('default');
/*
 * End of dynamic creation of config.js.
 */

rt106server.use('/', express.static('rt106-app') );
rt106server.use('/bower_components', express.static('bower_components') );

//winston.level = 'debug';
winston.level = 'info';

rt106server.listen(PORT);
console.log('listening on PORT ' + PORT);


rt106server.use('/v1/execution', function(req, res) {
    // Get the JSON from the message body.
    var msgStr = '';
    req.on("data", function (chunk) {
        msgStr += chunk.toString();
    });
    req.on("error", function(err) {
        winston.info("/v1/execution error receiving message. " + err);
        res.status(500).json("Error receiving message in /v1/execution: " + err);
        return next(err);
    });
    req.on("end", function() {
        var url = Rt106_URI + req.originalUrl;
        var forward = {
            url: url,
            method: req.method,
            body: msgStr
        }
        if ('authorization' in req.headers) {  // Note: node.js lowercases all header keys for easy comparison
            forward.headers = {};
            forward.headers['authorization'] = req.headers['authorization'];
        }
        request(forward).pipe(res);
    });
});

rt106server.use('/v1', function (req, res) {
    if (req.method === 'GET' || req.method === 'POST') {
        var url = req.originalUrl.replace(/^\/v1/, Rt106_URI + '/v1');
        var forward = {
            url: url,
            method: req.method
        }
        if ('authorization' in req.headers) {  // Note: node.js lowercases all header keys for easy comparison
            forward.headers = {};
            forward.headers['authorization'] = req.headers['authorization'];
        }
        request(forward).pipe(res);
    }
});

rt106server.use('/datastore/*', function (req, res) {
    if (req.method === 'GET' || req.method === 'POST') {
        var url = req.originalUrl.replace(/^\/datastore/, Rt106_URI + '/datastore');
        var forward = {
            url: url,
            method: req.method
        }
        if ('authorization' in req.headers) {  // Note: node.js lowercases all header keys for easy comparison
            forward.headers = {};
            forward.headers['authorization'] = req.headers['authorization'];
        }
        request(forward).pipe(res);
    }
});
