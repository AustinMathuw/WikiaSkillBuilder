
'use strict';

//Require npm-packages
const https = require('https');
var AWS = require('aws-sdk');
var s3 = new AWS.S3();
var fs = require('fs');

// fs.readFile('test.png', function (err, data) {
//   if (err) { throw err; }
//   console.log(data);
//   //var base64data = new Buffer(data, 'binary');

// //   s3.putObject({
// //     Bucket: 'austinmatthuw',
// //     Key: 'test.png',
// //     Body: base64data,
// //     ACL: 'public-read'
// //   },function (resp) {
// //     console.log(arguments);
// //     console.log('Successfully uploaded package.');
// //   });

// });

https.get("https://vignette4.wikia.nocookie.net/elite-dangerous/images/5/5b/Stinger2_closeup.png/revision/latest/scale-to-width-down/200?cb=20160209181549", function(res) {
    var data = [];
    res.on('data', function(chunk) {
    // Agregates chunks
        data.push(chunk);
    });
    res.on('end', function() {
        var buffer = Buffer.concat(data);
        console.log(buffer);
        var base64data = new Buffer(buffer, 'binary');
        s3.putObject({
            Bucket: 'austinmatthuw',
            Key: 'test.png',
            Body: base64data,
            ACL: 'public-read'
        },function (resp) {
            console.log(arguments);
            console.log('Successfully uploaded package.');
        });
    });
});