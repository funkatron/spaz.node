var http = require('http'),
	url = require('url'),
	sys = require('sys'),
	wwwdude = require('wwwdude');
  
var server = http.createServer(function (req, res) {
	var args = url.parse(req.url, true);
	if (args.query && args.query.url) {
		var passed_url = args.query.url;
		resolver(passed_url, function(data, client_resp, last_url) {
			res.writeHead(200, { "Content-Type": "text/plain" });
			res.end(passed_url+"=>"+last_url+"\n");
		});
	} else {
		res.writeHead(200, { "Content-Type": "text/plain" });
		res.end("WTF?\n");
	}
	
	
});


var resolver = function(passed_url, cb) {
	var client = wwwdude.createClient({
		headers: { 'User-Agent': 'wwwdude test 42' },
		gzip: true
	});
	
	var last_url = passed_url;

	client.get(passed_url)
		.addListener('error', function (err) {
			sys.puts('Network Error: ' + sys.inspect(err));
			})
		.addListener('http-error', function (data, resp) {
			sys.puts('HTTP Error for: ' + resp.host + ' code: ' + resp.statusCode);
			})
		.addListener('redirect', function (data, resp) {
			// sys.puts('Redirecting to: ' + resp.headers['location']);
			last_url = resp.headers['location'];
			// sys.puts('Headers: ' + sys.inspect(resp.headers));
			})
		.addListener('success', function (data, resp) {
			// sys.debug('Got data: ' + data);
			// sys.puts('Headers: ' + sys.inspect(resp.headers));
			// console.log(last_url);
			cb(data, resp, last_url);
		}).send();
};


server.listen(process.env.PORT || 8001);
