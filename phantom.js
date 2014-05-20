// Generated by CoffeeScript 1.7.1
(function() {
  var child, dnode, http, onSignal, phanta, shoe, startPhantomProcess, wrap,
    __slice = [].slice;

  dnode = require('dnode');

  http = require('http');

  shoe = require('shoe');

  child = require('child_process');

  phanta = [];

  startPhantomProcess = function(binary, port, args) {
    return child.spawn(binary, args.concat([__dirname + '/shim.js', port]));
  };

  onSignal = function() {
    var phantom, _i, _len;
    for (_i = 0, _len = phanta.length; _i < _len; _i++) {
      phantom = phanta[_i];
      phantom.exit();
    }
    return process.exit();
  };

  process.on('exit', function() {
    var phantom, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = phanta.length; _i < _len; _i++) {
      phantom = phanta[_i];
      _results.push(phantom.exit());
    }
    return _results;
  });

  process.on('SIGINT', onSignal);

  process.on('SIGTERM', onSignal);

  wrap = function(ph) {
    ph._createPage = ph.createPage;
    return ph.createPage = function(cb) {
      return ph._createPage(function(page) {
        page._evaluate = page.evaluate;
        page.evaluate = function() {
          var args, cb, fn;
          fn = arguments[0], cb = arguments[1], args = 3 <= arguments.length ? __slice.call(arguments, 2) : [];
          return page._evaluate.apply(page, [fn.toString(), cb].concat(args));
        };
        page._onResourceRequested = page.onResourceRequested;
        page.onResourceRequested = function(fn, cb) {
          return page._onResourceRequested.apply(page, [fn.toString(), cb]);
        };
        return cb(page);
      });
    };
  };

  module.exports = {
    create: function() {
      var arg, args, cb, httpServer, options, phantom, sock, _i, _len;
      args = [];
      options = {};
      for (_i = 0, _len = arguments.length; _i < _len; _i++) {
        arg = arguments[_i];
        switch (typeof arg) {
          case 'function':
            cb = arg;
            break;
          case 'string':
            args.push(arg);
            break;
          case 'object':
            options = arg;
        }
      }
      if (options.binary == null) {
        options.binary = 'phantomjs';
      }
      if (options.port == null) {
        options.port = 0;
      }
      if (options.dnodeOpts == null) {
        options.dnodeOpts = {};
      }
      phantom = null;
      httpServer = http.createServer();
      httpServer.listen(options.port);
      httpServer.on('listening', function() {
        var port, ps;
        port = httpServer.address().port;
        ps = startPhantomProcess(options.binary, port, args);
        ps.stdout.on('data', options.onStdout || function(data) {
          return console.log("phantom stdout: " + data);
        });
        ps.stderr.on('data', options.onStderr || function(data) {
          return module.exports.stderrHandler(data.toString('utf8'));
        });
        ps.on('error', function(err) {
          if ((err != null ? err.code : void 0) === 'ENOENT') {
            return console.error("phantomjs-node: You don't have 'phantomjs' installed");
          } else {
            throw err;
          }
        });
        return ps.on('exit', function(code, signal) {
          var p;
          httpServer.close();
          if (phantom) {
            if (typeof phantom.onExit === "function") {
              phantom.onExit();
            }
            phanta = (function() {
              var _j, _len1, _results;
              _results = [];
              for (_j = 0, _len1 = phanta.length; _j < _len1; _j++) {
                p = phanta[_j];
                if (p !== phantom) {
                  _results.push(p);
                }
              }
              return _results;
            })();
          }
          if (options.onExit) {
            return options.onExit(code, signal);
          } else {
            console.assert(signal == null, "signal killed phantomjs: " + signal);
            return console.assert(code === 0, "abnormal phantomjs exit code: " + code);
          }
        });
      });
      sock = shoe(function(stream) {
        var d;
        d = dnode({}, options.dnodeOpts);
        d.on('remote', function(phantom) {
          wrap(phantom);
          phanta.push(phantom);
          return typeof cb === "function" ? cb(phantom) : void 0;
        });
        d.pipe(stream);
        return stream.pipe(d);
      });
      return sock.install(httpServer, '/dnode');
    },
    stderrHandler: function(message) {
      if (message.match(/(No such method.*socketSentData)|(CoreText performance note)/)) {
        return;
      }
      return console.warn("phantom stderr: " + message);
    }
  };

}).call(this);
