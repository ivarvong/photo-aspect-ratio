var express = require('express');
var app = express();
var path = require('path');
var child_process = require('child_process');
var querystring = require('querystring');

var getTempPath = function(url) {
  var random = 'photo_' + (new Date()).getTime() + "_" + querystring.escape(url);
  return path.resolve(__dirname, "../tmp/", random);
}

var execCurl = function(url, callback) {
  var startTime = (new Date).getTime();
  var tempPath = getTempPath(url);
  child_process.execFile('curl', ['--silent', '-o', tempPath, url], function(err, stdout, stderr) {
    console.log("curl:", url, "=>", tempPath, ":", (new Date).getTime()-startTime+"ms");
    callback(err, tempPath);
  });
}

var execIdentify = function(tempPath, callback) {
  // using w=xxxx h=xxxx so we can regex the values out
  child_process.execFile('identify', ['-format', '"w=%w h=%h"', tempPath], function(err, stdout, stderr) {
    callback(err, stdout);
  });
}

var getAspectRatio = function(url, finalCallback) {
  var startTime = (new Date).getTime();

  execCurl(url, function(err, tempPath) {
    execIdentify(tempPath, function(err, stringData) {

      var width  = parseInt(stringData.match(/w=([0-9]{1,})/)[1], 10);
      var height = parseInt(stringData.match(/h=([0-9]{1,})/)[1], 10);

      if (width === 0 || height === 0) {
        // if we failed to download the file, identify will give w=0 h=0
        finalCallback("Error", null);
        return;
      }

      var data = {
        url: url,
        width: width,
        height: height,
        timeMS: (new Date).getTime() - startTime
      }
      finalCallback(err, data);

    });
  });
}

app.get('/', function (req, res) {
  res.send('OK');
});

// this is the main public endpoint:
app.get('/api/v1/', function(req, res) {
  var url = req.query.url;

  getAspectRatio(url, function(err, data) {
    if (err) {
      res.status(500).send("Error");
      return false;
    }

    res.json(data);
  });
});

app.get('/_test', function(req, res) {
  var url = "https://d1n0c1ufntxbvh.cloudfront.net/photo/4b40bc60/15118/360x/";
  expectedResult = {
    width: 360,
    height: 240
  }

  getAspectRatio(url, function(err, data) {
    if (err) {
      res.status(500).send("Error");
      return false;
    }

    if (data.width !== expectedResult.width && data.height !== expectedResult.height) {
      res.status(500).send("Expect Failed");
      return false;
    }

    res.send("OK");
  });
});

app.listen(process.env.PORT);
