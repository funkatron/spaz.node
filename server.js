var http = require('http'),
	https = require('https'),
	url = require('url'),
	sys = require('sys'),
	cache = require('./cache');
  
var MAX_REDIRECTS = 10;
var ONE_HOUR = 1000 * 60 * 60;


var server = http.createServer(function (req, res) {
	var args = url.parse(req.url, true);
	if (args.query && args.query.url) {
		
		var passed_url = args.query.url;
		
		var resp_json = '';
		if ((resp_json = cache.get(passed_url))) {
			console.log('retrieved "'+passed_url+'" from cache');
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(resp_json);
		} else {
			resolver(passed_url, function(client_resp, last_url, redirects) {
			
				var resp_obj = {
					"passed_url":passed_url,
					"final_url":last_url,
					"redirects":redirects
				};
			
				if (client_resp.error) {
					resp_obj.error = client_resp.error;
					resp_obj.error_msg = client_resp.message;
				}
			
				var json_obj = JSON.stringify(resp_obj);
			
				cache.put(passed_url, json_obj, ONE_HOUR);
			
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(json_obj);
			});
		
		}
		
		
	} else {
	
		res.writeHead(200, { "Content-Type": "text/plain" });
		res.end("WTF?\n");
		
	}
});

// really shouldn't make this a global…
var last_url;

var resolver = function(passed_url, cb, redirects) {
	var port = 80;
	var httplib = http;
	
	if (!redirects) {
		redirects = 0;
	}
	
	last_url = passed_url;
	
	var url_parts = url.parse(passed_url);

	console.log(url_parts);

	if (url_parts.protocol === 'https:') {
		port = 443;
		httplib = https;
	}
	
	var opts = {
		'host':url_parts.host,
		'port':port,
		'path':url_parts.pathname,
		'method':'HEAD',
		'headers':{
			'User-Agent': 'curl/7.19.7 (i386-apple-darwin10.2.0) libcurl/7.19.7 OpenSSL/0.9.8l zlib/1.2.3',
			'Accept': '*/*'
		}
	};
	
	var client = httplib.request(opts, function(res) {
		console.log("==================== Got response: " + res.statusCode + " ============================");
		console.log('headers:', res.headers);
		
		// error
		if (res.statusCode >= 400 && res.statusCode < 600) {
			client.emit('http-error', {'message':res.statusCode});
			
		// redirect
		} else if (res.statusCode >= 300 && res.statusCode < 400) {
		
			if (redirects > MAX_REDIRECTS) {
		
				client.emit('redirect-error', {'message':'Exceeded maximum redirects'});
		
			} else if (res.headers.location) {
		
				redirects++;
				resolver(res.headers.location, cb, redirects);
		
			} else {
		
				client.emit('redirect-error', {'message':'couldn\'t find location header'});
		
			}
			
		// success
		} else if (res.statusCode >= 200 && res.statusCode < 300) {

			console.log(redirects);
			cb(res, last_url, redirects);

		}
		
	});
	client.end();
	
	// error handler
	client.on('error', function(e) {
		console.log("Got error: " + e.message);
		cb(e, last_url, redirects);
	});
	
	// redirect error
	client.on('redirect-error', function(e) {
		console.log("Got redirect-error: " + e.message);
		e.error = 'redirect-error';
		cb(e, last_url, redirects);
	});
	
	// http error
	client.on('http-error', function(e) {
		console.log("Got http-error: " + e.message);
		e.error = 'http-error';
		cb(e, last_url, redirects);
	});
	
};






server.listen(process.env.PORT || 8001);
