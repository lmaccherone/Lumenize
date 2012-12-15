/*
Lumenize version: 0.5.0
*/
var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var cached = require.cache[resolved];
    var res = cached? cached.exports : mod();
    return res;
};

require.paths = [];
require.modules = {};
require.cache = {};
require.extensions = [".js",".coffee",".json"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            x = path.normalize(x);
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = path.normalize(x + '/package.json');
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key);
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

(function () {
    var process = {};
    var global = typeof window !== 'undefined' ? window : {};
    var definedProcess = false;
    
    require.define = function (filename, fn) {
        if (!definedProcess && require.modules.__browserify_process) {
            process = require.modules.__browserify_process();
            definedProcess = true;
        }
        
        var dirname = require._core[filename]
            ? ''
            : require.modules.path().dirname(filename)
        ;
        
        var require_ = function (file) {
            var requiredModule = require(file, dirname);
            var cached = require.cache[require.resolve(file, dirname)];

            if (cached && cached.parent === null) {
                cached.parent = module_;
            }

            return requiredModule;
        };
        require_.resolve = function (name) {
            return require.resolve(name, dirname);
        };
        require_.modules = require.modules;
        require_.define = require.define;
        require_.cache = require.cache;
        var module_ = {
            id : filename,
            filename: filename,
            exports : {},
            loaded : false,
            parent: null
        };
        
        require.modules[filename] = function () {
            require.cache[filename] = module_;
            fn.call(
                module_.exports,
                require_,
                module_,
                module_.exports,
                dirname,
                filename,
                process,
                global
            );
            module_.loaded = true;
            return module_.exports;
        };
    };
})();


require.define("path",function(require,module,exports,__dirname,__filename,process,global){function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

});

require.define("__browserify_process",function(require,module,exports,__dirname,__filename,process,global){var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
        && window.setImmediate;
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    if (name === 'evals') return (require)('vm')
    else throw new Error('No such module. (Possibly not yet loaded)')
};

(function () {
    var cwd = '/';
    var path;
    process.cwd = function () { return cwd };
    process.chdir = function (dir) {
        if (!path) path = require('path');
        cwd = path.resolve(dir, cwd);
    };
})();

});

require.define("/node_modules/files",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"tz/africa":"Rule\tAlgeria\t1916\tonly\t-\tJun\t14\t23:00s\t1:00\tS\n"+
"Rule\tAlgeria\t1916\t1919\t-\tOct\tSun>=1\t23:00s\t0\t-\n"+
"Rule\tAlgeria\t1917\tonly\t-\tMar\t24\t23:00s\t1:00\tS\n"+
"Rule\tAlgeria\t1918\tonly\t-\tMar\t 9\t23:00s\t1:00\tS\n"+
"Rule\tAlgeria\t1919\tonly\t-\tMar\t 1\t23:00s\t1:00\tS\n"+
"Rule\tAlgeria\t1920\tonly\t-\tFeb\t14\t23:00s\t1:00\tS\n"+
"Rule\tAlgeria\t1920\tonly\t-\tOct\t23\t23:00s\t0\t-\n"+
"Rule\tAlgeria\t1921\tonly\t-\tMar\t14\t23:00s\t1:00\tS\n"+
"Rule\tAlgeria\t1921\tonly\t-\tJun\t21\t23:00s\t0\t-\n"+
"Rule\tAlgeria\t1939\tonly\t-\tSep\t11\t23:00s\t1:00\tS\n"+
"Rule\tAlgeria\t1939\tonly\t-\tNov\t19\t 1:00\t0\t-\n"+
"Rule\tAlgeria\t1944\t1945\t-\tApr\tMon>=1\t 2:00\t1:00\tS\n"+
"Rule\tAlgeria\t1944\tonly\t-\tOct\t 8\t 2:00\t0\t-\n"+
"Rule\tAlgeria\t1945\tonly\t-\tSep\t16\t 1:00\t0\t-\n"+
"Rule\tAlgeria\t1971\tonly\t-\tApr\t25\t23:00s\t1:00\tS\n"+
"Rule\tAlgeria\t1971\tonly\t-\tSep\t26\t23:00s\t0\t-\n"+
"Rule\tAlgeria\t1977\tonly\t-\tMay\t 6\t 0:00\t1:00\tS\n"+
"Rule\tAlgeria\t1977\tonly\t-\tOct\t21\t 0:00\t0\t-\n"+
"Rule\tAlgeria\t1978\tonly\t-\tMar\t24\t 1:00\t1:00\tS\n"+
"Rule\tAlgeria\t1978\tonly\t-\tSep\t22\t 3:00\t0\t-\n"+
"Rule\tAlgeria\t1980\tonly\t-\tApr\t25\t 0:00\t1:00\tS\n"+
"Rule\tAlgeria\t1980\tonly\t-\tOct\t31\t 2:00\t0\t-\n"+
"Zone\tAfrica/Algiers\t0:12:12 -\tLMT\t1891 Mar 15 0:01\n"+
"\t\t\t0:09:21\t-\tPMT\t1911 Mar 11    # Paris Mean Time\n"+
"\t\t\t0:00\tAlgeria\tWE%sT\t1940 Feb 25 2:00\n"+
"\t\t\t1:00\tAlgeria\tCE%sT\t1946 Oct  7\n"+
"\t\t\t0:00\t-\tWET\t1956 Jan 29\n"+
"\t\t\t1:00\t-\tCET\t1963 Apr 14\n"+
"\t\t\t0:00\tAlgeria\tWE%sT\t1977 Oct 21\n"+
"\t\t\t1:00\tAlgeria\tCE%sT\t1979 Oct 26\n"+
"\t\t\t0:00\tAlgeria\tWE%sT\t1981 May\n"+
"\t\t\t1:00\t-\tCET\n"+
"Zone\tAfrica/Luanda\t0:52:56\t-\tLMT\t1892\n"+
"\t\t\t0:52:04\t-\tAOT\t1911 May 26 # Angola Time\n"+
"\t\t\t1:00\t-\tWAT\n"+
"Zone Africa/Porto-Novo\t0:10:28\t-\tLMT\t1912\n"+
"\t\t\t0:00\t-\tGMT\t1934 Feb 26\n"+
"\t\t\t1:00\t-\tWAT\n"+
"Zone\tAfrica/Gaborone\t1:43:40 -\tLMT\t1885\n"+
"\t\t\t2:00\t-\tCAT\t1943 Sep 19 2:00\n"+
"\t\t\t2:00\t1:00\tCAST\t1944 Mar 19 2:00\n"+
"\t\t\t2:00\t-\tCAT\n"+
"Zone Africa/Ouagadougou\t-0:06:04 -\tLMT\t1912\n"+
"\t\t\t 0:00\t-\tGMT\n"+
"Zone Africa/Bujumbura\t1:57:28\t-\tLMT\t1890\n"+
"\t\t\t2:00\t-\tCAT\n"+
"Zone\tAfrica/Douala\t0:38:48\t-\tLMT\t1912\n"+
"\t\t\t1:00\t-\tWAT\n"+
"Zone Atlantic/Cape_Verde -1:34:04 -\tLMT\t1907\t\t\t# Praia\n"+
"\t\t\t-2:00\t-\tCVT\t1942 Sep\n"+
"\t\t\t-2:00\t1:00\tCVST\t1945 Oct 15\n"+
"\t\t\t-2:00\t-\tCVT\t1975 Nov 25 2:00\n"+
"\t\t\t-1:00\t-\tCVT\n"+
"Zone\tAfrica/Bangui\t1:14:20\t-\tLMT\t1912\n"+
"\t\t\t1:00\t-\tWAT\n"+
"Zone\tAfrica/Ndjamena\t1:00:12 -\tLMT\t1912\n"+
"\t\t\t1:00\t-\tWAT\t1979 Oct 14\n"+
"\t\t\t1:00\t1:00\tWAST\t1980 Mar  8\n"+
"\t\t\t1:00\t-\tWAT\n"+
"Zone\tIndian/Comoro\t2:53:04 -\tLMT\t1911 Jul   # Moroni, Gran Comoro\n"+
"\t\t\t3:00\t-\tEAT\n"+
"Zone Africa/Kinshasa\t1:01:12 -\tLMT\t1897 Nov 9\n"+
"\t\t\t1:00\t-\tWAT\n"+
"Zone Africa/Lubumbashi\t1:49:52 -\tLMT\t1897 Nov 9\n"+
"\t\t\t2:00\t-\tCAT\n"+
"Zone Africa/Brazzaville\t1:01:08 -\tLMT\t1912\n"+
"\t\t\t1:00\t-\tWAT\n"+
"Zone\tAfrica/Abidjan\t-0:16:08 -\tLMT\t1912\n"+
"\t\t\t 0:00\t-\tGMT\n"+
"Zone\tAfrica/Djibouti\t2:52:36 -\tLMT\t1911 Jul\n"+
"\t\t\t3:00\t-\tEAT\n"+
"Rule\tEgypt\t1940\tonly\t-\tJul\t15\t0:00\t1:00\tS\n"+
"Rule\tEgypt\t1940\tonly\t-\tOct\t 1\t0:00\t0\t-\n"+
"Rule\tEgypt\t1941\tonly\t-\tApr\t15\t0:00\t1:00\tS\n"+
"Rule\tEgypt\t1941\tonly\t-\tSep\t16\t0:00\t0\t-\n"+
"Rule\tEgypt\t1942\t1944\t-\tApr\t 1\t0:00\t1:00\tS\n"+
"Rule\tEgypt\t1942\tonly\t-\tOct\t27\t0:00\t0\t-\n"+
"Rule\tEgypt\t1943\t1945\t-\tNov\t 1\t0:00\t0\t-\n"+
"Rule\tEgypt\t1945\tonly\t-\tApr\t16\t0:00\t1:00\tS\n"+
"Rule\tEgypt\t1957\tonly\t-\tMay\t10\t0:00\t1:00\tS\n"+
"Rule\tEgypt\t1957\t1958\t-\tOct\t 1\t0:00\t0\t-\n"+
"Rule\tEgypt\t1958\tonly\t-\tMay\t 1\t0:00\t1:00\tS\n"+
"Rule\tEgypt\t1959\t1981\t-\tMay\t 1\t1:00\t1:00\tS\n"+
"Rule\tEgypt\t1959\t1965\t-\tSep\t30\t3:00\t0\t-\n"+
"Rule\tEgypt\t1966\t1994\t-\tOct\t 1\t3:00\t0\t-\n"+
"Rule\tEgypt\t1982\tonly\t-\tJul\t25\t1:00\t1:00\tS\n"+
"Rule\tEgypt\t1983\tonly\t-\tJul\t12\t1:00\t1:00\tS\n"+
"Rule\tEgypt\t1984\t1988\t-\tMay\t 1\t1:00\t1:00\tS\n"+
"Rule\tEgypt\t1989\tonly\t-\tMay\t 6\t1:00\t1:00\tS\n"+
"Rule\tEgypt\t1990\t1994\t-\tMay\t 1\t1:00\t1:00\tS\n"+
"Rule\tEgypt\t1995\t2010\t-\tApr\tlastFri\t 0:00s\t1:00\tS\n"+
"Rule\tEgypt\t1995\t2005\t-\tSep\tlastThu\t23:00s\t0\t-\n"+
"Rule\tEgypt\t2006\tonly\t-\tSep\t21\t23:00s\t0\t-\n"+
"Rule\tEgypt\t2007\tonly\t-\tSep\tThu>=1\t23:00s\t0\t-\n"+
"Rule\tEgypt\t2008\tonly\t-\tAug\tlastThu\t23:00s\t0\t-\n"+
"Rule\tEgypt\t2009\tonly\t-\tAug\t20\t23:00s\t0\t-\n"+
"Rule\tEgypt\t2010\tonly\t-\tAug\t11\t0:00\t0\t-\n"+
"Rule\tEgypt\t2010\tonly\t-\tSep\t10\t0:00\t1:00\tS\n"+
"Rule\tEgypt\t2010\tonly\t-\tSep\tlastThu\t23:00s\t0\t-\n"+
"Zone\tAfrica/Cairo\t2:05:00 -\tLMT\t1900 Oct\n"+
"\t\t\t2:00\tEgypt\tEE%sT\n"+
"Zone\tAfrica/Malabo\t0:35:08 -\tLMT\t1912\n"+
"\t\t\t0:00\t-\tGMT\t1963 Dec 15\n"+
"\t\t\t1:00\t-\tWAT\n"+
"Zone\tAfrica/Asmara\t2:35:32 -\tLMT\t1870\n"+
"\t\t\t2:35:32\t-\tAMT\t1890\t      # Asmara Mean Time\n"+
"\t\t\t2:35:20\t-\tADMT\t1936 May 5    # Adis Dera MT\n"+
"\t\t\t3:00\t-\tEAT\n"+
"Zone Africa/Addis_Ababa\t2:34:48 -\tLMT\t1870\n"+
"\t\t\t2:35:20\t-\tADMT\t1936 May 5    # Adis Dera MT\n"+
"\t\t\t3:00\t-\tEAT\n"+
"Zone Africa/Libreville\t0:37:48 -\tLMT\t1912\n"+
"\t\t\t1:00\t-\tWAT\n"+
"Zone\tAfrica/Banjul\t-1:06:36 -\tLMT\t1912\n"+
"\t\t\t-1:06:36 -\tBMT\t1935\t# Banjul Mean Time\n"+
"\t\t\t-1:00\t-\tWAT\t1964\n"+
"\t\t\t 0:00\t-\tGMT\n"+
"Rule\tGhana\t1936\t1942\t-\tSep\t 1\t0:00\t0:20\tGHST\n"+
"Rule\tGhana\t1936\t1942\t-\tDec\t31\t0:00\t0\tGMT\n"+
"Zone\tAfrica/Accra\t-0:00:52 -\tLMT\t1918\n"+
"\t\t\t 0:00\tGhana\t%s\n"+
"Zone\tAfrica/Conakry\t-0:54:52 -\tLMT\t1912\n"+
"\t\t\t 0:00\t-\tGMT\t1934 Feb 26\n"+
"\t\t\t-1:00\t-\tWAT\t1960\n"+
"\t\t\t 0:00\t-\tGMT\n"+
"Zone\tAfrica/Bissau\t-1:02:20 -\tLMT\t1911 May 26\n"+
"\t\t\t-1:00\t-\tWAT\t1975\n"+
"\t\t\t 0:00\t-\tGMT\n"+
"Zone\tAfrica/Nairobi\t2:27:16\t-\tLMT\t1928 Jul\n"+
"\t\t\t3:00\t-\tEAT\t1930\n"+
"\t\t\t2:30\t-\tBEAT\t1940\n"+
"\t\t\t2:45\t-\tBEAUT\t1960\n"+
"\t\t\t3:00\t-\tEAT\n"+
"Zone\tAfrica/Maseru\t1:50:00 -\tLMT\t1903 Mar\n"+
"\t\t\t2:00\t-\tSAST\t1943 Sep 19 2:00\n"+
"\t\t\t2:00\t1:00\tSAST\t1944 Mar 19 2:00\n"+
"\t\t\t2:00\t-\tSAST\n"+
"Zone\tAfrica/Monrovia\t-0:43:08 -\tLMT\t1882\n"+
"\t\t\t-0:43:08 -\tMMT\t1919 Mar # Monrovia Mean Time\n"+
"\t\t\t-0:44:30 -\tLRT\t1972 May # Liberia Time\n"+
"\t\t\t 0:00\t-\tGMT\n"+
"Rule\tLibya\t1951\tonly\t-\tOct\t14\t2:00\t1:00\tS\n"+
"Rule\tLibya\t1952\tonly\t-\tJan\t 1\t0:00\t0\t-\n"+
"Rule\tLibya\t1953\tonly\t-\tOct\t 9\t2:00\t1:00\tS\n"+
"Rule\tLibya\t1954\tonly\t-\tJan\t 1\t0:00\t0\t-\n"+
"Rule\tLibya\t1955\tonly\t-\tSep\t30\t0:00\t1:00\tS\n"+
"Rule\tLibya\t1956\tonly\t-\tJan\t 1\t0:00\t0\t-\n"+
"Rule\tLibya\t1982\t1984\t-\tApr\t 1\t0:00\t1:00\tS\n"+
"Rule\tLibya\t1982\t1985\t-\tOct\t 1\t0:00\t0\t-\n"+
"Rule\tLibya\t1985\tonly\t-\tApr\t 6\t0:00\t1:00\tS\n"+
"Rule\tLibya\t1986\tonly\t-\tApr\t 4\t0:00\t1:00\tS\n"+
"Rule\tLibya\t1986\tonly\t-\tOct\t 3\t0:00\t0\t-\n"+
"Rule\tLibya\t1987\t1989\t-\tApr\t 1\t0:00\t1:00\tS\n"+
"Rule\tLibya\t1987\t1989\t-\tOct\t 1\t0:00\t0\t-\n"+
"Zone\tAfrica/Tripoli\t0:52:44 -\tLMT\t1920\n"+
"\t\t\t1:00\tLibya\tCE%sT\t1959\n"+
"\t\t\t2:00\t-\tEET\t1982\n"+
"\t\t\t1:00\tLibya\tCE%sT\t1990 May  4\n"+
"\t\t\t2:00\t-\tEET\t1996 Sep 30\n"+
"\t\t\t1:00\t-\tCET\t1997 Apr  4\n"+
"\t\t\t1:00\t1:00\tCEST\t1997 Oct  4\n"+
"\t\t\t2:00\t-\tEET\n"+
"Zone Indian/Antananarivo 3:10:04 -\tLMT\t1911 Jul\n"+
"\t\t\t3:00\t-\tEAT\t1954 Feb 27 23:00s\n"+
"\t\t\t3:00\t1:00\tEAST\t1954 May 29 23:00s\n"+
"\t\t\t3:00\t-\tEAT\n"+
"Zone\tAfrica/Blantyre\t2:20:00 -\tLMT\t1903 Mar\n"+
"\t\t\t2:00\t-\tCAT\n"+
"Zone\tAfrica/Bamako\t-0:32:00 -\tLMT\t1912\n"+
"\t\t\t 0:00\t-\tGMT\t1934 Feb 26\n"+
"\t\t\t-1:00\t-\tWAT\t1960 Jun 20\n"+
"\t\t\t 0:00\t-\tGMT\n"+
"Zone Africa/Nouakchott\t-1:03:48 -\tLMT\t1912\n"+
"\t\t\t 0:00\t-\tGMT\t1934 Feb 26\n"+
"\t\t\t-1:00\t-\tWAT\t1960 Nov 28\n"+
"\t\t\t 0:00\t-\tGMT\n"+
"Rule Mauritius\t1982\tonly\t-\tOct\t10\t0:00\t1:00\tS\n"+
"Rule Mauritius\t1983\tonly\t-\tMar\t21\t0:00\t0\t-\n"+
"Rule Mauritius\t2008\tonly\t-\tOct\tlastSun\t2:00\t1:00\tS\n"+
"Rule Mauritius\t2009\tonly\t-\tMar\tlastSun\t2:00\t0\t-\n"+
"Zone Indian/Mauritius\t3:50:00 -\tLMT\t1907\t\t# Port Louis\n"+
"\t\t\t4:00 Mauritius\tMU%sT\t# Mauritius Time\n"+
"Zone\tIndian/Mayotte\t3:00:56 -\tLMT\t1911 Jul\t# Mamoutzou\n"+
"\t\t\t3:00\t-\tEAT\n"+
"Rule\tMorocco\t1939\tonly\t-\tSep\t12\t 0:00\t1:00\tS\n"+
"Rule\tMorocco\t1939\tonly\t-\tNov\t19\t 0:00\t0\t-\n"+
"Rule\tMorocco\t1940\tonly\t-\tFeb\t25\t 0:00\t1:00\tS\n"+
"Rule\tMorocco\t1945\tonly\t-\tNov\t18\t 0:00\t0\t-\n"+
"Rule\tMorocco\t1950\tonly\t-\tJun\t11\t 0:00\t1:00\tS\n"+
"Rule\tMorocco\t1950\tonly\t-\tOct\t29\t 0:00\t0\t-\n"+
"Rule\tMorocco\t1967\tonly\t-\tJun\t 3\t12:00\t1:00\tS\n"+
"Rule\tMorocco\t1967\tonly\t-\tOct\t 1\t 0:00\t0\t-\n"+
"Rule\tMorocco\t1974\tonly\t-\tJun\t24\t 0:00\t1:00\tS\n"+
"Rule\tMorocco\t1974\tonly\t-\tSep\t 1\t 0:00\t0\t-\n"+
"Rule\tMorocco\t1976\t1977\t-\tMay\t 1\t 0:00\t1:00\tS\n"+
"Rule\tMorocco\t1976\tonly\t-\tAug\t 1\t 0:00\t0\t-\n"+
"Rule\tMorocco\t1977\tonly\t-\tSep\t28\t 0:00\t0\t-\n"+
"Rule\tMorocco\t1978\tonly\t-\tJun\t 1\t 0:00\t1:00\tS\n"+
"Rule\tMorocco\t1978\tonly\t-\tAug\t 4\t 0:00\t0\t-\n"+
"Rule\tMorocco\t2008\tonly\t-\tJun\t 1\t 0:00\t1:00\tS\n"+
"Rule\tMorocco\t2008\tonly\t-\tSep\t 1\t 0:00\t0\t-\n"+
"Rule\tMorocco\t2009\tonly\t-\tJun\t 1\t 0:00\t1:00\tS\n"+
"Rule\tMorocco\t2009\tonly\t-\tAug\t 21\t 0:00\t0\t-\n"+
"Rule\tMorocco\t2010\tonly\t-\tMay\t 2\t 0:00\t1:00\tS\n"+
"Rule\tMorocco\t2010\tonly\t-\tAug\t 8\t 0:00\t0\t-\n"+
"Rule\tMorocco\t2011\tonly\t-\tApr\t 3\t 0:00\t1:00\tS\n"+
"Rule\tMorocco\t2011\tonly\t-\tJul\t 31\t 0\t0\t-\n"+
"Zone Africa/Casablanca\t-0:30:20 -\tLMT\t1913 Oct 26\n"+
"\t\t\t 0:00\tMorocco\tWE%sT\t1984 Mar 16\n"+
"\t\t\t 1:00\t-\tCET\t1986\n"+
"\t\t\t 0:00\tMorocco\tWE%sT\n"+
"Zone Africa/El_Aaiun\t-0:52:48 -\tLMT\t1934 Jan\n"+
"\t\t\t-1:00\t-\tWAT\t1976 Apr 14\n"+
"\t\t\t 0:00\t-\tWET\n"+
"Zone\tAfrica/Maputo\t2:10:20 -\tLMT\t1903 Mar\n"+
"\t\t\t2:00\t-\tCAT\n"+
"Rule\tNamibia\t1994\tmax\t-\tSep\tSun>=1\t2:00\t1:00\tS\n"+
"Rule\tNamibia\t1995\tmax\t-\tApr\tSun>=1\t2:00\t0\t-\n"+
"Zone\tAfrica/Windhoek\t1:08:24 -\tLMT\t1892 Feb 8\n"+
"\t\t\t1:30\t-\tSWAT\t1903 Mar\t# SW Africa Time\n"+
"\t\t\t2:00\t-\tSAST\t1942 Sep 20 2:00\n"+
"\t\t\t2:00\t1:00\tSAST\t1943 Mar 21 2:00\n"+
"\t\t\t2:00\t-\tSAST\t1990 Mar 21 # independence\n"+
"\t\t\t2:00\t-\tCAT\t1994 Apr  3\n"+
"\t\t\t1:00\tNamibia\tWA%sT\n"+
"Zone\tAfrica/Niamey\t 0:08:28 -\tLMT\t1912\n"+
"\t\t\t-1:00\t-\tWAT\t1934 Feb 26\n"+
"\t\t\t 0:00\t-\tGMT\t1960\n"+
"\t\t\t 1:00\t-\tWAT\n"+
"Zone\tAfrica/Lagos\t0:13:36 -\tLMT\t1919 Sep\n"+
"\t\t\t1:00\t-\tWAT\n"+
"Zone\tIndian/Reunion\t3:41:52 -\tLMT\t1911 Jun\t# Saint-Denis\n"+
"\t\t\t4:00\t-\tRET\t# Reunion Time\n"+
"Zone\tAfrica/Kigali\t2:00:16 -\tLMT\t1935 Jun\n"+
"\t\t\t2:00\t-\tCAT\n"+
"Zone Atlantic/St_Helena\t-0:22:48 -\tLMT\t1890\t\t# Jamestown\n"+
"\t\t\t-0:22:48 -\tJMT\t1951\t# Jamestown Mean Time\n"+
"\t\t\t 0:00\t-\tGMT\n"+
"Zone\tAfrica/Sao_Tome\t 0:26:56 -\tLMT\t1884\n"+
"\t\t\t-0:36:32 -\tLMT\t1912\t# Lisbon Mean Time\n"+
"\t\t\t 0:00\t-\tGMT\n"+
"Zone\tAfrica/Dakar\t-1:09:44 -\tLMT\t1912\n"+
"\t\t\t-1:00\t-\tWAT\t1941 Jun\n"+
"\t\t\t 0:00\t-\tGMT\n"+
"Zone\tIndian/Mahe\t3:41:48 -\tLMT\t1906 Jun\t# Victoria\n"+
"\t\t\t4:00\t-\tSCT\t# Seychelles Time\n"+
"Rule\tSL\t1935\t1942\t-\tJun\t 1\t0:00\t0:40\tSLST\n"+
"Rule\tSL\t1935\t1942\t-\tOct\t 1\t0:00\t0\tWAT\n"+
"Rule\tSL\t1957\t1962\t-\tJun\t 1\t0:00\t1:00\tSLST\n"+
"Rule\tSL\t1957\t1962\t-\tSep\t 1\t0:00\t0\tGMT\n"+
"Zone\tAfrica/Freetown\t-0:53:00 -\tLMT\t1882\n"+
"\t\t\t-0:53:00 -\tFMT\t1913 Jun # Freetown Mean Time\n"+
"\t\t\t-1:00\tSL\t%s\t1957\n"+
"\t\t\t 0:00\tSL\t%s\n"+
"Zone Africa/Mogadishu\t3:01:28 -\tLMT\t1893 Nov\n"+
"\t\t\t3:00\t-\tEAT\t1931\n"+
"\t\t\t2:30\t-\tBEAT\t1957\n"+
"\t\t\t3:00\t-\tEAT\n"+
"Rule\tSA\t1942\t1943\t-\tSep\tSun>=15\t2:00\t1:00\t-\n"+
"Rule\tSA\t1943\t1944\t-\tMar\tSun>=15\t2:00\t0\t-\n"+
"Zone Africa/Johannesburg 1:52:00 -\tLMT\t1892 Feb 8\n"+
"\t\t\t1:30\t-\tSAST\t1903 Mar\n"+
"\t\t\t2:00\tSA\tSAST\n"+
"Rule\tSudan\t1970\tonly\t-\tMay\t 1\t0:00\t1:00\tS\n"+
"Rule\tSudan\t1970\t1985\t-\tOct\t15\t0:00\t0\t-\n"+
"Rule\tSudan\t1971\tonly\t-\tApr\t30\t0:00\t1:00\tS\n"+
"Rule\tSudan\t1972\t1985\t-\tApr\tlastSun\t0:00\t1:00\tS\n"+
"Zone\tAfrica/Khartoum\t2:10:08 -\tLMT\t1931\n"+
"\t\t\t2:00\tSudan\tCA%sT\t2000 Jan 15 12:00\n"+
"\t\t\t3:00\t-\tEAT\n"+
"Zone\tAfrica/Juba\t2:06:24 -\tLMT\t1931\n"+
"\t\t\t2:00\tSudan\tCA%sT\t2000 Jan 15 12:00\n"+
"\t\t\t3:00\t-\tEAT\n"+
"Zone\tAfrica/Mbabane\t2:04:24 -\tLMT\t1903 Mar\n"+
"\t\t\t2:00\t-\tSAST\n"+
"Zone Africa/Dar_es_Salaam 2:37:08 -\tLMT\t1931\n"+
"\t\t\t3:00\t-\tEAT\t1948\n"+
"\t\t\t2:45\t-\tBEAUT\t1961\n"+
"\t\t\t3:00\t-\tEAT\n"+
"Zone\tAfrica/Lome\t0:04:52 -\tLMT\t1893\n"+
"\t\t\t0:00\t-\tGMT\n"+
"Rule\tTunisia\t1939\tonly\t-\tApr\t15\t23:00s\t1:00\tS\n"+
"Rule\tTunisia\t1939\tonly\t-\tNov\t18\t23:00s\t0\t-\n"+
"Rule\tTunisia\t1940\tonly\t-\tFeb\t25\t23:00s\t1:00\tS\n"+
"Rule\tTunisia\t1941\tonly\t-\tOct\t 6\t 0:00\t0\t-\n"+
"Rule\tTunisia\t1942\tonly\t-\tMar\t 9\t 0:00\t1:00\tS\n"+
"Rule\tTunisia\t1942\tonly\t-\tNov\t 2\t 3:00\t0\t-\n"+
"Rule\tTunisia\t1943\tonly\t-\tMar\t29\t 2:00\t1:00\tS\n"+
"Rule\tTunisia\t1943\tonly\t-\tApr\t17\t 2:00\t0\t-\n"+
"Rule\tTunisia\t1943\tonly\t-\tApr\t25\t 2:00\t1:00\tS\n"+
"Rule\tTunisia\t1943\tonly\t-\tOct\t 4\t 2:00\t0\t-\n"+
"Rule\tTunisia\t1944\t1945\t-\tApr\tMon>=1\t 2:00\t1:00\tS\n"+
"Rule\tTunisia\t1944\tonly\t-\tOct\t 8\t 0:00\t0\t-\n"+
"Rule\tTunisia\t1945\tonly\t-\tSep\t16\t 0:00\t0\t-\n"+
"Rule\tTunisia\t1977\tonly\t-\tApr\t30\t 0:00s\t1:00\tS\n"+
"Rule\tTunisia\t1977\tonly\t-\tSep\t24\t 0:00s\t0\t-\n"+
"Rule\tTunisia\t1978\tonly\t-\tMay\t 1\t 0:00s\t1:00\tS\n"+
"Rule\tTunisia\t1978\tonly\t-\tOct\t 1\t 0:00s\t0\t-\n"+
"Rule\tTunisia\t1988\tonly\t-\tJun\t 1\t 0:00s\t1:00\tS\n"+
"Rule\tTunisia\t1988\t1990\t-\tSep\tlastSun\t 0:00s\t0\t-\n"+
"Rule\tTunisia\t1989\tonly\t-\tMar\t26\t 0:00s\t1:00\tS\n"+
"Rule\tTunisia\t1990\tonly\t-\tMay\t 1\t 0:00s\t1:00\tS\n"+
"Rule\tTunisia\t2005\tonly\t-\tMay\t 1\t 0:00s\t1:00\tS\n"+
"Rule\tTunisia\t2005\tonly\t-\tSep\t30\t 1:00s\t0\t-\n"+
"Rule\tTunisia\t2006\t2008\t-\tMar\tlastSun\t 2:00s\t1:00\tS\n"+
"Rule\tTunisia\t2006\t2008\t-\tOct\tlastSun\t 2:00s\t0\t-\n"+
"Zone\tAfrica/Tunis\t0:40:44 -\tLMT\t1881 May 12\n"+
"\t\t\t0:09:21\t-\tPMT\t1911 Mar 11    # Paris Mean Time\n"+
"\t\t\t1:00\tTunisia\tCE%sT\n"+
"Zone\tAfrica/Kampala\t2:09:40 -\tLMT\t1928 Jul\n"+
"\t\t\t3:00\t-\tEAT\t1930\n"+
"\t\t\t2:30\t-\tBEAT\t1948\n"+
"\t\t\t2:45\t-\tBEAUT\t1957\n"+
"\t\t\t3:00\t-\tEAT\n"+
"Zone\tAfrica/Lusaka\t1:53:08 -\tLMT\t1903 Mar\n"+
"\t\t\t2:00\t-\tCAT\n"+
"Zone\tAfrica/Harare\t2:04:12 -\tLMT\t1903 Mar\n"+
"\t\t\t2:00\t-\tCAT\n"+
"","tz/antarctica":"Rule\tArgAQ\t1964\t1966\t-\tMar\t 1\t0:00\t0\t-\n"+
"Rule\tArgAQ\t1964\t1966\t-\tOct\t15\t0:00\t1:00\tS\n"+
"Rule\tArgAQ\t1967\tonly\t-\tApr\t 2\t0:00\t0\t-\n"+
"Rule\tArgAQ\t1967\t1968\t-\tOct\tSun>=1\t0:00\t1:00\tS\n"+
"Rule\tArgAQ\t1968\t1969\t-\tApr\tSun>=1\t0:00\t0\t-\n"+
"Rule\tArgAQ\t1974\tonly\t-\tJan\t23\t0:00\t1:00\tS\n"+
"Rule\tArgAQ\t1974\tonly\t-\tMay\t 1\t0:00\t0\t-\n"+
"Rule\tChileAQ\t1972\t1986\t-\tMar\tSun>=9\t3:00u\t0\t-\n"+
"Rule\tChileAQ\t1974\t1987\t-\tOct\tSun>=9\t4:00u\t1:00\tS\n"+
"Rule\tChileAQ\t1987\tonly\t-\tApr\t12\t3:00u\t0\t-\n"+
"Rule\tChileAQ\t1988\t1989\t-\tMar\tSun>=9\t3:00u\t0\t-\n"+
"Rule\tChileAQ\t1988\tonly\t-\tOct\tSun>=1\t4:00u\t1:00\tS\n"+
"Rule\tChileAQ\t1989\tonly\t-\tOct\tSun>=9\t4:00u\t1:00\tS\n"+
"Rule\tChileAQ\t1990\tonly\t-\tMar\t18\t3:00u\t0\t-\n"+
"Rule\tChileAQ\t1990\tonly\t-\tSep\t16\t4:00u\t1:00\tS\n"+
"Rule\tChileAQ\t1991\t1996\t-\tMar\tSun>=9\t3:00u\t0\t-\n"+
"Rule\tChileAQ\t1991\t1997\t-\tOct\tSun>=9\t4:00u\t1:00\tS\n"+
"Rule\tChileAQ\t1997\tonly\t-\tMar\t30\t3:00u\t0\t-\n"+
"Rule\tChileAQ\t1998\tonly\t-\tMar\tSun>=9\t3:00u\t0\t-\n"+
"Rule\tChileAQ\t1998\tonly\t-\tSep\t27\t4:00u\t1:00\tS\n"+
"Rule\tChileAQ\t1999\tonly\t-\tApr\t 4\t3:00u\t0\t-\n"+
"Rule\tChileAQ\t1999\tmax\t-\tOct\tSun>=9\t4:00u\t1:00\tS\n"+
"Rule\tChileAQ\t2000\tmax\t-\tMar\tSun>=9\t3:00u\t0\t-\n"+
"Rule\tAusAQ\t1917\tonly\t-\tJan\t 1\t0:01\t1:00\t-\n"+
"Rule\tAusAQ\t1917\tonly\t-\tMar\t25\t2:00\t0\t-\n"+
"Rule\tAusAQ\t1942\tonly\t-\tJan\t 1\t2:00\t1:00\t-\n"+
"Rule\tAusAQ\t1942\tonly\t-\tMar\t29\t2:00\t0\t-\n"+
"Rule\tAusAQ\t1942\tonly\t-\tSep\t27\t2:00\t1:00\t-\n"+
"Rule\tAusAQ\t1943\t1944\t-\tMar\tlastSun\t2:00\t0\t-\n"+
"Rule\tAusAQ\t1943\tonly\t-\tOct\t 3\t2:00\t1:00\t-\n"+
"Rule\tATAQ\t1967\tonly\t-\tOct\tSun>=1\t2:00s\t1:00\t-\n"+
"Rule\tATAQ\t1968\tonly\t-\tMar\tlastSun\t2:00s\t0\t-\n"+
"Rule\tATAQ\t1968\t1985\t-\tOct\tlastSun\t2:00s\t1:00\t-\n"+
"Rule\tATAQ\t1969\t1971\t-\tMar\tSun>=8\t2:00s\t0\t-\n"+
"Rule\tATAQ\t1972\tonly\t-\tFeb\tlastSun\t2:00s\t0\t-\n"+
"Rule\tATAQ\t1973\t1981\t-\tMar\tSun>=1\t2:00s\t0\t-\n"+
"Rule\tATAQ\t1982\t1983\t-\tMar\tlastSun\t2:00s\t0\t-\n"+
"Rule\tATAQ\t1984\t1986\t-\tMar\tSun>=1\t2:00s\t0\t-\n"+
"Rule\tATAQ\t1986\tonly\t-\tOct\tSun>=15\t2:00s\t1:00\t-\n"+
"Rule\tATAQ\t1987\t1990\t-\tMar\tSun>=15\t2:00s\t0\t-\n"+
"Rule\tATAQ\t1987\tonly\t-\tOct\tSun>=22\t2:00s\t1:00\t-\n"+
"Rule\tATAQ\t1988\t1990\t-\tOct\tlastSun\t2:00s\t1:00\t-\n"+
"Rule\tATAQ\t1991\t1999\t-\tOct\tSun>=1\t2:00s\t1:00\t-\n"+
"Rule\tATAQ\t1991\t2005\t-\tMar\tlastSun\t2:00s\t0\t-\n"+
"Rule\tATAQ\t2000\tonly\t-\tAug\tlastSun\t2:00s\t1:00\t-\n"+
"Rule\tATAQ\t2001\tmax\t-\tOct\tSun>=1\t2:00s\t1:00\t-\n"+
"Rule\tATAQ\t2006\tonly\t-\tApr\tSun>=1\t2:00s\t0\t-\n"+
"Rule\tATAQ\t2007\tonly\t-\tMar\tlastSun\t2:00s\t0\t-\n"+
"Rule\tATAQ\t2008\tmax\t-\tApr\tSun>=1\t2:00s\t0\t-\n"+
"Zone Antarctica/Casey\t0\t-\tzzz\t1969\n"+
"\t\t\t8:00\t-\tWST\t2009 Oct 18 2:00\n"+
"\t\t\t\t\t\t# Western (Aus) Standard Time\n"+
"\t\t\t11:00\t-\tCAST\t2010 Mar 5 2:00\n"+
"\t\t\t\t\t\t# Casey Time\n"+
"\t\t\t8:00\t-\tWST\n"+
"Zone Antarctica/Davis\t0\t-\tzzz\t1957 Jan 13\n"+
"\t\t\t7:00\t-\tDAVT\t1964 Nov # Davis Time\n"+
"\t\t\t0\t-\tzzz\t1969 Feb\n"+
"\t\t\t7:00\t-\tDAVT\t2009 Oct 18 2:00\n"+
"\t\t\t5:00\t-\tDAVT\t2010 Mar 10 20:00u\n"+
"\t\t\t7:00\t-\tDAVT\n"+
"Zone Antarctica/Mawson\t0\t-\tzzz\t1954 Feb 13\n"+
"\t\t\t6:00\t-\tMAWT\t2009 Oct 18 2:00\n"+
"\t\t\t\t\t\t# Mawson Time\n"+
"\t\t\t5:00\t-\tMAWT\n"+
"Zone Antarctica/Macquarie 0\t-\tzzz\t1911\n"+
"\t\t\t10:00\t-\tEST\t1916 Oct 1 2:00\n"+
"\t\t\t10:00\t1:00\tEST\t1917 Feb\n"+
"\t\t\t10:00\tAusAQ\tEST\t1967\n"+
"\t\t\t10:00\tATAQ\tEST\t2010 Apr 4 3:00\n"+
"\t\t\t11:00\t-\tMIST\t# Macquarie Island Time\n"+
"Zone Indian/Kerguelen\t0\t-\tzzz\t1950\t# Port-aux-Francais\n"+
"\t\t\t5:00\t-\tTFT\t# ISO code TF Time\n"+
"Zone Antarctica/DumontDUrville 0 -\tzzz\t1947\n"+
"\t\t\t10:00\t-\tPMT\t1952 Jan 14 # Port-Martin Time\n"+
"\t\t\t0\t-\tzzz\t1956 Nov\n"+
"\t\t\t10:00\t-\tDDUT\t# Dumont-d'Urville Time\n"+
"Zone Antarctica/Syowa\t0\t-\tzzz\t1957 Jan 29\n"+
"\t\t\t3:00\t-\tSYOT\t# Syowa Time\n"+
"Rule\tNZAQ\t1974\tonly\t-\tNov\t 3\t2:00s\t1:00\tD\n"+
"Rule\tNZAQ\t1975\t1988\t-\tOct\tlastSun\t2:00s\t1:00\tD\n"+
"Rule\tNZAQ\t1989\tonly\t-\tOct\t 8\t2:00s\t1:00\tD\n"+
"Rule\tNZAQ\t1990\t2006\t-\tOct\tSun>=1\t2:00s\t1:00\tD\n"+
"Rule\tNZAQ\t1975\tonly\t-\tFeb\t23\t2:00s\t0\tS\n"+
"Rule\tNZAQ\t1976\t1989\t-\tMar\tSun>=1\t2:00s\t0\tS\n"+
"Rule\tNZAQ\t1990\t2007\t-\tMar\tSun>=15\t2:00s\t0\tS\n"+
"Rule\tNZAQ\t2007\tmax\t-\tSep\tlastSun\t2:00s\t1:00\tD\n"+
"Rule\tNZAQ\t2008\tmax\t-\tApr\tSun>=1\t2:00s\t0\tS\n"+
"Zone Antarctica/Vostok\t0\t-\tzzz\t1957 Dec 16\n"+
"\t\t\t6:00\t-\tVOST\t# Vostok time\n"+
"Zone Antarctica/Rothera\t0\t-\tzzz\t1976 Dec  1\n"+
"\t\t\t-3:00\t-\tROTT\t# Rothera time\n"+
"Zone Antarctica/Palmer\t0\t-\tzzz\t1965\n"+
"\t\t\t-4:00\tArgAQ\tAR%sT\t1969 Oct 5\n"+
"\t\t\t-3:00\tArgAQ\tAR%sT\t1982 May\n"+
"\t\t\t-4:00\tChileAQ\tCL%sT\n"+
"Zone Antarctica/McMurdo\t0\t-\tzzz\t1956\n"+
"\t\t\t12:00\tNZAQ\tNZ%sT\n"+
"Link\tAntarctica/McMurdo\tAntarctica/South_Pole\n"+
"","tz/asia":"Rule\tEUAsia\t1981\tmax\t-\tMar\tlastSun\t 1:00u\t1:00\tS\n"+
"Rule\tEUAsia\t1979\t1995\t-\tSep\tlastSun\t 1:00u\t0\t-\n"+
"Rule\tEUAsia\t1996\tmax\t-\tOct\tlastSun\t 1:00u\t0\t-\n"+
"Rule E-EurAsia\t1981\tmax\t-\tMar\tlastSun\t 0:00\t1:00\tS\n"+
"Rule E-EurAsia\t1979\t1995\t-\tSep\tlastSun\t 0:00\t0\t-\n"+
"Rule E-EurAsia\t1996\tmax\t-\tOct\tlastSun\t 0:00\t0\t-\n"+
"Rule RussiaAsia\t1981\t1984\t-\tApr\t1\t 0:00\t1:00\tS\n"+
"Rule RussiaAsia\t1981\t1983\t-\tOct\t1\t 0:00\t0\t-\n"+
"Rule RussiaAsia\t1984\t1991\t-\tSep\tlastSun\t 2:00s\t0\t-\n"+
"Rule RussiaAsia\t1985\t1991\t-\tMar\tlastSun\t 2:00s\t1:00\tS\n"+
"Rule RussiaAsia\t1992\tonly\t-\tMar\tlastSat\t23:00\t1:00\tS\n"+
"Rule RussiaAsia\t1992\tonly\t-\tSep\tlastSat\t23:00\t0\t-\n"+
"Rule RussiaAsia\t1993\tmax\t-\tMar\tlastSun\t 2:00s\t1:00\tS\n"+
"Rule RussiaAsia\t1993\t1995\t-\tSep\tlastSun\t 2:00s\t0\t-\n"+
"Rule RussiaAsia\t1996\tmax\t-\tOct\tlastSun\t 2:00s\t0\t-\n"+
"Zone\tAsia/Kabul\t4:36:48 -\tLMT\t1890\n"+
"\t\t\t4:00\t-\tAFT\t1945\n"+
"\t\t\t4:30\t-\tAFT\n"+
"Zone\tAsia/Yerevan\t2:58:00 -\tLMT\t1924 May  2\n"+
"\t\t\t3:00\t-\tYERT\t1957 Mar    # Yerevan Time\n"+
"\t\t\t4:00 RussiaAsia YER%sT\t1991 Mar 31 2:00s\n"+
"\t\t\t3:00\t1:00\tYERST\t1991 Sep 23 # independence\n"+
"\t\t\t3:00 RussiaAsia\tAM%sT\t1995 Sep 24 2:00s\n"+
"\t\t\t4:00\t-\tAMT\t1997\n"+
"\t\t\t4:00 RussiaAsia\tAM%sT\n"+
"Rule\tAzer\t1997\tmax\t-\tMar\tlastSun\t 4:00\t1:00\tS\n"+
"Rule\tAzer\t1997\tmax\t-\tOct\tlastSun\t 5:00\t0\t-\n"+
"Zone\tAsia/Baku\t3:19:24 -\tLMT\t1924 May  2\n"+
"\t\t\t3:00\t-\tBAKT\t1957 Mar    # Baku Time\n"+
"\t\t\t4:00 RussiaAsia BAK%sT\t1991 Mar 31 2:00s\n"+
"\t\t\t3:00\t1:00\tBAKST\t1991 Aug 30 # independence\n"+
"\t\t\t3:00 RussiaAsia\tAZ%sT\t1992 Sep lastSat 23:00\n"+
"\t\t\t4:00\t-\tAZT\t1996 # Azerbaijan time\n"+
"\t\t\t4:00\tEUAsia\tAZ%sT\t1997\n"+
"\t\t\t4:00\tAzer\tAZ%sT\n"+
"Zone\tAsia/Bahrain\t3:22:20 -\tLMT\t1920\t\t# Al Manamah\n"+
"\t\t\t4:00\t-\tGST\t1972 Jun\n"+
"\t\t\t3:00\t-\tAST\n"+
"Rule\tDhaka\t2009\tonly\t-\tJun\t19\t23:00\t1:00\tS\n"+
"Rule\tDhaka\t2009\tonly\t-\tDec\t31\t23:59\t0\t-\n"+
"Zone\tAsia/Dhaka\t6:01:40 -\tLMT\t1890\n"+
"\t\t\t5:53:20\t-\tHMT\t1941 Oct    # Howrah Mean Time?\n"+
"\t\t\t6:30\t-\tBURT\t1942 May 15 # Burma Time\n"+
"\t\t\t5:30\t-\tIST\t1942 Sep\n"+
"\t\t\t6:30\t-\tBURT\t1951 Sep 30\n"+
"\t\t\t6:00\t-\tDACT\t1971 Mar 26 # Dacca Time\n"+
"\t\t\t6:00\t-\tBDT\t2009\n"+
"\t\t\t6:00\tDhaka\tBD%sT\n"+
"Zone\tAsia/Thimphu\t5:58:36 -\tLMT\t1947 Aug 15 # or Thimbu\n"+
"\t\t\t5:30\t-\tIST\t1987 Oct\n"+
"\t\t\t6:00\t-\tBTT\t# Bhutan Time\n"+
"Zone\tIndian/Chagos\t4:49:40\t-\tLMT\t1907\n"+
"\t\t\t5:00\t-\tIOT\t1996 # BIOT Time\n"+
"\t\t\t6:00\t-\tIOT\n"+
"Zone\tAsia/Brunei\t7:39:40 -\tLMT\t1926 Mar   # Bandar Seri Begawan\n"+
"\t\t\t7:30\t-\tBNT\t1933\n"+
"\t\t\t8:00\t-\tBNT\n"+
"Zone\tAsia/Rangoon\t6:24:40 -\tLMT\t1880\t\t# or Yangon\n"+
"\t\t\t6:24:36\t-\tRMT\t1920\t   # Rangoon Mean Time?\n"+
"\t\t\t6:30\t-\tBURT\t1942 May   # Burma Time\n"+
"\t\t\t9:00\t-\tJST\t1945 May 3\n"+
"\t\t\t6:30\t-\tMMT\t\t   # Myanmar Time\n"+
"Zone\tAsia/Phnom_Penh\t6:59:40 -\tLMT\t1906 Jun  9\n"+
"\t\t\t7:06:20\t-\tSMT\t1911 Mar 11 0:01 # Saigon MT?\n"+
"\t\t\t7:00\t-\tICT\t1912 May\n"+
"\t\t\t8:00\t-\tICT\t1931 May\n"+
"\t\t\t7:00\t-\tICT\n"+
"Rule\tShang\t1940\tonly\t-\tJun\t 3\t0:00\t1:00\tD\n"+
"Rule\tShang\t1940\t1941\t-\tOct\t 1\t0:00\t0\tS\n"+
"Rule\tShang\t1941\tonly\t-\tMar\t16\t0:00\t1:00\tD\n"+
"Rule\tPRC\t1986\tonly\t-\tMay\t 4\t0:00\t1:00\tD\n"+
"Rule\tPRC\t1986\t1991\t-\tSep\tSun>=11\t0:00\t0\tS\n"+
"Rule\tPRC\t1987\t1991\t-\tApr\tSun>=10\t0:00\t1:00\tD\n"+
"Zone\tAsia/Harbin\t8:26:44\t-\tLMT\t1928 # or Haerbin\n"+
"\t\t\t8:30\t-\tCHAT\t1932 Mar # Changbai Time\n"+
"\t\t\t8:00\t-\tCST\t1940\n"+
"\t\t\t9:00\t-\tCHAT\t1966 May\n"+
"\t\t\t8:30\t-\tCHAT\t1980 May\n"+
"\t\t\t8:00\tPRC\tC%sT\n"+
"Zone\tAsia/Shanghai\t8:05:52\t-\tLMT\t1928\n"+
"\t\t\t8:00\tShang\tC%sT\t1949\n"+
"\t\t\t8:00\tPRC\tC%sT\n"+
"Zone\tAsia/Chongqing\t7:06:20\t-\tLMT\t1928 # or Chungking\n"+
"\t\t\t7:00\t-\tLONT\t1980 May # Long-shu Time\n"+
"\t\t\t8:00\tPRC\tC%sT\n"+
"Zone\tAsia/Urumqi\t5:50:20\t-\tLMT\t1928 # or Urumchi\n"+
"\t\t\t6:00\t-\tURUT\t1980 May # Urumqi Time\n"+
"\t\t\t8:00\tPRC\tC%sT\n"+
"Zone\tAsia/Kashgar\t5:03:56\t-\tLMT\t1928 # or Kashi or Kaxgar\n"+
"\t\t\t5:30\t-\tKAST\t1940\t # Kashgar Time\n"+
"\t\t\t5:00\t-\tKAST\t1980 May\n"+
"\t\t\t8:00\tPRC\tC%sT\n"+
"Rule\tHK\t1941\tonly\t-\tApr\t1\t3:30\t1:00\tS\n"+
"Rule\tHK\t1941\tonly\t-\tSep\t30\t3:30\t0\t-\n"+
"Rule\tHK\t1946\tonly\t-\tApr\t20\t3:30\t1:00\tS\n"+
"Rule\tHK\t1946\tonly\t-\tDec\t1\t3:30\t0\t-\n"+
"Rule\tHK\t1947\tonly\t-\tApr\t13\t3:30\t1:00\tS\n"+
"Rule\tHK\t1947\tonly\t-\tDec\t30\t3:30\t0\t-\n"+
"Rule\tHK\t1948\tonly\t-\tMay\t2\t3:30\t1:00\tS\n"+
"Rule\tHK\t1948\t1951\t-\tOct\tlastSun\t3:30\t0\t-\n"+
"Rule\tHK\t1952\tonly\t-\tOct\t25\t3:30\t0\t-\n"+
"Rule\tHK\t1949\t1953\t-\tApr\tSun>=1\t3:30\t1:00\tS\n"+
"Rule\tHK\t1953\tonly\t-\tNov\t1\t3:30\t0\t-\n"+
"Rule\tHK\t1954\t1964\t-\tMar\tSun>=18\t3:30\t1:00\tS\n"+
"Rule\tHK\t1954\tonly\t-\tOct\t31\t3:30\t0\t-\n"+
"Rule\tHK\t1955\t1964\t-\tNov\tSun>=1\t3:30\t0\t-\n"+
"Rule\tHK\t1965\t1976\t-\tApr\tSun>=16\t3:30\t1:00\tS\n"+
"Rule\tHK\t1965\t1976\t-\tOct\tSun>=16\t3:30\t0\t-\n"+
"Rule\tHK\t1973\tonly\t-\tDec\t30\t3:30\t1:00\tS\n"+
"Rule\tHK\t1979\tonly\t-\tMay\tSun>=8\t3:30\t1:00\tS\n"+
"Rule\tHK\t1979\tonly\t-\tOct\tSun>=16\t3:30\t0\t-\n"+
"Zone\tAsia/Hong_Kong\t7:36:36 -\tLMT\t1904 Oct 30\n"+
"\t\t\t8:00\tHK\tHK%sT\t1941 Dec 25\n"+
"\t\t\t9:00\t-\tJST\t1945 Sep 15\n"+
"\t\t\t8:00\tHK\tHK%sT\n"+
"Rule\tTaiwan\t1945\t1951\t-\tMay\t1\t0:00\t1:00\tD\n"+
"Rule\tTaiwan\t1945\t1951\t-\tOct\t1\t0:00\t0\tS\n"+
"Rule\tTaiwan\t1952\tonly\t-\tMar\t1\t0:00\t1:00\tD\n"+
"Rule\tTaiwan\t1952\t1954\t-\tNov\t1\t0:00\t0\tS\n"+
"Rule\tTaiwan\t1953\t1959\t-\tApr\t1\t0:00\t1:00\tD\n"+
"Rule\tTaiwan\t1955\t1961\t-\tOct\t1\t0:00\t0\tS\n"+
"Rule\tTaiwan\t1960\t1961\t-\tJun\t1\t0:00\t1:00\tD\n"+
"Rule\tTaiwan\t1974\t1975\t-\tApr\t1\t0:00\t1:00\tD\n"+
"Rule\tTaiwan\t1974\t1975\t-\tOct\t1\t0:00\t0\tS\n"+
"Rule\tTaiwan\t1979\tonly\t-\tJun\t30\t0:00\t1:00\tD\n"+
"Rule\tTaiwan\t1979\tonly\t-\tSep\t30\t0:00\t0\tS\n"+
"Zone\tAsia/Taipei\t8:06:00 -\tLMT\t1896 # or Taibei or T'ai-pei\n"+
"\t\t\t8:00\tTaiwan\tC%sT\n"+
"Rule\tMacau\t1961\t1962\t-\tMar\tSun>=16\t3:30\t1:00\tS\n"+
"Rule\tMacau\t1961\t1964\t-\tNov\tSun>=1\t3:30\t0\t-\n"+
"Rule\tMacau\t1963\tonly\t-\tMar\tSun>=16\t0:00\t1:00\tS\n"+
"Rule\tMacau\t1964\tonly\t-\tMar\tSun>=16\t3:30\t1:00\tS\n"+
"Rule\tMacau\t1965\tonly\t-\tMar\tSun>=16\t0:00\t1:00\tS\n"+
"Rule\tMacau\t1965\tonly\t-\tOct\t31\t0:00\t0\t-\n"+
"Rule\tMacau\t1966\t1971\t-\tApr\tSun>=16\t3:30\t1:00\tS\n"+
"Rule\tMacau\t1966\t1971\t-\tOct\tSun>=16\t3:30\t0\t-\n"+
"Rule\tMacau\t1972\t1974\t-\tApr\tSun>=15\t0:00\t1:00\tS\n"+
"Rule\tMacau\t1972\t1973\t-\tOct\tSun>=15\t0:00\t0\t-\n"+
"Rule\tMacau\t1974\t1977\t-\tOct\tSun>=15\t3:30\t0\t-\n"+
"Rule\tMacau\t1975\t1977\t-\tApr\tSun>=15\t3:30\t1:00\tS\n"+
"Rule\tMacau\t1978\t1980\t-\tApr\tSun>=15\t0:00\t1:00\tS\n"+
"Rule\tMacau\t1978\t1980\t-\tOct\tSun>=15\t0:00\t0\t-\n"+
"Zone\tAsia/Macau\t7:34:20 -\tLMT\t1912\n"+
"\t\t\t8:00\tMacau\tMO%sT\t1999 Dec 20 # return to China\n"+
"\t\t\t8:00\tPRC\tC%sT\n"+
"Rule\tCyprus\t1975\tonly\t-\tApr\t13\t0:00\t1:00\tS\n"+
"Rule\tCyprus\t1975\tonly\t-\tOct\t12\t0:00\t0\t-\n"+
"Rule\tCyprus\t1976\tonly\t-\tMay\t15\t0:00\t1:00\tS\n"+
"Rule\tCyprus\t1976\tonly\t-\tOct\t11\t0:00\t0\t-\n"+
"Rule\tCyprus\t1977\t1980\t-\tApr\tSun>=1\t0:00\t1:00\tS\n"+
"Rule\tCyprus\t1977\tonly\t-\tSep\t25\t0:00\t0\t-\n"+
"Rule\tCyprus\t1978\tonly\t-\tOct\t2\t0:00\t0\t-\n"+
"Rule\tCyprus\t1979\t1997\t-\tSep\tlastSun\t0:00\t0\t-\n"+
"Rule\tCyprus\t1981\t1998\t-\tMar\tlastSun\t0:00\t1:00\tS\n"+
"Zone\tAsia/Nicosia\t2:13:28 -\tLMT\t1921 Nov 14\n"+
"\t\t\t2:00\tCyprus\tEE%sT\t1998 Sep\n"+
"\t\t\t2:00\tEUAsia\tEE%sT\n"+
"Link\tAsia/Nicosia\tEurope/Nicosia\n"+
"Zone\tAsia/Tbilisi\t2:59:16 -\tLMT\t1880\n"+
"\t\t\t2:59:16\t-\tTBMT\t1924 May  2 # Tbilisi Mean Time\n"+
"\t\t\t3:00\t-\tTBIT\t1957 Mar    # Tbilisi Time\n"+
"\t\t\t4:00 RussiaAsia TBI%sT\t1991 Mar 31 2:00s\n"+
"\t\t\t3:00\t1:00\tTBIST\t1991 Apr  9 # independence\n"+
"\t\t\t3:00 RussiaAsia GE%sT\t1992 # Georgia Time\n"+
"\t\t\t3:00 E-EurAsia\tGE%sT\t1994 Sep lastSun\n"+
"\t\t\t4:00 E-EurAsia\tGE%sT\t1996 Oct lastSun\n"+
"\t\t\t4:00\t1:00\tGEST\t1997 Mar lastSun\n"+
"\t\t\t4:00 E-EurAsia\tGE%sT\t2004 Jun 27\n"+
"\t\t\t3:00 RussiaAsia\tGE%sT\t2005 Mar lastSun 2:00\n"+
"\t\t\t4:00\t-\tGET\n"+
"Zone\tAsia/Dili\t8:22:20 -\tLMT\t1912\n"+
"\t\t\t8:00\t-\tTLT\t1942 Feb 21 23:00 # E Timor Time\n"+
"\t\t\t9:00\t-\tJST\t1945 Sep 23\n"+
"\t\t\t9:00\t-\tTLT\t1976 May  3\n"+
"\t\t\t8:00\t-\tCIT\t2000 Sep 17 00:00\n"+
"\t\t\t9:00\t-\tTLT\n"+
"Zone\tAsia/Kolkata\t5:53:28 -\tLMT\t1880\t# Kolkata\n"+
"\t\t\t5:53:20\t-\tHMT\t1941 Oct    # Howrah Mean Time?\n"+
"\t\t\t6:30\t-\tBURT\t1942 May 15 # Burma Time\n"+
"\t\t\t5:30\t-\tIST\t1942 Sep\n"+
"\t\t\t5:30\t1:00\tIST\t1945 Oct 15\n"+
"\t\t\t5:30\t-\tIST\n"+
"Zone Asia/Jakarta\t7:07:12 -\tLMT\t1867 Aug 10\n"+
"\t\t\t7:07:12\t-\tJMT\t1923 Dec 31 23:47:12 # Jakarta\n"+
"\t\t\t7:20\t-\tJAVT\t1932 Nov\t # Java Time\n"+
"\t\t\t7:30\t-\tWIT\t1942 Mar 23\n"+
"\t\t\t9:00\t-\tJST\t1945 Sep 23\n"+
"\t\t\t7:30\t-\tWIT\t1948 May\n"+
"\t\t\t8:00\t-\tWIT\t1950 May\n"+
"\t\t\t7:30\t-\tWIT\t1964\n"+
"\t\t\t7:00\t-\tWIT\n"+
"Zone Asia/Pontianak\t7:17:20\t-\tLMT\t1908 May\n"+
"\t\t\t7:17:20\t-\tPMT\t1932 Nov    # Pontianak MT\n"+
"\t\t\t7:30\t-\tWIT\t1942 Jan 29\n"+
"\t\t\t9:00\t-\tJST\t1945 Sep 23\n"+
"\t\t\t7:30\t-\tWIT\t1948 May\n"+
"\t\t\t8:00\t-\tWIT\t1950 May\n"+
"\t\t\t7:30\t-\tWIT\t1964\n"+
"\t\t\t8:00\t-\tCIT\t1988 Jan  1\n"+
"\t\t\t7:00\t-\tWIT\n"+
"Zone Asia/Makassar\t7:57:36 -\tLMT\t1920\n"+
"\t\t\t7:57:36\t-\tMMT\t1932 Nov    # Macassar MT\n"+
"\t\t\t8:00\t-\tCIT\t1942 Feb  9\n"+
"\t\t\t9:00\t-\tJST\t1945 Sep 23\n"+
"\t\t\t8:00\t-\tCIT\n"+
"Zone Asia/Jayapura\t9:22:48 -\tLMT\t1932 Nov\n"+
"\t\t\t9:00\t-\tEIT\t1944 Sep  1\n"+
"\t\t\t9:30\t-\tCST\t1964\n"+
"\t\t\t9:00\t-\tEIT\n"+
"Rule\tIran\t1978\t1980\t-\tMar\t21\t0:00\t1:00\tD\n"+
"Rule\tIran\t1978\tonly\t-\tOct\t21\t0:00\t0\tS\n"+
"Rule\tIran\t1979\tonly\t-\tSep\t19\t0:00\t0\tS\n"+
"Rule\tIran\t1980\tonly\t-\tSep\t23\t0:00\t0\tS\n"+
"Rule\tIran\t1991\tonly\t-\tMay\t 3\t0:00\t1:00\tD\n"+
"Rule\tIran\t1992\t1995\t-\tMar\t22\t0:00\t1:00\tD\n"+
"Rule\tIran\t1991\t1995\t-\tSep\t22\t0:00\t0\tS\n"+
"Rule\tIran\t1996\tonly\t-\tMar\t21\t0:00\t1:00\tD\n"+
"Rule\tIran\t1996\tonly\t-\tSep\t21\t0:00\t0\tS\n"+
"Rule\tIran\t1997\t1999\t-\tMar\t22\t0:00\t1:00\tD\n"+
"Rule\tIran\t1997\t1999\t-\tSep\t22\t0:00\t0\tS\n"+
"Rule\tIran\t2000\tonly\t-\tMar\t21\t0:00\t1:00\tD\n"+
"Rule\tIran\t2000\tonly\t-\tSep\t21\t0:00\t0\tS\n"+
"Rule\tIran\t2001\t2003\t-\tMar\t22\t0:00\t1:00\tD\n"+
"Rule\tIran\t2001\t2003\t-\tSep\t22\t0:00\t0\tS\n"+
"Rule\tIran\t2004\tonly\t-\tMar\t21\t0:00\t1:00\tD\n"+
"Rule\tIran\t2004\tonly\t-\tSep\t21\t0:00\t0\tS\n"+
"Rule\tIran\t2005\tonly\t-\tMar\t22\t0:00\t1:00\tD\n"+
"Rule\tIran\t2005\tonly\t-\tSep\t22\t0:00\t0\tS\n"+
"Rule\tIran\t2008\tonly\t-\tMar\t21\t0:00\t1:00\tD\n"+
"Rule\tIran\t2008\tonly\t-\tSep\t21\t0:00\t0\tS\n"+
"Rule\tIran\t2009\t2011\t-\tMar\t22\t0:00\t1:00\tD\n"+
"Rule\tIran\t2009\t2011\t-\tSep\t22\t0:00\t0\tS\n"+
"Rule\tIran\t2012\tonly\t-\tMar\t21\t0:00\t1:00\tD\n"+
"Rule\tIran\t2012\tonly\t-\tSep\t21\t0:00\t0\tS\n"+
"Rule\tIran\t2013\t2015\t-\tMar\t22\t0:00\t1:00\tD\n"+
"Rule\tIran\t2013\t2015\t-\tSep\t22\t0:00\t0\tS\n"+
"Rule\tIran\t2016\tonly\t-\tMar\t21\t0:00\t1:00\tD\n"+
"Rule\tIran\t2016\tonly\t-\tSep\t21\t0:00\t0\tS\n"+
"Rule\tIran\t2017\t2019\t-\tMar\t22\t0:00\t1:00\tD\n"+
"Rule\tIran\t2017\t2019\t-\tSep\t22\t0:00\t0\tS\n"+
"Rule\tIran\t2020\tonly\t-\tMar\t21\t0:00\t1:00\tD\n"+
"Rule\tIran\t2020\tonly\t-\tSep\t21\t0:00\t0\tS\n"+
"Rule\tIran\t2021\t2023\t-\tMar\t22\t0:00\t1:00\tD\n"+
"Rule\tIran\t2021\t2023\t-\tSep\t22\t0:00\t0\tS\n"+
"Rule\tIran\t2024\tonly\t-\tMar\t21\t0:00\t1:00\tD\n"+
"Rule\tIran\t2024\tonly\t-\tSep\t21\t0:00\t0\tS\n"+
"Rule\tIran\t2025\t2027\t-\tMar\t22\t0:00\t1:00\tD\n"+
"Rule\tIran\t2025\t2027\t-\tSep\t22\t0:00\t0\tS\n"+
"Rule\tIran\t2028\t2029\t-\tMar\t21\t0:00\t1:00\tD\n"+
"Rule\tIran\t2028\t2029\t-\tSep\t21\t0:00\t0\tS\n"+
"Rule\tIran\t2030\t2031\t-\tMar\t22\t0:00\t1:00\tD\n"+
"Rule\tIran\t2030\t2031\t-\tSep\t22\t0:00\t0\tS\n"+
"Rule\tIran\t2032\t2033\t-\tMar\t21\t0:00\t1:00\tD\n"+
"Rule\tIran\t2032\t2033\t-\tSep\t21\t0:00\t0\tS\n"+
"Rule\tIran\t2034\t2035\t-\tMar\t22\t0:00\t1:00\tD\n"+
"Rule\tIran\t2034\t2035\t-\tSep\t22\t0:00\t0\tS\n"+
"Rule\tIran\t2036\t2037\t-\tMar\t21\t0:00\t1:00\tD\n"+
"Rule\tIran\t2036\t2037\t-\tSep\t21\t0:00\t0\tS\n"+
"Zone\tAsia/Tehran\t3:25:44\t-\tLMT\t1916\n"+
"\t\t\t3:25:44\t-\tTMT\t1946\t# Tehran Mean Time\n"+
"\t\t\t3:30\t-\tIRST\t1977 Nov\n"+
"\t\t\t4:00\tIran\tIR%sT\t1979\n"+
"\t\t\t3:30\tIran\tIR%sT\n"+
"Rule\tIraq\t1982\tonly\t-\tMay\t1\t0:00\t1:00\tD\n"+
"Rule\tIraq\t1982\t1984\t-\tOct\t1\t0:00\t0\tS\n"+
"Rule\tIraq\t1983\tonly\t-\tMar\t31\t0:00\t1:00\tD\n"+
"Rule\tIraq\t1984\t1985\t-\tApr\t1\t0:00\t1:00\tD\n"+
"Rule\tIraq\t1985\t1990\t-\tSep\tlastSun\t1:00s\t0\tS\n"+
"Rule\tIraq\t1986\t1990\t-\tMar\tlastSun\t1:00s\t1:00\tD\n"+
"Rule\tIraq\t1991\t2007\t-\tApr\t 1\t3:00s\t1:00\tD\n"+
"Rule\tIraq\t1991\t2007\t-\tOct\t 1\t3:00s\t0\tS\n"+
"Zone\tAsia/Baghdad\t2:57:40\t-\tLMT\t1890\n"+
"\t\t\t2:57:36\t-\tBMT\t1918\t    # Baghdad Mean Time?\n"+
"\t\t\t3:00\t-\tAST\t1982 May\n"+
"\t\t\t3:00\tIraq\tA%sT\n"+
"Rule\tZion\t1940\tonly\t-\tJun\t 1\t0:00\t1:00\tD\n"+
"Rule\tZion\t1942\t1944\t-\tNov\t 1\t0:00\t0\tS\n"+
"Rule\tZion\t1943\tonly\t-\tApr\t 1\t2:00\t1:00\tD\n"+
"Rule\tZion\t1944\tonly\t-\tApr\t 1\t0:00\t1:00\tD\n"+
"Rule\tZion\t1945\tonly\t-\tApr\t16\t0:00\t1:00\tD\n"+
"Rule\tZion\t1945\tonly\t-\tNov\t 1\t2:00\t0\tS\n"+
"Rule\tZion\t1946\tonly\t-\tApr\t16\t2:00\t1:00\tD\n"+
"Rule\tZion\t1946\tonly\t-\tNov\t 1\t0:00\t0\tS\n"+
"Rule\tZion\t1948\tonly\t-\tMay\t23\t0:00\t2:00\tDD\n"+
"Rule\tZion\t1948\tonly\t-\tSep\t 1\t0:00\t1:00\tD\n"+
"Rule\tZion\t1948\t1949\t-\tNov\t 1\t2:00\t0\tS\n"+
"Rule\tZion\t1949\tonly\t-\tMay\t 1\t0:00\t1:00\tD\n"+
"Rule\tZion\t1950\tonly\t-\tApr\t16\t0:00\t1:00\tD\n"+
"Rule\tZion\t1950\tonly\t-\tSep\t15\t3:00\t0\tS\n"+
"Rule\tZion\t1951\tonly\t-\tApr\t 1\t0:00\t1:00\tD\n"+
"Rule\tZion\t1951\tonly\t-\tNov\t11\t3:00\t0\tS\n"+
"Rule\tZion\t1952\tonly\t-\tApr\t20\t2:00\t1:00\tD\n"+
"Rule\tZion\t1952\tonly\t-\tOct\t19\t3:00\t0\tS\n"+
"Rule\tZion\t1953\tonly\t-\tApr\t12\t2:00\t1:00\tD\n"+
"Rule\tZion\t1953\tonly\t-\tSep\t13\t3:00\t0\tS\n"+
"Rule\tZion\t1954\tonly\t-\tJun\t13\t0:00\t1:00\tD\n"+
"Rule\tZion\t1954\tonly\t-\tSep\t12\t0:00\t0\tS\n"+
"Rule\tZion\t1955\tonly\t-\tJun\t11\t2:00\t1:00\tD\n"+
"Rule\tZion\t1955\tonly\t-\tSep\t11\t0:00\t0\tS\n"+
"Rule\tZion\t1956\tonly\t-\tJun\t 3\t0:00\t1:00\tD\n"+
"Rule\tZion\t1956\tonly\t-\tSep\t30\t3:00\t0\tS\n"+
"Rule\tZion\t1957\tonly\t-\tApr\t29\t2:00\t1:00\tD\n"+
"Rule\tZion\t1957\tonly\t-\tSep\t22\t0:00\t0\tS\n"+
"Rule\tZion\t1974\tonly\t-\tJul\t 7\t0:00\t1:00\tD\n"+
"Rule\tZion\t1974\tonly\t-\tOct\t13\t0:00\t0\tS\n"+
"Rule\tZion\t1975\tonly\t-\tApr\t20\t0:00\t1:00\tD\n"+
"Rule\tZion\t1975\tonly\t-\tAug\t31\t0:00\t0\tS\n"+
"Rule\tZion\t1985\tonly\t-\tApr\t14\t0:00\t1:00\tD\n"+
"Rule\tZion\t1985\tonly\t-\tSep\t15\t0:00\t0\tS\n"+
"Rule\tZion\t1986\tonly\t-\tMay\t18\t0:00\t1:00\tD\n"+
"Rule\tZion\t1986\tonly\t-\tSep\t 7\t0:00\t0\tS\n"+
"Rule\tZion\t1987\tonly\t-\tApr\t15\t0:00\t1:00\tD\n"+
"Rule\tZion\t1987\tonly\t-\tSep\t13\t0:00\t0\tS\n"+
"Rule\tZion\t1988\tonly\t-\tApr\t 9\t0:00\t1:00\tD\n"+
"Rule\tZion\t1988\tonly\t-\tSep\t 3\t0:00\t0\tS\n"+
"Rule\tZion\t1989\tonly\t-\tApr\t30\t0:00\t1:00\tD\n"+
"Rule\tZion\t1989\tonly\t-\tSep\t 3\t0:00\t0\tS\n"+
"Rule\tZion\t1990\tonly\t-\tMar\t25\t0:00\t1:00\tD\n"+
"Rule\tZion\t1990\tonly\t-\tAug\t26\t0:00\t0\tS\n"+
"Rule\tZion\t1991\tonly\t-\tMar\t24\t0:00\t1:00\tD\n"+
"Rule\tZion\t1991\tonly\t-\tSep\t 1\t0:00\t0\tS\n"+
"Rule\tZion\t1992\tonly\t-\tMar\t29\t0:00\t1:00\tD\n"+
"Rule\tZion\t1992\tonly\t-\tSep\t 6\t0:00\t0\tS\n"+
"Rule\tZion\t1993\tonly\t-\tApr\t 2\t0:00\t1:00\tD\n"+
"Rule\tZion\t1993\tonly\t-\tSep\t 5\t0:00\t0\tS\n"+
"Rule\tZion\t1994\tonly\t-\tApr\t 1\t0:00\t1:00\tD\n"+
"Rule\tZion\t1994\tonly\t-\tAug\t28\t0:00\t0\tS\n"+
"Rule\tZion\t1995\tonly\t-\tMar\t31\t0:00\t1:00\tD\n"+
"Rule\tZion\t1995\tonly\t-\tSep\t 3\t0:00\t0\tS\n"+
"Rule\tZion\t1996\tonly\t-\tMar\t15\t0:00\t1:00\tD\n"+
"Rule\tZion\t1996\tonly\t-\tSep\t16\t0:00\t0\tS\n"+
"Rule\tZion\t1997\tonly\t-\tMar\t21\t0:00\t1:00\tD\n"+
"Rule\tZion\t1997\tonly\t-\tSep\t14\t0:00\t0\tS\n"+
"Rule\tZion\t1998\tonly\t-\tMar\t20\t0:00\t1:00\tD\n"+
"Rule\tZion\t1998\tonly\t-\tSep\t 6\t0:00\t0\tS\n"+
"Rule\tZion\t1999\tonly\t-\tApr\t 2\t2:00\t1:00\tD\n"+
"Rule\tZion\t1999\tonly\t-\tSep\t 3\t2:00\t0\tS\n"+
"Rule\tZion\t2000\tonly\t-\tApr\t14\t2:00\t1:00\tD\n"+
"Rule\tZion\t2000\tonly\t-\tOct\t 6\t1:00\t0\tS\n"+
"Rule\tZion\t2001\tonly\t-\tApr\t 9\t1:00\t1:00\tD\n"+
"Rule\tZion\t2001\tonly\t-\tSep\t24\t1:00\t0\tS\n"+
"Rule\tZion\t2002\tonly\t-\tMar\t29\t1:00\t1:00\tD\n"+
"Rule\tZion\t2002\tonly\t-\tOct\t 7\t1:00\t0\tS\n"+
"Rule\tZion\t2003\tonly\t-\tMar\t28\t1:00\t1:00\tD\n"+
"Rule\tZion\t2003\tonly\t-\tOct\t 3\t1:00\t0\tS\n"+
"Rule\tZion\t2004\tonly\t-\tApr\t 7\t1:00\t1:00\tD\n"+
"Rule\tZion\t2004\tonly\t-\tSep\t22\t1:00\t0\tS\n"+
"Rule\tZion\t2005\tonly\t-\tApr\t 1\t2:00\t1:00\tD\n"+
"Rule\tZion\t2005\tonly\t-\tOct\t 9\t2:00\t0\tS\n"+
"Rule\tZion\t2006\t2010\t-\tMar\tFri>=26\t2:00\t1:00\tD\n"+
"Rule\tZion\t2006\tonly\t-\tOct\t 1\t2:00\t0\tS\n"+
"Rule\tZion\t2007\tonly\t-\tSep\t16\t2:00\t0\tS\n"+
"Rule\tZion\t2008\tonly\t-\tOct\t 5\t2:00\t0\tS\n"+
"Rule\tZion\t2009\tonly\t-\tSep\t27\t2:00\t0\tS\n"+
"Rule\tZion\t2010\tonly\t-\tSep\t12\t2:00\t0\tS\n"+
"Rule\tZion\t2011\tonly\t-\tApr\t 1\t2:00\t1:00\tD\n"+
"Rule\tZion\t2011\tonly\t-\tOct\t 2\t2:00\t0\tS\n"+
"Rule\tZion\t2012\t2015\t-\tMar\tFri>=26\t2:00\t1:00\tD\n"+
"Rule\tZion\t2012\tonly\t-\tSep\t23\t2:00\t0\tS\n"+
"Rule\tZion\t2013\tonly\t-\tSep\t 8\t2:00\t0\tS\n"+
"Rule\tZion\t2014\tonly\t-\tSep\t28\t2:00\t0\tS\n"+
"Rule\tZion\t2015\tonly\t-\tSep\t20\t2:00\t0\tS\n"+
"Rule\tZion\t2016\tonly\t-\tApr\t 1\t2:00\t1:00\tD\n"+
"Rule\tZion\t2016\tonly\t-\tOct\t 9\t2:00\t0\tS\n"+
"Rule\tZion\t2017\t2021\t-\tMar\tFri>=26\t2:00\t1:00\tD\n"+
"Rule\tZion\t2017\tonly\t-\tSep\t24\t2:00\t0\tS\n"+
"Rule\tZion\t2018\tonly\t-\tSep\t16\t2:00\t0\tS\n"+
"Rule\tZion\t2019\tonly\t-\tOct\t 6\t2:00\t0\tS\n"+
"Rule\tZion\t2020\tonly\t-\tSep\t27\t2:00\t0\tS\n"+
"Rule\tZion\t2021\tonly\t-\tSep\t12\t2:00\t0\tS\n"+
"Rule\tZion\t2022\tonly\t-\tApr\t 1\t2:00\t1:00\tD\n"+
"Rule\tZion\t2022\tonly\t-\tOct\t 2\t2:00\t0\tS\n"+
"Rule\tZion\t2023\t2032\t-\tMar\tFri>=26\t2:00\t1:00\tD\n"+
"Rule\tZion\t2023\tonly\t-\tSep\t24\t2:00\t0\tS\n"+
"Rule\tZion\t2024\tonly\t-\tOct\t 6\t2:00\t0\tS\n"+
"Rule\tZion\t2025\tonly\t-\tSep\t28\t2:00\t0\tS\n"+
"Rule\tZion\t2026\tonly\t-\tSep\t20\t2:00\t0\tS\n"+
"Rule\tZion\t2027\tonly\t-\tOct\t10\t2:00\t0\tS\n"+
"Rule\tZion\t2028\tonly\t-\tSep\t24\t2:00\t0\tS\n"+
"Rule\tZion\t2029\tonly\t-\tSep\t16\t2:00\t0\tS\n"+
"Rule\tZion\t2030\tonly\t-\tOct\t 6\t2:00\t0\tS\n"+
"Rule\tZion\t2031\tonly\t-\tSep\t21\t2:00\t0\tS\n"+
"Rule\tZion\t2032\tonly\t-\tSep\t12\t2:00\t0\tS\n"+
"Rule\tZion\t2033\tonly\t-\tApr\t 1\t2:00\t1:00\tD\n"+
"Rule\tZion\t2033\tonly\t-\tOct\t 2\t2:00\t0\tS\n"+
"Rule\tZion\t2034\t2037\t-\tMar\tFri>=26\t2:00\t1:00\tD\n"+
"Rule\tZion\t2034\tonly\t-\tSep\t17\t2:00\t0\tS\n"+
"Rule\tZion\t2035\tonly\t-\tOct\t 7\t2:00\t0\tS\n"+
"Rule\tZion\t2036\tonly\t-\tSep\t28\t2:00\t0\tS\n"+
"Rule\tZion\t2037\tonly\t-\tSep\t13\t2:00\t0\tS\n"+
"Zone\tAsia/Jerusalem\t2:20:56 -\tLMT\t1880\n"+
"\t\t\t2:20:40\t-\tJMT\t1918\t# Jerusalem Mean Time?\n"+
"\t\t\t2:00\tZion\tI%sT\n"+
"Rule\tJapan\t1948\tonly\t-\tMay\tSun>=1\t2:00\t1:00\tD\n"+
"Rule\tJapan\t1948\t1951\t-\tSep\tSat>=8\t2:00\t0\tS\n"+
"Rule\tJapan\t1949\tonly\t-\tApr\tSun>=1\t2:00\t1:00\tD\n"+
"Rule\tJapan\t1950\t1951\t-\tMay\tSun>=1\t2:00\t1:00\tD\n"+
"Zone\tAsia/Tokyo\t9:18:59\t-\tLMT\t1887 Dec 31 15:00u\n"+
"\t\t\t9:00\t-\tJST\t1896\n"+
"\t\t\t9:00\t-\tCJT\t1938\n"+
"\t\t\t9:00\tJapan\tJ%sT\n"+
"Rule\tJordan\t1973\tonly\t-\tJun\t6\t0:00\t1:00\tS\n"+
"Rule\tJordan\t1973\t1975\t-\tOct\t1\t0:00\t0\t-\n"+
"Rule\tJordan\t1974\t1977\t-\tMay\t1\t0:00\t1:00\tS\n"+
"Rule\tJordan\t1976\tonly\t-\tNov\t1\t0:00\t0\t-\n"+
"Rule\tJordan\t1977\tonly\t-\tOct\t1\t0:00\t0\t-\n"+
"Rule\tJordan\t1978\tonly\t-\tApr\t30\t0:00\t1:00\tS\n"+
"Rule\tJordan\t1978\tonly\t-\tSep\t30\t0:00\t0\t-\n"+
"Rule\tJordan\t1985\tonly\t-\tApr\t1\t0:00\t1:00\tS\n"+
"Rule\tJordan\t1985\tonly\t-\tOct\t1\t0:00\t0\t-\n"+
"Rule\tJordan\t1986\t1988\t-\tApr\tFri>=1\t0:00\t1:00\tS\n"+
"Rule\tJordan\t1986\t1990\t-\tOct\tFri>=1\t0:00\t0\t-\n"+
"Rule\tJordan\t1989\tonly\t-\tMay\t8\t0:00\t1:00\tS\n"+
"Rule\tJordan\t1990\tonly\t-\tApr\t27\t0:00\t1:00\tS\n"+
"Rule\tJordan\t1991\tonly\t-\tApr\t17\t0:00\t1:00\tS\n"+
"Rule\tJordan\t1991\tonly\t-\tSep\t27\t0:00\t0\t-\n"+
"Rule\tJordan\t1992\tonly\t-\tApr\t10\t0:00\t1:00\tS\n"+
"Rule\tJordan\t1992\t1993\t-\tOct\tFri>=1\t0:00\t0\t-\n"+
"Rule\tJordan\t1993\t1998\t-\tApr\tFri>=1\t0:00\t1:00\tS\n"+
"Rule\tJordan\t1994\tonly\t-\tSep\tFri>=15\t0:00\t0\t-\n"+
"Rule\tJordan\t1995\t1998\t-\tSep\tFri>=15\t0:00s\t0\t-\n"+
"Rule\tJordan\t1999\tonly\t-\tJul\t 1\t0:00s\t1:00\tS\n"+
"Rule\tJordan\t1999\t2002\t-\tSep\tlastFri\t0:00s\t0\t-\n"+
"Rule\tJordan\t2000\t2001\t-\tMar\tlastThu\t0:00s\t1:00\tS\n"+
"Rule\tJordan\t2002\tmax\t-\tMar\tlastThu\t24:00\t1:00\tS\n"+
"Rule\tJordan\t2003\tonly\t-\tOct\t24\t0:00s\t0\t-\n"+
"Rule\tJordan\t2004\tonly\t-\tOct\t15\t0:00s\t0\t-\n"+
"Rule\tJordan\t2005\tonly\t-\tSep\tlastFri\t0:00s\t0\t-\n"+
"Rule\tJordan\t2006\tmax\t-\tOct\tlastFri\t0:00s\t0\t-\n"+
"Zone\tAsia/Amman\t2:23:44 -\tLMT\t1931\n"+
"\t\t\t2:00\tJordan\tEE%sT\n"+
"Zone\tAsia/Almaty\t5:07:48 -\tLMT\t1924 May  2 # or Alma-Ata\n"+
"\t\t\t5:00\t-\tALMT\t1930 Jun 21 # Alma-Ata Time\n"+
"\t\t\t6:00 RussiaAsia ALM%sT\t1991\n"+
"\t\t\t6:00\t-\tALMT\t1992\n"+
"\t\t\t6:00 RussiaAsia\tALM%sT\t2005 Mar 15\n"+
"\t\t\t6:00\t-\tALMT\n"+
"Zone\tAsia/Qyzylorda\t4:21:52 -\tLMT\t1924 May  2\n"+
"\t\t\t4:00\t-\tKIZT\t1930 Jun 21 # Kizilorda Time\n"+
"\t\t\t5:00\t-\tKIZT\t1981 Apr  1\n"+
"\t\t\t5:00\t1:00\tKIZST\t1981 Oct  1\n"+
"\t\t\t6:00\t-\tKIZT\t1982 Apr  1\n"+
"\t\t\t5:00 RussiaAsia\tKIZ%sT\t1991\n"+
"\t\t\t5:00\t-\tKIZT\t1991 Dec 16 # independence\n"+
"\t\t\t5:00\t-\tQYZT\t1992 Jan 19 2:00\n"+
"\t\t\t6:00 RussiaAsia\tQYZ%sT\t2005 Mar 15\n"+
"\t\t\t6:00\t-\tQYZT\n"+
"Zone\tAsia/Aqtobe\t3:48:40\t-\tLMT\t1924 May  2\n"+
"\t\t\t4:00\t-\tAKTT\t1930 Jun 21 # Aktyubinsk Time\n"+
"\t\t\t5:00\t-\tAKTT\t1981 Apr  1\n"+
"\t\t\t5:00\t1:00\tAKTST\t1981 Oct  1\n"+
"\t\t\t6:00\t-\tAKTT\t1982 Apr  1\n"+
"\t\t\t5:00 RussiaAsia\tAKT%sT\t1991\n"+
"\t\t\t5:00\t-\tAKTT\t1991 Dec 16 # independence\n"+
"\t\t\t5:00 RussiaAsia\tAQT%sT\t2005 Mar 15 # Aqtobe Time\n"+
"\t\t\t5:00\t-\tAQTT\n"+
"Zone\tAsia/Aqtau\t3:21:04\t-\tLMT\t1924 May  2\n"+
"\t\t\t4:00\t-\tFORT\t1930 Jun 21 # Fort Shevchenko T\n"+
"\t\t\t5:00\t-\tFORT\t1963\n"+
"\t\t\t5:00\t-\tSHET\t1981 Oct  1 # Shevchenko Time\n"+
"\t\t\t6:00\t-\tSHET\t1982 Apr  1\n"+
"\t\t\t5:00 RussiaAsia\tSHE%sT\t1991\n"+
"\t\t\t5:00\t-\tSHET\t1991 Dec 16 # independence\n"+
"\t\t\t5:00 RussiaAsia\tAQT%sT\t1995 Mar lastSun 2:00 # Aqtau Time\n"+
"\t\t\t4:00 RussiaAsia\tAQT%sT\t2005 Mar 15\n"+
"\t\t\t5:00\t-\tAQTT\n"+
"Zone\tAsia/Oral\t3:25:24\t-\tLMT\t1924 May  2 # or Ural'sk\n"+
"\t\t\t4:00\t-\tURAT\t1930 Jun 21 # Ural'sk time\n"+
"\t\t\t5:00\t-\tURAT\t1981 Apr  1\n"+
"\t\t\t5:00\t1:00\tURAST\t1981 Oct  1\n"+
"\t\t\t6:00\t-\tURAT\t1982 Apr  1\n"+
"\t\t\t5:00 RussiaAsia\tURA%sT\t1989 Mar 26 2:00\n"+
"\t\t\t4:00 RussiaAsia\tURA%sT\t1991\n"+
"\t\t\t4:00\t-\tURAT\t1991 Dec 16 # independence\n"+
"\t\t\t4:00 RussiaAsia\tORA%sT\t2005 Mar 15 # Oral Time\n"+
"\t\t\t5:00\t-\tORAT\n"+
"Rule\tKyrgyz\t1992\t1996\t-\tApr\tSun>=7\t0:00s\t1:00\tS\n"+
"Rule\tKyrgyz\t1992\t1996\t-\tSep\tlastSun\t0:00\t0\t-\n"+
"Rule\tKyrgyz\t1997\t2005\t-\tMar\tlastSun\t2:30\t1:00\tS\n"+
"Rule\tKyrgyz\t1997\t2004\t-\tOct\tlastSun\t2:30\t0\t-\n"+
"Zone\tAsia/Bishkek\t4:58:24 -\tLMT\t1924 May  2\n"+
"\t\t\t5:00\t-\tFRUT\t1930 Jun 21 # Frunze Time\n"+
"\t\t\t6:00 RussiaAsia FRU%sT\t1991 Mar 31 2:00s\n"+
"\t\t\t5:00\t1:00\tFRUST\t1991 Aug 31 2:00 # independence\n"+
"\t\t\t5:00\tKyrgyz\tKG%sT\t2005 Aug 12    # Kyrgyzstan Time\n"+
"\t\t\t6:00\t-\tKGT\n"+
"Rule\tROK\t1960\tonly\t-\tMay\t15\t0:00\t1:00\tD\n"+
"Rule\tROK\t1960\tonly\t-\tSep\t13\t0:00\t0\tS\n"+
"Rule\tROK\t1987\t1988\t-\tMay\tSun>=8\t0:00\t1:00\tD\n"+
"Rule\tROK\t1987\t1988\t-\tOct\tSun>=8\t0:00\t0\tS\n"+
"Zone\tAsia/Seoul\t8:27:52\t-\tLMT\t1890\n"+
"\t\t\t8:30\t-\tKST\t1904 Dec\n"+
"\t\t\t9:00\t-\tKST\t1928\n"+
"\t\t\t8:30\t-\tKST\t1932\n"+
"\t\t\t9:00\t-\tKST\t1954 Mar 21\n"+
"\t\t\t8:00\tROK\tK%sT\t1961 Aug 10\n"+
"\t\t\t8:30\t-\tKST\t1968 Oct\n"+
"\t\t\t9:00\tROK\tK%sT\n"+
"Zone\tAsia/Pyongyang\t8:23:00 -\tLMT\t1890\n"+
"\t\t\t8:30\t-\tKST\t1904 Dec\n"+
"\t\t\t9:00\t-\tKST\t1928\n"+
"\t\t\t8:30\t-\tKST\t1932\n"+
"\t\t\t9:00\t-\tKST\t1954 Mar 21\n"+
"\t\t\t8:00\t-\tKST\t1961 Aug 10\n"+
"\t\t\t9:00\t-\tKST\n"+
"Zone\tAsia/Kuwait\t3:11:56 -\tLMT\t1950\n"+
"\t\t\t3:00\t-\tAST\n"+
"Zone\tAsia/Vientiane\t6:50:24 -\tLMT\t1906 Jun  9 # or Viangchan\n"+
"\t\t\t7:06:20\t-\tSMT\t1911 Mar 11 0:01 # Saigon MT?\n"+
"\t\t\t7:00\t-\tICT\t1912 May\n"+
"\t\t\t8:00\t-\tICT\t1931 May\n"+
"\t\t\t7:00\t-\tICT\n"+
"Rule\tLebanon\t1920\tonly\t-\tMar\t28\t0:00\t1:00\tS\n"+
"Rule\tLebanon\t1920\tonly\t-\tOct\t25\t0:00\t0\t-\n"+
"Rule\tLebanon\t1921\tonly\t-\tApr\t3\t0:00\t1:00\tS\n"+
"Rule\tLebanon\t1921\tonly\t-\tOct\t3\t0:00\t0\t-\n"+
"Rule\tLebanon\t1922\tonly\t-\tMar\t26\t0:00\t1:00\tS\n"+
"Rule\tLebanon\t1922\tonly\t-\tOct\t8\t0:00\t0\t-\n"+
"Rule\tLebanon\t1923\tonly\t-\tApr\t22\t0:00\t1:00\tS\n"+
"Rule\tLebanon\t1923\tonly\t-\tSep\t16\t0:00\t0\t-\n"+
"Rule\tLebanon\t1957\t1961\t-\tMay\t1\t0:00\t1:00\tS\n"+
"Rule\tLebanon\t1957\t1961\t-\tOct\t1\t0:00\t0\t-\n"+
"Rule\tLebanon\t1972\tonly\t-\tJun\t22\t0:00\t1:00\tS\n"+
"Rule\tLebanon\t1972\t1977\t-\tOct\t1\t0:00\t0\t-\n"+
"Rule\tLebanon\t1973\t1977\t-\tMay\t1\t0:00\t1:00\tS\n"+
"Rule\tLebanon\t1978\tonly\t-\tApr\t30\t0:00\t1:00\tS\n"+
"Rule\tLebanon\t1978\tonly\t-\tSep\t30\t0:00\t0\t-\n"+
"Rule\tLebanon\t1984\t1987\t-\tMay\t1\t0:00\t1:00\tS\n"+
"Rule\tLebanon\t1984\t1991\t-\tOct\t16\t0:00\t0\t-\n"+
"Rule\tLebanon\t1988\tonly\t-\tJun\t1\t0:00\t1:00\tS\n"+
"Rule\tLebanon\t1989\tonly\t-\tMay\t10\t0:00\t1:00\tS\n"+
"Rule\tLebanon\t1990\t1992\t-\tMay\t1\t0:00\t1:00\tS\n"+
"Rule\tLebanon\t1992\tonly\t-\tOct\t4\t0:00\t0\t-\n"+
"Rule\tLebanon\t1993\tmax\t-\tMar\tlastSun\t0:00\t1:00\tS\n"+
"Rule\tLebanon\t1993\t1998\t-\tSep\tlastSun\t0:00\t0\t-\n"+
"Rule\tLebanon\t1999\tmax\t-\tOct\tlastSun\t0:00\t0\t-\n"+
"Zone\tAsia/Beirut\t2:22:00 -\tLMT\t1880\n"+
"\t\t\t2:00\tLebanon\tEE%sT\n"+
"Rule\tNBorneo\t1935\t1941\t-\tSep\t14\t0:00\t0:20\tTS # one-Third Summer\n"+
"Rule\tNBorneo\t1935\t1941\t-\tDec\t14\t0:00\t0\t-\n"+
"Zone Asia/Kuala_Lumpur\t6:46:46 -\tLMT\t1901 Jan  1\n"+
"\t\t\t6:55:25\t-\tSMT\t1905 Jun  1 # Singapore M.T.\n"+
"\t\t\t7:00\t-\tMALT\t1933 Jan  1 # Malaya Time\n"+
"\t\t\t7:00\t0:20\tMALST\t1936 Jan  1\n"+
"\t\t\t7:20\t-\tMALT\t1941 Sep  1\n"+
"\t\t\t7:30\t-\tMALT\t1942 Feb 16\n"+
"\t\t\t9:00\t-\tJST\t1945 Sep 12\n"+
"\t\t\t7:30\t-\tMALT\t1982 Jan  1\n"+
"\t\t\t8:00\t-\tMYT\t# Malaysia Time\n"+
"Zone Asia/Kuching\t7:21:20\t-\tLMT\t1926 Mar\n"+
"\t\t\t7:30\t-\tBORT\t1933\t# Borneo Time\n"+
"\t\t\t8:00\tNBorneo\tBOR%sT\t1942 Feb 16\n"+
"\t\t\t9:00\t-\tJST\t1945 Sep 12\n"+
"\t\t\t8:00\t-\tBORT\t1982 Jan  1\n"+
"\t\t\t8:00\t-\tMYT\n"+
"Zone\tIndian/Maldives\t4:54:00 -\tLMT\t1880\t# Male\n"+
"\t\t\t4:54:00\t-\tMMT\t1960\t# Male Mean Time\n"+
"\t\t\t5:00\t-\tMVT\t\t# Maldives Time\n"+
"Rule\tMongol\t1983\t1984\t-\tApr\t1\t0:00\t1:00\tS\n"+
"Rule\tMongol\t1983\tonly\t-\tOct\t1\t0:00\t0\t-\n"+
"Rule\tMongol\t1985\t1998\t-\tMar\tlastSun\t0:00\t1:00\tS\n"+
"Rule\tMongol\t1984\t1998\t-\tSep\tlastSun\t0:00\t0\t-\n"+
"Rule\tMongol\t2001\tonly\t-\tApr\tlastSat\t2:00\t1:00\tS\n"+
"Rule\tMongol\t2001\t2006\t-\tSep\tlastSat\t2:00\t0\t-\n"+
"Rule\tMongol\t2002\t2006\t-\tMar\tlastSat\t2:00\t1:00\tS\n"+
"Zone\tAsia/Hovd\t6:06:36 -\tLMT\t1905 Aug\n"+
"\t\t\t6:00\t-\tHOVT\t1978\t# Hovd Time\n"+
"\t\t\t7:00\tMongol\tHOV%sT\n"+
"Zone\tAsia/Ulaanbaatar 7:07:32 -\tLMT\t1905 Aug\n"+
"\t\t\t7:00\t-\tULAT\t1978\t# Ulaanbaatar Time\n"+
"\t\t\t8:00\tMongol\tULA%sT\n"+
"Zone\tAsia/Choibalsan\t7:38:00 -\tLMT\t1905 Aug\n"+
"\t\t\t7:00\t-\tULAT\t1978\n"+
"\t\t\t8:00\t-\tULAT\t1983 Apr\n"+
"\t\t\t9:00\tMongol\tCHO%sT\t2008 Mar 31 # Choibalsan Time\n"+
"\t\t\t8:00\tMongol\tCHO%sT\n"+
"Zone\tAsia/Kathmandu\t5:41:16 -\tLMT\t1920\n"+
"\t\t\t5:30\t-\tIST\t1986\n"+
"\t\t\t5:45\t-\tNPT\t# Nepal Time\n"+
"Zone\tAsia/Muscat\t3:54:20 -\tLMT\t1920\n"+
"\t\t\t4:00\t-\tGST\n"+
"Rule Pakistan\t2002\tonly\t-\tApr\tSun>=2\t0:01\t1:00\tS\n"+
"Rule Pakistan\t2002\tonly\t-\tOct\tSun>=2\t0:01\t0\t-\n"+
"Rule Pakistan\t2008\tonly\t-\tJun\t1\t0:00\t1:00\tS\n"+
"Rule Pakistan\t2008\tonly\t-\tNov\t1\t0:00\t0\t-\n"+
"Rule Pakistan\t2009\tonly\t-\tApr\t15\t0:00\t1:00\tS\n"+
"Rule Pakistan\t2009\tonly\t-\tNov\t1\t0:00\t0\t-\n"+
"Zone\tAsia/Karachi\t4:28:12 -\tLMT\t1907\n"+
"\t\t\t5:30\t-\tIST\t1942 Sep\n"+
"\t\t\t5:30\t1:00\tIST\t1945 Oct 15\n"+
"\t\t\t5:30\t-\tIST\t1951 Sep 30\n"+
"\t\t\t5:00\t-\tKART\t1971 Mar 26 # Karachi Time\n"+
"\t\t\t5:00 Pakistan\tPK%sT\t# Pakistan Time\n"+
"Rule EgyptAsia\t1957\tonly\t-\tMay\t10\t0:00\t1:00\tS\n"+
"Rule EgyptAsia\t1957\t1958\t-\tOct\t 1\t0:00\t0\t-\n"+
"Rule EgyptAsia\t1958\tonly\t-\tMay\t 1\t0:00\t1:00\tS\n"+
"Rule EgyptAsia\t1959\t1967\t-\tMay\t 1\t1:00\t1:00\tS\n"+
"Rule EgyptAsia\t1959\t1965\t-\tSep\t30\t3:00\t0\t-\n"+
"Rule EgyptAsia\t1966\tonly\t-\tOct\t 1\t3:00\t0\t-\n"+
"Rule Palestine\t1999\t2005\t-\tApr\tFri>=15\t0:00\t1:00\tS\n"+
"Rule Palestine\t1999\t2003\t-\tOct\tFri>=15\t0:00\t0\t-\n"+
"Rule Palestine\t2004\tonly\t-\tOct\t 1\t1:00\t0\t-\n"+
"Rule Palestine\t2005\tonly\t-\tOct\t 4\t2:00\t0\t-\n"+
"Rule Palestine\t2006\t2008\t-\tApr\t 1\t0:00\t1:00\tS\n"+
"Rule Palestine\t2006\tonly\t-\tSep\t22\t0:00\t0\t-\n"+
"Rule Palestine\t2007\tonly\t-\tSep\tThu>=8\t2:00\t0\t-\n"+
"Rule Palestine\t2008\tonly\t-\tAug\tlastFri\t0:00\t0\t-\n"+
"Rule Palestine\t2009\tonly\t-\tMar\tlastFri\t0:00\t1:00\tS\n"+
"Rule Palestine\t2009\tonly\t-\tSep\tFri>=1\t2:00\t0\t-\n"+
"Rule Palestine\t2010\tonly\t-\tMar\tlastSat\t0:01\t1:00\tS\n"+
"Rule Palestine\t2010\tonly\t-\tAug\t11\t0:00\t0\t-\n"+
"Zone\tAsia/Gaza\t2:17:52\t-\tLMT\t1900 Oct\n"+
"\t\t\t2:00\tZion\tEET\t1948 May 15\n"+
"\t\t\t2:00 EgyptAsia\tEE%sT\t1967 Jun  5\n"+
"\t\t\t2:00\tZion\tI%sT\t1996\n"+
"\t\t\t2:00\tJordan\tEE%sT\t1999\n"+
"\t\t\t2:00 Palestine\tEE%sT\t2011 Apr  2 12:01\n"+
"\t\t\t2:00\t1:00\tEEST\t2011 Aug  1\n"+
"\t\t\t2:00\t-\tEET\n"+
"Zone\tAsia/Hebron\t2:20:23\t-\tLMT\t1900 Oct\n"+
"\t\t\t2:00\tZion\tEET\t1948 May 15\n"+
"\t\t\t2:00 EgyptAsia\tEE%sT\t1967 Jun  5\n"+
"\t\t\t2:00\tZion\tI%sT\t1996\n"+
"\t\t\t2:00\tJordan\tEE%sT\t1999\n"+
"\t\t\t2:00 Palestine\tEE%sT\t2008 Aug\n"+
"\t\t\t2:00 \t1:00\tEEST\t2008 Sep\n"+
"\t\t\t2:00 Palestine\tEE%sT\t2011 Apr  1 12:01\n"+
"\t\t\t2:00\t1:00\tEEST\t2011 Aug  1\n"+
"\t\t\t2:00\t-\tEET\t2011 Aug 30\n"+
"\t\t\t2:00\t1:00\tEEST\t2011 Sep 30 3:00\n"+
"\t\t\t2:00\t-\tEET\n"+
"Rule\tPhil\t1936\tonly\t-\tNov\t1\t0:00\t1:00\tS\n"+
"Rule\tPhil\t1937\tonly\t-\tFeb\t1\t0:00\t0\t-\n"+
"Rule\tPhil\t1954\tonly\t-\tApr\t12\t0:00\t1:00\tS\n"+
"Rule\tPhil\t1954\tonly\t-\tJul\t1\t0:00\t0\t-\n"+
"Rule\tPhil\t1978\tonly\t-\tMar\t22\t0:00\t1:00\tS\n"+
"Rule\tPhil\t1978\tonly\t-\tSep\t21\t0:00\t0\t-\n"+
"Zone\tAsia/Manila\t-15:56:00 -\tLMT\t1844 Dec 31\n"+
"\t\t\t8:04:00 -\tLMT\t1899 May 11\n"+
"\t\t\t8:00\tPhil\tPH%sT\t1942 May\n"+
"\t\t\t9:00\t-\tJST\t1944 Nov\n"+
"\t\t\t8:00\tPhil\tPH%sT\n"+
"Zone\tAsia/Qatar\t3:26:08 -\tLMT\t1920\t# Al Dawhah / Doha\n"+
"\t\t\t4:00\t-\tGST\t1972 Jun\n"+
"\t\t\t3:00\t-\tAST\n"+
"Zone\tAsia/Riyadh\t3:06:52 -\tLMT\t1950\n"+
"\t\t\t3:00\t-\tAST\n"+
"Zone\tAsia/Singapore\t6:55:25 -\tLMT\t1901 Jan  1\n"+
"\t\t\t6:55:25\t-\tSMT\t1905 Jun  1 # Singapore M.T.\n"+
"\t\t\t7:00\t-\tMALT\t1933 Jan  1 # Malaya Time\n"+
"\t\t\t7:00\t0:20\tMALST\t1936 Jan  1\n"+
"\t\t\t7:20\t-\tMALT\t1941 Sep  1\n"+
"\t\t\t7:30\t-\tMALT\t1942 Feb 16\n"+
"\t\t\t9:00\t-\tJST\t1945 Sep 12\n"+
"\t\t\t7:30\t-\tMALT\t1965 Aug  9 # independence\n"+
"\t\t\t7:30\t-\tSGT\t1982 Jan  1 # Singapore Time\n"+
"\t\t\t8:00\t-\tSGT\n"+
"Zone\tAsia/Colombo\t5:19:24 -\tLMT\t1880\n"+
"\t\t\t5:19:32\t-\tMMT\t1906\t# Moratuwa Mean Time\n"+
"\t\t\t5:30\t-\tIST\t1942 Jan  5\n"+
"\t\t\t5:30\t0:30\tIHST\t1942 Sep\n"+
"\t\t\t5:30\t1:00\tIST\t1945 Oct 16 2:00\n"+
"\t\t\t5:30\t-\tIST\t1996 May 25 0:00\n"+
"\t\t\t6:30\t-\tLKT\t1996 Oct 26 0:30\n"+
"\t\t\t6:00\t-\tLKT\t2006 Apr 15 0:30\n"+
"\t\t\t5:30\t-\tIST\n"+
"Rule\tSyria\t1920\t1923\t-\tApr\tSun>=15\t2:00\t1:00\tS\n"+
"Rule\tSyria\t1920\t1923\t-\tOct\tSun>=1\t2:00\t0\t-\n"+
"Rule\tSyria\t1962\tonly\t-\tApr\t29\t2:00\t1:00\tS\n"+
"Rule\tSyria\t1962\tonly\t-\tOct\t1\t2:00\t0\t-\n"+
"Rule\tSyria\t1963\t1965\t-\tMay\t1\t2:00\t1:00\tS\n"+
"Rule\tSyria\t1963\tonly\t-\tSep\t30\t2:00\t0\t-\n"+
"Rule\tSyria\t1964\tonly\t-\tOct\t1\t2:00\t0\t-\n"+
"Rule\tSyria\t1965\tonly\t-\tSep\t30\t2:00\t0\t-\n"+
"Rule\tSyria\t1966\tonly\t-\tApr\t24\t2:00\t1:00\tS\n"+
"Rule\tSyria\t1966\t1976\t-\tOct\t1\t2:00\t0\t-\n"+
"Rule\tSyria\t1967\t1978\t-\tMay\t1\t2:00\t1:00\tS\n"+
"Rule\tSyria\t1977\t1978\t-\tSep\t1\t2:00\t0\t-\n"+
"Rule\tSyria\t1983\t1984\t-\tApr\t9\t2:00\t1:00\tS\n"+
"Rule\tSyria\t1983\t1984\t-\tOct\t1\t2:00\t0\t-\n"+
"Rule\tSyria\t1986\tonly\t-\tFeb\t16\t2:00\t1:00\tS\n"+
"Rule\tSyria\t1986\tonly\t-\tOct\t9\t2:00\t0\t-\n"+
"Rule\tSyria\t1987\tonly\t-\tMar\t1\t2:00\t1:00\tS\n"+
"Rule\tSyria\t1987\t1988\t-\tOct\t31\t2:00\t0\t-\n"+
"Rule\tSyria\t1988\tonly\t-\tMar\t15\t2:00\t1:00\tS\n"+
"Rule\tSyria\t1989\tonly\t-\tMar\t31\t2:00\t1:00\tS\n"+
"Rule\tSyria\t1989\tonly\t-\tOct\t1\t2:00\t0\t-\n"+
"Rule\tSyria\t1990\tonly\t-\tApr\t1\t2:00\t1:00\tS\n"+
"Rule\tSyria\t1990\tonly\t-\tSep\t30\t2:00\t0\t-\n"+
"Rule\tSyria\t1991\tonly\t-\tApr\t 1\t0:00\t1:00\tS\n"+
"Rule\tSyria\t1991\t1992\t-\tOct\t 1\t0:00\t0\t-\n"+
"Rule\tSyria\t1992\tonly\t-\tApr\t 8\t0:00\t1:00\tS\n"+
"Rule\tSyria\t1993\tonly\t-\tMar\t26\t0:00\t1:00\tS\n"+
"Rule\tSyria\t1993\tonly\t-\tSep\t25\t0:00\t0\t-\n"+
"Rule\tSyria\t1994\t1996\t-\tApr\t 1\t0:00\t1:00\tS\n"+
"Rule\tSyria\t1994\t2005\t-\tOct\t 1\t0:00\t0\t-\n"+
"Rule\tSyria\t1997\t1998\t-\tMar\tlastMon\t0:00\t1:00\tS\n"+
"Rule\tSyria\t1999\t2006\t-\tApr\t 1\t0:00\t1:00\tS\n"+
"Rule\tSyria\t2006\tonly\t-\tSep\t22\t0:00\t0\t-\n"+
"Rule\tSyria\t2007\tonly\t-\tMar\tlastFri\t0:00\t1:00\tS\n"+
"Rule\tSyria\t2007\tonly\t-\tNov\t Fri>=1\t0:00\t0\t-\n"+
"Rule\tSyria\t2008\tonly\t-\tApr\tFri>=1\t0:00\t1:00\tS\n"+
"Rule\tSyria\t2008\tonly\t-\tNov\t1\t0:00\t0\t-\n"+
"Rule\tSyria\t2009\tonly\t-\tMar\tlastFri\t0:00\t1:00\tS\n"+
"Rule\tSyria\t2010\tmax\t-\tApr\tFri>=1\t0:00\t1:00\tS\n"+
"Rule\tSyria\t2009\tmax\t-\tOct\tlastFri\t0:00\t0\t-\n"+
"Zone\tAsia/Damascus\t2:25:12 -\tLMT\t1920\t# Dimashq\n"+
"\t\t\t2:00\tSyria\tEE%sT\n"+
"Zone\tAsia/Dushanbe\t4:35:12 -\tLMT\t1924 May  2\n"+
"\t\t\t5:00\t-\tDUST\t1930 Jun 21 # Dushanbe Time\n"+
"\t\t\t6:00 RussiaAsia DUS%sT\t1991 Mar 31 2:00s\n"+
"\t\t\t5:00\t1:00\tDUSST\t1991 Sep  9 2:00s\n"+
"\t\t\t5:00\t-\tTJT\t\t    # Tajikistan Time\n"+
"Zone\tAsia/Bangkok\t6:42:04\t-\tLMT\t1880\n"+
"\t\t\t6:42:04\t-\tBMT\t1920 Apr # Bangkok Mean Time\n"+
"\t\t\t7:00\t-\tICT\n"+
"Zone\tAsia/Ashgabat\t3:53:32 -\tLMT\t1924 May  2 # or Ashkhabad\n"+
"\t\t\t4:00\t-\tASHT\t1930 Jun 21 # Ashkhabad Time\n"+
"\t\t\t5:00 RussiaAsia\tASH%sT\t1991 Mar 31 2:00\n"+
"\t\t\t4:00 RussiaAsia\tASH%sT\t1991 Oct 27 # independence\n"+
"\t\t\t4:00 RussiaAsia\tTM%sT\t1992 Jan 19 2:00\n"+
"\t\t\t5:00\t-\tTMT\n"+
"Zone\tAsia/Dubai\t3:41:12 -\tLMT\t1920\n"+
"\t\t\t4:00\t-\tGST\n"+
"Zone\tAsia/Samarkand\t4:27:12 -\tLMT\t1924 May  2\n"+
"\t\t\t4:00\t-\tSAMT\t1930 Jun 21 # Samarkand Time\n"+
"\t\t\t5:00\t-\tSAMT\t1981 Apr  1\n"+
"\t\t\t5:00\t1:00\tSAMST\t1981 Oct  1\n"+
"\t\t\t6:00\t-\tTAST\t1982 Apr  1 # Tashkent Time\n"+
"\t\t\t5:00 RussiaAsia\tSAM%sT\t1991 Sep  1 # independence\n"+
"\t\t\t5:00 RussiaAsia\tUZ%sT\t1992\n"+
"\t\t\t5:00\t-\tUZT\n"+
"Zone\tAsia/Tashkent\t4:37:12 -\tLMT\t1924 May  2\n"+
"\t\t\t5:00\t-\tTAST\t1930 Jun 21 # Tashkent Time\n"+
"\t\t\t6:00 RussiaAsia\tTAS%sT\t1991 Mar 31 2:00\n"+
"\t\t\t5:00 RussiaAsia\tTAS%sT\t1991 Sep  1 # independence\n"+
"\t\t\t5:00 RussiaAsia\tUZ%sT\t1992\n"+
"\t\t\t5:00\t-\tUZT\n"+
"Zone\tAsia/Ho_Chi_Minh\t7:06:40 -\tLMT\t1906 Jun  9\n"+
"\t\t\t7:06:20\t-\tSMT\t1911 Mar 11 0:01 # Saigon MT?\n"+
"\t\t\t7:00\t-\tICT\t1912 May\n"+
"\t\t\t8:00\t-\tICT\t1931 May\n"+
"\t\t\t7:00\t-\tICT\n"+
"Zone\tAsia/Aden\t3:00:48\t-\tLMT\t1950\n"+
"\t\t\t3:00\t-\tAST\n"+
"","tz/australasia":"Rule\tAus\t1917\tonly\t-\tJan\t 1\t0:01\t1:00\t-\n"+
"Rule\tAus\t1917\tonly\t-\tMar\t25\t2:00\t0\t-\n"+
"Rule\tAus\t1942\tonly\t-\tJan\t 1\t2:00\t1:00\t-\n"+
"Rule\tAus\t1942\tonly\t-\tMar\t29\t2:00\t0\t-\n"+
"Rule\tAus\t1942\tonly\t-\tSep\t27\t2:00\t1:00\t-\n"+
"Rule\tAus\t1943\t1944\t-\tMar\tlastSun\t2:00\t0\t-\n"+
"Rule\tAus\t1943\tonly\t-\tOct\t 3\t2:00\t1:00\t-\n"+
"Zone Australia/Darwin\t 8:43:20 -\tLMT\t1895 Feb\n"+
"\t\t\t 9:00\t-\tCST\t1899 May\n"+
"\t\t\t 9:30\tAus\tCST\n"+
"Rule\tAW\t1974\tonly\t-\tOct\tlastSun\t2:00s\t1:00\t-\n"+
"Rule\tAW\t1975\tonly\t-\tMar\tSun>=1\t2:00s\t0\t-\n"+
"Rule\tAW\t1983\tonly\t-\tOct\tlastSun\t2:00s\t1:00\t-\n"+
"Rule\tAW\t1984\tonly\t-\tMar\tSun>=1\t2:00s\t0\t-\n"+
"Rule\tAW\t1991\tonly\t-\tNov\t17\t2:00s\t1:00\t-\n"+
"Rule\tAW\t1992\tonly\t-\tMar\tSun>=1\t2:00s\t0\t-\n"+
"Rule\tAW\t2006\tonly\t-\tDec\t 3\t2:00s\t1:00\t-\n"+
"Rule\tAW\t2007\t2009\t-\tMar\tlastSun\t2:00s\t0\t-\n"+
"Rule\tAW\t2007\t2008\t-\tOct\tlastSun\t2:00s\t1:00\t-\n"+
"Zone Australia/Perth\t 7:43:24 -\tLMT\t1895 Dec\n"+
"\t\t\t 8:00\tAus\tWST\t1943 Jul\n"+
"\t\t\t 8:00\tAW\tWST\n"+
"Zone Australia/Eucla\t 8:35:28 -\tLMT\t1895 Dec\n"+
"\t\t\t 8:45\tAus\tCWST\t1943 Jul\n"+
"\t\t\t 8:45\tAW\tCWST\n"+
"Rule\tAQ\t1971\tonly\t-\tOct\tlastSun\t2:00s\t1:00\t-\n"+
"Rule\tAQ\t1972\tonly\t-\tFeb\tlastSun\t2:00s\t0\t-\n"+
"Rule\tAQ\t1989\t1991\t-\tOct\tlastSun\t2:00s\t1:00\t-\n"+
"Rule\tAQ\t1990\t1992\t-\tMar\tSun>=1\t2:00s\t0\t-\n"+
"Rule\tHoliday\t1992\t1993\t-\tOct\tlastSun\t2:00s\t1:00\t-\n"+
"Rule\tHoliday\t1993\t1994\t-\tMar\tSun>=1\t2:00s\t0\t-\n"+
"Zone Australia/Brisbane\t10:12:08 -\tLMT\t1895\n"+
"\t\t\t10:00\tAus\tEST\t1971\n"+
"\t\t\t10:00\tAQ\tEST\n"+
"Zone Australia/Lindeman  9:55:56 -\tLMT\t1895\n"+
"\t\t\t10:00\tAus\tEST\t1971\n"+
"\t\t\t10:00\tAQ\tEST\t1992 Jul\n"+
"\t\t\t10:00\tHoliday\tEST\n"+
"Rule\tAS\t1971\t1985\t-\tOct\tlastSun\t2:00s\t1:00\t-\n"+
"Rule\tAS\t1986\tonly\t-\tOct\t19\t2:00s\t1:00\t-\n"+
"Rule\tAS\t1987\t2007\t-\tOct\tlastSun\t2:00s\t1:00\t-\n"+
"Rule\tAS\t1972\tonly\t-\tFeb\t27\t2:00s\t0\t-\n"+
"Rule\tAS\t1973\t1985\t-\tMar\tSun>=1\t2:00s\t0\t-\n"+
"Rule\tAS\t1986\t1990\t-\tMar\tSun>=15\t2:00s\t0\t-\n"+
"Rule\tAS\t1991\tonly\t-\tMar\t3\t2:00s\t0\t-\n"+
"Rule\tAS\t1992\tonly\t-\tMar\t22\t2:00s\t0\t-\n"+
"Rule\tAS\t1993\tonly\t-\tMar\t7\t2:00s\t0\t-\n"+
"Rule\tAS\t1994\tonly\t-\tMar\t20\t2:00s\t0\t-\n"+
"Rule\tAS\t1995\t2005\t-\tMar\tlastSun\t2:00s\t0\t-\n"+
"Rule\tAS\t2006\tonly\t-\tApr\t2\t2:00s\t0\t-\n"+
"Rule\tAS\t2007\tonly\t-\tMar\tlastSun\t2:00s\t0\t-\n"+
"Rule\tAS\t2008\tmax\t-\tApr\tSun>=1\t2:00s\t0\t-\n"+
"Rule\tAS\t2008\tmax\t-\tOct\tSun>=1\t2:00s\t1:00\t-\n"+
"Zone Australia/Adelaide\t9:14:20 -\tLMT\t1895 Feb\n"+
"\t\t\t9:00\t-\tCST\t1899 May\n"+
"\t\t\t9:30\tAus\tCST\t1971\n"+
"\t\t\t9:30\tAS\tCST\n"+
"Rule\tAT\t1967\tonly\t-\tOct\tSun>=1\t2:00s\t1:00\t-\n"+
"Rule\tAT\t1968\tonly\t-\tMar\tlastSun\t2:00s\t0\t-\n"+
"Rule\tAT\t1968\t1985\t-\tOct\tlastSun\t2:00s\t1:00\t-\n"+
"Rule\tAT\t1969\t1971\t-\tMar\tSun>=8\t2:00s\t0\t-\n"+
"Rule\tAT\t1972\tonly\t-\tFeb\tlastSun\t2:00s\t0\t-\n"+
"Rule\tAT\t1973\t1981\t-\tMar\tSun>=1\t2:00s\t0\t-\n"+
"Rule\tAT\t1982\t1983\t-\tMar\tlastSun\t2:00s\t0\t-\n"+
"Rule\tAT\t1984\t1986\t-\tMar\tSun>=1\t2:00s\t0\t-\n"+
"Rule\tAT\t1986\tonly\t-\tOct\tSun>=15\t2:00s\t1:00\t-\n"+
"Rule\tAT\t1987\t1990\t-\tMar\tSun>=15\t2:00s\t0\t-\n"+
"Rule\tAT\t1987\tonly\t-\tOct\tSun>=22\t2:00s\t1:00\t-\n"+
"Rule\tAT\t1988\t1990\t-\tOct\tlastSun\t2:00s\t1:00\t-\n"+
"Rule\tAT\t1991\t1999\t-\tOct\tSun>=1\t2:00s\t1:00\t-\n"+
"Rule\tAT\t1991\t2005\t-\tMar\tlastSun\t2:00s\t0\t-\n"+
"Rule\tAT\t2000\tonly\t-\tAug\tlastSun\t2:00s\t1:00\t-\n"+
"Rule\tAT\t2001\tmax\t-\tOct\tSun>=1\t2:00s\t1:00\t-\n"+
"Rule\tAT\t2006\tonly\t-\tApr\tSun>=1\t2:00s\t0\t-\n"+
"Rule\tAT\t2007\tonly\t-\tMar\tlastSun\t2:00s\t0\t-\n"+
"Rule\tAT\t2008\tmax\t-\tApr\tSun>=1\t2:00s\t0\t-\n"+
"Zone Australia/Hobart\t9:49:16\t-\tLMT\t1895 Sep\n"+
"\t\t\t10:00\t-\tEST\t1916 Oct 1 2:00\n"+
"\t\t\t10:00\t1:00\tEST\t1917 Feb\n"+
"\t\t\t10:00\tAus\tEST\t1967\n"+
"\t\t\t10:00\tAT\tEST\n"+
"Zone Australia/Currie\t9:35:28\t-\tLMT\t1895 Sep\n"+
"\t\t\t10:00\t-\tEST\t1916 Oct 1 2:00\n"+
"\t\t\t10:00\t1:00\tEST\t1917 Feb\n"+
"\t\t\t10:00\tAus\tEST\t1971 Jul\n"+
"\t\t\t10:00\tAT\tEST\n"+
"Rule\tAV\t1971\t1985\t-\tOct\tlastSun\t2:00s\t1:00\t-\n"+
"Rule\tAV\t1972\tonly\t-\tFeb\tlastSun\t2:00s\t0\t-\n"+
"Rule\tAV\t1973\t1985\t-\tMar\tSun>=1\t2:00s\t0\t-\n"+
"Rule\tAV\t1986\t1990\t-\tMar\tSun>=15\t2:00s\t0\t-\n"+
"Rule\tAV\t1986\t1987\t-\tOct\tSun>=15\t2:00s\t1:00\t-\n"+
"Rule\tAV\t1988\t1999\t-\tOct\tlastSun\t2:00s\t1:00\t-\n"+
"Rule\tAV\t1991\t1994\t-\tMar\tSun>=1\t2:00s\t0\t-\n"+
"Rule\tAV\t1995\t2005\t-\tMar\tlastSun\t2:00s\t0\t-\n"+
"Rule\tAV\t2000\tonly\t-\tAug\tlastSun\t2:00s\t1:00\t-\n"+
"Rule\tAV\t2001\t2007\t-\tOct\tlastSun\t2:00s\t1:00\t-\n"+
"Rule\tAV\t2006\tonly\t-\tApr\tSun>=1\t2:00s\t0\t-\n"+
"Rule\tAV\t2007\tonly\t-\tMar\tlastSun\t2:00s\t0\t-\n"+
"Rule\tAV\t2008\tmax\t-\tApr\tSun>=1\t2:00s\t0\t-\n"+
"Rule\tAV\t2008\tmax\t-\tOct\tSun>=1\t2:00s\t1:00\t-\n"+
"Zone Australia/Melbourne 9:39:52 -\tLMT\t1895 Feb\n"+
"\t\t\t10:00\tAus\tEST\t1971\n"+
"\t\t\t10:00\tAV\tEST\n"+
"Rule\tAN\t1971\t1985\t-\tOct\tlastSun\t2:00s\t1:00\t-\n"+
"Rule\tAN\t1972\tonly\t-\tFeb\t27\t2:00s\t0\t-\n"+
"Rule\tAN\t1973\t1981\t-\tMar\tSun>=1\t2:00s\t0\t-\n"+
"Rule\tAN\t1982\tonly\t-\tApr\tSun>=1\t2:00s\t0\t-\n"+
"Rule\tAN\t1983\t1985\t-\tMar\tSun>=1\t2:00s\t0\t-\n"+
"Rule\tAN\t1986\t1989\t-\tMar\tSun>=15\t2:00s\t0\t-\n"+
"Rule\tAN\t1986\tonly\t-\tOct\t19\t2:00s\t1:00\t-\n"+
"Rule\tAN\t1987\t1999\t-\tOct\tlastSun\t2:00s\t1:00\t-\n"+
"Rule\tAN\t1990\t1995\t-\tMar\tSun>=1\t2:00s\t0\t-\n"+
"Rule\tAN\t1996\t2005\t-\tMar\tlastSun\t2:00s\t0\t-\n"+
"Rule\tAN\t2000\tonly\t-\tAug\tlastSun\t2:00s\t1:00\t-\n"+
"Rule\tAN\t2001\t2007\t-\tOct\tlastSun\t2:00s\t1:00\t-\n"+
"Rule\tAN\t2006\tonly\t-\tApr\tSun>=1\t2:00s\t0\t-\n"+
"Rule\tAN\t2007\tonly\t-\tMar\tlastSun\t2:00s\t0\t-\n"+
"Rule\tAN\t2008\tmax\t-\tApr\tSun>=1\t2:00s\t0\t-\n"+
"Rule\tAN\t2008\tmax\t-\tOct\tSun>=1\t2:00s\t1:00\t-\n"+
"Zone Australia/Sydney\t10:04:52 -\tLMT\t1895 Feb\n"+
"\t\t\t10:00\tAus\tEST\t1971\n"+
"\t\t\t10:00\tAN\tEST\n"+
"Zone Australia/Broken_Hill 9:25:48 -\tLMT\t1895 Feb\n"+
"\t\t\t10:00\t-\tEST\t1896 Aug 23\n"+
"\t\t\t9:00\t-\tCST\t1899 May\n"+
"\t\t\t9:30\tAus\tCST\t1971\n"+
"\t\t\t9:30\tAN\tCST\t2000\n"+
"\t\t\t9:30\tAS\tCST\n"+
"Rule\tLH\t1981\t1984\t-\tOct\tlastSun\t2:00\t1:00\t-\n"+
"Rule\tLH\t1982\t1985\t-\tMar\tSun>=1\t2:00\t0\t-\n"+
"Rule\tLH\t1985\tonly\t-\tOct\tlastSun\t2:00\t0:30\t-\n"+
"Rule\tLH\t1986\t1989\t-\tMar\tSun>=15\t2:00\t0\t-\n"+
"Rule\tLH\t1986\tonly\t-\tOct\t19\t2:00\t0:30\t-\n"+
"Rule\tLH\t1987\t1999\t-\tOct\tlastSun\t2:00\t0:30\t-\n"+
"Rule\tLH\t1990\t1995\t-\tMar\tSun>=1\t2:00\t0\t-\n"+
"Rule\tLH\t1996\t2005\t-\tMar\tlastSun\t2:00\t0\t-\n"+
"Rule\tLH\t2000\tonly\t-\tAug\tlastSun\t2:00\t0:30\t-\n"+
"Rule\tLH\t2001\t2007\t-\tOct\tlastSun\t2:00\t0:30\t-\n"+
"Rule\tLH\t2006\tonly\t-\tApr\tSun>=1\t2:00\t0\t-\n"+
"Rule\tLH\t2007\tonly\t-\tMar\tlastSun\t2:00\t0\t-\n"+
"Rule\tLH\t2008\tmax\t-\tApr\tSun>=1\t2:00\t0\t-\n"+
"Rule\tLH\t2008\tmax\t-\tOct\tSun>=1\t2:00\t0:30\t-\n"+
"Zone Australia/Lord_Howe 10:36:20 -\tLMT\t1895 Feb\n"+
"\t\t\t10:00\t-\tEST\t1981 Mar\n"+
"\t\t\t10:30\tLH\tLHST\n"+
"Zone Indian/Christmas\t7:02:52 -\tLMT\t1895 Feb\n"+
"\t\t\t7:00\t-\tCXT\t# Christmas Island Time\n"+
"Rule\tCook\t1978\tonly\t-\tNov\t12\t0:00\t0:30\tHS\n"+
"Rule\tCook\t1979\t1991\t-\tMar\tSun>=1\t0:00\t0\t-\n"+
"Rule\tCook\t1979\t1990\t-\tOct\tlastSun\t0:00\t0:30\tHS\n"+
"Zone Pacific/Rarotonga\t-10:39:04 -\tLMT\t1901\t\t# Avarua\n"+
"\t\t\t-10:30\t-\tCKT\t1978 Nov 12\t# Cook Is Time\n"+
"\t\t\t-10:00\tCook\tCK%sT\n"+
"Zone\tIndian/Cocos\t6:27:40\t-\tLMT\t1900\n"+
"\t\t\t6:30\t-\tCCT\t# Cocos Islands Time\n"+
"Rule\tFiji\t1998\t1999\t-\tNov\tSun>=1\t2:00\t1:00\tS\n"+
"Rule\tFiji\t1999\t2000\t-\tFeb\tlastSun\t3:00\t0\t-\n"+
"Rule\tFiji\t2009\tonly\t-\tNov\t29\t2:00\t1:00\tS\n"+
"Rule\tFiji\t2010\tonly\t-\tMar\tlastSun\t3:00\t0\t-\n"+
"Rule\tFiji\t2010\tonly\t-\tOct\t24\t2:00\t1:00\tS\n"+
"Rule\tFiji\t2011\tonly\t-\tMar\tSun>=1\t3:00\t0\t-\n"+
"Rule\tFiji\t2011\tonly\t-\tOct\t23\t2:00\t1:00\tS\n"+
"Rule\tFiji\t2012\tonly\t-\tJan\t22\t3:00\t0\t-\n"+
"Zone\tPacific/Fiji\t11:53:40 -\tLMT\t1915 Oct 26\t# Suva\n"+
"\t\t\t12:00\tFiji\tFJ%sT\t# Fiji Time\n"+
"Zone\tPacific/Gambier\t -8:59:48 -\tLMT\t1912 Oct\t# Rikitea\n"+
"\t\t\t -9:00\t-\tGAMT\t# Gambier Time\n"+
"Zone\tPacific/Marquesas -9:18:00 -\tLMT\t1912 Oct\n"+
"\t\t\t -9:30\t-\tMART\t# Marquesas Time\n"+
"Zone\tPacific/Tahiti\t -9:58:16 -\tLMT\t1912 Oct\t# Papeete\n"+
"\t\t\t-10:00\t-\tTAHT\t# Tahiti Time\n"+
"Zone\tPacific/Guam\t-14:21:00 -\tLMT\t1844 Dec 31\n"+
"\t\t\t 9:39:00 -\tLMT\t1901\t\t# Agana\n"+
"\t\t\t10:00\t-\tGST\t2000 Dec 23\t# Guam\n"+
"\t\t\t10:00\t-\tChST\t# Chamorro Standard Time\n"+
"Zone Pacific/Tarawa\t 11:32:04 -\tLMT\t1901\t\t# Bairiki\n"+
"\t\t\t 12:00\t-\tGILT\t\t # Gilbert Is Time\n"+
"Zone Pacific/Enderbury\t-11:24:20 -\tLMT\t1901\n"+
"\t\t\t-12:00\t-\tPHOT\t1979 Oct # Phoenix Is Time\n"+
"\t\t\t-11:00\t-\tPHOT\t1995\n"+
"\t\t\t 13:00\t-\tPHOT\n"+
"Zone Pacific/Kiritimati\t-10:29:20 -\tLMT\t1901\n"+
"\t\t\t-10:40\t-\tLINT\t1979 Oct # Line Is Time\n"+
"\t\t\t-10:00\t-\tLINT\t1995\n"+
"\t\t\t 14:00\t-\tLINT\n"+
"Zone Pacific/Saipan\t-14:17:00 -\tLMT\t1844 Dec 31\n"+
"\t\t\t 9:43:00 -\tLMT\t1901\n"+
"\t\t\t 9:00\t-\tMPT\t1969 Oct # N Mariana Is Time\n"+
"\t\t\t10:00\t-\tMPT\t2000 Dec 23\n"+
"\t\t\t10:00\t-\tChST\t# Chamorro Standard Time\n"+
"Zone Pacific/Majuro\t11:24:48 -\tLMT\t1901\n"+
"\t\t\t11:00\t-\tMHT\t1969 Oct # Marshall Islands Time\n"+
"\t\t\t12:00\t-\tMHT\n"+
"Zone Pacific/Kwajalein\t11:09:20 -\tLMT\t1901\n"+
"\t\t\t11:00\t-\tMHT\t1969 Oct\n"+
"\t\t\t-12:00\t-\tKWAT\t1993 Aug 20\t# Kwajalein Time\n"+
"\t\t\t12:00\t-\tMHT\n"+
"Zone Pacific/Chuuk\t10:07:08 -\tLMT\t1901\n"+
"\t\t\t10:00\t-\tCHUT\t\t\t# Chuuk Time\n"+
"Zone Pacific/Pohnpei\t10:32:52 -\tLMT\t1901\t\t# Kolonia\n"+
"\t\t\t11:00\t-\tPONT\t\t\t# Pohnpei Time\n"+
"Zone Pacific/Kosrae\t10:51:56 -\tLMT\t1901\n"+
"\t\t\t11:00\t-\tKOST\t1969 Oct\t# Kosrae Time\n"+
"\t\t\t12:00\t-\tKOST\t1999\n"+
"\t\t\t11:00\t-\tKOST\n"+
"Zone\tPacific/Nauru\t11:07:40 -\tLMT\t1921 Jan 15\t# Uaobe\n"+
"\t\t\t11:30\t-\tNRT\t1942 Mar 15\t# Nauru Time\n"+
"\t\t\t9:00\t-\tJST\t1944 Aug 15\n"+
"\t\t\t11:30\t-\tNRT\t1979 May\n"+
"\t\t\t12:00\t-\tNRT\n"+
"Rule\tNC\t1977\t1978\t-\tDec\tSun>=1\t0:00\t1:00\tS\n"+
"Rule\tNC\t1978\t1979\t-\tFeb\t27\t0:00\t0\t-\n"+
"Rule\tNC\t1996\tonly\t-\tDec\t 1\t2:00s\t1:00\tS\n"+
"Rule\tNC\t1997\tonly\t-\tMar\t 2\t2:00s\t0\t-\n"+
"Zone\tPacific/Noumea\t11:05:48 -\tLMT\t1912 Jan 13\n"+
"\t\t\t11:00\tNC\tNC%sT\n"+
"Rule\tNZ\t1927\tonly\t-\tNov\t 6\t2:00\t1:00\tS\n"+
"Rule\tNZ\t1928\tonly\t-\tMar\t 4\t2:00\t0\tM\n"+
"Rule\tNZ\t1928\t1933\t-\tOct\tSun>=8\t2:00\t0:30\tS\n"+
"Rule\tNZ\t1929\t1933\t-\tMar\tSun>=15\t2:00\t0\tM\n"+
"Rule\tNZ\t1934\t1940\t-\tApr\tlastSun\t2:00\t0\tM\n"+
"Rule\tNZ\t1934\t1940\t-\tSep\tlastSun\t2:00\t0:30\tS\n"+
"Rule\tNZ\t1946\tonly\t-\tJan\t 1\t0:00\t0\tS\n"+
"Rule\tNZ\t1974\tonly\t-\tNov\tSun>=1\t2:00s\t1:00\tD\n"+
"Rule\tChatham\t1974\tonly\t-\tNov\tSun>=1\t2:45s\t1:00\tD\n"+
"Rule\tNZ\t1975\tonly\t-\tFeb\tlastSun\t2:00s\t0\tS\n"+
"Rule\tChatham\t1975\tonly\t-\tFeb\tlastSun\t2:45s\t0\tS\n"+
"Rule\tNZ\t1975\t1988\t-\tOct\tlastSun\t2:00s\t1:00\tD\n"+
"Rule\tChatham\t1975\t1988\t-\tOct\tlastSun\t2:45s\t1:00\tD\n"+
"Rule\tNZ\t1976\t1989\t-\tMar\tSun>=1\t2:00s\t0\tS\n"+
"Rule\tChatham\t1976\t1989\t-\tMar\tSun>=1\t2:45s\t0\tS\n"+
"Rule\tNZ\t1989\tonly\t-\tOct\tSun>=8\t2:00s\t1:00\tD\n"+
"Rule\tChatham\t1989\tonly\t-\tOct\tSun>=8\t2:45s\t1:00\tD\n"+
"Rule\tNZ\t1990\t2006\t-\tOct\tSun>=1\t2:00s\t1:00\tD\n"+
"Rule\tChatham\t1990\t2006\t-\tOct\tSun>=1\t2:45s\t1:00\tD\n"+
"Rule\tNZ\t1990\t2007\t-\tMar\tSun>=15\t2:00s\t0\tS\n"+
"Rule\tChatham\t1990\t2007\t-\tMar\tSun>=15\t2:45s\t0\tS\n"+
"Rule\tNZ\t2007\tmax\t-\tSep\tlastSun\t2:00s\t1:00\tD\n"+
"Rule\tChatham\t2007\tmax\t-\tSep\tlastSun\t2:45s\t1:00\tD\n"+
"Rule\tNZ\t2008\tmax\t-\tApr\tSun>=1\t2:00s\t0\tS\n"+
"Rule\tChatham\t2008\tmax\t-\tApr\tSun>=1\t2:45s\t0\tS\n"+
"Zone Pacific/Auckland\t11:39:04 -\tLMT\t1868 Nov  2\n"+
"\t\t\t11:30\tNZ\tNZ%sT\t1946 Jan  1\n"+
"\t\t\t12:00\tNZ\tNZ%sT\n"+
"Zone Pacific/Chatham\t12:13:48 -\tLMT\t1957 Jan  1\n"+
"\t\t\t12:45\tChatham\tCHA%sT\n"+
"Zone\tPacific/Niue\t-11:19:40 -\tLMT\t1901\t\t# Alofi\n"+
"\t\t\t-11:20\t-\tNUT\t1951\t# Niue Time\n"+
"\t\t\t-11:30\t-\tNUT\t1978 Oct 1\n"+
"\t\t\t-11:00\t-\tNUT\n"+
"Zone\tPacific/Norfolk\t11:11:52 -\tLMT\t1901\t\t# Kingston\n"+
"\t\t\t11:12\t-\tNMT\t1951\t# Norfolk Mean Time\n"+
"\t\t\t11:30\t-\tNFT\t\t# Norfolk Time\n"+
"Zone Pacific/Palau\t8:57:56 -\tLMT\t1901\t\t# Koror\n"+
"\t\t\t9:00\t-\tPWT\t# Palau Time\n"+
"Zone Pacific/Port_Moresby 9:48:40 -\tLMT\t1880\n"+
"\t\t\t9:48:32\t-\tPMMT\t1895\t# Port Moresby Mean Time\n"+
"\t\t\t10:00\t-\tPGT\t\t# Papua New Guinea Time\n"+
"Zone Pacific/Pitcairn\t-8:40:20 -\tLMT\t1901\t\t# Adamstown\n"+
"\t\t\t-8:30\t-\tPNT\t1998 Apr 27 00:00\n"+
"\t\t\t-8:00\t-\tPST\t# Pitcairn Standard Time\n"+
"Zone Pacific/Pago_Pago\t 12:37:12 -\tLMT\t1879 Jul  5\n"+
"\t\t\t-11:22:48 -\tLMT\t1911\n"+
"\t\t\t-11:30\t-\tSAMT\t1950\t\t# Samoa Time\n"+
"\t\t\t-11:00\t-\tNST\t1967 Apr\t# N=Nome\n"+
"\t\t\t-11:00\t-\tBST\t1983 Nov 30\t# B=Bering\n"+
"\t\t\t-11:00\t-\tSST\t\t\t# S=Samoa\n"+
"Zone Pacific/Apia\t 12:33:04 -\tLMT\t1879 Jul  5\n"+
"\t\t\t-11:26:56 -\tLMT\t1911\n"+
"\t\t\t-11:30\t-\tSAMT\t1950\t\t# Samoa Time\n"+
"\t\t\t-11:00\t-\tWST\t2010 Sep 26\n"+
"\t\t\t-11:00\t1:00\tWSDT\t2011 Apr 2 4:00\n"+
"\t\t\t-11:00\t-\tWST\t2011 Sep 24 3:00\n"+
"\t\t\t-11:00\t1:00\tWSDT\t2011 Dec 30\n"+
"\t\t\t 13:00\t1:00\tWSDT\t2012 Apr 1 4:00\n"+
"\t\t\t 13:00\t-\tWST\n"+
"Zone Pacific/Guadalcanal 10:39:48 -\tLMT\t1912 Oct\t# Honiara\n"+
"\t\t\t11:00\t-\tSBT\t# Solomon Is Time\n"+
"Zone\tPacific/Fakaofo\t-11:24:56 -\tLMT\t1901\n"+
"\t\t\t-10:00\t-\tTKT\t# Tokelau Time\n"+
"Rule\tTonga\t1999\tonly\t-\tOct\t 7\t2:00s\t1:00\tS\n"+
"Rule\tTonga\t2000\tonly\t-\tMar\t19\t2:00s\t0\t-\n"+
"Rule\tTonga\t2000\t2001\t-\tNov\tSun>=1\t2:00\t1:00\tS\n"+
"Rule\tTonga\t2001\t2002\t-\tJan\tlastSun\t2:00\t0\t-\n"+
"Zone Pacific/Tongatapu\t12:19:20 -\tLMT\t1901\n"+
"\t\t\t12:20\t-\tTOT\t1941 # Tonga Time\n"+
"\t\t\t13:00\t-\tTOT\t1999\n"+
"\t\t\t13:00\tTonga\tTO%sT\n"+
"Zone Pacific/Funafuti\t11:56:52 -\tLMT\t1901\n"+
"\t\t\t12:00\t-\tTVT\t# Tuvalu Time\n"+
"Zone Pacific/Johnston\t-10:00\t-\tHST\n"+
"Zone Pacific/Midway\t-11:49:28 -\tLMT\t1901\n"+
"\t\t\t-11:00\t-\tNST\t1956 Jun  3\n"+
"\t\t\t-11:00\t1:00\tNDT\t1956 Sep  2\n"+
"\t\t\t-11:00\t-\tNST\t1967 Apr\t# N=Nome\n"+
"\t\t\t-11:00\t-\tBST\t1983 Nov 30\t# B=Bering\n"+
"\t\t\t-11:00\t-\tSST\t\t\t# S=Samoa\n"+
"Zone\tPacific/Wake\t11:06:28 -\tLMT\t1901\n"+
"\t\t\t12:00\t-\tWAKT\t# Wake Time\n"+
"Rule\tVanuatu\t1983\tonly\t-\tSep\t25\t0:00\t1:00\tS\n"+
"Rule\tVanuatu\t1984\t1991\t-\tMar\tSun>=23\t0:00\t0\t-\n"+
"Rule\tVanuatu\t1984\tonly\t-\tOct\t23\t0:00\t1:00\tS\n"+
"Rule\tVanuatu\t1985\t1991\t-\tSep\tSun>=23\t0:00\t1:00\tS\n"+
"Rule\tVanuatu\t1992\t1993\t-\tJan\tSun>=23\t0:00\t0\t-\n"+
"Rule\tVanuatu\t1992\tonly\t-\tOct\tSun>=23\t0:00\t1:00\tS\n"+
"Zone\tPacific/Efate\t11:13:16 -\tLMT\t1912 Jan 13\t\t# Vila\n"+
"\t\t\t11:00\tVanuatu\tVU%sT\t# Vanuatu Time\n"+
"Zone\tPacific/Wallis\t12:15:20 -\tLMT\t1901\n"+
"\t\t\t12:00\t-\tWFT\t# Wallis & Futuna Time\n"+
"","tz/backward":"# <pre>\n"+
"# @(#)backward\t8.11\n"+
"# This file is in the public domain, so clarified as of\n"+
"# 2009-05-17 by Arthur David Olson.\n"+
"\n"+
"# This file provides links between current names for time zones\n"+
"# and their old names.  Many names changed in late 1993.\n"+
"\n"+
"Link\tAfrica/Asmara\t\tAfrica/Asmera\n"+
"Link\tAfrica/Bamako\t\tAfrica/Timbuktu\n"+
"Link\tAmerica/Argentina/Catamarca\tAmerica/Argentina/ComodRivadavia\n"+
"Link\tAmerica/Adak\t\tAmerica/Atka\n"+
"Link\tAmerica/Argentina/Buenos_Aires\tAmerica/Buenos_Aires\n"+
"Link\tAmerica/Argentina/Catamarca\tAmerica/Catamarca\n"+
"Link\tAmerica/Atikokan\tAmerica/Coral_Harbour\n"+
"Link\tAmerica/Argentina/Cordoba\tAmerica/Cordoba\n"+
"Link\tAmerica/Tijuana\t\tAmerica/Ensenada\n"+
"Link\tAmerica/Indiana/Indianapolis\tAmerica/Fort_Wayne\n"+
"Link\tAmerica/Indiana/Indianapolis\tAmerica/Indianapolis\n"+
"Link\tAmerica/Argentina/Jujuy\tAmerica/Jujuy\n"+
"Link\tAmerica/Indiana/Knox\tAmerica/Knox_IN\n"+
"Link\tAmerica/Kentucky/Louisville\tAmerica/Louisville\n"+
"Link\tAmerica/Argentina/Mendoza\tAmerica/Mendoza\n"+
"Link\tAmerica/Rio_Branco\tAmerica/Porto_Acre\n"+
"Link\tAmerica/Argentina/Cordoba\tAmerica/Rosario\n"+
"Link\tAmerica/St_Thomas\tAmerica/Virgin\n"+
"Link\tAsia/Ashgabat\t\tAsia/Ashkhabad\n"+
"Link\tAsia/Chongqing\t\tAsia/Chungking\n"+
"Link\tAsia/Dhaka\t\tAsia/Dacca\n"+
"Link\tAsia/Kathmandu\t\tAsia/Katmandu\n"+
"Link\tAsia/Kolkata\t\tAsia/Calcutta\n"+
"Link\tAsia/Macau\t\tAsia/Macao\n"+
"Link\tAsia/Jerusalem\t\tAsia/Tel_Aviv\n"+
"Link\tAsia/Ho_Chi_Minh\tAsia/Saigon\n"+
"Link\tAsia/Thimphu\t\tAsia/Thimbu\n"+
"Link\tAsia/Makassar\t\tAsia/Ujung_Pandang\n"+
"Link\tAsia/Ulaanbaatar\tAsia/Ulan_Bator\n"+
"Link\tAtlantic/Faroe\t\tAtlantic/Faeroe\n"+
"Link\tEurope/Oslo\t\tAtlantic/Jan_Mayen\n"+
"Link\tAustralia/Sydney\tAustralia/ACT\n"+
"Link\tAustralia/Sydney\tAustralia/Canberra\n"+
"Link\tAustralia/Lord_Howe\tAustralia/LHI\n"+
"Link\tAustralia/Sydney\tAustralia/NSW\n"+
"Link\tAustralia/Darwin\tAustralia/North\n"+
"Link\tAustralia/Brisbane\tAustralia/Queensland\n"+
"Link\tAustralia/Adelaide\tAustralia/South\n"+
"Link\tAustralia/Hobart\tAustralia/Tasmania\n"+
"Link\tAustralia/Melbourne\tAustralia/Victoria\n"+
"Link\tAustralia/Perth\t\tAustralia/West\n"+
"Link\tAustralia/Broken_Hill\tAustralia/Yancowinna\n"+
"Link\tAmerica/Rio_Branco\tBrazil/Acre\n"+
"Link\tAmerica/Noronha\t\tBrazil/DeNoronha\n"+
"Link\tAmerica/Sao_Paulo\tBrazil/East\n"+
"Link\tAmerica/Manaus\t\tBrazil/West\n"+
"Link\tAmerica/Halifax\t\tCanada/Atlantic\n"+
"Link\tAmerica/Winnipeg\tCanada/Central\n"+
"Link\tAmerica/Regina\t\tCanada/East-Saskatchewan\n"+
"Link\tAmerica/Toronto\t\tCanada/Eastern\n"+
"Link\tAmerica/Edmonton\tCanada/Mountain\n"+
"Link\tAmerica/St_Johns\tCanada/Newfoundland\n"+
"Link\tAmerica/Vancouver\tCanada/Pacific\n"+
"Link\tAmerica/Regina\t\tCanada/Saskatchewan\n"+
"Link\tAmerica/Whitehorse\tCanada/Yukon\n"+
"Link\tAmerica/Santiago\tChile/Continental\n"+
"Link\tPacific/Easter\t\tChile/EasterIsland\n"+
"Link\tAmerica/Havana\t\tCuba\n"+
"Link\tAfrica/Cairo\t\tEgypt\n"+
"Link\tEurope/Dublin\t\tEire\n"+
"Link\tEurope/London\t\tEurope/Belfast\n"+
"Link\tEurope/Chisinau\t\tEurope/Tiraspol\n"+
"Link\tEurope/London\t\tGB\n"+
"Link\tEurope/London\t\tGB-Eire\n"+
"Link\tEtc/GMT\t\t\tGMT+0\n"+
"Link\tEtc/GMT\t\t\tGMT-0\n"+
"Link\tEtc/GMT\t\t\tGMT0\n"+
"Link\tEtc/GMT\t\t\tGreenwich\n"+
"Link\tAsia/Hong_Kong\t\tHongkong\n"+
"Link\tAtlantic/Reykjavik\tIceland\n"+
"Link\tAsia/Tehran\t\tIran\n"+
"Link\tAsia/Jerusalem\t\tIsrael\n"+
"Link\tAmerica/Jamaica\t\tJamaica\n"+
"Link\tAsia/Tokyo\t\tJapan\n"+
"Link\tPacific/Kwajalein\tKwajalein\n"+
"Link\tAfrica/Tripoli\t\tLibya\n"+
"Link\tAmerica/Tijuana\t\tMexico/BajaNorte\n"+
"Link\tAmerica/Mazatlan\tMexico/BajaSur\n"+
"Link\tAmerica/Mexico_City\tMexico/General\n"+
"Link\tPacific/Auckland\tNZ\n"+
"Link\tPacific/Chatham\t\tNZ-CHAT\n"+
"Link\tAmerica/Denver\t\tNavajo\n"+
"Link\tAsia/Shanghai\t\tPRC\n"+
"Link\tPacific/Pago_Pago\tPacific/Samoa\n"+
"Link\tPacific/Chuuk\t\tPacific/Yap\n"+
"Link\tPacific/Chuuk\t\tPacific/Truk\n"+
"Link\tPacific/Pohnpei\t\tPacific/Ponape\n"+
"Link\tEurope/Warsaw\t\tPoland\n"+
"Link\tEurope/Lisbon\t\tPortugal\n"+
"Link\tAsia/Taipei\t\tROC\n"+
"Link\tAsia/Seoul\t\tROK\n"+
"Link\tAsia/Singapore\t\tSingapore\n"+
"Link\tEurope/Istanbul\t\tTurkey\n"+
"Link\tEtc/UCT\t\t\tUCT\n"+
"Link\tAmerica/Anchorage\tUS/Alaska\n"+
"Link\tAmerica/Adak\t\tUS/Aleutian\n"+
"Link\tAmerica/Phoenix\t\tUS/Arizona\n"+
"Link\tAmerica/Chicago\t\tUS/Central\n"+
"Link\tAmerica/Indiana/Indianapolis\tUS/East-Indiana\n"+
"Link\tAmerica/New_York\tUS/Eastern\n"+
"Link\tPacific/Honolulu\tUS/Hawaii\n"+
"Link\tAmerica/Indiana/Knox\tUS/Indiana-Starke\n"+
"Link\tAmerica/Detroit\t\tUS/Michigan\n"+
"Link\tAmerica/Denver\t\tUS/Mountain\n"+
"Link\tAmerica/Los_Angeles\tUS/Pacific\n"+
"Link\tPacific/Pago_Pago\tUS/Samoa\n"+
"Link\tEtc/UTC\t\t\tUTC\n"+
"Link\tEtc/UTC\t\t\tUniversal\n"+
"Link\tEurope/Moscow\t\tW-SU\n"+
"Link\tEtc/UTC\t\t\tZulu\n"+
"","tz/etcetera":"Zone\tEtc/GMT\t\t0\t-\tGMT\n"+
"Zone\tEtc/UTC\t\t0\t-\tUTC\n"+
"Zone\tEtc/UCT\t\t0\t-\tUCT\n"+
"Link\tEtc/GMT\t\t\t\tGMT\n"+
"Link\tEtc/UTC\t\t\t\tEtc/Universal\n"+
"Link\tEtc/UTC\t\t\t\tEtc/Zulu\n"+
"Link\tEtc/GMT\t\t\t\tEtc/Greenwich\n"+
"Link\tEtc/GMT\t\t\t\tEtc/GMT-0\n"+
"Link\tEtc/GMT\t\t\t\tEtc/GMT+0\n"+
"Link\tEtc/GMT\t\t\t\tEtc/GMT0\n"+
"Zone\tEtc/GMT-14\t14\t-\tGMT-14\t# 14 hours ahead of GMT\n"+
"Zone\tEtc/GMT-13\t13\t-\tGMT-13\n"+
"Zone\tEtc/GMT-12\t12\t-\tGMT-12\n"+
"Zone\tEtc/GMT-11\t11\t-\tGMT-11\n"+
"Zone\tEtc/GMT-10\t10\t-\tGMT-10\n"+
"Zone\tEtc/GMT-9\t9\t-\tGMT-9\n"+
"Zone\tEtc/GMT-8\t8\t-\tGMT-8\n"+
"Zone\tEtc/GMT-7\t7\t-\tGMT-7\n"+
"Zone\tEtc/GMT-6\t6\t-\tGMT-6\n"+
"Zone\tEtc/GMT-5\t5\t-\tGMT-5\n"+
"Zone\tEtc/GMT-4\t4\t-\tGMT-4\n"+
"Zone\tEtc/GMT-3\t3\t-\tGMT-3\n"+
"Zone\tEtc/GMT-2\t2\t-\tGMT-2\n"+
"Zone\tEtc/GMT-1\t1\t-\tGMT-1\n"+
"Zone\tEtc/GMT+1\t-1\t-\tGMT+1\n"+
"Zone\tEtc/GMT+2\t-2\t-\tGMT+2\n"+
"Zone\tEtc/GMT+3\t-3\t-\tGMT+3\n"+
"Zone\tEtc/GMT+4\t-4\t-\tGMT+4\n"+
"Zone\tEtc/GMT+5\t-5\t-\tGMT+5\n"+
"Zone\tEtc/GMT+6\t-6\t-\tGMT+6\n"+
"Zone\tEtc/GMT+7\t-7\t-\tGMT+7\n"+
"Zone\tEtc/GMT+8\t-8\t-\tGMT+8\n"+
"Zone\tEtc/GMT+9\t-9\t-\tGMT+9\n"+
"Zone\tEtc/GMT+10\t-10\t-\tGMT+10\n"+
"Zone\tEtc/GMT+11\t-11\t-\tGMT+11\n"+
"Zone\tEtc/GMT+12\t-12\t-\tGMT+12\n"+
"","tz/europe":"Rule\tGB-Eire\t1916\tonly\t-\tMay\t21\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1916\tonly\t-\tOct\t 1\t2:00s\t0\tGMT\n"+
"Rule\tGB-Eire\t1917\tonly\t-\tApr\t 8\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1917\tonly\t-\tSep\t17\t2:00s\t0\tGMT\n"+
"Rule\tGB-Eire\t1918\tonly\t-\tMar\t24\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1918\tonly\t-\tSep\t30\t2:00s\t0\tGMT\n"+
"Rule\tGB-Eire\t1919\tonly\t-\tMar\t30\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1919\tonly\t-\tSep\t29\t2:00s\t0\tGMT\n"+
"Rule\tGB-Eire\t1920\tonly\t-\tMar\t28\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1920\tonly\t-\tOct\t25\t2:00s\t0\tGMT\n"+
"Rule\tGB-Eire\t1921\tonly\t-\tApr\t 3\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1921\tonly\t-\tOct\t 3\t2:00s\t0\tGMT\n"+
"Rule\tGB-Eire\t1922\tonly\t-\tMar\t26\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1922\tonly\t-\tOct\t 8\t2:00s\t0\tGMT\n"+
"Rule\tGB-Eire\t1923\tonly\t-\tApr\tSun>=16\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1923\t1924\t-\tSep\tSun>=16\t2:00s\t0\tGMT\n"+
"Rule\tGB-Eire\t1924\tonly\t-\tApr\tSun>=9\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1925\t1926\t-\tApr\tSun>=16\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1925\t1938\t-\tOct\tSun>=2\t2:00s\t0\tGMT\n"+
"Rule\tGB-Eire\t1927\tonly\t-\tApr\tSun>=9\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1928\t1929\t-\tApr\tSun>=16\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1930\tonly\t-\tApr\tSun>=9\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1931\t1932\t-\tApr\tSun>=16\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1933\tonly\t-\tApr\tSun>=9\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1934\tonly\t-\tApr\tSun>=16\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1935\tonly\t-\tApr\tSun>=9\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1936\t1937\t-\tApr\tSun>=16\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1938\tonly\t-\tApr\tSun>=9\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1939\tonly\t-\tApr\tSun>=16\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1939\tonly\t-\tNov\tSun>=16\t2:00s\t0\tGMT\n"+
"Rule\tGB-Eire\t1940\tonly\t-\tFeb\tSun>=23\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1941\tonly\t-\tMay\tSun>=2\t1:00s\t2:00\tBDST\n"+
"Rule\tGB-Eire\t1941\t1943\t-\tAug\tSun>=9\t1:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1942\t1944\t-\tApr\tSun>=2\t1:00s\t2:00\tBDST\n"+
"Rule\tGB-Eire\t1944\tonly\t-\tSep\tSun>=16\t1:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1945\tonly\t-\tApr\tMon>=2\t1:00s\t2:00\tBDST\n"+
"Rule\tGB-Eire\t1945\tonly\t-\tJul\tSun>=9\t1:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1945\t1946\t-\tOct\tSun>=2\t2:00s\t0\tGMT\n"+
"Rule\tGB-Eire\t1946\tonly\t-\tApr\tSun>=9\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1947\tonly\t-\tMar\t16\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1947\tonly\t-\tApr\t13\t1:00s\t2:00\tBDST\n"+
"Rule\tGB-Eire\t1947\tonly\t-\tAug\t10\t1:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1947\tonly\t-\tNov\t 2\t2:00s\t0\tGMT\n"+
"Rule\tGB-Eire\t1948\tonly\t-\tMar\t14\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1948\tonly\t-\tOct\t31\t2:00s\t0\tGMT\n"+
"Rule\tGB-Eire\t1949\tonly\t-\tApr\t 3\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1949\tonly\t-\tOct\t30\t2:00s\t0\tGMT\n"+
"Rule\tGB-Eire\t1950\t1952\t-\tApr\tSun>=14\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1950\t1952\t-\tOct\tSun>=21\t2:00s\t0\tGMT\n"+
"Rule\tGB-Eire\t1953\tonly\t-\tApr\tSun>=16\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1953\t1960\t-\tOct\tSun>=2\t2:00s\t0\tGMT\n"+
"Rule\tGB-Eire\t1954\tonly\t-\tApr\tSun>=9\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1955\t1956\t-\tApr\tSun>=16\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1957\tonly\t-\tApr\tSun>=9\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1958\t1959\t-\tApr\tSun>=16\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1960\tonly\t-\tApr\tSun>=9\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1961\t1963\t-\tMar\tlastSun\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1961\t1968\t-\tOct\tSun>=23\t2:00s\t0\tGMT\n"+
"Rule\tGB-Eire\t1964\t1967\t-\tMar\tSun>=19\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1968\tonly\t-\tFeb\t18\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1972\t1980\t-\tMar\tSun>=16\t2:00s\t1:00\tBST\n"+
"Rule\tGB-Eire\t1972\t1980\t-\tOct\tSun>=23\t2:00s\t0\tGMT\n"+
"Rule\tGB-Eire\t1981\t1995\t-\tMar\tlastSun\t1:00u\t1:00\tBST\n"+
"Rule\tGB-Eire 1981\t1989\t-\tOct\tSun>=23\t1:00u\t0\tGMT\n"+
"Rule\tGB-Eire 1990\t1995\t-\tOct\tSun>=22\t1:00u\t0\tGMT\n"+
"Zone\tEurope/London\t-0:01:15 -\tLMT\t1847 Dec  1 0:00s\n"+
"\t\t\t 0:00\tGB-Eire\t%s\t1968 Oct 27\n"+
"\t\t\t 1:00\t-\tBST\t1971 Oct 31 2:00u\n"+
"\t\t\t 0:00\tGB-Eire\t%s\t1996\n"+
"\t\t\t 0:00\tEU\tGMT/BST\n"+
"Link\tEurope/London\tEurope/Jersey\n"+
"Link\tEurope/London\tEurope/Guernsey\n"+
"Link\tEurope/London\tEurope/Isle_of_Man\n"+
"Zone\tEurope/Dublin\t-0:25:00 -\tLMT\t1880 Aug  2\n"+
"\t\t\t-0:25:21 -\tDMT\t1916 May 21 2:00\n"+
"\t\t\t-0:25:21 1:00\tIST\t1916 Oct  1 2:00s\n"+
"\t\t\t 0:00\tGB-Eire\t%s\t1921 Dec  6 # independence\n"+
"\t\t\t 0:00\tGB-Eire\tGMT/IST\t1940 Feb 25 2:00\n"+
"\t\t\t 0:00\t1:00\tIST\t1946 Oct  6 2:00\n"+
"\t\t\t 0:00\t-\tGMT\t1947 Mar 16 2:00\n"+
"\t\t\t 0:00\t1:00\tIST\t1947 Nov  2 2:00\n"+
"\t\t\t 0:00\t-\tGMT\t1948 Apr 18 2:00\n"+
"\t\t\t 0:00\tGB-Eire\tGMT/IST\t1968 Oct 27\n"+
"\t\t\t 1:00\t-\tIST\t1971 Oct 31 2:00u\n"+
"\t\t\t 0:00\tGB-Eire\tGMT/IST\t1996\n"+
"\t\t\t 0:00\tEU\tGMT/IST\n"+
"Rule\tEU\t1977\t1980\t-\tApr\tSun>=1\t 1:00u\t1:00\tS\n"+
"Rule\tEU\t1977\tonly\t-\tSep\tlastSun\t 1:00u\t0\t-\n"+
"Rule\tEU\t1978\tonly\t-\tOct\t 1\t 1:00u\t0\t-\n"+
"Rule\tEU\t1979\t1995\t-\tSep\tlastSun\t 1:00u\t0\t-\n"+
"Rule\tEU\t1981\tmax\t-\tMar\tlastSun\t 1:00u\t1:00\tS\n"+
"Rule\tEU\t1996\tmax\t-\tOct\tlastSun\t 1:00u\t0\t-\n"+
"Rule\tW-Eur\t1977\t1980\t-\tApr\tSun>=1\t 1:00s\t1:00\tS\n"+
"Rule\tW-Eur\t1977\tonly\t-\tSep\tlastSun\t 1:00s\t0\t-\n"+
"Rule\tW-Eur\t1978\tonly\t-\tOct\t 1\t 1:00s\t0\t-\n"+
"Rule\tW-Eur\t1979\t1995\t-\tSep\tlastSun\t 1:00s\t0\t-\n"+
"Rule\tW-Eur\t1981\tmax\t-\tMar\tlastSun\t 1:00s\t1:00\tS\n"+
"Rule\tW-Eur\t1996\tmax\t-\tOct\tlastSun\t 1:00s\t0\t-\n"+
"Rule\tC-Eur\t1916\tonly\t-\tApr\t30\t23:00\t1:00\tS\n"+
"Rule\tC-Eur\t1916\tonly\t-\tOct\t 1\t 1:00\t0\t-\n"+
"Rule\tC-Eur\t1917\t1918\t-\tApr\tMon>=15\t 2:00s\t1:00\tS\n"+
"Rule\tC-Eur\t1917\t1918\t-\tSep\tMon>=15\t 2:00s\t0\t-\n"+
"Rule\tC-Eur\t1940\tonly\t-\tApr\t 1\t 2:00s\t1:00\tS\n"+
"Rule\tC-Eur\t1942\tonly\t-\tNov\t 2\t 2:00s\t0\t-\n"+
"Rule\tC-Eur\t1943\tonly\t-\tMar\t29\t 2:00s\t1:00\tS\n"+
"Rule\tC-Eur\t1943\tonly\t-\tOct\t 4\t 2:00s\t0\t-\n"+
"Rule\tC-Eur\t1944\t1945\t-\tApr\tMon>=1\t 2:00s\t1:00\tS\n"+
"Rule\tC-Eur\t1944\tonly\t-\tOct\t 2\t 2:00s\t0\t-\n"+
"Rule\tC-Eur\t1945\tonly\t-\tSep\t16\t 2:00s\t0\t-\n"+
"Rule\tC-Eur\t1977\t1980\t-\tApr\tSun>=1\t 2:00s\t1:00\tS\n"+
"Rule\tC-Eur\t1977\tonly\t-\tSep\tlastSun\t 2:00s\t0\t-\n"+
"Rule\tC-Eur\t1978\tonly\t-\tOct\t 1\t 2:00s\t0\t-\n"+
"Rule\tC-Eur\t1979\t1995\t-\tSep\tlastSun\t 2:00s\t0\t-\n"+
"Rule\tC-Eur\t1981\tmax\t-\tMar\tlastSun\t 2:00s\t1:00\tS\n"+
"Rule\tC-Eur\t1996\tmax\t-\tOct\tlastSun\t 2:00s\t0\t-\n"+
"Rule\tE-Eur\t1977\t1980\t-\tApr\tSun>=1\t 0:00\t1:00\tS\n"+
"Rule\tE-Eur\t1977\tonly\t-\tSep\tlastSun\t 0:00\t0\t-\n"+
"Rule\tE-Eur\t1978\tonly\t-\tOct\t 1\t 0:00\t0\t-\n"+
"Rule\tE-Eur\t1979\t1995\t-\tSep\tlastSun\t 0:00\t0\t-\n"+
"Rule\tE-Eur\t1981\tmax\t-\tMar\tlastSun\t 0:00\t1:00\tS\n"+
"Rule\tE-Eur\t1996\tmax\t-\tOct\tlastSun\t 0:00\t0\t-\n"+
"Rule\tRussia\t1917\tonly\t-\tJul\t 1\t23:00\t1:00\tMST\t# Moscow Summer Time\n"+
"Rule\tRussia\t1917\tonly\t-\tDec\t28\t 0:00\t0\tMMT\t# Moscow Mean Time\n"+
"Rule\tRussia\t1918\tonly\t-\tMay\t31\t22:00\t2:00\tMDST\t# Moscow Double Summer Time\n"+
"Rule\tRussia\t1918\tonly\t-\tSep\t16\t 1:00\t1:00\tMST\n"+
"Rule\tRussia\t1919\tonly\t-\tMay\t31\t23:00\t2:00\tMDST\n"+
"Rule\tRussia\t1919\tonly\t-\tJul\t 1\t 2:00\t1:00\tS\n"+
"Rule\tRussia\t1919\tonly\t-\tAug\t16\t 0:00\t0\t-\n"+
"Rule\tRussia\t1921\tonly\t-\tFeb\t14\t23:00\t1:00\tS\n"+
"Rule\tRussia\t1921\tonly\t-\tMar\t20\t23:00\t2:00\tM # Midsummer\n"+
"Rule\tRussia\t1921\tonly\t-\tSep\t 1\t 0:00\t1:00\tS\n"+
"Rule\tRussia\t1921\tonly\t-\tOct\t 1\t 0:00\t0\t-\n"+
"Rule\tRussia\t1981\t1984\t-\tApr\t 1\t 0:00\t1:00\tS\n"+
"Rule\tRussia\t1981\t1983\t-\tOct\t 1\t 0:00\t0\t-\n"+
"Rule\tRussia\t1984\t1991\t-\tSep\tlastSun\t 2:00s\t0\t-\n"+
"Rule\tRussia\t1985\t1991\t-\tMar\tlastSun\t 2:00s\t1:00\tS\n"+
"Rule\tRussia\t1992\tonly\t-\tMar\tlastSat\t 23:00\t1:00\tS\n"+
"Rule\tRussia\t1992\tonly\t-\tSep\tlastSat\t 23:00\t0\t-\n"+
"Rule\tRussia\t1993\t2010\t-\tMar\tlastSun\t 2:00s\t1:00\tS\n"+
"Rule\tRussia\t1993\t1995\t-\tSep\tlastSun\t 2:00s\t0\t-\n"+
"Rule\tRussia\t1996\t2010\t-\tOct\tlastSun\t 2:00s\t0\t-\n"+
"Zone\tWET\t\t0:00\tEU\tWE%sT\n"+
"Zone\tCET\t\t1:00\tC-Eur\tCE%sT\n"+
"Zone\tMET\t\t1:00\tC-Eur\tME%sT\n"+
"Zone\tEET\t\t2:00\tEU\tEE%sT\n"+
"Rule\tAlbania\t1940\tonly\t-\tJun\t16\t0:00\t1:00\tS\n"+
"Rule\tAlbania\t1942\tonly\t-\tNov\t 2\t3:00\t0\t-\n"+
"Rule\tAlbania\t1943\tonly\t-\tMar\t29\t2:00\t1:00\tS\n"+
"Rule\tAlbania\t1943\tonly\t-\tApr\t10\t3:00\t0\t-\n"+
"Rule\tAlbania\t1974\tonly\t-\tMay\t 4\t0:00\t1:00\tS\n"+
"Rule\tAlbania\t1974\tonly\t-\tOct\t 2\t0:00\t0\t-\n"+
"Rule\tAlbania\t1975\tonly\t-\tMay\t 1\t0:00\t1:00\tS\n"+
"Rule\tAlbania\t1975\tonly\t-\tOct\t 2\t0:00\t0\t-\n"+
"Rule\tAlbania\t1976\tonly\t-\tMay\t 2\t0:00\t1:00\tS\n"+
"Rule\tAlbania\t1976\tonly\t-\tOct\t 3\t0:00\t0\t-\n"+
"Rule\tAlbania\t1977\tonly\t-\tMay\t 8\t0:00\t1:00\tS\n"+
"Rule\tAlbania\t1977\tonly\t-\tOct\t 2\t0:00\t0\t-\n"+
"Rule\tAlbania\t1978\tonly\t-\tMay\t 6\t0:00\t1:00\tS\n"+
"Rule\tAlbania\t1978\tonly\t-\tOct\t 1\t0:00\t0\t-\n"+
"Rule\tAlbania\t1979\tonly\t-\tMay\t 5\t0:00\t1:00\tS\n"+
"Rule\tAlbania\t1979\tonly\t-\tSep\t30\t0:00\t0\t-\n"+
"Rule\tAlbania\t1980\tonly\t-\tMay\t 3\t0:00\t1:00\tS\n"+
"Rule\tAlbania\t1980\tonly\t-\tOct\t 4\t0:00\t0\t-\n"+
"Rule\tAlbania\t1981\tonly\t-\tApr\t26\t0:00\t1:00\tS\n"+
"Rule\tAlbania\t1981\tonly\t-\tSep\t27\t0:00\t0\t-\n"+
"Rule\tAlbania\t1982\tonly\t-\tMay\t 2\t0:00\t1:00\tS\n"+
"Rule\tAlbania\t1982\tonly\t-\tOct\t 3\t0:00\t0\t-\n"+
"Rule\tAlbania\t1983\tonly\t-\tApr\t18\t0:00\t1:00\tS\n"+
"Rule\tAlbania\t1983\tonly\t-\tOct\t 1\t0:00\t0\t-\n"+
"Rule\tAlbania\t1984\tonly\t-\tApr\t 1\t0:00\t1:00\tS\n"+
"Zone\tEurope/Tirane\t1:19:20 -\tLMT\t1914\n"+
"\t\t\t1:00\t-\tCET\t1940 Jun 16\n"+
"\t\t\t1:00\tAlbania\tCE%sT\t1984 Jul\n"+
"\t\t\t1:00\tEU\tCE%sT\n"+
"Zone\tEurope/Andorra\t0:06:04 -\tLMT\t1901\n"+
"\t\t\t0:00\t-\tWET\t1946 Sep 30\n"+
"\t\t\t1:00\t-\tCET\t1985 Mar 31 2:00\n"+
"\t\t\t1:00\tEU\tCE%sT\n"+
"Rule\tAustria\t1920\tonly\t-\tApr\t 5\t2:00s\t1:00\tS\n"+
"Rule\tAustria\t1920\tonly\t-\tSep\t13\t2:00s\t0\t-\n"+
"Rule\tAustria\t1946\tonly\t-\tApr\t14\t2:00s\t1:00\tS\n"+
"Rule\tAustria\t1946\t1948\t-\tOct\tSun>=1\t2:00s\t0\t-\n"+
"Rule\tAustria\t1947\tonly\t-\tApr\t 6\t2:00s\t1:00\tS\n"+
"Rule\tAustria\t1948\tonly\t-\tApr\t18\t2:00s\t1:00\tS\n"+
"Rule\tAustria\t1980\tonly\t-\tApr\t 6\t0:00\t1:00\tS\n"+
"Rule\tAustria\t1980\tonly\t-\tSep\t28\t0:00\t0\t-\n"+
"Zone\tEurope/Vienna\t1:05:20 -\tLMT\t1893 Apr\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1920\n"+
"\t\t\t1:00\tAustria\tCE%sT\t1940 Apr  1 2:00s\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1945 Apr  2 2:00s\n"+
"\t\t\t1:00\t1:00\tCEST\t1945 Apr 12 2:00s\n"+
"\t\t\t1:00\t-\tCET\t1946\n"+
"\t\t\t1:00\tAustria\tCE%sT\t1981\n"+
"\t\t\t1:00\tEU\tCE%sT\n"+
"Zone\tEurope/Minsk\t1:50:16 -\tLMT\t1880\n"+
"\t\t\t1:50\t-\tMMT\t1924 May 2 # Minsk Mean Time\n"+
"\t\t\t2:00\t-\tEET\t1930 Jun 21\n"+
"\t\t\t3:00\t-\tMSK\t1941 Jun 28\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1944 Jul  3\n"+
"\t\t\t3:00\tRussia\tMSK/MSD\t1990\n"+
"\t\t\t3:00\t-\tMSK\t1991 Mar 31 2:00s\n"+
"\t\t\t2:00\t1:00\tEEST\t1991 Sep 29 2:00s\n"+
"\t\t\t2:00\t-\tEET\t1992 Mar 29 0:00s\n"+
"\t\t\t2:00\t1:00\tEEST\t1992 Sep 27 0:00s\n"+
"\t\t\t2:00\tRussia\tEE%sT\t2011 Mar 27 2:00s\n"+
"\t\t\t3:00\t-\tFET # Further-eastern European Time\n"+
"Rule\tBelgium\t1918\tonly\t-\tMar\t 9\t 0:00s\t1:00\tS\n"+
"Rule\tBelgium\t1918\t1919\t-\tOct\tSat>=1\t23:00s\t0\t-\n"+
"Rule\tBelgium\t1919\tonly\t-\tMar\t 1\t23:00s\t1:00\tS\n"+
"Rule\tBelgium\t1920\tonly\t-\tFeb\t14\t23:00s\t1:00\tS\n"+
"Rule\tBelgium\t1920\tonly\t-\tOct\t23\t23:00s\t0\t-\n"+
"Rule\tBelgium\t1921\tonly\t-\tMar\t14\t23:00s\t1:00\tS\n"+
"Rule\tBelgium\t1921\tonly\t-\tOct\t25\t23:00s\t0\t-\n"+
"Rule\tBelgium\t1922\tonly\t-\tMar\t25\t23:00s\t1:00\tS\n"+
"Rule\tBelgium\t1922\t1927\t-\tOct\tSat>=1\t23:00s\t0\t-\n"+
"Rule\tBelgium\t1923\tonly\t-\tApr\t21\t23:00s\t1:00\tS\n"+
"Rule\tBelgium\t1924\tonly\t-\tMar\t29\t23:00s\t1:00\tS\n"+
"Rule\tBelgium\t1925\tonly\t-\tApr\t 4\t23:00s\t1:00\tS\n"+
"Rule\tBelgium\t1926\tonly\t-\tApr\t17\t23:00s\t1:00\tS\n"+
"Rule\tBelgium\t1927\tonly\t-\tApr\t 9\t23:00s\t1:00\tS\n"+
"Rule\tBelgium\t1928\tonly\t-\tApr\t14\t23:00s\t1:00\tS\n"+
"Rule\tBelgium\t1928\t1938\t-\tOct\tSun>=2\t 2:00s\t0\t-\n"+
"Rule\tBelgium\t1929\tonly\t-\tApr\t21\t 2:00s\t1:00\tS\n"+
"Rule\tBelgium\t1930\tonly\t-\tApr\t13\t 2:00s\t1:00\tS\n"+
"Rule\tBelgium\t1931\tonly\t-\tApr\t19\t 2:00s\t1:00\tS\n"+
"Rule\tBelgium\t1932\tonly\t-\tApr\t 3\t 2:00s\t1:00\tS\n"+
"Rule\tBelgium\t1933\tonly\t-\tMar\t26\t 2:00s\t1:00\tS\n"+
"Rule\tBelgium\t1934\tonly\t-\tApr\t 8\t 2:00s\t1:00\tS\n"+
"Rule\tBelgium\t1935\tonly\t-\tMar\t31\t 2:00s\t1:00\tS\n"+
"Rule\tBelgium\t1936\tonly\t-\tApr\t19\t 2:00s\t1:00\tS\n"+
"Rule\tBelgium\t1937\tonly\t-\tApr\t 4\t 2:00s\t1:00\tS\n"+
"Rule\tBelgium\t1938\tonly\t-\tMar\t27\t 2:00s\t1:00\tS\n"+
"Rule\tBelgium\t1939\tonly\t-\tApr\t16\t 2:00s\t1:00\tS\n"+
"Rule\tBelgium\t1939\tonly\t-\tNov\t19\t 2:00s\t0\t-\n"+
"Rule\tBelgium\t1940\tonly\t-\tFeb\t25\t 2:00s\t1:00\tS\n"+
"Rule\tBelgium\t1944\tonly\t-\tSep\t17\t 2:00s\t0\t-\n"+
"Rule\tBelgium\t1945\tonly\t-\tApr\t 2\t 2:00s\t1:00\tS\n"+
"Rule\tBelgium\t1945\tonly\t-\tSep\t16\t 2:00s\t0\t-\n"+
"Rule\tBelgium\t1946\tonly\t-\tMay\t19\t 2:00s\t1:00\tS\n"+
"Rule\tBelgium\t1946\tonly\t-\tOct\t 7\t 2:00s\t0\t-\n"+
"Zone\tEurope/Brussels\t0:17:30 -\tLMT\t1880\n"+
"\t\t\t0:17:30\t-\tBMT\t1892 May  1 12:00 # Brussels MT\n"+
"\t\t\t0:00\t-\tWET\t1914 Nov  8\n"+
"\t\t\t1:00\t-\tCET\t1916 May  1  0:00\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1918 Nov 11 11:00u\n"+
"\t\t\t0:00\tBelgium\tWE%sT\t1940 May 20  2:00s\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1944 Sep  3\n"+
"\t\t\t1:00\tBelgium\tCE%sT\t1977\n"+
"\t\t\t1:00\tEU\tCE%sT\n"+
"Rule\tBulg\t1979\tonly\t-\tMar\t31\t23:00\t1:00\tS\n"+
"Rule\tBulg\t1979\tonly\t-\tOct\t 1\t 1:00\t0\t-\n"+
"Rule\tBulg\t1980\t1982\t-\tApr\tSat>=1\t23:00\t1:00\tS\n"+
"Rule\tBulg\t1980\tonly\t-\tSep\t29\t 1:00\t0\t-\n"+
"Rule\tBulg\t1981\tonly\t-\tSep\t27\t 2:00\t0\t-\n"+
"Zone\tEurope/Sofia\t1:33:16 -\tLMT\t1880\n"+
"\t\t\t1:56:56\t-\tIMT\t1894 Nov 30 # Istanbul MT?\n"+
"\t\t\t2:00\t-\tEET\t1942 Nov  2  3:00\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1945\n"+
"\t\t\t1:00\t-\tCET\t1945 Apr 2 3:00\n"+
"\t\t\t2:00\t-\tEET\t1979 Mar 31 23:00\n"+
"\t\t\t2:00\tBulg\tEE%sT\t1982 Sep 26  2:00\n"+
"\t\t\t2:00\tC-Eur\tEE%sT\t1991\n"+
"\t\t\t2:00\tE-Eur\tEE%sT\t1997\n"+
"\t\t\t2:00\tEU\tEE%sT\n"+
"Rule\tCzech\t1945\tonly\t-\tApr\t 8\t2:00s\t1:00\tS\n"+
"Rule\tCzech\t1945\tonly\t-\tNov\t18\t2:00s\t0\t-\n"+
"Rule\tCzech\t1946\tonly\t-\tMay\t 6\t2:00s\t1:00\tS\n"+
"Rule\tCzech\t1946\t1949\t-\tOct\tSun>=1\t2:00s\t0\t-\n"+
"Rule\tCzech\t1947\tonly\t-\tApr\t20\t2:00s\t1:00\tS\n"+
"Rule\tCzech\t1948\tonly\t-\tApr\t18\t2:00s\t1:00\tS\n"+
"Rule\tCzech\t1949\tonly\t-\tApr\t 9\t2:00s\t1:00\tS\n"+
"Zone\tEurope/Prague\t0:57:44 -\tLMT\t1850\n"+
"\t\t\t0:57:44\t-\tPMT\t1891 Oct     # Prague Mean Time\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1944 Sep 17 2:00s\n"+
"\t\t\t1:00\tCzech\tCE%sT\t1979\n"+
"\t\t\t1:00\tEU\tCE%sT\n"+
"Rule\tDenmark\t1916\tonly\t-\tMay\t14\t23:00\t1:00\tS\n"+
"Rule\tDenmark\t1916\tonly\t-\tSep\t30\t23:00\t0\t-\n"+
"Rule\tDenmark\t1940\tonly\t-\tMay\t15\t 0:00\t1:00\tS\n"+
"Rule\tDenmark\t1945\tonly\t-\tApr\t 2\t 2:00s\t1:00\tS\n"+
"Rule\tDenmark\t1945\tonly\t-\tAug\t15\t 2:00s\t0\t-\n"+
"Rule\tDenmark\t1946\tonly\t-\tMay\t 1\t 2:00s\t1:00\tS\n"+
"Rule\tDenmark\t1946\tonly\t-\tSep\t 1\t 2:00s\t0\t-\n"+
"Rule\tDenmark\t1947\tonly\t-\tMay\t 4\t 2:00s\t1:00\tS\n"+
"Rule\tDenmark\t1947\tonly\t-\tAug\t10\t 2:00s\t0\t-\n"+
"Rule\tDenmark\t1948\tonly\t-\tMay\t 9\t 2:00s\t1:00\tS\n"+
"Rule\tDenmark\t1948\tonly\t-\tAug\t 8\t 2:00s\t0\t-\n"+
"Zone Europe/Copenhagen\t 0:50:20 -\tLMT\t1890\n"+
"\t\t\t 0:50:20 -\tCMT\t1894 Jan  1 # Copenhagen MT\n"+
"\t\t\t 1:00\tDenmark\tCE%sT\t1942 Nov  2 2:00s\n"+
"\t\t\t 1:00\tC-Eur\tCE%sT\t1945 Apr  2 2:00\n"+
"\t\t\t 1:00\tDenmark\tCE%sT\t1980\n"+
"\t\t\t 1:00\tEU\tCE%sT\n"+
"Zone Atlantic/Faroe\t-0:27:04 -\tLMT\t1908 Jan 11\t# Torshavn\n"+
"\t\t\t 0:00\t-\tWET\t1981\n"+
"\t\t\t 0:00\tEU\tWE%sT\n"+
"Rule\tThule\t1991\t1992\t-\tMar\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tThule\t1991\t1992\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tThule\t1993\t2006\t-\tApr\tSun>=1\t2:00\t1:00\tD\n"+
"Rule\tThule\t1993\t2006\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Rule\tThule\t2007\tmax\t-\tMar\tSun>=8\t2:00\t1:00\tD\n"+
"Rule\tThule\t2007\tmax\t-\tNov\tSun>=1\t2:00\t0\tS\n"+
"Zone America/Danmarkshavn -1:14:40 -\tLMT\t1916 Jul 28\n"+
"\t\t\t-3:00\t-\tWGT\t1980 Apr  6 2:00\n"+
"\t\t\t-3:00\tEU\tWG%sT\t1996\n"+
"\t\t\t0:00\t-\tGMT\n"+
"Zone America/Scoresbysund -1:27:52 -\tLMT\t1916 Jul 28 # Ittoqqortoormiit\n"+
"\t\t\t-2:00\t-\tCGT\t1980 Apr  6 2:00\n"+
"\t\t\t-2:00\tC-Eur\tCG%sT\t1981 Mar 29\n"+
"\t\t\t-1:00\tEU\tEG%sT\n"+
"Zone America/Godthab\t-3:26:56 -\tLMT\t1916 Jul 28 # Nuuk\n"+
"\t\t\t-3:00\t-\tWGT\t1980 Apr  6 2:00\n"+
"\t\t\t-3:00\tEU\tWG%sT\n"+
"Zone America/Thule\t-4:35:08 -\tLMT\t1916 Jul 28 # Pituffik air base\n"+
"\t\t\t-4:00\tThule\tA%sT\n"+
"Zone\tEurope/Tallinn\t1:39:00\t-\tLMT\t1880\n"+
"\t\t\t1:39:00\t-\tTMT\t1918 Feb # Tallinn Mean Time\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1919 Jul\n"+
"\t\t\t1:39:00\t-\tTMT\t1921 May\n"+
"\t\t\t2:00\t-\tEET\t1940 Aug  6\n"+
"\t\t\t3:00\t-\tMSK\t1941 Sep 15\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1944 Sep 22\n"+
"\t\t\t3:00\tRussia\tMSK/MSD\t1989 Mar 26 2:00s\n"+
"\t\t\t2:00\t1:00\tEEST\t1989 Sep 24 2:00s\n"+
"\t\t\t2:00\tC-Eur\tEE%sT\t1998 Sep 22\n"+
"\t\t\t2:00\tEU\tEE%sT\t1999 Nov  1\n"+
"\t\t\t2:00\t-\tEET\t2002 Feb 21\n"+
"\t\t\t2:00\tEU\tEE%sT\n"+
"Rule\tFinland\t1942\tonly\t-\tApr\t3\t0:00\t1:00\tS\n"+
"Rule\tFinland\t1942\tonly\t-\tOct\t3\t0:00\t0\t-\n"+
"Rule\tFinland\t1981\t1982\t-\tMar\tlastSun\t2:00\t1:00\tS\n"+
"Rule\tFinland\t1981\t1982\t-\tSep\tlastSun\t3:00\t0\t-\n"+
"Zone\tEurope/Helsinki\t1:39:52 -\tLMT\t1878 May 31\n"+
"\t\t\t1:39:52\t-\tHMT\t1921 May    # Helsinki Mean Time\n"+
"\t\t\t2:00\tFinland\tEE%sT\t1983\n"+
"\t\t\t2:00\tEU\tEE%sT\n"+
"Link\tEurope/Helsinki\tEurope/Mariehamn\n"+
"Rule\tFrance\t1916\tonly\t-\tJun\t14\t23:00s\t1:00\tS\n"+
"Rule\tFrance\t1916\t1919\t-\tOct\tSun>=1\t23:00s\t0\t-\n"+
"Rule\tFrance\t1917\tonly\t-\tMar\t24\t23:00s\t1:00\tS\n"+
"Rule\tFrance\t1918\tonly\t-\tMar\t 9\t23:00s\t1:00\tS\n"+
"Rule\tFrance\t1919\tonly\t-\tMar\t 1\t23:00s\t1:00\tS\n"+
"Rule\tFrance\t1920\tonly\t-\tFeb\t14\t23:00s\t1:00\tS\n"+
"Rule\tFrance\t1920\tonly\t-\tOct\t23\t23:00s\t0\t-\n"+
"Rule\tFrance\t1921\tonly\t-\tMar\t14\t23:00s\t1:00\tS\n"+
"Rule\tFrance\t1921\tonly\t-\tOct\t25\t23:00s\t0\t-\n"+
"Rule\tFrance\t1922\tonly\t-\tMar\t25\t23:00s\t1:00\tS\n"+
"Rule\tFrance\t1922\t1938\t-\tOct\tSat>=1\t23:00s\t0\t-\n"+
"Rule\tFrance\t1923\tonly\t-\tMay\t26\t23:00s\t1:00\tS\n"+
"Rule\tFrance\t1924\tonly\t-\tMar\t29\t23:00s\t1:00\tS\n"+
"Rule\tFrance\t1925\tonly\t-\tApr\t 4\t23:00s\t1:00\tS\n"+
"Rule\tFrance\t1926\tonly\t-\tApr\t17\t23:00s\t1:00\tS\n"+
"Rule\tFrance\t1927\tonly\t-\tApr\t 9\t23:00s\t1:00\tS\n"+
"Rule\tFrance\t1928\tonly\t-\tApr\t14\t23:00s\t1:00\tS\n"+
"Rule\tFrance\t1929\tonly\t-\tApr\t20\t23:00s\t1:00\tS\n"+
"Rule\tFrance\t1930\tonly\t-\tApr\t12\t23:00s\t1:00\tS\n"+
"Rule\tFrance\t1931\tonly\t-\tApr\t18\t23:00s\t1:00\tS\n"+
"Rule\tFrance\t1932\tonly\t-\tApr\t 2\t23:00s\t1:00\tS\n"+
"Rule\tFrance\t1933\tonly\t-\tMar\t25\t23:00s\t1:00\tS\n"+
"Rule\tFrance\t1934\tonly\t-\tApr\t 7\t23:00s\t1:00\tS\n"+
"Rule\tFrance\t1935\tonly\t-\tMar\t30\t23:00s\t1:00\tS\n"+
"Rule\tFrance\t1936\tonly\t-\tApr\t18\t23:00s\t1:00\tS\n"+
"Rule\tFrance\t1937\tonly\t-\tApr\t 3\t23:00s\t1:00\tS\n"+
"Rule\tFrance\t1938\tonly\t-\tMar\t26\t23:00s\t1:00\tS\n"+
"Rule\tFrance\t1939\tonly\t-\tApr\t15\t23:00s\t1:00\tS\n"+
"Rule\tFrance\t1939\tonly\t-\tNov\t18\t23:00s\t0\t-\n"+
"Rule\tFrance\t1940\tonly\t-\tFeb\t25\t 2:00\t1:00\tS\n"+
"Rule\tFrance\t1941\tonly\t-\tMay\t 5\t 0:00\t2:00\tM # Midsummer\n"+
"Rule\tFrance\t1941\tonly\t-\tOct\t 6\t 0:00\t1:00\tS\n"+
"Rule\tFrance\t1942\tonly\t-\tMar\t 9\t 0:00\t2:00\tM\n"+
"Rule\tFrance\t1942\tonly\t-\tNov\t 2\t 3:00\t1:00\tS\n"+
"Rule\tFrance\t1943\tonly\t-\tMar\t29\t 2:00\t2:00\tM\n"+
"Rule\tFrance\t1943\tonly\t-\tOct\t 4\t 3:00\t1:00\tS\n"+
"Rule\tFrance\t1944\tonly\t-\tApr\t 3\t 2:00\t2:00\tM\n"+
"Rule\tFrance\t1944\tonly\t-\tOct\t 8\t 1:00\t1:00\tS\n"+
"Rule\tFrance\t1945\tonly\t-\tApr\t 2\t 2:00\t2:00\tM\n"+
"Rule\tFrance\t1945\tonly\t-\tSep\t16\t 3:00\t0\t-\n"+
"Rule\tFrance\t1976\tonly\t-\tMar\t28\t 1:00\t1:00\tS\n"+
"Rule\tFrance\t1976\tonly\t-\tSep\t26\t 1:00\t0\t-\n"+
"Zone\tEurope/Paris\t0:09:21 -\tLMT\t1891 Mar 15  0:01\n"+
"\t\t\t0:09:21\t-\tPMT\t1911 Mar 11  0:01  # Paris MT\n"+
"\t\t\t0:00\tFrance\tWE%sT\t1940 Jun 14 23:00\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1944 Aug 25\n"+
"\t\t\t0:00\tFrance\tWE%sT\t1945 Sep 16  3:00\n"+
"\t\t\t1:00\tFrance\tCE%sT\t1977\n"+
"\t\t\t1:00\tEU\tCE%sT\n"+
"Rule\tGermany\t1946\tonly\t-\tApr\t14\t2:00s\t1:00\tS\n"+
"Rule\tGermany\t1946\tonly\t-\tOct\t 7\t2:00s\t0\t-\n"+
"Rule\tGermany\t1947\t1949\t-\tOct\tSun>=1\t2:00s\t0\t-\n"+
"Rule\tGermany\t1947\tonly\t-\tApr\t 6\t3:00s\t1:00\tS\n"+
"Rule\tGermany\t1947\tonly\t-\tMay\t11\t2:00s\t2:00\tM\n"+
"Rule\tGermany\t1947\tonly\t-\tJun\t29\t3:00\t1:00\tS\n"+
"Rule\tGermany\t1948\tonly\t-\tApr\t18\t2:00s\t1:00\tS\n"+
"Rule\tGermany\t1949\tonly\t-\tApr\t10\t2:00s\t1:00\tS\n"+
"Rule SovietZone\t1945\tonly\t-\tMay\t24\t2:00\t2:00\tM # Midsummer\n"+
"Rule SovietZone\t1945\tonly\t-\tSep\t24\t3:00\t1:00\tS\n"+
"Rule SovietZone\t1945\tonly\t-\tNov\t18\t2:00s\t0\t-\n"+
"Zone\tEurope/Berlin\t0:53:28 -\tLMT\t1893 Apr\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1945 May 24 2:00\n"+
"\t\t\t1:00 SovietZone\tCE%sT\t1946\n"+
"\t\t\t1:00\tGermany\tCE%sT\t1980\n"+
"\t\t\t1:00\tEU\tCE%sT\n"+
"Zone Europe/Gibraltar\t-0:21:24 -\tLMT\t1880 Aug  2 0:00s\n"+
"\t\t\t0:00\tGB-Eire\t%s\t1957 Apr 14 2:00\n"+
"\t\t\t1:00\t-\tCET\t1982\n"+
"\t\t\t1:00\tEU\tCE%sT\n"+
"Rule\tGreece\t1932\tonly\t-\tJul\t 7\t0:00\t1:00\tS\n"+
"Rule\tGreece\t1932\tonly\t-\tSep\t 1\t0:00\t0\t-\n"+
"Rule\tGreece\t1941\tonly\t-\tApr\t 7\t0:00\t1:00\tS\n"+
"Rule\tGreece\t1942\tonly\t-\tNov\t 2\t3:00\t0\t-\n"+
"Rule\tGreece\t1943\tonly\t-\tMar\t30\t0:00\t1:00\tS\n"+
"Rule\tGreece\t1943\tonly\t-\tOct\t 4\t0:00\t0\t-\n"+
"Rule\tGreece\t1952\tonly\t-\tJul\t 1\t0:00\t1:00\tS\n"+
"Rule\tGreece\t1952\tonly\t-\tNov\t 2\t0:00\t0\t-\n"+
"Rule\tGreece\t1975\tonly\t-\tApr\t12\t0:00s\t1:00\tS\n"+
"Rule\tGreece\t1975\tonly\t-\tNov\t26\t0:00s\t0\t-\n"+
"Rule\tGreece\t1976\tonly\t-\tApr\t11\t2:00s\t1:00\tS\n"+
"Rule\tGreece\t1976\tonly\t-\tOct\t10\t2:00s\t0\t-\n"+
"Rule\tGreece\t1977\t1978\t-\tApr\tSun>=1\t2:00s\t1:00\tS\n"+
"Rule\tGreece\t1977\tonly\t-\tSep\t26\t2:00s\t0\t-\n"+
"Rule\tGreece\t1978\tonly\t-\tSep\t24\t4:00\t0\t-\n"+
"Rule\tGreece\t1979\tonly\t-\tApr\t 1\t9:00\t1:00\tS\n"+
"Rule\tGreece\t1979\tonly\t-\tSep\t29\t2:00\t0\t-\n"+
"Rule\tGreece\t1980\tonly\t-\tApr\t 1\t0:00\t1:00\tS\n"+
"Rule\tGreece\t1980\tonly\t-\tSep\t28\t0:00\t0\t-\n"+
"Zone\tEurope/Athens\t1:34:52 -\tLMT\t1895 Sep 14\n"+
"\t\t\t1:34:52\t-\tAMT\t1916 Jul 28 0:01     # Athens MT\n"+
"\t\t\t2:00\tGreece\tEE%sT\t1941 Apr 30\n"+
"\t\t\t1:00\tGreece\tCE%sT\t1944 Apr  4\n"+
"\t\t\t2:00\tGreece\tEE%sT\t1981\n"+
"\t\t\t# Shanks & Pottenger say it switched to C-Eur in 1981;\n"+
"\t\t\t# go with EU instead, since Greece joined it on Jan 1.\n"+
"\t\t\t2:00\tEU\tEE%sT\n"+
"Rule\tHungary\t1918\tonly\t-\tApr\t 1\t 3:00\t1:00\tS\n"+
"Rule\tHungary\t1918\tonly\t-\tSep\t29\t 3:00\t0\t-\n"+
"Rule\tHungary\t1919\tonly\t-\tApr\t15\t 3:00\t1:00\tS\n"+
"Rule\tHungary\t1919\tonly\t-\tSep\t15\t 3:00\t0\t-\n"+
"Rule\tHungary\t1920\tonly\t-\tApr\t 5\t 3:00\t1:00\tS\n"+
"Rule\tHungary\t1920\tonly\t-\tSep\t30\t 3:00\t0\t-\n"+
"Rule\tHungary\t1945\tonly\t-\tMay\t 1\t23:00\t1:00\tS\n"+
"Rule\tHungary\t1945\tonly\t-\tNov\t 3\t 0:00\t0\t-\n"+
"Rule\tHungary\t1946\tonly\t-\tMar\t31\t 2:00s\t1:00\tS\n"+
"Rule\tHungary\t1946\t1949\t-\tOct\tSun>=1\t 2:00s\t0\t-\n"+
"Rule\tHungary\t1947\t1949\t-\tApr\tSun>=4\t 2:00s\t1:00\tS\n"+
"Rule\tHungary\t1950\tonly\t-\tApr\t17\t 2:00s\t1:00\tS\n"+
"Rule\tHungary\t1950\tonly\t-\tOct\t23\t 2:00s\t0\t-\n"+
"Rule\tHungary\t1954\t1955\t-\tMay\t23\t 0:00\t1:00\tS\n"+
"Rule\tHungary\t1954\t1955\t-\tOct\t 3\t 0:00\t0\t-\n"+
"Rule\tHungary\t1956\tonly\t-\tJun\tSun>=1\t 0:00\t1:00\tS\n"+
"Rule\tHungary\t1956\tonly\t-\tSep\tlastSun\t 0:00\t0\t-\n"+
"Rule\tHungary\t1957\tonly\t-\tJun\tSun>=1\t 1:00\t1:00\tS\n"+
"Rule\tHungary\t1957\tonly\t-\tSep\tlastSun\t 3:00\t0\t-\n"+
"Rule\tHungary\t1980\tonly\t-\tApr\t 6\t 1:00\t1:00\tS\n"+
"Zone\tEurope/Budapest\t1:16:20 -\tLMT\t1890 Oct\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1918\n"+
"\t\t\t1:00\tHungary\tCE%sT\t1941 Apr  6  2:00\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1945\n"+
"\t\t\t1:00\tHungary\tCE%sT\t1980 Sep 28  2:00s\n"+
"\t\t\t1:00\tEU\tCE%sT\n"+
"Rule\tIceland\t1917\t1918\t-\tFeb\t19\t23:00\t1:00\tS\n"+
"Rule\tIceland\t1917\tonly\t-\tOct\t21\t 1:00\t0\t-\n"+
"Rule\tIceland\t1918\tonly\t-\tNov\t16\t 1:00\t0\t-\n"+
"Rule\tIceland\t1939\tonly\t-\tApr\t29\t23:00\t1:00\tS\n"+
"Rule\tIceland\t1939\tonly\t-\tNov\t29\t 2:00\t0\t-\n"+
"Rule\tIceland\t1940\tonly\t-\tFeb\t25\t 2:00\t1:00\tS\n"+
"Rule\tIceland\t1940\tonly\t-\tNov\t 3\t 2:00\t0\t-\n"+
"Rule\tIceland\t1941\tonly\t-\tMar\t 2\t 1:00s\t1:00\tS\n"+
"Rule\tIceland\t1941\tonly\t-\tNov\t 2\t 1:00s\t0\t-\n"+
"Rule\tIceland\t1942\tonly\t-\tMar\t 8\t 1:00s\t1:00\tS\n"+
"Rule\tIceland\t1942\tonly\t-\tOct\t25\t 1:00s\t0\t-\n"+
"Rule\tIceland\t1943\t1946\t-\tMar\tSun>=1\t 1:00s\t1:00\tS\n"+
"Rule\tIceland\t1943\t1948\t-\tOct\tSun>=22\t 1:00s\t0\t-\n"+
"Rule\tIceland\t1947\t1967\t-\tApr\tSun>=1\t 1:00s\t1:00\tS\n"+
"Rule\tIceland\t1949\tonly\t-\tOct\t30\t 1:00s\t0\t-\n"+
"Rule\tIceland\t1950\t1966\t-\tOct\tSun>=22\t 1:00s\t0\t-\n"+
"Rule\tIceland\t1967\tonly\t-\tOct\t29\t 1:00s\t0\t-\n"+
"Zone Atlantic/Reykjavik\t-1:27:24 -\tLMT\t1837\n"+
"\t\t\t-1:27:48 -\tRMT\t1908 # Reykjavik Mean Time?\n"+
"\t\t\t-1:00\tIceland\tIS%sT\t1968 Apr 7 1:00s\n"+
"\t\t\t 0:00\t-\tGMT\n"+
"Rule\tItaly\t1916\tonly\t-\tJun\t 3\t0:00s\t1:00\tS\n"+
"Rule\tItaly\t1916\tonly\t-\tOct\t 1\t0:00s\t0\t-\n"+
"Rule\tItaly\t1917\tonly\t-\tApr\t 1\t0:00s\t1:00\tS\n"+
"Rule\tItaly\t1917\tonly\t-\tSep\t30\t0:00s\t0\t-\n"+
"Rule\tItaly\t1918\tonly\t-\tMar\t10\t0:00s\t1:00\tS\n"+
"Rule\tItaly\t1918\t1919\t-\tOct\tSun>=1\t0:00s\t0\t-\n"+
"Rule\tItaly\t1919\tonly\t-\tMar\t 2\t0:00s\t1:00\tS\n"+
"Rule\tItaly\t1920\tonly\t-\tMar\t21\t0:00s\t1:00\tS\n"+
"Rule\tItaly\t1920\tonly\t-\tSep\t19\t0:00s\t0\t-\n"+
"Rule\tItaly\t1940\tonly\t-\tJun\t15\t0:00s\t1:00\tS\n"+
"Rule\tItaly\t1944\tonly\t-\tSep\t17\t0:00s\t0\t-\n"+
"Rule\tItaly\t1945\tonly\t-\tApr\t 2\t2:00\t1:00\tS\n"+
"Rule\tItaly\t1945\tonly\t-\tSep\t15\t0:00s\t0\t-\n"+
"Rule\tItaly\t1946\tonly\t-\tMar\t17\t2:00s\t1:00\tS\n"+
"Rule\tItaly\t1946\tonly\t-\tOct\t 6\t2:00s\t0\t-\n"+
"Rule\tItaly\t1947\tonly\t-\tMar\t16\t0:00s\t1:00\tS\n"+
"Rule\tItaly\t1947\tonly\t-\tOct\t 5\t0:00s\t0\t-\n"+
"Rule\tItaly\t1948\tonly\t-\tFeb\t29\t2:00s\t1:00\tS\n"+
"Rule\tItaly\t1948\tonly\t-\tOct\t 3\t2:00s\t0\t-\n"+
"Rule\tItaly\t1966\t1968\t-\tMay\tSun>=22\t0:00\t1:00\tS\n"+
"Rule\tItaly\t1966\t1969\t-\tSep\tSun>=22\t0:00\t0\t-\n"+
"Rule\tItaly\t1969\tonly\t-\tJun\t 1\t0:00\t1:00\tS\n"+
"Rule\tItaly\t1970\tonly\t-\tMay\t31\t0:00\t1:00\tS\n"+
"Rule\tItaly\t1970\tonly\t-\tSep\tlastSun\t0:00\t0\t-\n"+
"Rule\tItaly\t1971\t1972\t-\tMay\tSun>=22\t0:00\t1:00\tS\n"+
"Rule\tItaly\t1971\tonly\t-\tSep\tlastSun\t1:00\t0\t-\n"+
"Rule\tItaly\t1972\tonly\t-\tOct\t 1\t0:00\t0\t-\n"+
"Rule\tItaly\t1973\tonly\t-\tJun\t 3\t0:00\t1:00\tS\n"+
"Rule\tItaly\t1973\t1974\t-\tSep\tlastSun\t0:00\t0\t-\n"+
"Rule\tItaly\t1974\tonly\t-\tMay\t26\t0:00\t1:00\tS\n"+
"Rule\tItaly\t1975\tonly\t-\tJun\t 1\t0:00s\t1:00\tS\n"+
"Rule\tItaly\t1975\t1977\t-\tSep\tlastSun\t0:00s\t0\t-\n"+
"Rule\tItaly\t1976\tonly\t-\tMay\t30\t0:00s\t1:00\tS\n"+
"Rule\tItaly\t1977\t1979\t-\tMay\tSun>=22\t0:00s\t1:00\tS\n"+
"Rule\tItaly\t1978\tonly\t-\tOct\t 1\t0:00s\t0\t-\n"+
"Rule\tItaly\t1979\tonly\t-\tSep\t30\t0:00s\t0\t-\n"+
"Zone\tEurope/Rome\t0:49:56 -\tLMT\t1866 Sep 22\n"+
"\t\t\t0:49:56\t-\tRMT\t1893 Nov  1 0:00s # Rome Mean\n"+
"\t\t\t1:00\tItaly\tCE%sT\t1942 Nov  2 2:00s\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1944 Jul\n"+
"\t\t\t1:00\tItaly\tCE%sT\t1980\n"+
"\t\t\t1:00\tEU\tCE%sT\n"+
"Link\tEurope/Rome\tEurope/Vatican\n"+
"Link\tEurope/Rome\tEurope/San_Marino\n"+
"Rule\tLatvia\t1989\t1996\t-\tMar\tlastSun\t 2:00s\t1:00\tS\n"+
"Rule\tLatvia\t1989\t1996\t-\tSep\tlastSun\t 2:00s\t0\t-\n"+
"Zone\tEurope/Riga\t1:36:24\t-\tLMT\t1880\n"+
"\t\t\t1:36:24\t-\tRMT\t1918 Apr 15 2:00 #Riga Mean Time\n"+
"\t\t\t1:36:24\t1:00\tLST\t1918 Sep 16 3:00 #Latvian Summer\n"+
"\t\t\t1:36:24\t-\tRMT\t1919 Apr  1 2:00\n"+
"\t\t\t1:36:24\t1:00\tLST\t1919 May 22 3:00\n"+
"\t\t\t1:36:24\t-\tRMT\t1926 May 11\n"+
"\t\t\t2:00\t-\tEET\t1940 Aug  5\n"+
"\t\t\t3:00\t-\tMSK\t1941 Jul\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1944 Oct 13\n"+
"\t\t\t3:00\tRussia\tMSK/MSD\t1989 Mar lastSun 2:00s\n"+
"\t\t\t2:00\t1:00\tEEST\t1989 Sep lastSun 2:00s\n"+
"\t\t\t2:00\tLatvia\tEE%sT\t1997 Jan 21\n"+
"\t\t\t2:00\tEU\tEE%sT\t2000 Feb 29\n"+
"\t\t\t2:00\t-\tEET\t2001 Jan  2\n"+
"\t\t\t2:00\tEU\tEE%sT\n"+
"Zone\tEurope/Vaduz\t0:38:04 -\tLMT\t1894 Jun\n"+
"\t\t\t1:00\t-\tCET\t1981\n"+
"\t\t\t1:00\tEU\tCE%sT\n"+
"Zone\tEurope/Vilnius\t1:41:16\t-\tLMT\t1880\n"+
"\t\t\t1:24:00\t-\tWMT\t1917\t    # Warsaw Mean Time\n"+
"\t\t\t1:35:36\t-\tKMT\t1919 Oct 10 # Kaunas Mean Time\n"+
"\t\t\t1:00\t-\tCET\t1920 Jul 12\n"+
"\t\t\t2:00\t-\tEET\t1920 Oct  9\n"+
"\t\t\t1:00\t-\tCET\t1940 Aug  3\n"+
"\t\t\t3:00\t-\tMSK\t1941 Jun 24\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1944 Aug\n"+
"\t\t\t3:00\tRussia\tMSK/MSD\t1991 Mar 31 2:00s\n"+
"\t\t\t2:00\t1:00\tEEST\t1991 Sep 29 2:00s\n"+
"\t\t\t2:00\tC-Eur\tEE%sT\t1998\n"+
"\t\t\t2:00\t-\tEET\t1998 Mar 29 1:00u\n"+
"\t\t\t1:00\tEU\tCE%sT\t1999 Oct 31 1:00u\n"+
"\t\t\t2:00\t-\tEET\t2003 Jan  1\n"+
"\t\t\t2:00\tEU\tEE%sT\n"+
"Rule\tLux\t1916\tonly\t-\tMay\t14\t23:00\t1:00\tS\n"+
"Rule\tLux\t1916\tonly\t-\tOct\t 1\t 1:00\t0\t-\n"+
"Rule\tLux\t1917\tonly\t-\tApr\t28\t23:00\t1:00\tS\n"+
"Rule\tLux\t1917\tonly\t-\tSep\t17\t 1:00\t0\t-\n"+
"Rule\tLux\t1918\tonly\t-\tApr\tMon>=15\t 2:00s\t1:00\tS\n"+
"Rule\tLux\t1918\tonly\t-\tSep\tMon>=15\t 2:00s\t0\t-\n"+
"Rule\tLux\t1919\tonly\t-\tMar\t 1\t23:00\t1:00\tS\n"+
"Rule\tLux\t1919\tonly\t-\tOct\t 5\t 3:00\t0\t-\n"+
"Rule\tLux\t1920\tonly\t-\tFeb\t14\t23:00\t1:00\tS\n"+
"Rule\tLux\t1920\tonly\t-\tOct\t24\t 2:00\t0\t-\n"+
"Rule\tLux\t1921\tonly\t-\tMar\t14\t23:00\t1:00\tS\n"+
"Rule\tLux\t1921\tonly\t-\tOct\t26\t 2:00\t0\t-\n"+
"Rule\tLux\t1922\tonly\t-\tMar\t25\t23:00\t1:00\tS\n"+
"Rule\tLux\t1922\tonly\t-\tOct\tSun>=2\t 1:00\t0\t-\n"+
"Rule\tLux\t1923\tonly\t-\tApr\t21\t23:00\t1:00\tS\n"+
"Rule\tLux\t1923\tonly\t-\tOct\tSun>=2\t 2:00\t0\t-\n"+
"Rule\tLux\t1924\tonly\t-\tMar\t29\t23:00\t1:00\tS\n"+
"Rule\tLux\t1924\t1928\t-\tOct\tSun>=2\t 1:00\t0\t-\n"+
"Rule\tLux\t1925\tonly\t-\tApr\t 5\t23:00\t1:00\tS\n"+
"Rule\tLux\t1926\tonly\t-\tApr\t17\t23:00\t1:00\tS\n"+
"Rule\tLux\t1927\tonly\t-\tApr\t 9\t23:00\t1:00\tS\n"+
"Rule\tLux\t1928\tonly\t-\tApr\t14\t23:00\t1:00\tS\n"+
"Rule\tLux\t1929\tonly\t-\tApr\t20\t23:00\t1:00\tS\n"+
"Zone Europe/Luxembourg\t0:24:36 -\tLMT\t1904 Jun\n"+
"\t\t\t1:00\tLux\tCE%sT\t1918 Nov 25\n"+
"\t\t\t0:00\tLux\tWE%sT\t1929 Oct  6 2:00s\n"+
"\t\t\t0:00\tBelgium\tWE%sT\t1940 May 14 3:00\n"+
"\t\t\t1:00\tC-Eur\tWE%sT\t1944 Sep 18 3:00\n"+
"\t\t\t1:00\tBelgium\tCE%sT\t1977\n"+
"\t\t\t1:00\tEU\tCE%sT\n"+
"Rule\tMalta\t1973\tonly\t-\tMar\t31\t0:00s\t1:00\tS\n"+
"Rule\tMalta\t1973\tonly\t-\tSep\t29\t0:00s\t0\t-\n"+
"Rule\tMalta\t1974\tonly\t-\tApr\t21\t0:00s\t1:00\tS\n"+
"Rule\tMalta\t1974\tonly\t-\tSep\t16\t0:00s\t0\t-\n"+
"Rule\tMalta\t1975\t1979\t-\tApr\tSun>=15\t2:00\t1:00\tS\n"+
"Rule\tMalta\t1975\t1980\t-\tSep\tSun>=15\t2:00\t0\t-\n"+
"Rule\tMalta\t1980\tonly\t-\tMar\t31\t2:00\t1:00\tS\n"+
"Zone\tEurope/Malta\t0:58:04 -\tLMT\t1893 Nov  2 0:00s # Valletta\n"+
"\t\t\t1:00\tItaly\tCE%sT\t1942 Nov  2 2:00s\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1945 Apr  2 2:00s\n"+
"\t\t\t1:00\tItaly\tCE%sT\t1973 Mar 31\n"+
"\t\t\t1:00\tMalta\tCE%sT\t1981\n"+
"\t\t\t1:00\tEU\tCE%sT\n"+
"Zone\tEurope/Chisinau\t1:55:20 -\tLMT\t1880\n"+
"\t\t\t1:55\t-\tCMT\t1918 Feb 15 # Chisinau MT\n"+
"\t\t\t1:44:24\t-\tBMT\t1931 Jul 24 # Bucharest MT\n"+
"\t\t\t2:00\tRomania\tEE%sT\t1940 Aug 15\n"+
"\t\t\t2:00\t1:00\tEEST\t1941 Jul 17\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1944 Aug 24\n"+
"\t\t\t3:00\tRussia\tMSK/MSD\t1990\n"+
"\t\t\t3:00\t-\tMSK\t1990 May 6\n"+
"\t\t\t2:00\t-\tEET\t1991\n"+
"\t\t\t2:00\tRussia\tEE%sT\t1992\n"+
"\t\t\t2:00\tE-Eur\tEE%sT\t1997\n"+
"\t\t\t2:00\tEU\tEE%sT\n"+
"Zone\tEurope/Monaco\t0:29:32 -\tLMT\t1891 Mar 15\n"+
"\t\t\t0:09:21\t-\tPMT\t1911 Mar 11    # Paris Mean Time\n"+
"\t\t\t0:00\tFrance\tWE%sT\t1945 Sep 16 3:00\n"+
"\t\t\t1:00\tFrance\tCE%sT\t1977\n"+
"\t\t\t1:00\tEU\tCE%sT\n"+
"Rule\tNeth\t1916\tonly\t-\tMay\t 1\t0:00\t1:00\tNST\t# Netherlands Summer Time\n"+
"Rule\tNeth\t1916\tonly\t-\tOct\t 1\t0:00\t0\tAMT\t# Amsterdam Mean Time\n"+
"Rule\tNeth\t1917\tonly\t-\tApr\t16\t2:00s\t1:00\tNST\n"+
"Rule\tNeth\t1917\tonly\t-\tSep\t17\t2:00s\t0\tAMT\n"+
"Rule\tNeth\t1918\t1921\t-\tApr\tMon>=1\t2:00s\t1:00\tNST\n"+
"Rule\tNeth\t1918\t1921\t-\tSep\tlastMon\t2:00s\t0\tAMT\n"+
"Rule\tNeth\t1922\tonly\t-\tMar\tlastSun\t2:00s\t1:00\tNST\n"+
"Rule\tNeth\t1922\t1936\t-\tOct\tSun>=2\t2:00s\t0\tAMT\n"+
"Rule\tNeth\t1923\tonly\t-\tJun\tFri>=1\t2:00s\t1:00\tNST\n"+
"Rule\tNeth\t1924\tonly\t-\tMar\tlastSun\t2:00s\t1:00\tNST\n"+
"Rule\tNeth\t1925\tonly\t-\tJun\tFri>=1\t2:00s\t1:00\tNST\n"+
"Rule\tNeth\t1926\t1931\t-\tMay\t15\t2:00s\t1:00\tNST\n"+
"Rule\tNeth\t1932\tonly\t-\tMay\t22\t2:00s\t1:00\tNST\n"+
"Rule\tNeth\t1933\t1936\t-\tMay\t15\t2:00s\t1:00\tNST\n"+
"Rule\tNeth\t1937\tonly\t-\tMay\t22\t2:00s\t1:00\tNST\n"+
"Rule\tNeth\t1937\tonly\t-\tJul\t 1\t0:00\t1:00\tS\n"+
"Rule\tNeth\t1937\t1939\t-\tOct\tSun>=2\t2:00s\t0\t-\n"+
"Rule\tNeth\t1938\t1939\t-\tMay\t15\t2:00s\t1:00\tS\n"+
"Rule\tNeth\t1945\tonly\t-\tApr\t 2\t2:00s\t1:00\tS\n"+
"Rule\tNeth\t1945\tonly\t-\tSep\t16\t2:00s\t0\t-\n"+
"Zone Europe/Amsterdam\t0:19:32 -\tLMT\t1835\n"+
"\t\t\t0:19:32\tNeth\t%s\t1937 Jul  1\n"+
"\t\t\t0:20\tNeth\tNE%sT\t1940 May 16 0:00 # Dutch Time\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1945 Apr  2 2:00\n"+
"\t\t\t1:00\tNeth\tCE%sT\t1977\n"+
"\t\t\t1:00\tEU\tCE%sT\n"+
"Rule\tNorway\t1916\tonly\t-\tMay\t22\t1:00\t1:00\tS\n"+
"Rule\tNorway\t1916\tonly\t-\tSep\t30\t0:00\t0\t-\n"+
"Rule\tNorway\t1945\tonly\t-\tApr\t 2\t2:00s\t1:00\tS\n"+
"Rule\tNorway\t1945\tonly\t-\tOct\t 1\t2:00s\t0\t-\n"+
"Rule\tNorway\t1959\t1964\t-\tMar\tSun>=15\t2:00s\t1:00\tS\n"+
"Rule\tNorway\t1959\t1965\t-\tSep\tSun>=15\t2:00s\t0\t-\n"+
"Rule\tNorway\t1965\tonly\t-\tApr\t25\t2:00s\t1:00\tS\n"+
"Zone\tEurope/Oslo\t0:43:00 -\tLMT\t1895 Jan  1\n"+
"\t\t\t1:00\tNorway\tCE%sT\t1940 Aug 10 23:00\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1945 Apr  2  2:00\n"+
"\t\t\t1:00\tNorway\tCE%sT\t1980\n"+
"\t\t\t1:00\tEU\tCE%sT\n"+
"Link\tEurope/Oslo\tArctic/Longyearbyen\n"+
"Rule\tPoland\t1918\t1919\t-\tSep\t16\t2:00s\t0\t-\n"+
"Rule\tPoland\t1919\tonly\t-\tApr\t15\t2:00s\t1:00\tS\n"+
"Rule\tPoland\t1944\tonly\t-\tApr\t 3\t2:00s\t1:00\tS\n"+
"Rule\tPoland\t1944\tonly\t-\tOct\t 4\t2:00\t0\t-\n"+
"Rule\tPoland\t1945\tonly\t-\tApr\t29\t0:00\t1:00\tS\n"+
"Rule\tPoland\t1945\tonly\t-\tNov\t 1\t0:00\t0\t-\n"+
"Rule\tPoland\t1946\tonly\t-\tApr\t14\t0:00s\t1:00\tS\n"+
"Rule\tPoland\t1946\tonly\t-\tOct\t 7\t2:00s\t0\t-\n"+
"Rule\tPoland\t1947\tonly\t-\tMay\t 4\t2:00s\t1:00\tS\n"+
"Rule\tPoland\t1947\t1949\t-\tOct\tSun>=1\t2:00s\t0\t-\n"+
"Rule\tPoland\t1948\tonly\t-\tApr\t18\t2:00s\t1:00\tS\n"+
"Rule\tPoland\t1949\tonly\t-\tApr\t10\t2:00s\t1:00\tS\n"+
"Rule\tPoland\t1957\tonly\t-\tJun\t 2\t1:00s\t1:00\tS\n"+
"Rule\tPoland\t1957\t1958\t-\tSep\tlastSun\t1:00s\t0\t-\n"+
"Rule\tPoland\t1958\tonly\t-\tMar\t30\t1:00s\t1:00\tS\n"+
"Rule\tPoland\t1959\tonly\t-\tMay\t31\t1:00s\t1:00\tS\n"+
"Rule\tPoland\t1959\t1961\t-\tOct\tSun>=1\t1:00s\t0\t-\n"+
"Rule\tPoland\t1960\tonly\t-\tApr\t 3\t1:00s\t1:00\tS\n"+
"Rule\tPoland\t1961\t1964\t-\tMay\tlastSun\t1:00s\t1:00\tS\n"+
"Rule\tPoland\t1962\t1964\t-\tSep\tlastSun\t1:00s\t0\t-\n"+
"Zone\tEurope/Warsaw\t1:24:00 -\tLMT\t1880\n"+
"\t\t\t1:24:00\t-\tWMT\t1915 Aug  5   # Warsaw Mean Time\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1918 Sep 16 3:00\n"+
"\t\t\t2:00\tPoland\tEE%sT\t1922 Jun\n"+
"\t\t\t1:00\tPoland\tCE%sT\t1940 Jun 23 2:00\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1944 Oct\n"+
"\t\t\t1:00\tPoland\tCE%sT\t1977\n"+
"\t\t\t1:00\tW-Eur\tCE%sT\t1988\n"+
"\t\t\t1:00\tEU\tCE%sT\n"+
"Rule\tPort\t1916\tonly\t-\tJun\t17\t23:00\t1:00\tS\n"+
"Rule\tPort\t1916\tonly\t-\tNov\t 1\t 1:00\t0\t-\n"+
"Rule\tPort\t1917\tonly\t-\tFeb\t28\t23:00s\t1:00\tS\n"+
"Rule\tPort\t1917\t1921\t-\tOct\t14\t23:00s\t0\t-\n"+
"Rule\tPort\t1918\tonly\t-\tMar\t 1\t23:00s\t1:00\tS\n"+
"Rule\tPort\t1919\tonly\t-\tFeb\t28\t23:00s\t1:00\tS\n"+
"Rule\tPort\t1920\tonly\t-\tFeb\t29\t23:00s\t1:00\tS\n"+
"Rule\tPort\t1921\tonly\t-\tFeb\t28\t23:00s\t1:00\tS\n"+
"Rule\tPort\t1924\tonly\t-\tApr\t16\t23:00s\t1:00\tS\n"+
"Rule\tPort\t1924\tonly\t-\tOct\t14\t23:00s\t0\t-\n"+
"Rule\tPort\t1926\tonly\t-\tApr\t17\t23:00s\t1:00\tS\n"+
"Rule\tPort\t1926\t1929\t-\tOct\tSat>=1\t23:00s\t0\t-\n"+
"Rule\tPort\t1927\tonly\t-\tApr\t 9\t23:00s\t1:00\tS\n"+
"Rule\tPort\t1928\tonly\t-\tApr\t14\t23:00s\t1:00\tS\n"+
"Rule\tPort\t1929\tonly\t-\tApr\t20\t23:00s\t1:00\tS\n"+
"Rule\tPort\t1931\tonly\t-\tApr\t18\t23:00s\t1:00\tS\n"+
"Rule\tPort\t1931\t1932\t-\tOct\tSat>=1\t23:00s\t0\t-\n"+
"Rule\tPort\t1932\tonly\t-\tApr\t 2\t23:00s\t1:00\tS\n"+
"Rule\tPort\t1934\tonly\t-\tApr\t 7\t23:00s\t1:00\tS\n"+
"Rule\tPort\t1934\t1938\t-\tOct\tSat>=1\t23:00s\t0\t-\n"+
"Rule\tPort\t1935\tonly\t-\tMar\t30\t23:00s\t1:00\tS\n"+
"Rule\tPort\t1936\tonly\t-\tApr\t18\t23:00s\t1:00\tS\n"+
"Rule\tPort\t1937\tonly\t-\tApr\t 3\t23:00s\t1:00\tS\n"+
"Rule\tPort\t1938\tonly\t-\tMar\t26\t23:00s\t1:00\tS\n"+
"Rule\tPort\t1939\tonly\t-\tApr\t15\t23:00s\t1:00\tS\n"+
"Rule\tPort\t1939\tonly\t-\tNov\t18\t23:00s\t0\t-\n"+
"Rule\tPort\t1940\tonly\t-\tFeb\t24\t23:00s\t1:00\tS\n"+
"Rule\tPort\t1940\t1941\t-\tOct\t 5\t23:00s\t0\t-\n"+
"Rule\tPort\t1941\tonly\t-\tApr\t 5\t23:00s\t1:00\tS\n"+
"Rule\tPort\t1942\t1945\t-\tMar\tSat>=8\t23:00s\t1:00\tS\n"+
"Rule\tPort\t1942\tonly\t-\tApr\t25\t22:00s\t2:00\tM # Midsummer\n"+
"Rule\tPort\t1942\tonly\t-\tAug\t15\t22:00s\t1:00\tS\n"+
"Rule\tPort\t1942\t1945\t-\tOct\tSat>=24\t23:00s\t0\t-\n"+
"Rule\tPort\t1943\tonly\t-\tApr\t17\t22:00s\t2:00\tM\n"+
"Rule\tPort\t1943\t1945\t-\tAug\tSat>=25\t22:00s\t1:00\tS\n"+
"Rule\tPort\t1944\t1945\t-\tApr\tSat>=21\t22:00s\t2:00\tM\n"+
"Rule\tPort\t1946\tonly\t-\tApr\tSat>=1\t23:00s\t1:00\tS\n"+
"Rule\tPort\t1946\tonly\t-\tOct\tSat>=1\t23:00s\t0\t-\n"+
"Rule\tPort\t1947\t1949\t-\tApr\tSun>=1\t 2:00s\t1:00\tS\n"+
"Rule\tPort\t1947\t1949\t-\tOct\tSun>=1\t 2:00s\t0\t-\n"+
"Rule\tPort\t1951\t1965\t-\tApr\tSun>=1\t 2:00s\t1:00\tS\n"+
"Rule\tPort\t1951\t1965\t-\tOct\tSun>=1\t 2:00s\t0\t-\n"+
"Rule\tPort\t1977\tonly\t-\tMar\t27\t 0:00s\t1:00\tS\n"+
"Rule\tPort\t1977\tonly\t-\tSep\t25\t 0:00s\t0\t-\n"+
"Rule\tPort\t1978\t1979\t-\tApr\tSun>=1\t 0:00s\t1:00\tS\n"+
"Rule\tPort\t1978\tonly\t-\tOct\t 1\t 0:00s\t0\t-\n"+
"Rule\tPort\t1979\t1982\t-\tSep\tlastSun\t 1:00s\t0\t-\n"+
"Rule\tPort\t1980\tonly\t-\tMar\tlastSun\t 0:00s\t1:00\tS\n"+
"Rule\tPort\t1981\t1982\t-\tMar\tlastSun\t 1:00s\t1:00\tS\n"+
"Rule\tPort\t1983\tonly\t-\tMar\tlastSun\t 2:00s\t1:00\tS\n"+
"Zone\tEurope/Lisbon\t-0:36:32 -\tLMT\t1884\n"+
"\t\t\t-0:36:32 -\tLMT\t1912 Jan  1  # Lisbon Mean Time\n"+
"\t\t\t 0:00\tPort\tWE%sT\t1966 Apr  3 2:00\n"+
"\t\t\t 1:00\t-\tCET\t1976 Sep 26 1:00\n"+
"\t\t\t 0:00\tPort\tWE%sT\t1983 Sep 25 1:00s\n"+
"\t\t\t 0:00\tW-Eur\tWE%sT\t1992 Sep 27 1:00s\n"+
"\t\t\t 1:00\tEU\tCE%sT\t1996 Mar 31 1:00u\n"+
"\t\t\t 0:00\tEU\tWE%sT\n"+
"Zone Atlantic/Azores\t-1:42:40 -\tLMT\t1884\t\t# Ponta Delgada\n"+
"\t\t\t-1:54:32 -\tHMT\t1911 May 24  # Horta Mean Time\n"+
"\t\t\t-2:00\tPort\tAZO%sT\t1966 Apr  3 2:00 # Azores Time\n"+
"\t\t\t-1:00\tPort\tAZO%sT\t1983 Sep 25 1:00s\n"+
"\t\t\t-1:00\tW-Eur\tAZO%sT\t1992 Sep 27 1:00s\n"+
"\t\t\t 0:00\tEU\tWE%sT\t1993 Mar 28 1:00u\n"+
"\t\t\t-1:00\tEU\tAZO%sT\n"+
"Zone Atlantic/Madeira\t-1:07:36 -\tLMT\t1884\t\t# Funchal\n"+
"\t\t\t-1:07:36 -\tFMT\t1911 May 24  # Funchal Mean Time\n"+
"\t\t\t-1:00\tPort\tMAD%sT\t1966 Apr  3 2:00 # Madeira Time\n"+
"\t\t\t 0:00\tPort\tWE%sT\t1983 Sep 25 1:00s\n"+
"\t\t\t 0:00\tEU\tWE%sT\n"+
"Rule\tRomania\t1932\tonly\t-\tMay\t21\t 0:00s\t1:00\tS\n"+
"Rule\tRomania\t1932\t1939\t-\tOct\tSun>=1\t 0:00s\t0\t-\n"+
"Rule\tRomania\t1933\t1939\t-\tApr\tSun>=2\t 0:00s\t1:00\tS\n"+
"Rule\tRomania\t1979\tonly\t-\tMay\t27\t 0:00\t1:00\tS\n"+
"Rule\tRomania\t1979\tonly\t-\tSep\tlastSun\t 0:00\t0\t-\n"+
"Rule\tRomania\t1980\tonly\t-\tApr\t 5\t23:00\t1:00\tS\n"+
"Rule\tRomania\t1980\tonly\t-\tSep\tlastSun\t 1:00\t0\t-\n"+
"Rule\tRomania\t1991\t1993\t-\tMar\tlastSun\t 0:00s\t1:00\tS\n"+
"Rule\tRomania\t1991\t1993\t-\tSep\tlastSun\t 0:00s\t0\t-\n"+
"Zone Europe/Bucharest\t1:44:24 -\tLMT\t1891 Oct\n"+
"\t\t\t1:44:24\t-\tBMT\t1931 Jul 24\t# Bucharest MT\n"+
"\t\t\t2:00\tRomania\tEE%sT\t1981 Mar 29 2:00s\n"+
"\t\t\t2:00\tC-Eur\tEE%sT\t1991\n"+
"\t\t\t2:00\tRomania\tEE%sT\t1994\n"+
"\t\t\t2:00\tE-Eur\tEE%sT\t1997\n"+
"\t\t\t2:00\tEU\tEE%sT\n"+
"Zone Europe/Kaliningrad\t 1:22:00 -\tLMT\t1893 Apr\n"+
"\t\t\t 1:00\tC-Eur\tCE%sT\t1945\n"+
"\t\t\t 2:00\tPoland\tCE%sT\t1946\n"+
"\t\t\t 3:00\tRussia\tMSK/MSD\t1991 Mar 31 2:00s\n"+
"\t\t\t 2:00\tRussia\tEE%sT\t2011 Mar 27 2:00s\n"+
"\t\t\t 3:00\t-\tFET # Further-eastern European Time\n"+
"Zone Europe/Moscow\t 2:30:20 -\tLMT\t1880\n"+
"\t\t\t 2:30\t-\tMMT\t1916 Jul  3 # Moscow Mean Time\n"+
"\t\t\t 2:30:48 Russia\t%s\t1919 Jul  1 2:00\n"+
"\t\t\t 3:00\tRussia\tMSK/MSD\t1922 Oct\n"+
"\t\t\t 2:00\t-\tEET\t1930 Jun 21\n"+
"\t\t\t 3:00\tRussia\tMSK/MSD\t1991 Mar 31 2:00s\n"+
"\t\t\t 2:00\tRussia\tEE%sT\t1992 Jan 19 2:00s\n"+
"\t\t\t 3:00\tRussia\tMSK/MSD\t2011 Mar 27 2:00s\n"+
"\t\t\t 4:00\t-\tMSK\n"+
"Zone Europe/Volgograd\t 2:57:40 -\tLMT\t1920 Jan  3\n"+
"\t\t\t 3:00\t-\tTSAT\t1925 Apr  6 # Tsaritsyn Time\n"+
"\t\t\t 3:00\t-\tSTAT\t1930 Jun 21 # Stalingrad Time\n"+
"\t\t\t 4:00\t-\tSTAT\t1961 Nov 11\n"+
"\t\t\t 4:00\tRussia\tVOL%sT\t1989 Mar 26 2:00s # Volgograd T\n"+
"\t\t\t 3:00\tRussia\tVOL%sT\t1991 Mar 31 2:00s\n"+
"\t\t\t 4:00\t-\tVOLT\t1992 Mar 29 2:00s\n"+
"\t\t\t 3:00\tRussia\tVOL%sT\t2011 Mar 27 2:00s\n"+
"\t\t\t 4:00\t-\tVOLT\n"+
"Zone Europe/Samara\t 3:20:36 -\tLMT\t1919 Jul  1 2:00\n"+
"\t\t\t 3:00\t-\tSAMT\t1930 Jun 21\n"+
"\t\t\t 4:00\t-\tSAMT\t1935 Jan 27\n"+
"\t\t\t 4:00\tRussia\tKUY%sT\t1989 Mar 26 2:00s # Kuybyshev\n"+
"\t\t\t 3:00\tRussia\tKUY%sT\t1991 Mar 31 2:00s\n"+
"\t\t\t 2:00\tRussia\tKUY%sT\t1991 Sep 29 2:00s\n"+
"\t\t\t 3:00\t-\tKUYT\t1991 Oct 20 3:00\n"+
"\t\t\t 4:00\tRussia\tSAM%sT\t2010 Mar 28 2:00s # Samara Time\n"+
"\t\t\t 3:00\tRussia\tSAM%sT\t2011 Mar 27 2:00s\n"+
"\t\t\t 4:00\t-\tSAMT\n"+
"Zone Asia/Yekaterinburg\t 4:02:24 -\tLMT\t1919 Jul 15 4:00\n"+
"\t\t\t 4:00\t-\tSVET\t1930 Jun 21 # Sverdlovsk Time\n"+
"\t\t\t 5:00\tRussia\tSVE%sT\t1991 Mar 31 2:00s\n"+
"\t\t\t 4:00\tRussia\tSVE%sT\t1992 Jan 19 2:00s\n"+
"\t\t\t 5:00\tRussia\tYEK%sT\t2011 Mar 27 2:00s\n"+
"\t\t\t 6:00\t-\tYEKT\t# Yekaterinburg Time\n"+
"Zone Asia/Omsk\t\t 4:53:36 -\tLMT\t1919 Nov 14\n"+
"\t\t\t 5:00\t-\tOMST\t1930 Jun 21 # Omsk TIme\n"+
"\t\t\t 6:00\tRussia\tOMS%sT\t1991 Mar 31 2:00s\n"+
"\t\t\t 5:00\tRussia\tOMS%sT\t1992 Jan 19 2:00s\n"+
"\t\t\t 6:00\tRussia\tOMS%sT\t2011 Mar 27 2:00s\n"+
"\t\t\t 7:00\t-\tOMST\n"+
"Zone Asia/Novosibirsk\t 5:31:40 -\tLMT\t1919 Dec 14 6:00\n"+
"\t\t\t 6:00\t-\tNOVT\t1930 Jun 21 # Novosibirsk Time\n"+
"\t\t\t 7:00\tRussia\tNOV%sT\t1991 Mar 31 2:00s\n"+
"\t\t\t 6:00\tRussia\tNOV%sT\t1992 Jan 19 2:00s\n"+
"\t\t\t 7:00\tRussia\tNOV%sT\t1993 May 23 # say Shanks & P.\n"+
"\t\t\t 6:00\tRussia\tNOV%sT\t2011 Mar 27 2:00s\n"+
"\t\t\t 7:00\t-\tNOVT\n"+
"Zone Asia/Novokuznetsk\t 5:48:48 -\tNMT\t1920 Jan  6\n"+
"\t\t\t 6:00\t-\tKRAT\t1930 Jun 21 # Krasnoyarsk Time\n"+
"\t\t\t 7:00\tRussia\tKRA%sT\t1991 Mar 31 2:00s\n"+
"\t\t\t 6:00\tRussia\tKRA%sT\t1992 Jan 19 2:00s\n"+
"\t\t\t 7:00\tRussia\tKRA%sT\t2010 Mar 28 2:00s\n"+
"\t\t\t 6:00\tRussia\tNOV%sT\t2011 Mar 27 2:00s\n"+
"\t\t\t 7:00\t-\tNOVT # Novosibirsk/Novokuznetsk Time\n"+
"Zone Asia/Krasnoyarsk\t 6:11:20 -\tLMT\t1920 Jan  6\n"+
"\t\t\t 6:00\t-\tKRAT\t1930 Jun 21 # Krasnoyarsk Time\n"+
"\t\t\t 7:00\tRussia\tKRA%sT\t1991 Mar 31 2:00s\n"+
"\t\t\t 6:00\tRussia\tKRA%sT\t1992 Jan 19 2:00s\n"+
"\t\t\t 7:00\tRussia\tKRA%sT\t2011 Mar 27 2:00s\n"+
"\t\t\t 8:00\t-\tKRAT\n"+
"Zone Asia/Irkutsk\t 6:57:20 -\tLMT\t1880\n"+
"\t\t\t 6:57:20 -\tIMT\t1920 Jan 25 # Irkutsk Mean Time\n"+
"\t\t\t 7:00\t-\tIRKT\t1930 Jun 21 # Irkutsk Time\n"+
"\t\t\t 8:00\tRussia\tIRK%sT\t1991 Mar 31 2:00s\n"+
"\t\t\t 7:00\tRussia\tIRK%sT\t1992 Jan 19 2:00s\n"+
"\t\t\t 8:00\tRussia\tIRK%sT\t2011 Mar 27 2:00s\n"+
"\t\t\t 9:00\t-\tIRKT\n"+
"Zone Asia/Yakutsk\t 8:38:40 -\tLMT\t1919 Dec 15\n"+
"\t\t\t 8:00\t-\tYAKT\t1930 Jun 21 # Yakutsk Time\n"+
"\t\t\t 9:00\tRussia\tYAK%sT\t1991 Mar 31 2:00s\n"+
"\t\t\t 8:00\tRussia\tYAK%sT\t1992 Jan 19 2:00s\n"+
"\t\t\t 9:00\tRussia\tYAK%sT\t2011 Mar 27 2:00s\n"+
"\t\t\t 10:00\t-\tYAKT\n"+
"Zone Asia/Vladivostok\t 8:47:44 -\tLMT\t1922 Nov 15\n"+
"\t\t\t 9:00\t-\tVLAT\t1930 Jun 21 # Vladivostok Time\n"+
"\t\t\t10:00\tRussia\tVLA%sT\t1991 Mar 31 2:00s\n"+
"\t\t\t 9:00\tRussia\tVLA%sST\t1992 Jan 19 2:00s\n"+
"\t\t\t10:00\tRussia\tVLA%sT\t2011 Mar 27 2:00s\n"+
"\t\t\t11:00\t-\tVLAT\n"+
"Zone Asia/Sakhalin\t 9:30:48 -\tLMT\t1905 Aug 23\n"+
"\t\t\t 9:00\t-\tCJT\t1938\n"+
"\t\t\t 9:00\t-\tJST\t1945 Aug 25\n"+
"\t\t\t11:00\tRussia\tSAK%sT\t1991 Mar 31 2:00s # Sakhalin T.\n"+
"\t\t\t10:00\tRussia\tSAK%sT\t1992 Jan 19 2:00s\n"+
"\t\t\t11:00\tRussia\tSAK%sT\t1997 Mar lastSun 2:00s\n"+
"\t\t\t10:00\tRussia\tSAK%sT\t2011 Mar 27 2:00s\n"+
"\t\t\t11:00\t-\tSAKT\n"+
"Zone Asia/Magadan\t10:03:12 -\tLMT\t1924 May  2\n"+
"\t\t\t10:00\t-\tMAGT\t1930 Jun 21 # Magadan Time\n"+
"\t\t\t11:00\tRussia\tMAG%sT\t1991 Mar 31 2:00s\n"+
"\t\t\t10:00\tRussia\tMAG%sT\t1992 Jan 19 2:00s\n"+
"\t\t\t11:00\tRussia\tMAG%sT\t2011 Mar 27 2:00s\n"+
"\t\t\t12:00\t-\tMAGT\n"+
"Zone Asia/Kamchatka\t10:34:36 -\tLMT\t1922 Nov 10\n"+
"\t\t\t11:00\t-\tPETT\t1930 Jun 21 # P-K Time\n"+
"\t\t\t12:00\tRussia\tPET%sT\t1991 Mar 31 2:00s\n"+
"\t\t\t11:00\tRussia\tPET%sT\t1992 Jan 19 2:00s\n"+
"\t\t\t12:00\tRussia\tPET%sT\t2010 Mar 28 2:00s\n"+
"\t\t\t11:00\tRussia\tPET%sT\t2011 Mar 27 2:00s\n"+
"\t\t\t12:00\t-\tPETT\n"+
"Zone Asia/Anadyr\t11:49:56 -\tLMT\t1924 May  2\n"+
"\t\t\t12:00\t-\tANAT\t1930 Jun 21 # Anadyr Time\n"+
"\t\t\t13:00\tRussia\tANA%sT\t1982 Apr  1 0:00s\n"+
"\t\t\t12:00\tRussia\tANA%sT\t1991 Mar 31 2:00s\n"+
"\t\t\t11:00\tRussia\tANA%sT\t1992 Jan 19 2:00s\n"+
"\t\t\t12:00\tRussia\tANA%sT\t2010 Mar 28 2:00s\n"+
"\t\t\t11:00\tRussia\tANA%sT\t2011 Mar 27 2:00s\n"+
"\t\t\t12:00\t-\tANAT\n"+
"Zone\tEurope/Belgrade\t1:22:00\t-\tLMT\t1884\n"+
"\t\t\t1:00\t-\tCET\t1941 Apr 18 23:00\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1945\n"+
"\t\t\t1:00\t-\tCET\t1945 May 8 2:00s\n"+
"\t\t\t1:00\t1:00\tCEST\t1945 Sep 16  2:00s\n"+
"\t\t\t1:00\t-\tCET\t1982 Nov 27\n"+
"\t\t\t1:00\tEU\tCE%sT\n"+
"Link Europe/Belgrade Europe/Ljubljana\t# Slovenia\n"+
"Link Europe/Belgrade Europe/Podgorica\t# Montenegro\n"+
"Link Europe/Belgrade Europe/Sarajevo\t# Bosnia and Herzegovina\n"+
"Link Europe/Belgrade Europe/Skopje\t# Macedonia\n"+
"Link Europe/Belgrade Europe/Zagreb\t# Croatia\n"+
"Link Europe/Prague Europe/Bratislava\n"+
"Rule\tSpain\t1917\tonly\t-\tMay\t 5\t23:00s\t1:00\tS\n"+
"Rule\tSpain\t1917\t1919\t-\tOct\t 6\t23:00s\t0\t-\n"+
"Rule\tSpain\t1918\tonly\t-\tApr\t15\t23:00s\t1:00\tS\n"+
"Rule\tSpain\t1919\tonly\t-\tApr\t 5\t23:00s\t1:00\tS\n"+
"Rule\tSpain\t1924\tonly\t-\tApr\t16\t23:00s\t1:00\tS\n"+
"Rule\tSpain\t1924\tonly\t-\tOct\t 4\t23:00s\t0\t-\n"+
"Rule\tSpain\t1926\tonly\t-\tApr\t17\t23:00s\t1:00\tS\n"+
"Rule\tSpain\t1926\t1929\t-\tOct\tSat>=1\t23:00s\t0\t-\n"+
"Rule\tSpain\t1927\tonly\t-\tApr\t 9\t23:00s\t1:00\tS\n"+
"Rule\tSpain\t1928\tonly\t-\tApr\t14\t23:00s\t1:00\tS\n"+
"Rule\tSpain\t1929\tonly\t-\tApr\t20\t23:00s\t1:00\tS\n"+
"Rule\tSpain\t1937\tonly\t-\tMay\t22\t23:00s\t1:00\tS\n"+
"Rule\tSpain\t1937\t1939\t-\tOct\tSat>=1\t23:00s\t0\t-\n"+
"Rule\tSpain\t1938\tonly\t-\tMar\t22\t23:00s\t1:00\tS\n"+
"Rule\tSpain\t1939\tonly\t-\tApr\t15\t23:00s\t1:00\tS\n"+
"Rule\tSpain\t1940\tonly\t-\tMar\t16\t23:00s\t1:00\tS\n"+
"Rule\tSpain\t1942\tonly\t-\tMay\t 2\t22:00s\t2:00\tM # Midsummer\n"+
"Rule\tSpain\t1942\tonly\t-\tSep\t 1\t22:00s\t1:00\tS\n"+
"Rule\tSpain\t1943\t1946\t-\tApr\tSat>=13\t22:00s\t2:00\tM\n"+
"Rule\tSpain\t1943\tonly\t-\tOct\t 3\t22:00s\t1:00\tS\n"+
"Rule\tSpain\t1944\tonly\t-\tOct\t10\t22:00s\t1:00\tS\n"+
"Rule\tSpain\t1945\tonly\t-\tSep\t30\t 1:00\t1:00\tS\n"+
"Rule\tSpain\t1946\tonly\t-\tSep\t30\t 0:00\t0\t-\n"+
"Rule\tSpain\t1949\tonly\t-\tApr\t30\t23:00\t1:00\tS\n"+
"Rule\tSpain\t1949\tonly\t-\tSep\t30\t 1:00\t0\t-\n"+
"Rule\tSpain\t1974\t1975\t-\tApr\tSat>=13\t23:00\t1:00\tS\n"+
"Rule\tSpain\t1974\t1975\t-\tOct\tSun>=1\t 1:00\t0\t-\n"+
"Rule\tSpain\t1976\tonly\t-\tMar\t27\t23:00\t1:00\tS\n"+
"Rule\tSpain\t1976\t1977\t-\tSep\tlastSun\t 1:00\t0\t-\n"+
"Rule\tSpain\t1977\t1978\t-\tApr\t 2\t23:00\t1:00\tS\n"+
"Rule\tSpain\t1978\tonly\t-\tOct\t 1\t 1:00\t0\t-\n"+
"Rule SpainAfrica 1967\tonly\t-\tJun\t 3\t12:00\t1:00\tS\n"+
"Rule SpainAfrica 1967\tonly\t-\tOct\t 1\t 0:00\t0\t-\n"+
"Rule SpainAfrica 1974\tonly\t-\tJun\t24\t 0:00\t1:00\tS\n"+
"Rule SpainAfrica 1974\tonly\t-\tSep\t 1\t 0:00\t0\t-\n"+
"Rule SpainAfrica 1976\t1977\t-\tMay\t 1\t 0:00\t1:00\tS\n"+
"Rule SpainAfrica 1976\tonly\t-\tAug\t 1\t 0:00\t0\t-\n"+
"Rule SpainAfrica 1977\tonly\t-\tSep\t28\t 0:00\t0\t-\n"+
"Rule SpainAfrica 1978\tonly\t-\tJun\t 1\t 0:00\t1:00\tS\n"+
"Rule SpainAfrica 1978\tonly\t-\tAug\t 4\t 0:00\t0\t-\n"+
"Zone\tEurope/Madrid\t-0:14:44 -\tLMT\t1901 Jan  1  0:00s\n"+
"\t\t\t 0:00\tSpain\tWE%sT\t1946 Sep 30\n"+
"\t\t\t 1:00\tSpain\tCE%sT\t1979\n"+
"\t\t\t 1:00\tEU\tCE%sT\n"+
"Zone\tAfrica/Ceuta\t-0:21:16 -\tLMT\t1901\n"+
"\t\t\t 0:00\t-\tWET\t1918 May  6 23:00\n"+
"\t\t\t 0:00\t1:00\tWEST\t1918 Oct  7 23:00\n"+
"\t\t\t 0:00\t-\tWET\t1924\n"+
"\t\t\t 0:00\tSpain\tWE%sT\t1929\n"+
"\t\t\t 0:00 SpainAfrica WE%sT 1984 Mar 16\n"+
"\t\t\t 1:00\t-\tCET\t1986\n"+
"\t\t\t 1:00\tEU\tCE%sT\n"+
"Zone\tAtlantic/Canary\t-1:01:36 -\tLMT\t1922 Mar # Las Palmas de Gran C.\n"+
"\t\t\t-1:00\t-\tCANT\t1946 Sep 30 1:00 # Canaries Time\n"+
"\t\t\t 0:00\t-\tWET\t1980 Apr  6 0:00s\n"+
"\t\t\t 0:00\t1:00\tWEST\t1980 Sep 28 0:00s\n"+
"\t\t\t 0:00\tEU\tWE%sT\n"+
"Zone Europe/Stockholm\t1:12:12 -\tLMT\t1879 Jan  1\n"+
"\t\t\t1:00:14\t-\tSET\t1900 Jan  1\t# Swedish Time\n"+
"\t\t\t1:00\t-\tCET\t1916 May 14 23:00\n"+
"\t\t\t1:00\t1:00\tCEST\t1916 Oct  1 01:00\n"+
"\t\t\t1:00\t-\tCET\t1980\n"+
"\t\t\t1:00\tEU\tCE%sT\n"+
"Rule\tSwiss\t1941\t1942\t-\tMay\tMon>=1\t1:00\t1:00\tS\n"+
"Rule\tSwiss\t1941\t1942\t-\tOct\tMon>=1\t2:00\t0\t-\n"+
"Zone\tEurope/Zurich\t0:34:08 -\tLMT\t1848 Sep 12\n"+
"\t\t\t0:29:44\t-\tBMT\t1894 Jun # Bern Mean Time\n"+
"\t\t\t1:00\tSwiss\tCE%sT\t1981\n"+
"\t\t\t1:00\tEU\tCE%sT\n"+
"Rule\tTurkey\t1916\tonly\t-\tMay\t 1\t0:00\t1:00\tS\n"+
"Rule\tTurkey\t1916\tonly\t-\tOct\t 1\t0:00\t0\t-\n"+
"Rule\tTurkey\t1920\tonly\t-\tMar\t28\t0:00\t1:00\tS\n"+
"Rule\tTurkey\t1920\tonly\t-\tOct\t25\t0:00\t0\t-\n"+
"Rule\tTurkey\t1921\tonly\t-\tApr\t 3\t0:00\t1:00\tS\n"+
"Rule\tTurkey\t1921\tonly\t-\tOct\t 3\t0:00\t0\t-\n"+
"Rule\tTurkey\t1922\tonly\t-\tMar\t26\t0:00\t1:00\tS\n"+
"Rule\tTurkey\t1922\tonly\t-\tOct\t 8\t0:00\t0\t-\n"+
"Rule\tTurkey\t1924\tonly\t-\tMay\t13\t0:00\t1:00\tS\n"+
"Rule\tTurkey\t1924\t1925\t-\tOct\t 1\t0:00\t0\t-\n"+
"Rule\tTurkey\t1925\tonly\t-\tMay\t 1\t0:00\t1:00\tS\n"+
"Rule\tTurkey\t1940\tonly\t-\tJun\t30\t0:00\t1:00\tS\n"+
"Rule\tTurkey\t1940\tonly\t-\tOct\t 5\t0:00\t0\t-\n"+
"Rule\tTurkey\t1940\tonly\t-\tDec\t 1\t0:00\t1:00\tS\n"+
"Rule\tTurkey\t1941\tonly\t-\tSep\t21\t0:00\t0\t-\n"+
"Rule\tTurkey\t1942\tonly\t-\tApr\t 1\t0:00\t1:00\tS\n"+
"Rule\tTurkey\t1942\tonly\t-\tNov\t 1\t0:00\t0\t-\n"+
"Rule\tTurkey\t1945\tonly\t-\tApr\t 2\t0:00\t1:00\tS\n"+
"Rule\tTurkey\t1945\tonly\t-\tOct\t 8\t0:00\t0\t-\n"+
"Rule\tTurkey\t1946\tonly\t-\tJun\t 1\t0:00\t1:00\tS\n"+
"Rule\tTurkey\t1946\tonly\t-\tOct\t 1\t0:00\t0\t-\n"+
"Rule\tTurkey\t1947\t1948\t-\tApr\tSun>=16\t0:00\t1:00\tS\n"+
"Rule\tTurkey\t1947\t1950\t-\tOct\tSun>=2\t0:00\t0\t-\n"+
"Rule\tTurkey\t1949\tonly\t-\tApr\t10\t0:00\t1:00\tS\n"+
"Rule\tTurkey\t1950\tonly\t-\tApr\t19\t0:00\t1:00\tS\n"+
"Rule\tTurkey\t1951\tonly\t-\tApr\t22\t0:00\t1:00\tS\n"+
"Rule\tTurkey\t1951\tonly\t-\tOct\t 8\t0:00\t0\t-\n"+
"Rule\tTurkey\t1962\tonly\t-\tJul\t15\t0:00\t1:00\tS\n"+
"Rule\tTurkey\t1962\tonly\t-\tOct\t 8\t0:00\t0\t-\n"+
"Rule\tTurkey\t1964\tonly\t-\tMay\t15\t0:00\t1:00\tS\n"+
"Rule\tTurkey\t1964\tonly\t-\tOct\t 1\t0:00\t0\t-\n"+
"Rule\tTurkey\t1970\t1972\t-\tMay\tSun>=2\t0:00\t1:00\tS\n"+
"Rule\tTurkey\t1970\t1972\t-\tOct\tSun>=2\t0:00\t0\t-\n"+
"Rule\tTurkey\t1973\tonly\t-\tJun\t 3\t1:00\t1:00\tS\n"+
"Rule\tTurkey\t1973\tonly\t-\tNov\t 4\t3:00\t0\t-\n"+
"Rule\tTurkey\t1974\tonly\t-\tMar\t31\t2:00\t1:00\tS\n"+
"Rule\tTurkey\t1974\tonly\t-\tNov\t 3\t5:00\t0\t-\n"+
"Rule\tTurkey\t1975\tonly\t-\tMar\t30\t0:00\t1:00\tS\n"+
"Rule\tTurkey\t1975\t1976\t-\tOct\tlastSun\t0:00\t0\t-\n"+
"Rule\tTurkey\t1976\tonly\t-\tJun\t 1\t0:00\t1:00\tS\n"+
"Rule\tTurkey\t1977\t1978\t-\tApr\tSun>=1\t0:00\t1:00\tS\n"+
"Rule\tTurkey\t1977\tonly\t-\tOct\t16\t0:00\t0\t-\n"+
"Rule\tTurkey\t1979\t1980\t-\tApr\tSun>=1\t3:00\t1:00\tS\n"+
"Rule\tTurkey\t1979\t1982\t-\tOct\tMon>=11\t0:00\t0\t-\n"+
"Rule\tTurkey\t1981\t1982\t-\tMar\tlastSun\t3:00\t1:00\tS\n"+
"Rule\tTurkey\t1983\tonly\t-\tJul\t31\t0:00\t1:00\tS\n"+
"Rule\tTurkey\t1983\tonly\t-\tOct\t 2\t0:00\t0\t-\n"+
"Rule\tTurkey\t1985\tonly\t-\tApr\t20\t0:00\t1:00\tS\n"+
"Rule\tTurkey\t1985\tonly\t-\tSep\t28\t0:00\t0\t-\n"+
"Rule\tTurkey\t1986\t1990\t-\tMar\tlastSun\t2:00s\t1:00\tS\n"+
"Rule\tTurkey\t1986\t1990\t-\tSep\tlastSun\t2:00s\t0\t-\n"+
"Rule\tTurkey\t1991\t2006\t-\tMar\tlastSun\t1:00s\t1:00\tS\n"+
"Rule\tTurkey\t1991\t1995\t-\tSep\tlastSun\t1:00s\t0\t-\n"+
"Rule\tTurkey\t1996\t2006\t-\tOct\tlastSun\t1:00s\t0\t-\n"+
"Zone\tEurope/Istanbul\t1:55:52 -\tLMT\t1880\n"+
"\t\t\t1:56:56\t-\tIMT\t1910 Oct # Istanbul Mean Time?\n"+
"\t\t\t2:00\tTurkey\tEE%sT\t1978 Oct 15\n"+
"\t\t\t3:00\tTurkey\tTR%sT\t1985 Apr 20 # Turkey Time\n"+
"\t\t\t2:00\tTurkey\tEE%sT\t2007\n"+
"\t\t\t2:00\tEU\tEE%sT\t2011 Mar 27 1:00u\n"+
"\t\t\t2:00\t-\tEET\t2011 Mar 28 1:00u\n"+
"\t\t\t2:00\tEU\tEE%sT\n"+
"Link\tEurope/Istanbul\tAsia/Istanbul\t# Istanbul is in both continents.\n"+
"Zone Europe/Kiev\t2:02:04 -\tLMT\t1880\n"+
"\t\t\t2:02:04\t-\tKMT\t1924 May  2 # Kiev Mean Time\n"+
"\t\t\t2:00\t-\tEET\t1930 Jun 21\n"+
"\t\t\t3:00\t-\tMSK\t1941 Sep 20\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1943 Nov  6\n"+
"\t\t\t3:00\tRussia\tMSK/MSD\t1990\n"+
"\t\t\t3:00\t-\tMSK\t1990 Jul  1 2:00\n"+
"\t\t\t2:00\t-\tEET\t1992\n"+
"\t\t\t2:00\tE-Eur\tEE%sT\t1995\n"+
"\t\t\t2:00\tEU\tEE%sT\n"+
"Zone Europe/Uzhgorod\t1:29:12 -\tLMT\t1890 Oct\n"+
"\t\t\t1:00\t-\tCET\t1940\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1944 Oct\n"+
"\t\t\t1:00\t1:00\tCEST\t1944 Oct 26\n"+
"\t\t\t1:00\t-\tCET\t1945 Jun 29\n"+
"\t\t\t3:00\tRussia\tMSK/MSD\t1990\n"+
"\t\t\t3:00\t-\tMSK\t1990 Jul  1 2:00\n"+
"\t\t\t1:00\t-\tCET\t1991 Mar 31 3:00\n"+
"\t\t\t2:00\t-\tEET\t1992\n"+
"\t\t\t2:00\tE-Eur\tEE%sT\t1995\n"+
"\t\t\t2:00\tEU\tEE%sT\n"+
"Zone Europe/Zaporozhye\t2:20:40 -\tLMT\t1880\n"+
"\t\t\t2:20\t-\tCUT\t1924 May  2 # Central Ukraine T\n"+
"\t\t\t2:00\t-\tEET\t1930 Jun 21\n"+
"\t\t\t3:00\t-\tMSK\t1941 Aug 25\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1943 Oct 25\n"+
"\t\t\t3:00\tRussia\tMSK/MSD\t1991 Mar 31 2:00\n"+
"\t\t\t2:00\tE-Eur\tEE%sT\t1995\n"+
"\t\t\t2:00\tEU\tEE%sT\n"+
"Zone Europe/Simferopol\t2:16:24 -\tLMT\t1880\n"+
"\t\t\t2:16\t-\tSMT\t1924 May  2 # Simferopol Mean T\n"+
"\t\t\t2:00\t-\tEET\t1930 Jun 21\n"+
"\t\t\t3:00\t-\tMSK\t1941 Nov\n"+
"\t\t\t1:00\tC-Eur\tCE%sT\t1944 Apr 13\n"+
"\t\t\t3:00\tRussia\tMSK/MSD\t1990\n"+
"\t\t\t3:00\t-\tMSK\t1990 Jul  1 2:00\n"+
"\t\t\t2:00\t-\tEET\t1992\n"+
"\t\t\t2:00\tE-Eur\tEE%sT\t1994 May\n"+
"\t\t\t3:00\tE-Eur\tMSK/MSD\t1996 Mar 31 3:00s\n"+
"\t\t\t3:00\t1:00\tMSD\t1996 Oct 27 3:00s\n"+
"\t\t\t3:00\tRussia\tMSK/MSD\t1997\n"+
"\t\t\t3:00\t-\tMSK\t1997 Mar lastSun 1:00u\n"+
"\t\t\t2:00\tEU\tEE%sT\n"+
"","tz/northamerica":"Rule\tUS\t1918\t1919\t-\tMar\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tUS\t1918\t1919\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Rule\tUS\t1942\tonly\t-\tFeb\t9\t2:00\t1:00\tW # War\n"+
"Rule\tUS\t1945\tonly\t-\tAug\t14\t23:00u\t1:00\tP # Peace\n"+
"Rule\tUS\t1945\tonly\t-\tSep\t30\t2:00\t0\tS\n"+
"Rule\tUS\t1967\t2006\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Rule\tUS\t1967\t1973\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tUS\t1974\tonly\t-\tJan\t6\t2:00\t1:00\tD\n"+
"Rule\tUS\t1975\tonly\t-\tFeb\t23\t2:00\t1:00\tD\n"+
"Rule\tUS\t1976\t1986\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tUS\t1987\t2006\t-\tApr\tSun>=1\t2:00\t1:00\tD\n"+
"Rule\tUS\t2007\tmax\t-\tMar\tSun>=8\t2:00\t1:00\tD\n"+
"Rule\tUS\t2007\tmax\t-\tNov\tSun>=1\t2:00\t0\tS\n"+
"Zone\tEST\t\t -5:00\t-\tEST\n"+
"Zone\tMST\t\t -7:00\t-\tMST\n"+
"Zone\tHST\t\t-10:00\t-\tHST\n"+
"Zone\tEST5EDT\t\t -5:00\tUS\tE%sT\n"+
"Zone\tCST6CDT\t\t -6:00\tUS\tC%sT\n"+
"Zone\tMST7MDT\t\t -7:00\tUS\tM%sT\n"+
"Zone\tPST8PDT\t\t -8:00\tUS\tP%sT\n"+
"Rule\tNYC\t1920\tonly\t-\tMar\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tNYC\t1920\tonly\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Rule\tNYC\t1921\t1966\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tNYC\t1921\t1954\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tNYC\t1955\t1966\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Zone America/New_York\t-4:56:02 -\tLMT\t1883 Nov 18 12:03:58\n"+
"\t\t\t-5:00\tUS\tE%sT\t1920\n"+
"\t\t\t-5:00\tNYC\tE%sT\t1942\n"+
"\t\t\t-5:00\tUS\tE%sT\t1946\n"+
"\t\t\t-5:00\tNYC\tE%sT\t1967\n"+
"\t\t\t-5:00\tUS\tE%sT\n"+
"Rule\tChicago\t1920\tonly\t-\tJun\t13\t2:00\t1:00\tD\n"+
"Rule\tChicago\t1920\t1921\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Rule\tChicago\t1921\tonly\t-\tMar\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tChicago\t1922\t1966\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tChicago\t1922\t1954\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tChicago\t1955\t1966\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Zone America/Chicago\t-5:50:36 -\tLMT\t1883 Nov 18 12:09:24\n"+
"\t\t\t-6:00\tUS\tC%sT\t1920\n"+
"\t\t\t-6:00\tChicago\tC%sT\t1936 Mar  1 2:00\n"+
"\t\t\t-5:00\t-\tEST\t1936 Nov 15 2:00\n"+
"\t\t\t-6:00\tChicago\tC%sT\t1942\n"+
"\t\t\t-6:00\tUS\tC%sT\t1946\n"+
"\t\t\t-6:00\tChicago\tC%sT\t1967\n"+
"\t\t\t-6:00\tUS\tC%sT\n"+
"Zone America/North_Dakota/Center -6:45:12 - LMT\t1883 Nov 18 12:14:48\n"+
"\t\t\t-7:00\tUS\tM%sT\t1992 Oct 25 02:00\n"+
"\t\t\t-6:00\tUS\tC%sT\n"+
"Zone America/North_Dakota/New_Salem -6:45:39 - LMT 1883 Nov 18 12:14:21\n"+
"\t\t\t-7:00\tUS\tM%sT\t2003 Oct 26 02:00\n"+
"\t\t\t-6:00\tUS\tC%sT\n"+
"Zone America/North_Dakota/Beulah -6:47:07 - LMT 1883 Nov 18 12:12:53\n"+
"\t\t\t-7:00\tUS\tM%sT\t2010 Nov  7 2:00\n"+
"\t\t\t-6:00\tUS\tC%sT\n"+
"Rule\tDenver\t1920\t1921\t-\tMar\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tDenver\t1920\tonly\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Rule\tDenver\t1921\tonly\t-\tMay\t22\t2:00\t0\tS\n"+
"Rule\tDenver\t1965\t1966\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tDenver\t1965\t1966\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Zone America/Denver\t-6:59:56 -\tLMT\t1883 Nov 18 12:00:04\n"+
"\t\t\t-7:00\tUS\tM%sT\t1920\n"+
"\t\t\t-7:00\tDenver\tM%sT\t1942\n"+
"\t\t\t-7:00\tUS\tM%sT\t1946\n"+
"\t\t\t-7:00\tDenver\tM%sT\t1967\n"+
"\t\t\t-7:00\tUS\tM%sT\n"+
"Rule\tCA\t1948\tonly\t-\tMar\t14\t2:00\t1:00\tD\n"+
"Rule\tCA\t1949\tonly\t-\tJan\t 1\t2:00\t0\tS\n"+
"Rule\tCA\t1950\t1966\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tCA\t1950\t1961\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tCA\t1962\t1966\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Zone America/Los_Angeles -7:52:58 -\tLMT\t1883 Nov 18 12:07:02\n"+
"\t\t\t-8:00\tUS\tP%sT\t1946\n"+
"\t\t\t-8:00\tCA\tP%sT\t1967\n"+
"\t\t\t-8:00\tUS\tP%sT\n"+
"Zone America/Juneau\t 15:02:19 -\tLMT\t1867 Oct 18\n"+
"\t\t\t -8:57:41 -\tLMT\t1900 Aug 20 12:00\n"+
"\t\t\t -8:00\t-\tPST\t1942\n"+
"\t\t\t -8:00\tUS\tP%sT\t1946\n"+
"\t\t\t -8:00\t-\tPST\t1969\n"+
"\t\t\t -8:00\tUS\tP%sT\t1980 Apr 27 2:00\n"+
"\t\t\t -9:00\tUS\tY%sT\t1980 Oct 26 2:00\t\n"+
"\t\t\t -8:00\tUS\tP%sT\t1983 Oct 30 2:00\n"+
"\t\t\t -9:00\tUS\tY%sT\t1983 Nov 30\n"+
"\t\t\t -9:00\tUS\tAK%sT\n"+
"Zone America/Sitka\t 14:58:47 -\tLMT\t1867 Oct 18\n"+
"\t\t\t -9:01:13 -\tLMT\t1900 Aug 20 12:00\n"+
"\t\t\t -8:00\t-\tPST\t1942\n"+
"\t\t\t -8:00\tUS\tP%sT\t1946\n"+
"\t\t\t -8:00\t-\tPST\t1969\n"+
"\t\t\t -8:00\tUS\tP%sT\t1983 Oct 30 2:00\n"+
"\t\t\t -9:00\tUS\tY%sT\t1983 Nov 30\n"+
"\t\t\t -9:00\tUS\tAK%sT\n"+
"Zone America/Metlakatla\t 15:13:42 -\tLMT\t1867 Oct 18\n"+
"\t\t\t -8:46:18 -\tLMT\t1900 Aug 20 12:00\n"+
"\t\t\t -8:00\t-\tPST\t1942\n"+
"\t\t\t -8:00\tUS\tP%sT\t1946\n"+
"\t\t\t -8:00\t-\tPST\t1969\n"+
"\t\t\t -8:00\tUS\tP%sT\t1983 Oct 30 2:00\n"+
"\t\t\t -8:00\t-\tMeST\n"+
"Zone America/Yakutat\t 14:41:05 -\tLMT\t1867 Oct 18\n"+
"\t\t\t -9:18:55 -\tLMT\t1900 Aug 20 12:00\n"+
"\t\t\t -9:00\t-\tYST\t1942\n"+
"\t\t\t -9:00\tUS\tY%sT\t1946\n"+
"\t\t\t -9:00\t-\tYST\t1969\n"+
"\t\t\t -9:00\tUS\tY%sT\t1983 Nov 30\n"+
"\t\t\t -9:00\tUS\tAK%sT\n"+
"Zone America/Anchorage\t 14:00:24 -\tLMT\t1867 Oct 18\n"+
"\t\t\t -9:59:36 -\tLMT\t1900 Aug 20 12:00\n"+
"\t\t\t-10:00\t-\tCAT\t1942\n"+
"\t\t\t-10:00\tUS\tCAT/CAWT 1945 Aug 14 23:00u\n"+
"\t\t\t-10:00\tUS\tCAT/CAPT 1946 # Peace\n"+
"\t\t\t-10:00\t-\tCAT\t1967 Apr\n"+
"\t\t\t-10:00\t-\tAHST\t1969\n"+
"\t\t\t-10:00\tUS\tAH%sT\t1983 Oct 30 2:00\n"+
"\t\t\t -9:00\tUS\tY%sT\t1983 Nov 30\n"+
"\t\t\t -9:00\tUS\tAK%sT\n"+
"Zone America/Nome\t 12:58:21 -\tLMT\t1867 Oct 18\n"+
"\t\t\t-11:01:38 -\tLMT\t1900 Aug 20 12:00\n"+
"\t\t\t-11:00\t-\tNST\t1942\n"+
"\t\t\t-11:00\tUS\tN%sT\t1946\n"+
"\t\t\t-11:00\t-\tNST\t1967 Apr\n"+
"\t\t\t-11:00\t-\tBST\t1969\n"+
"\t\t\t-11:00\tUS\tB%sT\t1983 Oct 30 2:00\n"+
"\t\t\t -9:00\tUS\tY%sT\t1983 Nov 30\n"+
"\t\t\t -9:00\tUS\tAK%sT\n"+
"Zone America/Adak\t 12:13:21 -\tLMT\t1867 Oct 18\n"+
"\t\t\t-11:46:38 -\tLMT\t1900 Aug 20 12:00\n"+
"\t\t\t-11:00\t-\tNST\t1942\n"+
"\t\t\t-11:00\tUS\tN%sT\t1946\n"+
"\t\t\t-11:00\t-\tNST\t1967 Apr\n"+
"\t\t\t-11:00\t-\tBST\t1969\n"+
"\t\t\t-11:00\tUS\tB%sT\t1983 Oct 30 2:00\n"+
"\t\t\t-10:00\tUS\tAH%sT\t1983 Nov 30\n"+
"\t\t\t-10:00\tUS\tHA%sT\n"+
"Zone Pacific/Honolulu\t-10:31:26 -\tLMT\t1896 Jan 13 12:00 #Schmitt&Cox\n"+
"\t\t\t-10:30\t-\tHST\t1933 Apr 30 2:00 #Laws 1933\n"+
"\t\t\t-10:30\t1:00\tHDT\t1933 May 21 12:00 #Laws 1933+12\n"+
"\t\t\t-10:30\t-\tHST\t1942 Feb 09 2:00 #Schmitt&Cox+2\n"+
"\t\t\t-10:30\t1:00\tHDT\t1945 Sep 30 2:00 #Schmitt&Cox+2\n"+
"\t\t\t-10:30\t-\tHST\t1947 Jun  8 2:00 #Schmitt&Cox+2\n"+
"\t\t\t-10:00\t-\tHST\n"+
"Zone America/Phoenix\t-7:28:18 -\tLMT\t1883 Nov 18 11:31:42\n"+
"\t\t\t-7:00\tUS\tM%sT\t1944 Jan  1 00:01\n"+
"\t\t\t-7:00\t-\tMST\t1944 Apr  1 00:01\n"+
"\t\t\t-7:00\tUS\tM%sT\t1944 Oct  1 00:01\n"+
"\t\t\t-7:00\t-\tMST\t1967\n"+
"\t\t\t-7:00\tUS\tM%sT\t1968 Mar 21\n"+
"\t\t\t-7:00\t-\tMST\n"+
"Link America/Denver America/Shiprock\n"+
"Zone America/Boise\t-7:44:49 -\tLMT\t1883 Nov 18 12:15:11\n"+
"\t\t\t-8:00\tUS\tP%sT\t1923 May 13 2:00\n"+
"\t\t\t-7:00\tUS\tM%sT\t1974\n"+
"\t\t\t-7:00\t-\tMST\t1974 Feb  3 2:00\n"+
"\t\t\t-7:00\tUS\tM%sT\n"+
"Rule Indianapolis 1941\tonly\t-\tJun\t22\t2:00\t1:00\tD\n"+
"Rule Indianapolis 1941\t1954\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule Indianapolis 1946\t1954\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Zone America/Indiana/Indianapolis -5:44:38 - LMT 1883 Nov 18 12:15:22\n"+
"\t\t\t-6:00\tUS\tC%sT\t1920\n"+
"\t\t\t-6:00 Indianapolis C%sT\t1942\n"+
"\t\t\t-6:00\tUS\tC%sT\t1946\n"+
"\t\t\t-6:00 Indianapolis C%sT\t1955 Apr 24 2:00\n"+
"\t\t\t-5:00\t-\tEST\t1957 Sep 29 2:00\n"+
"\t\t\t-6:00\t-\tCST\t1958 Apr 27 2:00\n"+
"\t\t\t-5:00\t-\tEST\t1969\n"+
"\t\t\t-5:00\tUS\tE%sT\t1971\n"+
"\t\t\t-5:00\t-\tEST\t2006\n"+
"\t\t\t-5:00\tUS\tE%sT\n"+
"Rule\tMarengo\t1951\tonly\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tMarengo\t1951\tonly\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tMarengo\t1954\t1960\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tMarengo\t1954\t1960\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Zone America/Indiana/Marengo -5:45:23 -\tLMT\t1883 Nov 18 12:14:37\n"+
"\t\t\t-6:00\tUS\tC%sT\t1951\n"+
"\t\t\t-6:00\tMarengo\tC%sT\t1961 Apr 30 2:00\n"+
"\t\t\t-5:00\t-\tEST\t1969\n"+
"\t\t\t-5:00\tUS\tE%sT\t1974 Jan  6 2:00\n"+
"\t\t\t-6:00\t1:00\tCDT\t1974 Oct 27 2:00\n"+
"\t\t\t-5:00\tUS\tE%sT\t1976\n"+
"\t\t\t-5:00\t-\tEST\t2006\n"+
"\t\t\t-5:00\tUS\tE%sT\n"+
"Rule Vincennes\t1946\tonly\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule Vincennes\t1946\tonly\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule Vincennes\t1953\t1954\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule Vincennes\t1953\t1959\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule Vincennes\t1955\tonly\t-\tMay\t 1\t0:00\t1:00\tD\n"+
"Rule Vincennes\t1956\t1963\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule Vincennes\t1960\tonly\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Rule Vincennes\t1961\tonly\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule Vincennes\t1962\t1963\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Zone America/Indiana/Vincennes -5:50:07 - LMT\t1883 Nov 18 12:09:53\n"+
"\t\t\t-6:00\tUS\tC%sT\t1946\n"+
"\t\t\t-6:00 Vincennes\tC%sT\t1964 Apr 26 2:00\n"+
"\t\t\t-5:00\t-\tEST\t1969\n"+
"\t\t\t-5:00\tUS\tE%sT\t1971\n"+
"\t\t\t-5:00\t-\tEST\t2006 Apr  2 2:00\n"+
"\t\t\t-6:00\tUS\tC%sT\t2007 Nov  4 2:00\n"+
"\t\t\t-5:00\tUS\tE%sT\n"+
"Rule Perry\t1946\tonly\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule Perry\t1946\tonly\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule Perry\t1953\t1954\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule Perry\t1953\t1959\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule Perry\t1955\tonly\t-\tMay\t 1\t0:00\t1:00\tD\n"+
"Rule Perry\t1956\t1963\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule Perry\t1960\tonly\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Rule Perry\t1961\tonly\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule Perry\t1962\t1963\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Zone America/Indiana/Tell_City -5:47:03 - LMT\t1883 Nov 18 12:12:57\n"+
"\t\t\t-6:00\tUS\tC%sT\t1946\n"+
"\t\t\t-6:00 Perry\tC%sT\t1964 Apr 26 2:00\n"+
"\t\t\t-5:00\t-\tEST\t1969\n"+
"\t\t\t-5:00\tUS\tE%sT\t1971\n"+
"\t\t\t-5:00\t-\tEST\t2006 Apr  2 2:00\n"+
"\t\t\t-6:00\tUS\tC%sT\n"+
"Rule\tPike\t1955\tonly\t-\tMay\t 1\t0:00\t1:00\tD\n"+
"Rule\tPike\t1955\t1960\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tPike\t1956\t1964\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tPike\t1961\t1964\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Zone America/Indiana/Petersburg -5:49:07 - LMT\t1883 Nov 18 12:10:53\n"+
"\t\t\t-6:00\tUS\tC%sT\t1955\n"+
"\t\t\t-6:00\tPike\tC%sT\t1965 Apr 25 2:00\n"+
"\t\t\t-5:00\t-\tEST\t1966 Oct 30 2:00\n"+
"\t\t\t-6:00\tUS\tC%sT\t1977 Oct 30 2:00\n"+
"\t\t\t-5:00\t-\tEST\t2006 Apr  2 2:00\n"+
"\t\t\t-6:00\tUS\tC%sT\t2007 Nov  4 2:00\n"+
"\t\t\t-5:00\tUS\tE%sT\n"+
"Rule\tStarke\t1947\t1961\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tStarke\t1947\t1954\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tStarke\t1955\t1956\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Rule\tStarke\t1957\t1958\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tStarke\t1959\t1961\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Zone America/Indiana/Knox -5:46:30 -\tLMT\t1883 Nov 18 12:13:30\n"+
"\t\t\t-6:00\tUS\tC%sT\t1947\n"+
"\t\t\t-6:00\tStarke\tC%sT\t1962 Apr 29 2:00\n"+
"\t\t\t-5:00\t-\tEST\t1963 Oct 27 2:00\n"+
"\t\t\t-6:00\tUS\tC%sT\t1991 Oct 27 2:00\n"+
"\t\t\t-5:00\t-\tEST\t2006 Apr  2 2:00\n"+
"\t\t\t-6:00\tUS\tC%sT\n"+
"Rule\tPulaski\t1946\t1960\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tPulaski\t1946\t1954\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tPulaski\t1955\t1956\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Rule\tPulaski\t1957\t1960\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Zone America/Indiana/Winamac -5:46:25 - LMT\t1883 Nov 18 12:13:35\n"+
"\t\t\t-6:00\tUS\tC%sT\t1946\n"+
"\t\t\t-6:00\tPulaski\tC%sT\t1961 Apr 30 2:00\n"+
"\t\t\t-5:00\t-\tEST\t1969\n"+
"\t\t\t-5:00\tUS\tE%sT\t1971\n"+
"\t\t\t-5:00\t-\tEST\t2006 Apr  2 2:00\n"+
"\t\t\t-6:00\tUS\tC%sT\t2007 Mar 11 2:00\n"+
"\t\t\t-5:00\tUS\tE%sT\n"+
"Zone America/Indiana/Vevay -5:40:16 -\tLMT\t1883 Nov 18 12:19:44\n"+
"\t\t\t-6:00\tUS\tC%sT\t1954 Apr 25 2:00\n"+
"\t\t\t-5:00\t-\tEST\t1969\n"+
"\t\t\t-5:00\tUS\tE%sT\t1973\n"+
"\t\t\t-5:00\t-\tEST\t2006\n"+
"\t\t\t-5:00\tUS\tE%sT\n"+
"Rule Louisville\t1921\tonly\t-\tMay\t1\t2:00\t1:00\tD\n"+
"Rule Louisville\t1921\tonly\t-\tSep\t1\t2:00\t0\tS\n"+
"Rule Louisville\t1941\t1961\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule Louisville\t1941\tonly\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule Louisville\t1946\tonly\t-\tJun\t2\t2:00\t0\tS\n"+
"Rule Louisville\t1950\t1955\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule Louisville\t1956\t1960\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Zone America/Kentucky/Louisville -5:43:02 -\tLMT\t1883 Nov 18 12:16:58\n"+
"\t\t\t-6:00\tUS\tC%sT\t1921\n"+
"\t\t\t-6:00 Louisville C%sT\t1942\n"+
"\t\t\t-6:00\tUS\tC%sT\t1946\n"+
"\t\t\t-6:00 Louisville C%sT\t1961 Jul 23 2:00\n"+
"\t\t\t-5:00\t-\tEST\t1968\n"+
"\t\t\t-5:00\tUS\tE%sT\t1974 Jan  6 2:00\n"+
"\t\t\t-6:00\t1:00\tCDT\t1974 Oct 27 2:00\n"+
"\t\t\t-5:00\tUS\tE%sT\n"+
"Zone America/Kentucky/Monticello -5:39:24 - LMT\t1883 Nov 18 12:20:36\n"+
"\t\t\t-6:00\tUS\tC%sT\t1946\n"+
"\t\t\t-6:00\t-\tCST\t1968\n"+
"\t\t\t-6:00\tUS\tC%sT\t2000 Oct 29  2:00\n"+
"\t\t\t-5:00\tUS\tE%sT\n"+
"Rule\tDetroit\t1948\tonly\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tDetroit\t1948\tonly\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tDetroit\t1967\tonly\t-\tJun\t14\t2:00\t1:00\tD\n"+
"Rule\tDetroit\t1967\tonly\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Zone America/Detroit\t-5:32:11 -\tLMT\t1905\n"+
"\t\t\t-6:00\t-\tCST\t1915 May 15 2:00\n"+
"\t\t\t-5:00\t-\tEST\t1942\n"+
"\t\t\t-5:00\tUS\tE%sT\t1946\n"+
"\t\t\t-5:00\tDetroit\tE%sT\t1973\n"+
"\t\t\t-5:00\tUS\tE%sT\t1975\n"+
"\t\t\t-5:00\t-\tEST\t1975 Apr 27 2:00\n"+
"\t\t\t-5:00\tUS\tE%sT\n"+
"Rule Menominee\t1946\tonly\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule Menominee\t1946\tonly\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule Menominee\t1966\tonly\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule Menominee\t1966\tonly\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Zone America/Menominee\t-5:50:27 -\tLMT\t1885 Sep 18 12:00\n"+
"\t\t\t-6:00\tUS\tC%sT\t1946\n"+
"\t\t\t-6:00 Menominee\tC%sT\t1969 Apr 27 2:00\n"+
"\t\t\t-5:00\t-\tEST\t1973 Apr 29 2:00\n"+
"\t\t\t-6:00\tUS\tC%sT\n"+
"Rule\tCanada\t1918\tonly\t-\tApr\t14\t2:00\t1:00\tD\n"+
"Rule\tCanada\t1918\tonly\t-\tOct\t31\t2:00\t0\tS\n"+
"Rule\tCanada\t1942\tonly\t-\tFeb\t 9\t2:00\t1:00\tW # War\n"+
"Rule\tCanada\t1945\tonly\t-\tAug\t14\t23:00u\t1:00\tP # Peace\n"+
"Rule\tCanada\t1945\tonly\t-\tSep\t30\t2:00\t0\tS\n"+
"Rule\tCanada\t1974\t1986\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tCanada\t1974\t2006\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Rule\tCanada\t1987\t2006\t-\tApr\tSun>=1\t2:00\t1:00\tD\n"+
"Rule\tCanada\t2007\tmax\t-\tMar\tSun>=8\t2:00\t1:00\tD\n"+
"Rule\tCanada\t2007\tmax\t-\tNov\tSun>=1\t2:00\t0\tS\n"+
"Rule\tStJohns\t1917\tonly\t-\tApr\t 8\t2:00\t1:00\tD\n"+
"Rule\tStJohns\t1917\tonly\t-\tSep\t17\t2:00\t0\tS\n"+
"Rule\tStJohns\t1919\tonly\t-\tMay\t 5\t23:00\t1:00\tD\n"+
"Rule\tStJohns\t1919\tonly\t-\tAug\t12\t23:00\t0\tS\n"+
"Rule\tStJohns\t1920\t1935\t-\tMay\tSun>=1\t23:00\t1:00\tD\n"+
"Rule\tStJohns\t1920\t1935\t-\tOct\tlastSun\t23:00\t0\tS\n"+
"Rule\tStJohns\t1936\t1941\t-\tMay\tMon>=9\t0:00\t1:00\tD\n"+
"Rule\tStJohns\t1936\t1941\t-\tOct\tMon>=2\t0:00\t0\tS\n"+
"Rule\tStJohns\t1946\t1950\t-\tMay\tSun>=8\t2:00\t1:00\tD\n"+
"Rule\tStJohns\t1946\t1950\t-\tOct\tSun>=2\t2:00\t0\tS\n"+
"Rule\tStJohns\t1951\t1986\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tStJohns\t1951\t1959\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tStJohns\t1960\t1986\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Rule\tStJohns\t1987\tonly\t-\tApr\tSun>=1\t0:01\t1:00\tD\n"+
"Rule\tStJohns\t1987\t2006\t-\tOct\tlastSun\t0:01\t0\tS\n"+
"Rule\tStJohns\t1988\tonly\t-\tApr\tSun>=1\t0:01\t2:00\tDD\n"+
"Rule\tStJohns\t1989\t2006\t-\tApr\tSun>=1\t0:01\t1:00\tD\n"+
"Rule\tStJohns\t2007\t2011\t-\tMar\tSun>=8\t0:01\t1:00\tD\n"+
"Rule\tStJohns\t2007\t2010\t-\tNov\tSun>=1\t0:01\t0\tS\n"+
"Zone America/St_Johns\t-3:30:52 -\tLMT\t1884\n"+
"\t\t\t-3:30:52 StJohns N%sT\t1918\n"+
"\t\t\t-3:30:52 Canada\tN%sT\t1919\n"+
"\t\t\t-3:30:52 StJohns N%sT\t1935 Mar 30\n"+
"\t\t\t-3:30\tStJohns\tN%sT\t1942 May 11\n"+
"\t\t\t-3:30\tCanada\tN%sT\t1946\n"+
"\t\t\t-3:30\tStJohns\tN%sT\t2011 Nov\n"+
"\t\t\t-3:30\tCanada\tN%sT\n"+
"Zone America/Goose_Bay\t-4:01:40 -\tLMT\t1884 # Happy Valley-Goose Bay\n"+
"\t\t\t-3:30:52 -\tNST\t1918\n"+
"\t\t\t-3:30:52 Canada N%sT\t1919\n"+
"\t\t\t-3:30:52 -\tNST\t1935 Mar 30\n"+
"\t\t\t-3:30\t-\tNST\t1936\n"+
"\t\t\t-3:30\tStJohns\tN%sT\t1942 May 11\n"+
"\t\t\t-3:30\tCanada\tN%sT\t1946\n"+
"\t\t\t-3:30\tStJohns\tN%sT\t1966 Mar 15 2:00\n"+
"\t\t\t-4:00\tStJohns\tA%sT\t2011 Nov\n"+
"\t\t\t-4:00\tCanada\tA%sT\n"+
"Rule\tHalifax\t1916\tonly\t-\tApr\t 1\t0:00\t1:00\tD\n"+
"Rule\tHalifax\t1916\tonly\t-\tOct\t 1\t0:00\t0\tS\n"+
"Rule\tHalifax\t1920\tonly\t-\tMay\t 9\t0:00\t1:00\tD\n"+
"Rule\tHalifax\t1920\tonly\t-\tAug\t29\t0:00\t0\tS\n"+
"Rule\tHalifax\t1921\tonly\t-\tMay\t 6\t0:00\t1:00\tD\n"+
"Rule\tHalifax\t1921\t1922\t-\tSep\t 5\t0:00\t0\tS\n"+
"Rule\tHalifax\t1922\tonly\t-\tApr\t30\t0:00\t1:00\tD\n"+
"Rule\tHalifax\t1923\t1925\t-\tMay\tSun>=1\t0:00\t1:00\tD\n"+
"Rule\tHalifax\t1923\tonly\t-\tSep\t 4\t0:00\t0\tS\n"+
"Rule\tHalifax\t1924\tonly\t-\tSep\t15\t0:00\t0\tS\n"+
"Rule\tHalifax\t1925\tonly\t-\tSep\t28\t0:00\t0\tS\n"+
"Rule\tHalifax\t1926\tonly\t-\tMay\t16\t0:00\t1:00\tD\n"+
"Rule\tHalifax\t1926\tonly\t-\tSep\t13\t0:00\t0\tS\n"+
"Rule\tHalifax\t1927\tonly\t-\tMay\t 1\t0:00\t1:00\tD\n"+
"Rule\tHalifax\t1927\tonly\t-\tSep\t26\t0:00\t0\tS\n"+
"Rule\tHalifax\t1928\t1931\t-\tMay\tSun>=8\t0:00\t1:00\tD\n"+
"Rule\tHalifax\t1928\tonly\t-\tSep\t 9\t0:00\t0\tS\n"+
"Rule\tHalifax\t1929\tonly\t-\tSep\t 3\t0:00\t0\tS\n"+
"Rule\tHalifax\t1930\tonly\t-\tSep\t15\t0:00\t0\tS\n"+
"Rule\tHalifax\t1931\t1932\t-\tSep\tMon>=24\t0:00\t0\tS\n"+
"Rule\tHalifax\t1932\tonly\t-\tMay\t 1\t0:00\t1:00\tD\n"+
"Rule\tHalifax\t1933\tonly\t-\tApr\t30\t0:00\t1:00\tD\n"+
"Rule\tHalifax\t1933\tonly\t-\tOct\t 2\t0:00\t0\tS\n"+
"Rule\tHalifax\t1934\tonly\t-\tMay\t20\t0:00\t1:00\tD\n"+
"Rule\tHalifax\t1934\tonly\t-\tSep\t16\t0:00\t0\tS\n"+
"Rule\tHalifax\t1935\tonly\t-\tJun\t 2\t0:00\t1:00\tD\n"+
"Rule\tHalifax\t1935\tonly\t-\tSep\t30\t0:00\t0\tS\n"+
"Rule\tHalifax\t1936\tonly\t-\tJun\t 1\t0:00\t1:00\tD\n"+
"Rule\tHalifax\t1936\tonly\t-\tSep\t14\t0:00\t0\tS\n"+
"Rule\tHalifax\t1937\t1938\t-\tMay\tSun>=1\t0:00\t1:00\tD\n"+
"Rule\tHalifax\t1937\t1941\t-\tSep\tMon>=24\t0:00\t0\tS\n"+
"Rule\tHalifax\t1939\tonly\t-\tMay\t28\t0:00\t1:00\tD\n"+
"Rule\tHalifax\t1940\t1941\t-\tMay\tSun>=1\t0:00\t1:00\tD\n"+
"Rule\tHalifax\t1946\t1949\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tHalifax\t1946\t1949\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tHalifax\t1951\t1954\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tHalifax\t1951\t1954\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tHalifax\t1956\t1959\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tHalifax\t1956\t1959\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tHalifax\t1962\t1973\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tHalifax\t1962\t1973\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Zone America/Halifax\t-4:14:24 -\tLMT\t1902 Jun 15\n"+
"\t\t\t-4:00\tHalifax\tA%sT\t1918\n"+
"\t\t\t-4:00\tCanada\tA%sT\t1919\n"+
"\t\t\t-4:00\tHalifax\tA%sT\t1942 Feb  9 2:00s\n"+
"\t\t\t-4:00\tCanada\tA%sT\t1946\n"+
"\t\t\t-4:00\tHalifax\tA%sT\t1974\n"+
"\t\t\t-4:00\tCanada\tA%sT\n"+
"Zone America/Glace_Bay\t-3:59:48 -\tLMT\t1902 Jun 15\n"+
"\t\t\t-4:00\tCanada\tA%sT\t1953\n"+
"\t\t\t-4:00\tHalifax\tA%sT\t1954\n"+
"\t\t\t-4:00\t-\tAST\t1972\n"+
"\t\t\t-4:00\tHalifax\tA%sT\t1974\n"+
"\t\t\t-4:00\tCanada\tA%sT\n"+
"Rule\tMoncton\t1933\t1935\t-\tJun\tSun>=8\t1:00\t1:00\tD\n"+
"Rule\tMoncton\t1933\t1935\t-\tSep\tSun>=8\t1:00\t0\tS\n"+
"Rule\tMoncton\t1936\t1938\t-\tJun\tSun>=1\t1:00\t1:00\tD\n"+
"Rule\tMoncton\t1936\t1938\t-\tSep\tSun>=1\t1:00\t0\tS\n"+
"Rule\tMoncton\t1939\tonly\t-\tMay\t27\t1:00\t1:00\tD\n"+
"Rule\tMoncton\t1939\t1941\t-\tSep\tSat>=21\t1:00\t0\tS\n"+
"Rule\tMoncton\t1940\tonly\t-\tMay\t19\t1:00\t1:00\tD\n"+
"Rule\tMoncton\t1941\tonly\t-\tMay\t 4\t1:00\t1:00\tD\n"+
"Rule\tMoncton\t1946\t1972\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tMoncton\t1946\t1956\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tMoncton\t1957\t1972\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Rule\tMoncton\t1993\t2006\t-\tApr\tSun>=1\t0:01\t1:00\tD\n"+
"Rule\tMoncton\t1993\t2006\t-\tOct\tlastSun\t0:01\t0\tS\n"+
"Zone America/Moncton\t-4:19:08 -\tLMT\t1883 Dec  9\n"+
"\t\t\t-5:00\t-\tEST\t1902 Jun 15\n"+
"\t\t\t-4:00\tCanada\tA%sT\t1933\n"+
"\t\t\t-4:00\tMoncton\tA%sT\t1942\n"+
"\t\t\t-4:00\tCanada\tA%sT\t1946\n"+
"\t\t\t-4:00\tMoncton\tA%sT\t1973\n"+
"\t\t\t-4:00\tCanada\tA%sT\t1993\n"+
"\t\t\t-4:00\tMoncton\tA%sT\t2007\n"+
"\t\t\t-4:00\tCanada\tA%sT\n"+
"Rule\tMont\t1917\tonly\t-\tMar\t25\t2:00\t1:00\tD\n"+
"Rule\tMont\t1917\tonly\t-\tApr\t24\t0:00\t0\tS\n"+
"Rule\tMont\t1919\tonly\t-\tMar\t31\t2:30\t1:00\tD\n"+
"Rule\tMont\t1919\tonly\t-\tOct\t25\t2:30\t0\tS\n"+
"Rule\tMont\t1920\tonly\t-\tMay\t 2\t2:30\t1:00\tD\n"+
"Rule\tMont\t1920\t1922\t-\tOct\tSun>=1\t2:30\t0\tS\n"+
"Rule\tMont\t1921\tonly\t-\tMay\t 1\t2:00\t1:00\tD\n"+
"Rule\tMont\t1922\tonly\t-\tApr\t30\t2:00\t1:00\tD\n"+
"Rule\tMont\t1924\tonly\t-\tMay\t17\t2:00\t1:00\tD\n"+
"Rule\tMont\t1924\t1926\t-\tSep\tlastSun\t2:30\t0\tS\n"+
"Rule\tMont\t1925\t1926\t-\tMay\tSun>=1\t2:00\t1:00\tD\n"+
"Rule\tMont\t1927\tonly\t-\tMay\t1\t0:00\t1:00\tD\n"+
"Rule\tMont\t1927\t1932\t-\tSep\tlastSun\t0:00\t0\tS\n"+
"Rule\tMont\t1928\t1931\t-\tApr\tlastSun\t0:00\t1:00\tD\n"+
"Rule\tMont\t1932\tonly\t-\tMay\t1\t0:00\t1:00\tD\n"+
"Rule\tMont\t1933\t1940\t-\tApr\tlastSun\t0:00\t1:00\tD\n"+
"Rule\tMont\t1933\tonly\t-\tOct\t1\t0:00\t0\tS\n"+
"Rule\tMont\t1934\t1939\t-\tSep\tlastSun\t0:00\t0\tS\n"+
"Rule\tMont\t1946\t1973\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tMont\t1945\t1948\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tMont\t1949\t1950\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Rule\tMont\t1951\t1956\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tMont\t1957\t1973\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Zone America/Blanc-Sablon -3:48:28 -\tLMT\t1884\n"+
"\t\t\t-4:00\tCanada\tA%sT\t1970\n"+
"\t\t\t-4:00\t-\tAST\n"+
"Zone America/Montreal\t-4:54:16 -\tLMT\t1884\n"+
"\t\t\t-5:00\tMont\tE%sT\t1918\n"+
"\t\t\t-5:00\tCanada\tE%sT\t1919\n"+
"\t\t\t-5:00\tMont\tE%sT\t1942 Feb  9 2:00s\n"+
"\t\t\t-5:00\tCanada\tE%sT\t1946\n"+
"\t\t\t-5:00\tMont\tE%sT\t1974\n"+
"\t\t\t-5:00\tCanada\tE%sT\n"+
"Rule\tToronto\t1919\tonly\t-\tMar\t30\t23:30\t1:00\tD\n"+
"Rule\tToronto\t1919\tonly\t-\tOct\t26\t0:00\t0\tS\n"+
"Rule\tToronto\t1920\tonly\t-\tMay\t 2\t2:00\t1:00\tD\n"+
"Rule\tToronto\t1920\tonly\t-\tSep\t26\t0:00\t0\tS\n"+
"Rule\tToronto\t1921\tonly\t-\tMay\t15\t2:00\t1:00\tD\n"+
"Rule\tToronto\t1921\tonly\t-\tSep\t15\t2:00\t0\tS\n"+
"Rule\tToronto\t1922\t1923\t-\tMay\tSun>=8\t2:00\t1:00\tD\n"+
"Rule\tToronto\t1922\t1926\t-\tSep\tSun>=15\t2:00\t0\tS\n"+
"Rule\tToronto\t1924\t1927\t-\tMay\tSun>=1\t2:00\t1:00\tD\n"+
"Rule\tToronto\t1927\t1932\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tToronto\t1928\t1931\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tToronto\t1932\tonly\t-\tMay\t1\t2:00\t1:00\tD\n"+
"Rule\tToronto\t1933\t1940\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tToronto\t1933\tonly\t-\tOct\t1\t2:00\t0\tS\n"+
"Rule\tToronto\t1934\t1939\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tToronto\t1945\t1946\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tToronto\t1946\tonly\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tToronto\t1947\t1949\t-\tApr\tlastSun\t0:00\t1:00\tD\n"+
"Rule\tToronto\t1947\t1948\t-\tSep\tlastSun\t0:00\t0\tS\n"+
"Rule\tToronto\t1949\tonly\t-\tNov\tlastSun\t0:00\t0\tS\n"+
"Rule\tToronto\t1950\t1973\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tToronto\t1950\tonly\t-\tNov\tlastSun\t2:00\t0\tS\n"+
"Rule\tToronto\t1951\t1956\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tToronto\t1957\t1973\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Zone America/Toronto\t-5:17:32 -\tLMT\t1895\n"+
"\t\t\t-5:00\tCanada\tE%sT\t1919\n"+
"\t\t\t-5:00\tToronto\tE%sT\t1942 Feb  9 2:00s\n"+
"\t\t\t-5:00\tCanada\tE%sT\t1946\n"+
"\t\t\t-5:00\tToronto\tE%sT\t1974\n"+
"\t\t\t-5:00\tCanada\tE%sT\n"+
"Zone America/Thunder_Bay -5:57:00 -\tLMT\t1895\n"+
"\t\t\t-6:00\t-\tCST\t1910\n"+
"\t\t\t-5:00\t-\tEST\t1942\n"+
"\t\t\t-5:00\tCanada\tE%sT\t1970\n"+
"\t\t\t-5:00\tMont\tE%sT\t1973\n"+
"\t\t\t-5:00\t-\tEST\t1974\n"+
"\t\t\t-5:00\tCanada\tE%sT\n"+
"Zone America/Nipigon\t-5:53:04 -\tLMT\t1895\n"+
"\t\t\t-5:00\tCanada\tE%sT\t1940 Sep 29\n"+
"\t\t\t-5:00\t1:00\tEDT\t1942 Feb  9 2:00s\n"+
"\t\t\t-5:00\tCanada\tE%sT\n"+
"Zone America/Rainy_River -6:18:16 -\tLMT\t1895\n"+
"\t\t\t-6:00\tCanada\tC%sT\t1940 Sep 29\n"+
"\t\t\t-6:00\t1:00\tCDT\t1942 Feb  9 2:00s\n"+
"\t\t\t-6:00\tCanada\tC%sT\n"+
"Zone America/Atikokan\t-6:06:28 -\tLMT\t1895\n"+
"\t\t\t-6:00\tCanada\tC%sT\t1940 Sep 29\n"+
"\t\t\t-6:00\t1:00\tCDT\t1942 Feb  9 2:00s\n"+
"\t\t\t-6:00\tCanada\tC%sT\t1945 Sep 30 2:00\n"+
"\t\t\t-5:00\t-\tEST\n"+
"Rule\tWinn\t1916\tonly\t-\tApr\t23\t0:00\t1:00\tD\n"+
"Rule\tWinn\t1916\tonly\t-\tSep\t17\t0:00\t0\tS\n"+
"Rule\tWinn\t1918\tonly\t-\tApr\t14\t2:00\t1:00\tD\n"+
"Rule\tWinn\t1918\tonly\t-\tOct\t31\t2:00\t0\tS\n"+
"Rule\tWinn\t1937\tonly\t-\tMay\t16\t2:00\t1:00\tD\n"+
"Rule\tWinn\t1937\tonly\t-\tSep\t26\t2:00\t0\tS\n"+
"Rule\tWinn\t1942\tonly\t-\tFeb\t 9\t2:00\t1:00\tW # War\n"+
"Rule\tWinn\t1945\tonly\t-\tAug\t14\t23:00u\t1:00\tP # Peace\n"+
"Rule\tWinn\t1945\tonly\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tWinn\t1946\tonly\t-\tMay\t12\t2:00\t1:00\tD\n"+
"Rule\tWinn\t1946\tonly\t-\tOct\t13\t2:00\t0\tS\n"+
"Rule\tWinn\t1947\t1949\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tWinn\t1947\t1949\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tWinn\t1950\tonly\t-\tMay\t 1\t2:00\t1:00\tD\n"+
"Rule\tWinn\t1950\tonly\t-\tSep\t30\t2:00\t0\tS\n"+
"Rule\tWinn\t1951\t1960\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tWinn\t1951\t1958\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tWinn\t1959\tonly\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Rule\tWinn\t1960\tonly\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tWinn\t1963\tonly\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tWinn\t1963\tonly\t-\tSep\t22\t2:00\t0\tS\n"+
"Rule\tWinn\t1966\t1986\t-\tApr\tlastSun\t2:00s\t1:00\tD\n"+
"Rule\tWinn\t1966\t2005\t-\tOct\tlastSun\t2:00s\t0\tS\n"+
"Rule\tWinn\t1987\t2005\t-\tApr\tSun>=1\t2:00s\t1:00\tD\n"+
"Zone America/Winnipeg\t-6:28:36 -\tLMT\t1887 Jul 16\n"+
"\t\t\t-6:00\tWinn\tC%sT\t2006\n"+
"\t\t\t-6:00\tCanada\tC%sT\n"+
"Rule\tRegina\t1918\tonly\t-\tApr\t14\t2:00\t1:00\tD\n"+
"Rule\tRegina\t1918\tonly\t-\tOct\t31\t2:00\t0\tS\n"+
"Rule\tRegina\t1930\t1934\t-\tMay\tSun>=1\t0:00\t1:00\tD\n"+
"Rule\tRegina\t1930\t1934\t-\tOct\tSun>=1\t0:00\t0\tS\n"+
"Rule\tRegina\t1937\t1941\t-\tApr\tSun>=8\t0:00\t1:00\tD\n"+
"Rule\tRegina\t1937\tonly\t-\tOct\tSun>=8\t0:00\t0\tS\n"+
"Rule\tRegina\t1938\tonly\t-\tOct\tSun>=1\t0:00\t0\tS\n"+
"Rule\tRegina\t1939\t1941\t-\tOct\tSun>=8\t0:00\t0\tS\n"+
"Rule\tRegina\t1942\tonly\t-\tFeb\t 9\t2:00\t1:00\tW # War\n"+
"Rule\tRegina\t1945\tonly\t-\tAug\t14\t23:00u\t1:00\tP # Peace\n"+
"Rule\tRegina\t1945\tonly\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tRegina\t1946\tonly\t-\tApr\tSun>=8\t2:00\t1:00\tD\n"+
"Rule\tRegina\t1946\tonly\t-\tOct\tSun>=8\t2:00\t0\tS\n"+
"Rule\tRegina\t1947\t1957\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tRegina\t1947\t1957\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tRegina\t1959\tonly\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tRegina\t1959\tonly\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Rule\tSwift\t1957\tonly\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tSwift\t1957\tonly\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Rule\tSwift\t1959\t1961\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tSwift\t1959\tonly\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Rule\tSwift\t1960\t1961\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Zone America/Regina\t-6:58:36 -\tLMT\t1905 Sep\n"+
"\t\t\t-7:00\tRegina\tM%sT\t1960 Apr lastSun 2:00\n"+
"\t\t\t-6:00\t-\tCST\n"+
"Zone America/Swift_Current -7:11:20 -\tLMT\t1905 Sep\n"+
"\t\t\t-7:00\tCanada\tM%sT\t1946 Apr lastSun 2:00\n"+
"\t\t\t-7:00\tRegina\tM%sT\t1950\n"+
"\t\t\t-7:00\tSwift\tM%sT\t1972 Apr lastSun 2:00\n"+
"\t\t\t-6:00\t-\tCST\n"+
"Rule\tEdm\t1918\t1919\t-\tApr\tSun>=8\t2:00\t1:00\tD\n"+
"Rule\tEdm\t1918\tonly\t-\tOct\t31\t2:00\t0\tS\n"+
"Rule\tEdm\t1919\tonly\t-\tMay\t27\t2:00\t0\tS\n"+
"Rule\tEdm\t1920\t1923\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tEdm\t1920\tonly\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Rule\tEdm\t1921\t1923\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tEdm\t1942\tonly\t-\tFeb\t 9\t2:00\t1:00\tW # War\n"+
"Rule\tEdm\t1945\tonly\t-\tAug\t14\t23:00u\t1:00\tP # Peace\n"+
"Rule\tEdm\t1945\tonly\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tEdm\t1947\tonly\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tEdm\t1947\tonly\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tEdm\t1967\tonly\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tEdm\t1967\tonly\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Rule\tEdm\t1969\tonly\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tEdm\t1969\tonly\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Rule\tEdm\t1972\t1986\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tEdm\t1972\t2006\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Zone America/Edmonton\t-7:33:52 -\tLMT\t1906 Sep\n"+
"\t\t\t-7:00\tEdm\tM%sT\t1987\n"+
"\t\t\t-7:00\tCanada\tM%sT\n"+
"Rule\tVanc\t1918\tonly\t-\tApr\t14\t2:00\t1:00\tD\n"+
"Rule\tVanc\t1918\tonly\t-\tOct\t31\t2:00\t0\tS\n"+
"Rule\tVanc\t1942\tonly\t-\tFeb\t 9\t2:00\t1:00\tW # War\n"+
"Rule\tVanc\t1945\tonly\t-\tAug\t14\t23:00u\t1:00\tP # Peace\n"+
"Rule\tVanc\t1945\tonly\t-\tSep\t30\t2:00\t0\tS\n"+
"Rule\tVanc\t1946\t1986\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tVanc\t1946\tonly\t-\tOct\t13\t2:00\t0\tS\n"+
"Rule\tVanc\t1947\t1961\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tVanc\t1962\t2006\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Zone America/Vancouver\t-8:12:28 -\tLMT\t1884\n"+
"\t\t\t-8:00\tVanc\tP%sT\t1987\n"+
"\t\t\t-8:00\tCanada\tP%sT\n"+
"Zone America/Dawson_Creek -8:00:56 -\tLMT\t1884\n"+
"\t\t\t-8:00\tCanada\tP%sT\t1947\n"+
"\t\t\t-8:00\tVanc\tP%sT\t1972 Aug 30 2:00\n"+
"\t\t\t-7:00\t-\tMST\n"+
"Rule\tNT_YK\t1918\tonly\t-\tApr\t14\t2:00\t1:00\tD\n"+
"Rule\tNT_YK\t1918\tonly\t-\tOct\t27\t2:00\t0\tS\n"+
"Rule\tNT_YK\t1919\tonly\t-\tMay\t25\t2:00\t1:00\tD\n"+
"Rule\tNT_YK\t1919\tonly\t-\tNov\t 1\t0:00\t0\tS\n"+
"Rule\tNT_YK\t1942\tonly\t-\tFeb\t 9\t2:00\t1:00\tW # War\n"+
"Rule\tNT_YK\t1945\tonly\t-\tAug\t14\t23:00u\t1:00\tP # Peace\n"+
"Rule\tNT_YK\t1945\tonly\t-\tSep\t30\t2:00\t0\tS\n"+
"Rule\tNT_YK\t1965\tonly\t-\tApr\tlastSun\t0:00\t2:00\tDD\n"+
"Rule\tNT_YK\t1965\tonly\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Rule\tNT_YK\t1980\t1986\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tNT_YK\t1980\t2006\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Rule\tNT_YK\t1987\t2006\t-\tApr\tSun>=1\t2:00\t1:00\tD\n"+
"Zone America/Pangnirtung 0\t-\tzzz\t1921 # trading post est.\n"+
"\t\t\t-4:00\tNT_YK\tA%sT\t1995 Apr Sun>=1 2:00\n"+
"\t\t\t-5:00\tCanada\tE%sT\t1999 Oct 31 2:00\n"+
"\t\t\t-6:00\tCanada\tC%sT\t2000 Oct 29 2:00\n"+
"\t\t\t-5:00\tCanada\tE%sT\n"+
"Zone America/Iqaluit\t0\t-\tzzz\t1942 Aug # Frobisher Bay est.\n"+
"\t\t\t-5:00\tNT_YK\tE%sT\t1999 Oct 31 2:00\n"+
"\t\t\t-6:00\tCanada\tC%sT\t2000 Oct 29 2:00\n"+
"\t\t\t-5:00\tCanada\tE%sT\n"+
"Zone America/Resolute\t0\t-\tzzz\t1947 Aug 31 # Resolute founded\n"+
"\t\t\t-6:00\tNT_YK\tC%sT\t2000 Oct 29 2:00\n"+
"\t\t\t-5:00\t-\tEST\t2001 Apr  1 3:00\n"+
"\t\t\t-6:00\tCanada\tC%sT\t2006 Oct 29 2:00\n"+
"\t\t\t-5:00\t-\tEST\t2007 Mar 11 3:00\n"+
"\t\t\t-6:00\tCanada\tC%sT\n"+
"Zone America/Rankin_Inlet 0\t-\tzzz\t1957 # Rankin Inlet founded\n"+
"\t\t\t-6:00\tNT_YK\tC%sT\t2000 Oct 29 2:00\n"+
"\t\t\t-5:00\t-\tEST\t2001 Apr  1 3:00\n"+
"\t\t\t-6:00\tCanada\tC%sT\n"+
"Zone America/Cambridge_Bay 0\t-\tzzz\t1920 # trading post est.?\n"+
"\t\t\t-7:00\tNT_YK\tM%sT\t1999 Oct 31 2:00\n"+
"\t\t\t-6:00\tCanada\tC%sT\t2000 Oct 29 2:00\n"+
"\t\t\t-5:00\t-\tEST\t2000 Nov  5 0:00\n"+
"\t\t\t-6:00\t-\tCST\t2001 Apr  1 3:00\n"+
"\t\t\t-7:00\tCanada\tM%sT\n"+
"Zone America/Yellowknife 0\t-\tzzz\t1935 # Yellowknife founded?\n"+
"\t\t\t-7:00\tNT_YK\tM%sT\t1980\n"+
"\t\t\t-7:00\tCanada\tM%sT\n"+
"Zone America/Inuvik\t0\t-\tzzz\t1953 # Inuvik founded\n"+
"\t\t\t-8:00\tNT_YK\tP%sT\t1979 Apr lastSun 2:00\n"+
"\t\t\t-7:00\tNT_YK\tM%sT\t1980\n"+
"\t\t\t-7:00\tCanada\tM%sT\n"+
"Zone America/Whitehorse\t-9:00:12 -\tLMT\t1900 Aug 20\n"+
"\t\t\t-9:00\tNT_YK\tY%sT\t1966 Jul 1 2:00\n"+
"\t\t\t-8:00\tNT_YK\tP%sT\t1980\n"+
"\t\t\t-8:00\tCanada\tP%sT\n"+
"Zone America/Dawson\t-9:17:40 -\tLMT\t1900 Aug 20\n"+
"\t\t\t-9:00\tNT_YK\tY%sT\t1973 Oct 28 0:00\n"+
"\t\t\t-8:00\tNT_YK\tP%sT\t1980\n"+
"\t\t\t-8:00\tCanada\tP%sT\n"+
"Rule\tMexico\t1939\tonly\t-\tFeb\t5\t0:00\t1:00\tD\n"+
"Rule\tMexico\t1939\tonly\t-\tJun\t25\t0:00\t0\tS\n"+
"Rule\tMexico\t1940\tonly\t-\tDec\t9\t0:00\t1:00\tD\n"+
"Rule\tMexico\t1941\tonly\t-\tApr\t1\t0:00\t0\tS\n"+
"Rule\tMexico\t1943\tonly\t-\tDec\t16\t0:00\t1:00\tW # War\n"+
"Rule\tMexico\t1944\tonly\t-\tMay\t1\t0:00\t0\tS\n"+
"Rule\tMexico\t1950\tonly\t-\tFeb\t12\t0:00\t1:00\tD\n"+
"Rule\tMexico\t1950\tonly\t-\tJul\t30\t0:00\t0\tS\n"+
"Rule\tMexico\t1996\t2000\t-\tApr\tSun>=1\t2:00\t1:00\tD\n"+
"Rule\tMexico\t1996\t2000\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Rule\tMexico\t2001\tonly\t-\tMay\tSun>=1\t2:00\t1:00\tD\n"+
"Rule\tMexico\t2001\tonly\t-\tSep\tlastSun\t2:00\t0\tS\n"+
"Rule\tMexico\t2002\tmax\t-\tApr\tSun>=1\t2:00\t1:00\tD\n"+
"Rule\tMexico\t2002\tmax\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Zone America/Cancun\t-5:47:04 -\tLMT\t1922 Jan  1  0:12:56\n"+
"\t\t\t-6:00\t-\tCST\t1981 Dec 23\n"+
"\t\t\t-5:00\tMexico\tE%sT\t1998 Aug  2  2:00\n"+
"\t\t\t-6:00\tMexico\tC%sT\n"+
"Zone America/Merida\t-5:58:28 -\tLMT\t1922 Jan  1  0:01:32\n"+
"\t\t\t-6:00\t-\tCST\t1981 Dec 23\n"+
"\t\t\t-5:00\t-\tEST\t1982 Dec  2\n"+
"\t\t\t-6:00\tMexico\tC%sT\n"+
"Zone America/Matamoros\t-6:40:00 -\tLMT\t1921 Dec 31 23:20:00\n"+
"\t\t\t-6:00\t-\tCST\t1988\n"+
"\t\t\t-6:00\tUS\tC%sT\t1989\n"+
"\t\t\t-6:00\tMexico\tC%sT\t2010\n"+
"\t\t\t-6:00\tUS\tC%sT\n"+
"Zone America/Monterrey\t-6:41:16 -\tLMT\t1921 Dec 31 23:18:44\n"+
"\t\t\t-6:00\t-\tCST\t1988\n"+
"\t\t\t-6:00\tUS\tC%sT\t1989\n"+
"\t\t\t-6:00\tMexico\tC%sT\n"+
"Zone America/Mexico_City -6:36:36 -\tLMT\t1922 Jan  1 0:23:24\n"+
"\t\t\t-7:00\t-\tMST\t1927 Jun 10 23:00\n"+
"\t\t\t-6:00\t-\tCST\t1930 Nov 15\n"+
"\t\t\t-7:00\t-\tMST\t1931 May  1 23:00\n"+
"\t\t\t-6:00\t-\tCST\t1931 Oct\n"+
"\t\t\t-7:00\t-\tMST\t1932 Apr  1\n"+
"\t\t\t-6:00\tMexico\tC%sT\t2001 Sep 30 02:00\n"+
"\t\t\t-6:00\t-\tCST\t2002 Feb 20\n"+
"\t\t\t-6:00\tMexico\tC%sT\n"+
"Zone America/Ojinaga\t-6:57:40 -\tLMT\t1922 Jan 1 0:02:20\n"+
"\t\t\t-7:00\t-\tMST\t1927 Jun 10 23:00\n"+
"\t\t\t-6:00\t-\tCST\t1930 Nov 15\n"+
"\t\t\t-7:00\t-\tMST\t1931 May  1 23:00\n"+
"\t\t\t-6:00\t-\tCST\t1931 Oct\n"+
"\t\t\t-7:00\t-\tMST\t1932 Apr  1\n"+
"\t\t\t-6:00\t-\tCST\t1996\n"+
"\t\t\t-6:00\tMexico\tC%sT\t1998\n"+
"\t\t\t-6:00\t-\tCST\t1998 Apr Sun>=1 3:00\n"+
"\t\t\t-7:00\tMexico\tM%sT\t2010\n"+
"\t\t\t-7:00\tUS\tM%sT\n"+
"Zone America/Chihuahua\t-7:04:20 -\tLMT\t1921 Dec 31 23:55:40\n"+
"\t\t\t-7:00\t-\tMST\t1927 Jun 10 23:00\n"+
"\t\t\t-6:00\t-\tCST\t1930 Nov 15\n"+
"\t\t\t-7:00\t-\tMST\t1931 May  1 23:00\n"+
"\t\t\t-6:00\t-\tCST\t1931 Oct\n"+
"\t\t\t-7:00\t-\tMST\t1932 Apr  1\n"+
"\t\t\t-6:00\t-\tCST\t1996\n"+
"\t\t\t-6:00\tMexico\tC%sT\t1998\n"+
"\t\t\t-6:00\t-\tCST\t1998 Apr Sun>=1 3:00\n"+
"\t\t\t-7:00\tMexico\tM%sT\n"+
"Zone America/Hermosillo\t-7:23:52 -\tLMT\t1921 Dec 31 23:36:08\n"+
"\t\t\t-7:00\t-\tMST\t1927 Jun 10 23:00\n"+
"\t\t\t-6:00\t-\tCST\t1930 Nov 15\n"+
"\t\t\t-7:00\t-\tMST\t1931 May  1 23:00\n"+
"\t\t\t-6:00\t-\tCST\t1931 Oct\n"+
"\t\t\t-7:00\t-\tMST\t1932 Apr  1\n"+
"\t\t\t-6:00\t-\tCST\t1942 Apr 24\n"+
"\t\t\t-7:00\t-\tMST\t1949 Jan 14\n"+
"\t\t\t-8:00\t-\tPST\t1970\n"+
"\t\t\t-7:00\tMexico\tM%sT\t1999\n"+
"\t\t\t-7:00\t-\tMST\n"+
"Zone America/Mazatlan\t-7:05:40 -\tLMT\t1921 Dec 31 23:54:20\n"+
"\t\t\t-7:00\t-\tMST\t1927 Jun 10 23:00\n"+
"\t\t\t-6:00\t-\tCST\t1930 Nov 15\n"+
"\t\t\t-7:00\t-\tMST\t1931 May  1 23:00\n"+
"\t\t\t-6:00\t-\tCST\t1931 Oct\n"+
"\t\t\t-7:00\t-\tMST\t1932 Apr  1\n"+
"\t\t\t-6:00\t-\tCST\t1942 Apr 24\n"+
"\t\t\t-7:00\t-\tMST\t1949 Jan 14\n"+
"\t\t\t-8:00\t-\tPST\t1970\n"+
"\t\t\t-7:00\tMexico\tM%sT\n"+
"Zone America/Bahia_Banderas\t-7:01:00 -\tLMT\t1921 Dec 31 23:59:00\n"+
"\t\t\t-7:00\t-\tMST\t1927 Jun 10 23:00\n"+
"\t\t\t-6:00\t-\tCST\t1930 Nov 15\n"+
"\t\t\t-7:00\t-\tMST\t1931 May  1 23:00\n"+
"\t\t\t-6:00\t-\tCST\t1931 Oct\n"+
"\t\t\t-7:00\t-\tMST\t1932 Apr  1\n"+
"\t\t\t-6:00\t-\tCST\t1942 Apr 24\n"+
"\t\t\t-7:00\t-\tMST\t1949 Jan 14\n"+
"\t\t\t-8:00\t-\tPST\t1970\n"+
"\t\t\t-7:00\tMexico\tM%sT\t2010 Apr 4 2:00\n"+
"\t\t\t-6:00\tMexico\tC%sT\n"+
"Zone America/Tijuana\t-7:48:04 -\tLMT\t1922 Jan  1  0:11:56\n"+
"\t\t\t-7:00\t-\tMST\t1924\n"+
"\t\t\t-8:00\t-\tPST\t1927 Jun 10 23:00\n"+
"\t\t\t-7:00\t-\tMST\t1930 Nov 15\n"+
"\t\t\t-8:00\t-\tPST\t1931 Apr  1\n"+
"\t\t\t-8:00\t1:00\tPDT\t1931 Sep 30\n"+
"\t\t\t-8:00\t-\tPST\t1942 Apr 24\n"+
"\t\t\t-8:00\t1:00\tPWT\t1945 Aug 14 23:00u\n"+
"\t\t\t-8:00\t1:00\tPPT\t1945 Nov 12 # Peace\n"+
"\t\t\t-8:00\t-\tPST\t1948 Apr  5\n"+
"\t\t\t-8:00\t1:00\tPDT\t1949 Jan 14\n"+
"\t\t\t-8:00\t-\tPST\t1954\n"+
"\t\t\t-8:00\tCA\tP%sT\t1961\n"+
"\t\t\t-8:00\t-\tPST\t1976\n"+
"\t\t\t-8:00\tUS\tP%sT\t1996\n"+
"\t\t\t-8:00\tMexico\tP%sT\t2001\n"+
"\t\t\t-8:00\tUS\tP%sT\t2002 Feb 20\n"+
"\t\t\t-8:00\tMexico\tP%sT\t2010\n"+
"\t\t\t-8:00\tUS\tP%sT\n"+
"Zone America/Santa_Isabel\t-7:39:28 -\tLMT\t1922 Jan  1  0:20:32\n"+
"\t\t\t-7:00\t-\tMST\t1924\n"+
"\t\t\t-8:00\t-\tPST\t1927 Jun 10 23:00\n"+
"\t\t\t-7:00\t-\tMST\t1930 Nov 15\n"+
"\t\t\t-8:00\t-\tPST\t1931 Apr  1\n"+
"\t\t\t-8:00\t1:00\tPDT\t1931 Sep 30\n"+
"\t\t\t-8:00\t-\tPST\t1942 Apr 24\n"+
"\t\t\t-8:00\t1:00\tPWT\t1945 Aug 14 23:00u\n"+
"\t\t\t-8:00\t1:00\tPPT\t1945 Nov 12 # Peace\n"+
"\t\t\t-8:00\t-\tPST\t1948 Apr  5\n"+
"\t\t\t-8:00\t1:00\tPDT\t1949 Jan 14\n"+
"\t\t\t-8:00\t-\tPST\t1954\n"+
"\t\t\t-8:00\tCA\tP%sT\t1961\n"+
"\t\t\t-8:00\t-\tPST\t1976\n"+
"\t\t\t-8:00\tUS\tP%sT\t1996\n"+
"\t\t\t-8:00\tMexico\tP%sT\t2001\n"+
"\t\t\t-8:00\tUS\tP%sT\t2002 Feb 20\n"+
"\t\t\t-8:00\tMexico\tP%sT\n"+
"Zone America/Anguilla\t-4:12:16 -\tLMT\t1912 Mar 2\n"+
"\t\t\t-4:00\t-\tAST\n"+
"Zone\tAmerica/Antigua\t-4:07:12 -\tLMT\t1912 Mar 2\n"+
"\t\t\t-5:00\t-\tEST\t1951\n"+
"\t\t\t-4:00\t-\tAST\n"+
"Rule\tBahamas\t1964\t1975\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Rule\tBahamas\t1964\t1975\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Zone\tAmerica/Nassau\t-5:09:24 -\tLMT\t1912 Mar 2\n"+
"\t\t\t-5:00\tBahamas\tE%sT\t1976\n"+
"\t\t\t-5:00\tUS\tE%sT\n"+
"Rule\tBarb\t1977\tonly\t-\tJun\t12\t2:00\t1:00\tD\n"+
"Rule\tBarb\t1977\t1978\t-\tOct\tSun>=1\t2:00\t0\tS\n"+
"Rule\tBarb\t1978\t1980\t-\tApr\tSun>=15\t2:00\t1:00\tD\n"+
"Rule\tBarb\t1979\tonly\t-\tSep\t30\t2:00\t0\tS\n"+
"Rule\tBarb\t1980\tonly\t-\tSep\t25\t2:00\t0\tS\n"+
"Zone America/Barbados\t-3:58:28 -\tLMT\t1924\t\t# Bridgetown\n"+
"\t\t\t-3:58:28 -\tBMT\t1932\t  # Bridgetown Mean Time\n"+
"\t\t\t-4:00\tBarb\tA%sT\n"+
"Rule\tBelize\t1918\t1942\t-\tOct\tSun>=2\t0:00\t0:30\tHD\n"+
"Rule\tBelize\t1919\t1943\t-\tFeb\tSun>=9\t0:00\t0\tS\n"+
"Rule\tBelize\t1973\tonly\t-\tDec\t 5\t0:00\t1:00\tD\n"+
"Rule\tBelize\t1974\tonly\t-\tFeb\t 9\t0:00\t0\tS\n"+
"Rule\tBelize\t1982\tonly\t-\tDec\t18\t0:00\t1:00\tD\n"+
"Rule\tBelize\t1983\tonly\t-\tFeb\t12\t0:00\t0\tS\n"+
"Zone\tAmerica/Belize\t-5:52:48 -\tLMT\t1912 Apr\n"+
"\t\t\t-6:00\tBelize\tC%sT\n"+
"Zone Atlantic/Bermuda\t-4:19:04 -\tLMT\t1930 Jan  1 2:00    # Hamilton\n"+
"\t\t\t-4:00\t-\tAST\t1974 Apr 28 2:00\n"+
"\t\t\t-4:00\tBahamas\tA%sT\t1976\n"+
"\t\t\t-4:00\tUS\tA%sT\n"+
"Zone\tAmerica/Cayman\t-5:25:32 -\tLMT\t1890\t\t# Georgetown\n"+
"\t\t\t-5:07:12 -\tKMT\t1912 Feb    # Kingston Mean Time\n"+
"\t\t\t-5:00\t-\tEST\n"+
"Rule\tCR\t1979\t1980\t-\tFeb\tlastSun\t0:00\t1:00\tD\n"+
"Rule\tCR\t1979\t1980\t-\tJun\tSun>=1\t0:00\t0\tS\n"+
"Rule\tCR\t1991\t1992\t-\tJan\tSat>=15\t0:00\t1:00\tD\n"+
"Rule\tCR\t1991\tonly\t-\tJul\t 1\t0:00\t0\tS\n"+
"Rule\tCR\t1992\tonly\t-\tMar\t15\t0:00\t0\tS\n"+
"Zone America/Costa_Rica\t-5:36:20 -\tLMT\t1890\t\t# San Jose\n"+
"\t\t\t-5:36:20 -\tSJMT\t1921 Jan 15 # San Jose Mean Time\n"+
"\t\t\t-6:00\tCR\tC%sT\n"+
"Rule\tCuba\t1928\tonly\t-\tJun\t10\t0:00\t1:00\tD\n"+
"Rule\tCuba\t1928\tonly\t-\tOct\t10\t0:00\t0\tS\n"+
"Rule\tCuba\t1940\t1942\t-\tJun\tSun>=1\t0:00\t1:00\tD\n"+
"Rule\tCuba\t1940\t1942\t-\tSep\tSun>=1\t0:00\t0\tS\n"+
"Rule\tCuba\t1945\t1946\t-\tJun\tSun>=1\t0:00\t1:00\tD\n"+
"Rule\tCuba\t1945\t1946\t-\tSep\tSun>=1\t0:00\t0\tS\n"+
"Rule\tCuba\t1965\tonly\t-\tJun\t1\t0:00\t1:00\tD\n"+
"Rule\tCuba\t1965\tonly\t-\tSep\t30\t0:00\t0\tS\n"+
"Rule\tCuba\t1966\tonly\t-\tMay\t29\t0:00\t1:00\tD\n"+
"Rule\tCuba\t1966\tonly\t-\tOct\t2\t0:00\t0\tS\n"+
"Rule\tCuba\t1967\tonly\t-\tApr\t8\t0:00\t1:00\tD\n"+
"Rule\tCuba\t1967\t1968\t-\tSep\tSun>=8\t0:00\t0\tS\n"+
"Rule\tCuba\t1968\tonly\t-\tApr\t14\t0:00\t1:00\tD\n"+
"Rule\tCuba\t1969\t1977\t-\tApr\tlastSun\t0:00\t1:00\tD\n"+
"Rule\tCuba\t1969\t1971\t-\tOct\tlastSun\t0:00\t0\tS\n"+
"Rule\tCuba\t1972\t1974\t-\tOct\t8\t0:00\t0\tS\n"+
"Rule\tCuba\t1975\t1977\t-\tOct\tlastSun\t0:00\t0\tS\n"+
"Rule\tCuba\t1978\tonly\t-\tMay\t7\t0:00\t1:00\tD\n"+
"Rule\tCuba\t1978\t1990\t-\tOct\tSun>=8\t0:00\t0\tS\n"+
"Rule\tCuba\t1979\t1980\t-\tMar\tSun>=15\t0:00\t1:00\tD\n"+
"Rule\tCuba\t1981\t1985\t-\tMay\tSun>=5\t0:00\t1:00\tD\n"+
"Rule\tCuba\t1986\t1989\t-\tMar\tSun>=14\t0:00\t1:00\tD\n"+
"Rule\tCuba\t1990\t1997\t-\tApr\tSun>=1\t0:00\t1:00\tD\n"+
"Rule\tCuba\t1991\t1995\t-\tOct\tSun>=8\t0:00s\t0\tS\n"+
"Rule\tCuba\t1996\tonly\t-\tOct\t 6\t0:00s\t0\tS\n"+
"Rule\tCuba\t1997\tonly\t-\tOct\t12\t0:00s\t0\tS\n"+
"Rule\tCuba\t1998\t1999\t-\tMar\tlastSun\t0:00s\t1:00\tD\n"+
"Rule\tCuba\t1998\t2003\t-\tOct\tlastSun\t0:00s\t0\tS\n"+
"Rule\tCuba\t2000\t2004\t-\tApr\tSun>=1\t0:00s\t1:00\tD\n"+
"Rule\tCuba\t2006\t2010\t-\tOct\tlastSun\t0:00s\t0\tS\n"+
"Rule\tCuba\t2007\tonly\t-\tMar\tSun>=8\t0:00s\t1:00\tD\n"+
"Rule\tCuba\t2008\tonly\t-\tMar\tSun>=15\t0:00s\t1:00\tD\n"+
"Rule\tCuba\t2009\t2010\t-\tMar\tSun>=8\t0:00s\t1:00\tD\n"+
"Rule\tCuba\t2011\tonly\t-\tMar\tSun>=15\t0:00s\t1:00\tD\n"+
"Rule\tCuba\t2011\tonly\t-\tNov\t13\t0:00s\t0\tS\n"+
"Rule\tCuba\t2012\tmax\t-\tMar\tSun>=8\t0:00s\t1:00\tD\n"+
"Rule\tCuba\t2012\tmax\t-\tOct\tlastSun\t0:00s\t0\tS\n"+
"Zone\tAmerica/Havana\t-5:29:28 -\tLMT\t1890\n"+
"\t\t\t-5:29:36 -\tHMT\t1925 Jul 19 12:00 # Havana MT\n"+
"\t\t\t-5:00\tCuba\tC%sT\n"+
"Zone America/Dominica\t-4:05:36 -\tLMT\t1911 Jul 1 0:01\t\t# Roseau\n"+
"\t\t\t-4:00\t-\tAST\n"+
"Rule\tDR\t1966\tonly\t-\tOct\t30\t0:00\t1:00\tD\n"+
"Rule\tDR\t1967\tonly\t-\tFeb\t28\t0:00\t0\tS\n"+
"Rule\tDR\t1969\t1973\t-\tOct\tlastSun\t0:00\t0:30\tHD\n"+
"Rule\tDR\t1970\tonly\t-\tFeb\t21\t0:00\t0\tS\n"+
"Rule\tDR\t1971\tonly\t-\tJan\t20\t0:00\t0\tS\n"+
"Rule\tDR\t1972\t1974\t-\tJan\t21\t0:00\t0\tS\n"+
"Zone America/Santo_Domingo -4:39:36 -\tLMT\t1890\n"+
"\t\t\t-4:40\t-\tSDMT\t1933 Apr  1 12:00 # S. Dom. MT\n"+
"\t\t\t-5:00\tDR\tE%sT\t1974 Oct 27\n"+
"\t\t\t-4:00\t-\tAST\t2000 Oct 29 02:00\n"+
"\t\t\t-5:00\tUS\tE%sT\t2000 Dec  3 01:00\n"+
"\t\t\t-4:00\t-\tAST\n"+
"Rule\tSalv\t1987\t1988\t-\tMay\tSun>=1\t0:00\t1:00\tD\n"+
"Rule\tSalv\t1987\t1988\t-\tSep\tlastSun\t0:00\t0\tS\n"+
"Zone America/El_Salvador -5:56:48 -\tLMT\t1921\t\t# San Salvador\n"+
"\t\t\t-6:00\tSalv\tC%sT\n"+
"Zone\tAmerica/Grenada\t-4:07:00 -\tLMT\t1911 Jul\t# St George's\n"+
"\t\t\t-4:00\t-\tAST\n"+
"Zone America/Guadeloupe\t-4:06:08 -\tLMT\t1911 Jun 8\t# Pointe a Pitre\n"+
"\t\t\t-4:00\t-\tAST\n"+
"Link America/Guadeloupe\tAmerica/St_Barthelemy\n"+
"Link America/Guadeloupe\tAmerica/Marigot\n"+
"Rule\tGuat\t1973\tonly\t-\tNov\t25\t0:00\t1:00\tD\n"+
"Rule\tGuat\t1974\tonly\t-\tFeb\t24\t0:00\t0\tS\n"+
"Rule\tGuat\t1983\tonly\t-\tMay\t21\t0:00\t1:00\tD\n"+
"Rule\tGuat\t1983\tonly\t-\tSep\t22\t0:00\t0\tS\n"+
"Rule\tGuat\t1991\tonly\t-\tMar\t23\t0:00\t1:00\tD\n"+
"Rule\tGuat\t1991\tonly\t-\tSep\t 7\t0:00\t0\tS\n"+
"Rule\tGuat\t2006\tonly\t-\tApr\t30\t0:00\t1:00\tD\n"+
"Rule\tGuat\t2006\tonly\t-\tOct\t 1\t0:00\t0\tS\n"+
"Zone America/Guatemala\t-6:02:04 -\tLMT\t1918 Oct 5\n"+
"\t\t\t-6:00\tGuat\tC%sT\n"+
"Rule\tHaiti\t1983\tonly\t-\tMay\t8\t0:00\t1:00\tD\n"+
"Rule\tHaiti\t1984\t1987\t-\tApr\tlastSun\t0:00\t1:00\tD\n"+
"Rule\tHaiti\t1983\t1987\t-\tOct\tlastSun\t0:00\t0\tS\n"+
"Rule\tHaiti\t1988\t1997\t-\tApr\tSun>=1\t1:00s\t1:00\tD\n"+
"Rule\tHaiti\t1988\t1997\t-\tOct\tlastSun\t1:00s\t0\tS\n"+
"Rule\tHaiti\t2005\t2006\t-\tApr\tSun>=1\t0:00\t1:00\tD\n"+
"Rule\tHaiti\t2005\t2006\t-\tOct\tlastSun\t0:00\t0\tS\n"+
"Zone America/Port-au-Prince -4:49:20 -\tLMT\t1890\n"+
"\t\t\t-4:49\t-\tPPMT\t1917 Jan 24 12:00 # P-a-P MT\n"+
"\t\t\t-5:00\tHaiti\tE%sT\n"+
"Rule\tHond\t1987\t1988\t-\tMay\tSun>=1\t0:00\t1:00\tD\n"+
"Rule\tHond\t1987\t1988\t-\tSep\tlastSun\t0:00\t0\tS\n"+
"Rule\tHond\t2006\tonly\t-\tMay\tSun>=1\t0:00\t1:00\tD\n"+
"Rule\tHond\t2006\tonly\t-\tAug\tMon>=1\t0:00\t0\tS\n"+
"Zone America/Tegucigalpa -5:48:52 -\tLMT\t1921 Apr\n"+
"\t\t\t-6:00\tHond\tC%sT\n"+
"Zone\tAmerica/Jamaica\t-5:07:12 -\tLMT\t1890\t\t# Kingston\n"+
"\t\t\t-5:07:12 -\tKMT\t1912 Feb    # Kingston Mean Time\n"+
"\t\t\t-5:00\t-\tEST\t1974 Apr 28 2:00\n"+
"\t\t\t-5:00\tUS\tE%sT\t1984\n"+
"\t\t\t-5:00\t-\tEST\n"+
"Zone America/Martinique\t-4:04:20 -      LMT\t1890\t\t# Fort-de-France\n"+
"\t\t\t-4:04:20 -\tFFMT\t1911 May     # Fort-de-France MT\n"+
"\t\t\t-4:00\t-\tAST\t1980 Apr  6\n"+
"\t\t\t-4:00\t1:00\tADT\t1980 Sep 28\n"+
"\t\t\t-4:00\t-\tAST\n"+
"Zone America/Montserrat\t-4:08:52 -\tLMT\t1911 Jul 1 0:01   # Cork Hill\n"+
"\t\t\t-4:00\t-\tAST\n"+
"Rule\tNic\t1979\t1980\t-\tMar\tSun>=16\t0:00\t1:00\tD\n"+
"Rule\tNic\t1979\t1980\t-\tJun\tMon>=23\t0:00\t0\tS\n"+
"Rule\tNic\t2005\tonly\t-\tApr\t10\t0:00\t1:00\tD\n"+
"Rule\tNic\t2005\tonly\t-\tOct\tSun>=1\t0:00\t0\tS\n"+
"Rule\tNic\t2006\tonly\t-\tApr\t30\t2:00\t1:00\tD\n"+
"Rule\tNic\t2006\tonly\t-\tOct\tSun>=1\t1:00\t0\tS\n"+
"Zone\tAmerica/Managua\t-5:45:08 -\tLMT\t1890\n"+
"\t\t\t-5:45:12 -\tMMT\t1934 Jun 23 # Managua Mean Time?\n"+
"\t\t\t-6:00\t-\tCST\t1973 May\n"+
"\t\t\t-5:00\t-\tEST\t1975 Feb 16\n"+
"\t\t\t-6:00\tNic\tC%sT\t1992 Jan  1 4:00\n"+
"\t\t\t-5:00\t-\tEST\t1992 Sep 24\n"+
"\t\t\t-6:00\t-\tCST\t1993\n"+
"\t\t\t-5:00\t-\tEST\t1997\n"+
"\t\t\t-6:00\tNic\tC%sT\n"+
"Zone\tAmerica/Panama\t-5:18:08 -\tLMT\t1890\n"+
"\t\t\t-5:19:36 -\tCMT\t1908 Apr 22   # Colon Mean Time\n"+
"\t\t\t-5:00\t-\tEST\n"+
"Zone America/Puerto_Rico -4:24:25 -\tLMT\t1899 Mar 28 12:00    # San Juan\n"+
"\t\t\t-4:00\t-\tAST\t1942 May  3\n"+
"\t\t\t-4:00\tUS\tA%sT\t1946\n"+
"\t\t\t-4:00\t-\tAST\n"+
"Zone America/St_Kitts\t-4:10:52 -\tLMT\t1912 Mar 2\t# Basseterre\n"+
"\t\t\t-4:00\t-\tAST\n"+
"Zone America/St_Lucia\t-4:04:00 -\tLMT\t1890\t\t# Castries\n"+
"\t\t\t-4:04:00 -\tCMT\t1912\t    # Castries Mean Time\n"+
"\t\t\t-4:00\t-\tAST\n"+
"Zone America/Miquelon\t-3:44:40 -\tLMT\t1911 May 15\t# St Pierre\n"+
"\t\t\t-4:00\t-\tAST\t1980 May\n"+
"\t\t\t-3:00\t-\tPMST\t1987 # Pierre & Miquelon Time\n"+
"\t\t\t-3:00\tCanada\tPM%sT\n"+
"Zone America/St_Vincent\t-4:04:56 -\tLMT\t1890\t\t# Kingstown\n"+
"\t\t\t-4:04:56 -\tKMT\t1912\t   # Kingstown Mean Time\n"+
"\t\t\t-4:00\t-\tAST\n"+
"Rule\tTC\t1979\t1986\t-\tApr\tlastSun\t2:00\t1:00\tD\n"+
"Rule\tTC\t1979\t2006\t-\tOct\tlastSun\t2:00\t0\tS\n"+
"Rule\tTC\t1987\t2006\t-\tApr\tSun>=1\t2:00\t1:00\tD\n"+
"Rule\tTC\t2007\tmax\t-\tMar\tSun>=8\t2:00\t1:00\tD\n"+
"Rule\tTC\t2007\tmax\t-\tNov\tSun>=1\t2:00\t0\tS\n"+
"Zone America/Grand_Turk\t-4:44:32 -\tLMT\t1890\n"+
"\t\t\t-5:07:12 -\tKMT\t1912 Feb    # Kingston Mean Time\n"+
"\t\t\t-5:00\tTC\tE%sT\n"+
"Zone America/Tortola\t-4:18:28 -\tLMT\t1911 Jul    # Road Town\n"+
"\t\t\t-4:00\t-\tAST\n"+
"Zone America/St_Thomas\t-4:19:44 -\tLMT\t1911 Jul    # Charlotte Amalie\n"+
"\t\t\t-4:00\t-\tAST\n"+
"","tz/pacificnew":"Link\tAmerica/Los_Angeles\tUS/Pacific-New\t##\n"+
"","tz/southamerica":"Rule\tArg\t1930\tonly\t-\tDec\t 1\t0:00\t1:00\tS\n"+
"Rule\tArg\t1931\tonly\t-\tApr\t 1\t0:00\t0\t-\n"+
"Rule\tArg\t1931\tonly\t-\tOct\t15\t0:00\t1:00\tS\n"+
"Rule\tArg\t1932\t1940\t-\tMar\t 1\t0:00\t0\t-\n"+
"Rule\tArg\t1932\t1939\t-\tNov\t 1\t0:00\t1:00\tS\n"+
"Rule\tArg\t1940\tonly\t-\tJul\t 1\t0:00\t1:00\tS\n"+
"Rule\tArg\t1941\tonly\t-\tJun\t15\t0:00\t0\t-\n"+
"Rule\tArg\t1941\tonly\t-\tOct\t15\t0:00\t1:00\tS\n"+
"Rule\tArg\t1943\tonly\t-\tAug\t 1\t0:00\t0\t-\n"+
"Rule\tArg\t1943\tonly\t-\tOct\t15\t0:00\t1:00\tS\n"+
"Rule\tArg\t1946\tonly\t-\tMar\t 1\t0:00\t0\t-\n"+
"Rule\tArg\t1946\tonly\t-\tOct\t 1\t0:00\t1:00\tS\n"+
"Rule\tArg\t1963\tonly\t-\tOct\t 1\t0:00\t0\t-\n"+
"Rule\tArg\t1963\tonly\t-\tDec\t15\t0:00\t1:00\tS\n"+
"Rule\tArg\t1964\t1966\t-\tMar\t 1\t0:00\t0\t-\n"+
"Rule\tArg\t1964\t1966\t-\tOct\t15\t0:00\t1:00\tS\n"+
"Rule\tArg\t1967\tonly\t-\tApr\t 2\t0:00\t0\t-\n"+
"Rule\tArg\t1967\t1968\t-\tOct\tSun>=1\t0:00\t1:00\tS\n"+
"Rule\tArg\t1968\t1969\t-\tApr\tSun>=1\t0:00\t0\t-\n"+
"Rule\tArg\t1974\tonly\t-\tJan\t23\t0:00\t1:00\tS\n"+
"Rule\tArg\t1974\tonly\t-\tMay\t 1\t0:00\t0\t-\n"+
"Rule\tArg\t1988\tonly\t-\tDec\t 1\t0:00\t1:00\tS\n"+
"Rule\tArg\t1989\t1993\t-\tMar\tSun>=1\t0:00\t0\t-\n"+
"Rule\tArg\t1989\t1992\t-\tOct\tSun>=15\t0:00\t1:00\tS\n"+
"Rule\tArg\t1999\tonly\t-\tOct\tSun>=1\t0:00\t1:00\tS\n"+
"Rule\tArg\t2000\tonly\t-\tMar\t3\t0:00\t0\t-\n"+
"Rule\tArg\t2007\tonly\t-\tDec\t30\t0:00\t1:00\tS\n"+
"Rule\tArg\t2008\t2009\t-\tMar\tSun>=15\t0:00\t0\t-\n"+
"Rule\tArg\t2008\tonly\t-\tOct\tSun>=15\t0:00\t1:00\tS\n"+
" \n"+
"Zone America/Argentina/Buenos_Aires -3:53:48 - LMT 1894 Oct 31\n"+
"\t\t\t-4:16:48 -\tCMT\t1920 May # Cordoba Mean Time\n"+
"\t\t\t-4:00\t-\tART\t1930 Dec\n"+
"\t\t\t-4:00\tArg\tAR%sT\t1969 Oct  5\n"+
"\t\t\t-3:00\tArg\tAR%sT\t1999 Oct  3\n"+
"\t\t\t-4:00\tArg\tAR%sT\t2000 Mar  3\n"+
"\t\t\t-3:00\tArg\tAR%sT\n"+
"Zone America/Argentina/Cordoba -4:16:48 - LMT\t1894 Oct 31\n"+
"\t\t\t-4:16:48 -\tCMT\t1920 May\n"+
"\t\t\t-4:00\t-\tART\t1930 Dec\n"+
"\t\t\t-4:00\tArg\tAR%sT\t1969 Oct  5\n"+
"\t\t\t-3:00\tArg\tAR%sT\t1991 Mar  3\n"+
"\t\t\t-4:00\t-\tWART\t1991 Oct 20\n"+
"\t\t\t-3:00\tArg\tAR%sT\t1999 Oct  3\n"+
"\t\t\t-4:00\tArg\tAR%sT\t2000 Mar  3\n"+
"\t\t\t-3:00\tArg\tAR%sT\n"+
"Zone America/Argentina/Salta -4:21:40 - LMT\t1894 Oct 31\n"+
"\t\t\t-4:16:48 -\tCMT\t1920 May\n"+
"\t\t\t-4:00\t-\tART\t1930 Dec\n"+
"\t\t\t-4:00\tArg\tAR%sT\t1969 Oct  5\n"+
"\t\t\t-3:00\tArg\tAR%sT\t1991 Mar  3\n"+
"\t\t\t-4:00\t-\tWART\t1991 Oct 20\n"+
"\t\t\t-3:00\tArg\tAR%sT\t1999 Oct  3\n"+
"\t\t\t-4:00\tArg\tAR%sT\t2000 Mar  3\n"+
"\t\t\t-3:00\tArg\tAR%sT\t2008 Oct 18\n"+
"\t\t\t-3:00\t-\tART\n"+
"Zone America/Argentina/Tucuman -4:20:52 - LMT\t1894 Oct 31\n"+
"\t\t\t-4:16:48 -\tCMT\t1920 May\n"+
"\t\t\t-4:00\t-\tART\t1930 Dec\n"+
"\t\t\t-4:00\tArg\tAR%sT\t1969 Oct  5\n"+
"\t\t\t-3:00\tArg\tAR%sT\t1991 Mar  3\n"+
"\t\t\t-4:00\t-\tWART\t1991 Oct 20\n"+
"\t\t\t-3:00\tArg\tAR%sT\t1999 Oct  3\n"+
"\t\t\t-4:00\tArg\tAR%sT\t2000 Mar  3\n"+
"\t\t\t-3:00\t-\tART\t2004 Jun  1\n"+
"\t\t\t-4:00\t-\tWART\t2004 Jun 13\n"+
"\t\t\t-3:00\tArg\tAR%sT\n"+
"Zone America/Argentina/La_Rioja -4:27:24 - LMT\t1894 Oct 31\n"+
"\t\t\t-4:16:48 -\tCMT\t1920 May\n"+
"\t\t\t-4:00\t-\tART\t1930 Dec\n"+
"\t\t\t-4:00\tArg\tAR%sT\t1969 Oct  5\n"+
"\t\t\t-3:00\tArg\tAR%sT\t1991 Mar  1\n"+
"\t\t\t-4:00\t-\tWART\t1991 May  7\n"+
"\t\t\t-3:00\tArg\tAR%sT\t1999 Oct  3\n"+
"\t\t\t-4:00\tArg\tAR%sT\t2000 Mar  3\n"+
"\t\t\t-3:00\t-\tART\t2004 Jun  1\n"+
"\t\t\t-4:00\t-\tWART\t2004 Jun 20\n"+
"\t\t\t-3:00\tArg\tAR%sT\t2008 Oct 18\n"+
"\t\t\t-3:00\t-\tART\n"+
"Zone America/Argentina/San_Juan -4:34:04 - LMT\t1894 Oct 31\n"+
"\t\t\t-4:16:48 -\tCMT\t1920 May\n"+
"\t\t\t-4:00\t-\tART\t1930 Dec\n"+
"\t\t\t-4:00\tArg\tAR%sT\t1969 Oct  5\n"+
"\t\t\t-3:00\tArg\tAR%sT\t1991 Mar  1\n"+
"\t\t\t-4:00\t-\tWART\t1991 May  7\n"+
"\t\t\t-3:00\tArg\tAR%sT\t1999 Oct  3\n"+
"\t\t\t-4:00\tArg\tAR%sT\t2000 Mar  3\n"+
"\t\t\t-3:00\t-\tART\t2004 May 31\n"+
"\t\t\t-4:00\t-\tWART\t2004 Jul 25\n"+
"\t\t\t-3:00\tArg\tAR%sT\t2008 Oct 18\n"+
"\t\t\t-3:00\t-\tART\n"+
"Zone America/Argentina/Jujuy -4:21:12 -\tLMT\t1894 Oct 31\n"+
"\t\t\t-4:16:48 -\tCMT\t1920 May\n"+
"\t\t\t-4:00\t-\tART\t1930 Dec\n"+
"\t\t\t-4:00\tArg\tAR%sT\t1969 Oct  5\n"+
"\t\t\t-3:00\tArg\tAR%sT\t1990 Mar  4\n"+
"\t\t\t-4:00\t-\tWART\t1990 Oct 28\n"+
"\t\t\t-4:00\t1:00\tWARST\t1991 Mar 17\n"+
"\t\t\t-4:00\t-\tWART\t1991 Oct  6\n"+
"\t\t\t-3:00\t1:00\tARST\t1992\n"+
"\t\t\t-3:00\tArg\tAR%sT\t1999 Oct  3\n"+
"\t\t\t-4:00\tArg\tAR%sT\t2000 Mar  3\n"+
"\t\t\t-3:00\tArg\tAR%sT\t2008 Oct 18\n"+
"\t\t\t-3:00\t-\tART\n"+
"Zone America/Argentina/Catamarca -4:23:08 - LMT\t1894 Oct 31\n"+
"\t\t\t-4:16:48 -\tCMT\t1920 May\n"+
"\t\t\t-4:00\t-\tART\t1930 Dec\n"+
"\t\t\t-4:00\tArg\tAR%sT\t1969 Oct  5\n"+
"\t\t\t-3:00\tArg\tAR%sT\t1991 Mar  3\n"+
"\t\t\t-4:00\t-\tWART\t1991 Oct 20\n"+
"\t\t\t-3:00\tArg\tAR%sT\t1999 Oct  3\n"+
"\t\t\t-4:00\tArg\tAR%sT\t2000 Mar  3\n"+
"\t\t\t-3:00\t-\tART\t2004 Jun  1\n"+
"\t\t\t-4:00\t-\tWART\t2004 Jun 20\n"+
"\t\t\t-3:00\tArg\tAR%sT\t2008 Oct 18\n"+
"\t\t\t-3:00\t-\tART\n"+
"Zone America/Argentina/Mendoza -4:35:16 - LMT\t1894 Oct 31\n"+
"\t\t\t-4:16:48 -\tCMT\t1920 May\n"+
"\t\t\t-4:00\t-\tART\t1930 Dec\n"+
"\t\t\t-4:00\tArg\tAR%sT\t1969 Oct  5\n"+
"\t\t\t-3:00\tArg\tAR%sT\t1990 Mar  4\n"+
"\t\t\t-4:00\t-\tWART\t1990 Oct 15\n"+
"\t\t\t-4:00\t1:00\tWARST\t1991 Mar  1\n"+
"\t\t\t-4:00\t-\tWART\t1991 Oct 15\n"+
"\t\t\t-4:00\t1:00\tWARST\t1992 Mar  1\n"+
"\t\t\t-4:00\t-\tWART\t1992 Oct 18\n"+
"\t\t\t-3:00\tArg\tAR%sT\t1999 Oct  3\n"+
"\t\t\t-4:00\tArg\tAR%sT\t2000 Mar  3\n"+
"\t\t\t-3:00\t-\tART\t2004 May 23\n"+
"\t\t\t-4:00\t-\tWART\t2004 Sep 26\n"+
"\t\t\t-3:00\tArg\tAR%sT\t2008 Oct 18\n"+
"\t\t\t-3:00\t-\tART\n"+
"Rule\tSanLuis\t2008\t2009\t-\tMar\tSun>=8\t0:00\t0\t-\n"+
"Rule\tSanLuis\t2007\t2009\t-\tOct\tSun>=8\t0:00\t1:00\tS\n"+
"Zone America/Argentina/San_Luis -4:25:24 - LMT\t1894 Oct 31\n"+
"\t\t\t-4:16:48 -\tCMT\t1920 May\n"+
"\t\t\t-4:00\t-\tART\t1930 Dec\n"+
"\t\t\t-4:00\tArg\tAR%sT\t1969 Oct  5\n"+
"\t\t\t-3:00\tArg\tAR%sT\t1990\n"+
"\t\t\t-3:00\t1:00\tARST\t1990 Mar 14\n"+
"\t\t\t-4:00\t-\tWART\t1990 Oct 15\n"+
"\t\t\t-4:00\t1:00\tWARST\t1991 Mar  1\n"+
"\t\t\t-4:00\t-\tWART\t1991 Jun  1\n"+
"\t\t\t-3:00\t-\tART\t1999 Oct  3\n"+
"\t\t\t-4:00\t1:00\tWARST\t2000 Mar  3\n"+
"\t\t\t-3:00\t-\tART\t2004 May 31\n"+
"\t\t\t-4:00\t-\tWART\t2004 Jul 25\n"+
"\t\t\t-3:00\tArg\tAR%sT\t2008 Jan 21\n"+
"\t\t\t-4:00\tSanLuis\tWAR%sT\n"+
"Zone America/Argentina/Rio_Gallegos -4:36:52 - LMT 1894 Oct 31\n"+
"\t\t\t-4:16:48 -\tCMT\t1920 May # Cordoba Mean Time\n"+
"\t\t\t-4:00\t-\tART\t1930 Dec\n"+
"\t\t\t-4:00\tArg\tAR%sT\t1969 Oct  5\n"+
"\t\t\t-3:00\tArg\tAR%sT\t1999 Oct  3\n"+
"\t\t\t-4:00\tArg\tAR%sT\t2000 Mar  3\n"+
"\t\t\t-3:00\t-\tART\t2004 Jun  1\n"+
"\t\t\t-4:00\t-\tWART\t2004 Jun 20\n"+
"\t\t\t-3:00\tArg\tAR%sT\t2008 Oct 18\n"+
"\t\t\t-3:00\t-\tART\n"+
"Zone America/Argentina/Ushuaia -4:33:12 - LMT 1894 Oct 31\n"+
"\t\t\t-4:16:48 -\tCMT\t1920 May # Cordoba Mean Time\n"+
"\t\t\t-4:00\t-\tART\t1930 Dec\n"+
"\t\t\t-4:00\tArg\tAR%sT\t1969 Oct  5\n"+
"\t\t\t-3:00\tArg\tAR%sT\t1999 Oct  3\n"+
"\t\t\t-4:00\tArg\tAR%sT\t2000 Mar  3\n"+
"\t\t\t-3:00\t-\tART\t2004 May 30\n"+
"\t\t\t-4:00\t-\tWART\t2004 Jun 20\n"+
"\t\t\t-3:00\tArg\tAR%sT\t2008 Oct 18\n"+
"\t\t\t-3:00\t-\tART\n"+
"Zone\tAmerica/Aruba\t-4:40:24 -\tLMT\t1912 Feb 12\t# Oranjestad\n"+
"\t\t\t-4:30\t-\tANT\t1965 # Netherlands Antilles Time\n"+
"\t\t\t-4:00\t-\tAST\n"+
"Zone\tAmerica/La_Paz\t-4:32:36 -\tLMT\t1890\n"+
"\t\t\t-4:32:36 -\tCMT\t1931 Oct 15 # Calamarca MT\n"+
"\t\t\t-4:32:36 1:00\tBOST\t1932 Mar 21 # Bolivia ST\n"+
"\t\t\t-4:00\t-\tBOT\t# Bolivia Time\n"+
"Rule\tBrazil\t1931\tonly\t-\tOct\t 3\t11:00\t1:00\tS\n"+
"Rule\tBrazil\t1932\t1933\t-\tApr\t 1\t 0:00\t0\t-\n"+
"Rule\tBrazil\t1932\tonly\t-\tOct\t 3\t 0:00\t1:00\tS\n"+
"Rule\tBrazil\t1949\t1952\t-\tDec\t 1\t 0:00\t1:00\tS\n"+
"Rule\tBrazil\t1950\tonly\t-\tApr\t16\t 1:00\t0\t-\n"+
"Rule\tBrazil\t1951\t1952\t-\tApr\t 1\t 0:00\t0\t-\n"+
"Rule\tBrazil\t1953\tonly\t-\tMar\t 1\t 0:00\t0\t-\n"+
"Rule\tBrazil\t1963\tonly\t-\tDec\t 9\t 0:00\t1:00\tS\n"+
"Rule\tBrazil\t1964\tonly\t-\tMar\t 1\t 0:00\t0\t-\n"+
"Rule\tBrazil\t1965\tonly\t-\tJan\t31\t 0:00\t1:00\tS\n"+
"Rule\tBrazil\t1965\tonly\t-\tMar\t31\t 0:00\t0\t-\n"+
"Rule\tBrazil\t1965\tonly\t-\tDec\t 1\t 0:00\t1:00\tS\n"+
"Rule\tBrazil\t1966\t1968\t-\tMar\t 1\t 0:00\t0\t-\n"+
"Rule\tBrazil\t1966\t1967\t-\tNov\t 1\t 0:00\t1:00\tS\n"+
"Rule\tBrazil\t1985\tonly\t-\tNov\t 2\t 0:00\t1:00\tS\n"+
"Rule\tBrazil\t1986\tonly\t-\tMar\t15\t 0:00\t0\t-\n"+
"Rule\tBrazil\t1986\tonly\t-\tOct\t25\t 0:00\t1:00\tS\n"+
"Rule\tBrazil\t1987\tonly\t-\tFeb\t14\t 0:00\t0\t-\n"+
"Rule\tBrazil\t1987\tonly\t-\tOct\t25\t 0:00\t1:00\tS\n"+
"Rule\tBrazil\t1988\tonly\t-\tFeb\t 7\t 0:00\t0\t-\n"+
"Rule\tBrazil\t1988\tonly\t-\tOct\t16\t 0:00\t1:00\tS\n"+
"Rule\tBrazil\t1989\tonly\t-\tJan\t29\t 0:00\t0\t-\n"+
"Rule\tBrazil\t1989\tonly\t-\tOct\t15\t 0:00\t1:00\tS\n"+
"Rule\tBrazil\t1990\tonly\t-\tFeb\t11\t 0:00\t0\t-\n"+
"Rule\tBrazil\t1990\tonly\t-\tOct\t21\t 0:00\t1:00\tS\n"+
"Rule\tBrazil\t1991\tonly\t-\tFeb\t17\t 0:00\t0\t-\n"+
"Rule\tBrazil\t1991\tonly\t-\tOct\t20\t 0:00\t1:00\tS\n"+
"Rule\tBrazil\t1992\tonly\t-\tFeb\t 9\t 0:00\t0\t-\n"+
"Rule\tBrazil\t1992\tonly\t-\tOct\t25\t 0:00\t1:00\tS\n"+
"Rule\tBrazil\t1993\tonly\t-\tJan\t31\t 0:00\t0\t-\n"+
"Rule\tBrazil\t1993\t1995\t-\tOct\tSun>=11\t 0:00\t1:00\tS\n"+
"Rule\tBrazil\t1994\t1995\t-\tFeb\tSun>=15\t 0:00\t0\t-\n"+
"Rule\tBrazil\t1996\tonly\t-\tFeb\t11\t 0:00\t0\t-\n"+
"Rule\tBrazil\t1996\tonly\t-\tOct\t 6\t 0:00\t1:00\tS\n"+
"Rule\tBrazil\t1997\tonly\t-\tFeb\t16\t 0:00\t0\t-\n"+
"Rule\tBrazil\t1997\tonly\t-\tOct\t 6\t 0:00\t1:00\tS\n"+
"Rule\tBrazil\t1998\tonly\t-\tMar\t 1\t 0:00\t0\t-\n"+
"Rule\tBrazil\t1998\tonly\t-\tOct\t11\t 0:00\t1:00\tS\n"+
"Rule\tBrazil\t1999\tonly\t-\tFeb\t21\t 0:00\t0\t-\n"+
"Rule\tBrazil\t1999\tonly\t-\tOct\t 3\t 0:00\t1:00\tS\n"+
"Rule\tBrazil\t2000\tonly\t-\tFeb\t27\t 0:00\t0\t-\n"+
"Rule\tBrazil\t2000\t2001\t-\tOct\tSun>=8\t 0:00\t1:00\tS\n"+
"Rule\tBrazil\t2001\t2006\t-\tFeb\tSun>=15\t 0:00\t0\t-\n"+
"Rule\tBrazil\t2002\tonly\t-\tNov\t 3\t 0:00\t1:00\tS\n"+
"Rule\tBrazil\t2003\tonly\t-\tOct\t19\t 0:00\t1:00\tS\n"+
"Rule\tBrazil\t2004\tonly\t-\tNov\t 2\t 0:00\t1:00\tS\n"+
"Rule\tBrazil\t2005\tonly\t-\tOct\t16\t 0:00\t1:00\tS\n"+
"Rule\tBrazil\t2006\tonly\t-\tNov\t 5\t 0:00\t1:00\tS\n"+
"Rule\tBrazil\t2007\tonly\t-\tFeb\t25\t 0:00\t0\t-\n"+
"Rule\tBrazil\t2007\tonly\t-\tOct\tSun>=8\t 0:00\t1:00\tS\n"+
"Rule\tBrazil\t2008\tmax\t-\tOct\tSun>=15\t0:00\t1:00\tS\n"+
"Rule\tBrazil\t2008\t2011\t-\tFeb\tSun>=15\t0:00\t0\t-\n"+
"Rule\tBrazil\t2012\tonly\t-\tFeb\tSun>=22\t0:00\t0\t-\n"+
"Rule\tBrazil\t2013\t2014\t-\tFeb\tSun>=15\t0:00\t0\t-\n"+
"Rule\tBrazil\t2015\tonly\t-\tFeb\tSun>=22\t0:00\t0\t-\n"+
"Rule\tBrazil\t2016\t2022\t-\tFeb\tSun>=15\t0:00\t0\t-\n"+
"Rule\tBrazil\t2023\tonly\t-\tFeb\tSun>=22\t0:00\t0\t-\n"+
"Rule\tBrazil\t2024\t2025\t-\tFeb\tSun>=15\t0:00\t0\t-\n"+
"Rule\tBrazil\t2026\tonly\t-\tFeb\tSun>=22\t0:00\t0\t-\n"+
"Rule\tBrazil\t2027\t2033\t-\tFeb\tSun>=15\t0:00\t0\t-\n"+
"Rule\tBrazil\t2034\tonly\t-\tFeb\tSun>=22\t0:00\t0\t-\n"+
"Rule\tBrazil\t2035\t2036\t-\tFeb\tSun>=15\t0:00\t0\t-\n"+
"Rule\tBrazil\t2037\tonly\t-\tFeb\tSun>=22\t0:00\t0\t-\n"+
"Rule\tBrazil\t2038\tmax\t-\tFeb\tSun>=15\t0:00\t0\t-\n"+
"Zone America/Noronha\t-2:09:40 -\tLMT\t1914\n"+
"\t\t\t-2:00\tBrazil\tFN%sT\t1990 Sep 17\n"+
"\t\t\t-2:00\t-\tFNT\t1999 Sep 30\n"+
"\t\t\t-2:00\tBrazil\tFN%sT\t2000 Oct 15\n"+
"\t\t\t-2:00\t-\tFNT\t2001 Sep 13\n"+
"\t\t\t-2:00\tBrazil\tFN%sT\t2002 Oct  1\n"+
"\t\t\t-2:00\t-\tFNT\n"+
"Zone America/Belem\t-3:13:56 -\tLMT\t1914\n"+
"\t\t\t-3:00\tBrazil\tBR%sT\t1988 Sep 12\n"+
"\t\t\t-3:00\t-\tBRT\n"+
"Zone America/Santarem\t-3:38:48 -\tLMT\t1914\n"+
"\t\t\t-4:00\tBrazil\tAM%sT\t1988 Sep 12\n"+
"\t\t\t-4:00\t-\tAMT\t2008 Jun 24 00:00\n"+
"\t\t\t-3:00\t-\tBRT\n"+
"Zone America/Fortaleza\t-2:34:00 -\tLMT\t1914\n"+
"\t\t\t-3:00\tBrazil\tBR%sT\t1990 Sep 17\n"+
"\t\t\t-3:00\t-\tBRT\t1999 Sep 30\n"+
"\t\t\t-3:00\tBrazil\tBR%sT\t2000 Oct 22\n"+
"\t\t\t-3:00\t-\tBRT\t2001 Sep 13\n"+
"\t\t\t-3:00\tBrazil\tBR%sT\t2002 Oct  1\n"+
"\t\t\t-3:00\t-\tBRT\n"+
"Zone America/Recife\t-2:19:36 -\tLMT\t1914\n"+
"\t\t\t-3:00\tBrazil\tBR%sT\t1990 Sep 17\n"+
"\t\t\t-3:00\t-\tBRT\t1999 Sep 30\n"+
"\t\t\t-3:00\tBrazil\tBR%sT\t2000 Oct 15\n"+
"\t\t\t-3:00\t-\tBRT\t2001 Sep 13\n"+
"\t\t\t-3:00\tBrazil\tBR%sT\t2002 Oct  1\n"+
"\t\t\t-3:00\t-\tBRT\n"+
"Zone America/Araguaina\t-3:12:48 -\tLMT\t1914\n"+
"\t\t\t-3:00\tBrazil\tBR%sT\t1990 Sep 17\n"+
"\t\t\t-3:00\t-\tBRT\t1995 Sep 14\n"+
"\t\t\t-3:00\tBrazil\tBR%sT\t2003 Sep 24\n"+
"\t\t\t-3:00\t-\tBRT\n"+
"Zone America/Maceio\t-2:22:52 -\tLMT\t1914\n"+
"\t\t\t-3:00\tBrazil\tBR%sT\t1990 Sep 17\n"+
"\t\t\t-3:00\t-\tBRT\t1995 Oct 13\n"+
"\t\t\t-3:00\tBrazil\tBR%sT\t1996 Sep  4\n"+
"\t\t\t-3:00\t-\tBRT\t1999 Sep 30\n"+
"\t\t\t-3:00\tBrazil\tBR%sT\t2000 Oct 22\n"+
"\t\t\t-3:00\t-\tBRT\t2001 Sep 13\n"+
"\t\t\t-3:00\tBrazil\tBR%sT\t2002 Oct  1\n"+
"\t\t\t-3:00\t-\tBRT\n"+
"Zone America/Bahia\t-2:34:04 -\tLMT\t1914\n"+
"\t\t\t-3:00\tBrazil\tBR%sT\t2003 Sep 24\n"+
"\t\t\t-3:00\t-\tBRT\t2011 Oct 16\n"+
"\t\t\t-3:00\tBrazil\tBR%sT\n"+
"Zone America/Sao_Paulo\t-3:06:28 -\tLMT\t1914\n"+
"\t\t\t-3:00\tBrazil\tBR%sT\t1963 Oct 23 00:00\n"+
"\t\t\t-3:00\t1:00\tBRST\t1964\n"+
"\t\t\t-3:00\tBrazil\tBR%sT\n"+
"Zone America/Campo_Grande -3:38:28 -\tLMT\t1914\n"+
"\t\t\t-4:00\tBrazil\tAM%sT\n"+
"Zone America/Cuiaba\t-3:44:20 -\tLMT\t1914\n"+
"\t\t\t-4:00\tBrazil\tAM%sT\t2003 Sep 24\n"+
"\t\t\t-4:00\t-\tAMT\t2004 Oct  1\n"+
"\t\t\t-4:00\tBrazil\tAM%sT\n"+
"Zone America/Porto_Velho -4:15:36 -\tLMT\t1914\n"+
"\t\t\t-4:00\tBrazil\tAM%sT\t1988 Sep 12\n"+
"\t\t\t-4:00\t-\tAMT\n"+
"Zone America/Boa_Vista\t-4:02:40 -\tLMT\t1914\n"+
"\t\t\t-4:00\tBrazil\tAM%sT\t1988 Sep 12\n"+
"\t\t\t-4:00\t-\tAMT\t1999 Sep 30\n"+
"\t\t\t-4:00\tBrazil\tAM%sT\t2000 Oct 15\n"+
"\t\t\t-4:00\t-\tAMT\n"+
"Zone America/Manaus\t-4:00:04 -\tLMT\t1914\n"+
"\t\t\t-4:00\tBrazil\tAM%sT\t1988 Sep 12\n"+
"\t\t\t-4:00\t-\tAMT\t1993 Sep 28\n"+
"\t\t\t-4:00\tBrazil\tAM%sT\t1994 Sep 22\n"+
"\t\t\t-4:00\t-\tAMT\n"+
"Zone America/Eirunepe\t-4:39:28 -\tLMT\t1914\n"+
"\t\t\t-5:00\tBrazil\tAC%sT\t1988 Sep 12\n"+
"\t\t\t-5:00\t-\tACT\t1993 Sep 28\n"+
"\t\t\t-5:00\tBrazil\tAC%sT\t1994 Sep 22\n"+
"\t\t\t-5:00\t-\tACT\t2008 Jun 24 00:00\n"+
"\t\t\t-4:00\t-\tAMT\n"+
"Zone America/Rio_Branco\t-4:31:12 -\tLMT\t1914\n"+
"\t\t\t-5:00\tBrazil\tAC%sT\t1988 Sep 12\n"+
"\t\t\t-5:00\t-\tACT\t2008 Jun 24 00:00\n"+
"\t\t\t-4:00\t-\tAMT\n"+
"Rule\tChile\t1927\t1932\t-\tSep\t 1\t0:00\t1:00\tS\n"+
"Rule\tChile\t1928\t1932\t-\tApr\t 1\t0:00\t0\t-\n"+
"Rule\tChile\t1942\tonly\t-\tJun\t 1\t4:00u\t0\t-\n"+
"Rule\tChile\t1942\tonly\t-\tAug\t 1\t5:00u\t1:00\tS\n"+
"Rule\tChile\t1946\tonly\t-\tJul\t15\t4:00u\t1:00\tS\n"+
"Rule\tChile\t1946\tonly\t-\tSep\t 1\t3:00u\t0:00\t-\n"+
"Rule\tChile\t1947\tonly\t-\tApr\t 1\t4:00u\t0\t-\n"+
"Rule\tChile\t1968\tonly\t-\tNov\t 3\t4:00u\t1:00\tS\n"+
"Rule\tChile\t1969\tonly\t-\tMar\t30\t3:00u\t0\t-\n"+
"Rule\tChile\t1969\tonly\t-\tNov\t23\t4:00u\t1:00\tS\n"+
"Rule\tChile\t1970\tonly\t-\tMar\t29\t3:00u\t0\t-\n"+
"Rule\tChile\t1971\tonly\t-\tMar\t14\t3:00u\t0\t-\n"+
"Rule\tChile\t1970\t1972\t-\tOct\tSun>=9\t4:00u\t1:00\tS\n"+
"Rule\tChile\t1972\t1986\t-\tMar\tSun>=9\t3:00u\t0\t-\n"+
"Rule\tChile\t1973\tonly\t-\tSep\t30\t4:00u\t1:00\tS\n"+
"Rule\tChile\t1974\t1987\t-\tOct\tSun>=9\t4:00u\t1:00\tS\n"+
"Rule\tChile\t1987\tonly\t-\tApr\t12\t3:00u\t0\t-\n"+
"Rule\tChile\t1988\t1989\t-\tMar\tSun>=9\t3:00u\t0\t-\n"+
"Rule\tChile\t1988\tonly\t-\tOct\tSun>=1\t4:00u\t1:00\tS\n"+
"Rule\tChile\t1989\tonly\t-\tOct\tSun>=9\t4:00u\t1:00\tS\n"+
"Rule\tChile\t1990\tonly\t-\tMar\t18\t3:00u\t0\t-\n"+
"Rule\tChile\t1990\tonly\t-\tSep\t16\t4:00u\t1:00\tS\n"+
"Rule\tChile\t1991\t1996\t-\tMar\tSun>=9\t3:00u\t0\t-\n"+
"Rule\tChile\t1991\t1997\t-\tOct\tSun>=9\t4:00u\t1:00\tS\n"+
"Rule\tChile\t1997\tonly\t-\tMar\t30\t3:00u\t0\t-\n"+
"Rule\tChile\t1998\tonly\t-\tMar\tSun>=9\t3:00u\t0\t-\n"+
"Rule\tChile\t1998\tonly\t-\tSep\t27\t4:00u\t1:00\tS\n"+
"Rule\tChile\t1999\tonly\t-\tApr\t 4\t3:00u\t0\t-\n"+
"Rule\tChile\t1999\t2010\t-\tOct\tSun>=9\t4:00u\t1:00\tS\n"+
"Rule\tChile\t2011\tonly\t-\tAug\tSun>=16\t4:00u\t1:00\tS\n"+
"Rule\tChile\t2012\tmax\t-\tOct\tSun>=9\t4:00u\t1:00\tS\n"+
"Rule\tChile\t2000\t2007\t-\tMar\tSun>=9\t3:00u\t0\t-\n"+
"Rule\tChile\t2008\tonly\t-\tMar\t30\t3:00u\t0\t-\n"+
"Rule\tChile\t2009\tonly\t-\tMar\tSun>=9\t3:00u\t0\t-\n"+
"Rule\tChile\t2010\tonly\t-\tApr\tSun>=1\t3:00u\t0\t-\n"+
"Rule\tChile\t2011\tonly\t-\tMay\tSun>=2\t3:00u\t0\t-\n"+
"Rule\tChile\t2012\tmax\t-\tMar\tSun>=9\t3:00u\t0\t-\n"+
"Zone America/Santiago\t-4:42:46 -\tLMT\t1890\n"+
"\t\t\t-4:42:46 -\tSMT\t1910 \t    # Santiago Mean Time\n"+
"\t\t\t-5:00\t-\tCLT\t1916 Jul  1 # Chile Time\n"+
"\t\t\t-4:42:46 -\tSMT\t1918 Sep  1 # Santiago Mean Time\n"+
"\t\t\t-4:00\t-\tCLT\t1919 Jul  1 # Chile Time\n"+
"\t\t\t-4:42:46 -\tSMT\t1927 Sep  1 # Santiago Mean Time\n"+
"\t\t\t-5:00\tChile\tCL%sT\t1947 May 22 # Chile Time\n"+
"\t\t\t-4:00\tChile\tCL%sT\n"+
"Zone Pacific/Easter\t-7:17:44 -\tLMT\t1890\n"+
"\t\t\t-7:17:28 -\tEMT\t1932 Sep    # Easter Mean Time\n"+
"\t\t\t-7:00\tChile\tEAS%sT\t1982 Mar 13 21:00 # Easter I Time\n"+
"\t\t\t-6:00\tChile\tEAS%sT\n"+
"Rule\tCO\t1992\tonly\t-\tMay\t 3\t0:00\t1:00\tS\n"+
"Rule\tCO\t1993\tonly\t-\tApr\t 4\t0:00\t0\t-\n"+
"Zone\tAmerica/Bogota\t-4:56:20 -\tLMT\t1884 Mar 13\n"+
"\t\t\t-4:56:20 -\tBMT\t1914 Nov 23 # Bogota Mean Time\n"+
"\t\t\t-5:00\tCO\tCO%sT\t# Colombia Time\n"+
"Zone\tAmerica/Curacao\t-4:35:44 -\tLMT\t1912 Feb 12\t# Willemstad\n"+
"\t\t\t-4:30\t-\tANT\t1965 # Netherlands Antilles Time\n"+
"\t\t\t-4:00\t-\tAST\n"+
"Link\tAmerica/Curacao\tAmerica/Lower_Princes # Sint Maarten\n"+
"Link\tAmerica/Curacao\tAmerica/Kralendijk # Bonaire, Sint Estatius and Saba\n"+
"Zone America/Guayaquil\t-5:19:20 -\tLMT\t1890\n"+
"\t\t\t-5:14:00 -\tQMT\t1931 # Quito Mean Time\n"+
"\t\t\t-5:00\t-\tECT\t     # Ecuador Time\n"+
"Zone Pacific/Galapagos\t-5:58:24 -\tLMT\t1931 # Puerto Baquerizo Moreno\n"+
"\t\t\t-5:00\t-\tECT\t1986\n"+
"\t\t\t-6:00\t-\tGALT\t     # Galapagos Time\n"+
"Rule\tFalk\t1937\t1938\t-\tSep\tlastSun\t0:00\t1:00\tS\n"+
"Rule\tFalk\t1938\t1942\t-\tMar\tSun>=19\t0:00\t0\t-\n"+
"Rule\tFalk\t1939\tonly\t-\tOct\t1\t0:00\t1:00\tS\n"+
"Rule\tFalk\t1940\t1942\t-\tSep\tlastSun\t0:00\t1:00\tS\n"+
"Rule\tFalk\t1943\tonly\t-\tJan\t1\t0:00\t0\t-\n"+
"Rule\tFalk\t1983\tonly\t-\tSep\tlastSun\t0:00\t1:00\tS\n"+
"Rule\tFalk\t1984\t1985\t-\tApr\tlastSun\t0:00\t0\t-\n"+
"Rule\tFalk\t1984\tonly\t-\tSep\t16\t0:00\t1:00\tS\n"+
"Rule\tFalk\t1985\t2000\t-\tSep\tSun>=9\t0:00\t1:00\tS\n"+
"Rule\tFalk\t1986\t2000\t-\tApr\tSun>=16\t0:00\t0\t-\n"+
"Rule\tFalk\t2001\t2010\t-\tApr\tSun>=15\t2:00\t0\t-\n"+
"Rule\tFalk\t2012\tmax\t-\tApr\tSun>=15\t2:00\t0\t-\n"+
"Rule\tFalk\t2001\tmax\t-\tSep\tSun>=1\t2:00\t1:00\tS\n"+
"Zone Atlantic/Stanley\t-3:51:24 -\tLMT\t1890\n"+
"\t\t\t-3:51:24 -\tSMT\t1912 Mar 12  # Stanley Mean Time\n"+
"\t\t\t-4:00\tFalk\tFK%sT\t1983 May     # Falkland Is Time\n"+
"\t\t\t-3:00\tFalk\tFK%sT\t1985 Sep 15\n"+
"\t\t\t-4:00\tFalk\tFK%sT\n"+
"Zone America/Cayenne\t-3:29:20 -\tLMT\t1911 Jul\n"+
"\t\t\t-4:00\t-\tGFT\t1967 Oct # French Guiana Time\n"+
"\t\t\t-3:00\t-\tGFT\n"+
"Zone\tAmerica/Guyana\t-3:52:40 -\tLMT\t1915 Mar\t# Georgetown\n"+
"\t\t\t-3:45\t-\tGBGT\t1966 May 26 # Br Guiana Time\n"+
"\t\t\t-3:45\t-\tGYT\t1975 Jul 31 # Guyana Time\n"+
"\t\t\t-3:00\t-\tGYT\t1991\n"+
"\t\t\t-4:00\t-\tGYT\n"+
"Rule\tPara\t1975\t1988\t-\tOct\t 1\t0:00\t1:00\tS\n"+
"Rule\tPara\t1975\t1978\t-\tMar\t 1\t0:00\t0\t-\n"+
"Rule\tPara\t1979\t1991\t-\tApr\t 1\t0:00\t0\t-\n"+
"Rule\tPara\t1989\tonly\t-\tOct\t22\t0:00\t1:00\tS\n"+
"Rule\tPara\t1990\tonly\t-\tOct\t 1\t0:00\t1:00\tS\n"+
"Rule\tPara\t1991\tonly\t-\tOct\t 6\t0:00\t1:00\tS\n"+
"Rule\tPara\t1992\tonly\t-\tMar\t 1\t0:00\t0\t-\n"+
"Rule\tPara\t1992\tonly\t-\tOct\t 5\t0:00\t1:00\tS\n"+
"Rule\tPara\t1993\tonly\t-\tMar\t31\t0:00\t0\t-\n"+
"Rule\tPara\t1993\t1995\t-\tOct\t 1\t0:00\t1:00\tS\n"+
"Rule\tPara\t1994\t1995\t-\tFeb\tlastSun\t0:00\t0\t-\n"+
"Rule\tPara\t1996\tonly\t-\tMar\t 1\t0:00\t0\t-\n"+
"Rule\tPara\t1996\t2001\t-\tOct\tSun>=1\t0:00\t1:00\tS\n"+
"Rule\tPara\t1997\tonly\t-\tFeb\tlastSun\t0:00\t0\t-\n"+
"Rule\tPara\t1998\t2001\t-\tMar\tSun>=1\t0:00\t0\t-\n"+
"Rule\tPara\t2002\t2004\t-\tApr\tSun>=1\t0:00\t0\t-\n"+
"Rule\tPara\t2002\t2003\t-\tSep\tSun>=1\t0:00\t1:00\tS\n"+
"Rule\tPara\t2004\t2009\t-\tOct\tSun>=15\t0:00\t1:00\tS\n"+
"Rule\tPara\t2005\t2009\t-\tMar\tSun>=8\t0:00\t0\t-\n"+
"Rule\tPara\t2010\tmax\t-\tOct\tSun>=1\t0:00\t1:00\tS\n"+
"Rule\tPara\t2010\tmax\t-\tApr\tSun>=8\t0:00\t0\t-\n"+
"Zone America/Asuncion\t-3:50:40 -\tLMT\t1890\n"+
"\t\t\t-3:50:40 -\tAMT\t1931 Oct 10 # Asuncion Mean Time\n"+
"\t\t\t-4:00\t-\tPYT\t1972 Oct # Paraguay Time\n"+
"\t\t\t-3:00\t-\tPYT\t1974 Apr\n"+
"\t\t\t-4:00\tPara\tPY%sT\n"+
"Rule\tPeru\t1938\tonly\t-\tJan\t 1\t0:00\t1:00\tS\n"+
"Rule\tPeru\t1938\tonly\t-\tApr\t 1\t0:00\t0\t-\n"+
"Rule\tPeru\t1938\t1939\t-\tSep\tlastSun\t0:00\t1:00\tS\n"+
"Rule\tPeru\t1939\t1940\t-\tMar\tSun>=24\t0:00\t0\t-\n"+
"Rule\tPeru\t1986\t1987\t-\tJan\t 1\t0:00\t1:00\tS\n"+
"Rule\tPeru\t1986\t1987\t-\tApr\t 1\t0:00\t0\t-\n"+
"Rule\tPeru\t1990\tonly\t-\tJan\t 1\t0:00\t1:00\tS\n"+
"Rule\tPeru\t1990\tonly\t-\tApr\t 1\t0:00\t0\t-\n"+
"Rule\tPeru\t1994\tonly\t-\tJan\t 1\t0:00\t1:00\tS\n"+
"Rule\tPeru\t1994\tonly\t-\tApr\t 1\t0:00\t0\t-\n"+
"Zone\tAmerica/Lima\t-5:08:12 -\tLMT\t1890\n"+
"\t\t\t-5:08:36 -\tLMT\t1908 Jul 28 # Lima Mean Time?\n"+
"\t\t\t-5:00\tPeru\tPE%sT\t# Peru Time\n"+
"Zone Atlantic/South_Georgia -2:26:08 -\tLMT\t1890\t\t# Grytviken\n"+
"\t\t\t-2:00\t-\tGST\t# South Georgia Time\n"+
"Zone America/Paramaribo\t-3:40:40 -\tLMT\t1911\n"+
"\t\t\t-3:40:52 -\tPMT\t1935     # Paramaribo Mean Time\n"+
"\t\t\t-3:40:36 -\tPMT\t1945 Oct # The capital moved?\n"+
"\t\t\t-3:30\t-\tNEGT\t1975 Nov 20 # Dutch Guiana Time\n"+
"\t\t\t-3:30\t-\tSRT\t1984 Oct # Suriname Time\n"+
"\t\t\t-3:00\t-\tSRT\n"+
"Zone America/Port_of_Spain -4:06:04 -\tLMT\t1912 Mar 2\n"+
"\t\t\t-4:00\t-\tAST\n"+
"Rule\tUruguay\t1923\tonly\t-\tOct\t 2\t 0:00\t0:30\tHS\n"+
"Rule\tUruguay\t1924\t1926\t-\tApr\t 1\t 0:00\t0\t-\n"+
"Rule\tUruguay\t1924\t1925\t-\tOct\t 1\t 0:00\t0:30\tHS\n"+
"Rule\tUruguay\t1933\t1935\t-\tOct\tlastSun\t 0:00\t0:30\tHS\n"+
"Rule\tUruguay\t1934\t1936\t-\tMar\tSat>=25\t23:30s\t0\t-\n"+
"Rule\tUruguay\t1936\tonly\t-\tNov\t 1\t 0:00\t0:30\tHS\n"+
"Rule\tUruguay\t1937\t1941\t-\tMar\tlastSun\t 0:00\t0\t-\n"+
"Rule\tUruguay\t1937\t1940\t-\tOct\tlastSun\t 0:00\t0:30\tHS\n"+
"Rule\tUruguay\t1941\tonly\t-\tAug\t 1\t 0:00\t0:30\tHS\n"+
"Rule\tUruguay\t1942\tonly\t-\tJan\t 1\t 0:00\t0\t-\n"+
"Rule\tUruguay\t1942\tonly\t-\tDec\t14\t 0:00\t1:00\tS\n"+
"Rule\tUruguay\t1943\tonly\t-\tMar\t14\t 0:00\t0\t-\n"+
"Rule\tUruguay\t1959\tonly\t-\tMay\t24\t 0:00\t1:00\tS\n"+
"Rule\tUruguay\t1959\tonly\t-\tNov\t15\t 0:00\t0\t-\n"+
"Rule\tUruguay\t1960\tonly\t-\tJan\t17\t 0:00\t1:00\tS\n"+
"Rule\tUruguay\t1960\tonly\t-\tMar\t 6\t 0:00\t0\t-\n"+
"Rule\tUruguay\t1965\t1967\t-\tApr\tSun>=1\t 0:00\t1:00\tS\n"+
"Rule\tUruguay\t1965\tonly\t-\tSep\t26\t 0:00\t0\t-\n"+
"Rule\tUruguay\t1966\t1967\t-\tOct\t31\t 0:00\t0\t-\n"+
"Rule\tUruguay\t1968\t1970\t-\tMay\t27\t 0:00\t0:30\tHS\n"+
"Rule\tUruguay\t1968\t1970\t-\tDec\t 2\t 0:00\t0\t-\n"+
"Rule\tUruguay\t1972\tonly\t-\tApr\t24\t 0:00\t1:00\tS\n"+
"Rule\tUruguay\t1972\tonly\t-\tAug\t15\t 0:00\t0\t-\n"+
"Rule\tUruguay\t1974\tonly\t-\tMar\t10\t 0:00\t0:30\tHS\n"+
"Rule\tUruguay\t1974\tonly\t-\tDec\t22\t 0:00\t1:00\tS\n"+
"Rule\tUruguay\t1976\tonly\t-\tOct\t 1\t 0:00\t0\t-\n"+
"Rule\tUruguay\t1977\tonly\t-\tDec\t 4\t 0:00\t1:00\tS\n"+
"Rule\tUruguay\t1978\tonly\t-\tApr\t 1\t 0:00\t0\t-\n"+
"Rule\tUruguay\t1979\tonly\t-\tOct\t 1\t 0:00\t1:00\tS\n"+
"Rule\tUruguay\t1980\tonly\t-\tMay\t 1\t 0:00\t0\t-\n"+
"Rule\tUruguay\t1987\tonly\t-\tDec\t14\t 0:00\t1:00\tS\n"+
"Rule\tUruguay\t1988\tonly\t-\tMar\t14\t 0:00\t0\t-\n"+
"Rule\tUruguay\t1988\tonly\t-\tDec\t11\t 0:00\t1:00\tS\n"+
"Rule\tUruguay\t1989\tonly\t-\tMar\t12\t 0:00\t0\t-\n"+
"Rule\tUruguay\t1989\tonly\t-\tOct\t29\t 0:00\t1:00\tS\n"+
"Rule\tUruguay\t1990\t1992\t-\tMar\tSun>=1\t 0:00\t0\t-\n"+
"Rule\tUruguay\t1990\t1991\t-\tOct\tSun>=21\t 0:00\t1:00\tS\n"+
"Rule\tUruguay\t1992\tonly\t-\tOct\t18\t 0:00\t1:00\tS\n"+
"Rule\tUruguay\t1993\tonly\t-\tFeb\t28\t 0:00\t0\t-\n"+
"Rule\tUruguay\t2004\tonly\t-\tSep\t19\t 0:00\t1:00\tS\n"+
"Rule\tUruguay\t2005\tonly\t-\tMar\t27\t 2:00\t0\t-\n"+
"Rule\tUruguay\t2005\tonly\t-\tOct\t 9\t 2:00\t1:00\tS\n"+
"Rule\tUruguay\t2006\tonly\t-\tMar\t12\t 2:00\t0\t-\n"+
"Rule\tUruguay\t2006\tmax\t-\tOct\tSun>=1\t 2:00\t1:00\tS\n"+
"Rule\tUruguay\t2007\tmax\t-\tMar\tSun>=8\t 2:00\t0\t-\n"+
"Zone America/Montevideo\t-3:44:44 -\tLMT\t1898 Jun 28\n"+
"\t\t\t-3:44:44 -\tMMT\t1920 May  1\t# Montevideo MT\n"+
"\t\t\t-3:30\tUruguay\tUY%sT\t1942 Dec 14\t# Uruguay Time\n"+
"\t\t\t-3:00\tUruguay\tUY%sT\n"+
"Zone\tAmerica/Caracas\t-4:27:44 -\tLMT\t1890\n"+
"\t\t\t-4:27:40 -\tCMT\t1912 Feb 12 # Caracas Mean Time?\n"+
"\t\t\t-4:30\t-\tVET\t1965\t     # Venezuela Time\n"+
"\t\t\t-4:00\t-\tVET\t2007 Dec  9 03:00\n"+
"\t\t\t-4:30\t-\tVET\n"+
""}

});

require.define("/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"main":"./lumenize"}
});

require.define("/lumenize.coffee",function(require,module,exports,__dirname,__filename,process,global){
/*

# Lumenize #

Lumenize provides tools for aggregating data and creating timezone-precise timelines for visualizations.

Below, is a somewhat long example that utilizes most of Lumenize's functionality. It should provid a good introduction
to its capabilities.

The first line below "requires" Lumenize. If you are using the browserified package or creating an App with Rally's
App SDK, you will not need this line. Lumenize will already be available in the current scope.

    Lumenize = require('../')

Next, let's create some sample data. The example below creates a simple burnup chart. The data in the snapshots*
variables below simulate data for various work items changing over time. It is shown here in tabular "CSVStyle".

    snapshotsCSVStyle = [
      ["ObjectID", "_ValidFrom",           "_ValidTo",             "ScheduleState", "PlanEstimate"],

      [1,          "2010-10-10T15:00:00Z", "2011-01-02T13:00:00Z", "Ready to pull", 5             ],

      [1,          "2011-01-02T15:10:00Z", "2011-01-04T15:00:00Z", "In progress"  , 5             ],
      [2,          "2011-01-02T15:00:00Z", "2011-01-03T15:00:00Z", "Ready to pull", 3             ],
      [3,          "2011-01-02T15:00:00Z", "2011-01-03T15:00:00Z", "Ready to pull", 5             ],

      [2,          "2011-01-03T15:00:00Z", "2011-01-04T15:00:00Z", "In progress"  , 3             ],
      [3,          "2011-01-03T15:00:00Z", "2011-01-04T15:00:00Z", "Ready to pull", 5             ],
      [4,          "2011-01-03T15:00:00Z", "2011-01-04T15:00:00Z", "Ready to pull", 5             ],
      [1,          "2011-01-03T15:10:00Z", "2011-01-04T15:00:00Z", "In progress"  , 5             ],

      [1,          "2011-01-04T15:00:00Z", "2011-01-06T15:00:00Z", "Accepted"     , 5             ],
      [2,          "2011-01-04T15:00:00Z", "2011-01-06T15:00:00Z", "In test"      , 3             ],
      [3,          "2011-01-04T15:00:00Z", "2011-01-05T15:00:00Z", "In progress"  , 5             ],
      [4,          "2011-01-04T15:00:00Z", "2011-01-06T15:00:00Z", "Ready to pull", 5             ],
      [5,          "2011-01-04T15:00:00Z", "2011-01-06T15:00:00Z", "Ready to pull", 2             ],

      [3,          "2011-01-05T15:00:00Z", "2011-01-07T15:00:00Z", "In test"      , 5             ],

      [1,          "2011-01-06T15:00:00Z", "2011-01-07T15:00:00Z", "Released"     , 5             ],
      [2,          "2011-01-06T15:00:00Z", "2011-01-07T15:00:00Z", "Accepted"     , 3             ],
      [4,          "2011-01-06T15:00:00Z", "2011-01-07T15:00:00Z", "In progress"  , 5             ],
      [5,          "2011-01-06T15:00:00Z", "2011-01-07T15:00:00Z", "Ready to pull", 2             ],

      [1,          "2011-01-07T15:00:00Z", "9999-01-01T00:00:00Z", "Released"     , 5             ],
      [2,          "2011-01-07T15:00:00Z", "9999-01-01T00:00:00Z", "Released"     , 3             ],
      [3,          "2011-01-07T15:00:00Z", "9999-01-01T00:00:00Z", "Accepted"     , 5             ],
      [4,          "2011-01-07T15:00:00Z", "9999-01-01T00:00:00Z", "In test"      , 5             ],
      [5,          "2011-01-07T15:00:00Z", "9999-01-01T00:00:00Z", "In progress"  , 2             ]
    ]

However, Lumenize assumes the data is in the form of an "Array of Maps" like Rally's LookbackAPI would emit. The
`Lumenize.csvStyleArray_To_ArrayOfMaps` convenience function will convert it to the expected form.

    snapshotArray = Lumenize.csvStyleArray_To_ArrayOfMaps(snapshotsCSVStyle)

The `rangeSpec` defines the specification for the x-axis. Notice how you can exclude weekends and holidays. Here we
specify a `startOn` and a `endBefore`. However, it's fairly common in charts to specify `endBefore: "this day"` and
`limit: 60` (no `startOn`). A number of human readable dates like `"next month"` or `"previous week"` are supported. You
need to specify any 2 of startOn, endBefore, or limit.

    rangeSpec = {
      startOn: "2011-01-02"
      endBefore: "2011-01-08",
      workDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],  # Also supports "Monday, Tuesday, ..."
      holidays: [
        {"month": 1, "day": 1},
        {"month": 12, "day": 25},
        "2011-01-05"  # Made up holiday to demo holiday knockout
      ]
    }

If you think of the list of snapshots as a table of data, then `derivedFields` is just like adding a virtual column
to the table. Simply specify a name and a callback function "f".

    derivedFields = [
      {
      "name": "accepted",
      "f": (row) ->
        if row.ScheduleState in ["Accepted", "Released"]
          return 1
        else
          return 0
      }
    ]

The `aggregationSpec` supports a number of functions including sum, count, addToSet, standardDeviation,
p50 (for median), and p?? (for any quartile/percentile). It will also allow you to specify a callback function
like in derivedFields above if none of the built-in functions serves.

    aggregationSpec = [
      {"as": "scope", "f": "count", "field": "ObjectID"},
      {"as": "accepted", "f": "sum", "field": "accepted"}
    ]

Since Lumenize was designed to work with other temporal data models besides Rally's, you must tell it what fields
are used for the valid from, valid to, and unique id. You must also tell it what timezone to use for the boundaries
of your x-axis values. The snapshot data is in Zulu time, but the start of the day in New York is shifted by 4 or 5
hours depending upon the time of year. Specifying a timezone, allows Lumenize to shift the raw Zulu dates into
the timezone of your choosing.

    config = {
      snapshotValidFromField: '_ValidFrom',
      snapshotValidToField: '_ValidTo',
      snapshotUniqueID: 'ObjectID',
      timezone: 'America/New_York',
      rangeSpec: rangeSpec,
      derivedFields: derivedFields,
      aggregationSpec: aggregationSpec
    }

Next, we call `Lumenize.timeSeriesCalculator` with the snapshots as well as the config object that we just built.
It will calculate the time-series data according to our specifications. It returns two values. A list of ChartTime
objects specifying the x-axis (`listOfAtCTs`) and our calculations (`aggregationAtArray`).

    {listOfAtCTs, aggregationAtArray} = Lumenize.timeSeriesCalculator(snapshotArray, config)

You could graph this output to render a burnup chart by story count.

    for value, index in listOfAtCTs
      console.log(value.toString(), aggregationAtArray[index])

    # 2011-01-03 { scope: 3, accepted: 0 }
    # 2011-01-04 { scope: 4, accepted: 0 }
    # 2011-01-06 { scope: 5, accepted: 1 }
    # 2011-01-07 { scope: 5, accepted: 2 }

Most folks prefer for their burnup charts to be by Story Points (PlanEstimate). So let's modify our configuration to use
`PlanEstimate`.

    config.derivedFields = [
      {
      "name": "accepted",
      "f": (row) ->
        if row.ScheduleState in ["Accepted", "Released"]
          return row.PlanEstimate;
        else
          return 0
      }
    ]

    config.aggregationSpec = [
      {"as": "scope", "f": "sum", "field": "PlanEstimate"},
      {"as": "accepted", "f": "sum", "field": "accepted"}
    ]

    {listOfAtCTs, aggregationAtArray} = Lumenize.timeSeriesCalculator(snapshotArray, config)

    for value, index in listOfAtCTs
      console.log(value.toString(), aggregationAtArray[index])

    # 2011-01-03 { scope: 13, accepted: 0 }
    # 2011-01-04 { scope: 18, accepted: 0 }
    # 2011-01-06 { scope: 20, accepted: 5 }
    # 2011-01-07 { scope: 20, accepted: 8 }
*/


(function() {
  var aggregate, chartTimeIteratorAndRange, datatransform, derive;

  exports.ChartTime = require('./src/ChartTime').ChartTime;

  chartTimeIteratorAndRange = require('./src/ChartTimeIteratorAndRange');

  exports.ChartTimeIterator = chartTimeIteratorAndRange.ChartTimeIterator;

  exports.ChartTimeRange = chartTimeIteratorAndRange.ChartTimeRange;

  exports.ChartTimeInStateCalculator = require('./src/ChartTimeInStateCalculator').ChartTimeInStateCalculator;

  datatransform = require('./src/dataTransform');

  exports.csvStyleArray_To_ArrayOfMaps = datatransform.csvStyleArray_To_ArrayOfMaps;

  exports.snapshotArray_To_AtArray = datatransform.snapshotArray_To_AtArray;

  exports.groupByAtArray_To_HighChartsSeries = datatransform.groupByAtArray_To_HighChartsSeries;

  exports.aggregationAtArray_To_HighChartsSeries = datatransform.aggregationAtArray_To_HighChartsSeries;

  aggregate = require('./src/aggregate');

  exports.aggregate = aggregate.aggregate;

  exports.aggregateAt = aggregate.aggregateAt;

  exports.groupBy = aggregate.groupBy;

  exports.groupByAt = aggregate.groupByAt;

  exports.percentileCreator = aggregate.percentileCreator;

  exports.timeSeriesCalculator = aggregate.timeSeriesCalculator;

  exports.timeSeriesGroupByCalculator = aggregate.timeSeriesGroupByCalculator;

  exports.functions = require('./src/functions').functions;

  derive = require('./src/derive');

  exports.deriveFields = derive.deriveFields;

  exports.deriveFieldsAt = derive.deriveFieldsAt;

  exports.histogram = require('./src/histogram').histogram;

}).call(this);

});

require.define("/src/ChartTime.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var ChartTime, timezoneJS, utils,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  utils = require('./utils');

  timezoneJS = require('./timezone-js.js').timezoneJS;

  ChartTime = (function() {
    /*
      @class ChartTime
      # ChartTime #
      
      _Time axis creation/manipulation for charts_
      
      ## Features ##
      
      * Generate the values for time series chart axis
      * Knockout weekends and holidays (ChartTimeIterator)
      * Knockout non-work hours (ChartTimeIterator)
      * Work with precision around timezone differences
      * Month is 1-indexed (rather than 0-indexed like Javascript's Date object)
      * Date/Time math (add 3 months, subtract 2 weeks, etc.)
      * Work with ISO-8601 formatted strings (called 'ISOString' in this library)
         * Added: Quarter form (e.g. 2012Q3 equates to 2012-07-01)
         * Not supported: Ordinal form (e.g. 2012-001 for 2012-01-01, 2011-365 for 2012-12-31) not supported
      * Allows for custom granularities like release/iteration/iteration_day
      * Tested
      * Documented
      
      ## Granularity ##
      
      Each ChartTime object has a granularity. This means that you never have to
      worry about any bits lower than your specified granularity. A day has only
      year, month, and day segments. You are never tempted to specify 11:59pm
      to specify the end of a day-long timebox.
      
      ChartTime supports the following granularities:
      
      * `year`
          * `month`
              * `day`
                  * `hour`
                     * `minute`
                         * `second`
                             * `millisecond`
          * `quarter` (but not quarter_month, day, etc.)
          * `week` (ISO-8601 style week numbering)
             * `week_day` (Monday = 1, Sunday = 7)
      
      Also, you can define your own custom hierarchical granularities, for example...
      
      * `release`
         * `iteration`
            * `iteration_day`
        
      ## Timezone precision ##
      
      It's very hard to do filtering and grouping of time-series data with timezone precision. 
      
      For instance, 11pm in California on December 25 (Christmas holiday) is 2am December 26 (not a holiday)
      in New York. This also happens to be 7am December 26 GMT. If you have an event that occurs at 
      2011-12-26T07:00:00.000Z, then you need to decide what timezone to use as your context before you 
      decide if that event occured on Christmas day or not. It's not just holidays where this can burn you.
      Deciding if a piece of work finished in one time range versus another can make a difference for
      you metrics. The time range metrics for a distributed team should look the same regardless
      of whether those metrics were generated in New York versus Los Angeles... versus Bangalore.
      
      The javascript Date object lets you work in either the local time or Zulu (GMT/UTC) time but it doesn't let you
      control the timezone. Do you know the correct way to apply the timezone shift to a JavaScript Date Object? 
      Do you know when Daylight Savings Time kicks in and New York is 4 hours shifted from GMT instead of 5? Will
      you remember to do it perfectly every time it's needed in your code?
      
      If you need this precision, ChartTime helps by clearly delineating the moment when you need to do 
      timezone manipulation... the moment you need to compare/query timestamped data. You can do all of your
      holiday/weekend knockout manipulation without regard to timezone and only consider the timezone
      upon query submission or comparison.
      
      ## Month is 1-indexed as you would expect ##
      
      Javascript's date object uses 0 for January and 11 for December. ChartTime uses 1 for January and 12 for December...
      which is what ISO-8601 uses and what humans expect. Everyone who works with the javascript Date Object at one
      point or another gets burned by this.
      
      ## Week support ##
      
      ChartTime follows ISO-8601 week support where ever it makes sense. Implications of using this ISO format (paraphrased
      info from wikipedia):
      
      * All weeks have 7 days (i.e. there are no fractional weeks).
      * Any given day falls into a single week which means that incrementing across the year boundary in week
        granularity is without gaps or repeats.
      * Weeks are contained within a single year. (i.e. weeks are never spit over two years).
      * The above two implications also mean that we have to warp the boundaries of the year to accomplish this. In week
        granularity dates may appear in a different year than you would expect and some years have 53 weeks.
      * The date directly tells the weekday.
      * All years start with a Monday and end with a Sunday.
      * Dates represented as yyyyWww-d can be sorted as strings.
      
      **In general, it just greatly simplifies the use of week granularity in a chart situation.**
      
      The only real downside to this approach is that USA folks expect the week to start on Sunday. However, the ISO-8601 spec starts
      each week on Monday. Following ISO-8601, ChartTime uses 1 for Monday and 7 for Sunday which aligns with
      the US standard for every day except Sunday. The US standard is to use 0 for Sunday.
      
      ## Basic usage ##
      
          {ChartTimeIterator, ChartTimeRange, ChartTime} = require('../')
    
      Get ChartTime objects relative to now.
      
          d = new ChartTime('this millisecond in Pacific/Fiji')
          d = new ChartTime('previous week')
          d = new ChartTime('next month')
          
      Spell it all out with a JavaScript object
    
          d1 = new ChartTime({granularity: ChartTime.DAY, year: 2011, month: 2, day: 28})
          console.log(d1.toString())
          # 2011-02-28
          
      You can use the string short-hand rather than spell out the segments separately. The granularity
      is automatically inferred from how many segments you provide.
      
          d2 = new ChartTime('2011-03-01')
          console.log(d2.toString())
          # 2011-03-01
          
      Increment/decrement and compare ChartTimes without regard to timezone
      
          console.log(d1.greaterThanOrEqual(d2))
          d1.increment()
          console.log(d1.equal(d2))
          # false
          # true
      
      Do math on them.
          
          d3 = d1.add(5)
          console.log(d3.toString())
          # 2011-03-06
      
      Get the day of the week.
      
          console.log(d3.dowString())
          # Sunday
          
      Subtraction is just addition with negative numbers.
      
          d3.addInPlace(-6)
          console.log(d3.toString())
          # 2011-02-28
      
      If you start on the last day of a month, adding a month takes you to the last day of the next month, 
      even if the number of days are different.
          
          d3.addInPlace(1, 'month')  
          console.log(d3.toString())
          # 2011-03-31
          
      Deals well with year-granularity math and leap year complexity.
      
          d4 = new ChartTime('2004-02-29')  # leap day
          d4.addInPlace(1, 'year')  # adding a year takes us to a non-leap year
          console.log(d4.toString())
          # 2005-02-28
          
      Week granularity correctly wraps and deals with 53-week years.
      
          w1 = new ChartTime('2004W53-6')
          console.log(w1.inGranularity(ChartTime.DAY).toString())
          # 2005-01-01
          
      Convert between any of the standard granularities. Also converts custom granularities (not shown) to
      standard granularities if you provide a `rataDieNumber()` function with your custom granularities.
      
          d5 = new ChartTime('2005-01-01')  # goes the other direction also
          console.log(d5.inGranularity('week_day').toString())
          # 2004W53-6
          
          q1 = new ChartTime('2011Q3')
          console.log(q1.inGranularity(ChartTime.MILLISECOND).toString())
          # 2011-07-01T00:00:00.000
          
      ## Timezones ##
      
      ChartTime does timezone sensitive conversions. You must set the path to the tz files before doing any timezone sensitive comparisons.
      Note, if you are using one of the pre-packaged Lumenize.js or Lumenize-min.js, then you can supply any string in this call. It will
      ignore what you provide and load the time zone data from the files included in the package. We would like to remove the requirement
      for this initialization when running one of these packages, but for now, you still need the dummy call.
      
          console.log(new ChartTime('2011-01-01').getJSDate('America/Denver').toUTCString())
          # Sat, 01 Jan 2011 07:00:00 GMT
    */

    var g, spec, _ref;

    function ChartTime(value, granularity, tz) {
      /*
          @constructor
          @param {Object/Number/Date/String} value
          @param {String} [granularity]
          @param {String} [tz]
      
          The constructor for ChartTime supports the passing in of a String, a rata die number (RDN), or a spec Object
          
          ## String ##
          
          There are two kinds of strings that can be passed into the constructor:
          
          1. Human strings relative to now (e.g. "this day", "previous month", "next quarter", "this millisecond in Pacific/Fiji", etc.)
          2. ISO-8601 or custom masked (e.g. "I03D10" - 10th day of 3rd iteration)
          
          ## Human strings relative to now ##
          
          The string must be in the form `(this, previous, next) |granularity| [in |timezone|]`
          
          Examples
          
          * `this day` today
          * `next month` next month
          * `this day in Pacific/Fiji` the day that it currently is in Fiji
          * `previous hour in America/New_York` the hour before the current hour in New York
          * `next quarter` next quarter
          * `previous week` last week
          
          ## ISO-8601 or custom masked ##
          
          When you pass in an ISO-8601 or custom mask string, ChartTime uses the masks that are defined for each granularity to figure out the granularity...
          unless you explicitly provide a granularity. This parser does not work on all valid ISO-8601 forms. Ordinal dates (`"2012-288"`)
          are not supported but week number form (`"2009W52-7"`) is supported. The canonical form (`"2009-01-01T12:34:56.789"`) will 
          work as will any shortened subset of it (`"2009-01-01"`, `"2009-01-01T12:34"`, etc.). We've added a form for Quarter
          granularity (`"2009Q4"`). Plus it will even parse strings in whatever custom granularity you provide based
          upon the mask that you provide for that granularity.
          
          If the granularity is specified but not all of the segments are provided, ChartTime will fill in the missing value 
          with the `lowest` value from _granularitySpecs.
          
          The Lumenize hierarchy tools rely upon the property that a single character is used between segments so the ISO forms that 
          omit the delimiters are not supported.
          
          If the string has a timezone indicator on the end (`...+05:00` or `...Z`), ChartTime will ignore it. Timezone information
          is intended to only be used for comparison (see examples for timezone comparison).
          
          There are two special Strings that are recognized: `BEFORE_FIRST` and `PAST_LAST`. You must provide a granularity if you
          are instantiating a ChartTime with these values. They are primarily used for custom granularities where your users
          may mistakenly request charts for iterations and releases that have not yet been defined. They are particularly useful when 
          you want to iterate to the last defined iteration/release.
      
          ## Rata Die Number ##
          
          The **rata die number (RDN)** for a date is the number of days since 0001-01-01. You will probably never work
          directly with this number but it's what ChartTime uses to convert between granularities. When you are instantiating
          a ChartTime from an RDN, you must provide a granularity. Using RDN will work even for the granularities finer than day.
          ChartTime will populate the finer grained segments (hour, minute, etc.) with the approriate `lowest` value.
      
          ## Date ##
          
          You can also pass in a JavaScript Date() Object. The passing in of a tz with this option doesn't make sense. You'll end
          up with the same ChartTime value no matter what because the JS Date() already sorta has a timezone. I'm not sure if this
          option is even really useful. In most cases, you are probably better off using ChartTime.getISOStringFromJSDate()
          
          ## Spec ##
          
          You can also explicitly spell out the segments in a **spec** Object in the form of 
          `{granularity: ChartTime.DAY, year: 2009, month: 1, day: 1}`. If the granularity is specified but not all of the segments are
          provided, ChartTime will fill in the missing value with the appropriate `lowest` value from _granularitySpecs.
          
          ## granularity ##
          
          If you provide a granularity it will take precedence over whatever fields you've provided in your spec or whatever segments
          you have provided in your string. ChartTime will leave off extra values and fill in missing ones with the appropriate `lowest`
          value.
          
          ## tz ##
          
          Most of the time, ChartTime assumes that any dates you pass in are timezone less. You'll specify Christmas as 12-25, then you'll
          shift the boundaries of Christmas for a specific timezone for boundary comparison.
          
          However, if you provide a tz parameter to this constructor, ChartTime will assume you are passing in a true GMT date/time and shift into 
          the provided timezone. So...
          
              d = new ChartTime('2011-01-01T02:00:00:00.000Z', ChartTime.DAY, 'America/New_York')
              console.log(d.toString())
              # 2010-12-31
              
          Rule of thumb on when you want to use timezones:
          
          1. If you have true GMT date/times and you want to create a ChartTime, provide the timezone to this constructor.
          2. If you have abstract days like Christmas or June 10th and you want to delay the timezone consideration, don't provide a timezone to this constructor.
          3. In either case, if the dates you want to compare to are in GMT, but you've got ChartTimes or ChartTimeRanges, you'll have to provide a timezone on
             the way back out of ChartTime/ChartTimeRange
      */

      var jsDate, newCT, newSpec, rdn, s, spec, _ref;
      this.beforePastFlag = '';
      switch (utils.type(value)) {
        case 'string':
          s = value;
          if (tz != null) {
            newCT = new ChartTime(s, 'millisecond');
            jsDate = newCT.getJSDateFromGMTInTZ(tz);
          } else {
            this._setFromString(s, granularity);
          }
          break;
        case 'number':
          rdn = value;
          if (tz != null) {
            newCT = new ChartTime(rdn, 'millisecond');
            jsDate = newCT.getJSDateFromGMTInTZ(tz);
          } else {
            this._setFromRDN(rdn, granularity);
          }
          break;
        case 'date':
          jsDate = value;
          if (tz != null) {
            newCT = new ChartTime(jsDate, 'millisecond');
            jsDate = newCT.getJSDateFromGMTInTZ(tz);
          }
          if (tz == null) {
            tz = 'GMT';
          }
          break;
        case 'object':
          spec = value;
          if (tz != null) {
            spec.granularity = 'millisecond';
            newCT = new ChartTime(spec);
            jsDate = newCT.getJSDateFromGMTInTZ(tz);
          } else {
            this._setFromSpec(spec);
          }
      }
      if (tz != null) {
        if ((_ref = this.beforePastFlag) === 'BEFORE_FIRST' || _ref === 'PAST_LAST') {
          throw new Error("Cannot do timezone manipulation on " + this.beforePastFlag);
        }
        if (granularity != null) {
          this.granularity = granularity;
        }
        if (this.granularity == null) {
          this.granularity = 'millisecond';
        }
        newSpec = {
          year: jsDate.getUTCFullYear(),
          month: jsDate.getUTCMonth() + 1,
          day: jsDate.getUTCDate(),
          hour: jsDate.getUTCHours(),
          minute: jsDate.getUTCMinutes(),
          second: jsDate.getUTCSeconds(),
          millisecond: jsDate.getUTCMilliseconds(),
          granularity: 'millisecond'
        };
        newCT = new ChartTime(newSpec).inGranularity(this.granularity);
        this._setFromSpec(newCT);
      }
      this._inBoundsCheck();
      this._overUnderFlow();
    }

    /*
      `_granularitySpecs` is a static object that is used to tell ChartTime what to do with particular granularties. You can think of
      each entry in it as a sort of sub-class of ChartTime. In that sense ChartTime is really a factory generating ChartTime objects
      of type granularity. When custom timebox granularities are added to ChartTime by `ChartTime.addGranularity()`, it adds to this
      `_granularitySpecs` object.
    
      Each entry in `_granularitySpecs` has the following:
    
      * segments - an Array identifying the ancestry (e.g. for 'day', it is: `['year', 'month', 'day']`)
      * mask - a String used to identify when this granularity is passed in and to serialize it on the way out.
      * lowest - the lowest possible value for this granularity. 0 for millisecond but 1 for day.
      * rolloverValue - a callback function that will say when to rollover the next coarser granularity.
    */


    ChartTime._granularitySpecs = {};

    ChartTime._granularitySpecs['millisecond'] = {
      segments: ['year', 'month', 'day', 'hour', 'minute', 'second', 'millisecond'],
      mask: '####-##-##T##:##:##.###',
      lowest: 0,
      rolloverValue: function() {
        return 1000;
      }
    };

    ChartTime._granularitySpecs['second'] = {
      segments: ['year', 'month', 'day', 'hour', 'minute', 'second'],
      mask: '####-##-##T##:##:##',
      lowest: 0,
      rolloverValue: function() {
        return 60;
      }
    };

    ChartTime._granularitySpecs['minute'] = {
      segments: ['year', 'month', 'day', 'hour', 'minute'],
      mask: '####-##-##T##:##',
      lowest: 0,
      rolloverValue: function() {
        return 60;
      }
    };

    ChartTime._granularitySpecs['hour'] = {
      segments: ['year', 'month', 'day', 'hour'],
      mask: '####-##-##T##',
      lowest: 0,
      rolloverValue: function() {
        return 24;
      }
    };

    ChartTime._granularitySpecs['day'] = {
      segments: ['year', 'month', 'day'],
      mask: '####-##-##',
      lowest: 1,
      rolloverValue: function(ct) {
        return ct.daysInMonth() + 1;
      }
    };

    ChartTime._granularitySpecs['month'] = {
      segments: ['year', 'month'],
      mask: '####-##',
      lowest: 1,
      rolloverValue: function() {
        return 12 + 1;
      }
    };

    ChartTime._granularitySpecs['year'] = {
      segments: ['year'],
      mask: '####',
      lowest: 1,
      rolloverValue: function() {
        return 9999 + 1;
      }
    };

    ChartTime._granularitySpecs['week'] = {
      segments: ['year', 'week'],
      mask: '####W##',
      lowest: 1,
      rolloverValue: function(ct) {
        if (ct.is53WeekYear()) {
          return 53 + 1;
        } else {
          return 52 + 1;
        }
      }
    };

    ChartTime._granularitySpecs['week_day'] = {
      segments: ['year', 'week', 'week_day'],
      mask: '####W##-#',
      lowest: 1,
      rolloverValue: function(ct) {
        return 7 + 1;
      }
    };

    ChartTime._granularitySpecs['quarter'] = {
      segments: ['year', 'quarter'],
      mask: '####Q#',
      lowest: 1,
      rolloverValue: function() {
        return 4 + 1;
      }
    };

    ChartTime._expandMask = function(granularitySpec) {
      var character, i, mask, segmentEnd;
      mask = granularitySpec.mask;
      if (mask != null) {
        if (mask.indexOf('#') >= 0) {
          i = mask.length - 1;
          while (mask.charAt(i) !== '#') {
            i--;
          }
          segmentEnd = i;
          while (mask.charAt(i) === '#') {
            i--;
          }
          granularitySpec.segmentStart = i + 1;
          granularitySpec.segmentLength = segmentEnd - i;
          return granularitySpec.regex = new RegExp(((function() {
            var _i, _len, _ref, _results;
            _ref = mask.split('');
            _results = [];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              character = _ref[_i];
              _results.push(character === '#' ? '\\d' : character);
            }
            return _results;
          })()).join(''));
        } else {
          return granularitySpec.regex = new RegExp(mask);
        }
      }
    };

    _ref = ChartTime._granularitySpecs;
    for (g in _ref) {
      spec = _ref[g];
      ChartTime._expandMask(spec);
      ChartTime[g.toUpperCase()] = g;
    }

    timezoneJS.timezone.zoneFileBasePath = '../files/tz';

    timezoneJS.timezone.init();

    ChartTime.prototype._inBoundsCheck = function() {
      var gs, lowest, rolloverValue, segment, segments, temp, _i, _len, _results;
      if (this.beforePastFlag === '' || !(this.beforePastFlag != null)) {
        segments = ChartTime._granularitySpecs[this.granularity].segments;
        _results = [];
        for (_i = 0, _len = segments.length; _i < _len; _i++) {
          segment = segments[_i];
          gs = ChartTime._granularitySpecs[segment];
          temp = this[segment];
          lowest = gs.lowest;
          rolloverValue = gs.rolloverValue(this);
          if (temp < lowest || temp >= rolloverValue) {
            if (temp === lowest - 1) {
              this[segment]++;
              _results.push(this.decrement(segment));
            } else if (temp === rolloverValue) {
              this[segment]--;
              _results.push(this.increment(segment));
            } else {
              throw new Error("Tried to set " + segment + " to " + temp + ". It must be >= " + lowest + " and < " + rolloverValue);
            }
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      }
    };

    ChartTime.prototype._setFromSpec = function(spec) {
      var segment, segments, _i, _len, _results;
      utils.assert(spec.granularity != null, 'A granularity property must be part of the supplied spec.');
      this.granularity = spec.granularity;
      this.beforePastFlag = spec.beforePastFlag != null ? spec.beforePastFlag : '';
      segments = ChartTime._granularitySpecs[this.granularity].segments;
      _results = [];
      for (_i = 0, _len = segments.length; _i < _len; _i++) {
        segment = segments[_i];
        if (spec[segment] != null) {
          _results.push(this[segment] = spec[segment]);
        } else {
          _results.push(this[segment] = ChartTime._granularitySpecs[segment].lowest);
        }
      }
      return _results;
    };

    ChartTime.prototype._setFromString = function(s, granularity) {
      var gs, l, sSplit, segment, segments, stillParsing, sub, tz, zuluCT, _i, _len, _ref1, _ref2, _ref3, _results;
      if (s.slice(-3, -2) === ':' && (_ref1 = s.slice(-6, -5), __indexOf.call('+-', _ref1) >= 0)) {
        s = s.slice(0, -6);
      }
      if (s.slice(-1) === 'Z') {
        s = s.slice(0, -1);
      }
      if (s === 'PAST_LAST' || s === 'BEFORE_FIRST') {
        if (granularity != null) {
          this.granularity = granularity;
          this.beforePastFlag = s;
          return;
        } else {
          throw new Error('PAST_LAST/BEFORE_FIRST must have a granularity');
        }
      }
      sSplit = s.split(' ');
      if ((_ref2 = sSplit[0]) === 'this' || _ref2 === 'next' || _ref2 === 'previous') {
        if (sSplit[2] === 'in' && (sSplit[3] != null)) {
          tz = sSplit[3];
        } else {
          tz = void 0;
        }
        zuluCT = new ChartTime(new Date(), sSplit[1], tz);
        this._setFromSpec(zuluCT);
        if (sSplit[0] === 'next') {
          this.increment();
        } else if (sSplit[0] === 'previous') {
          this.decrement();
        }
        return;
      }
      _ref3 = ChartTime._granularitySpecs;
      for (g in _ref3) {
        spec = _ref3[g];
        if (spec.segmentStart + spec.segmentLength === s.length || spec.mask.indexOf('#') < 0) {
          if (spec.regex.test(s)) {
            granularity = g;
            break;
          }
        }
      }
      if (!(granularity != null)) {
        throw new Error("Error parsing string '" + s + "'. Couldn't identify granularity.");
      }
      this.granularity = granularity;
      segments = ChartTime._granularitySpecs[this.granularity].segments;
      stillParsing = true;
      _results = [];
      for (_i = 0, _len = segments.length; _i < _len; _i++) {
        segment = segments[_i];
        if (stillParsing) {
          gs = ChartTime._granularitySpecs[segment];
          l = gs.segmentLength;
          sub = ChartTime._getStringPart(s, segment);
          if (sub.length !== l) {
            stillParsing = false;
          }
        }
        if (stillParsing) {
          _results.push(this[segment] = Number(sub));
        } else {
          _results.push(this[segment] = ChartTime._granularitySpecs[segment].lowest);
        }
      }
      return _results;
    };

    ChartTime._getStringPart = function(s, segment) {
      var l, st, sub;
      spec = ChartTime._granularitySpecs[segment];
      l = spec.segmentLength;
      st = spec.segmentStart;
      sub = s.substr(st, l);
      return sub;
    };

    ChartTime.prototype._setFromRDN = function(rdn, granularity) {
      var J, a, afterCT, afterRDN, b, beforeCT, beforeRDN, c, d, da, db, dc, dg, granularitySpec, j, m, n, segment, specForLowest, w, x, y, z, _i, _len, _ref1;
      spec = {
        granularity: granularity
      };
      utils.assert(granularity != null, "Must provide a granularity when constructing with a Rata Die Number.");
      switch (granularity) {
        case 'week':
        case 'week_day':
          w = Math.floor((rdn - 1) / 7);
          d = (rdn - 1) % 7;
          n = Math.floor(w / 20871);
          w = w % 20871;
          z = w + (w >= 10435 ? 1 : 0);
          c = Math.floor(z / 5218);
          w = z % 5218;
          x = w * 28 + [15, 23, 3, 11][c];
          y = Math.floor(x / 1461);
          w = x % 1461;
          spec['year'] = y + n * 400 + c * 100 + 1;
          spec['week'] = Math.floor(w / 28) + 1;
          spec['week_day'] = d + 1;
          return this._setFromSpec(spec);
        case 'year':
        case 'month':
        case 'day':
        case 'hour':
        case 'minute':
        case 'second':
        case 'millisecond':
        case 'quarter':
          J = rdn + 1721425;
          j = J + 32044;
          g = Math.floor(j / 146097);
          dg = j % 146097;
          c = Math.floor((Math.floor(dg / 36524) + 1) * 3 / 4);
          dc = dg - c * 36524;
          b = Math.floor(dc / 1461);
          db = dc % 1461;
          a = Math.floor((Math.floor(db / 365) + 1) * 3 / 4);
          da = db - a * 365;
          y = g * 400 + c * 100 + b * 4 + a;
          m = Math.floor((da * 5 + 308) / 153) - 2;
          d = da - Math.floor((m + 4) * 153 / 5) + 122;
          spec['year'] = y - 4800 + Math.floor((m + 2) / 12);
          spec['month'] = (m + 2) % 12 + 1;
          spec['day'] = Math.floor(d) + 1;
          spec['quarter'] = Math.floor((spec.month - 1) / 3) + 1;
          return this._setFromSpec(spec);
        default:
          granularitySpec = ChartTime._granularitySpecs[granularity];
          specForLowest = {
            granularity: granularity
          };
          _ref1 = granularitySpec.segments;
          for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
            segment = _ref1[_i];
            specForLowest[segment] = ChartTime._granularitySpecs[segment].lowest;
          }
          beforeCT = new ChartTime(specForLowest);
          beforeRDN = beforeCT.rataDieNumber();
          afterCT = beforeCT.add(1);
          afterRDN = afterCT.rataDieNumber();
          if (rdn < beforeRDN) {
            this.beforePastFlag = 'BEFORE_FIRST';
            return;
          }
          while (true) {
            if (rdn < afterRDN && rdn >= beforeRDN) {
              this._setFromSpec(beforeCT);
              return;
            }
            beforeCT = afterCT;
            beforeRDN = afterRDN;
            afterCT = beforeCT.add(1);
            afterRDN = afterCT.rataDieNumber();
            if (afterCT.beforePastFlag === 'PAST_LAST') {
              if (rdn >= ChartTime._granularitySpecs[beforeCT.granularity].endBeforeDay.rataDieNumber()) {
                this._setFromSpec(afterCT);
                this.beforePastFlag === 'PAST_LAST';
                return;
              } else if (rdn >= beforeRDN) {
                this._setFromSpec(beforeCT);
                return;
              } else {
                throw new Error("RDN: " + rdn + " seems to be out of range for " + granularity);
              }
            }
          }
          throw new Error("Something went badly wrong setting custom granularity " + granularity + " for RDN: " + rdn);
      }
    };

    ChartTime.prototype._isGranularityCoarserThanDay = function() {
      /*
          @method granularityAboveDay
          @private
          @return {Boolean} true if the ChartTime Object's granularity is above (coarser than) "day" level
      */

      var segment, _i, _len, _ref1;
      _ref1 = ChartTime._granularitySpecs[this.granularity].segments;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        segment = _ref1[_i];
        if (segment.indexOf('day') >= 0) {
          return false;
        }
      }
      return true;
    };

    ChartTime.prototype.getJSDate = function(tz) {
      /*
          @method getJSDate
          @param {String} tz
          @return {Date}
      
          Returns a JavaScript Date Object properly shifted. This Date Object can be compared to other Date Objects that you know
          are already in the desired timezone. If you have data that comes from an API in GMT. You can first create a ChartTime object from
          it and then (using this getJSDate() function) you can compare it to JavaScript Date Objects created in local time.
          
          The full name of this function should be getJSDateInGMTasummingThisCTDateIsInTimezone(tz). It converts **TO** GMT 
          (actually something that can be compared to GMT). It does **NOT** convert **FROM** GMT. Use getJSDateFromGMTInTZ()
          if you want to go in the other direction.
        
          ## Usage ##
          
              ct = new ChartTime('2011-01-01')
              d = new Date(Date.UTC(2011, 0, 1))
              
              console.log(ct.getJSDate('GMT').getTime() == d.getTime())
              # true
              
              console.log(ct.inGranularity(ChartTime.HOUR).add(-5).getJSDate('America/New_York').getTime() == d.getTime())
              # true
      */

      var ct, newDate, offset, utcMilliseconds;
      if (this.beforePastFlag === 'PAST_LAST') {
        return new Date(9999, 0, 1);
      }
      if (this.beforePastFlag === 'BEFORE_FIRST') {
        return new Date('0001-01-01');
      }
      utils.assert(tz != null, 'Must provide a timezone when calling getJSDate');
      ct = this.inGranularity('millisecond');
      utcMilliseconds = Date.UTC(ct.year, ct.month - 1, ct.day, ct.hour, ct.minute, ct.second, ct.millisecond);
      offset = timezoneJS.timezone.getTzInfo(new Date(utcMilliseconds), tz).tzOffset;
      utcMilliseconds += offset * 1000 * 60;
      newDate = new Date(utcMilliseconds);
      return newDate;
    };

    ChartTime.prototype.getISOStringInTZ = function(tz) {
      /*
          @method getShiftedISOString
          @param {String} tz
          @return {String} The canonical ISO-8601 date in zulu representation but shifted to the specified tz
      
              console.log(new ChartTime('2012-01-01').getISOStringInTZ('Europe/Berlin'))
              # 2011-12-31T23:00:00.000Z
      */

      var jsDate;
      utils.assert(tz != null, 'Must provide a timezone when calling getShiftedISOString');
      jsDate = this.getJSDate(tz);
      return ChartTime.getISOStringFromJSDate(jsDate);
    };

    ChartTime.getISOStringFromJSDate = function(jsDate) {
      /*
          @method getISOStringFromJSDate
          @static
          @param {Date} jsDate
          @return {String}
      
          Given a JavaScript Date() Object, this will return the canonical ISO-8601 form.
          
          If you don't provide any parameters, it will return now, like `new Date()` except this is a zulu string.
      
              console.log(ChartTime.getISOStringFromJSDate(new Date(0)))
              # 1970-01-01T00:00:00.000Z
      */

      var day, hour, millisecond, minute, month, s, second, year;
      if (jsDate == null) {
        jsDate = new Date();
      }
      year = jsDate.getUTCFullYear();
      month = jsDate.getUTCMonth() + 1;
      day = jsDate.getUTCDate();
      hour = jsDate.getUTCHours();
      minute = jsDate.getUTCMinutes();
      second = jsDate.getUTCSeconds();
      millisecond = jsDate.getUTCMilliseconds();
      s = ChartTime._pad(year, 4) + '-' + ChartTime._pad(month, 2) + '-' + ChartTime._pad(day, 2) + 'T' + ChartTime._pad(hour, 2) + ':' + ChartTime._pad(minute, 2) + ':' + ChartTime._pad(second, 2) + '.' + ChartTime._pad(millisecond, 3) + 'Z';
      return s;
    };

    ChartTime.prototype.getJSDateFromGMTInTZ = function(tz) {
      /*
          @method getJSDateInTZfromGMT
          @param {String} tz
          @return {Date}
      
          This assumes that the ChartTime is an actual GMT date/time as opposed to some abstract day like Christmas and shifts
          it into the specified timezone.
          
          Note, this function will be off by an hour for the times near midnight on the days where there is a shift to/from daylight 
          savings time. The tz rules engine is designed to go in the other direction so we're mis-using it. This means we are using the wrong
          moment in rules-space for that hour. The cost of fixing this issue was deemed to high for chart applications.
      
              console.log(new ChartTime('2012-01-01').getJSDateFromGMTInTZ('Europe/Berlin'))
              # Sat Dec 31 2011 20:00:00 GMT-0500 (EST)
      */

      var ct, newDate, offset, utcMilliseconds;
      if (this.beforePastFlag === 'PAST_LAST') {
        return new Date(9999, 0, 1);
      }
      if (this.beforePastFlag === 'BEFORE_FIRST') {
        return new Date('0001-01-01');
      }
      utils.assert(tz != null, 'Must provide a timezone when calling getJSDate');
      ct = this.inGranularity('millisecond');
      utcMilliseconds = Date.UTC(ct.year, ct.month - 1, ct.day, ct.hour, ct.minute, ct.second, ct.millisecond);
      offset = timezoneJS.timezone.getTzInfo(new Date(utcMilliseconds), tz).tzOffset;
      utcMilliseconds -= offset * 1000 * 60;
      newDate = new Date(utcMilliseconds);
      return newDate;
    };

    ChartTime.prototype.getSegmentsAsObject = function() {
      /*
          @method getSegmentsAsObject
          @return {Object} Returns a simple JavaScript Object containing the segments. This is useful when using utils.match
          for holiday comparison
      
              t = new ChartTime('2011-01-10')
              console.log(t.getSegmentsAsObject())
              # { year: 2011, month: 1, day: 10 }
      */

      var rawObject, segment, segments, _i, _len;
      segments = ChartTime._granularitySpecs[this.granularity].segments;
      rawObject = {};
      for (_i = 0, _len = segments.length; _i < _len; _i++) {
        segment = segments[_i];
        rawObject[segment] = this[segment];
      }
      return rawObject;
    };

    ChartTime.prototype.toString = function() {
      /*
          @method toString
          @return {String} Uses granularity `mask` in _granularitySpecs to generate the string representation.
      
              t = new ChartTime({year: 2012, month: 1, day: 1, granularity: ChartTime.MINUTE}).toString()
              console.log(t.toString())
              console.log(t)
              # 2012-01-01T00:00
              # 2012-01-01T00:00
      */

      var after, before, granularitySpec, l, s, segment, segments, start, _i, _len, _ref1;
      if ((_ref1 = this.beforePastFlag) === 'BEFORE_FIRST' || _ref1 === 'PAST_LAST') {
        s = "" + this.beforePastFlag;
      } else {
        s = ChartTime._granularitySpecs[this.granularity].mask;
        segments = ChartTime._granularitySpecs[this.granularity].segments;
        for (_i = 0, _len = segments.length; _i < _len; _i++) {
          segment = segments[_i];
          granularitySpec = ChartTime._granularitySpecs[segment];
          l = granularitySpec.segmentLength;
          start = granularitySpec.segmentStart;
          before = s.slice(0, start);
          after = s.slice(start + l);
          s = before + ChartTime._pad(this[segment], l) + after;
        }
      }
      return s;
    };

    ChartTime._pad = function(n, l) {
      var result;
      result = n.toString();
      while (result.length < l) {
        result = '0' + result;
      }
      return result;
    };

    ChartTime.DOW_N_TO_S_MAP = {
      0: 'Sunday',
      1: 'Monday',
      2: 'Tuesday',
      3: 'Wednesday',
      4: 'Thursday',
      5: 'Friday',
      6: 'Saturday',
      7: 'Sunday'
    };

    ChartTime.DOW_MONTH_TABLE = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];

    ChartTime.prototype.dowNumber = function() {
      /*
          @method dowNumber
          @return {Number}
          Returns the day of the week as a number. Monday = 1, Sunday = 7
      
              console.log(new ChartTime('2012-01-01').dowNumber())
              # 7
      */

      var dayNumber, y, _ref1;
      if (this.granularity === 'week_day') {
        return this.week_day;
      }
      if ((_ref1 = this.granularity) === 'day' || _ref1 === 'hour' || _ref1 === 'minute' || _ref1 === 'second' || _ref1 === 'millisecond') {
        y = this.year;
        if (this.month < 3) {
          y--;
        }
        dayNumber = (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + ChartTime.DOW_MONTH_TABLE[this.month - 1] + this.day) % 7;
        if (dayNumber === 0) {
          return 7;
        } else {
          return dayNumber;
        }
      } else {
        return this.inGranularity('day').dowNumber();
      }
    };

    ChartTime.prototype.dowString = function() {
      /*
          @method dowString
          @return {String} Returns the day of the week as a String (e.g. "Monday")
      
              console.log(new ChartTime('2012-01-01').dowString())
              # Sunday
      */
      return ChartTime.DOW_N_TO_S_MAP[this.dowNumber()];
    };

    ChartTime.prototype.rataDieNumber = function() {
      /*
          @method rataDieNumber
          @return {Number} Returns the counting number for days starting with 0001-01-01 (i.e. 0 AD). Note, this differs
          from the Uniz Epoch which starts on 1970-01-01. This function works for
          granularities finer than day (hour, minute, second, millisecond) but ignores the segments of finer granularity than
          day. Also called common era days.
      
              console.log(new ChartTime('0001-01-01').rataDieNumber())
              # 1
      
              rdn2012 = new ChartTime('2012-01-01').rataDieNumber()
              rdn1970 = new ChartTime('1970-01-01').rataDieNumber()
              ms1970To2012 = (rdn2012 - rdn1970) * 24 * 60 * 60 * 1000
              msJSDate2012 = Number(new Date('2012-01-01'))
              console.log(ms1970To2012 == msJSDate2012)
              # true
      */

      var ew, monthDays, y, yearDays;
      if (this.beforePastFlag === 'BEFORE_FIRST') {
        return -1;
      } else if (this.beforePastFlag === 'PAST_LAST') {
        return utils.MAX_INT;
      } else if (ChartTime._granularitySpecs[this.granularity].rataDieNumber != null) {
        return ChartTime._granularitySpecs[this.granularity].rataDieNumber(this);
      } else {
        y = this.year - 1;
        yearDays = y * 365 + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400);
        ew = Math.floor((yearDays + 3) / 7);
        if (this.month != null) {
          monthDays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334][this.month - 1];
          if (this.isLeapYear() && this.month >= 3) {
            monthDays++;
          }
        } else if (this.quarter != null) {
          monthDays = [0, 90, 181, 273][this.quarter - 1];
          if (this.isLeapYear() && this.quarter >= 2) {
            monthDays++;
          }
        } else {
          monthDays = 0;
        }
        switch (this.granularity) {
          case 'year':
            return yearDays + 1;
          case 'month':
          case 'quarter':
            return yearDays + monthDays + 1;
          case 'day':
          case 'hour':
          case 'minute':
          case 'second':
          case 'millisecond':
            return yearDays + monthDays + this.day;
          case 'week':
            return (ew + this.week - 1) * 7 + 1;
          case 'week_day':
            return (ew + this.week - 1) * 7 + this.week_day;
        }
      }
    };

    ChartTime.prototype.inGranularity = function(granularity) {
      /*
          @method inGranularity
          @param {String} granularity
          @return {ChartTime} Returns a new ChartTime object for the same date-time as this object but in the specified granularity.
          Fills in missing finer granularity segments with `lowest` values. Drops segments when convernting to a coarser
          granularity.
      
              console.log(new ChartTime('2012W01-1').inGranularity(ChartTime.DAY).toString())
              # 2012-01-02
      
              console.log(new ChartTime('2012Q3').inGranularity(ChartTime.MONTH).toString())
              # 2012-07
      */

      var newChartTime, tempGranularity, _ref1;
      if ((_ref1 = this.granularity) === 'year' || _ref1 === 'month' || _ref1 === 'day' || _ref1 === 'hour' || _ref1 === 'minute' || _ref1 === 'second' || _ref1 === 'millisecond') {
        if (granularity === 'year' || granularity === 'month' || granularity === 'day' || granularity === 'hour' || granularity === 'minute' || granularity === 'second' || granularity === 'millisecond') {
          tempGranularity = this.granularity;
          this.granularity = granularity;
          newChartTime = new ChartTime(this);
          this.granularity = tempGranularity;
          return newChartTime;
        }
      }
      return new ChartTime(this.rataDieNumber(), granularity);
    };

    ChartTime.prototype.daysInMonth = function() {
      /*
          @method daysInMonth
          @return {Number} Returns the number of days in the current month for this ChartTime
      
              console.log(new ChartTime('2012-02').daysInMonth())
              # 29
      */
      switch (this.month) {
        case 4:
        case 6:
        case 9:
        case 11:
          return 30;
        case 1:
        case 3:
        case 5:
        case 7:
        case 8:
        case 10:
        case 12:
        case 0:
          return 31;
        case 2:
          if (this.isLeapYear()) {
            return 29;
          } else {
            return 28;
          }
      }
    };

    ChartTime.prototype.isLeapYear = function() {
      /*
          @method isLeapYear
          @return {Boolean} true if this is a leap year
      
              console.log(new ChartTime('2012').isLeapYear())
              # true
      */
      if (this.year % 4 === 0) {
        if (this.year % 100 === 0) {
          if (this.year % 400 === 0) {
            return true;
          } else {
            return false;
          }
        } else {
          return true;
        }
      } else {
        return false;
      }
    };

    ChartTime.YEARS_WITH_53_WEEKS = [4, 9, 15, 20, 26, 32, 37, 43, 48, 54, 60, 65, 71, 76, 82, 88, 93, 99, 105, 111, 116, 122, 128, 133, 139, 144, 150, 156, 161, 167, 172, 178, 184, 189, 195, 201, 207, 212, 218, 224, 229, 235, 240, 246, 252, 257, 263, 268, 274, 280, 285, 291, 296, 303, 308, 314, 320, 325, 331, 336, 342, 348, 353, 359, 364, 370, 376, 381, 387, 392, 398];

    ChartTime.prototype.is53WeekYear = function() {
      /*
          @method is53WeekYear
          @return {Boolean} true if this is a 53-week year
      
              console.log(new ChartTime('2015').is53WeekYear())
              # true
      */

      var lookup;
      lookup = this.year % 400;
      return __indexOf.call(ChartTime.YEARS_WITH_53_WEEKS, lookup) >= 0;
    };

    ChartTime.prototype.equal = function(other) {
      /*
          @method equal
          @param {ChartTime} other
          @return {Boolean} Returns true if this equals other. Throws an error if the granularities don't match.
      
              d3 = new ChartTime({granularity: ChartTime.DAY, year: 2011, month: 12, day: 31})
              d4 = new ChartTime('2012-01-01').add(-1)
              console.log(d3.equal(d4))
              # true
      */

      var segment, segments, _i, _len;
      utils.assert(this.granularity === other.granularity, "Granulary of " + this + " does not match granularity of " + other + " on equality/inequality test");
      if (this.beforePastFlag === 'PAST_LAST' && other.beforePastFlag === 'PAST_LAST') {
        return true;
      }
      if (this.beforePastFlag === 'BEFORE_FIRST' && other.beforePastFlag === 'BEFORE_FIRST') {
        return true;
      }
      if (this.beforePastFlag === 'PAST_LAST' && other.beforePastFlag !== 'PAST_LAST') {
        return false;
      }
      if (this.beforePastFlag === 'BEFORE_FIRST' && other.beforePastFlag !== 'BEFORE_FIRST') {
        return false;
      }
      if (other.beforePastFlag === 'PAST_LAST' && this.beforePastFlag !== 'PAST_LAST') {
        return false;
      }
      if (other.beforePastFlag === 'BEFORE_FIRST' && this.beforePastFlag !== 'BEFORE_FIRST') {
        return false;
      }
      segments = ChartTime._granularitySpecs[this.granularity].segments;
      for (_i = 0, _len = segments.length; _i < _len; _i++) {
        segment = segments[_i];
        if (this[segment] !== other[segment]) {
          return false;
        }
      }
      return true;
    };

    ChartTime.prototype.greaterThan = function(other) {
      /*
          @method greaterThan
          @param {ChartTime} other
          @return {Boolean} Returns true if this is greater than other. Throws an error if the granularities don't match
      
              d1 = new ChartTime({granularity: ChartTime.DAY, year: 2011, month: 2, day: 28})
              d2 = new ChartTime({granularity: ChartTime.DAY, year: 2011, month: 3, day: 1})
              console.log(d1.greaterThan(d2))
              # false
              console.log(d2.greaterThan(d1))
              # true
      */

      var segment, segments, _i, _len;
      utils.assert(this.granularity === other.granularity, "Granulary of " + this + " does not match granularity of " + other + " on equality/inequality test");
      if (this.beforePastFlag === 'PAST_LAST' && other.beforePastFlag === 'PAST_LAST') {
        return false;
      }
      if (this.beforePastFlag === 'BEFORE_FIRST' && other.beforePastFlag === 'BEFORE_FIRST') {
        return false;
      }
      if (this.beforePastFlag === 'PAST_LAST' && other.beforePastFlag !== 'PAST_LAST') {
        return true;
      }
      if (this.beforePastFlag === 'BEFORE_FIRST' && other.beforePastFlag !== 'BEFORE_FIRST') {
        return false;
      }
      if (other.beforePastFlag === 'PAST_LAST' && this.beforePastFlag !== 'PAST_LAST') {
        return false;
      }
      if (other.beforePastFlag === 'BEFORE_FIRST' && this.beforePastFlag !== 'BEFORE_FIRST') {
        return true;
      }
      segments = ChartTime._granularitySpecs[this.granularity].segments;
      for (_i = 0, _len = segments.length; _i < _len; _i++) {
        segment = segments[_i];
        if (this[segment] > other[segment]) {
          return true;
        }
        if (this[segment] < other[segment]) {
          return false;
        }
      }
      return false;
    };

    ChartTime.prototype.greaterThanOrEqual = function(other) {
      /*
          @method greaterThanOrEqual
          @param {ChartTime} other
          @return {Boolean} Returns true if this is greater than or equal to other
      
              console.log(new ChartTime('2012').greaterThanOrEqual(new ChartTime('2012')))
              # true
      */

      var gt;
      gt = this.greaterThan(other);
      if (gt) {
        return true;
      }
      return this.equal(other);
    };

    ChartTime.prototype.lessThan = function(other) {
      /*
          @method lessThan
          @param {ChartTime} other
          @return {Boolean} Returns true if this is less than other
      
              console.log(new ChartTime(1000, ChartTime.DAY).lessThan(new ChartTime(999, ChartTime.DAY)))  # Using RDN constructor
              # false
      */
      return other.greaterThan(this);
    };

    ChartTime.prototype.lessThanOrEqual = function(other) {
      /*
          @method lessThanOrEqual
          @param {ChartTime} other
          @return {Boolean} Returns true if this is less than or equal to other
      
              console.log(new ChartTime('this day').lessThanOrEqual(new ChartTime('next day')))  # Using relative constructor
              # true
      */
      return other.greaterThanOrEqual(this);
    };

    ChartTime.prototype._overUnderFlow = function() {
      var granularitySpec, highestLevel, highestLevelSpec, lowest, rolloverValue, value, _ref1;
      if ((_ref1 = this.beforePastFlag) === 'BEFORE_FIRST' || _ref1 === 'PAST_LAST') {
        return true;
      } else {
        granularitySpec = ChartTime._granularitySpecs[this.granularity];
        highestLevel = granularitySpec.segments[0];
        highestLevelSpec = ChartTime._granularitySpecs[highestLevel];
        value = this[highestLevel];
        rolloverValue = highestLevelSpec.rolloverValue(this);
        lowest = highestLevelSpec.lowest;
        if (value >= rolloverValue) {
          this.beforePastFlag = 'PAST_LAST';
          return true;
        } else if (value < lowest) {
          this.beforePastFlag = 'BEFORE_FIRST';
          return true;
        } else {
          return false;
        }
      }
    };

    ChartTime.prototype.decrement = function(granularity) {
      /*
          @method decrement
          @param {String} [granularity]
          @chainable
          @return {ChartTime}
          Decrements this by 1 in the granularity of the ChartTime or the granularity specified if it was specified
      
              console.log(new ChartTime('2016W01').decrement().toString())
              # 2015W53
      */

      var granularitySpec, gs, i, lastDayInMonthFlag, segment, segments, _i, _len, _results;
      if (this.beforePastFlag === 'PAST_LAST') {
        this.beforePastFlag = '';
        granularitySpec = ChartTime._granularitySpecs[this.granularity];
        segments = granularitySpec.segments;
        _results = [];
        for (_i = 0, _len = segments.length; _i < _len; _i++) {
          segment = segments[_i];
          gs = ChartTime._granularitySpecs[segment];
          _results.push(this[segment] = gs.rolloverValue(this) - 1);
        }
        return _results;
      } else {
        lastDayInMonthFlag = this.day === this.daysInMonth();
        if (granularity == null) {
          granularity = this.granularity;
        }
        granularitySpec = ChartTime._granularitySpecs[granularity];
        segments = granularitySpec.segments;
        this[granularity]--;
        if (granularity === 'year') {
          if (this.day > this.daysInMonth()) {
            this.day = this.daysInMonth();
          }
        } else {
          i = segments.length - 1;
          segment = segments[i];
          granularitySpec = ChartTime._granularitySpecs[segment];
          while ((i > 0) && (this[segment] < granularitySpec.lowest)) {
            this[segments[i - 1]]--;
            this[segment] = granularitySpec.rolloverValue(this) - 1;
            i--;
            segment = segments[i];
            granularitySpec = ChartTime._granularitySpecs[segment];
          }
          if (granularity === 'month' && (this.granularity !== 'month')) {
            if (lastDayInMonthFlag || (this.day > this.daysInMonth())) {
              this.day = this.daysInMonth();
            }
          }
        }
        this._overUnderFlow();
        return this;
      }
    };

    ChartTime.prototype.increment = function(granularity) {
      /*
          @method increment
          @param {String} [granularity]
          @chainable
          @return {ChartTime}
          Increments this by 1 in the granularity of the ChartTime or the granularity specified if it was specified
      
              console.log(new ChartTime('2012Q4').increment().toString())
              # 2013Q1
      */

      var granularitySpec, gs, i, lastDayInMonthFlag, segment, segments, _i, _len, _results;
      if (this.beforePastFlag === 'BEFORE_FIRST') {
        this.beforePastFlag = '';
        granularitySpec = ChartTime._granularitySpecs[this.granularity];
        segments = granularitySpec.segments;
        _results = [];
        for (_i = 0, _len = segments.length; _i < _len; _i++) {
          segment = segments[_i];
          gs = ChartTime._granularitySpecs[segment];
          _results.push(this[segment] = gs.lowest);
        }
        return _results;
      } else {
        lastDayInMonthFlag = this.day === this.daysInMonth();
        if (granularity == null) {
          granularity = this.granularity;
        }
        granularitySpec = ChartTime._granularitySpecs[granularity];
        segments = granularitySpec.segments;
        this[granularity]++;
        if (granularity === 'year') {
          if (this.day > this.daysInMonth()) {
            this.day = this.daysInMonth();
          }
        } else {
          i = segments.length - 1;
          segment = segments[i];
          granularitySpec = ChartTime._granularitySpecs[segment];
          while ((i > 0) && (this[segment] >= granularitySpec.rolloverValue(this))) {
            this[segment] = granularitySpec.lowest;
            this[segments[i - 1]]++;
            i--;
            segment = segments[i];
            granularitySpec = ChartTime._granularitySpecs[segment];
          }
          if ((granularity === 'month') && (this.granularity !== 'month')) {
            if (lastDayInMonthFlag || (this.day > this.daysInMonth())) {
              this.day = this.daysInMonth();
            }
          }
        }
        this._overUnderFlow();
        return this;
      }
    };

    ChartTime.prototype.addInPlace = function(qty, granularity) {
      /*
          @method addInPlace
          @chainable
          @param {Number} qty Can be negative for subtraction
          @param {String} [granularity]
          @return {ChartTime} Adds qty to the ChartTime object. It uses increment and decrement so it's not going to be efficient for large values
          of qty, but it should be fine for charts where we'll increment/decrement small values of qty.
      
              console.log(new ChartTime('2011-11-01').addInPlace(3, ChartTime.MONTH).toString())
              # 2012-02-01
      */
      if (granularity == null) {
        granularity = this.granularity;
      }
      if (qty === 0) {
        return this;
      }
      if (qty === 1) {
        this.increment(granularity);
      } else if (qty > 1) {
        this.increment(granularity);
        this.addInPlace(qty - 1, granularity);
      } else if (qty === -1) {
        this.decrement(granularity);
      } else {
        this.decrement(granularity);
        this.addInPlace(qty + 1, granularity);
      }
      return this;
    };

    ChartTime.prototype.add = function(qty, granularity) {
      /*
          @method add
          @param {Number} qty
          @param {String} [granularity]
          @return {ChartTime}
          Adds (or subtracts) quantity (negative quantity) and returns a new ChartTime. Not efficient for large qty.
      
             console.log(new ChartTime('2012-01-01').add(-10, ChartTime.MONTH))
             # 2011-03-01
      */

      var newChartTime;
      newChartTime = new ChartTime(this);
      newChartTime.addInPlace(qty, granularity);
      return newChartTime;
    };

    ChartTime.addGranularity = function(granularitySpec) {
      /*
          @method addGranularity
          @static
          @param {Object} granularitySpec see {@link ChartTime#_granularitySpecs} for existing _granularitySpecs
      
          addGranularity allows you to add your own hierarchical granularities to ChartTime. Once you add a granularity to ChartTime
          you can then instantiate ChartTime objects in your newly specified granularity. You specify new granularities with 
          granularitySpec object like this:
              
              granularitySpec = {
                release: {
                  segments: ['release'],
                  mask: 'R##',
                  lowest: 1,
                  endBeforeDay: new ChartTime('2011-07-01')
                  rolloverValue: (ct) ->
                    return ChartTime._granularitySpecs.iteration.timeBoxes.length + 1  # Yes, it's correct to use the length of iteration.timeBoxes
                  rataDieNumber: (ct) ->
                    return ChartTime._granularitySpecs.iteration.timeBoxes[ct.release-1][1-1].startOn.rataDieNumber()
                },
                iteration: {
                  segments: ['release', 'iteration'],
                  mask: 'R##I##',
                  lowest: 1,
                  endBeforeDay: new ChartTime('2011-07-01')        
                  timeBoxes: [
                    [
                      {startOn: new ChartTime('2011-01-01'), label: 'R1 Iteration 1'},
                      {startOn: new ChartTime('2011-02-01'), label: 'R1 Iteration 2'},
                      {startOn: new ChartTime('2011-03-01'), label: 'R1 Iteration 3'},
                    ],
                    [
                      {startOn: new ChartTime('2011-04-01'), label: 'R2 Iteration 1'},
                      {startOn: new ChartTime('2011-05-01'), label: 'R2 Iteration 2'},
                      {startOn: new ChartTime('2011-06-01'), label: 'R2 Iteration 3'},
                    ]
                  ]
                  rolloverValue: (ct) ->
                    temp = ChartTime._granularitySpecs.iteration.timeBoxes[ct.release-1]?.length + 1
                    if temp? and not isNaN(temp) and ct.beforePastFlag != 'PAST_LAST'
                      return temp
                    else
                      numberOfReleases = ChartTime._granularitySpecs.iteration.timeBoxes.length
                      return ChartTime._granularitySpecs.iteration.timeBoxes[numberOfReleases-1].length + 1
          
                  rataDieNumber: (ct) ->
                    return ChartTime._granularitySpecs.iteration.timeBoxes[ct.release-1][ct.iteration-1].startOn.rataDieNumber()
                },
                iteration_day: {  # By convention, it knows to use day functions on it. This is the lowest allowed custom granularity
                  segments: ['release', 'iteration', 'iteration_day'],
                  mask: 'R##I##-##',
                  lowest: 1,
                  endBeforeDay: new ChartTime('2011-07-01'),
                  rolloverValue: (ct) ->
                    iterationTimeBox = ChartTime._granularitySpecs.iteration.timeBoxes[ct.release-1]?[ct.iteration-1]
                    if !iterationTimeBox? or ct.beforePastFlag == 'PAST_LAST'
                      numberOfReleases = ChartTime._granularitySpecs.iteration.timeBoxes.length
                      numberOfIterationsInLastRelease = ChartTime._granularitySpecs.iteration.timeBoxes[numberOfReleases-1].length
                      iterationTimeBox = ChartTime._granularitySpecs.iteration.timeBoxes[numberOfReleases-1][numberOfIterationsInLastRelease-1]
                      
                    thisIteration = iterationTimeBox.startOn.inGranularity('iteration')
                    nextIteration = thisIteration.add(1)
                    if nextIteration.beforePastFlag == 'PAST_LAST'
                      return ChartTime._granularitySpecs.iteration_day.endBeforeDay.rataDieNumber() - iterationTimeBox.startOn.rataDieNumber() + 1
                    else
                      return nextIteration.rataDieNumber() - iterationTimeBox.startOn.rataDieNumber() + 1
                     
                  rataDieNumber: (ct) ->
                    return ChartTime._granularitySpecs.iteration.timeBoxes[ct.release-1][ct.iteration-1].startOn.rataDieNumber() + ct.iteration_day - 1
                }
              }    
              ChartTime.addGranularity(granularitySpec)
      
          
          The `mask` must cover all of the segments to get down to the granularity being specified. The digits of the granularity segments
          are represented with `#`. Any other characters can be used as a delimeter, but it should always be one character to comply with 
          the expectations of the Lumenize hierarchy visualizations. All of the standard granularities start with a 4-digit year to
          distinguish your custom granularity, your highest level must start with some number of digits other than 4 or a prefix letter 
          (`R` in the example above).
          
          In order for the ChartTimeIterator to work, you must provide `rolloverValue` and `rataDieNumber` callback functions. You should
          be able to mimic (or use as-is) the example above for most use cases. Notice how the `rataDieNumber` function simply leverages
          `rataDieNumber` functions for the standard granularities.
          
          In order to convert into this granularity from some other granularity, you must provide an `inGranularity` callback [NOT YET IMPLEMENTED].
          But ChartTime will convert to any of the standard granularities from even custom granularities as long as a `rataDieNumber()` function
          is provided.
          
          **The `timeBoxes` propoerty in the `granularitySpec` Object above has no special meaning** to ChartTime or ChartTimeIterator. It's simply used
          by the `rolloverValue` and `rataDieNumber` functions. The boundaries could come from where ever you want and even have been encoded as
          literals in the `rolloverValue` and `rataDieNumber` callback functions.
          
          The convention of naming the lowest order granularity with `_day` at the end IS signficant. ChartTime knows to treat that as a day-level
          granularity. If there is a use-case for it, ChartTime could be upgraded to allow you to drill down into hours, minutes, etc. from any
          `_day` granularity but right now those lower order time granularities are only supported for the canonical ISO-6801 form.
      */

      var _results;
      _results = [];
      for (g in granularitySpec) {
        spec = granularitySpec[g];
        ChartTime._expandMask(spec);
        this._granularitySpecs[g] = spec;
        _results.push(ChartTime[g.toUpperCase()] = g);
      }
      return _results;
    };

    return ChartTime;

  })();

  exports.ChartTime = ChartTime;

}).call(this);

});

require.define("/src/utils.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var AssertException, ErrorBase, assert, clone, isArray, match, startsWith, trim, type,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  exports.MAX_INT = 2147483647;

  exports.MIN_INT = -2147483648;

  ErrorBase = (function(_super) {

    __extends(ErrorBase, _super);

    function ErrorBase(message) {
      this.message = message != null ? message : 'Unknown error.';
      if (Error.captureStackTrace != null) {
        Error.captureStackTrace(this, this.constructor);
      }
      this.name = this.constructor.name;
    }

    ErrorBase.prototype.toString = function() {
      return "" + this.name + ": " + this.message;
    };

    return ErrorBase;

  })(Error);

  AssertException = (function(_super) {

    __extends(AssertException, _super);

    function AssertException() {
      return AssertException.__super__.constructor.apply(this, arguments);
    }

    return AssertException;

  })(ErrorBase);

  assert = function(exp, message) {
    if (!exp) {
      throw new exports.AssertException(message);
    }
  };

  match = function(obj1, obj2) {
    var key, value;
    for (key in obj1) {
      if (!__hasProp.call(obj1, key)) continue;
      value = obj1[key];
      if (value !== obj2[key]) {
        return false;
      }
    }
    return true;
  };

  trim = function(val) {
    if (String.prototype.trim != null) {
      return val.trim();
    } else {
      return val.replace(/^\s+|\s+$/g, "");
    }
  };

  startsWith = function(bigString, potentialStartString) {
    return bigString.substring(0, potentialStartString.length) === potentialStartString;
  };

  isArray = function(a) {
    return Object.prototype.toString.apply(a) === '[object Array]';
  };

  type = (function() {
    var classToType, name, _i, _len, _ref;
    classToType = {};
    _ref = "Boolean Number String Function Array Date RegExp Undefined Null".split(" ");
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      name = _ref[_i];
      classToType["[object " + name + "]"] = name.toLowerCase();
    }
    return function(obj) {
      var strType;
      strType = Object.prototype.toString.call(obj);
      return classToType[strType] || "object";
    };
  })();

  clone = function(obj) {
    var key, newInstance;
    if (!(obj != null) || typeof obj !== 'object') {
      return obj;
    }
    newInstance = new obj.constructor();
    for (key in obj) {
      newInstance[key] = clone(obj[key]);
    }
    return newInstance;
  };

  exports.AssertException = AssertException;

  exports.assert = assert;

  exports.match = match;

  exports.trim = trim;

  exports.startsWith = startsWith;

  exports.isArray = isArray;

  exports.type = type;

  exports.clone = clone;

}).call(this);

});

require.define("/src/timezone-js.js",function(require,module,exports,__dirname,__filename,process,global){/*
 * Copyright 2010 Matthew Eernisse (mde@fleegix.org)
 * and Open Source Applications Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Credits: Ideas included from incomplete JS implementation of Olson
 * parser, "XMLDAte" by Philippe Goetz (philippe.goetz@wanadoo.fr)
 *
 * Contributions:
 * Jan Niehusmann
 * Ricky Romero
 * Preston Hunt (prestonhunt@gmail.com),
 * Dov. B Katz (dov.katz@morganstanley.com),
 * Peter Bergström (pbergstr@mac.com)
*/
if (typeof fleegix == 'undefined') { var fleegix = {}; }
if (typeof exports.timezoneJS == 'undefined') { exports.timezoneJS = {}; }

fs = require('fs');
path = require('path');

exports.timezoneJS.timezone = new function() {
  var _this = this;
  var monthMap = { 'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3,'may': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11 };
  var dayMap = {'sun': 0,'mon' :1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6 };
  var regionMap = {'EST':'northamerica','MST':'northamerica','HST':'northamerica','EST5EDT':'northamerica','CST6CDT':'northamerica','MST7MDT':'northamerica','PST8PDT':'northamerica','America':'northamerica','Pacific':'australasia','Atlantic':'europe','Africa':'africa','Indian':'africa','Antarctica':'antarctica','Asia':'asia','Australia':'australasia','Europe':'europe','WET':'europe','CET':'europe','MET':'europe','EET':'europe'};
  var regionExceptions = {'Pacific/Honolulu':'northamerica','Atlantic/Bermuda':'northamerica','Atlantic/Cape_Verde':'africa','Atlantic/St_Helena':'africa','Indian/Kerguelen':'antarctica','Indian/Chagos':'asia','Indian/Maldives':'asia','Indian/Christmas':'australasia','Indian/Cocos':'australasia','America/Danmarkshavn':'europe','America/Scoresbysund':'europe','America/Godthab':'europe','America/Thule':'europe','Asia/Yekaterinburg':'europe','Asia/Omsk':'europe','Asia/Novosibirsk':'europe','Asia/Krasnoyarsk':'europe','Asia/Irkutsk':'europe','Asia/Yakutsk':'europe','Asia/Vladivostok':'europe','Asia/Sakhalin':'europe','Asia/Magadan':'europe','Asia/Kamchatka':'europe','Asia/Anadyr':'europe','Africa/Ceuta':'europe','America/Argentina/Buenos_Aires':'southamerica','America/Argentina/Cordoba':'southamerica','America/Argentina/Tucuman':'southamerica','America/Argentina/La_Rioja':'southamerica','America/Argentina/San_Juan':'southamerica','America/Argentina/Jujuy':'southamerica','America/Argentina/Catamarca':'southamerica','America/Argentina/Mendoza':'southamerica','America/Argentina/Rio_Gallegos':'southamerica','America/Argentina/Ushuaia':'southamerica','America/Aruba':'southamerica','America/La_Paz':'southamerica','America/Noronha':'southamerica','America/Belem':'southamerica','America/Fortaleza':'southamerica','America/Recife':'southamerica','America/Araguaina':'southamerica','America/Maceio':'southamerica','America/Bahia':'southamerica','America/Sao_Paulo':'southamerica','America/Campo_Grande':'southamerica','America/Cuiaba':'southamerica','America/Porto_Velho':'southamerica','America/Boa_Vista':'southamerica','America/Manaus':'southamerica','America/Eirunepe':'southamerica','America/Rio_Branco':'southamerica','America/Santiago':'southamerica','Pacific/Easter':'southamerica','America/Bogota':'southamerica','America/Curacao':'southamerica','America/Guayaquil':'southamerica','Pacific/Galapagos':'southamerica','Atlantic/Stanley':'southamerica','America/Cayenne':'southamerica','America/Guyana':'southamerica','America/Asuncion':'southamerica','America/Lima':'southamerica','Atlantic/South_Georgia':'southamerica','America/Paramaribo':'southamerica','America/Port_of_Spain':'southamerica','America/Montevideo':'southamerica','America/Caracas':'southamerica'};

  function invalidTZError(t) {
    throw new Error('Timezone "' + t + '" is either incorrect, or not loaded in the timezone registry.');
  }
  function builtInLoadZoneFile(fileName, opts) {
    if (typeof fleegix.xhr == 'undefined') {
      throw new Error('Please use the Fleegix.js XHR module, or define your own transport mechanism for downloading zone files.');
    }
    var url = _this.zoneFileBasePath + '/' + fileName;
    if (!opts.async) {
      var ret = fleegix.xhr.doReq({
        url: url,
        async: false
      });
      return _this.parseZones(ret);
    }
    else {
      return fleegix.xhr.send({
        url: url,
        method: 'get',
        handleSuccess: function (str) {
          if (_this.parseZones(str)) {
            if (typeof opts.callback == 'function') {
              opts.callback();
            }
          }
          return true;
        },
        handleErr: function () {
          throw new Error('Error retrieving "' + url + '" zoneinfo file.');
        }
      });
    }
  }
  
  
  function myLoadZoneFile(fileName, opts) {
    var url = _this.zoneFileBasePath + '/' + fileName; // !TODO: convert to nodeJS path
    
    // If running in node.js
    if (fs.readFileSync) {  
      process.chdir(__dirname);
      var ret
      if (fs.existsSync(url)) {
        ret = fs.readFileSync(url, 'utf8');
      } else {
        throw new Error('Cannot find ' + url + ' from directory ' + __dirname);
      }
      return _this.parseZones(ret);
    }
    
    // If running in the browser assume tz files are "fileified" into the source and can be "require"d
    var files = require('files');
    var filesName = 'tz/' + fileName
    if (files[filesName]) {
        return _this.parseZones(files[filesName]);
    } else {
        throw new Error(filesName + ' not found embedded in this package.');
    };

  }
  
  
  function getRegionForTimezone(tz) {
    var exc = regionExceptions[tz];
    var ret;
    if (exc) {
      return exc;
    }
    else {
      reg = tz.split('/')[0];
      ret = regionMap[reg];
      // If there's nothing listed in the main regions for
      // this TZ, check the 'backward' links
      if (!ret) {
        var link = _this.zones[tz];
        if (typeof link == 'string') {
          return getRegionForTimezone(link);
        }
        else {
          // Backward-compat file hasn't loaded yet, try looking in there
          if (!_this.loadedZones.backward) {
            // This is for obvious legacy zones (e.g., Iceland) that
            // don't even have a prefix like "America/" that look like
            // normal zones
            var parsed = _this.loadZoneFile('backward', true);
            return getRegionForTimezone(tz);
          }
          else {
            invalidTZError(tz);
          }
        }
      }
      return ret;
    }
  }
  function parseTimeString(str) {
    var pat = /(\d+)(?::0*(\d*))?(?::0*(\d*))?([wsugz])?$/;
    var hms = str.match(pat);
    hms[1] = parseInt(hms[1], 10);
    hms[2] = hms[2] ? parseInt(hms[2], 10) : 0;
    hms[3] = hms[3] ? parseInt(hms[3], 10) : 0;
    return hms;
  }
  function getZone(dt, tz) {
    var t = tz;
    var zoneList = _this.zones[t];
    // Follow links to get to an acutal zone
    while (typeof zoneList == "string") {
      t = zoneList;
      zoneList = _this.zones[t];
    }
    if (!zoneList) {
      // Backward-compat file hasn't loaded yet, try looking in there
      if (!_this.loadedZones.backward) {
        // This is for backward entries like "America/Fort_Wayne" that
        // getRegionForTimezone *thinks* it has a region file and zone
        // for (e.g., America => 'northamerica'), but in reality it's a
        // legacy zone we need the backward file for
        var parsed = _this.loadZoneFile('backward', true);
        return getZone(dt, tz);
      }
      invalidTZError(t);
    }
    for(var i = 0; i < zoneList.length; i++) {
      var z = zoneList[i];
      if (!z[3]) { break; }
      var yea = parseInt(z[3], 10);
      var mon = 11;
      var dat = 31;
      if (z[4]) {
        mon = monthMap[z[4].substr(0, 3).toLowerCase()];
        dat = parseInt(z[5], 10);
      }
      var t = z[6] ? z[6] : '23:59:59';
      t = parseTimeString(t);
      var d = Date.UTC(yea, mon, dat, t[1], t[2], t[3]);
      if (dt.getTime() < d) { break; }
    }
    if (i == zoneList.length) { throw new Error('No Zone found for "' + timezone + '" on ' + dt); }
    return zoneList[i];

  }
  function getBasicOffset(z) {
    var off = parseTimeString(z[0]);
    var adj = z[0].indexOf('-') == 0 ? -1 : 1
    off = adj * (((off[1] * 60 + off[2]) *60 + off[3]) * 1000);
    return -off/60/1000;
  }

  // if isUTC is true, date is given in UTC, otherwise it's given
  // in local time (ie. date.getUTC*() returns local time components)
  function getRule( date, zone, isUTC ) {
    var ruleset = zone[1];
    var basicOffset = getBasicOffset( zone );

    // Convert a date to UTC. Depending on the 'type' parameter, the date
    // parameter may be:
    // 'u', 'g', 'z': already UTC (no adjustment)
    // 's': standard time (adjust for time zone offset but not for DST)
    // 'w': wall clock time (adjust for both time zone and DST offset)
    //
    // DST adjustment is done using the rule given as third argument
    var convertDateToUTC = function( date, type, rule ) {
      var offset = 0;

      if(type == 'u' || type == 'g' || type == 'z') { // UTC
          offset = 0;
      } else if(type == 's') { // Standard Time
          offset = basicOffset;
      } else if(type == 'w' || !type ) { // Wall Clock Time
          offset = getAdjustedOffset(basicOffset,rule);
      } else {
          throw("unknown type "+type);
      }
      offset *= 60*1000; // to millis

      return new Date( date.getTime() + offset );
    }

    // Step 1:  Find applicable rules for this year.
    // Step 2:  Sort the rules by effective date.
    // Step 3:  Check requested date to see if a rule has yet taken effect this year.  If not,
    // Step 4:  Get the rules for the previous year.  If there isn't an applicable rule for last year, then
    //      there probably is no current time offset since they seem to explicitly turn off the offset
    //      when someone stops observing DST.
    //      FIXME if this is not the case and we'll walk all the way back (ugh).
    // Step 5:  Sort the rules by effective date.
    // Step 6:  Apply the most recent rule before the current time.

    var convertRuleToExactDateAndTime = function( yearAndRule, prevRule )
    {
      var year = yearAndRule[0];
      var rule = yearAndRule[1];

      // Assume that the rule applies to the year of the given date.
      var months = {
        "Jan": 0, "Feb": 1, "Mar": 2, "Apr": 3, "May": 4, "Jun": 5,
        "Jul": 6, "Aug": 7, "Sep": 8, "Oct": 9, "Nov": 10, "Dec": 11
      };

      var days = {
        "sun": 0, "mon": 1, "tue": 2, "wed": 3, "thu": 4, "fri": 5, "sat": 6
      }

      var hms = parseTimeString( rule[ 5 ] );
      var effectiveDate;

      if ( !isNaN( rule[ 4 ] ) ) // If we have a specific date, use that!
      {
        effectiveDate = new Date( Date.UTC( year, months[ rule[ 3 ] ], rule[ 4 ], hms[ 1 ], hms[ 2 ], hms[ 3 ], 0 ) );
      }
      else // Let's hunt for the date.
      {
        var targetDay,
          operator;

        if ( rule[ 4 ].substr( 0, 4 ) === "last" ) // Example: lastThu
        {
          // Start at the last day of the month and work backward.
          effectiveDate = new Date( Date.UTC( year, months[ rule[ 3 ] ] + 1, 1, hms[ 1 ] - 24, hms[ 2 ], hms[ 3 ], 0 ) );
          targetDay = days[ rule[ 4 ].substr( 4, 3 ).toLowerCase( ) ];
          operator = "<=";
        }
        else // Example: Sun>=15
        {
          // Start at the specified date.
          effectiveDate = new Date( Date.UTC( year, months[ rule[ 3 ] ], rule[ 4 ].substr( 5 ), hms[ 1 ], hms[ 2 ], hms[ 3 ], 0 ) );
          targetDay = days[ rule[ 4 ].substr( 0, 3 ).toLowerCase( ) ];
          operator = rule[ 4 ].substr( 3, 2 );
        }

        var ourDay = effectiveDate.getUTCDay( );

        if ( operator === ">=" ) // Go forwards.
        {
          effectiveDate.setUTCDate( effectiveDate.getUTCDate( ) + ( targetDay - ourDay + ( ( targetDay < ourDay ) ? 7 : 0 ) ) );
        }
        else // Go backwards.  Looking for the last of a certain day, or operator is "<=" (less likely).
        {
          effectiveDate.setUTCDate( effectiveDate.getUTCDate( ) + ( targetDay - ourDay - ( ( targetDay > ourDay ) ? 7 : 0 ) ) );
        }
      }

      // if previous rule is given, correct for the fact that the starting time of the current
      // rule may be specified in local time
      if(prevRule) {
        effectiveDate = convertDateToUTC(effectiveDate, hms[4], prevRule);
      }

      return effectiveDate;
    }

    var findApplicableRules = function( year, ruleset )
    {
      var applicableRules = [];

      for ( var i in ruleset )
      {
        if ( Number( ruleset[ i ][ 0 ] ) <= year ) // Exclude future rules.
        {
          if (
            Number( ruleset[ i ][ 1 ] ) >= year                                            // Date is in a set range.
            || ( Number( ruleset[ i ][ 0 ] ) === year && ruleset[ i ][ 1 ] === "only" )    // Date is in an "only" year.
            || ruleset[ i ][ 1 ] === "max"                                                 // We're in a range from the start year to infinity.
          )
          {
            // It's completely okay to have any number of matches here.
            // Normally we should only see two, but that doesn't preclude other numbers of matches.
            // These matches are applicable to this year.
            applicableRules.push( [year, ruleset[ i ]] );
          }
        }
      }

      return applicableRules;
    }

    var compareDates = function( a, b, prev )
    {
      if ( a.constructor !== Date ) {
        a = convertRuleToExactDateAndTime( a, prev );
      } else if(prev) {
        a = convertDateToUTC(a, isUTC?'u':'w', prev);
      }
      if ( b.constructor !== Date ) {
        b = convertRuleToExactDateAndTime( b, prev );
      } else if(prev) {
        b = convertDateToUTC(b, isUTC?'u':'w', prev);
      }

      a = Number( a );
      b = Number( b );

      return a - b;
    }

    var year = date.getUTCFullYear( );
    var applicableRules;

    applicableRules = findApplicableRules( year, _this.rules[ ruleset ] );
    applicableRules.push( date );
    // While sorting, the time zone in which the rule starting time is specified
    // is ignored. This is ok as long as the timespan between two DST changes is
    // larger than the DST offset, which is probably always true.
    // As the given date may indeed be close to a DST change, it may get sorted
    // to a wrong position (off by one), which is corrected below.
    applicableRules.sort( compareDates );

    if ( applicableRules.indexOf( date ) < 2 ) { // If there are not enough past DST rules...
      applicableRules = applicableRules.concat(findApplicableRules( year-1, _this.rules[ ruleset ] ));
      applicableRules.sort( compareDates );
    }

    var pinpoint = applicableRules.indexOf( date );
    if ( pinpoint > 1 && compareDates( date, applicableRules[pinpoint-1], applicableRules[pinpoint-2][1] ) < 0 ) {
      // the previous rule does not really apply, take the one before that
      return applicableRules[ pinpoint - 2 ][1];
    } else if ( pinpoint > 0 && pinpoint < applicableRules.length - 1 && compareDates( date, applicableRules[pinpoint+1], applicableRules[pinpoint-1][1] ) > 0) {
      // the next rule does already apply, take that one
      return applicableRules[ pinpoint + 1 ][1];
    } else if ( pinpoint === 0 ) {
      // no applicable rule found in this and in previous year
      return null;
    } else {
      return applicableRules[ pinpoint - 1 ][1];
    }
  }
  function getAdjustedOffset(off, rule) {
    var save = rule[6];
    var t = parseTimeString(save);
    var adj = save.indexOf('-') == 0 ? -1 : 1;
    var ret = (adj*(((t[1] *60 + t[2]) * 60 + t[3]) * 1000));
    ret = ret/60/1000;
    ret -= off
    ret = -Math.ceil(ret);
    return ret;
  }
  function getAbbreviation(zone, rule) {
    var res;
    var base = zone[2];
    if (base.indexOf('%s') > -1) {
      var repl;
      if (rule) {
        repl = rule[7]=='-'?'':rule[7];
      }
      // FIXME: Right now just falling back to Standard --
      // apparently ought to use the last valid rule,
      // although in practice that always ought to be Standard
      else {
        repl = 'S';
      }
      res = base.replace('%s', repl);
    }
    else if (base.indexOf('/') > -1) {
      // chose one of two alternative strings
      var t = parseTimeString(rule[6]);
      var isDst = (t[1])||(t[2])||(t[3]);
      res = base.split("/",2)[isDst?1:0];
    } else {
      res = base;
    }
    return res;
  }

  this.zoneFileBasePath;
  this.zoneFiles = ['africa', 'antarctica', 'asia',
    'australasia', 'backward', 'etcetera', 'europe',
    'northamerica', 'pacificnew', 'southamerica'];
  this.loadingSchemes = {
    PRELOAD_ALL: 'preloadAll',
    LAZY_LOAD: 'lazyLoad',
    MANUAL_LOAD: 'manualLoad'
  }
  this.loadingScheme = this.loadingSchemes.PRELOAD_ALL;
  this.defaultZoneFile =
    this.loadingScheme == this.loadingSchemes.PRELOAD_ALL ?
      this.zoneFiles : 'northamerica';
  this.loadedZones = {};
  this.zones = {};
  this.rules = {};

  this.init = function (o) {
    var opts = { async: true };
    var sync = false;
    var def = this.defaultZoneFile;
    var parsed;
    // Override default with any passed-in opts
    for (var p in o) {
      opts[p] = o[p];
    }
    if (typeof def == 'string') {
      parsed = this.loadZoneFile(def, opts);
    }
    else {
      if (opts.callback) {
        throw new Error('Async load with callback is not supported for multiple default zonefiles.');
      }
      for (var i = 0; i < def.length; i++) {
        parsed = this.loadZoneFile(def[i], opts);
      }
    }
  };
  // Get the zone files via XHR -- if the sync flag
  // is set to true, it's being called by the lazy-loading
  // mechanism, so the result needs to be returned inline
  this.loadZoneFile = function (fileName, opts) {
    if (typeof this.zoneFileBasePath == 'undefined') {
      throw new Error('Please define a base path to your zone file directory -- timezoneJS.timezone.zoneFileBasePath.');
    }
    // ========================
    // Define your own transport mechanism here
    // and comment out the default below
    // ========================
    if (! this.loadedZones[fileName]) {
      this.loadedZones[fileName] = true;
      // return builtInLoadZoneFile(fileName, opts);
      return myLoadZoneFile(fileName, opts);
    }
  };
  this.loadZoneJSONData = function (url, sync) {
    var processData = function (data) {
      data = eval('('+ data +')');
      for (var z in data.zones) {
        _this.zones[z] = data.zones[z];
      }
      for (var r in data.rules) {
        _this.rules[r] = data.rules[r];
      }
    }
    if (sync) {
      var data = fleegix.xhr.doGet(url);
      processData(data);
    }
    else {
      fleegix.xhr.doGet(processData, url);
    }
  };
  this.loadZoneDataFromObject = function (data) {
    if (!data) { return; }
    for (var z in data.zones) {
      _this.zones[z] = data.zones[z];
    }
    for (var r in data.rules) {
      _this.rules[r] = data.rules[r];
    }
  };
  this.getAllZones = function() {
    var arr = [];
    for (z in this.zones) { arr.push(z); }
    return arr.sort();
  };
  this.parseZones = function(str) {
    var s = '';
    var lines = str.split('\n');
    var arr = [];
    var chunk = '';
    var zone = null;
    var rule = null;
    for (var i = 0; i < lines.length; i++) {
      l = lines[i];
      if (l.match(/^\s/)) {
        l = "Zone " + zone + l;
      }
      l = l.split("#")[0];
      if (l.length > 3) {
        arr = l.split(/\s+/);
        chunk = arr.shift();
        switch(chunk) {
          case 'Zone':
            zone = arr.shift();
            if (!_this.zones[zone]) { _this.zones[zone] = [] }
            _this.zones[zone].push(arr);
            break;
          case 'Rule':
            rule = arr.shift();
            if (!_this.rules[rule]) { _this.rules[rule] = [] }
            _this.rules[rule].push(arr);
            break;
          case 'Link':
            // No zones for these should already exist
            if (_this.zones[arr[1]]) {
              throw new Error('Error with Link ' + arr[1]);
            }
            // Create the link
            _this.zones[arr[1]] = arr[0];
            break;
          case 'Leap':
            break;
          default:
            // Fail silently
            break;
        }
      }
    }
    return true;
  };
  this.getTzInfo = function(dt, tz, isUTC) {
    // Lazy-load any zones not yet loaded
    if (this.loadingScheme == this.loadingSchemes.LAZY_LOAD) {
      // Get the correct region for the zone
      var zoneFile = getRegionForTimezone(tz);
      if (!zoneFile) {
        throw new Error('Not a valid timezone ID.');
      }
      else {
        if (!this.loadedZones[zoneFile]) {
          // Get the file and parse it -- use synchronous XHR
          var parsed = this.loadZoneFile(zoneFile, true);
        }
      }
    }
    var zone = getZone(dt, tz);
    var off = getBasicOffset(zone);
    // See if the offset needs adjustment
    var rule = getRule(dt, zone, isUTC);
    if (rule) {
      off = getAdjustedOffset(off, rule);
    }
    var abbr = getAbbreviation(zone, rule);
    return { tzOffset: off, tzAbbr: abbr };
  }
};
  
exports.timezoneJS.parseISO = function (timestring) {
  var pat = '^(?:([+-]?[0-9]{4,})(?:-([0-9]{2})(?:-([0-9]{2}))?)?)?' +
    '(?:T(?:([0-9]{2})(?::([0-9]{2})(?::([0-9]{2})(?:\\.' +
    '([0-9]{3}))?)?)?)?(Z|[-+][0-9]{2}:[0-9]{2})?)?$';
  var match = timestring.match(pat);
  if (match) {
    var parts = {
      year: match[1] || 0,
      month:  match[2] || 1,
      day:  match[3] || 1,
      hour:  match[4] || 0,
      minute:  match[5] || 0,
      second:  match[6] || 0,
      milli:  match[7] || 0,
      offset:  match[8] || "Z"
    };

    var utcDate = Date.UTC(parts.year, parts.month-1, parts.day,
      parts.hour, parts.minute, parts.second, parts.milli);

    if (parts.offset !== "Z") {
      match = parts.offset.match('([-+][0-9]{2})(?::([0-9]{2}))?');
      if (!match) {
        return NaN;
      }
      var offset = match[1]*60*60*1000+(match[2] || 0)*60*1000;
      utcDate -= offset;
    }
    
    return new Date(utcDate);
  }
  else {
    return null;
  }
};





});

require.define("fs",function(require,module,exports,__dirname,__filename,process,global){// nothing to see here... no file methods for the browser

});

require.define("/src/ChartTimeIteratorAndRange.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var ChartTime, ChartTimeInStateCalculator, ChartTimeIterator, ChartTimeRange, timezoneJS, utils,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  ChartTime = require('./ChartTime').ChartTime;

  ChartTimeInStateCalculator = require('./ChartTimeInStateCalculator').ChartTimeInStateCalculator;

  timezoneJS = require('./timezone-js.js').timezoneJS;

  utils = require('./utils');

  ChartTimeIterator = (function() {
    /*
      @class ChartTimeIterator
    
      # ChartTimeIterator #
      
      Iterate through days, months, years, etc. skipping weekends and holidays that you 
      specify. It will also iterate over hours, minutes, seconds, etc. and skip times that are not
      between the specified work hours.
      
      ## Usage ##
      
          {ChartTimeIterator, ChartTimeRange, ChartTime} = require('../')
          
          cti = new ChartTimeIterator({
            startOn:new ChartTime({granularity: 'day', year: 2009, month:1, day: 1}),
            endBefore:new ChartTime({granularity: 'day', year: 2009, month:1, day: 8}),
            workDays: 'Monday, Tuesday, Wednesday, Thursday, Friday',
            holidays: [
              {month: 1, day: 1},  # New Years day was a Thursday in 2009
              {year: 2009, month: 1, day: 2}  # Also got Friday off in 2009
            ]
          })
      
          while (cti.hasNext())
            console.log(cti.next().toString())
      
          # 2009-01-05
          # 2009-01-06
          # 2009-01-07
    */

    var StopIteration;

    function ChartTimeIterator(ctr, emit, childGranularity, tz) {
      var _ref, _ref1;
      this.emit = emit != null ? emit : 'ChartTime';
      this.childGranularity = childGranularity != null ? childGranularity : 'day';
      /*
          @constructor
          @param {ChartTimeRange} ctr A ChartTimeRange or a raw Object with all the necessary properties to be a spec for a new ChartTimeRange.
             Using a ChartTimeRange is now the preferred method. The raw Object is supported for backward compatibility.
          @param {String} [emit] An optional String that specifies what should be emitted. Possible values are 'ChartTime' (default),
             'ChartTimeRange', and 'Date' (javascript Date Object). Note, to maintain backward compatibility with the time
             before ChartTimeRange existed, the default for emit when instantiating a new ChartTimeIterator directly is 
             'ChartTime'. However, if you request a new ChartTimeIterator from a ChartTimeRange object using getIterator(),
             the default is 'ChartTimeRange'.
          @param {String} [childGranularity] When emit is 'ChartTimeRange', this is the granularity for the startOn and endBefore of the
             ChartTimeRange that is emitted.
          @param {String} [tz] A Sting specifying the timezone in the standard form,`America/New_York` for example.
      */

      utils.assert((_ref = this.emit) === 'ChartTime' || _ref === 'ChartTimeRange' || _ref === 'Date', "emit must be 'ChartTime', 'ChartTimeRange', or 'Date'. You provided " + this.emit + ".");
      utils.assert(this.emit !== 'Date' || (tz != null), 'Must provide a tz (timezone) parameter when emitting Dates.');
      if ((_ref1 = this.tz) == null) {
        this.tz = tz;
      }
      if (ctr instanceof ChartTimeRange) {
        this.ctr = ctr;
      } else {
        this.ctr = new ChartTimeRange(ctr);
      }
      this.startOver();
    }

    StopIteration = typeof StopIteration === 'undefined' ? utils.StopIteration : StopIteration;

    ChartTimeIterator.prototype.startOver = function() {
      /*
          @method startOver
      
          Will go back to the where the iterator started.
      */
      if (this.ctr.step > 0) {
        this.current = new ChartTime(this.ctr.startOn);
      } else {
        this.current = new ChartTime(this.ctr.endBefore);
        this.current.decrement();
      }
      this.count = 0;
      return this._proceedToNextValid();
    };

    ChartTimeIterator.prototype.hasNext = function() {
      /*
          @method hasNext
          @return {Boolean} Returns true if there are still things left to iterator over. Note that if there are holidays,
             weekends or non-workhours to skip, then hasNext() will take that into account. For example if the endBefore is a
             Sunday, hasNext() will return true the next time it is called after the Friday is emitted.
      */
      return this.ctr.contains(this.current) && (this.count < this.ctr.limit);
    };

    ChartTimeIterator.prototype._shouldBeExcluded = function() {
      var currentInDay, currentMinutes, holiday, _i, _len, _ref, _ref1, _ref2;
      if (this.current._isGranularityCoarserThanDay()) {
        return false;
      }
      currentInDay = this.current.inGranularity('day');
      if (_ref = this.current.dowString(), __indexOf.call(this.ctr.workDays, _ref) < 0) {
        return true;
      }
      _ref1 = this.ctr.holidays;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        holiday = _ref1[_i];
        if (utils.match(holiday, currentInDay)) {
          return true;
        }
      }
      if ((_ref2 = this.ctr.granularity) === 'hour' || _ref2 === 'minute' || _ref2 === ' second' || _ref2 === 'millisecond') {
        currentMinutes = this.current.hour * 60;
        if (this.current.minute != null) {
          currentMinutes += this.current.minute;
        }
        if (this.ctr.startOnWorkMinutes <= this.ctr.endBeforeWorkMinutes) {
          if ((currentMinutes < this.ctr.startOnWorkMinutes) || (currentMinutes >= this.ctr.endBeforeWorkMinutes)) {
            return true;
          }
        } else {
          if ((this.ctr.startOnWorkMinutes >= currentMinutes && currentMinutes > this.ctr.endBeforeWorkMinutes)) {
            return true;
          }
        }
      }
      return false;
    };

    ChartTimeIterator.prototype._proceedToNextValid = function() {
      var _results;
      _results = [];
      while (this.hasNext() && this._shouldBeExcluded()) {
        if (this.ctr.step > 0) {
          _results.push(this.current.increment());
        } else {
          _results.push(this.current.decrement());
        }
      }
      return _results;
    };

    ChartTimeIterator.prototype.next = function() {
      /*
          @method next
          @return {ChartTime/Date/ChartTimeRange} Returns the next value of the iterator. The start will be the first value emitted unless it should
             be skipped due to holiday, weekend, or workhour knockouts.
      */

      var childCTR, currentCopy, i, spec, _i, _ref;
      if (!this.hasNext()) {
        throw new StopIteration('Cannot call next() past end.');
      }
      currentCopy = new ChartTime(this.current);
      this.count++;
      for (i = _i = _ref = Math.abs(this.ctr.step); _ref <= 1 ? _i <= 1 : _i >= 1; i = _ref <= 1 ? ++_i : --_i) {
        if (this.ctr.step > 0) {
          this.current.increment();
        } else {
          this.current.decrement();
        }
        this._proceedToNextValid();
      }
      switch (this.emit) {
        case 'ChartTime':
          return currentCopy;
        case 'Date':
          return currentCopy.getJSDate(this.tz);
        case 'ChartTimeRange':
          spec = {
            startOn: currentCopy.inGranularity(this.childGranularity),
            endBefore: this.current.inGranularity(this.childGranularity),
            workDays: this.ctr.workDays,
            holidays: this.ctr.holidays,
            workDayStartOn: this.ctr.workDayStartOn,
            workDayEndBefore: this.ctr.workDayEndBefore
          };
          childCTR = new ChartTimeRange(spec);
          return childCTR;
      }
    };

    ChartTimeIterator.prototype.getAll = function() {
      /*
          @method getAll
          @return {ChartTime[]/Date[]/ChartTimeRange[]}
          Returns all values as an array.
      */

      var temp;
      this.startOver();
      temp = [];
      while (this.hasNext()) {
        temp.push(this.next());
      }
      return temp;
    };

    ChartTimeIterator.prototype.getChartTimeInStateCalculator = function(tz) {
      var ctrisc;
      ctrisc = new ChartTimeInStateCalculator(this, tz);
      return ctrisc;
    };

    return ChartTimeIterator;

  })();

  ChartTimeRange = (function() {
    /*
      @class ChartTimeRange
    
      # ChartTimeRange #
      
      Allows you to specify a range for iterating over or identifying if it `contains()` some other date.
      This `contains()` comparision can be done in a timezone sensitive way.
      
      ## Usage ##
     
      Let's create the `spec` for our ChartTimeRange
      
          {ChartTimeIterator, ChartTimeRange, ChartTime} = require('../')
          
          r = new ChartTimeRange({
            startOn:new ChartTime('2011-01-02'),
            endBefore:new ChartTime('2011-01-07'),
            holidays: [
              {month: 1, day: 1},  # Notice the lack of a year specification
              {year: 2011, month: 1, day: 2}  # Got January 2 off also in 2011
            ]
          })
          
      `workDays` is already defaulted but you could have overridden it.
      
          console.log(r.workDays)
          # [ 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday' ]
          
      Now let's get an iterator over this range.
          
          i = r.getIterator('ChartTime')
          
          while i.hasNext()
            console.log(i.next().toString()) 
                 
          # 2011-01-03
          # 2011-01-04
          # 2011-01-05
          # 2011-01-06
      
      Notice how 2011-01-02 was skipped because it was a holiday. Also notice how the endBefore is not included.
      Ranges are inclusive of the startOn and exclusive of the endBefore. This allows the endBefore of one to be
      the startOn of the next with no overlap or gap. This focus on precision pervades the design of the ChartTime library.
      
      Now, let's create a ChartTimeRange with `hour` granularity to elaborate on this inclusive/exclusive behavior.
          
          r2 = new ChartTimeRange({
            startOn:new ChartTime('2011-01-02T00'),
            endBefore:new ChartTime('2011-01-07T00'),
          })
          
      `startOn` is inclusive.
      
          console.log(r2.contains(new ChartTime('2011-01-02T00')))
          # true
          
      But `endBefore` is exclusive
      
          console.log(r2.contains(new ChartTime('2011-01-07T00')))
          # false
      
      But just before `endBefore` is OK
      
          console.log(r2.contains('2011-01-06T23'))
          # true
          
      In the above line, notice how we omitted the `new ChartTime(...)`. If you pass in a string without a timezone, 
      it will automatically create the ChartTime to do the comparison.
      
      All of the above comparisons assume that the `startOn`/`endBefore` boundaries are in the same timezone as the contains date.
      
      ## Timezone sensitive comparisions ##
      
      Now, let's look at how you do timezone sensitive comparisions.
      
      If you pass in a timezone, then it will shift the CharTimeRange boundaries to that timezone to compare to the 
      date/timestamp that you pass in. This system is optimized to the pattern where you first define your boundaries without regard 
      to timezone. Christmas day is a holiday in any timezone. Saturday and Sunday are non work days in any timezone. The iteration
      starts on July 10th; etc. THEN you have a bunch of data that you have stored in a database in GMT. Maybe you've pulled
      it down from an API but the data is represented with a GMT date/timestamp. You then want to decide if the GMT date/timestamp 
      is contained within the iteration as defined by a particular timezone, or is a Saturday, or is during workhours, etc. 
      The key concept to remember is that the timebox boundaries are shifted NOT the other way around. It says at what moment
      in time July 10th starts on in a particular timezone and internally represents that in a way that can be compared to a GMT
      date/timestamp.
      
      So, when it's 3am in GMT on 2011-01-02, it's still 2011-01-01 in New York. Using the above `r2` range, we say:
      
          console.log(r2.contains('2011-01-02T03:00:00.000Z', 'America/New_York'))
          # false
          
      But it's still 2011-01-06 in New York, when it's 3am in GMT on 2011-01-07
          
          console.log(r2.contains('2011-01-07T03:00:00.000Z', 'America/New_York'))
          # true
          
      Now, let's explore how ChartTimeRanges and ChartTimeIterators are used together. Here is a range spec.
    
          r3 = new ChartTimeRange({
            startOn:new ChartTime('2011-01-06'),
            endBefore:new ChartTime('2011-01-11'),
            workDayStartOn: {hour: 9, minute: 0},
            workDayEndBefore: {hour: 11, minute: 0}  # Very short work day for demo purposes
          })
              
      You can ask for an iterator to emit ChartTimeRanges rather than ChartTime values. On each call to `next()`, the
      iterator will give you a new ChartTimeRange with the `startOn` value set to what you would have gotten had you
      requested that it emit ChartTimes. The `endBefore' of the emitted ChartTimeRange will be set to the following value.
      This is how you drill-down from one granularity into a lower granularity.
      
      By default, the granularity of the iterator will equal the `startOn`/`endBefore` of the original ChartTimeRange.
      However, you can provide a different granularity (`hour` in the example below) for the iterator if you want 
      to drill-down at a lower granularity.
      
          i3 = r3.getIterator('ChartTimeRange', 'hour')
          
          while i3.hasNext()
            subRange = i3.next()
            console.log("Sub range goes from #{subRange.startOn.toString()} to #{subRange.endBefore.toString()}")
            subIterator = subRange.getIterator('ChartTime')
            while subIterator.hasNext()
              console.log('    Hour: ' + subIterator.next().hour)
              
          # Sub range goes from 2011-01-06T00 to 2011-01-07T00
          #     Hour: 9
          #     Hour: 10
          # Sub range goes from 2011-01-07T00 to 2011-01-10T00
          #     Hour: 9
          #     Hour: 10
          # Sub range goes from 2011-01-10T00 to 2011-01-11T00
          #     Hour: 9
          #     Hour: 10
              
      There is a lot going on here, so let's poke at it a bit. First, notice how the second sub-range goes from the 7th to the
      10th. That's because there was a weekend in there. We didn't get hours for the Saturday and Sunday.
          
      The above approach (`r3`/`i3`) is useful for some forms of hand generated analysis, but if you are using ChartTime with 
      Lumenize, it's overkill because Lumenize is smart enough to do rollups based upon the segments that are emitted from the
      lowest granularity ChartTime. So you can just iterate over the lower granularity and Lumenize will automatically manage 
      the drill up/down to day/month/year levels automatically.
      
          r4 = new ChartTimeRange({
            startOn:'2011-01-06T00',  # Notice how we include the hour now
            endBefore:'2011-01-11T00',
            workDayStartOn: {hour: 9, minute: 0},
            workDayEndBefore: {hour: 11, minute: 0}  # Very short work day for demo purposes
          })
              
      Notice how we are able to simply use strings to represent the startOn/endBefore dates. ChartTimeRange automatically constructs
      ChartTime objects from those strings. We could have done that in the earlier examples. I chose not to do so to illustrate
      how ChartTimes are used under the covers.
    
          i4 = r4.getIterator('ChartTime')
          
          while i4.hasNext()
            console.log(i4.next().toString())
            
          # 2011-01-06T09
          # 2011-01-06T10
          # 2011-01-07T09
          # 2011-01-07T10
          # 2011-01-10T09
          # 2011-01-10T10
          
      `r4`/`i4` covers the same ground as `r3`/`i3` but without the explicit nesting.
    */

    function ChartTimeRange(spec) {
      /*
          @constructor
          @param {Object} spec
      
          spec can have the following properties:
      
          * **startOn** is a ChartTime object or a string. The first value that next() returns.
          * **endBefore** is a ChartTime object or string. Must match granularity. hasNext() returns false when current is here or later.
          * **limit** you can specify limit and either startOn or endBefore and only get back this many. Must specify 2 out of
             3 of startOn, endBefore, and limit.
          * **step** is an optional parameter. Defaults to 1 or -1. Use -1 to march backwards from endBefore - 1. Currently any
             values other than 1 and -1 may give unexpected behavior. It should be able to step by more but there are not
             good tests around it now.
          * **granularity** is used to determine the granularity that you will iterate over. Note, this is independent of the
             granularity you have used to specify startOn and endBefore. For example:
      
                 {startOn: '2012-01', # Month Granularity
                  endBefore: '2012-02', # Month Granularity
                  granularity: ChartTime.DAY} # Day granularity}
      
          * **workDays** list of days of the week that you work on. You can specify this as an Array of Strings
             (['Monday', 'Tuesday', ...]) or a single comma seperated String ("Monday,Tuesday,...").
             Defaults to ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].
          * **holidays** is an optional Array of either ISOStrings or JavaScript Objects (and you can mix and match). Example:
      
                [{month: 12, day: 25}, {year: 2011, month: 11, day: 24}, "2012-12-24"]
      
             Notice how you can leave off the year if the holiday falls on the same day every year.
          * **workDayStartOn** is an optional object in the form {hour: 8, minute: 15}. If minute is zero it can be omitted.
             If workDayStartOn is later than workDayEndBefore, then it assumes that you work the night shift and your work
             hours span midnight.
          * **workDayEndBefore** is an optional object in the form {hour: 17, minute: 0}. If minute is zero it can be omitted.
             The use of workDayStartOn and workDayEndBefore only make sense when the granularity is "hour" or finer.
             Note: If the business closes at 5:00pm, you'll want to leave workDayEndBefore to 17:00, rather
             than 17:01. Think about it, you'll be open 4:59:59.999pm, but you'll be closed at 5:00pm. This also makes all of
             the math work. 9am to 5pm means 17 - 9 = an 8 hour work day.
      */

      var h, holiday, idx, m, s, _i, _len, _ref, _ref1;
      if (spec.endBefore != null) {
        this.endBefore = spec.endBefore;
        if (this.endBefore !== 'PAST_LAST') {
          if (utils.type(this.endBefore) === 'string') {
            this.endBefore = new ChartTime(this.endBefore);
          }
          this.granularity = this.endBefore.granularity;
        }
      }
      if (spec.startOn != null) {
        this.startOn = spec.startOn;
        if (this.startOn !== 'BEFORE_FIRST') {
          if (utils.type(this.startOn) === 'string') {
            this.startOn = new ChartTime(this.startOn);
          }
          this.granularity = this.startOn.granularity;
        }
      }
      if (spec.granularity != null) {
        this.granularity = spec.granularity;
        if (this.startOn != null) {
          this.startOn = this.startOn.inGranularity(this.granularity);
        }
        if (this.endBefore != null) {
          this.endBefore = this.endBefore.inGranularity(this.granularity);
        }
      }
      if (!this.granularity) {
        throw new Error('Cannot determine granularity for ChartTimeRange.');
      }
      if (this.startOn === 'BEFORE_FIRST') {
        this.startOn = new ChartTime(this.startOn, this.granularity);
      }
      if (this.endBefore === 'PAST_LAST') {
        this.endBefore === new ChartTime(this.endBefore, this.granularity);
      }
      if (!this.endBefore) {
        this.endBefore = new ChartTime('PAST_LAST', this.granularity);
      }
      if (!this.startOn) {
        this.startOn = new ChartTime('BEFORE_FIRST', this.granularity);
      }
      this.limit = spec.limit != null ? spec.limit : utils.MAX_INT;
      if (spec.workDays != null) {
        this.workDays = spec.workDays;
      } else if (spec.workdays != null) {
        this.workDays = spec.workdays;
      } else {
        this.workDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      }
      if (utils.type(this.workDays) === 'string') {
        this.workDays = (function() {
          var _i, _len, _ref, _results;
          _ref = this.workDays.split(',');
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            s = _ref[_i];
            _results.push(utils.trim(s));
          }
          return _results;
        }).call(this);
      }
      this.holidays = spec.holidays != null ? spec.holidays : [];
      _ref = this.holidays;
      for (idx = _i = 0, _len = _ref.length; _i < _len; idx = ++_i) {
        holiday = _ref[idx];
        if (utils.type(holiday) === 'string') {
          this.holidays[idx] = new ChartTime(holiday).getSegmentsAsObject();
        }
      }
      this.workDayStartOn = spec.workDayStartOn != null ? spec.workDayStartOn : void 0;
      if (this.workDayStartOn != null) {
        h = this.workDayStartOn.hour != null ? this.workDayStartOn.hour : 0;
        m = this.workDayStartOn.minute != null ? this.workDayStartOn.minute : 0;
        this.startOnWorkMinutes = h * 60 + m;
        if (this.startOnWorkMinutes < 0) {
          this.startOnWorkMinutes = 0;
        }
      } else {
        this.startOnWorkMinutes = 0;
      }
      this.workDayEndBefore = spec.workDayEndBefore != null ? spec.workDayEndBefore : void 0;
      if (this.workDayEndBefore != null) {
        h = this.workDayEndBefore.hour != null ? this.workDayEndBefore.hour : 24;
        m = this.workDayEndBefore.minute != null ? this.workDayEndBefore.minute : 0;
        this.endBeforeWorkMinutes = h * 60 + m;
        if (this.endBeforeWorkMinutes > 24 * 60) {
          this.endBeforeWorkMinutes = 24 * 60;
        }
      } else {
        this.endBeforeWorkMinutes = 24 * 60;
      }
      if (spec.step != null) {
        this.step = spec.step;
      } else if ((spec.endBefore != null) && ((_ref1 = this.startOn) != null ? _ref1.greaterThan(this.endBefore) : void 0)) {
        this.step = -1;
      } else if ((spec.endBefore != null) && !(spec.startOn != null) && (spec.limit != null)) {
        this.step = -1;
      } else {
        this.step = 1;
      }
      utils.assert(((spec.startOn != null) && (spec.endBefore != null)) || ((spec.startOn != null) && (spec.limit != null) && this.step > 0) || ((spec.endBefore != null) && (spec.limit != null) && this.step < 0), 'Must provide two out of "startOn", "endBefore", or "limit" and the sign of step must match.');
    }

    ChartTimeRange.prototype.getIterator = function(emit, childGranularity, tz) {
      if (emit == null) {
        emit = 'ChartTimeRange';
      }
      if (childGranularity == null) {
        childGranularity = 'day';
      }
      /*
          @method getIterator
          @param {String} [emit]
          @param {String} [childGranularity]
          @param {String} [tz]
          @return {ChartTimeIterator}
      
          Returns a new ChartTimeIterator using this ChartTimeRange as the boundaries.
          
          Note, to maintain backward compatibility with the time before ChartTimeRange existed, the default for emit when 
          instantiating a new ChartTimeIterator directly is 'ChartTime'. However, if you request a new ChartTimeIterator 
          from a ChartTimeRange object using getIterator(), the default is 'ChartTimeRange'.
      */

      return new ChartTimeIterator(this, emit, childGranularity, tz);
    };

    ChartTimeRange.prototype.getAll = function(emit, childGranularity, tz) {
      if (emit == null) {
        emit = 'ChartTimeRange';
      }
      if (childGranularity == null) {
        childGranularity = 'day';
      }
      /*
          @method getAll
          @param {String} [emit]
          @param {String} [childGranularity]
          @param {String} [tz]
          @return {ChartTime[]/Date[]/ChartTimeRange[]}
      
          Returns all of the points in the timeline specified by this ChartTimeRange.
          
          Note, to maintain backward compatibility with the time before ChartTimeRange existed, the default for emit when 
          instantiating a new ChartTimeIterator directly is 'ChartTime'. However, if you request a new ChartTimeIterator 
          from a ChartTimeRange object using getIterator(), the default is 'ChartTimeRange'.
      */

      return new ChartTimeIterator(this, emit, childGranularity, tz).getAll();
    };

    ChartTimeRange.prototype.getTimeline = function() {
      /*
          @method getTimeline
          @return {ChartTime[]}
      
          Returns all of the points in the timeline specified by this ChartTimeRange as ChartTime objects. This method also
          makes sure that the array that is returned is sorted chrologically.
      */

      var timeline;
      timeline = new ChartTimeIterator(this, 'ChartTime', this.granularity).getAll();
      if (timeline.length > 1 && timeline[0].greaterThan(timeline[1])) {
        timeline.reverse();
      }
      return timeline;
    };

    ChartTimeRange.prototype.contains = function(date, tz) {
      /*
          @method contains
          @param {ChartTime/Date/String} date can be either a JavaScript date object or an ISO-8601 formatted string
          @param {String} [tz]
          @return {Boolean} true if the date provided is within this ChartTimeRange.
      
          ## Usage: ##
          
          We can create a range from May to July.
          
              r = new ChartTimeRange({
                startOn: '2011-05',
                endBefore: '2011-07'
              })
              
              console.log(r.contains('2011-06-15T12:00:00.000Z', 'America/New_York'))
              # true
      */

      var endBefore, startOn, target;
      if (date instanceof ChartTime) {
        return date.lessThan(this.endBefore) && date.greaterThanOrEqual(this.startOn);
      }
      utils.assert((tz != null) || utils.type(date) !== 'date', 'ChartTimeRange.contains() requires a second parameter (timezone) when the first parameter is a Date()');
      switch (utils.type(date)) {
        case 'string':
          if (tz != null) {
            target = timezoneJS.parseISO(date);
          } else {
            target = new ChartTime(date);
            return target.lessThan(this.endBefore) && target.greaterThanOrEqual(this.startOn);
          }
          break;
        case 'date':
          target = date.getTime();
          break;
        default:
          throw new Error('ChartTimeRange.contains() requires that the first parameter be of type ChartTime, String, or Date');
      }
      startOn = this.startOn.getJSDate(tz);
      endBefore = this.endBefore.getJSDate(tz);
      return target < endBefore && target >= startOn;
    };

    return ChartTimeRange;

  })();

  exports.ChartTimeRange = ChartTimeRange;

  exports.ChartTimeIterator = ChartTimeIterator;

}).call(this);

});

require.define("/src/ChartTimeInStateCalculator.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var ChartTimeInStateCalculator, utils;

  utils = require('./utils');

  ChartTimeInStateCalculator = (function() {
    /*
      @class ChartTimeInStateCalculator
    
      Used to calculate how much time each uniqueID spent "in-state". You use this by querying a temporal data
      model (like Rally's Lookback API) with a predicate indicating the "state" of interest. You'll then have a list of
      snapshots where that predicate was true. You pass this in to the timeInState method of this previously instantiated
      ChartTimeInStateCalculator class to identify how many "ticks" of the timeline specified by the iterator you used
      to instantiate this class.
      
      Usage:
      
          charttime = require('../')
          {ChartTimeRange, ChartTime, ChartTimeIterator, ChartTimeInStateCalculator} = charttime
    
          snapshots = [ 
            { id: 1, from: '2011-01-06T15:10:00.000Z', to: '2011-01-06T15:30:00.000Z' }, # 20 minutes all within an hour
            { id: 2, from: '2011-01-06T15:50:00.000Z', to: '2011-01-06T16:10:00.000Z' }, # 20 minutes spanning an hour
            { id: 3, from: '2011-01-07T13:00:00.000Z', to: '2011-01-07T15:20:00.000Z' }, # start 2 hours before but overlap by 20 minutes of start
            { id: 4, from: '2011-01-06T16:40:00.000Z', to: '2011-01-06T19:00:00.000Z' }, # 20 minutes before end of day
            { id: 5, from: '2011-01-06T16:50:00.000Z', to: '2011-01-07T15:10:00.000Z' }, # 10 minutes before end of one day and 10 before the start of next
            { id: 6, from: '2011-01-06T16:55:00.000Z', to: '2011-01-07T15:05:00.000Z' }, # multiple cycles over several days for a total of 20 minutes of work time
            { id: 6, from: '2011-01-07T16:55:00.000Z', to: '2011-01-10T15:05:00.000Z' }, 
            { id: 7, from: '2011-01-06T16:40:00.000Z', to: '2011-01-20T19:00:00.000Z' }  # false beyond scope of iterator
          ]
          
          granularity = 'minute'
          timezone = 'America/Chicago'
          
          rangeSpec = 
            granularity: granularity
            startOn: new ChartTime(snapshots[0].from, granularity, timezone).decrement()
            endBefore: '2011-01-11T00:00:00.000'
            workDayStartOn: {hour: 9, minute: 0}  # 15:00 in Chicago
            workDayEndBefore: {hour: 11, minute: 0}  # 17:00 in Chicago.
          
          r1 = new ChartTimeRange(rangeSpec)
          i1 = r1.getIterator('ChartTime')
          isc1 = i1.getChartTimeInStateCalculator(timezone)
          timeInState = isc1.timeInState(snapshots, 'from', 'to', 'id')
          console.log(timeInState)
    
          # [ { ticks: 20,
          #     finalState: false,
          #     finalEventAt: '2011-01-06T15:30:00.000Z',
          #     finalTickAt: '2011-01-06T15:29:00.000Z',
          #     id: '1' },
          #   { ticks: 20,
          #     finalState: false,
          #     finalEventAt: '2011-01-06T16:10:00.000Z',
          #     finalTickAt: '2011-01-06T16:09:00.000Z',
          #     id: '2' },
          #   { ticks: 20,
          #     finalState: false,
          #     finalEventAt: '2011-01-07T15:20:00.000Z',
          #     finalTickAt: '2011-01-07T15:19:00.000Z',
          #     id: '3' },
          #   { ticks: 20,
          #     finalState: false,
          #     finalEventAt: '2011-01-06T19:00:00.000Z',
          #     finalTickAt: '2011-01-06T16:59:00.000Z',
          #     id: '4' },
          #   { ticks: 20,
          #     finalState: false,
          #     finalEventAt: '2011-01-07T15:10:00.000Z',
          #     finalTickAt: '2011-01-07T15:09:00.000Z',
          #     id: '5' },
          #   { ticks: 20,
          #     finalState: false,
          #     finalEventAt: '2011-01-10T15:05:00.000Z',
          #     finalTickAt: '2011-01-10T15:04:00.000Z',
          #     id: '6' } ]
    
          
      The default supresses the ones that are still open at the end, but we can override that
      
          snapshots = [snapshots[7]]
          console.log(isc1.timeInState(snapshots, 'from', 'to', 'id', false))
          
          # [ { ticks: 260,
          #     finalState: true,
          #     finalEventAt: '2011-01-06T16:40:00.000Z',
          #     finalTickAt: '2011-01-10T16:59:00.000Z',
          #     id: '7' } ]
          
          
      We can adjust the granularity
    
          rangeSpec.granularity = 'hour'
          isc2 = new ChartTimeRange(rangeSpec).getIterator().getChartTimeInStateCalculator(timezone)
          timeInState = isc2.timeInState(snapshots, 'from', 'to', 'id', false)
          console.log(timeInState)
          
          # [ { ticks: 4,
          #     finalState: true,
          #     finalEventAt: '2011-01-06T16:40:00.000Z',
          #     finalTickAt: '2011-01-10T16:00:00.000Z',
          #     id: '7' } ]
    */

    function ChartTimeInStateCalculator(iterator, tz) {
      var allCTs, allCTsLength, ct, ctPlus1, idx, previousState, _i, _len;
      this.iterator = iterator;
      /*
          @constructor
          @param {ChartTimeIterator} iterator You must pass in a ChartTimeIterator in the correct granularity and wide enough to cover any snapshots that you will analyze with this ChartTimeInStateCalculator
          @param {String} tz The timezone for analysis
      */

      this.granularity = this.iterator.ctr.granularity;
      if (tz != null) {
        this.tz = tz;
      } else {
        this.tz = this.iterator.tz;
      }
      utils.assert(this.tz != null, 'Must specify a timezone `tz` if none specified by the iterator.');
      this.iterator.emit = 'ChartTime';
      utils.assert(this.tz, 'Must provide a timezone to the ChartTimeIterator used for in-state calculation');
      allCTs = this.iterator.getAll();
      if (this.iterator.skip < 0) {
        allCTs.reverse();
      }
      this.ticks = [];
      previousState = false;
      allCTsLength = allCTs.length;
      for (idx = _i = 0, _len = allCTs.length; _i < _len; idx = ++_i) {
        ct = allCTs[idx];
        ctPlus1 = ct.add(1);
        if (previousState) {
          previousState = true;
          this.ticks.push({
            at: ct.getISOStringInTZ(this.tz),
            state: true
          });
          if (idx + 1 === allCTsLength) {
            previousState = false;
            this.ticks.push({
              at: ctPlus1.getISOStringInTZ(this.tz),
              state: false
            });
          } else {
            if (!ctPlus1.equal(allCTs[idx + 1])) {
              previousState = false;
              this.ticks.push({
                at: ctPlus1.getISOStringInTZ(this.tz),
                state: false
              });
            }
          }
        } else {
          this.ticks.push({
            at: ct.getISOStringInTZ(this.tz),
            state: true
          });
          previousState = true;
        }
      }
    }

    ChartTimeInStateCalculator.prototype.timeInState = function(snapshotArray, validFromField, validToField, uniqueIDField, excludeStillInState) {
      var currentSnapshotEvent, currentTick, currentTickState, d, eventRow, finalOutput, lastTickAt, output, outputRow, row, s, snapshotEvents, snapshotIndex, snapshotLength, tickIndex, tickLength, toDelete, uniqueID, _i, _j, _len, _len1;
      if (excludeStillInState == null) {
        excludeStillInState = true;
      }
      /*
          @method timeInState
          @param {Object[]} snapshotArray
          @param {String} validFromField What field in the snapshotArray indicates when the snapshot starts (inclusive)?
          @param {String} validToField What field in the snapshotArray indicates when the snapshot ends (exclusive)?
          @param {String} uniqueIDField What field in the snapshotArray holds the uniqueID
          @param {Boolean} [excludeStillInState] If false, even ids that are still active on the last tick are included
      
          @return {Object[]} An entry for each uniqueID.
      
          The fields in each row in the returned Array include:
      
          * ticks: The number of ticks of the iterator that intersect with the snapshots
          * finalState: true if the last snapshot for this uniqueID had not yet ended by the moment of the last tick
          * finalEventAt: the validFrom value for the final event
          * finalTickAt: the last tick that intersected with this uniqueID
          * |uniqueIDField|: The uniqueID value
      
          Assumptions about the snapshotArray that's passed in:
          
          * The snapshotArray includes all snapshots where the logical state you want
            to measure the "time in" is true. So, send the predicate you want to be true as part of the query to the snapshot service.
          * The `validFromField` and `validToField` in the `snapshotArray` contain strings in ISO-8601 canonical
            Zulu format (eg `'2011-01-01T12:34:56.789Z'`).
      */

      utils.assert(snapshotArray[0][validFromField] >= this.ticks[0].at, "The iterator used must go back at least as far as the first entry in the snapshotArray.\nFirst entry:\n  " + snapshotArray[0][validFromField] + "\nIterator start:\n  " + this.ticks[0].at);
      lastTickAt = this.ticks[this.ticks.length - 1].at;
      snapshotEvents = [];
      for (_i = 0, _len = snapshotArray.length; _i < _len; _i++) {
        s = snapshotArray[_i];
        eventRow = {
          at: s[validFromField],
          state: true
        };
        eventRow[uniqueIDField] = s[uniqueIDField];
        eventRow.type = 1;
        snapshotEvents.push(eventRow);
        if (s[validToField] < lastTickAt) {
          eventRow = {
            at: s[validToField],
            state: false
          };
          eventRow[uniqueIDField] = s[uniqueIDField];
          eventRow.type = 0;
          snapshotEvents.push(eventRow);
        }
      }
      snapshotEvents.sort(function(a, b) {
        if (a.at > b.at) {
          return 1;
        } else if (a.at === b.at) {
          if (a.type > b.type) {
            return 1;
          } else if (a.type === b.type) {
            return 0;
          } else {
            return -1;
          }
        } else {
          return -1;
        }
      });
      output = {};
      tickLength = this.ticks.length;
      tickIndex = 0;
      currentTick = this.ticks[tickIndex];
      snapshotLength = snapshotEvents.length;
      snapshotIndex = 0;
      currentSnapshotEvent = snapshotEvents[snapshotIndex];
      while (currentTick.at < currentSnapshotEvent.at) {
        tickIndex++;
        currentTick = this.ticks[tickIndex];
      }
      tickIndex--;
      currentTick = this.ticks[tickIndex];
      currentTickState = currentTick.state;
      while (snapshotIndex < snapshotLength && tickIndex < tickLength) {
        if (currentTick.at < currentSnapshotEvent.at) {
          if (currentTickState) {
            for (uniqueID in output) {
              outputRow = output[uniqueID];
              if (outputRow.finalState) {
                outputRow.ticks++;
                outputRow.finalTickAt = currentTick.at;
              }
            }
          }
          tickIndex++;
          if (tickIndex < tickLength) {
            currentTick = this.ticks[tickIndex];
            currentTickState = currentTick.state;
          }
        } else {
          if (output[currentSnapshotEvent[uniqueIDField]] == null) {
            output[currentSnapshotEvent[uniqueIDField]] = {
              ticks: 0
            };
          }
          output[currentSnapshotEvent[uniqueIDField]].finalState = currentSnapshotEvent.state;
          output[currentSnapshotEvent[uniqueIDField]].finalEventAt = currentSnapshotEvent.at;
          snapshotIndex++;
          currentSnapshotEvent = snapshotEvents[snapshotIndex];
        }
      }
      if (excludeStillInState) {
        toDelete = [];
        for (uniqueID in output) {
          outputRow = output[uniqueID];
          if (outputRow.finalState) {
            toDelete.push(uniqueID);
          }
        }
        for (_j = 0, _len1 = toDelete.length; _j < _len1; _j++) {
          d = toDelete[_j];
          delete output[d];
        }
      } else {
        while (tickIndex < tickLength) {
          if (currentTickState) {
            for (uniqueID in output) {
              outputRow = output[uniqueID];
              if (outputRow.finalState) {
                outputRow.ticks++;
                outputRow.finalTickAt = currentTick.at;
              }
            }
          }
          tickIndex++;
          if (tickIndex < tickLength) {
            currentTick = this.ticks[tickIndex];
            currentTickState = currentTick.state;
          }
        }
      }
      finalOutput = [];
      for (uniqueID in output) {
        row = output[uniqueID];
        row[uniqueIDField] = uniqueID;
        finalOutput.push(row);
      }
      return finalOutput;
    };

    return ChartTimeInStateCalculator;

  })();

  exports.ChartTimeInStateCalculator = ChartTimeInStateCalculator;

}).call(this);

});

require.define("/src/dataTransform.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var ChartTime, aggregationAtArray_To_HighChartsSeries, csvStyleArray_To_ArrayOfMaps, groupByAtArray_To_HighChartsSeries, snapshotArray_To_AtArray, utils;

  ChartTime = require('./ChartTime').ChartTime;

  utils = require('./utils');

  csvStyleArray_To_ArrayOfMaps = function(csvStyleArray, rowKeys) {
    /*
      @method csvStyleArray_To_ArrayOfMaps
      @param {Array[]} csvStyleArray The first row is usually the list of column headers but if not, you can
        provide your own such list in the second parameter
      @param {String[]} [rowKeys] specify the column headers like `['column1', 'column2']`. If not provided, it will use
        the first row of the csvStyleArray
      @return {Object[]}
    
      `csvStyleArry_To_ArryOfMaps` is a convenience function that will convert a csvStyleArray like:
      
          {csvStyleArray_To_ArrayOfMaps} = require('../')
    
          csvStyleArray = [
            ['column1', 'column2'],
            [1         , 2       ],
            [3         , 4       ],
            [5         , 6       ]
          ]
      
      to an Array of Maps like this:
      
          console.log(csvStyleArray_To_ArrayOfMaps(csvStyleArray))
      
          # [ { column1: 1, column2: 2 },
          #   { column1: 3, column2: 4 },
          #   { column1: 5, column2: 6 } ]
      `
    */

    var arrayOfMaps, i, index, inputRow, key, outputRow, tableLength, _i, _len;
    arrayOfMaps = [];
    if (rowKeys != null) {
      i = 0;
    } else {
      rowKeys = csvStyleArray[0];
      i = 1;
    }
    tableLength = csvStyleArray.length;
    while (i < tableLength) {
      inputRow = csvStyleArray[i];
      outputRow = {};
      for (index = _i = 0, _len = rowKeys.length; _i < _len; index = ++_i) {
        key = rowKeys[index];
        outputRow[key] = inputRow[index];
      }
      arrayOfMaps.push(outputRow);
      i++;
    }
    return arrayOfMaps;
  };

  snapshotArray_To_AtArray = function(snapshotArray, listOfAtCTs, validFromField, uniqueIDField, tz, validToField) {
    /*
      @method snapshotArray_To_AtArray
      @param {Object[]} snapshotArray Array of snapshots
      @param {Array[]} atArray Array of ChartTime objects representing the moments we want the snapshots at
      @param {String} validFromField Specifies the field that holds a date string in ISO-8601 canonical format (eg `2011-01-01T12:34:56.789Z`)
      @param {String} validToField Same except for the end of the snapshot's active time.
        Defaults to '_ValidTo' for backward compatibility reasons.
      @param {String} uniqueIDField Specifies the field that holds the unique ID. Note, no matter the input type, they will come
         out the other side as Strings. I could fix this if it ever became a problem.
      @param {String} tz
      @return {Array[]}
    
      If you have a list of snapshots representing the changes in a set of work items over time, this function will return the state of
      each item at each moments of interest. It's useful for time-series charts where you have snapshot or change records but you need to know
      the values at particular moments in time (the times in listOfAtCTs).
      
      Since this transformation is timezone dependent, you'll need to initialize ChartTime with the path to the tz files.
      Note, that if you use the browserified version of Lumenize, you still need to call setTZPath with some dummy path.
      I'm hoping to fix this at some point.
    
          {snapshotArray_To_AtArray, ChartTime} = require('../')
    
      It will convert an snapshotArray like:
    
          snapshotArray = [
            {_ValidFrom: '1999-01-01T12:00:00.000Z', _ValidTo:'2010-01-02T12:00:00.000Z', ObjectID: 0, someColumn: 'some value'},
            {_ValidFrom: '2011-01-01T12:00:00.000Z', _ValidTo:'2011-01-02T12:00:00.000Z', ObjectID: 1, someColumn: 'some value'},
            {_ValidFrom: '2011-01-02T12:00:00.000Z', _ValidTo:'9999-01-01T12:00:00.000Z', ObjectID: 2, someColumn: 'some value 2'},      
            {_ValidFrom: '2011-01-02T12:00:00.000Z', _ValidTo:'2011-01-03T12:00:00.000Z', ObjectID: 3, someColumn: 'some value'},
            {_ValidFrom: '2011-01-05T12:00:00.000Z', _ValidTo:'9999-01-01T12:00:00.000Z', ObjectID: 1, someColumn: 'some value'},
            {_ValidFrom: '2222-01-05T12:00:00.000Z', _ValidTo:'9999-01-01T12:00:00.000Z', ObjectID: 99, someColumn: 'some value'},
          ]
          
      And a listOfAtCTs like:
      
          listOfAtCTs = [new ChartTime('2011-01-02'), new ChartTime('2011-01-03'), new ChartTime('2011-01-07')]
          
      To an atArray with the value of each ObjectID at each of the points in the listOfAtCTs like:
      
          a = snapshotArray_To_AtArray(snapshotArray, listOfAtCTs, '_ValidFrom', 'ObjectID', 'America/New_York', '_ValidTo')
          
          console.log(a)
      
          # [ [ { _ValidFrom: '2011-01-01T12:00:00.000Z',
          #       _ValidTo: '2011-01-02T12:00:00.000Z',
          #       ObjectID: '1',
          #       someColumn: 'some value' } ],
          #   [ { _ValidFrom: '2011-01-02T12:00:00.000Z',
          #       _ValidTo: '9999-01-01T12:00:00.000Z',
          #       ObjectID: '2',
          #       someColumn: 'some value 2' },
          #     { _ValidFrom: '2011-01-02T12:00:00.000Z',
          #       _ValidTo: '2011-01-03T12:00:00.000Z',
          #       ObjectID: '3',
          #       someColumn: 'some value' } ],
          #   [ { _ValidFrom: '2011-01-05T12:00:00.000Z',
          #       _ValidTo: '9999-01-01T12:00:00.000Z',
          #       ObjectID: '1',
          #       someColumn: 'some value' },
          #     { _ValidFrom: '2011-01-02T12:00:00.000Z',
          #       _ValidTo: '9999-01-01T12:00:00.000Z',
          #       ObjectID: '2',
          #       someColumn: 'some value 2' } ] ]
    */

    var atCT, atLength, atPointer, atRow, atString, atValue, currentAtString, currentRow, currentSnapshot, currentSnapshotValidFrom, d, granularity, index, key, listOfAtStrings, output, outputRow, preOutput, snapshotLength, snapshotPointer, toDelete, uniqueID, validToString, value, _i, _j, _k, _l, _len, _len1, _len2, _len3;
    if (validToField == null) {
      validToField = '_ValidTo';
    }
    snapshotArray.sort(function(a, b) {
      if (a[validFromField] > b[validFromField]) {
        return 1;
      } else if (a[validFromField] === b[validFromField]) {
        return 0;
      } else {
        return -1;
      }
    });
    atLength = listOfAtCTs.length;
    snapshotLength = snapshotArray.length;
    preOutput = [];
    if (atLength <= 0 || snapshotLength <= 0) {
      return preOutput;
    }
    granularity = listOfAtCTs[0].granularity;
    atPointer = 0;
    snapshotPointer = 0;
    currentSnapshot = snapshotArray[snapshotPointer];
    currentRow = {};
    listOfAtStrings = [];
    for (_i = 0, _len = listOfAtCTs.length; _i < _len; _i++) {
      atCT = listOfAtCTs[_i];
      listOfAtStrings.push(atCT.getISOStringInTZ(tz));
    }
    currentAtString = listOfAtStrings[atPointer];
    currentSnapshotValidFrom = currentSnapshot[validFromField];
    while (snapshotPointer < snapshotLength) {
      if (currentSnapshotValidFrom >= currentAtString) {
        preOutput.push(currentRow);
        currentRow = utils.clone(currentRow);
        atPointer++;
        if (atPointer < atLength) {
          currentAtString = listOfAtStrings[atPointer];
        } else {
          break;
        }
      } else {
        if (currentRow[uniqueIDField] == null) {
          currentRow[currentSnapshot[uniqueIDField]] = {};
        }
        for (key in currentSnapshot) {
          value = currentSnapshot[key];
          currentRow[currentSnapshot[uniqueIDField]][key] = value;
        }
        snapshotPointer++;
        if (snapshotPointer < snapshotLength) {
          currentSnapshot = snapshotArray[snapshotPointer];
          currentSnapshotValidFrom = currentSnapshot[validFromField];
        } else {
          while (atPointer < atLength) {
            preOutput.push(currentRow);
            atPointer++;
          }
        }
      }
    }
    for (index = _j = 0, _len1 = preOutput.length; _j < _len1; index = ++_j) {
      atRow = preOutput[index];
      toDelete = [];
      atString = listOfAtStrings[index];
      for (uniqueID in atRow) {
        atValue = atRow[uniqueID];
        validToString = atValue[validToField];
        if (validToString < atString) {
          toDelete.push(uniqueID);
        }
      }
      for (_k = 0, _len2 = toDelete.length; _k < _len2; _k++) {
        d = toDelete[_k];
        delete atRow[d];
      }
    }
    output = [];
    for (_l = 0, _len3 = preOutput.length; _l < _len3; _l++) {
      atRow = preOutput[_l];
      outputRow = [];
      for (key in atRow) {
        value = atRow[key];
        value[uniqueIDField] = key;
        outputRow.push(value);
      }
      output.push(outputRow);
    }
    return output;
  };

  groupByAtArray_To_HighChartsSeries = function(groupByAtArray, nameField, valueField, nameFieldValues, returnPreOutput) {
    var f, groupByRow, name, output, outputRow, perNameValueRow, preOutput, _i, _j, _k, _l, _len, _len1, _len2, _len3, _ref;
    if (returnPreOutput == null) {
      returnPreOutput = false;
    }
    /*
      @method groupByAtArray_To_HighChartsSeries
      @param {Array[]} groupByAtArray result of calling groupByAt()
      @param {String} nameField
      @param {String} valueField
      @pararm {String[]} nameFieldValues
      @param {Boolean} [returnPreOutput] if true, this function returns the map prior to squishing the name into the rows
      @return {Array/Object}
    
      Takes an array of arrays that came from groupByAt and looks like this:
    
          {groupByAtArray_To_HighChartsSeries} = require('../')
    
          groupByAtArray = [
            [
              { 'CFDField': 8, KanbanState: 'Ready to pull' },
              { 'CFDField': 5, KanbanState: 'In progress' },
              { 'CFDField': 9, KanbanState: 'Accepted' },
            ],
            [
              { 'CFDField': 2, KanbanState: 'Ready to pull' },
              { 'CFDField': 3, KanbanState: 'In progress' },
              { 'CFDField': 17, KanbanState: 'Accepted' },
            ]
          ]
      
      and optionally a list of nameFieldValues
      
          nameFieldValues = ['Ready to pull', 'In progress']  # Note, Accepted is missing
          
      and extracts the `valueField` under nameField to give us this
      
          console.log(groupByAtArray_To_HighChartsSeries(groupByAtArray, 'KanbanState', 'CFDField', nameFieldValues))
          # [ { name: 'Ready to pull', data: [ 8, 2 ] },
          #   { name: 'In progress', data: [ 5, 3 ] } ]
    */

    preOutput = {};
    if (nameFieldValues == null) {
      nameFieldValues = [];
      _ref = groupByAtArray[0];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        f = _ref[_i];
        nameFieldValues.push(f[nameField]);
      }
    }
    for (_j = 0, _len1 = groupByAtArray.length; _j < _len1; _j++) {
      groupByRow = groupByAtArray[_j];
      for (_k = 0, _len2 = groupByRow.length; _k < _len2; _k++) {
        perNameValueRow = groupByRow[_k];
        if (preOutput[perNameValueRow[nameField]] == null) {
          preOutput[perNameValueRow[nameField]] = [];
        }
        preOutput[perNameValueRow[nameField]].push(perNameValueRow[valueField]);
      }
    }
    if (returnPreOutput) {
      return preOutput;
    }
    output = [];
    for (_l = 0, _len3 = nameFieldValues.length; _l < _len3; _l++) {
      name = nameFieldValues[_l];
      outputRow = {
        name: name,
        data: preOutput[name]
      };
      output.push(outputRow);
    }
    return output;
  };

  aggregationAtArray_To_HighChartsSeries = function(aggregationAtArray, aggregationSpec) {
    /*
      @method aggregationAtArray_To_HighChartsSeries
      @param {Array[]} aggregationAtArray
      @param {Object} aggregationSpec You can use the same spec you useed to call aggregateAt() as long as it includes
        any yAxis specifications
      @return {Object[]} in HighCharts form
    
      Takes an array of arrays that came from a call to aggregateAt() and looks like this:
    
          {aggregationAtArray_To_HighChartsSeries} = require('../')
    
          aggregationAtArray = [
            {"Series 1": 8, "Series 2": 5, "Series3": 10},
            {"Series 1": 2, "Series 2": 3, "Series3": 20}
          ]
      
      and a list of series configurations
      
          aggregationSpec = [
            {name: "Series 1", yAxis: 1},
            {name: "Series 2"}
          ]
          
      and extracts the data into seperate series
      
          console.log(aggregationAtArray_To_HighChartsSeries(aggregationAtArray, aggregationSpec))
          # [ { name: 'Series 1', data: [ 8, 2 ], yAxis: 1 },
          #   { name: 'Series 2', data: [ 5, 3 ] } ]
          
      Notice how the extra fields from the series array are included in the output.
    */

    var a, aggregationRow, idx, key, output, outputRow, preOutput, s, seriesNames, seriesRow, value, _i, _j, _k, _l, _len, _len1, _len2, _len3;
    preOutput = {};
    seriesNames = [];
    for (_i = 0, _len = aggregationSpec.length; _i < _len; _i++) {
      a = aggregationSpec[_i];
      seriesNames.push(a.name);
    }
    for (_j = 0, _len1 = aggregationAtArray.length; _j < _len1; _j++) {
      aggregationRow = aggregationAtArray[_j];
      for (_k = 0, _len2 = seriesNames.length; _k < _len2; _k++) {
        s = seriesNames[_k];
        if (preOutput[s] == null) {
          preOutput[s] = [];
        }
        preOutput[s].push(aggregationRow[s]);
      }
    }
    output = [];
    for (idx = _l = 0, _len3 = seriesNames.length; _l < _len3; idx = ++_l) {
      s = seriesNames[idx];
      outputRow = {
        name: s,
        data: preOutput[s]
      };
      seriesRow = aggregationSpec[idx];
      for (key in seriesRow) {
        value = seriesRow[key];
        if (key !== 'name' && key !== 'data') {
          outputRow[key] = value;
        }
      }
      output.push(outputRow);
    }
    return output;
  };

  exports.csvStyleArray_To_ArrayOfMaps = csvStyleArray_To_ArrayOfMaps;

  exports.snapshotArray_To_AtArray = snapshotArray_To_AtArray;

  exports.groupByAtArray_To_HighChartsSeries = groupByAtArray_To_HighChartsSeries;

  exports.aggregationAtArray_To_HighChartsSeries = aggregationAtArray_To_HighChartsSeries;

}).call(this);

});

require.define("/src/aggregate.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var ChartTime, ChartTimeIterator, ChartTimeRange, aggregate, aggregateAt, deriveFieldsAt, functions, groupBy, groupByAt, percentileCreator, snapshotArray_To_AtArray, timeSeriesCalculator, timeSeriesGroupByCalculator, utils, _extractFandAs, _ref,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  utils = require('./utils');

  ChartTime = require('./ChartTime').ChartTime;

  _ref = require('./ChartTimeIteratorAndRange'), ChartTimeRange = _ref.ChartTimeRange, ChartTimeIterator = _ref.ChartTimeIterator;

  deriveFieldsAt = require('./derive').deriveFieldsAt;

  snapshotArray_To_AtArray = require('./dataTransform').snapshotArray_To_AtArray;

  functions = require('./functions').functions;

  /*
  @method percentileCreator
  @static
  @param {Number} p The percentile for the resulting function (50 = median, 75, 99, etc.)
  @return {Function} A funtion to calculate the percentile
  
  When the user passes in `p<n>` as an aggregation function, this `percentileCreator` is called to return the appropriate
  percentile function. The returned function will find the `<n>`th percentile where `<n>` is some number in the form of
  `##[.##]`. (e.g. `p40`, `p99`, `p99.9`).
  
  Note: `median` is an alias for `p50`.
  
  There is no official definition of percentile. The most popular choices differ in the interpolation algorithm that they
  use. The function returned by this `percentileCreator` uses the Excel interpolation algorithm which is close to the NIST
  recommendation and makes the most sense to me.
  */


  percentileCreator = function(p) {
    return function(values) {
      var d, k, n, sortfunc, vLength;
      sortfunc = function(a, b) {
        return a - b;
      };
      vLength = values.length;
      values.sort(sortfunc);
      n = (p * (vLength - 1) / 100) + 1;
      k = Math.floor(n);
      d = n - k;
      if (n === 1) {
        return values[1 - 1];
      }
      if (n === vLength) {
        return values[vLength - 1];
      }
      return values[k - 1] + d * (values[k] - values[k - 1]);
    };
  };

  _extractFandAs = function(a) {
    var as, f, p;
    if (a.as != null) {
      as = a.as;
    } else {
      utils.assert(utils.type(a.f) !== 'function', 'Must provide "as" field with your aggregation when providing a user defined function');
      as = "" + a.field + "_" + a.f;
    }
    if (utils.type(a.f) === 'function') {
      f = a.f;
    } else if (functions[a.f] != null) {
      f = functions[a.f];
    } else if (a.f === 'median') {
      f = percentileCreator(50);
    } else if (a.f.substr(0, 2) === 'p') {
      p = /\p(\d+(.\d+)?)/.exec(a.f)[1];
      f = percentileCreator(Number(p));
    } else {
      throw new Error("" + a.f + " is not a recognized built-in function");
    }
    return {
      f: f,
      as: as
    };
  };

  aggregate = function(list, aggregationSpec) {
    /*
      @method aggregate
      @param {Object[]} list An Array or arbitrary rows
      @param {Object} aggregationSpec
      @return {Object}
    
      Takes a list like this:
          
          {aggregate} = require('../')
      
          list = [
            { ObjectID: '1', KanbanState: 'In progress', PlanEstimate: 5, TaskRemainingTotal: 20 },
            { ObjectID: '2', KanbanState: 'Ready to pull', PlanEstimate: 3, TaskRemainingTotal: 5 },
            { ObjectID: '3', KanbanState: 'Ready to pull', PlanEstimate: 5, TaskRemainingTotal: 12 }
          ]
          
      and a list of aggregationSpec like this:
    
          aggregationSpec = [
            {field: 'ObjectID', f: 'count'}
            {as: 'Drill-down', field:'ObjectID', f:'push'}
            {field: 'PlanEstimate', f: 'sum'}
            {as: 'mySum', field: 'PlanEstimate', f: (values) ->
              temp = 0
              for v in values
                temp += v
              return temp
            }
          ]
          
      and returns the aggregations like this:
        
          a = aggregate(list, aggregationSpec)
          console.log(a)
     
          #   { ObjectID_count: 3,
          #     'Drill-down': [ '1', '2', '3' ], 
          #     PlanEstimate_sum: 13,
          #     mySum: 13 } 
          
      For each aggregation, you must provide a `field` and `f` (function) value. You can optionally 
      provide an alias for the aggregation with the 'as` field. There are a number of built in functions 
      documented above.
      
      Alternatively, you can provide your own function (it takes one parameter, which is an
      Array of values to aggregate) like the `mySum` example in our `aggregationSpec` list above.
    */

    var a, as, f, output, row, valuesArray, _i, _j, _len, _len1, _ref1;
    output = {};
    for (_i = 0, _len = aggregationSpec.length; _i < _len; _i++) {
      a = aggregationSpec[_i];
      valuesArray = [];
      for (_j = 0, _len1 = list.length; _j < _len1; _j++) {
        row = list[_j];
        valuesArray.push(row[a.field]);
      }
      _ref1 = _extractFandAs(a), f = _ref1.f, as = _ref1.as;
      output[as] = f(valuesArray);
    }
    return output;
  };

  aggregateAt = function(atArray, aggregationSpec) {
    /*
      @method aggregateAt
      @param {Array[]} atArray
      @param {Object[]} aggregationSpec
      @return {Object[]}
    
      Each sub-Array in atArray is passed to the `aggregate` function and the results are collected into a single array output.
      This is essentially a wrapper around the aggregate function so the spec parameter is the same. You can think of
      it as using a `map`.
    */

    var a, idx, output, row, _i, _len;
    output = [];
    for (idx = _i = 0, _len = atArray.length; _i < _len; idx = ++_i) {
      row = atArray[idx];
      a = aggregate(row, aggregationSpec);
      output.push(a);
    }
    return output;
  };

  groupBy = function(list, spec) {
    /*
      @method groupBy
      @param {Object[]} list An Array of rows
      @param {Object} spec
      @return {Object[]}
    
      Takes a list like this:
          
          {groupBy} = require('../')
      
          list = [
            { ObjectID: '1', KanbanState: 'In progress', PlanEstimate: 5, TaskRemainingTotal: 20 },
            { ObjectID: '2', KanbanState: 'Ready to pull', PlanEstimate: 3, TaskRemainingTotal: 5 },
            { ObjectID: '3', KanbanState: 'Ready to pull', PlanEstimate: 5, TaskRemainingTotal: 12 }
          ]
          
      and a spec like this:
    
          spec = {
            groupBy: 'KanbanState',
            aggregationSpec: [
              {field: 'ObjectID', f: 'count'}
              {as: 'Drill-down', field:'ObjectID', f:'push'}
              {field: 'PlanEstimate', f: 'sum'}
              {as: 'mySum', field: 'PlanEstimate', f: (values) ->
                temp = 0
                for v in values
                  temp += v
                return temp
              }
            ]
          }
            
      Returns the aggregations like this:
        
          a = groupBy(list, spec)
          console.log(a)
    
          #   [ { KanbanState: 'In progress',
          #       ObjectID_count: 1,
          #       'Drill-down': [ '1' ], 
          #       PlanEstimate_sum: 5,
          #       mySum: 5 },
          #     { KanbanState: 'Ready to pull',
          #       ObjectID_count: 2,
          #       'Drill-down': [ '2', '3' ], 
          #       PlanEstimate_sum: 8,
          #       mySum: 8 } ]
          
      The first element of this specification is the `groupBy` field. This is analagous to
      the `GROUP BY` column in an SQL expression.
      
      Uses the same aggregation functions as the `aggregate` function.
    */

    var a, as, f, groupByValue, grouped, output, outputRow, row, valuesArray, valuesForThisGroup, _i, _j, _k, _len, _len1, _len2, _ref1, _ref2;
    grouped = {};
    for (_i = 0, _len = list.length; _i < _len; _i++) {
      row = list[_i];
      if (grouped[row[spec.groupBy]] == null) {
        grouped[row[spec.groupBy]] = [];
      }
      grouped[row[spec.groupBy]].push(row);
    }
    output = [];
    for (groupByValue in grouped) {
      valuesForThisGroup = grouped[groupByValue];
      outputRow = {};
      outputRow[spec.groupBy] = groupByValue;
      _ref1 = spec.aggregationSpec;
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        a = _ref1[_j];
        valuesArray = [];
        for (_k = 0, _len2 = valuesForThisGroup.length; _k < _len2; _k++) {
          row = valuesForThisGroup[_k];
          valuesArray.push(row[a.field]);
        }
        _ref2 = _extractFandAs(a), f = _ref2.f, as = _ref2.as;
        outputRow[as] = f(valuesArray);
      }
      output.push(outputRow);
    }
    return output;
  };

  groupByAt = function(atArray, spec) {
    /*
      @method groupByAt
      @param {Array[]} atArray
      @param {Object} spec
      @return {Array[]}
    
      Each row in atArray is passed to the `groupBy` function and the results are collected into a single output.
      
      This function also finds all the unique groupBy values in all rows of the output and pads the output with blank/zero rows to cover
      each unique groupBy value.
      
      This is essentially a wrapper around the groupBy function so the spec parameter is the same with the addition of the `uniqueValues` field.
      The ordering specified in `spec.uniqueValues` (optional) will be honored. Any additional unique values that aggregateAt finds will be added to
      the uniqueValues list at the end. This gives you the best of both worlds. The ability to specify the order without the risk of the
      data containing more values than you originally thought when you created spec.uniqueValues.
      
      Note: `groupByAt` has the side-effect that `spec.uniqueValues` are upgraded with the missing values.
      You can use this if you want to do more calculations at the calling site.
    */

    var a, as, blank, f, idx, key, newRow, output, row, t, temp, tempGroupBy, tempKey, tempRow, tgb, u, uniqueValues, value, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _len5, _m, _n, _ref1, _ref2;
    temp = [];
    for (idx = _i = 0, _len = atArray.length; _i < _len; idx = ++_i) {
      row = atArray[idx];
      tempGroupBy = groupBy(row, spec);
      tempRow = {};
      for (_j = 0, _len1 = tempGroupBy.length; _j < _len1; _j++) {
        tgb = tempGroupBy[_j];
        tempKey = tgb[spec.groupBy];
        delete tgb[spec.groupBy];
        tempRow[tempKey] = tgb;
      }
      temp.push(tempRow);
    }
    if (spec.uniqueValues != null) {
      uniqueValues = spec.uniqueValues;
    } else {
      uniqueValues = [];
    }
    for (_k = 0, _len2 = temp.length; _k < _len2; _k++) {
      t = temp[_k];
      for (key in t) {
        value = t[key];
        if (__indexOf.call(uniqueValues, key) < 0) {
          uniqueValues.push(key);
        }
      }
    }
    blank = {};
    _ref1 = spec.aggregationSpec;
    for (_l = 0, _len3 = _ref1.length; _l < _len3; _l++) {
      a = _ref1[_l];
      _ref2 = _extractFandAs(a), f = _ref2.f, as = _ref2.as;
      blank[as] = f([]);
    }
    output = [];
    for (_m = 0, _len4 = temp.length; _m < _len4; _m++) {
      t = temp[_m];
      row = [];
      for (_n = 0, _len5 = uniqueValues.length; _n < _len5; _n++) {
        u = uniqueValues[_n];
        if (t[u] != null) {
          t[u][spec.groupBy] = u;
          row.push(t[u]);
        } else {
          newRow = utils.clone(blank);
          newRow[spec.groupBy] = u;
          row.push(newRow);
        }
      }
      output.push(row);
    }
    return output;
  };

  timeSeriesCalculator = function(snapshotArray, config) {
    /*
      @method timeSeriesCalculator
      @param {Object[]} snapshotArray
      @param {Object} config
      @return {Object} Returns an Object {listOfAtCTs, aggregationAtArray}
    
      Takes an MVCC style `snapshotArray` array and returns the time series calculations `At` each moment specified by
      the ChartTimeRange spec (`rangeSpec`) within the config object.
      
      This is really just a thin wrapper around various other calculations, so look at the documentation for each of
      those to get the detail picture of what this timeSeriesCalculator does. The general flow is:
      
      1. Use `ChartTimeRange.getTimeline()` against `config.rangeSpec` to find the points for the x-axis.
         The output of this work is a `listOfAtCTs` array.
      2. Use `snapshotArray_To_AtArray` to figure out what state those objects were in at each point in the `listOfAtCTs` array.
         The output of this operation is called an `atArray`
      3. Use `deriveFieldsAt` to add fields in each object in the `atArray` whose values are derived from the other fields in the object.
      4. Use `aggregateAt` to calculate aggregations into an `aggregationAtArray` which contains chartable values.
    */

    var aggregationAtArray, atArray, listOfAtCTs;
    listOfAtCTs = new ChartTimeRange(config.rangeSpec).getTimeline();
    utils.assert(listOfAtCTs.length > 0, "Timeline has no data points.");
    atArray = snapshotArray_To_AtArray(snapshotArray, listOfAtCTs, config.snapshotValidFromField, config.snapshotUniqueID, config.timezone, config.snapshotValidToField);
    deriveFieldsAt(atArray, config.derivedFields);
    aggregationAtArray = aggregateAt(atArray, config.aggregationSpec);
    return {
      listOfAtCTs: listOfAtCTs,
      aggregationAtArray: aggregationAtArray
    };
  };

  timeSeriesGroupByCalculator = function(snapshotArray, config) {
    /*
      @method timeSeriesGroupByCalculator
      @param {Object[]} snapshotArray
      @param {Object} config
      @return {Object} Returns an Object {listOfAtCTs, groupByAtArray, uniqueValues}
    
      Takes an MVCC style `snapshotArray` array and returns the data groupedBy a particular field `At` each moment specified by
      the ChartTimeRange spec (`rangeSpec`) within the config object. 
      
      This is really just a thin wrapper around various other calculations, so look at the documentation for each of
      those to get the detail picture of what this timeSeriesGroupByCalculator does. The general flow is:
      
      1. Use `ChartTimeRange` and `ChartTimeIterator` against `config.rangeSpec` to find the points for the x-axis.
         The output of this work is a `listOfAtCTs` array.
      2. Use `snapshotArray_To_AtArray` to figure out what state those objects were in at each point in the `listOfAtCTs` array.
         The output of this operation is called an `atArray`
      3. Use `groupByAt` to create a `groupByAtArray` of grouped aggregations to chart
    */

    var aggregationSpec, atArray, groupByAtArray, listOfAtCTs;
    listOfAtCTs = new ChartTimeRange(config.rangeSpec).getTimeline();
    utils.assert(listOfAtCTs.length > 0, "Timeline has no data points.");
    atArray = snapshotArray_To_AtArray(snapshotArray, listOfAtCTs, config.snapshotValidFromField, config.snapshotUniqueID, config.timezone, config.snapshotValidToField);
    aggregationSpec = {
      groupBy: config.groupByField,
      uniqueValues: utils.clone(config.groupByFieldValues),
      aggregationSpec: [
        {
          as: 'GroupBy',
          field: config.aggregationField,
          f: config.aggregationFunction
        }, {
          as: 'Count',
          field: 'ObjectID',
          f: 'count'
        }, {
          as: 'DrillDown',
          field: 'ObjectID',
          f: 'push'
        }
      ]
    };
    groupByAtArray = groupByAt(atArray, aggregationSpec);
    return {
      listOfAtCTs: listOfAtCTs,
      groupByAtArray: groupByAtArray,
      uniqueValues: utils.clone(aggregationSpec.uniqueValues)
    };
  };

  exports.percentileCreator = percentileCreator;

  exports.aggregate = aggregate;

  exports.aggregateAt = aggregateAt;

  exports.groupBy = groupBy;

  exports.groupByAt = groupByAt;

  exports.timeSeriesCalculator = timeSeriesCalculator;

  exports.timeSeriesGroupByCalculator = timeSeriesGroupByCalculator;

}).call(this);

});

require.define("/src/derive.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var deriveFields, deriveFieldsAt;

  deriveFields = function(list, derivedFieldsSpec) {
    /*
      @method deriveFields
      @param {Object[]} list
      @param {Object[]} derivedFieldsSpec
    
      This function works on the list in place meaning that it's all side effect.
    
      To use this, you must `require` it
      
          {deriveFields, deriveFieldsAt} = require('../')
    
      Takes a list like:
    
          list = [
            {a: 1, b: 2},
            {a: 3, b: 4}
          ]
          
      and a list of derivations like:
      
          derivations = [
            {name: 'sum', f: (row) -> row.a + row.b}
          ]
      
      and upgrades the list in place with the derived fields like:
      
          deriveFields(list, derivations)
          
          console.log(list)
          # [ { a: 1, b: 2, sum: 3 }, { a: 3, b: 4, sum: 7 } ]
    
      Note: the derivations are calculated in order so you can use the output of one derivation as the input to one
      that appears later in the derivedFieldsSpec list.
    */

    var d, row, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = list.length; _i < _len; _i++) {
      row = list[_i];
      _results.push((function() {
        var _j, _len1, _results1;
        _results1 = [];
        for (_j = 0, _len1 = derivedFieldsSpec.length; _j < _len1; _j++) {
          d = derivedFieldsSpec[_j];
          _results1.push(row[d.name] = d.f(row));
        }
        return _results1;
      })());
    }
    return _results;
  };

  deriveFieldsAt = function(atArray, derivedFieldsSpec) {
    /*
      @method deriveFieldsAt
      @param {Array[]} atArray
      @param {Object[]} derivedFieldsSpec
      @return {Array[]}
      Sends every sub-array in atArray to deriveFields upgrading the atArray in place.
    */

    var a, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = atArray.length; _i < _len; _i++) {
      a = atArray[_i];
      _results.push(deriveFields(a, derivedFieldsSpec));
    }
    return _results;
  };

  exports.deriveFields = deriveFields;

  exports.deriveFieldsAt = deriveFieldsAt;

}).call(this);

});

require.define("/src/functions.coffee",function(require,module,exports,__dirname,__filename,process,global){
/*
@class functions
*/


(function() {
  var functions;

  functions = {};

  /*
  @method sum
  @static
  @param {Number[]} values
  @return {Number} The sum of the values
  */


  functions.sum = function(values) {
    var temp, v, _i, _len;
    temp = 0;
    for (_i = 0, _len = values.length; _i < _len; _i++) {
      v = values[_i];
      temp += v;
    }
    return temp;
  };

  /*
  @method sumSquares
  @static
  @param {Number[]} values
  @return {Number} The sum of the squares of the values
  */


  functions.sumSquares = function(values) {
    var temp, v, _i, _len;
    temp = 0;
    for (_i = 0, _len = values.length; _i < _len; _i++) {
      v = values[_i];
      temp += v * v;
    }
    return temp;
  };

  /*
  @method count
  @static
  @param {Number[]} values
  @return {Number} The length of the values Array
  */


  functions.count = function(values) {
    return values.length;
  };

  /*
  @method min
  @static
  @param {Number[]} values
  @return {Number} The minimum value or null if no values
  */


  functions.min = function(values) {
    var temp, v, _i, _len;
    if (values.length === 0) {
      return null;
    }
    temp = values[0];
    for (_i = 0, _len = values.length; _i < _len; _i++) {
      v = values[_i];
      if (v < temp) {
        temp = v;
      }
    }
    return temp;
  };

  /*
  @method max
  @static
  @param {Number[]} values
  @return {Number} The maximum value or null if no values
  */


  functions.max = function(values) {
    var temp, v, _i, _len;
    if (values.length === 0) {
      return null;
    }
    temp = values[0];
    for (_i = 0, _len = values.length; _i < _len; _i++) {
      v = values[_i];
      if (v > temp) {
        temp = v;
      }
    }
    return temp;
  };

  /*
  @method push
  @static
  @param {Number[]} values
  @return {Array} All values (allows duplicates). Can be used for drill down when you know they will be unique.
  */


  functions.push = function(values) {
    var temp, v, _i, _len;
    temp = [];
    for (_i = 0, _len = values.length; _i < _len; _i++) {
      v = values[_i];
      temp.push(v);
    }
    return temp;
  };

  /*
  @method addToSet
  @static
  @param {Number[]} values
  @return {Array} Unique values. This is good for generating an OLAP dimension or drill down.
  */


  functions.addToSet = function(values) {
    var key, temp, temp2, v, value, _i, _len;
    temp = {};
    temp2 = [];
    for (_i = 0, _len = values.length; _i < _len; _i++) {
      v = values[_i];
      temp[v] = null;
    }
    for (key in temp) {
      value = temp[key];
      temp2.push(key);
    }
    return temp2;
  };

  /*
  @method average
  @static
  @param {Number[]} values
  @return {Number} The arithmetic mean
  */


  functions.average = function(values) {
    var count, sum, v, _i, _len;
    count = values.length;
    sum = 0;
    for (_i = 0, _len = values.length; _i < _len; _i++) {
      v = values[_i];
      sum += v;
    }
    return sum / count;
  };

  /*
  @method variance
  @static
  @param {Number[]} values
  @return {Number} The variance
  */


  functions.variance = function(values) {
    var n, sum, sumSquares, v, _i, _len;
    n = values.length;
    sum = 0;
    sumSquares = 0;
    for (_i = 0, _len = values.length; _i < _len; _i++) {
      v = values[_i];
      sum += v;
      sumSquares += v * v;
    }
    return (n * sumSquares - sum * sum) / (n * (n - 1));
  };

  /*
  @method standardDeviation
  @static
  @param {Number[]} values
  @return {Number} The standard deviation
  */


  functions.standardDeviation = function(values) {
    return Math.sqrt(functions.variance(values));
  };

  exports.functions = functions;

}).call(this);

});

require.define("/src/histogram.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var functions, histogram;

  functions = require('./functions').functions;

  histogram = function(rows, valueField) {
    /*
      @method histogram
      @param {Object[]} rows
      @param {String} valueField Specifies the field containing the data to calculate the histogram
      @return {Object[]}
    
      Returns an object containing the following:
    
      * buckets - An Array containing {label, count, rows, clippedChartValue}
      * bucketSize - The size of each bucket (except the top one)
      * chartMax - The maximum to use for charting using clipped values
      * clipped - A Boolean indicating if the result is clipped
      * valueMax - The actual maximum value found. Will always be >= chartMax
    
      Given an array of rows like:
      
          {histogram} = require('../')
      
          rows = [
            {age:  7},
            {age: 25},
            {age: 23},
            {age: 27},
            {age: 34},
            {age: 55},
            {age: 42},
            {age: 13},
            {age: 11},
            {age: 23},
            {age: 31},
            {age: 32},
            {age: 29},
            {age: 16},
            {age: 31},
            {age: 22},
            {age: 25},
          ]
          
      histogram will calculate a histogram. There will be sqrt(n) + 1 buckets
      
          {buckets, chartMax} = histogram(rows, 'age')
          for b in buckets
            console.log(b.label, b.count)
          # 0-13 2
          # 13-26 7
          # 26-39 6
          # 39-52 1
          # 52-65 1
          
          console.log(chartMax)
          # 65
      
      This histogram calculator will also attempt to lump outliers into a single bucket at the top.
          
          rows.push({age: 85})
      
          {buckets, chartMax} = histogram(rows, 'age')
      
          lastBucket = buckets[buckets.length - 1]
          console.log(lastBucket.label, lastBucket.count)
          # 68-86* 1
          
      The asterix `*` is there to indicate that this bucket is not the same size as the others and non-linear.
      The histogram calculator will also "clip" the values for these outliers so that you can
      display them in a scatter chart on a linear scale with the last band compressed. 
      The `clippedChartValue` will be guaranteed to be below the `chartMax` by interpolating it's position between
      the bounds of the top band where the actual max value is scaled down to the `chartMax`
      
          lastBucket = buckets[buckets.length - 1]
          console.log(lastBucket.rows[0].age, lastBucket.rows[0].clippedChartValue)
          # 85 84.05555555555556
    */

    var average, b, bucket, bucketCount, bucketSize, buckets, c, chartMax, chartMin, chartValues, chartValuesMinusOutliers, clipped, i, percentile, row, standardDeviation, total, upperBound, valueMax, _i, _j, _k, _l, _len, _len1, _len2;
    chartValues = (function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = rows.length; _i < _len; _i++) {
        row = rows[_i];
        _results.push(row[valueField]);
      }
      return _results;
    })();
    average = functions.average(chartValues);
    standardDeviation = functions.standardDeviation(chartValues);
    upperBound = average + 2 * standardDeviation;
    chartValuesMinusOutliers = (function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = chartValues.length; _i < _len; _i++) {
        c = chartValues[_i];
        if (c < upperBound) {
          _results.push(c);
        }
      }
      return _results;
    })();
    bucketCount = Math.floor(Math.sqrt(chartValuesMinusOutliers.length));
    if (bucketCount < 3) {
      return void 0;
    }
    bucketSize = Math.floor(upperBound / bucketCount) + 1;
    upperBound = bucketSize * bucketCount;
    chartMin = 0;
    chartMax = upperBound + bucketSize;
    valueMax = Math.floor(functions.max(chartValues)) + 1;
    valueMax = Math.max(chartMax, valueMax);
    for (_i = 0, _len = rows.length; _i < _len; _i++) {
      row = rows[_i];
      if (row[valueField] >= upperBound) {
        row.clippedChartValue = upperBound + bucketSize * (row[valueField] - upperBound) / (valueMax - upperBound);
      } else {
        row.clippedChartValue = row[valueField];
      }
    }
    buckets = [];
    for (i = _j = 0; 0 <= bucketCount ? _j <= bucketCount : _j >= bucketCount; i = 0 <= bucketCount ? ++_j : --_j) {
      bucket = {
        label: "" + (Math.floor(i * bucketSize)) + "-" + (Math.floor((i + 1) * bucketSize)),
        rows: [],
        count: 0
      };
      buckets.push(bucket);
    }
    clipped = !(valueMax === chartMax);
    if (clipped) {
      buckets[bucketCount].label = "" + upperBound + "-" + valueMax + "*";
    } else {
      buckets[bucketCount].label = "" + upperBound + "-" + valueMax;
    }
    total = 0;
    for (_k = 0, _len1 = rows.length; _k < _len1; _k++) {
      row = rows[_k];
      if (row[valueField] >= upperBound) {
        bucket = buckets[buckets.length - 1];
      } else {
        bucket = buckets[Math.floor(row[valueField] / bucketSize)];
      }
      bucket.rows.push(row);
      bucket.count++;
      total++;
    }
    percentile = 0;
    for (_l = 0, _len2 = buckets.length; _l < _len2; _l++) {
      b = buckets[_l];
      percentile += b.count / total;
      b.percentile = percentile;
    }
    buckets[buckets.length - 1].percentile = 1.0;
    return {
      buckets: buckets,
      bucketSize: bucketSize,
      chartMax: chartMax,
      clipped: clipped,
      valueMax: valueMax
    };
  };

  exports.histogram = histogram;

}).call(this);

});
