/*
lumenize version: 0.7.3
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

require.define("/lumenize.coffee",function(require,module,exports,__dirname,__filename,process,global){/*

# Lumenize #

Lumenize provides tools for aggregating data and creating time series and other temporal visualizations.

The primary time-series aggregating functionality is provided by:
  * Lumenize.TimeSeriesCalculator - Sets of single-metric series or group-by series
  * Lumenize.TransitionsCalculator - Counts or sums for items moving from one state to another
  * Lumenize.TimeInStateCalculator - Cumulative amount of time unique work items spend in a particular state

Simple group-by, 2D pivot-table and even multi-dimensional aggregations (OLAP cube) are provided by:
  * Lumenize.OLAPCube - Used by above three Calculators but also useful stand-alone, particularly for hierarchical roll-ups

All of the above use the mathematical and statistical functions provided by:
  * Lumenize.functions - count, sum, standardDeviation, percentile coverage, min, max, etc.

Three transformation functions are provided:
  * Lumenize.arrayOfMaps_To_CSVStyleArray - Used to transform from record to table format
  * Lumenize.csvStyleArray_To_ArrayOfMaps - Used to transform from table to record format
  * Lumenize.arrayOfMaps_To_HighChartsSeries - Used to transform from record format to the format expected by the HighCharts charting library

And last, additional functionality is provided by:
  * Lumenize.histogram - create a histogram of scatter data
  * Lumenize.utils - utility methods used by the rest of Lumenize (type, clone, array/object functions, etc.)
*/


(function() {
  var JSON, datatransform, tzTime;

  JSON = require('JSON2');

  tzTime = require('tztime');

  exports.Time = tzTime.Time;

  exports.TimelineIterator = tzTime.TimelineIterator;

  exports.Timeline = tzTime.Timeline;

  exports.utils = tzTime.utils;

  exports.iCalculator = require('./src/iCalculator').iCalculator;

  exports.TimeInStateCalculator = require('./src/TimeInStateCalculator').TimeInStateCalculator;

  exports.TransitionsCalculator = require('./src/TransitionsCalculator').TransitionsCalculator;

  exports.TimeSeriesCalculator = require('./src/TimeSeriesCalculator').TimeSeriesCalculator;

  datatransform = require('./src/dataTransform');

  exports.arrayOfMaps_To_CSVStyleArray = datatransform.arrayOfMaps_To_CSVStyleArray;

  exports.csvStyleArray_To_ArrayOfMaps = datatransform.csvStyleArray_To_ArrayOfMaps;

  exports.arrayOfMaps_To_HighChartsSeries = datatransform.arrayOfMaps_To_HighChartsSeries;

  exports.csvString_To_CSVStyleArray = datatransform.csvString_To_CSVStyleArray;

  exports.csvStyleArray_To_CSVString = datatransform.csvStyleArray_To_CSVString;

  exports.functions = require('./src/functions').functions;

  exports.histogram = require('./src/histogram').histogram;

  exports.multiRegression = require('./src/multiRegression').multiRegression;

  exports.table = require('./src/table').table;

  exports.OLAPCube = require('./src/OLAPCube').OLAPCube;

  exports.anova = require('./src/anova').anova;

  exports.distributions = require('./src/distributions').distributions;

  exports.DataFlow = require('./src/DataFlow').DataFlow;

  exports.BayesianClassifier = require('./src/Classifier').BayesianClassifier;

  exports.Classifier = require('./src/Classifier').Classifier;

}).call(this);

});

require.define("/node_modules/JSON2/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"main":"index.js"}
});

require.define("/node_modules/JSON2/index.js",function(require,module,exports,__dirname,__filename,process,global){// For use in Node.js

var JSON2 = require('./json2');
var cycle = require('./cycle');

JSON2.decycle = cycle.decycle;
JSON2.retrocycle = cycle.retrocycle;

module.exports = JSON2;

});

require.define("/node_modules/JSON2/json2.js",function(require,module,exports,__dirname,__filename,process,global){/*
    json2.js
    2011-10-19

    Public Domain.

    NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.

    See http://www.JSON.org/js.html


    This code should be minified before deployment.
    See http://javascript.crockford.com/jsmin.html

    USE YOUR OWN COPY. IT IS EXTREMELY UNWISE TO LOAD CODE FROM SERVERS YOU DO
    NOT CONTROL.


    This file creates a global JSON object containing two methods: stringify
    and parse.

        JSON.stringify(value, replacer, space)
            value       any JavaScript value, usually an object or array.

            replacer    an optional parameter that determines how object
                        values are stringified for objects. It can be a
                        function or an array of strings.

            space       an optional parameter that specifies the indentation
                        of nested structures. If it is omitted, the text will
                        be packed without extra whitespace. If it is a number,
                        it will specify the number of spaces to indent at each
                        level. If it is a string (such as '\t' or '&nbsp;'),
                        it contains the characters used to indent at each level.

            This method produces a JSON text from a JavaScript value.

            When an object value is found, if the object contains a toJSON
            method, its toJSON method will be called and the result will be
            stringified. A toJSON method does not serialize: it returns the
            value represented by the name/value pair that should be serialized,
            or undefined if nothing should be serialized. The toJSON method
            will be passed the key associated with the value, and this will be
            bound to the value

            For example, this would serialize Dates as ISO strings.

                Date.prototype.toJSON = function (key) {
                    function f(n) {
                        // Format integers to have at least two digits.
                        return n < 10 ? '0' + n : n;
                    }

                    return this.getUTCFullYear()   + '-' +
                         f(this.getUTCMonth() + 1) + '-' +
                         f(this.getUTCDate())      + 'T' +
                         f(this.getUTCHours())     + ':' +
                         f(this.getUTCMinutes())   + ':' +
                         f(this.getUTCSeconds())   + 'Z';
                };

            You can provide an optional replacer method. It will be passed the
            key and value of each member, with this bound to the containing
            object. The value that is returned from your method will be
            serialized. If your method returns undefined, then the member will
            be excluded from the serialization.

            If the replacer parameter is an array of strings, then it will be
            used to select the members to be serialized. It filters the results
            such that only members with keys listed in the replacer array are
            stringified.

            Values that do not have JSON representations, such as undefined or
            functions, will not be serialized. Such values in objects will be
            dropped; in arrays they will be replaced with null. You can use
            a replacer function to replace those with JSON values.
            JSON.stringify(undefined) returns undefined.

            The optional space parameter produces a stringification of the
            value that is filled with line breaks and indentation to make it
            easier to read.

            If the space parameter is a non-empty string, then that string will
            be used for indentation. If the space parameter is a number, then
            the indentation will be that many spaces.

            Example:

            text = JSON.stringify(['e', {pluribus: 'unum'}]);
            // text is '["e",{"pluribus":"unum"}]'


            text = JSON.stringify(['e', {pluribus: 'unum'}], null, '\t');
            // text is '[\n\t"e",\n\t{\n\t\t"pluribus": "unum"\n\t}\n]'

            text = JSON.stringify([new Date()], function (key, value) {
                return this[key] instanceof Date ?
                    'Date(' + this[key] + ')' : value;
            });
            // text is '["Date(---current time---)"]'


        JSON.parse(text, reviver)
            This method parses a JSON text to produce an object or array.
            It can throw a SyntaxError exception.

            The optional reviver parameter is a function that can filter and
            transform the results. It receives each of the keys and values,
            and its return value is used instead of the original value.
            If it returns what it received, then the structure is not modified.
            If it returns undefined then the member is deleted.

            Example:

            // Parse the text. Values that look like ISO date strings will
            // be converted to Date objects.

            myData = JSON.parse(text, function (key, value) {
                var a;
                if (typeof value === 'string') {
                    a =
/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(value);
                    if (a) {
                        return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4],
                            +a[5], +a[6]));
                    }
                }
                return value;
            });

            myData = JSON.parse('["Date(09/09/2001)"]', function (key, value) {
                var d;
                if (typeof value === 'string' &&
                        value.slice(0, 5) === 'Date(' &&
                        value.slice(-1) === ')') {
                    d = new Date(value.slice(5, -1));
                    if (d) {
                        return d;
                    }
                }
                return value;
            });


    This is a reference implementation. You are free to copy, modify, or
    redistribute.
*/

/*jslint evil: true, regexp: true */

/*members "", "\b", "\t", "\n", "\f", "\r", "\"", JSON, "\\", apply,
    call, charCodeAt, getUTCDate, getUTCFullYear, getUTCHours,
    getUTCMinutes, getUTCMonth, getUTCSeconds, hasOwnProperty, join,
    lastIndex, length, parse, prototype, push, replace, slice, stringify,
    test, toJSON, toString, valueOf
*/


(function (JSON) {
    'use strict';

    function f(n) {
        // Format integers to have at least two digits.
        return n < 10 ? '0' + n : n;
    }

    /* DDOPSON-2012-04-16 - mutating global prototypes is NOT allowed for a well-behaved module.  
     * It's also unneeded, since Date already defines toJSON() to the same ISOwhatever format below
     * Thus, we skip this logic for the CommonJS case where 'exports' is defined
     */
    if (typeof exports === 'undefined') {
      if (typeof Date.prototype.toJSON !== 'function') {
          Date.prototype.toJSON = function (key) {

              return isFinite(this.valueOf())
                  ? this.getUTCFullYear()     + '-' +
                      f(this.getUTCMonth() + 1) + '-' +
                      f(this.getUTCDate())      + 'T' +
                      f(this.getUTCHours())     + ':' +
                      f(this.getUTCMinutes())   + ':' +
                      f(this.getUTCSeconds())   + 'Z'
                  : null;
          };
      }
      
      if (typeof String.prototype.toJSON !== 'function') {
        String.prototype.toJSON = function (key) { return this.valueOf(); };
      }

      if (typeof Number.prototype.toJSON !== 'function') {
        Number.prototype.toJSON = function (key) { return this.valueOf(); };
      }
      
      if (typeof Boolean.prototype.toJSON !== 'function') {
        Boolean.prototype.toJSON = function (key) { return this.valueOf(); };
      }
    }
    var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        gap,
        indent,
        meta = {    // table of character substitutions
            '\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '"' : '\\"',
            '\\': '\\\\'
        },
        rep;


    function quote(string) {

// If the string contains no control characters, no quote characters, and no
// backslash characters, then we can safely slap some quotes around it.
// Otherwise we must also replace the offending characters with safe escape
// sequences.

        escapable.lastIndex = 0;
        return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
            var c = meta[a];
            return typeof c === 'string'
                ? c
                : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
        }) + '"' : '"' + string + '"';
    }


    function str(key, holder) {

// Produce a string from holder[key].

        var i,          // The loop counter.
            k,          // The member key.
            v,          // The member value.
            length,
            mind = gap,
            partial,
            value = holder[key];

// If the value has a toJSON method, call it to obtain a replacement value.

        if (value && typeof value === 'object' &&
                typeof value.toJSON === 'function') {
            value = value.toJSON(key);
        }

// If we were called with a replacer function, then call the replacer to
// obtain a replacement value.

        if (typeof rep === 'function') {
            value = rep.call(holder, key, value);
        }

// What happens next depends on the value's type.

        switch (typeof value) {
        case 'string':
            return quote(value);

        case 'number':

// JSON numbers must be finite. Encode non-finite numbers as null.

            return isFinite(value) ? String(value) : 'null';

        case 'boolean':
        case 'null':

// If the value is a boolean or null, convert it to a string. Note:
// typeof null does not produce 'null'. The case is included here in
// the remote chance that this gets fixed someday.

            return String(value);

// If the type is 'object', we might be dealing with an object or an array or
// null.

        case 'object':

// Due to a specification blunder in ECMAScript, typeof null is 'object',
// so watch out for that case.

            if (!value) {
                return 'null';
            }

// Make an array to hold the partial results of stringifying this object value.

            gap += indent;
            partial = [];

// Is the value an array?

            if (Object.prototype.toString.apply(value) === '[object Array]') {

// The value is an array. Stringify every element. Use null as a placeholder
// for non-JSON values.

                length = value.length;
                for (i = 0; i < length; i += 1) {
                    partial[i] = str(i, value) || 'null';
                }

// Join all of the elements together, separated with commas, and wrap them in
// brackets.

                v = partial.length === 0
                    ? '[]'
                    : gap
                    ? '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']'
                    : '[' + partial.join(',') + ']';
                gap = mind;
                return v;
            }

// If the replacer is an array, use it to select the members to be stringified.

            if (rep && typeof rep === 'object') {
                length = rep.length;
                for (i = 0; i < length; i += 1) {
                    if (typeof rep[i] === 'string') {
                        k = rep[i];
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            } else {

// Otherwise, iterate through all of the keys in the object.

                for (k in value) {
                    if (Object.prototype.hasOwnProperty.call(value, k)) {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            }

// Join all of the member texts together, separated with commas,
// and wrap them in braces.

            v = partial.length === 0
                ? '{}'
                : gap
                ? '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}'
                : '{' + partial.join(',') + '}';
            gap = mind;
            return v;
        }
    }

// If the JSON object does not yet have a stringify method, give it one.

    if (typeof JSON.stringify !== 'function') {
        JSON.stringify = function (value, replacer, space) {

// The stringify method takes a value and an optional replacer, and an optional
// space parameter, and returns a JSON text. The replacer can be a function
// that can replace values, or an array of strings that will select the keys.
// A default replacer method can be provided. Use of the space parameter can
// produce text that is more easily readable.

            var i;
            gap = '';
            indent = '';

// If the space parameter is a number, make an indent string containing that
// many spaces.

            if (typeof space === 'number') {
                for (i = 0; i < space; i += 1) {
                    indent += ' ';
                }

// If the space parameter is a string, it will be used as the indent string.

            } else if (typeof space === 'string') {
                indent = space;
            }

// If there is a replacer, it must be a function or an array.
// Otherwise, throw an error.

            rep = replacer;
            if (replacer && typeof replacer !== 'function' &&
                    (typeof replacer !== 'object' ||
                    typeof replacer.length !== 'number')) {
                throw new Error('JSON.stringify');
            }

// Make a fake root object containing our value under the key of ''.
// Return the result of stringifying the value.

            return str('', {'': value});
        };
    }


// If the JSON object does not yet have a parse method, give it one.

    if (typeof JSON.parse !== 'function') {
        JSON.parse = function (text, reviver) {

// The parse method takes a text and an optional reviver function, and returns
// a JavaScript value if the text is a valid JSON text.

            var j;

            function walk(holder, key) {

// The walk method is used to recursively walk the resulting structure so
// that modifications can be made.

                var k, v, value = holder[key];
                if (value && typeof value === 'object') {
                    for (k in value) {
                        if (Object.prototype.hasOwnProperty.call(value, k)) {
                            v = walk(value, k);
                            if (v !== undefined) {
                                value[k] = v;
                            } else {
                                delete value[k];
                            }
                        }
                    }
                }
                return reviver.call(holder, key, value);
            }


// Parsing happens in four stages. In the first stage, we replace certain
// Unicode characters with escape sequences. JavaScript handles many characters
// incorrectly, either silently deleting them, or treating them as line endings.

            text = String(text);
            cx.lastIndex = 0;
            if (cx.test(text)) {
                text = text.replace(cx, function (a) {
                    return '\\u' +
                        ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
                });
            }

// In the second stage, we run the text against regular expressions that look
// for non-JSON patterns. We are especially concerned with '()' and 'new'
// because they can cause invocation, and '=' because it can cause mutation.
// But just to be safe, we want to reject all unexpected forms.

// We split the second stage into 4 regexp operations in order to work around
// crippling inefficiencies in IE's and Safari's regexp engines. First we
// replace the JSON backslash pairs with '@' (a non-JSON character). Second, we
// replace all simple value tokens with ']' characters. Third, we delete all
// open brackets that follow a colon or comma or that begin the text. Finally,
// we look to see that the remaining characters are only whitespace or ']' or
// ',' or ':' or '{' or '}'. If that is so, then the text is safe for eval.

            if (/^[\],:{}\s]*$/
                    .test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
                        .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']')
                        .replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {

// In the third stage we use the eval function to compile the text into a
// JavaScript structure. The '{' operator is subject to a syntactic ambiguity
// in JavaScript: it can begin a block or an object literal. We wrap the text
// in parens to eliminate the ambiguity.

                j = eval('(' + text + ')');

// In the optional fourth stage, we recursively walk the new structure, passing
// each name/value pair to a reviver function for possible transformation.

                return typeof reviver === 'function'
                    ? walk({'': j}, '')
                    : j;
            }

// If the text is not JSON parseable, then a SyntaxError is thrown.

            throw new SyntaxError('JSON.parse');
        };
    }
})(
    
    // Create a JSON object only if one does not already exist. We create the
    // methods in a closure to avoid creating global variables.
    
  (typeof exports !== 'undefined') ? 
    exports : 
    (window.JSON ? 
      (window.JSON) :
      (window.JSON = {})
    )
);

});

require.define("/node_modules/JSON2/cycle.js",function(require,module,exports,__dirname,__filename,process,global){// cycle.js
// 2011-08-24

/*jslint evil: true, regexp: true */

/*members $ref, apply, call, decycle, hasOwnProperty, length, prototype, push,
    retrocycle, stringify, test, toString
*/

(function (exports) {

if (typeof exports.decycle !== 'function') {
    exports.decycle = function decycle(object) {
        'use strict';

// Make a deep copy of an object or array, assuring that there is at most
// one instance of each object or array in the resulting structure. The
// duplicate references (which might be forming cycles) are replaced with
// an object of the form
//      {$ref: PATH}
// where the PATH is a JSONPath string that locates the first occurance.
// So,
//      var a = [];
//      a[0] = a;
//      return JSON.stringify(JSON.decycle(a));
// produces the string '[{"$ref":"$"}]'.

// JSONPath is used to locate the unique object. $ indicates the top level of
// the object or array. [NUMBER] or [STRING] indicates a child member or
// property.

        var objects = [],   // Keep a reference to each unique object or array
            paths = [];     // Keep the path to each unique object or array

        return (function derez(value, path) {

// The derez recurses through the object, producing the deep copy.

            var i,          // The loop counter
                name,       // Property name
                nu;         // The new object or array

            switch (typeof value) {
            case 'object':

// typeof null === 'object', so get out if this value is not really an object.

                if (!value) {
                    return null;
                }

// If the value is an object or array, look to see if we have already
// encountered it. If so, return a $ref/path object. This is a hard way,
// linear search that will get slower as the number of unique objects grows.

                for (i = 0; i < objects.length; i += 1) {
                    if (objects[i] === value) {
                        return {$ref: paths[i]};
                    }
                }

// Otherwise, accumulate the unique value and its path.

                objects.push(value);
                paths.push(path);

// If it is an array, replicate the array.

                if (Object.prototype.toString.apply(value) === '[object Array]') {
                    nu = [];
                    for (i = 0; i < value.length; i += 1) {
                        nu[i] = derez(value[i], path + '[' + i + ']');
                    }
                } else {

// If it is an object, replicate the object.

                    nu = {};
                    for (name in value) {
                        if (Object.prototype.hasOwnProperty.call(value, name)) {
                            nu[name] = derez(value[name],
                                path + '[' + JSON.stringify(name) + ']');
                        }
                    }
                }
                return nu;
            case 'number':
            case 'string':
            case 'boolean':
                return value;
            }
        }(object, '$'));
    };
}


if (typeof exports.retrocycle !== 'function') {
    exports.retrocycle = function retrocycle($) {
        'use strict';

// Restore an object that was reduced by decycle. Members whose values are
// objects of the form
//      {$ref: PATH}
// are replaced with references to the value found by the PATH. This will
// restore cycles. The object will be mutated.

// The eval function is used to locate the values described by a PATH. The
// root object is kept in a $ variable. A regular expression is used to
// assure that the PATH is extremely well formed. The regexp contains nested
// * quantifiers. That has been known to have extremely bad performance
// problems on some browsers for very long strings. A PATH is expected to be
// reasonably short. A PATH is allowed to belong to a very restricted subset of
// Goessner's JSONPath.

// So,
//      var s = '[{"$ref":"$"}]';
//      return JSON.retrocycle(JSON.parse(s));
// produces an array containing a single element which is the array itself.

        var px =
            /^\$(?:\[(?:\d+|\"(?:[^\\\"\u0000-\u001f]|\\([\\\"\/bfnrt]|u[0-9a-zA-Z]{4}))*\")\])*$/;

        (function rez(value) {

// The rez function walks recursively through the object looking for $ref
// properties. When it finds one that has a value that is a path, then it
// replaces the $ref object with a reference to the value that is found by
// the path.

            var i, item, name, path;

            if (value && typeof value === 'object') {
                if (Object.prototype.toString.apply(value) === '[object Array]') {
                    for (i = 0; i < value.length; i += 1) {
                        item = value[i];
                        if (item && typeof item === 'object') {
                            path = item.$ref;
                            if (typeof path === 'string' && px.test(path)) {
                                value[i] = eval(path);
                            } else {
                                rez(item);
                            }
                        }
                    }
                } else {
                    for (name in value) {
                        if (typeof value[name] === 'object') {
                            item = value[name];
                            if (item) {
                                path = item.$ref;
                                if (typeof path === 'string' && px.test(path)) {
                                    value[name] = eval(path);
                                } else {
                                    rez(item);
                                }
                            }
                        }
                    }
                }
            }
        }($));
        return $;
    };
}
}) (
  (typeof exports !== 'undefined') ? 
    exports : 
    (window.JSON ? 
      (window.JSON) :
      (window.JSON = {})
    )
);

});

require.define("/node_modules/tztime/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"main":"./tzTime"}
});

require.define("/node_modules/tztime/tzTime.coffee",function(require,module,exports,__dirname,__filename,process,global){/*
# tzTime #

_Timezone transformations in the browser and node.js plus timezone precise timeline creation for charting._

## Features ##

* Transform into and out of any timezone using Olson timezone rules
* Timezone rule files embedded in the minified browser package. No need to host them
  seperately.
* Create timezone precise time-series axis for charts

  * Knockout weekends, holidays, non-workhours
  * Work with timezone precision
  * Work in any granularity

    * Year, quarter, week, day, hour, etc.
    * No more recording `2012-03-05T00:00:00.000Z` when you really just mean `2012-03-05`
    * Create and use custom granularities: `R02I04-07` = Seventh day of fourth iteration in
      second release

* Work in a particular granularity like day, week, month, or quarter and not worry about the fiddly bits of finer
  granularity. JavaScript's Date object forces you to think about the fact that the underlying representation is milliseconds
  from the unix epoch.
* Month is 1-indexed (rather than 0-indexed like Javascript's Date object)
* Date/Time math (add 3 months, subtract 2 weeks, etc.)
* Work with ISO-8601 formatted strings (called 'ISOString' in this library)

   * Added: Quarter form (e.g. 2012Q3 equates to 2012-07-01)
   * Not supported: Ordinal form (e.g. 2012-001 for 2012-01-01, 2011-365 for 2012-12-31) not supported

## Granularity ##

Each Time object has a granularity. This means that you never have to
worry about any bits lower than your specified granularity. A day has only
year, month, and day segments. You are never tempted to specify 11:59pm
to specify the end of a day-long timebox.

Time supports the following granularities:

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

If you need this precision, Time helps by clearly delineating the moment when you need to do
timezone manipulation... the moment you need to compare/query timestamped data. You can do all of your
holiday/weekend knockout manipulation without regard to timezone and only consider the timezone
upon query submission or comparison.

## Month is 1-indexed as you would expect ##

Javascript's date object uses 0 for January and 11 for December. Time uses 1 for January and 12 for December...
which is what ISO-8601 uses and what humans expect. Everyone who works with the javascript Date Object at one
point or another gets burned by this.

## Week support ##

Time has ISO-8601 week support. Implications of using this ISO format (paraphrased info from wikipedia):

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

The ISO-8601 standard is an elegant and well thought out approach to dealing with week granularity. The only real
downside to this approach is that USA folks expect the week to start on Sunday. However, the ISO-8601 spec starts
each week on Monday. Following ISO-8601, Time uses 1 for Monday and 7 for Sunday which aligns with
the US standard for every day except Sunday. The US standard is to use 0 for Sunday. This library says, "tough luck"
to folks who are unhappy that the week starts on Monday. Live with the fact that weeks in this library start on Monday
as they do in the ISO-8601 standard, or roll your own library. :-)
*/


(function() {
  var Timeline;

  exports.Time = require('./src/Time').Time;

  Timeline = require('./src/Timeline');

  exports.TimelineIterator = Timeline.TimelineIterator;

  exports.Timeline = Timeline.Timeline;

  exports.utils = require('./src/utils');

}).call(this);

});

require.define("/node_modules/tztime/src/Time.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var Time, timezoneJS, utils,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  utils = require('./utils');

  timezoneJS = require('../lib/timezone-js.js').timezoneJS;

  Time = (function() {
    /*
    @class Time
    
    ## Basic usage ##
    
        {TimelineIterator, Timeline, Time} = require('../')
    
    Get Time objects from partial ISOStrings. The granularity is automatically inferred from how many segments you provide.
    
        d1 = new Time('2011-02-28')
        console.log(d1.toString())
        # 2011-02-28
    
    Spell it all out with a JavaScript object
    
        d2 = new Time({granularity: Time.DAY, year: 2011, month: 3, day: 1})
        console.log(d2.toString())
        # 2011-03-01
        
    Increment/decrement and compare Times without regard to timezone
    
        console.log(d1.greaterThanOrEqual(d2))
        # false
    
        d1.increment()
        console.log(d1.equal(d2))
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
    
        d4 = new Time('2004-02-29')  # leap day
        d4.addInPlace(1, 'year')  # adding a year takes us to a non-leap year
        console.log(d4.toString())
        # 2005-02-28
        
    Week granularity correctly wraps and deals with 53-week years.
    
        w1 = new Time('2004W53-6')
        console.log(w1.inGranularity(Time.DAY).toString())
        # 2005-01-01
        
    Convert between any of the standard granularities. Also converts custom granularities (not shown) to
    standard granularities if you provide a `rataDieNumber()` function with your custom granularities.
    
        d5 = new Time('2005-01-01')  # goes the other direction also
        console.log(d5.inGranularity('week_day').toString())
        # 2004W53-6
        
        q1 = new Time('2011Q3')
        console.log(q1.inGranularity(Time.MILLISECOND).toString())
        # 2011-07-01T00:00:00.000
        
    ## Timezones ##
    
    Time does timezone sensitive conversions.
    
        console.log(new Time('2011-01-01').getJSDate('America/Denver').toISOString())
        # 2011-01-01T07:00:00.000Z
    */

    var g, spec, _ref;

    function Time(value, granularity, tz) {
      /*
      @constructor
      @param {Object/Number/Date/String} value
      @param {String} [granularity]
      @param {String} [tz]
      
      The constructor for Time supports the passing in of a String, a rata die number (RDN), or a config Object
      
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
      
      When you pass in an ISO-8601 or custom mask string, Time uses the masks that are defined for each granularity to figure out the granularity...
      unless you explicitly provide a granularity. This parser works on all valid ISO-8601 forms except orginal dates (e.g. `"2012-288"`)
      It even supports week number form (`"2009W52-7"`) and we've added a form for Quarter granularity (e.g. `"2009Q4"`).
      The canonical form (`"2009-01-01T12:34:56.789"`) will work as will any shortened subset of it (`"2009-01-01"`,
      `"2009-01-01T12:34"`, etc.). Plus it will even parse strings in whatever custom granularity you provide based
      upon the mask that you provide for that granularity.
      
      If the granularity is specified but not all of the segments are provided, Time will fill in the missing value
      with the `lowest` value from _granularitySpecs.
      
      The ISO forms that omit the delimiters or use spaces as the delimeters are not supported. Also unsupported are strings
      with a time shift indicator on the end (`...+05:00`). However, if you pass in a string with a "Z" at the end, Time
      will assume that you want to convert from GMT to local (abstract) time and you must provide a timezone.
      
      There are two special Strings that are recognized: `BEFORE_FIRST` and `PAST_LAST`. You must provide a granularity if you
      are instantiating a Time with these values. They are primarily used for custom granularities where your users
      may mistakenly request charts for iterations and releases that have not yet been defined. They are particularly useful when 
      you want to iterate to the last defined iteration/release.
      
      ## Rata Die Number ##
      
      The **rata die number (RDN)** for a date is the number of days since 0001-01-01. You will probably never work
      directly with this number but it's what Time uses to convert between granularities. When you are instantiating
      a Time from an RDN, you must provide a granularity. Using RDN will work even for the granularities finer than day.
      Time will populate the finer grained segments (hour, minute, etc.) with the approriate `lowest` value.
      
      ## Date ##
      
      You can also pass in a JavaScript Date() Object. The passing in of a tz with this option doesn't make sense. You'll end
      up with the same Time value no matter what because the JS Date() already sorta has a timezone. I'm not sure if this
      option is even really useful. In most cases, you are probably better off using Time.getISOStringFromJSDate()
      
      ## Object ##
      
      You can also explicitly spell out the segments in a specification Object in the form of
      `{granularity: Time.DAY, year: 2009, month: 1, day: 1}`. If the granularity is specified but not all of the segments are
      provided, Time will fill in the missing value with the appropriate `lowest` value from _granularitySpecs.
      
      ## granularity ##
      
      If you provide a granularity it will take precedence over whatever fields you've provided in your config or whatever segments
      you have provided in your string. Time will leave off extra values and fill in missing ones with the appropriate `lowest`
      value.
      
      ## tz ##
      
      Most of the time, Time assumes that any dates you pass in are timezone less. You'll specify Christmas as 12-25, then you'll
      shift the boundaries of Christmas for a specific timezone for boundary comparison.
      
      However, if you provide a tz parameter to this constructor, Time will assume you are passing in a true GMT date/time and shift into
      the provided timezone. So...
      
          d = new Time('2011-01-01T02:00:00:00.000Z', Time.DAY, 'America/New_York')
          console.log(d.toString())
          # 2010-12-31
          
      Rule of thumb on when you want to use timezones:
      
      1. If you have true GMT date/times and you want to create a Time, provide the timezone to this constructor.
      2. If you have abstract days like Christmas or June 10th and you want to delay the timezone consideration, don't provide a timezone to this constructor.
      3. In either case, if the dates you want to compare to are in GMT, but you've got Times or Timelines, you'll have to provide a timezone on
         the way back out of Time/Timeline
      */

      var config, jsDate, newCT, newConfig, rdn, s, segment, _i, _len, _ref, _ref1, _ref2, _ref3;
      this.beforePastFlag = '';
      switch (utils.type(value)) {
        case 'string':
          s = value;
          if ((s.slice(-3, -2) === ':' && (_ref = s.slice(-6, -5), __indexOf.call('+-', _ref) >= 0)) || s.slice(-1) === 'Z') {
            if (tz != null) {
              if (s.slice(-3, -2) === ':' && (_ref1 = s.slice(-6, -5), __indexOf.call('+-', _ref1) >= 0)) {
                throw new Error("tzTime.Time does not know how to deal with time shifted ISOStrings like what you sent: " + s);
              }
              if (s.slice(-1) === 'Z') {
                s = s.slice(0, -1);
              }
              newCT = new Time(s, 'millisecond');
              jsDate = newCT.getJSDateFromGMTInTZ(tz);
            } else {
              throw new Error("Must provide a tz parameter when instantiating a Time object with ISOString that contains timeshift/timezone specification. You provided: " + s + ".");
            }
          } else {
            this._setFromString(s, granularity);
            tz = void 0;
          }
          break;
        case 'number':
          rdn = value;
          if (tz != null) {
            newCT = new Time(rdn, 'millisecond');
            jsDate = newCT.getJSDateFromGMTInTZ(tz);
          } else {
            this._setFromRDN(rdn, granularity);
          }
          break;
        case 'date':
          jsDate = value;
          if (tz != null) {
            newCT = new Time(jsDate, 'millisecond');
            jsDate = newCT.getJSDateFromGMTInTZ(tz);
          }
          if (tz == null) {
            tz = 'GMT';
          }
          break;
        case 'object':
          config = {};
          config.granularity = value.granularity;
          config.beforePastFlag = value.beforePastFlag;
          _ref2 = Time._granularitySpecs[value.granularity].segments;
          for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
            segment = _ref2[_i];
            config[segment] = value[segment];
          }
          if (tz != null) {
            config.granularity = 'millisecond';
            newCT = new Time(config);
            jsDate = newCT.getJSDateFromGMTInTZ(tz);
          } else {
            this._setFromConfig(config);
          }
      }
      if (tz != null) {
        if ((_ref3 = this.beforePastFlag) === 'BEFORE_FIRST' || _ref3 === 'PAST_LAST') {
          throw new Error("Cannot do timezone manipulation on " + this.beforePastFlag);
        }
        if (granularity != null) {
          this.granularity = granularity;
        }
        if (this.granularity == null) {
          this.granularity = 'millisecond';
        }
        newConfig = {
          year: jsDate.getUTCFullYear(),
          month: jsDate.getUTCMonth() + 1,
          day: jsDate.getUTCDate(),
          hour: jsDate.getUTCHours(),
          minute: jsDate.getUTCMinutes(),
          second: jsDate.getUTCSeconds(),
          millisecond: jsDate.getUTCMilliseconds(),
          granularity: 'millisecond'
        };
        newCT = new Time(newConfig).inGranularity(this.granularity);
        this._setFromConfig(newCT);
      }
      this._inBoundsCheck();
      this._overUnderFlow();
    }

    /*
    `_granularitySpecs` is a static object that is used to tell Time what to do with particular granularties. You can think of
    each entry in it as a sort of sub-class of Time. In that sense Time is really a factory generating Time objects
    of type granularity. When custom timebox granularities are added to Time by `Time.addGranularity()`, it adds to this
    `_granularitySpecs` object.
    */


    Time._granularitySpecs = {};

    Time._granularitySpecs['millisecond'] = {
      segments: ['year', 'month', 'day', 'hour', 'minute', 'second', 'millisecond'],
      mask: '####-##-##T##:##:##.###',
      lowest: 0,
      rolloverValue: function() {
        return 1000;
      }
    };

    Time._granularitySpecs['second'] = {
      segments: ['year', 'month', 'day', 'hour', 'minute', 'second'],
      mask: '####-##-##T##:##:##',
      lowest: 0,
      rolloverValue: function() {
        return 60;
      }
    };

    Time._granularitySpecs['minute'] = {
      segments: ['year', 'month', 'day', 'hour', 'minute'],
      mask: '####-##-##T##:##',
      lowest: 0,
      rolloverValue: function() {
        return 60;
      }
    };

    Time._granularitySpecs['hour'] = {
      segments: ['year', 'month', 'day', 'hour'],
      mask: '####-##-##T##',
      lowest: 0,
      rolloverValue: function() {
        return 24;
      }
    };

    Time._granularitySpecs['day'] = {
      segments: ['year', 'month', 'day'],
      mask: '####-##-##',
      lowest: 1,
      rolloverValue: function(ct) {
        return ct.daysInMonth() + 1;
      }
    };

    Time._granularitySpecs['month'] = {
      segments: ['year', 'month'],
      mask: '####-##',
      lowest: 1,
      rolloverValue: function() {
        return 12 + 1;
      }
    };

    Time._granularitySpecs['year'] = {
      segments: ['year'],
      mask: '####',
      lowest: 1,
      rolloverValue: function() {
        return 9999 + 1;
      }
    };

    Time._granularitySpecs['week'] = {
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

    Time._granularitySpecs['week_day'] = {
      segments: ['year', 'week', 'week_day'],
      mask: '####W##-#',
      lowest: 1,
      rolloverValue: function(ct) {
        return 7 + 1;
      }
    };

    Time._granularitySpecs['quarter'] = {
      segments: ['year', 'quarter'],
      mask: '####Q#',
      lowest: 1,
      rolloverValue: function() {
        return 4 + 1;
      }
    };

    Time._expandMask = function(granularitySpec) {
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

    _ref = Time._granularitySpecs;
    for (g in _ref) {
      spec = _ref[g];
      Time._expandMask(spec);
      Time[g.toUpperCase()] = g;
    }

    timezoneJS.timezone.zoneFileBasePath = '../files/tz';

    timezoneJS.timezone.init();

    Time.prototype._inBoundsCheck = function() {
      var gs, lowest, rolloverValue, segment, segments, temp, _i, _len, _results;
      if (this.beforePastFlag === '' || (this.beforePastFlag == null)) {
        if (!this.granularity) {
          throw new Error('@granularity should be set before _inBoundsCheck is ever called.');
        }
        segments = Time._granularitySpecs[this.granularity].segments;
        _results = [];
        for (_i = 0, _len = segments.length; _i < _len; _i++) {
          segment = segments[_i];
          gs = Time._granularitySpecs[segment];
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

    Time.prototype._setFromConfig = function(config) {
      var segment, segments, _i, _len, _results;
      utils.assert(config.granularity != null, 'A granularity property must be part of the supplied config.');
      this.granularity = config.granularity;
      this.beforePastFlag = config.beforePastFlag != null ? config.beforePastFlag : '';
      segments = Time._granularitySpecs[this.granularity].segments;
      _results = [];
      for (_i = 0, _len = segments.length; _i < _len; _i++) {
        segment = segments[_i];
        if (config[segment] != null) {
          _results.push(this[segment] = config[segment]);
        } else {
          _results.push(this[segment] = Time._granularitySpecs[segment].lowest);
        }
      }
      return _results;
    };

    Time.prototype._setFromString = function(s, granularity) {
      var gs, l, sSplit, segment, segments, stillParsing, sub, tz, zuluCT, _i, _len, _ref1, _ref2, _results;
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
      if ((_ref1 = sSplit[0]) === 'this' || _ref1 === 'next' || _ref1 === 'previous') {
        if (sSplit[2] === 'in' && (sSplit[3] != null)) {
          tz = sSplit[3];
        } else {
          tz = void 0;
        }
        zuluCT = new Time(new Date(), sSplit[1], tz);
        this._setFromConfig(zuluCT);
        if (sSplit[0] === 'next') {
          this.increment();
        } else if (sSplit[0] === 'previous') {
          this.decrement();
        }
        return;
      }
      _ref2 = Time._granularitySpecs;
      for (g in _ref2) {
        spec = _ref2[g];
        if (spec.segmentStart + spec.segmentLength === s.length || spec.mask.indexOf('#') < 0) {
          if (spec.regex.test(s)) {
            granularity = g;
            break;
          }
        }
      }
      if (granularity == null) {
        throw new Error("Error parsing string '" + s + "'. Couldn't identify granularity.");
      }
      this.granularity = granularity;
      segments = Time._granularitySpecs[this.granularity].segments;
      stillParsing = true;
      _results = [];
      for (_i = 0, _len = segments.length; _i < _len; _i++) {
        segment = segments[_i];
        if (stillParsing) {
          gs = Time._granularitySpecs[segment];
          l = gs.segmentLength;
          sub = Time._getStringPart(s, segment);
          if (sub.length !== l) {
            stillParsing = false;
          }
        }
        if (stillParsing) {
          _results.push(this[segment] = Number(sub));
        } else {
          _results.push(this[segment] = Time._granularitySpecs[segment].lowest);
        }
      }
      return _results;
    };

    Time._getStringPart = function(s, segment) {
      var l, st, sub;
      spec = Time._granularitySpecs[segment];
      l = spec.segmentLength;
      st = spec.segmentStart;
      sub = s.substr(st, l);
      return sub;
    };

    Time.prototype._setFromRDN = function(rdn, granularity) {
      var J, a, afterCT, afterRDN, b, beforeCT, beforeRDN, c, config, d, da, db, dc, dg, granularitySpec, j, m, n, segment, specForLowest, w, x, y, z, _i, _len, _ref1;
      config = {
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
          config['year'] = y + n * 400 + c * 100 + 1;
          config['week'] = Math.floor(w / 28) + 1;
          config['week_day'] = d + 1;
          return this._setFromConfig(config);
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
          config['year'] = y - 4800 + Math.floor((m + 2) / 12);
          config['month'] = (m + 2) % 12 + 1;
          config['day'] = Math.floor(d) + 1;
          config['quarter'] = Math.floor((config.month - 1) / 3) + 1;
          return this._setFromConfig(config);
        default:
          granularitySpec = Time._granularitySpecs[granularity];
          specForLowest = {
            granularity: granularity
          };
          _ref1 = granularitySpec.segments;
          for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
            segment = _ref1[_i];
            specForLowest[segment] = Time._granularitySpecs[segment].lowest;
          }
          beforeCT = new Time(specForLowest);
          beforeRDN = beforeCT.rataDieNumber();
          afterCT = beforeCT.add(1);
          afterRDN = afterCT.rataDieNumber();
          if (rdn < beforeRDN) {
            this.beforePastFlag = 'BEFORE_FIRST';
            return;
          }
          while (true) {
            if (rdn < afterRDN && rdn >= beforeRDN) {
              this._setFromConfig(beforeCT);
              return;
            }
            beforeCT = afterCT;
            beforeRDN = afterRDN;
            afterCT = beforeCT.add(1);
            afterRDN = afterCT.rataDieNumber();
            if (afterCT.beforePastFlag === 'PAST_LAST') {
              if (rdn >= Time._granularitySpecs[beforeCT.granularity].endBeforeDay.rataDieNumber()) {
                this._setFromConfig(afterCT);
                this.beforePastFlag === 'PAST_LAST';
                return;
              } else if (rdn >= beforeRDN) {
                this._setFromConfig(beforeCT);
                return;
              } else {
                throw new Error("RDN: " + rdn + " seems to be out of range for " + granularity);
              }
            }
          }
          throw new Error("Something went badly wrong setting custom granularity " + granularity + " for RDN: " + rdn);
      }
    };

    Time.prototype._isGranularityCoarserThanDay = function() {
      /*
      @method granularityAboveDay
      @private
      @return {Boolean} true if the Time Object's granularity is above (coarser than) "day" level
      */

      var segment, _i, _len, _ref1;
      _ref1 = Time._granularitySpecs[this.granularity].segments;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        segment = _ref1[_i];
        if (segment.indexOf('day') >= 0) {
          return false;
        }
      }
      return true;
    };

    Time.prototype.getJSDate = function(tz) {
      /*
      @method getJSDate
      @param {String} tz
      @return {Date}
      
      Returns a JavaScript Date Object properly shifted. This Date Object can be compared to other Date Objects that you know
      are already in the desired timezone. If you have data that comes from an API in GMT. You can first create a Time object from
      it and then (using this getJSDate() function) you can compare it to JavaScript Date Objects created in local time.
      
      The full name of this function should be getJSDateInGMTasummingThisCTDateIsInTimezone(tz). It converts **TO** GMT 
      (actually something that can be compared to GMT). It does **NOT** convert **FROM** GMT. Use getJSDateFromGMTInTZ()
      if you want to go in the other direction.
        
      ## Usage ##
      
          ct = new Time('2011-01-01')
          d = new Date(Date.UTC(2011, 0, 1))
          
          console.log(ct.getJSDate('GMT').getTime() == d.getTime())
          # true
          
          console.log(ct.inGranularity(Time.HOUR).add(-5).getJSDate('America/New_York').getTime() == d.getTime())
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

    Time.prototype.getISOStringInTZ = function(tz) {
      /*
      @method getISOStringInTZ
      @param {String} tz
      @return {String} The canonical ISO-8601 date in zulu representation but shifted to the specified tz
      
          console.log(new Time('2012-01-01').getISOStringInTZ('Europe/Berlin'))
          # 2011-12-31T23:00:00.000Z
      */

      var jsDate;
      utils.assert(tz != null, 'Must provide a timezone when calling getShiftedISOString');
      jsDate = this.getJSDate(tz);
      return Time.getISOStringFromJSDate(jsDate);
    };

    Time.getISOStringFromJSDate = function(jsDate) {
      /*
      @method getISOStringFromJSDate
      @static
      @param {Date} jsDate
      @return {String}
      
      Given a JavaScript Date() Object, this will return the canonical ISO-8601 form.
      
      If you don't provide any parameters, it will return now, like `new Date()` except this is a zulu string.
      
          console.log(Time.getISOStringFromJSDate(new Date(0)))
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
      s = Time._pad(year, 4) + '-' + Time._pad(month, 2) + '-' + Time._pad(day, 2) + 'T' + Time._pad(hour, 2) + ':' + Time._pad(minute, 2) + ':' + Time._pad(second, 2) + '.' + Time._pad(millisecond, 3) + 'Z';
      return s;
    };

    Time.prototype.getJSDateFromGMTInTZ = function(tz) {
      /*
      @method getJSDateInTZfromGMT
      @param {String} tz
      @return {Date}
      
      This assumes that the Time is an actual GMT date/time as opposed to some abstract day like Christmas and shifts
      it into the specified timezone.
      
      Note, this function will be off by an hour for the times near midnight on the days where there is a shift to/from daylight 
      savings time. The tz rules engine is designed to go in the other direction so we're mis-using it. This means we are using the wrong
      moment in rules-space for that hour. The cost of fixing this issue was deemed to high for chart applications.
      
          console.log(new Time('2012-01-01').getJSDateFromGMTInTZ('Europe/Berlin').toISOString())
          # 2012-01-01T01:00:00.000Z
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

    Time.prototype.getSegmentsAsObject = function() {
      /*
      @method getSegmentsAsObject
      @return {Object} Returns a simple JavaScript Object containing the segments. This is useful when using utils.match
      for holiday comparison
      
          t = new Time('2011-01-10')
          console.log(t.getSegmentsAsObject())
          # { year: 2011, month: 1, day: 10 }
      */

      var rawObject, segment, segments, _i, _len;
      segments = Time._granularitySpecs[this.granularity].segments;
      rawObject = {};
      for (_i = 0, _len = segments.length; _i < _len; _i++) {
        segment = segments[_i];
        rawObject[segment] = this[segment];
      }
      return rawObject;
    };

    Time.prototype.getSegmentsAsArray = function() {
      /*
      @method getSegmentsAsArray
      @return {Array} Returns a simple JavaScript Array containing the segments. This is useful for doing hierarchical
        aggregations using Lumenize.OLAPCube.
      
          t = new Time('2011-01-10')
          console.log(t.getSegmentsAsArray())
          # [ 2011, 1, 10 ]
      */

      var a, segment, segments, _i, _len;
      segments = Time._granularitySpecs[this.granularity].segments;
      a = [];
      for (_i = 0, _len = segments.length; _i < _len; _i++) {
        segment = segments[_i];
        a.push(this[segment]);
      }
      return a;
    };

    Time.prototype.toString = function() {
      /*
      @method toString
      @return {String} Uses granularity `mask` in _granularitySpecs to generate the string representation.
      
          t = new Time({year: 2012, month: 1, day: 1, granularity: Time.MINUTE}).toString()
          console.log(t.toString())
          console.log(t)
          # 2012-01-01T00:00
          # 2012-01-01T00:00
      */

      var after, before, granularitySpec, l, s, segment, segments, start, _i, _len, _ref1;
      if ((_ref1 = this.beforePastFlag) === 'BEFORE_FIRST' || _ref1 === 'PAST_LAST') {
        s = "" + this.beforePastFlag;
      } else {
        s = Time._granularitySpecs[this.granularity].mask;
        segments = Time._granularitySpecs[this.granularity].segments;
        for (_i = 0, _len = segments.length; _i < _len; _i++) {
          segment = segments[_i];
          granularitySpec = Time._granularitySpecs[segment];
          l = granularitySpec.segmentLength;
          start = granularitySpec.segmentStart;
          before = s.slice(0, start);
          after = s.slice(start + l);
          s = before + Time._pad(this[segment], l) + after;
        }
      }
      return s;
    };

    Time._pad = function(n, l) {
      var result;
      result = n.toString();
      while (result.length < l) {
        result = '0' + result;
      }
      return result;
    };

    Time.DOW_N_TO_S_MAP = {
      0: 'Sunday',
      1: 'Monday',
      2: 'Tuesday',
      3: 'Wednesday',
      4: 'Thursday',
      5: 'Friday',
      6: 'Saturday',
      7: 'Sunday'
    };

    Time.DOW_MONTH_TABLE = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];

    Time.prototype.dowNumber = function() {
      /*
      @method dowNumber
      @return {Number}
      Returns the day of the week as a number. Monday = 1, Sunday = 7
      
          console.log(new Time('2012-01-01').dowNumber())
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
        dayNumber = (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + Time.DOW_MONTH_TABLE[this.month - 1] + this.day) % 7;
        if (dayNumber === 0) {
          return 7;
        } else {
          return dayNumber;
        }
      } else {
        return this.inGranularity('day').dowNumber();
      }
    };

    Time.prototype.dowString = function() {
      /*
      @method dowString
      @return {String} Returns the day of the week as a String (e.g. "Monday")
      
          console.log(new Time('2012-01-01').dowString())
          # Sunday
      */

      return Time.DOW_N_TO_S_MAP[this.dowNumber()];
    };

    Time.prototype.rataDieNumber = function() {
      /*
      @method rataDieNumber
      @return {Number} Returns the counting number for days starting with 0001-01-01 (i.e. 0 AD). Note, this differs
      from the Unix Epoch which starts on 1970-01-01. This function works for
      granularities finer than day (hour, minute, second, millisecond) but ignores the segments of finer granularity than
      day. Also called common era days.
      
          console.log(new Time('0001-01-01').rataDieNumber())
          # 1
      
          rdn2012 = new Time('2012-01-01').rataDieNumber()
          rdn1970 = new Time('1970-01-01').rataDieNumber()
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
      } else if (Time._granularitySpecs[this.granularity].rataDieNumber != null) {
        return Time._granularitySpecs[this.granularity].rataDieNumber(this);
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

    Time.prototype.inGranularity = function(granularity) {
      /*
      @method inGranularity
      @param {String} granularity
      @return {Time} Returns a new Time object for the same date-time as this object but in the specified granularity.
      Fills in missing finer granularity segments with `lowest` values. Drops segments when convernting to a coarser
      granularity.
      
          console.log(new Time('2012W01-1').inGranularity(Time.DAY).toString())
          # 2012-01-02
      
          console.log(new Time('2012Q3').inGranularity(Time.MONTH).toString())
          # 2012-07
      */

      var newTime, tempGranularity, _ref1;
      if ((_ref1 = this.granularity) === 'year' || _ref1 === 'month' || _ref1 === 'day' || _ref1 === 'hour' || _ref1 === 'minute' || _ref1 === 'second' || _ref1 === 'millisecond') {
        if (granularity === 'year' || granularity === 'month' || granularity === 'day' || granularity === 'hour' || granularity === 'minute' || granularity === 'second' || granularity === 'millisecond') {
          tempGranularity = this.granularity;
          this.granularity = granularity;
          newTime = new Time(this);
          this.granularity = tempGranularity;
          return newTime;
        }
      }
      return new Time(this.rataDieNumber(), granularity);
    };

    Time.prototype.daysInMonth = function() {
      /*
      @method daysInMonth
      @return {Number} Returns the number of days in the current month for this Time
      
          console.log(new Time('2012-02').daysInMonth())
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

    Time.prototype.isLeapYear = function() {
      /*
      @method isLeapYear
      @return {Boolean} true if this is a leap year
      
          console.log(new Time('2012').isLeapYear())
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

    Time.YEARS_WITH_53_WEEKS = [4, 9, 15, 20, 26, 32, 37, 43, 48, 54, 60, 65, 71, 76, 82, 88, 93, 99, 105, 111, 116, 122, 128, 133, 139, 144, 150, 156, 161, 167, 172, 178, 184, 189, 195, 201, 207, 212, 218, 224, 229, 235, 240, 246, 252, 257, 263, 268, 274, 280, 285, 291, 296, 303, 308, 314, 320, 325, 331, 336, 342, 348, 353, 359, 364, 370, 376, 381, 387, 392, 398];

    Time.prototype.is53WeekYear = function() {
      /*
      @method is53WeekYear
      @return {Boolean} true if this is a 53-week year
      
          console.log(new Time('2015').is53WeekYear())
          # true
      */

      var lookup;
      lookup = this.year % 400;
      return __indexOf.call(Time.YEARS_WITH_53_WEEKS, lookup) >= 0;
    };

    Time.prototype.equal = function(other) {
      /*
      @method equal
      @param {Time} other
      @return {Boolean} Returns true if this equals other. Throws an error if the granularities don't match.
      
          d3 = new Time({granularity: Time.DAY, year: 2011, month: 12, day: 31})
          d4 = new Time('2012-01-01').add(-1)
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
      segments = Time._granularitySpecs[this.granularity].segments;
      for (_i = 0, _len = segments.length; _i < _len; _i++) {
        segment = segments[_i];
        if (this[segment] !== other[segment]) {
          return false;
        }
      }
      return true;
    };

    Time.prototype.greaterThan = function(other) {
      /*
      @method greaterThan
      @param {Time} other
      @return {Boolean} Returns true if this is greater than other. Throws an error if the granularities don't match
      
          d1 = new Time({granularity: Time.DAY, year: 2011, month: 2, day: 28})
          d2 = new Time({granularity: Time.DAY, year: 2011, month: 3, day: 1})
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
      segments = Time._granularitySpecs[this.granularity].segments;
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

    Time.prototype.greaterThanOrEqual = function(other) {
      /*
      @method greaterThanOrEqual
      @param {Time} other
      @return {Boolean} Returns true if this is greater than or equal to other
      
          console.log(new Time('2012').greaterThanOrEqual(new Time('2012')))
          # true
      */

      var gt;
      gt = this.greaterThan(other);
      if (gt) {
        return true;
      }
      return this.equal(other);
    };

    Time.prototype.lessThan = function(other) {
      /*
      @method lessThan
      @param {Time} other
      @return {Boolean} Returns true if this is less than other
      
          console.log(new Time(1000, Time.DAY).lessThan(new Time(999, Time.DAY)))  # Using RDN constructor
          # false
      */

      return other.greaterThan(this);
    };

    Time.prototype.lessThanOrEqual = function(other) {
      /*
      @method lessThanOrEqual
      @param {Time} other
      @return {Boolean} Returns true if this is less than or equal to other
      
          console.log(new Time('this day').lessThanOrEqual(new Time('next day')))  # Using relative constructor
          # true
      */

      return other.greaterThanOrEqual(this);
    };

    Time.prototype._overUnderFlow = function() {
      var granularitySpec, highestLevel, highestLevelSpec, lowest, rolloverValue, value, _ref1;
      if ((_ref1 = this.beforePastFlag) === 'BEFORE_FIRST' || _ref1 === 'PAST_LAST') {
        return true;
      } else {
        granularitySpec = Time._granularitySpecs[this.granularity];
        highestLevel = granularitySpec.segments[0];
        highestLevelSpec = Time._granularitySpecs[highestLevel];
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

    Time.prototype.decrement = function(granularity) {
      /*
      @method decrement
      @param {String} [granularity]
      @chainable
      @return {Time}
      Decrements this by 1 in the granularity of the Time or the granularity specified if it was specified
      
          console.log(new Time('2016W01').decrement().toString())
          # 2015W53
      */

      var granularitySpec, gs, i, lastDayInMonthFlag, segment, segments, _i, _len, _results;
      if (this.beforePastFlag === 'PAST_LAST') {
        this.beforePastFlag = '';
        granularitySpec = Time._granularitySpecs[this.granularity];
        segments = granularitySpec.segments;
        _results = [];
        for (_i = 0, _len = segments.length; _i < _len; _i++) {
          segment = segments[_i];
          gs = Time._granularitySpecs[segment];
          _results.push(this[segment] = gs.rolloverValue(this) - 1);
        }
        return _results;
      } else {
        lastDayInMonthFlag = this.day === this.daysInMonth();
        if (granularity == null) {
          granularity = this.granularity;
        }
        granularitySpec = Time._granularitySpecs[granularity];
        segments = granularitySpec.segments;
        this[granularity]--;
        if (granularity === 'year') {
          if (this.day > this.daysInMonth()) {
            this.day = this.daysInMonth();
          }
        } else {
          i = segments.length - 1;
          segment = segments[i];
          granularitySpec = Time._granularitySpecs[segment];
          while ((i > 0) && (this[segment] < granularitySpec.lowest)) {
            this[segments[i - 1]]--;
            this[segment] = granularitySpec.rolloverValue(this) - 1;
            i--;
            segment = segments[i];
            granularitySpec = Time._granularitySpecs[segment];
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

    Time.prototype.increment = function(granularity) {
      /*
      @method increment
      @param {String} [granularity]
      @chainable
      @return {Time}
      Increments this by 1 in the granularity of the Time or the granularity specified if it was specified
      
          console.log(new Time('2012Q4').increment().toString())
          # 2013Q1
      */

      var granularitySpec, gs, i, lastDayInMonthFlag, segment, segments, _i, _len, _results;
      if (this.beforePastFlag === 'BEFORE_FIRST') {
        this.beforePastFlag = '';
        granularitySpec = Time._granularitySpecs[this.granularity];
        segments = granularitySpec.segments;
        _results = [];
        for (_i = 0, _len = segments.length; _i < _len; _i++) {
          segment = segments[_i];
          gs = Time._granularitySpecs[segment];
          _results.push(this[segment] = gs.lowest);
        }
        return _results;
      } else {
        lastDayInMonthFlag = this.day === this.daysInMonth();
        if (granularity == null) {
          granularity = this.granularity;
        }
        granularitySpec = Time._granularitySpecs[granularity];
        segments = granularitySpec.segments;
        this[granularity]++;
        if (granularity === 'year') {
          if (this.day > this.daysInMonth()) {
            this.day = this.daysInMonth();
          }
        } else {
          i = segments.length - 1;
          segment = segments[i];
          granularitySpec = Time._granularitySpecs[segment];
          while ((i > 0) && (this[segment] >= granularitySpec.rolloverValue(this))) {
            this[segment] = granularitySpec.lowest;
            this[segments[i - 1]]++;
            i--;
            segment = segments[i];
            granularitySpec = Time._granularitySpecs[segment];
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

    Time.prototype.addInPlace = function(qty, granularity) {
      /*
      @method addInPlace
      @chainable
      @param {Number} qty Can be negative for subtraction
      @param {String} [granularity]
      @return {Time} Adds qty to the Time object. It uses increment and decrement so it's not going to be efficient for large values
      of qty, but it should be fine for charts where we'll increment/decrement small values of qty.
      
          console.log(new Time('2011-11-01').addInPlace(3, Time.MONTH).toString())
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

    Time.prototype.add = function(qty, granularity) {
      /*
      @method add
      @param {Number} qty
      @param {String} [granularity]
      @return {Time}
      Adds (or subtracts) quantity (negative quantity) and returns a new Time. Not efficient for large qty.
      
         console.log(new Time('2012-01-01').add(-10, Time.MONTH))
         # 2011-03-01
      */

      var newTime;
      newTime = new Time(this);
      newTime.addInPlace(qty, granularity);
      return newTime;
    };

    Time.addGranularity = function(granularitySpec) {
      /*
      @method addGranularity
      @static
      @param {Object} granularitySpec see {@link Time#_granularitySpecs} for existing _granularitySpecs
      @cfg {String[]} segments an Array identifying the ancestry (e.g. for 'day', it is: `['year', 'month', 'day']`)
      @cfg {String} mask a String used to identify when this granularity is passed in and to serialize it on the way out.
      @cfg {Number} lowest the lowest possible value for this granularity. 0 for millisecond but 1 for day.
      @cfg {Function} rolloverValue a callback function that will say when to rollover the next coarser granularity.
      
      addGranularity allows you to add your own hierarchical granularities to Time. Once you add a granularity to Time
      you can then instantiate Time objects in your newly specified granularity. You specify new granularities with
      granularitySpec object like this:
          
          granularitySpec = {
            release: {
              segments: ['release'],
              mask: 'R##',
              lowest: 1,
              endBeforeDay: new Time('2011-07-01')
              rolloverValue: (ct) ->
                return Time._granularitySpecs.iteration.timeBoxes.length + 1  # Yes, it's correct to use the length of iteration.timeBoxes
              rataDieNumber: (ct) ->
                return Time._granularitySpecs.iteration.timeBoxes[ct.release-1][1-1].startOn.rataDieNumber()
            },
            iteration: {
              segments: ['release', 'iteration'],
              mask: 'R##I##',
              lowest: 1,
              endBeforeDay: new Time('2011-07-01')
              timeBoxes: [
                [
                  {startOn: new Time('2011-01-01'), label: 'R1 Iteration 1'},
                  {startOn: new Time('2011-02-01'), label: 'R1 Iteration 2'},
                  {startOn: new Time('2011-03-01'), label: 'R1 Iteration 3'},
                ],
                [
                  {startOn: new Time('2011-04-01'), label: 'R2 Iteration 1'},
                  {startOn: new Time('2011-05-01'), label: 'R2 Iteration 2'},
                  {startOn: new Time('2011-06-01'), label: 'R2 Iteration 3'},
                ]
              ]
              rolloverValue: (ct) ->
                temp = Time._granularitySpecs.iteration.timeBoxes[ct.release-1]?.length + 1
                if temp? and not isNaN(temp) and ct.beforePastFlag != 'PAST_LAST'
                  return temp
                else
                  numberOfReleases = Time._granularitySpecs.iteration.timeBoxes.length
                  return Time._granularitySpecs.iteration.timeBoxes[numberOfReleases-1].length + 1
      
              rataDieNumber: (ct) ->
                return Time._granularitySpecs.iteration.timeBoxes[ct.release-1][ct.iteration-1].startOn.rataDieNumber()
            },
            iteration_day: {  # By convention, it knows to use day functions on it. This is the lowest allowed custom granularity
              segments: ['release', 'iteration', 'iteration_day'],
              mask: 'R##I##-##',
              lowest: 1,
              endBeforeDay: new Time('2011-07-01'),
              rolloverValue: (ct) ->
                iterationTimeBox = Time._granularitySpecs.iteration.timeBoxes[ct.release-1]?[ct.iteration-1]
                if !iterationTimeBox? or ct.beforePastFlag == 'PAST_LAST'
                  numberOfReleases = Time._granularitySpecs.iteration.timeBoxes.length
                  numberOfIterationsInLastRelease = Time._granularitySpecs.iteration.timeBoxes[numberOfReleases-1].length
                  iterationTimeBox = Time._granularitySpecs.iteration.timeBoxes[numberOfReleases-1][numberOfIterationsInLastRelease-1]
                  
                thisIteration = iterationTimeBox.startOn.inGranularity('iteration')
                nextIteration = thisIteration.add(1)
                if nextIteration.beforePastFlag == 'PAST_LAST'
                  return Time._granularitySpecs.iteration_day.endBeforeDay.rataDieNumber() - iterationTimeBox.startOn.rataDieNumber() + 1
                else
                  return nextIteration.rataDieNumber() - iterationTimeBox.startOn.rataDieNumber() + 1
                 
              rataDieNumber: (ct) ->
                return Time._granularitySpecs.iteration.timeBoxes[ct.release-1][ct.iteration-1].startOn.rataDieNumber() + ct.iteration_day - 1
            }
          }    
          Time.addGranularity(granularitySpec)
      
      
      The `mask` must cover all of the segments to get down to the granularity being specified. The digits of the granularity segments
      are represented with `#`. Any other characters can be used as a delimeter, but it should always be one character to comply with 
      the expectations of the Lumenize hierarchy visualizations. All of the standard granularities start with a 4-digit year to
      distinguish your custom granularity, your highest level must start with some number of digits other than 4 or a prefix letter 
      (`R` in the example above).
      
      In order for the TimelineIterator to work, you must provide `rolloverValue` and `rataDieNumber` callback functions. You should
      be able to mimic (or use as-is) the example above for most use cases. Notice how the `rataDieNumber` function simply leverages
      `rataDieNumber` functions for the standard granularities.
      
      In order to convert into this granularity from some other granularity, you must provide an `inGranularity` callback [NOT YET IMPLEMENTED].
      But Time will convert to any of the standard granularities from even custom granularities as long as a `rataDieNumber()` function
      is provided.
      
      **The `timeBoxes` property in the `granularitySpec` Object above has no special meaning** to Time or TimelineIterator. It's simply used
      by the `rolloverValue` and `rataDieNumber` functions. The boundaries could come from where ever you want and even have been encoded as
      literals in the `rolloverValue` and `rataDieNumber` callback functions.
      
      The convention of naming the lowest order granularity with `_day` at the end IS signficant. Time knows to treat that as a day-level
      granularity. If there is a use-case for it, Time could be upgraded to allow you to drill down into hours, minutes, etc. from any
      `_day` granularity but right now those lower order time granularities are only supported for the canonical ISO-6801 form.
      */

      var _results;
      _results = [];
      for (g in granularitySpec) {
        spec = granularitySpec[g];
        Time._expandMask(spec);
        this._granularitySpecs[g] = spec;
        _results.push(Time[g.toUpperCase()] = g);
      }
      return _results;
    };

    return Time;

  })();

  exports.Time = Time;

}).call(this);

});

require.define("/node_modules/tztime/src/utils.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var AssertException, ErrorBase, assert, clone, exactMatch, filterMatch, isArray, keys, log, match, startsWith, trim, type, values, _ref,
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
      _ref = AssertException.__super__.constructor.apply(this, arguments);
      return _ref;
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
      value = obj1[key];
      if (value !== obj2[key]) {
        return false;
      }
    }
    return true;
  };

  exactMatch = function(a, b) {
    var atype, btype, key, val;
    if (a === b) {
      return true;
    }
    atype = typeof a;
    btype = typeof b;
    if (atype !== btype) {
      return false;
    }
    if ((!a && b) || (a && !b)) {
      return false;
    }
    if (atype !== 'object') {
      return false;
    }
    if (a.length && (a.length !== b.length)) {
      return false;
    }
    for (key in a) {
      val = a[key];
      if (!(key in b) || !exactMatch(val, b[key])) {
        return false;
      }
    }
    return true;
  };

  filterMatch = function(obj1, obj2) {
    var key, value;
    if (!(type(obj1) === 'object' && type(obj2) === 'object')) {
      throw new Error('obj1 and obj2 must both be objects when calling filterMatch');
    }
    for (key in obj1) {
      value = obj1[key];
      if (!exactMatch(value, obj2[key])) {
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
    var classToType, name, _i, _len, _ref1;
    classToType = {};
    _ref1 = "Boolean Number String Function Array Date RegExp Undefined Null".split(" ");
    for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
      name = _ref1[_i];
      classToType["[object " + name + "]"] = name.toLowerCase();
    }
    return function(obj) {
      var strType;
      strType = Object.prototype.toString.call(obj);
      return classToType[strType] || "object";
    };
  })();

  clone = function(obj) {
    var flags, key, newInstance;
    if ((obj == null) || typeof obj !== 'object') {
      return obj;
    }
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    if (obj instanceof RegExp) {
      flags = '';
      if (obj.global != null) {
        flags += 'g';
      }
      if (obj.ignoreCase != null) {
        flags += 'i';
      }
      if (obj.multiline != null) {
        flags += 'm';
      }
      if (obj.sticky != null) {
        flags += 'y';
      }
      return new RegExp(obj.source, flags);
    }
    newInstance = new obj.constructor();
    for (key in obj) {
      newInstance[key] = clone(obj[key]);
    }
    return newInstance;
  };

  keys = Object.keys || function(obj) {
    var key, val;
    return (function() {
      var _results;
      _results = [];
      for (key in obj) {
        val = obj[key];
        _results.push(key);
      }
      return _results;
    })();
  };

  values = function(obj) {
    var key, val;
    return (function() {
      var _results;
      _results = [];
      for (key in obj) {
        val = obj[key];
        _results.push(val);
      }
      return _results;
    })();
  };

  log = function(s) {
    var pre;
    if ((typeof document !== "undefined" && document !== null ? document.createElement : void 0) != null) {
      pre = document.createElement('pre');
      pre.innerHTML = s;
      return document.body.appendChild(pre);
    } else {
      return console.log(s);
    }
  };

  exports.log = log;

  exports.AssertException = AssertException;

  exports.assert = assert;

  exports.match = match;

  exports.filterMatch = filterMatch;

  exports.trim = trim;

  exports.startsWith = startsWith;

  exports.isArray = isArray;

  exports.type = type;

  exports.clone = clone;

  exports.keys = keys;

  exports.values = values;

  exports._ = require('underscore');

}).call(this);

});

require.define("/node_modules/tztime/node_modules/underscore/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"main":"underscore.js"}
});

require.define("/node_modules/tztime/node_modules/underscore/underscore.js",function(require,module,exports,__dirname,__filename,process,global){//     Underscore.js 1.4.4
//     http://underscorejs.org
//     (c) 2009-2013 Jeremy Ashkenas, DocumentCloud Inc.
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `global` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Establish the object that gets returned to break out of a loop iteration.
  var breaker = {};

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var push             = ArrayProto.push,
      slice            = ArrayProto.slice,
      concat           = ArrayProto.concat,
      toString         = ObjProto.toString,
      hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeForEach      = ArrayProto.forEach,
    nativeMap          = ArrayProto.map,
    nativeReduce       = ArrayProto.reduce,
    nativeReduceRight  = ArrayProto.reduceRight,
    nativeFilter       = ArrayProto.filter,
    nativeEvery        = ArrayProto.every,
    nativeSome         = ArrayProto.some,
    nativeIndexOf      = ArrayProto.indexOf,
    nativeLastIndexOf  = ArrayProto.lastIndexOf,
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind;

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object via a string identifier,
  // for Closure Compiler "advanced" mode.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.4.4';

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles objects with the built-in `forEach`, arrays, and raw objects.
  // Delegates to **ECMAScript 5**'s native `forEach` if available.
  var each = _.each = _.forEach = function(obj, iterator, context) {
    if (obj == null) return;
    if (nativeForEach && obj.forEach === nativeForEach) {
      obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
      for (var i = 0, l = obj.length; i < l; i++) {
        if (iterator.call(context, obj[i], i, obj) === breaker) return;
      }
    } else {
      for (var key in obj) {
        if (_.has(obj, key)) {
          if (iterator.call(context, obj[key], key, obj) === breaker) return;
        }
      }
    }
  };

  // Return the results of applying the iterator to each element.
  // Delegates to **ECMAScript 5**'s native `map` if available.
  _.map = _.collect = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
    each(obj, function(value, index, list) {
      results[results.length] = iterator.call(context, value, index, list);
    });
    return results;
  };

  var reduceError = 'Reduce of empty array with no initial value';

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
  _.reduce = _.foldl = _.inject = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduce && obj.reduce === nativeReduce) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
    }
    each(obj, function(value, index, list) {
      if (!initial) {
        memo = value;
        initial = true;
      } else {
        memo = iterator.call(context, memo, value, index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // The right-associative version of reduce, also known as `foldr`.
  // Delegates to **ECMAScript 5**'s native `reduceRight` if available.
  _.reduceRight = _.foldr = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduceRight && obj.reduceRight === nativeReduceRight) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduceRight(iterator, memo) : obj.reduceRight(iterator);
    }
    var length = obj.length;
    if (length !== +length) {
      var keys = _.keys(obj);
      length = keys.length;
    }
    each(obj, function(value, index, list) {
      index = keys ? keys[--length] : --length;
      if (!initial) {
        memo = obj[index];
        initial = true;
      } else {
        memo = iterator.call(context, memo, obj[index], index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, iterator, context) {
    var result;
    any(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Delegates to **ECMAScript 5**'s native `filter` if available.
  // Aliased as `select`.
  _.filter = _.select = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeFilter && obj.filter === nativeFilter) return obj.filter(iterator, context);
    each(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) results[results.length] = value;
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, iterator, context) {
    return _.filter(obj, function(value, index, list) {
      return !iterator.call(context, value, index, list);
    }, context);
  };

  // Determine whether all of the elements match a truth test.
  // Delegates to **ECMAScript 5**'s native `every` if available.
  // Aliased as `all`.
  _.every = _.all = function(obj, iterator, context) {
    iterator || (iterator = _.identity);
    var result = true;
    if (obj == null) return result;
    if (nativeEvery && obj.every === nativeEvery) return obj.every(iterator, context);
    each(obj, function(value, index, list) {
      if (!(result = result && iterator.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if at least one element in the object matches a truth test.
  // Delegates to **ECMAScript 5**'s native `some` if available.
  // Aliased as `any`.
  var any = _.some = _.any = function(obj, iterator, context) {
    iterator || (iterator = _.identity);
    var result = false;
    if (obj == null) return result;
    if (nativeSome && obj.some === nativeSome) return obj.some(iterator, context);
    each(obj, function(value, index, list) {
      if (result || (result = iterator.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if the array or object contains a given value (using `===`).
  // Aliased as `include`.
  _.contains = _.include = function(obj, target) {
    if (obj == null) return false;
    if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
    return any(obj, function(value) {
      return value === target;
    });
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      return (isFunc ? method : value[method]).apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, function(value){ return value[key]; });
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs, first) {
    if (_.isEmpty(attrs)) return first ? null : [];
    return _[first ? 'find' : 'filter'](obj, function(value) {
      for (var key in attrs) {
        if (attrs[key] !== value[key]) return false;
      }
      return true;
    });
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.where(obj, attrs, true);
  };

  // Return the maximum element or (element-based computation).
  // Can't optimize arrays of integers longer than 65,535 elements.
  // See: https://bugs.webkit.org/show_bug.cgi?id=80797
  _.max = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.max.apply(Math, obj);
    }
    if (!iterator && _.isEmpty(obj)) return -Infinity;
    var result = {computed : -Infinity, value: -Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed >= result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.min.apply(Math, obj);
    }
    if (!iterator && _.isEmpty(obj)) return Infinity;
    var result = {computed : Infinity, value: Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed < result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Shuffle an array.
  _.shuffle = function(obj) {
    var rand;
    var index = 0;
    var shuffled = [];
    each(obj, function(value) {
      rand = _.random(index++);
      shuffled[index - 1] = shuffled[rand];
      shuffled[rand] = value;
    });
    return shuffled;
  };

  // An internal function to generate lookup iterators.
  var lookupIterator = function(value) {
    return _.isFunction(value) ? value : function(obj){ return obj[value]; };
  };

  // Sort the object's values by a criterion produced by an iterator.
  _.sortBy = function(obj, value, context) {
    var iterator = lookupIterator(value);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value : value,
        index : index,
        criteria : iterator.call(context, value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index < right.index ? -1 : 1;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(obj, value, context, behavior) {
    var result = {};
    var iterator = lookupIterator(value || _.identity);
    each(obj, function(value, index) {
      var key = iterator.call(context, value, index, obj);
      behavior(result, key, value);
    });
    return result;
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = function(obj, value, context) {
    return group(obj, value, context, function(result, key, value) {
      (_.has(result, key) ? result[key] : (result[key] = [])).push(value);
    });
  };

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = function(obj, value, context) {
    return group(obj, value, context, function(result, key) {
      if (!_.has(result, key)) result[key] = 0;
      result[key]++;
    });
  };

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iterator, context) {
    iterator = iterator == null ? _.identity : lookupIterator(iterator);
    var value = iterator.call(context, obj);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = (low + high) >>> 1;
      iterator.call(context, array[mid]) < value ? low = mid + 1 : high = mid;
    }
    return low;
  };

  // Safely convert anything iterable into a real, live array.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (obj.length === +obj.length) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return (obj.length === +obj.length) ? obj.length : _.keys(obj).length;
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    return (n != null) && !guard ? slice.call(array, 0, n) : array[0];
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N. The **guard** check allows it to work with
  // `_.map`.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, array.length - ((n == null) || guard ? 1 : n));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array. The **guard** check allows it to work with `_.map`.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if ((n != null) && !guard) {
      return slice.call(array, Math.max(array.length - n, 0));
    } else {
      return array[array.length - 1];
    }
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array. The **guard**
  // check allows it to work with `_.map`.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, (n == null) || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, output) {
    each(input, function(value) {
      if (_.isArray(value)) {
        shallow ? push.apply(output, value) : flatten(value, shallow, output);
      } else {
        output.push(value);
      }
    });
    return output;
  };

  // Return a completely flattened version of an array.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, []);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iterator, context) {
    if (_.isFunction(isSorted)) {
      context = iterator;
      iterator = isSorted;
      isSorted = false;
    }
    var initial = iterator ? _.map(array, iterator, context) : array;
    var results = [];
    var seen = [];
    each(initial, function(value, index) {
      if (isSorted ? (!index || seen[seen.length - 1] !== value) : !_.contains(seen, value)) {
        seen.push(value);
        results.push(array[index]);
      }
    });
    return results;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(concat.apply(ArrayProto, arguments));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var rest = slice.call(arguments, 1);
    return _.filter(_.uniq(array), function(item) {
      return _.every(rest, function(other) {
        return _.indexOf(other, item) >= 0;
      });
    });
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = concat.apply(ArrayProto, slice.call(arguments, 1));
    return _.filter(array, function(value){ return !_.contains(rest, value); });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    var args = slice.call(arguments);
    var length = _.max(_.pluck(args, 'length'));
    var results = new Array(length);
    for (var i = 0; i < length; i++) {
      results[i] = _.pluck(args, "" + i);
    }
    return results;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    if (list == null) return {};
    var result = {};
    for (var i = 0, l = list.length; i < l; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // If the browser doesn't supply us with indexOf (I'm looking at you, **MSIE**),
  // we need this function. Return the position of the first occurrence of an
  // item in an array, or -1 if the item is not included in the array.
  // Delegates to **ECMAScript 5**'s native `indexOf` if available.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = function(array, item, isSorted) {
    if (array == null) return -1;
    var i = 0, l = array.length;
    if (isSorted) {
      if (typeof isSorted == 'number') {
        i = (isSorted < 0 ? Math.max(0, l + isSorted) : isSorted);
      } else {
        i = _.sortedIndex(array, item);
        return array[i] === item ? i : -1;
      }
    }
    if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item, isSorted);
    for (; i < l; i++) if (array[i] === item) return i;
    return -1;
  };

  // Delegates to **ECMAScript 5**'s native `lastIndexOf` if available.
  _.lastIndexOf = function(array, item, from) {
    if (array == null) return -1;
    var hasIndex = from != null;
    if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) {
      return hasIndex ? array.lastIndexOf(item, from) : array.lastIndexOf(item);
    }
    var i = (hasIndex ? from : array.length);
    while (i--) if (array[i] === item) return i;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = arguments[2] || 1;

    var len = Math.max(Math.ceil((stop - start) / step), 0);
    var idx = 0;
    var range = new Array(len);

    while(idx < len) {
      range[idx++] = start;
      start += step;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    if (func.bind === nativeBind && nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    var args = slice.call(arguments, 2);
    return function() {
      return func.apply(context, args.concat(slice.call(arguments)));
    };
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context.
  _.partial = function(func) {
    var args = slice.call(arguments, 1);
    return function() {
      return func.apply(this, args.concat(slice.call(arguments)));
    };
  };

  // Bind all of an object's methods to that object. Useful for ensuring that
  // all callbacks defined on an object belong to it.
  _.bindAll = function(obj) {
    var funcs = slice.call(arguments, 1);
    if (funcs.length === 0) funcs = _.functions(obj);
    each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memo = {};
    hasher || (hasher = _.identity);
    return function() {
      var key = hasher.apply(this, arguments);
      return _.has(memo, key) ? memo[key] : (memo[key] = func.apply(this, arguments));
    };
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){ return func.apply(null, args); }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
  };

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time.
  _.throttle = function(func, wait) {
    var context, args, timeout, result;
    var previous = 0;
    var later = function() {
      previous = new Date;
      timeout = null;
      result = func.apply(context, args);
    };
    return function() {
      var now = new Date;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0) {
        clearTimeout(timeout);
        timeout = null;
        previous = now;
        result = func.apply(context, args);
      } else if (!timeout) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, result;
    return function() {
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        if (!immediate) result = func.apply(context, args);
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) result = func.apply(context, args);
      return result;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = function(func) {
    var ran = false, memo;
    return function() {
      if (ran) return memo;
      ran = true;
      memo = func.apply(this, arguments);
      func = null;
      return memo;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return function() {
      var args = [func];
      push.apply(args, arguments);
      return wrapper.apply(this, args);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var funcs = arguments;
    return function() {
      var args = arguments;
      for (var i = funcs.length - 1; i >= 0; i--) {
        args = [funcs[i].apply(this, args)];
      }
      return args[0];
    };
  };

  // Returns a function that will only be executed after being called N times.
  _.after = function(times, func) {
    if (times <= 0) return func();
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Object Functions
  // ----------------

  // Retrieve the names of an object's properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = nativeKeys || function(obj) {
    if (obj !== Object(obj)) throw new TypeError('Invalid object');
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys[keys.length] = key;
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var values = [];
    for (var key in obj) if (_.has(obj, key)) values.push(obj[key]);
    return values;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var pairs = [];
    for (var key in obj) if (_.has(obj, key)) pairs.push([key, obj[key]]);
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    for (var key in obj) if (_.has(obj, key)) result[obj[key]] = key;
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    each(keys, function(key) {
      if (key in obj) copy[key] = obj[key];
    });
    return copy;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    for (var key in obj) {
      if (!_.contains(keys, key)) copy[key] = obj[key];
    }
    return copy;
  };

  // Fill in a given object with default properties.
  _.defaults = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          if (obj[prop] == null) obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the Harmony `egal` proposal: http://wiki.ecmascript.org/doku.php?id=harmony:egal.
    if (a === b) return a !== 0 || 1 / a == 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className != toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, dates, and booleans are compared by value.
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return a == String(b);
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
        // other numeric values.
        return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a == +b;
      // RegExps are compared by their source patterns and flags.
      case '[object RegExp]':
        return a.source == b.source &&
               a.global == b.global &&
               a.multiline == b.multiline &&
               a.ignoreCase == b.ignoreCase;
    }
    if (typeof a != 'object' || typeof b != 'object') return false;
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] == a) return bStack[length] == b;
    }
    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);
    var size = 0, result = true;
    // Recursively compare objects and arrays.
    if (className == '[object Array]') {
      // Compare array lengths to determine if a deep comparison is necessary.
      size = a.length;
      result = size == b.length;
      if (result) {
        // Deep compare the contents, ignoring non-numeric properties.
        while (size--) {
          if (!(result = eq(a[size], b[size], aStack, bStack))) break;
        }
      }
    } else {
      // Objects with different constructors are not equivalent, but `Object`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && (aCtor instanceof aCtor) &&
                               _.isFunction(bCtor) && (bCtor instanceof bCtor))) {
        return false;
      }
      // Deep compare objects.
      for (var key in a) {
        if (_.has(a, key)) {
          // Count the expected number of properties.
          size++;
          // Deep compare each member.
          if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
        }
      }
      // Ensure that both objects contain the same number of properties.
      if (result) {
        for (key in b) {
          if (_.has(b, key) && !(size--)) break;
        }
        result = !size;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return result;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b, [], []);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
    for (var key in obj) if (_.has(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) == '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    return obj === Object(obj);
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
  each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) == '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return !!(obj && _.has(obj, 'callee'));
    };
  }

  // Optimize `isFunction` if appropriate.
  if (typeof (/./) !== 'function') {
    _.isFunction = function(obj) {
      return typeof obj === 'function';
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj != +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iterators.
  _.identity = function(value) {
    return value;
  };

  // Run a function **n** times.
  _.times = function(n, iterator, context) {
    var accum = Array(n);
    for (var i = 0; i < n; i++) accum[i] = iterator.call(context, i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // List of HTML entities for escaping.
  var entityMap = {
    escape: {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    }
  };
  entityMap.unescape = _.invert(entityMap.escape);

  // Regexes containing the keys and values listed immediately above.
  var entityRegexes = {
    escape:   new RegExp('[' + _.keys(entityMap.escape).join('') + ']', 'g'),
    unescape: new RegExp('(' + _.keys(entityMap.unescape).join('|') + ')', 'g')
  };

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  _.each(['escape', 'unescape'], function(method) {
    _[method] = function(string) {
      if (string == null) return '';
      return ('' + string).replace(entityRegexes[method], function(match) {
        return entityMap[method][match];
      });
    };
  });

  // If the value of the named property is a function then invoke it;
  // otherwise, return it.
  _.result = function(object, property) {
    if (object == null) return null;
    var value = object[property];
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    each(_.functions(obj), function(name){
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result.call(this, func.apply(_, args));
      };
    });
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\t':     't',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g;

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  _.template = function(text, data, settings) {
    var render;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = new RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset)
        .replace(escaper, function(match) { return '\\' + escapes[match]; });

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      }
      if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      }
      if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }
      index = offset + match.length;
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + "return __p;\n";

    try {
      render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    if (data) return render(data, _);
    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled function source as a convenience for precompilation.
    template.source = 'function(' + (settings.variable || 'obj') + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function, which will delegate to the wrapper.
  _.chain = function(obj) {
    return _(obj).chain();
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(obj) {
    return this._chain ? _(obj).chain() : obj;
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name == 'shift' || name == 'splice') && obj.length === 0) delete obj[0];
      return result.call(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result.call(this, method.apply(this._wrapped, arguments));
    };
  });

  _.extend(_.prototype, {

    // Start chaining a wrapped Underscore object.
    chain: function() {
      this._chain = true;
      return this;
    },

    // Extracts the result from a wrapped and chained object.
    value: function() {
      return this._wrapped;
    }

  });

}).call(this);

});

require.define("/node_modules/tztime/lib/timezone-js.js",function(require,module,exports,__dirname,__filename,process,global){/*
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
    var url = path.join(_this.zoneFileBasePath, fileName);
    
    // If running in node.js
    if (fs.readFileSync) {
      url = path.join(__dirname, url);

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

require.define("/node_modules/tztime/src/Timeline.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var JSON, Time, Timeline, TimelineIterator, timezoneJS, utils,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  Time = require('./Time').Time;

  timezoneJS = require('./../lib/timezone-js.js').timezoneJS;

  utils = require('./utils');

  JSON = require('JSON2');

  Timeline = (function() {
    /*
    @class Timeline
    
    Allows you to specify a timeline with weekend, holiday and non-work hours knocked out and timezone precision.
    
    ## Basic usage ##
    
        {TimelineIterator, Timeline, Time} = require('../')
    
        tl = new Timeline({
          startOn: '2011-01-03',
          endBefore: '2011-01-05',
        })
    
        console.log(t.toString() for t in tl.getAll())
        # [ '2011-01-03', '2011-01-04' ]
    
    Notice how the endBefore, '2011-01-05', is excluded. Timelines are inclusive of the startOn and exclusive of the
    endBefore. This allows the endBefore to be the startOn of the next with no overlap or gap. This focus on precision
    pervades the design of the Time library.
    
    Perhaps the most common use of Timeline is to return a Timeline of ISOStrings shifted to the correct timezone.
    Since ISOString comparisons give the expected chronological results and many APIs return their date/time stamps as
    ISOStrings, it's convenient and surprisingly fast to do your own bucketing operations after you've gotten a Timeline
    of ISOStrings.
    
        console.log(tl.getAll('ISOString', 'America/New_York'))
        # [ '2011-01-03T05:00:00.000Z', '2011-01-04T05:00:00.000Z' ]
    
    ## More advanced usage ##
     
    Now let's poke at Timeline behavior a little more. Let's start by creating a more advanced Timeline:
    
        tl = new Timeline({
          startOn: '2011-01-02',
          endBefore: '2011-01-07',
          holidays: [
            {month: 1, day: 1},  # Notice the lack of a year specification
            '2011-01-04'  # Got January 4 off also in 2011. Allows ISO strings.
          ]
        })
        
    `workDays` is already defaulted but you could have overridden it.
    
        console.log(tl.workDays)
        # [ 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday' ]
        
    Another common use case is to get a Timeline to return child Timelines. You see, Timelines can be thought of as
    time boxes with a startOn and an endBefore. You might have a big time box for the entire x-axis for a chart
    but if you want to bucket raw data into each tick on the x-axis, you'll need to know where each sub-time box starts
    and ends.
    
        subTimelines = tl.getAll('Timeline')
        console.log((t.startOn.toString() + ' to ' + t.endBefore.toString() for t in subTimelines))
        # [ '2011-01-03 to 2011-01-05',
        #   '2011-01-05 to 2011-01-06',
        #   '2011-01-06 to 2011-01-07' ]
    
    Notice how the first subTimeline went all the way from 03 to 05. That's because we specified 04 as a holiday.
    Timelines are contiguous without gaps or overlap. You can see that the endBefore of one subTimeline is always the startOn
    of the next.
    
    Now, let's create a Timeline with `hour` granularity and show of the concept that Timelines also serve as time boxes by
    learning about the contains() method.
        
        tl2 = new Timeline({
          startOn: '2011-01-02T00',
          endBefore: '2011-01-07T00',
        })
        
    `startOn` is inclusive.
    
        console.log(tl2.contains('2011-01-02T00'))
        # true
        
    But `endBefore` is exclusive
    
        console.log(tl2.contains('2011-01-07T00'))
        # false
    
    But just before `endBefore` is OK
    
        console.log(tl2.contains('2011-01-06T23'))
        # true
    
    All of the above comparisons assume that the `startOn`/`endBefore` boundaries are in the same timezone as the contains date.
    
    ## Timezone sensitive comparisions ##
    
    Now, let's look at how you do timezone sensitive comparisions.
    
    If you pass in a timezone, then it will shift the Timeline boundaries to that timezone to compare to the 
    date/timestamp that you pass in. This system is optimized to the pattern where you first define your boundaries without regard 
    to timezone. Christmas day is a holiday in any timezone. Saturday and Sunday are non work days in any timezone. The iteration
    starts on July 10th; etc. THEN you have a bunch of data that you have stored in a database in GMT. Maybe you've pulled
    it down from an API but the data is represented with ISOString. You then want to decide if the ISOString
    is contained within the iteration as defined by a particular timezone, or is a Saturday, or is during workhours, etc. 
    The key concept to remember is that the timebox boundaries are shifted NOT the other way around. It says at what moment
    in time July 10th starts on in a particular timezone and internally represents that in a way that can be compared to
    an ISOString.
    
    So, when it's 3am in GMT on 2011-01-02, it's still 2011-01-01 in New York. Using the above `tl2` timeline, we say:
    
        console.log(tl2.contains('2011-01-02T03:00:00.000Z', 'America/New_York'))
        # false
        
    But it's still 2011-01-06 in New York, when it's 3am in GMT on 2011-01-07
        
        console.log(tl2.contains('2011-01-07T03:00:00.000Z', 'America/New_York'))
        # true
    */

    function Timeline(config) {
      /*
      @constructor
      @param {Object} config
      
      @cfg {Time/ISOString} [startOn] Unless it falls on a knocked out moment, this is the first value in the resulting Timeline
        If it falls on a knocked out moment, it will advance to the first appropriate moment after startOn.
        You must specify 2 out of 3 of startOn, endBefore, and limit.
      @cfg {Time/ISOString} [endBefore] Must match granularity of startOn. Timeline will stop before returning this value.
        You must specify 2 out of 3 of startOn, endBefore, and limit.
      @cfg {Number} [limit] You can specify limit and either startOn or endBefore and only get back this many.
        You must specify 2 out of 3 of startOn, endBefore, and limit.
      @cfg {Number} [step = 1 or -1] Use -1 to march backwards from endBefore - 1. Currently any
         values other than 1 and -1 are not well tested.
      @cfg {String} [granularity = granularity of startOn or endBefore] Used to determine the granularity of the ticks.
        Note, this can be different from the granularity of startOn and endBefore. For example:
      
          {
            startOn: '2012-01', # Month Granularity
            endBefore: '2012-02', # Month Granularity
            granularity: Time.DAY # Day granularity
          }
      
      @cfg {String[]/String} [workDays =  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']] List of days of the
        week that you work on. You can specify this as an Array of Strings (['Monday', 'Tuesday', ...]) or a single comma
        seperated String ("Monday,Tuesday,...").
      @cfg {Array} [holidays] An optional Array of either ISOStrings or JavaScript Objects (and you can mix and match). Example:
      
          [{month: 12, day: 25}, {year: 2011, month: 11, day: 24}, "2012-12-24"]
      
         Notice how you can leave off the year if the holiday falls on the same day every year.
      @cfg {Object} [workDayStartOn = {hour: 0, minute: 0}] An optional object in the form {hour: 8, minute: 15}.
        If minute is zero it can be omitted. If workDayStartOn is later than workDayEndBefore, then it assumes that you
        work the night shift and your work  hours span midnight.
      
        The use of workDayStartOn and workDayEndBefore only make sense when the granularity is "hour" or finer.
      
        Note: If the business closes at 5:00pm, you'll want to leave workDayEndBefore to 17:00, rather
        than 17:01. Think about it, you'll be open 4:59:59.999pm, but you'll be closed at 5:00pm. This also makes all of
        the math work. 9am to 5pm means 17 - 9 = an 8 hour work day.
      @cfg {Object} [workDayEndBefore = {hour: 24, minute: 60}] An optional object in the form {hour: 17, minute: 0}.
        If minute is zero it can be omitted.
      */

      var h, holiday, idx, m, s, _i, _len, _ref, _ref1;
      this.memoizedTicks = {};
      if (config.endBefore != null) {
        this.endBefore = config.endBefore;
        if (this.endBefore !== 'PAST_LAST') {
          if (utils.type(this.endBefore) === 'string') {
            this.endBefore = new Time(this.endBefore);
          }
          this.granularity = this.endBefore.granularity;
        }
      }
      if (config.startOn != null) {
        this.startOn = config.startOn;
        if (this.startOn !== 'BEFORE_FIRST') {
          if (utils.type(this.startOn) === 'string') {
            this.startOn = new Time(this.startOn);
          }
          this.granularity = this.startOn.granularity;
        }
      }
      if (config.granularity != null) {
        this.granularity = config.granularity;
        if (this.startOn != null) {
          this.startOn = this.startOn.inGranularity(this.granularity);
        }
        if (this.endBefore != null) {
          this.endBefore = this.endBefore.inGranularity(this.granularity);
        }
      }
      if (!this.granularity) {
        throw new Error('Cannot determine granularity for Timeline.');
      }
      if (this.startOn === 'BEFORE_FIRST') {
        this.startOn = new Time(this.startOn, this.granularity);
      }
      if (this.endBefore === 'PAST_LAST') {
        this.endBefore === new Time(this.endBefore, this.granularity);
      }
      if (!this.endBefore) {
        this.endBefore = new Time('PAST_LAST', this.granularity);
      }
      if (!this.startOn) {
        this.startOn = new Time('BEFORE_FIRST', this.granularity);
      }
      this.limit = config.limit != null ? config.limit : utils.MAX_INT;
      if (config.workDays != null) {
        this.workDays = config.workDays;
      } else if (config.workdays != null) {
        this.workDays = config.workdays;
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
      this.holidays = config.holidays != null ? config.holidays : [];
      _ref = this.holidays;
      for (idx = _i = 0, _len = _ref.length; _i < _len; idx = ++_i) {
        holiday = _ref[idx];
        if (utils.type(holiday) === 'string') {
          this.holidays[idx] = new Time(holiday).getSegmentsAsObject();
        }
      }
      this.workDayStartOn = config.workDayStartOn != null ? config.workDayStartOn : void 0;
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
      this.workDayEndBefore = config.workDayEndBefore != null ? config.workDayEndBefore : void 0;
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
      if (config.step != null) {
        this.step = config.step;
      } else if ((config.endBefore != null) && ((_ref1 = this.startOn) != null ? _ref1.greaterThan(this.endBefore) : void 0)) {
        this.step = -1;
      } else if ((config.endBefore != null) && (config.startOn == null) && (config.limit != null)) {
        this.step = -1;
      } else {
        this.step = 1;
      }
      utils.assert(((config.startOn != null) && (config.endBefore != null)) || ((config.startOn != null) && (config.limit != null) && this.step > 0) || ((config.endBefore != null) && (config.limit != null) && this.step < 0), 'Must provide two out of "startOn", "endBefore", or "limit" and the sign of step must match.');
    }

    Timeline.prototype.getIterator = function(tickType, tz, childGranularity) {
      if (tickType == null) {
        tickType = 'Time';
      }
      /*
      @method getIterator
      @param {String} [tickType] An optional String that specifies what type should be returned on each call to next().
        Possible values are 'Time' (default), 'Timeline', 'Date' (javascript Date Object), and 'ISOString'.
      @param {String} [tz] A Sting specifying the timezone in the standard form,`America/New_York` for example. This is
        required if `tickType` is 'Date' or 'ISOString'.
      @param {String} [childGranularity] When tickType is 'Timeline', this is the granularity for the startOn and endBefore of the
        Timeline that is returned.
      @return {TimelineIterator}
      
      Returns a new TimelineIterator using this Timeline as the boundaries.
      */

      return new TimelineIterator(this, tickType, tz, childGranularity);
    };

    Timeline.prototype.getAllRaw = function(tickType, tz, childGranularity) {
      var temp, tli;
      if (tickType == null) {
        tickType = 'Time';
      }
      /*
      @method getAllRaw
      @param {String} [tickType] An optional String that specifies the type should be returned. Possible values are 'Time' (default),
         'Timeline', 'Date' (javascript Date Object), and 'ISOString'.
      @param {String} [tz] A Sting specifying the timezone in the standard form,`America/New_York` for example. This is
         required if `tickType` is 'Date' or 'ISOString'.
      @param {String} [childGranularity] When tickType is 'Timeline', this is the granularity for the startOn and endBefore of the
         Timeline that is returned.
      @return {Time[]/Date[]/Timeline[]/String[]}
      
      Returns all of the points in the timeline. Note, this will come back in the order specified
      by step so they could be out of chronological order. Use getAll() if they must be in chronological order.
      */

      tli = this.getIterator(tickType, tz, childGranularity);
      temp = [];
      while (tli.hasNext()) {
        temp.push(tli.next());
      }
      return temp;
    };

    Timeline.prototype.getAll = function(tickType, tz, childGranularity) {
      var parameterKey, parameterKeyObject, ticks;
      if (tickType == null) {
        tickType = 'Time';
      }
      /*
      @method getAll
      @param {String} [tickType] An optional String that specifies what should be returned. Possible values are 'Time' (default),
         'Timeline', 'Date' (javascript Date Object), and 'ISOString'.
      @param {String} [tz] A Sting specifying the timezone in the standard form,`America/New_York` for example. This is
         required if `tickType` is 'Date' or 'ISOString'.
      @param {String} [childGranularity] When tickType is 'Timeline', this is the granularity for the startOn and endBefore of the
         Timeline object that is returned.
      @return {Time[]/Date[]/Timeline[]/String[]}
      
      Returns all of the points in the timeline in chronological order. If you want them in the order specified by `step`
      then use getAllRaw(). Note, the output of this function is memoized so that subsequent calls to getAll() for the
      same Timeline instance with the same parameters will return the previously calculated values. This makes it safe
      to call it repeatedly within loops and means you don't need to worry about holding onto the result on the client
      side.
      */

      parameterKeyObject = {
        tickType: tickType
      };
      if (tz != null) {
        parameterKeyObject.tz = tz;
      }
      if (childGranularity != null) {
        parameterKeyObject.childGranularity = childGranularity;
      }
      parameterKey = JSON.stringify(parameterKeyObject);
      ticks = this.memoizedTicks[parameterKey];
      if (ticks == null) {
        ticks = this.getAllRaw(tickType, tz, childGranularity);
        if (ticks.length > 1) {
          if ((ticks[0] instanceof Time && ticks[0].greaterThan(ticks[1])) || (utils.type(ticks[0]) === 'string' && ticks[0] > ticks[1])) {
            ticks.reverse();
          }
        }
        this.memoizedTicks[parameterKey] = ticks;
      }
      return ticks;
    };

    Timeline.prototype.ticksThatIntersect = function(startOn, endBefore, tz) {
      /*
      @method ticksThatIntersect
      @param {Time/ISOString} startOn The start of the time period of interest
      @param {Time/ISOString} endBefore The moment just past the end of the time period of interest
      @param {String} tz The timezone you want to use for the comparison
      @return {Array}
      
      Returns the list of ticks from this Timeline that intersect with the time period specified by the parameters
      startOn and endBefore. This is a convenient way to "tag" a timebox as overlaping with particular moments on
      your Timeline. A common pattern for Lumenize calculators is to use ticksThatIntersect to "tag" each snapshot
      and then do groupBy operations with an OLAPCube.
      */

      var en, i, isoDateRegExp, out, st, ticks, ticksLength;
      utils.assert(this.limit === utils.MAX_INT, 'Cannot call `ticksThatIntersect()` on Timelines specified with `limit`.');
      out = [];
      if (utils.type(startOn) === 'string') {
        utils.assert(utils.type(endBefore) === 'string', 'The type for startOn and endBefore must match.');
        isoDateRegExp = /\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d.\d\d\dZ/;
        utils.assert(isoDateRegExp.test(startOn), 'startOn must be in form ####-##-##T##:##:##.###Z');
        utils.assert(isoDateRegExp.test(endBefore), 'endBefore must be in form ####-##-##T##:##:##.###Z');
        utils.assert(tz != null, "Must specify parameter tz when submitting ISO string boundaries.");
        ticks = this.getAll('ISOString', tz);
        if (ticks[0] >= endBefore || ticks[ticks.length - 1] < startOn) {
          out = [];
        } else {
          i = 0;
          ticksLength = ticks.length;
          while (i < ticksLength && ticks[i] < startOn) {
            i++;
          }
          while (i < ticksLength && ticks[i] < endBefore) {
            out.push(ticks[i]);
            i++;
          }
        }
      } else if (startOn instanceof Time) {
        utils.assert(endBefore instanceof Time, 'The type for startOn and endBefore must match.');
        startOn = startOn.inGranularity(this.granularity);
        endBefore = endBefore.inGranularity(this.granularity);
        if (this.endBefore.lessThan(this.startOn)) {
          st = this.endBefore;
          en = this.startOn;
        } else {
          st = this.startOn;
          en = this.endBefore;
        }
        if (st.greaterThanOrEqual(endBefore) || en.lessThan(startOn)) {
          out = [];
        } else {
          ticks = this.getAll();
          i = 0;
          ticksLength = ticks.length;
          while (i < ticksLength && ticks[i].lessThan(startOn)) {
            i++;
          }
          while (i < ticksLength && ticks[i].lessThan(endBefore)) {
            out.push(ticks[i]);
            i++;
          }
        }
      } else {
        throw new Error("startOn must be a String or a Time object.");
      }
      return out;
    };

    Timeline.prototype.contains = function(date, tz) {
      /*
      @method contains
      @param {Time/Date/String} date can be either a JavaScript date object or an ISO-8601 formatted string
      @param {String} [tz]
      @return {Boolean} true if the date provided is within this Timeline.
      
      ## Usage: ##
      
      We can create a Timeline from May to just before July.
      
          tl = new Timeline({
            startOn: '2011-05',
            endBefore: '2011-07'
          })
      
          console.log(tl.contains('2011-06-15T12:00:00.000Z', 'America/New_York'))
          # true
      */

      var endBefore, startOn, target;
      utils.assert(this.limit === utils.MAX_INT, 'Cannot call `contains()` on Timelines specified with `limit`.');
      if (date instanceof Time) {
        return date.lessThan(this.endBefore) && date.greaterThanOrEqual(this.startOn);
      }
      utils.assert((tz != null) || utils.type(date) !== 'date', 'Timeline.contains() requires a second parameter (timezone) when the first parameter is a Date()');
      switch (utils.type(date)) {
        case 'string':
          if (tz != null) {
            target = timezoneJS.parseISO(date);
          } else {
            target = new Time(date);
            return target.lessThan(this.endBefore) && target.greaterThanOrEqual(this.startOn);
          }
          break;
        case 'date':
          target = date.getTime();
          break;
        default:
          throw new Error('Timeline.contains() requires that the first parameter be of type Time, String, or Date');
      }
      startOn = this.startOn.getJSDate(tz);
      endBefore = this.endBefore.getJSDate(tz);
      return target < endBefore && target >= startOn;
    };

    return Timeline;

  })();

  TimelineIterator = (function() {
    /*
    @class TimelineIterator
    
    In most cases you'll want to call getAll() on Timeline. TimelineIterator is for use cases where you want to get the
    values in the Timeline one at a time.
    
    You usually get a TimelineIterator by calling getIterator() on a Timeline object.
    
    Iterate through days, months, years, etc. skipping weekends and holidays that you
    specify. It will also iterate over hours, minutes, seconds, etc. and skip times that are not
    between the specified work hours.
    
    ## Usage ##
    
        {TimelineIterator, Timeline, Time} = require('../')
    
        tl = new Timeline({
          startOn:new Time({granularity: 'day', year: 2009, month:1, day: 1}),
          endBefore:new Time({granularity: 'day', year: 2009, month:1, day: 8}),
          workDays: 'Monday, Tuesday, Wednesday, Thursday, Friday',
          holidays: [
            {month: 1, day: 1},  # New Years day was a Thursday in 2009
            {year: 2009, month: 1, day: 2}  # Also got Friday off in 2009
          ]
        })
    
        tli = tl.getIterator()
    
        while (tli.hasNext())
          console.log(tli.next().toString())
    
        # 2009-01-05
        # 2009-01-06
        # 2009-01-07
    
    Now, let's explore how Timelines and TimelineIterators are used together.
    
        tl3 = new Timeline({
          startOn:new Time('2011-01-06'),
          endBefore:new Time('2011-01-11'),
          workDayStartOn: {hour: 9, minute: 0},
          workDayEndBefore: {hour: 11, minute: 0}  # Very short work day for demo purposes
        })
    
    You can specify that the tickType be Timelines rather than Time values. On each call to `next()`, the
    iterator will give you a new Timeline with the `startOn` value set to what you would have gotten had you
    requested that the tickType be Times. The `endBefore' of the returned Timeline will be set to the next value.
    This is how you drill-down from one granularity into a lower granularity.
    
    By default, the granularity of the iterator will equal the `startOn`/`endBefore` of the original Timeline.
    However, you can provide a different granularity (`hour` in the example below) for the iterator if you want
    to drill-down at a lower granularity.
    
        tli3 = tl3.getIterator('Timeline', undefined, 'hour')
    
        while tli3.hasNext()
          subTimeline = tli3.next()
          console.log("Sub Timeline goes from #{subTimeline.startOn.toString()} to #{subTimeline.endBefore.toString()}")
          subIterator = subTimeline.getIterator('Time')
          while subIterator.hasNext()
            console.log('    Hour: ' + subIterator.next().hour)
    
        # Sub Timeline goes from 2011-01-06T00 to 2011-01-07T00
        #     Hour: 9
        #     Hour: 10
        # Sub Timeline goes from 2011-01-07T00 to 2011-01-10T00
        #     Hour: 9
        #     Hour: 10
        # Sub Timeline goes from 2011-01-10T00 to 2011-01-11T00
        #     Hour: 9
        #     Hour: 10
    
    There is a lot going on here, so let's poke at it a bit. First, notice how the second sub-Timeline goes from the 7th to the
    10th. That's because there was a weekend in there. We didn't get hours for the Saturday and Sunday.
    
    The above approach (`tl3`/`tli3`) is useful for some forms of hand generated analysis, but if you are using Time with
    Lumenize, it's overkill because Lumenize is smart enough to do rollups based upon the segments that are returned from the
    lowest granularity Time. So you can just iterate over the lower granularity and Lumenize will automatically manage
    the drill up/down to day/month/year levels automatically.
    
        tl4 = new Timeline({
          startOn:'2011-01-06T00',  # Notice how we include the hour now
          endBefore:'2011-01-11T00',
          workDayStartOn: {hour: 9, minute: 0},
          workDayEndBefore: {hour: 11, minute: 0}  # Very short work day for demo purposes
        })
    
        tli4 = tl4.getIterator('ISOString', 'GMT')
    
        while tli4.hasNext()
          console.log(tli4.next())
    
        # 2011-01-06T09:00:00.000Z
        # 2011-01-06T10:00:00.000Z
        # 2011-01-07T09:00:00.000Z
        # 2011-01-07T10:00:00.000Z
        # 2011-01-10T09:00:00.000Z
        # 2011-01-10T10:00:00.000Z
    
    `tl4`/`tli4` covers the same ground as `tl3`/`tli3` but without the explicit nesting.
    */

    var StopIteration, _contains;

    function TimelineIterator(timeline, tickType, tz, childGranularity) {
      var _ref;
      this.tickType = tickType != null ? tickType : 'Time';
      this.childGranularity = childGranularity;
      /*
      @constructor
      @param {Timeline} timeline A Timeline object
      @param {String} [tickType] An optional String that specifies the type for the returned ticks. Possible values are 'Time' (default),
         'Timeline', 'Date' (javascript Date Object), and 'ISOString'.
      @param {String} [childGranularity=granularity of timeline] When tickType is 'Timeline', this is the granularity for the startOn and endBefore of the
         Timeline that is returned.
      @param {String} [tz] A Sting specifying the timezone in the standard form,`America/New_York` for example. This is
         required if `tickType` is 'Date' or 'ISOString'.
      */

      utils.assert((_ref = this.tickType) === 'Time' || _ref === 'Timeline' || _ref === 'Date' || _ref === 'ISOString', "tickType must be 'Time', 'Timeline', 'Date', or 'ISOString'. You provided " + this.tickType + ".");
      utils.assert(this.tickType !== 'Date' || (tz != null), 'Must provide a tz (timezone) parameter when tickType is Date.');
      utils.assert(this.tickType !== 'ISOString' || (tz != null), 'Must provide a tz (timezone) parameter when returning ISOStrings.');
      if (this.tz == null) {
        this.tz = tz;
      }
      if (timeline instanceof Timeline) {
        this.timeline = timeline;
      } else {
        this.timeline = new Timeline(timeline);
      }
      if (this.childGranularity == null) {
        this.childGranularity = timeline.granularity;
      }
      this.reset();
    }

    StopIteration = typeof StopIteration === 'undefined' ? utils.StopIteration : StopIteration;

    TimelineIterator.prototype.reset = function() {
      /*
      @method reset
      
      Will go back to the where the iterator started.
      */

      if (this.timeline.step > 0) {
        this.current = new Time(this.timeline.startOn);
      } else {
        this.current = new Time(this.timeline.endBefore);
        this.current.decrement();
      }
      this.count = 0;
      return this._proceedToNextValid();
    };

    _contains = function(t, startOn, endBefore) {
      return t.lessThan(endBefore) && t.greaterThanOrEqual(startOn);
    };

    TimelineIterator.prototype.hasNext = function() {
      /*
      @method hasNext
      @return {Boolean} Returns true if there are still things left to iterator over. Note that if there are holidays,
         weekends or non-workhours to skip, then hasNext() will take that into account.
      */

      return _contains(this.current, this.timeline.startOn, this.timeline.endBefore) && (this.count < this.timeline.limit);
    };

    TimelineIterator.prototype._shouldBeExcluded = function() {
      var currentInDay, currentMinutes, holiday, _i, _len, _ref, _ref1, _ref2;
      if (this.current._isGranularityCoarserThanDay()) {
        return false;
      }
      currentInDay = this.current.inGranularity('day');
      if (_ref = this.current.dowString(), __indexOf.call(this.timeline.workDays, _ref) < 0) {
        return true;
      }
      _ref1 = this.timeline.holidays;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        holiday = _ref1[_i];
        if (utils.match(holiday, currentInDay)) {
          return true;
        }
      }
      if ((_ref2 = this.timeline.granularity) === 'hour' || _ref2 === 'minute' || _ref2 === ' second' || _ref2 === 'millisecond') {
        currentMinutes = this.current.hour * 60;
        if (this.current.minute != null) {
          currentMinutes += this.current.minute;
        }
        if (this.timeline.startOnWorkMinutes <= this.timeline.endBeforeWorkMinutes) {
          if ((currentMinutes < this.timeline.startOnWorkMinutes) || (currentMinutes >= this.timeline.endBeforeWorkMinutes)) {
            return true;
          }
        } else {
          if ((this.timeline.startOnWorkMinutes >= currentMinutes && currentMinutes > this.timeline.endBeforeWorkMinutes)) {
            return true;
          }
        }
      }
      return false;
    };

    TimelineIterator.prototype._proceedToNextValid = function() {
      var _results;
      _results = [];
      while (this.hasNext() && this._shouldBeExcluded()) {
        if (this.timeline.step > 0) {
          _results.push(this.current.increment());
        } else {
          _results.push(this.current.decrement());
        }
      }
      return _results;
    };

    TimelineIterator.prototype.next = function() {
      /*
      @method next
      @return {Time/Timeline/Date/String} Returns the next value of the iterator. The start will be the first value returned unless it should
         be skipped due to holiday, weekend, or workhour knockouts.
      */

      var childtimeline, config, currentCopy, i, _i, _ref;
      if (!this.hasNext()) {
        throw new StopIteration('Cannot call next() past end.');
      }
      currentCopy = new Time(this.current);
      this.count++;
      for (i = _i = _ref = Math.abs(this.timeline.step); _ref <= 1 ? _i <= 1 : _i >= 1; i = _ref <= 1 ? ++_i : --_i) {
        if (this.timeline.step > 0) {
          this.current.increment();
        } else {
          this.current.decrement();
        }
        this._proceedToNextValid();
      }
      switch (this.tickType) {
        case 'Time':
          return currentCopy;
        case 'Date':
          return currentCopy.getJSDate(this.tz);
        case 'ISOString':
          return currentCopy.getISOStringInTZ(this.tz);
        case 'Timeline':
          config = {
            startOn: currentCopy.inGranularity(this.childGranularity),
            endBefore: this.current.inGranularity(this.childGranularity),
            workDays: this.timeline.workDays,
            holidays: this.timeline.holidays,
            workDayStartOn: this.timeline.workDayStartOn,
            workDayEndBefore: this.timeline.workDayEndBefore
          };
          childtimeline = new Timeline(config);
          return childtimeline;
        default:
          throw new Error("You asked for tickType " + this.tickType + ". Only 'Time', 'Date', 'ISOString', and 'Timeline' are allowed.");
      }
    };

    return TimelineIterator;

  })();

  exports.Timeline = Timeline;

  exports.TimelineIterator = TimelineIterator;

}).call(this);

});

require.define("/src/iCalculator.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var JSON, iCalculator;

  JSON = require('JSON2');

  iCalculator = (function() {
    /*
    @class iCalculator
    
    This serves as documentation for the interface expected of all Lumenize Calculators. You can extend from it but it's
    not technically necessary. You are more likely to copy this as the starting point for a new calculator.
    */

    function iCalculator(config) {
      this.config = config;
      /*
      @constructor
      @param {Object} config
        The config properties are up to you.
      */

      throw new Error('iCalculator is an interface not a base class. You must override this constructor.');
    }

    iCalculator.prototype.addSnapshots = function(snapshots, startOn, endBefore) {
      /*
      @method addSnapshots
        Allows you to incrementally add snapshots to this calculator.
      @chainable
      @param {Object[]} snapshots An array of temporal data model snapshots.
      @param {String} startOn A ISOString (e.g. '2012-01-01T12:34:56.789Z') indicating the time start of the period of
        interest. On the second through nth call, this should equal the previous endBefore.
      @param {String} endBefore A ISOString (e.g. '2012-01-01T12:34:56.789Z') indicating the moment just past the time
        period of interest.
      @return {iCalculator}
      */

      throw new Error('iCalculator is an interface not a base class. You must override this addSnapshots method.');
      if (this.upToDateISOString != null) {
        utils.assert(this.upToDateISOString === startOn, "startOn (" + startOn + ") parameter should equal endBefore of previous call (" + this.upToDateISOString + ") to addSnapshots.");
      }
      this.upToDateISOString = endBefore;
      return this;
    };

    iCalculator.prototype.getResults = function() {
      /*
      @method getResults
        Returns the current state of the calculator
      @return {Object} The type and format of what it returns is up to you.
      */

      throw new Error('iCalculator is an interface not a base class. You must override this getResults method.');
    };

    iCalculator.prototype.getStateForSaving = function(meta) {
      /*
      @method getStateForSaving
        Enables saving the state of this calculator. See TimeInStateCalculator for a detailed example.
      @param {Object} [meta] An optional parameter that will be added to the serialized output and added to the meta field
        within the deserialized calculator.
      @return {Object} Returns an Ojbect representing the state of the calculator. This Object is suitable for saving to
        to an object store or LocalCache. Use the static method `newFromSavedState()` with this Object as the parameter to reconstitute
        the calculator.
      */

      var out;
      throw new Error('iCalculator is an interface not a base class. You must override this getStateForSaving method.');
      out = {};
      out.upToDateISOString = this.upToDateISOString;
      if (meta != null) {
        out.meta = meta;
      }
      return out;
    };

    iCalculator.newFromSavedState = function(p) {
      /*
      @method newFromSavedState
        Deserializes a previously saved calculator and returns a new calculator. See TimeInStateCalculator for a detailed example.
      @static
      @param {String/Object} p A String or Object from a previously saved calculator state
      @return {iCalculator}
      */

      throw new Error('iCalculator is an interface not a base class. You must override this @newFromSavedState method.');
      if (utils.type(p) === 'string') {
        p = JSON.parse(p);
      }
      if (p.meta != null) {
        calculator.meta = p.meta;
      }
      calculator.upToDateISOString = p.upToDateISOString;
      return calculator;
    };

    return iCalculator;

  })();

  exports.iCalculator = iCalculator;

}).call(this);

});

require.define("/src/TimeInStateCalculator.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var JSON, OLAPCube, Time, TimeInStateCalculator, Timeline, utils, _ref;

  OLAPCube = require('./OLAPCube').OLAPCube;

  _ref = require('tztime'), utils = _ref.utils, Time = _ref.Time, Timeline = _ref.Timeline;

  JSON = require('JSON2');

  TimeInStateCalculator = (function() {
    /*
    @class TimeInStateCalculator
    
    Used to calculate how much time each uniqueID spent "in-state". You use this by querying a temporal data
    model (like Rally's Lookback API) with a predicate indicating the "state" of interest. You'll then have a list of
    snapshots where that predicate was true. You pass this in to the addSnapshots method of this previously instantiated
    TimeInStateCalculator class.
    
    Usage:
    
        {TimeInStateCalculator} = require('../')
    
        snapshots = [ 
          { id: 1, from: '2011-01-06T15:10:00.000Z', to: '2011-01-06T15:30:00.000Z', Name: 'Item A' }, # 20 minutes all within an hour
          { id: 2, from: '2011-01-06T15:50:00.000Z', to: '2011-01-06T16:10:00.000Z', Name: 'Item B' }, # 20 minutes spanning an hour
          { id: 3, from: '2011-01-07T13:00:00.000Z', to: '2011-01-07T15:20:00.000Z', Name: 'Item C' }, # start 2 hours before but overlap by 20 minutes of start
          { id: 4, from: '2011-01-06T16:40:00.000Z', to: '2011-01-06T19:00:00.000Z', Name: 'Item D' }, # 20 minutes before end of day
          { id: 5, from: '2011-01-06T16:50:00.000Z', to: '2011-01-07T15:10:00.000Z', Name: 'Item E' }, # 10 minutes before end of one day and 10 before the start of next
          { id: 6, from: '2011-01-06T16:55:00.000Z', to: '2011-01-07T15:05:00.000Z', Name: 'Item F' }, # multiple cycles over several days for a total of 20 minutes of work time
          { id: 6, from: '2011-01-07T16:55:00.000Z', to: '2011-01-10T15:05:00.000Z', Name: 'Item F modified' },
          { id: 7, from: '2011-01-06T16:40:00.000Z', to: '9999-01-01T00:00:00.000Z', Name: 'Item G' }  # continues past the range of consideration in this test
        ]
        
        granularity = 'minute'
        tz = 'America/Chicago'
    
        config =  # default work days and holidays
          granularity: granularity
          tz: tz
          endBefore: '2011-01-11T00:00:00.000'
          workDayStartOn: {hour: 9, minute: 0}  # 09:00 in Chicago is 15:00 in GMT
          workDayEndBefore: {hour: 11, minute: 0}  # 11:00 in Chicago is 17:00 in GMT  # !TODO: Change this to 5pm when I change the samples above
          validFromField: 'from'
          validToField: 'to'
          uniqueIDField: 'id'
          trackLastValueForTheseFields: ['to', 'Name']
    
        startOn = '2011-01-05T00:00:00.000Z'
        endBefore = '2011-01-11T00:00:00.000Z'
    
        tisc = new TimeInStateCalculator(config)
        tisc.addSnapshots(snapshots, startOn, endBefore)
    
        console.log(tisc.getResults())
        # [ { id: 1,
        #     ticks: 20,
        #     to_lastValue: '2011-01-06T15:30:00.000Z',
        #     Name_lastValue: 'Item A' },
        #   { id: 2,
        #     ticks: 20,
        #     to_lastValue: '2011-01-06T16:10:00.000Z',
        #     Name_lastValue: 'Item B' },
        #   { id: 3,
        #     ticks: 20,
        #     to_lastValue: '2011-01-07T15:20:00.000Z',
        #     Name_lastValue: 'Item C' },
        #   { id: 4,
        #     ticks: 20,
        #     to_lastValue: '2011-01-06T19:00:00.000Z',
        #     Name_lastValue: 'Item D' },
        #   { id: 5,
        #     ticks: 20,
        #     to_lastValue: '2011-01-07T15:10:00.000Z',
        #     Name_lastValue: 'Item E' },
        #   { id: 6,
        #     ticks: 20,
        #     to_lastValue: '2011-01-10T15:05:00.000Z',
        #     Name_lastValue: 'Item F modified' },
        #   { id: 7,
        #     ticks: 260,
        #     to_lastValue: '9999-01-01T00:00:00.000Z',
        #     Name_lastValue: 'Item G' } ]
    
    But we are not done yet. We can serialize the state of this calculator and later restore it.
    
        savedState = tisc.getStateForSaving({somekey: 'some value'})
    
    Let's incrementally update the original.
    
        snapshots = [
          { id: 7, from: '2011-01-06T16:40:00.000Z', to: '9999-01-01T00:00:00.000Z', Name: 'Item G modified' },  # same snapshot as before still going
          { id: 3, from: '2011-01-11T15:00:00.000Z', to: '2011-01-11T15:20:00.000Z', Name: 'Item C modified' },  # 20 more minutes for id 3
          { id: 8, from: '2011-01-11T15:00:00.000Z', to: '9999-01-01T00:00:00.000Z', Name: 'Item H' }   # 20 minutes in scope for new id 8
        ]
    
        startOn = '2011-01-11T00:00:00.000Z'  # must match endBefore of prior call
        endBefore = '2011-01-11T15:20:00.000Z'
    
        tisc.addSnapshots(snapshots, startOn, endBefore)
    
    Now, let's restore from saved state into tisc2 and give it the same updates and confirm that they match.
    
        tisc2 = TimeInStateCalculator.newFromSavedState(savedState)
        tisc2.addSnapshots(snapshots, startOn, endBefore)
    
        console.log(tisc2.meta.somekey)
        # some value
    
        console.log(JSON.stringify(tisc.getResults()) == JSON.stringify(tisc2.getResults()))
        # true
    
    Note, it's common to calculate time in state at granularity of hour and convert it to fractional days. Since it knocks
    out non-work hours, this conversion is not as simple as dividing by 24. This code calculates the conversion factor
    (workHours) for whatever workDayStartOn and workDayEndBefore you have specified even if your "workday" spans midnight.
    
        startOnInMinutes = config.workDayStartOn.hour * 60
        if config.workDayStartOn?.minute
          startOnInMinutes += config.workDayStartOn.minute
        endBeforeInMinutes = config.workDayEndBefore.hour * 60
        if config.workDayEndBefore?.minute
          endBeforeInMinutes += config.workDayEndBefore.minute
        if startOnInMinutes < endBeforeInMinutes
          workMinutes = endBeforeInMinutes - startOnInMinutes
        else
          workMinutes = 24 * 60 - startOnInMinutes
          workMinutes += endBeforeInMinutes
        workHours = workMinutes / 60
    
        console.log(workHours)  # Should say 2 because our work day was from 9am to 11am
        # 2
    
    You would simply divide the ticks by this `workHours` value to convert from ticks (in hours) to fractional days.
    */

    function TimeInStateCalculator(config) {
      /*
      @constructor
      @param {Object} config
      @cfg {String} tz The timezone for analysis
      @cfg {String} [validFromField = "_ValidFrom"]
      @cfg {String} [validToField = "_ValidTo"]
      @cfg {String} [uniqueIDField = "ObjectID"]
      @cfg {String} granularity This calculator will tell you how many ticks fall within the snapshots you feed in.
        This configuration value indicates the granularity of the ticks (i.e. Time.MINUTE, Time.HOUR, Time.DAY, etc.)
      @cfg {String[]/String} [workDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']] List of days of the week that you work on. You can specify this as an Array of Strings
        (['Monday', 'Tuesday', ...]) or a single comma seperated String ("Monday,Tuesday,...").
      @cfg {Object[]} [holidays] An optional Array containing rows that are either ISOStrings or JavaScript Objects
        (mix and match). Example: `[{month: 12, day: 25}, {year: 2011, month: 11, day: 24}, "2012-12-24"]`
         Notice how you can leave off the year if the holiday falls on the same day every year.
      @cfg {Object} [workDayStartOn] An optional object in the form {hour: 8, minute: 15}. If minute is zero it can be omitted.
        If workDayStartOn is later than workDayEndBefore, then it assumes that you work the night shift and your work
        hours span midnight. If tickGranularity is "hour" or finer, you probably want to set this; if tickGranularity is
        "day" or coarser, probably not.
      @cfg {Object} [workDayEndBefore] An optional object in the form {hour: 17, minute: 0}. If minute is zero it can be omitted.
        The use of workDayStartOn and workDayEndBefore only make sense when the granularity is "hour" or finer.
        Note: If the business closes at 5:00pm, you'll want to leave workDayEndBefore to 17:00, rather
        than 17:01. Think about it, you'll be open 4:59:59.999pm, but you'll be closed at 5:00pm. This also makes all of
        the math work. 9am to 5pm means 17 - 9 = an 8 hour work day.
      @cfg {String[]} [trackLastValueForTheseFields] If provided, the last value of these fields will appear in the results.
         This is useful if you want to filter the result by where the ended or if you want information to fill in the tooltip
         for a chart.
      */

      var cubeConfig, dimensions, fieldName, metricObject, metrics, _i, _len, _ref1;
      this.config = utils.clone(config);
      if (this.config.validFromField == null) {
        this.config.validFromField = "_ValidFrom";
      }
      if (this.config.validToField == null) {
        this.config.validToField = "_ValidTo";
      }
      if (this.config.uniqueIDField == null) {
        this.config.uniqueIDField = "ObjectID";
      }
      utils.assert(this.config.tz != null, "Must provide a timezone to this calculator.");
      utils.assert(this.config.granularity != null, "Must provide a granularity to this calculator.");
      dimensions = [
        {
          field: this.config.uniqueIDField
        }
      ];
      metrics = [
        {
          field: 'ticks',
          as: 'ticks',
          f: 'sum'
        }
      ];
      if (this.config.trackLastValueForTheseFields != null) {
        _ref1 = this.config.trackLastValueForTheseFields;
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          fieldName = _ref1[_i];
          metricObject = {
            f: 'lastValue',
            field: fieldName
          };
          metrics.push(metricObject);
        }
      }
      cubeConfig = {
        dimensions: dimensions,
        metrics: metrics
      };
      this.cube = new OLAPCube(cubeConfig);
      this.upToDateISOString = null;
    }

    TimeInStateCalculator.prototype.addSnapshots = function(snapshots, startOn, endBefore) {
      /*
      @method addSnapshots
        Allows you to incrementally add snapshots to this calculator.
      @chainable
      @param {Object[]} snapshots An array of temporal data model snapshots.
      @param {String} startOn A ISOString (e.g. '2012-01-01T12:34:56.789Z') indicating the time start of the period of
        interest. On the second through nth call, this should equal the previous endBefore.
      @param {String} endBefore A ISOString (e.g. '2012-01-01T12:34:56.789Z') indicating the moment just past the time
        period of interest.
      @return {TimeInStateCalculator}
      */

      var s, ticks, timeline, timelineConfig, _i, _len;
      if (this.upToDateISOString != null) {
        utils.assert(this.upToDateISOString === startOn, "startOn (" + startOn + ") parameter should equal endBefore of previous call (" + this.upToDateISOString + ") to addSnapshots.");
      }
      this.upToDateISOString = endBefore;
      timelineConfig = utils.clone(this.config);
      timelineConfig.startOn = new Time(startOn, Time.MILLISECOND, this.config.tz);
      timelineConfig.endBefore = new Time(endBefore, Time.MILLISECOND, this.config.tz);
      timeline = new Timeline(timelineConfig);
      for (_i = 0, _len = snapshots.length; _i < _len; _i++) {
        s = snapshots[_i];
        ticks = timeline.ticksThatIntersect(s[this.config.validFromField], s[this.config.validToField], this.config.tz);
        s.ticks = ticks.length;
      }
      this.cube.addFacts(snapshots);
      return this;
    };

    TimeInStateCalculator.prototype.getResults = function() {
      /*
      @method getResults
        Returns the current state of the calculator
      @return {Object[]} Returns an Array of Maps like `{<uniqueIDField>: <id>, ticks: <ticks>, lastValidTo: <lastValidTo>}`
      */

      var cell, fieldName, filter, id, out, outRow, uniqueIDs, _i, _j, _len, _len1, _ref1;
      out = [];
      uniqueIDs = this.cube.getDimensionValues(this.config.uniqueIDField);
      for (_i = 0, _len = uniqueIDs.length; _i < _len; _i++) {
        id = uniqueIDs[_i];
        filter = {};
        filter[this.config.uniqueIDField] = id;
        cell = this.cube.getCell(filter);
        outRow = {};
        outRow[this.config.uniqueIDField] = id;
        outRow.ticks = cell.ticks;
        if (this.config.trackLastValueForTheseFields != null) {
          _ref1 = this.config.trackLastValueForTheseFields;
          for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
            fieldName = _ref1[_j];
            outRow[fieldName + '_lastValue'] = cell[fieldName + '_lastValue'];
          }
        }
        out.push(outRow);
      }
      return out;
    };

    TimeInStateCalculator.prototype.getStateForSaving = function(meta) {
      /*
      @method getStateForSaving
        Enables saving the state of this calculator. See class documentation for a detailed example.
      @param {Object} [meta] An optional parameter that will be added to the serialized output and added to the meta field
        within the deserialized calculator.
      @return {Object} Returns an Ojbect representing the state of the calculator. This Object is suitable for saving to
        to an object store. Use the static method `newFromSavedState()` with this Object as the parameter to reconstitute
        the calculator.
      */

      var out;
      out = {
        config: this.config,
        cubeSavedState: this.cube.getStateForSaving(),
        upToDateISOString: this.upToDateISOString
      };
      if (meta != null) {
        out.meta = meta;
      }
      return out;
    };

    TimeInStateCalculator.newFromSavedState = function(p) {
      /*
      @method newFromSavedState
        Deserializes a previously saved calculator and returns a new calculator. See class documentation for a detailed example.
      @static
      @param {String/Object} p A String or Object from a previously saved state
      @return {TimeInStateCalculator}
      */

      var calculator;
      if (utils.type(p) === 'string') {
        p = JSON.parse(p);
      }
      calculator = new TimeInStateCalculator(p.config);
      calculator.cube = OLAPCube.newFromSavedState(p.cubeSavedState);
      calculator.upToDateISOString = p.upToDateISOString;
      if (p.meta != null) {
        calculator.meta = p.meta;
      }
      return calculator;
    };

    return TimeInStateCalculator;

  })();

  exports.TimeInStateCalculator = TimeInStateCalculator;

}).call(this);

});

require.define("/src/OLAPCube.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var JSON, OLAPCube, arrayOfMaps_To_CSVStyleArray, csvStyleArray_To_ArrayOfMaps, functions, utils, _ref;

  utils = require('tztime').utils;

  functions = require('./functions').functions;

  _ref = require('./dataTransform'), arrayOfMaps_To_CSVStyleArray = _ref.arrayOfMaps_To_CSVStyleArray, csvStyleArray_To_ArrayOfMaps = _ref.csvStyleArray_To_ArrayOfMaps;

  JSON = require('JSON2');

  OLAPCube = (function() {
    /*
    @class OLAPCube
    
    __An efficient, in-memory, incrementally-updateable, hierarchy-capable OLAP Cube implementation.__
    
    [OLAP Cubes](http://en.wikipedia.org/wiki/OLAP_cube) are a powerful abstraction that makes it easier to do everything
    from simple group-by operations to more complex multi-dimensional and hierarchical analysis. This implementation has
    the same conceptual ancestry as implementations found in business intelligence and OLAP database solutions. However,
    it is meant as a light weight alternative primarily targeting the goal of making it easier for developers to implement
    desired analysis. It also supports serialization and incremental updating so it's ideally
    suited for visualizations and analysis that are updated on a periodic or even continuous basis.
    
    ## Features ##
    
    * In-memory
    * Incrementally-updateable
    * Serialize (`getStateForSaving()`) and deserialize (`newFromSavedState()`) to preserve aggregations between sessions
    * Accepts simple JavaScript Objects as facts
    * Storage and output as simple JavaScript Arrays of Objects
    * Hierarchy (trees) derived from fact data assuming [materialized path](http://en.wikipedia.org/wiki/Materialized_path)
      array model commonly used with NoSQL databases
    
    ## 2D Example ##
    
    Let's walk through a simple 2D example from facts to output. Let's say you have this set of facts:
    
        facts = [
          {ProjectHierarchy: [1, 2, 3], Priority: 1, Points: 10},
          {ProjectHierarchy: [1, 2, 4], Priority: 2, Points: 5 },
          {ProjectHierarchy: [5]      , Priority: 1, Points: 17},
          {ProjectHierarchy: [1, 2]   , Priority: 1, Points: 3 },
        ]
    
    The ProjectHierarchy field models its hierarchy (tree) as an array containing a
    [materialized path](http://en.wikipedia.org/wiki/Materialized_path). The first fact is "in" Project 3 whose parent is
    Project 2, whose parent is Project 1. The second fact is "in" Project 4 whose parent is Project 2 which still has
    Project 1 as its parent. Project 5 is another root Project like Project 1; and the fourth fact is "in" Project 2.
    So the first fact will roll-up the tree and be aggregated against [1], and [1, 2] as well as [1, 2, 3]. Root Project 1
    will get the data from all but the third fact which will get aggregated against root Project 5.
    
    We specify the ProjectHierarchy field as a dimension of type 'hierarchy' and the Priorty field as a simple value dimension.
    
        dimensions = [
          {field: "ProjectHierarchy", type: 'hierarchy'},
          {field: "Priority"}
        ]
    
    This will create a 2D "cube" where each unique value for ProjectHierarchy and Priority defines a different cell.
    Note, this happens to be a 2D "cube" (more commonly referred to as a [pivot table](http://en.wikipedia.org/wiki/Pivot_Table)),
    but you can also have a 1D cube (a simple group-by), a 3D cube, or even an n-dimensional hypercube where n is greater than 3.
    
    You can specify any number of metrics to be calculated for each cell in the cube.
    
        metrics = [
          {field: "Points", f: "sum", as: "Scope"}
        ]
    
    You can use any of the aggregation functions found in Lumenize.functions except `count`. The count metric is
    automatically tracked for each cell. The `as` specification is optional unless you provide a custom function. If missing,
    it will build the name of the resulting metric from the field name and the function. So without the `as: "Scope"` the
    second metric in the example above would have been named "Points_sum".
    
    You can also use custom functions in the form of `f(values) -> return <some function of values>`.
    
    Next, we build the config parameter from our dimension and metrics specifications.
    
        config = {dimensions, metrics}
    
    Hierarchy dimensions automatically roll up but you can also tell it to keep all totals by setting config.keepTotals to
    true. The totals are then kept in the cells where one or more of the dimension values are set to `null`. Note, you
    can also set keepTotals for individual dimension and should probably use that if you have more than a few dimensions
    but we're going to set it globally here:
    
        config.keepTotals = true
    
    Now, let's create the cube.
    
        {OLAPCube} = require('../')
        cube = new OLAPCube(config, facts)
    
    `getCell()` allows you to extract a single cell. The "total" cell for all facts where Priority = 1 can be found as follows:
    
        console.log(cube.getCell({Priority: 1}))
        # { ProjectHierarchy: null, Priority: 1, _count: 3, Scope: 30 }
    
    Notice how the ProjectHierarchy field value is `null`. This is because it is a total cell for Priority dimension
    for all ProjectHierarchy values. Think of `null` values in this context as wildcards.
    
    Similarly, we can get the total for all descendants of ProjectHierarchy = [1] regarless of Priority as follows:
    
        console.log(cube.getCell({ProjectHierarchy: [1]}))
        # { ProjectHierarchy: [ 1 ], Priority: null, _count: 3, Scope: 18 }
    
    `getCell()` uses the cellIndex so it's very efficient. Using `getCell()` and `getDimensionValues()`, you can iterate
    over a slice of the OLAPCube. It is usually preferable to access the cells in place like this rather than the
    traditional OLAP approach of extracting a slice for processing.
    
        rowValues = cube.getDimensionValues('ProjectHierarchy')
        columnValues = cube.getDimensionValues('Priority')
        s = OLAPCube._padToWidth('', 7) + ' | '
        s += ((OLAPCube._padToWidth(JSON.stringify(c), 7) for c in columnValues).join(' | '))
        s += ' | '
        console.log(s)
        for r in rowValues
          s = OLAPCube._padToWidth(JSON.stringify(r), 7) + ' | '
          for c in columnValues
            cell = cube.getCell({ProjectHierarchy: r, Priority: c})
            if cell?
              cellString = JSON.stringify(cell._count)
            else
              cellString = ''
            s += OLAPCube._padToWidth(cellString, 7) + ' | '
          console.log(s)
        #         |    null |       1 |       2 |
        #    null |       4 |       3 |       1 |
        #     [1] |       3 |       2 |       1 |
        #   [1,2] |       3 |       2 |       1 |
        # [1,2,3] |       1 |       1 |         |
        # [1,2,4] |       1 |         |       1 |
        #     [5] |       1 |       1 |         |
    
    Or you can just call `toString()` method which extracts a 2D slice for tabular display. Both approachs will work on
    cubes of any number of dimensions two or greater. The manual example above extracted the `count` metric. We'll tell
    the example below to extract the `Scope` metric.
    
        console.log(cube.toString('ProjectHierarchy', 'Priority', 'Scope'))
        # |        || Total |     1     2|
        # |==============================|
        # |Total   ||    35 |    30     5|
        # |------------------------------|
        # |[1]     ||    18 |    13     5|
        # |[1,2]   ||    18 |    13     5|
        # |[1,2,3] ||    10 |    10      |
        # |[1,2,4] ||     5 |           5|
        # |[5]     ||    17 |    17      |
    
    ## Dimension types ##
    
    The following dimension types are supported:
    
    1. Single value
       * Number
       * String
       * Does not work:
         * Boolean - known to fail
         * Object - may sorta work but sort-order at least is not obvious
         * Date - not tested but may actually work
    2. Arrays as materialized path for hierarchical (tree) data
    3. Non-hierarchical Arrays ("tags")
    
    There is no need to tell the OLAPCube what type to use with the exception of #2. In that case, add `type: 'hierarchy'`
    to the dimensions row like this:
    
        dimensions = [
          {field: 'hierarchicalDimensionField', type: 'hierarchy'} #, ...
        ]
    
    ## Hierarchical (tree) data ##
    
    This OLAP Cube implementation assumes your hierarchies (trees) are modeled as a
    [materialized path](http://en.wikipedia.org/wiki/Materialized_path) array. This approach is commonly used with NoSQL databases like
    [CouchDB](http://probablyprogramming.com/2008/07/04/storing-hierarchical-data-in-couchdb) and
    [MongoDB (combining materialized path and array of ancestors)](http://docs.mongodb.org/manual/tutorial/model-tree-structures/)
    and even SQL databases supporting array types like [Postgres](http://justcramer.com/2012/04/08/using-arrays-as-materialized-paths-in-postgres/).
    
    This approach differs from the traditional OLAP/MDX fixed/named level hierarchy approach. In that approach, you assume
    that the number of levels in the hierarchy are fixed. Also, each level in the hierarchy is either represented by a different
    column (clothing example --> level 0: SEX column - mens vs womens; level 1: TYPE column - pants vs shorts vs shirts; etc.) or
    predetermined ranges of values in a single field (date example --> level 0: year; level 1: quarter; level 2: month; etc.)
    
    However, the approach used by this OLAPCube implementaion is the more general case, because it can easily simulate
    fixed/named level hierachies whereas the reverse is not true. In the clothing example above, you would simply key
    your dimension off of a derived field that was a combination of the SEX and TYPE columns (e.g. ['mens', 'pants'])
    
    ## Date/Time hierarchies ##
    
    Lumenize is designed to work well with the tzTime library. Here is an example of taking a bunch of ISOString data
    and doing timezone precise hierarchical roll up based upon the date segments (year, month).
    
        data = [
          {date: '2011-12-31T12:34:56.789Z', value: 10},
          {date: '2012-01-05T12:34:56.789Z', value: 20},
          {date: '2012-01-15T12:34:56.789Z', value: 30},
          {date: '2012-02-01T00:00:01.000Z', value: 40},
          {date: '2012-02-15T12:34:56.789Z', value: 50},
        ]
    
        {Time} = require('../')
    
        config =
          deriveFieldsOnInput: [{
            field: 'dateSegments',
            f: (row) ->
              return new Time(row.date, Time.MONTH, 'America/New_York').getSegmentsAsArray()
          }]
          metrics: [{field: 'value', f: 'sum'}]
          dimensions: [{field: 'dateSegments', type: 'hierarchy'}]
    
        cube = new OLAPCube(config, data)
        console.log(cube.toString(undefined, undefined, 'value_sum'))
        # | dateSegments | value_sum |
        # |==========================|
        # | [2011]       |        10 |
        # | [2011,12]    |        10 |
        # | [2012]       |       140 |
        # | [2012,1]     |        90 |
        # | [2012,2]     |        50 |
    
    Notice how '2012-02-01T00:00:01.000Z' got bucketed in January because the calculation was done in timezone
    'America/New_York'.
    
    ## Non-hierarchical Array fields ##
    
    If you don't specify type: 'hierarchy' and the OLAPCube sees a field whose value is an Array in a dimension field, the
    data in that fact would get aggregated against each element in the Array. So a non-hierarchical Array field like
    ['x', 'y', 'z'] would get aggregated against 'x', 'y', and 'z' rather than ['x'], ['x', 'y'], and ['x','y','z]. This
    functionality is useful for  accomplishing analytics on tags, but it can be used in other powerful ways. For instance
    let's say you have a list of events:
    
        events = [
          {name: 'Renaissance Festival', activeMonths: ['September', 'October']},
          {name: 'Concert Series', activeMonths: ['July', 'August', 'September']},
          {name: 'Fall Festival', activeMonths: ['September']}
        ]
    
    You could figure out the number of events active in each month by specifying "activeMonths" as a dimension.
    Lumenize.TimeInStateCalculator (and other calculators in Lumenize) use this technique.
    */

    function OLAPCube(userConfig, facts) {
      var d, _i, _j, _len, _len1, _ref1, _ref2;
      this.userConfig = userConfig;
      /*
      @constructor
      @param {Object} config See Config options for details. DO NOT change the config settings after the OLAP class is instantiated.
      @param {Object[]} [facts] Optional parameter allowing the population of the OLAPCube with an intitial set of facts
        upon instantiation. Use addFacts() to add facts after instantiation.
      @cfg {Object[]} dimensions Array which specifies the fields to use as dimension fields. If the field contains a
        hierarchy array, say so in the row, (e.g. `{field: 'SomeFieldName', type: 'hierarchy'}`). Any array values that it
        finds in the supplied facts will be assumed to be tags rather than a hierarchy specification unless `type: 'hierarchy'`
        is specified.
      
        For example, let's say you have a set of facts that look like this:
      
          fact = {
            dimensionField: 'a',
            hierarchicalDimensionField: ['1','2','3'],
            tagDimensionField: ['x', 'y', 'z'],
            valueField: 10
          }
      
        Then a set of dimensions like this makes sense.
      
          config.dimensions = [
            {field: 'dimensionField'},
            {field: 'hierarchicalDimensionField', type: 'hierarchy'},
            {field: 'tagDimensionField', keepTotals: true}
          ]
      
        Notice how a keepTotals can be set for an individual dimension. This is preferable to setting it for the entire
        cube in cases where you don't want totals in all dimensions.
      
      @cfg {Object[]} [metrics=[]] Array which specifies the metrics to calculate for each cell in the cube.
      
        Example:
      
          config = {}
          config.metrics = [
            {field: 'field3'},                                      # defaults to metrics: ['sum']
            {field: 'field4', metrics: [
              {f: 'sum'},                                           # will add a metric named field4_sum
              {as: 'median4', f: 'p50'},                            # renamed p50 to median4 from default of field4_p50
              {as: 'myCount', f: (values) -> return values.length}  # user-supplied function
            ]}
          ]
      
        If you specify a field without any metrics, it will assume you want the sum but it will not automatically
        add the sum metric to fields with a metrics specification. User-supplied aggregation functions are also supported as
        shown in the 'myCount' metric above.
      
        Note, if the metric has dependencies (e.g. average depends upon count and sum) it will automatically add those to
        your metric definition. If you've already added a dependency but put it under a different "as", it's not smart
        enough to sense that and it will add it again. Either live with the slight inefficiency and duplication or leave
        dependency metrics named their default by not providing an "as" field.
      
      @cfg {Boolean} [keepTotals=false] Setting this will add an additional total row (indicated with field: null) along
        all dimensions. This setting can have an impact on the memory usage and performance of the OLAPCube so
        if things are tight, only use it if you really need it. If you don't need it for all dimension, you can specify
        keepTotals for individual dimensions.
      @cfg {Boolean} [keepFacts=false] Setting this will cause the OLAPCube to keep track of the facts that contributed to
        the metrics for each cell by adding an automatic 'facts' metric. Note, facts are restored after deserialization
        as you would expect, but they are no longer tied to the original facts. This feature, especially after a restore
        can eat up memory.
      @cfg {Object[]} [deriveFieldsOnInput] An Array of Maps in the form `{field:'myField', f:(fact)->...}`
      @cfg {Object[]} [deriveFieldsOnOutput] same format as deriveFieldsOnInput, except the callback is in the form `f(row)`
        This is only called for dirty rows that were effected by the latest round of addFacts. It's more efficient to calculate things
        like standard deviation and percentile coverage here than in config.metrics. You just have to remember to include the dependencies
        in config.metrics. Standard deviation depends upon `sum` and `sumSquares`. Percentile coverage depends upon `values`.
        In fact, if you are going to capture values anyway, all of the functions are most efficiently calculated here.
        Maybe some day, I'll write the code to analyze your metrics and move them out to here if it improves efficiency.
      */

      this.config = utils.clone(this.userConfig);
      utils.assert(this.config.dimensions != null, 'Must provide config.dimensions.');
      if (this.config.metrics == null) {
        this.config.metrics = [];
      }
      this.cells = [];
      this.cellIndex = {};
      this.currentValues = {};
      this._dimensionValues = {};
      _ref1 = this.config.dimensions;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        d = _ref1[_i];
        this._dimensionValues[d.field] = {};
      }
      if (!this.config.keepTotals) {
        this.config.keepTotals = false;
      }
      if (!this.config.keepFacts) {
        this.config.keepFacts = false;
      }
      _ref2 = this.config.dimensions;
      for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
        d = _ref2[_j];
        if (this.config.keepTotals || d.keepTotals) {
          d.keepTotals = true;
        } else {
          d.keepTotals = false;
        }
      }
      functions.expandMetrics(this.config.metrics, true, true);
      this.summaryMetrics = {};
      this.addFacts(facts);
    }

    OLAPCube._possibilities = function(key, type, keepTotals) {
      var a, len;
      switch (utils.type(key)) {
        case 'array':
          if (keepTotals) {
            a = [null];
          } else {
            a = [];
          }
          if (type === 'hierarchy') {
            len = key.length;
            while (len > 0) {
              a.push(key.slice(0, len));
              len--;
            }
          } else {
            if (keepTotals) {
              a = [null].concat(key);
            } else {
              a = key;
            }
          }
          return a;
        case 'string':
        case 'number':
          if (keepTotals) {
            return [null, key];
          } else {
            return [key];
          }
      }
    };

    OLAPCube._decrement = function(a, rollover) {
      var i;
      i = a.length - 1;
      a[i]--;
      while (a[i] < 0) {
        a[i] = rollover[i];
        i--;
        if (i < 0) {
          return false;
        } else {
          a[i]--;
        }
      }
      return true;
    };

    OLAPCube.prototype._expandFact = function(fact) {
      var countdownArray, d, index, m, more, out, outRow, p, possibilitiesArray, rolloverArray, _i, _j, _k, _l, _len, _len1, _len2, _len3, _ref1, _ref2, _ref3, _ref4;
      possibilitiesArray = [];
      countdownArray = [];
      rolloverArray = [];
      _ref1 = this.config.dimensions;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        d = _ref1[_i];
        p = OLAPCube._possibilities(fact[d.field], d.type, d.keepTotals);
        possibilitiesArray.push(p);
        countdownArray.push(p.length - 1);
        rolloverArray.push(p.length - 1);
      }
      _ref2 = this.config.metrics;
      for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
        m = _ref2[_j];
        this.currentValues[m.field] = [fact[m.field]];
      }
      out = [];
      more = true;
      while (more) {
        outRow = {};
        _ref3 = this.config.dimensions;
        for (index = _k = 0, _len2 = _ref3.length; _k < _len2; index = ++_k) {
          d = _ref3[index];
          outRow[d.field] = possibilitiesArray[index][countdownArray[index]];
        }
        outRow._count = 1;
        if (this.config.keepFacts) {
          outRow._facts = [fact];
        }
        _ref4 = this.config.metrics;
        for (_l = 0, _len3 = _ref4.length; _l < _len3; _l++) {
          m = _ref4[_l];
          outRow[m.as] = m.f([fact[m.field]], void 0, void 0, outRow, m.field + '_');
        }
        out.push(outRow);
        more = OLAPCube._decrement(countdownArray, rolloverArray);
      }
      return out;
    };

    OLAPCube._extractFilter = function(row, dimensions) {
      var d, out, _i, _len;
      out = {};
      for (_i = 0, _len = dimensions.length; _i < _len; _i++) {
        d = dimensions[_i];
        out[d.field] = row[d.field];
      }
      return out;
    };

    OLAPCube.prototype._mergeExpandedFactArray = function(expandedFactArray) {
      var d, er, fieldValue, filterString, m, olapRow, _i, _j, _k, _len, _len1, _len2, _ref1, _ref2, _results;
      _results = [];
      for (_i = 0, _len = expandedFactArray.length; _i < _len; _i++) {
        er = expandedFactArray[_i];
        _ref1 = this.config.dimensions;
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          d = _ref1[_j];
          fieldValue = er[d.field];
          this._dimensionValues[d.field][JSON.stringify(fieldValue)] = fieldValue;
        }
        filterString = JSON.stringify(OLAPCube._extractFilter(er, this.config.dimensions));
        olapRow = this.cellIndex[filterString];
        if (olapRow != null) {
          _ref2 = this.config.metrics;
          for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
            m = _ref2[_k];
            olapRow[m.as] = m.f(olapRow[m.field + '_values'], olapRow[m.as], this.currentValues[m.field], olapRow, m.field + '_');
          }
        } else {
          olapRow = er;
          this.cellIndex[filterString] = olapRow;
          this.cells.push(olapRow);
        }
        _results.push(this.dirtyRows[filterString] = olapRow);
      }
      return _results;
    };

    OLAPCube.prototype.addFacts = function(facts) {
      /*
      @method addFacts
        Adds facts to the OLAPCube.
      
      @chainable
      @param {Object[]} facts An Array of facts to be aggregated into OLAPCube. Each fact is a Map where the keys are the field names
        and the values are the field values (e.g. `{field1: 'a', field2: 5}`).
      */

      var d, dirtyRow, expandedFactArray, fact, fieldName, filterString, _i, _j, _k, _l, _len, _len1, _len2, _len3, _ref1, _ref2, _ref3;
      this.dirtyRows = {};
      if (utils.type(facts) === 'array') {
        if (facts.length <= 0) {
          return;
        }
      } else {
        if (facts != null) {
          facts = [facts];
        } else {
          return;
        }
      }
      if (this.config.deriveFieldsOnInput) {
        for (_i = 0, _len = facts.length; _i < _len; _i++) {
          fact = facts[_i];
          _ref1 = this.config.deriveFieldsOnInput;
          for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
            d = _ref1[_j];
            if (d.as != null) {
              fieldName = d.as;
            } else {
              fieldName = d.field;
            }
            fact[fieldName] = d.f(fact);
          }
        }
      }
      for (_k = 0, _len2 = facts.length; _k < _len2; _k++) {
        fact = facts[_k];
        this.currentValues = {};
        expandedFactArray = this._expandFact(fact);
        this._mergeExpandedFactArray(expandedFactArray);
      }
      if (this.config.deriveFieldsOnOutput != null) {
        _ref2 = this.dirtyRows;
        for (filterString in _ref2) {
          dirtyRow = _ref2[filterString];
          _ref3 = this.config.deriveFieldsOnOutput;
          for (_l = 0, _len3 = _ref3.length; _l < _len3; _l++) {
            d = _ref3[_l];
            if (d.as != null) {
              fieldName = d.as;
            } else {
              fieldName = d.field;
            }
            dirtyRow[fieldName] = d.f(dirtyRow);
          }
        }
      }
      this.dirtyRows = {};
      return this;
    };

    OLAPCube.prototype.getCells = function(filterObject) {
      /*
      @method getCells
        Returns a subset of the cells that match the supplied filter. You can perform slice and dice operations using
        this. If you have criteria for all of the dimensions, you are better off using `getCell()`. Most times, it's
        better to iterate over the unique values for the dimensions of interest using `getCell()` in place of slice or
        dice operations.
      @param {Object} [filterObject] Specifies the constraints that the returned cells must match in the form of
        `{field1: value1, field2: value2}`. If this parameter is missing, the internal cells array is returned.
      @return {Object[]} Returns the cells that match the supplied filter
      */

      var c, output, _i, _len, _ref1;
      if (filterObject == null) {
        return this.cells;
      }
      output = [];
      _ref1 = this.cells;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        c = _ref1[_i];
        if (utils.filterMatch(filterObject, c)) {
          output.push(c);
        }
      }
      return output;
    };

    OLAPCube.prototype.getCell = function(filter, defaultValue) {
      /*
      @method getCell
        Returns the single cell matching the supplied filter. Iterating over the unique values for the dimensions of
        interest, you can incrementally retrieve a slice or dice using this method. Since `getCell()` always uses an index,
        in most cases, this is better than using `getCells()` to prefetch a slice or dice.
      @param {Object} [filter={}] Specifies the constraints for the returned cell in the form of `{field1: value1, field2: value2}.
        Any fields that are specified in config.dimensions that are missing from the filter are automatically filled in
        with null. Calling `getCell()` with no parameter or `{}` will return the total of all dimensions (if @config.keepTotals=true).
      @return {Object[]} Returns the cell that match the supplied filter
      */

      var cell, d, foundIt, key, normalizedFilter, value, _i, _j, _len, _len1, _ref1, _ref2;
      if (filter == null) {
        filter = {};
      }
      for (key in filter) {
        value = filter[key];
        foundIt = false;
        _ref1 = this.config.dimensions;
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          d = _ref1[_i];
          if (d.field === key) {
            foundIt = true;
          }
        }
        if (!foundIt) {
          throw new Error("" + key + " is not a dimension for this cube.");
        }
      }
      normalizedFilter = {};
      _ref2 = this.config.dimensions;
      for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
        d = _ref2[_j];
        if (filter.hasOwnProperty(d.field)) {
          normalizedFilter[d.field] = filter[d.field];
        } else {
          if (d.keepTotals) {
            normalizedFilter[d.field] = null;
          } else {
            throw new Error('Must set keepTotals to use getCell with a partial filter.');
          }
        }
      }
      cell = this.cellIndex[JSON.stringify(normalizedFilter)];
      if (cell != null) {
        return cell;
      } else {
        return defaultValue;
      }
    };

    OLAPCube.prototype.getDimensionValues = function(field, descending) {
      var values;
      if (descending == null) {
        descending = false;
      }
      /*
      @method getDimensionValues
        Returns the unique values for the specified dimension in sort order.
      @param {String} field The field whose values you want
      @param {Boolean} [descending=false] Set to true if you want them in reverse order
      */

      values = utils.values(this._dimensionValues[field]);
      values.sort(OLAPCube._compare);
      if (!descending) {
        values.reverse();
      }
      return values;
    };

    OLAPCube._compare = function(a, b) {
      var aString, bString, index, value, _i, _len;
      if (a === null) {
        return 1;
      }
      if (b === null) {
        return -1;
      }
      switch (utils.type(a)) {
        case 'number':
        case 'boolean':
        case 'date':
          return b - a;
        case 'array':
          for (index = _i = 0, _len = a.length; _i < _len; index = ++_i) {
            value = a[index];
            if (b.length - 1 >= index && value < b[index]) {
              return 1;
            }
            if (b.length - 1 >= index && value > b[index]) {
              return -1;
            }
          }
          if (a.length < b.length) {
            return 1;
          } else if (a.length > b.length) {
            return -1;
          } else {
            return 0;
          }
          break;
        case 'object':
        case 'string':
          aString = JSON.stringify(a);
          bString = JSON.stringify(b);
          if (aString < bString) {
            return 1;
          } else if (aString > bString) {
            return -1;
          } else {
            return 0;
          }
          break;
        default:
          throw new Error("Do not know how to sort objects of type " + (utils.type(a)) + ".");
      }
    };

    OLAPCube.roundToSignificance = function(value, significance) {
      var multiple;
      if (significance == null) {
        return value;
      }
      multiple = 1 / significance;
      return Math.round(value * multiple) / multiple;
    };

    OLAPCube.prototype.toString = function(rows, columns, metric, significance) {
      /*
      @method toString
        Produces a printable table with the first dimension as the rows, the second dimension as the columns, and the count
        as the values in the table.
      @return {String} A string which will render as a table when written to the console.
      @param {String} [rows=<first dimension>]
      @param {String} [columns=<second dimension>]
      @param {String} [metric='count']
      @param {Number} [significance] The multiple to which you want to round the bucket edges. 1 means whole numbers.
       0.1 means to round to tenths. 0.01 to hundreds. Etc.
      */

      if (metric == null) {
        metric = '_count';
      }
      if (this.config.dimensions.length === 1) {
        return this.toStringOneDimension(this.config.dimensions[0].field, metric, significance);
      } else {
        return this.toStringTwoDimensions(rows, columns, metric, significance);
      }
    };

    OLAPCube.prototype.toStringOneDimension = function(field, metric, significance) {
      var cell, cellString, filter, fullWidth, indexRow, maxColumnWidth, r, rowLabelWidth, rowValueStrings, rowValues, s, valueStrings, _i, _j, _len, _len1;
      rowValues = this.getDimensionValues(field);
      rowValueStrings = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = rowValues.length; _i < _len; _i++) {
          r = rowValues[_i];
          _results.push(JSON.stringify(r));
        }
        return _results;
      })();
      rowLabelWidth = Math.max.apply({}, (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = rowValueStrings.length; _i < _len; _i++) {
          s = rowValueStrings[_i];
          _results.push(s.length);
        }
        return _results;
      })());
      rowLabelWidth = Math.max(rowLabelWidth, 'Total'.length, field.length);
      maxColumnWidth = metric.length;
      valueStrings = [];
      for (indexRow = _i = 0, _len = rowValues.length; _i < _len; indexRow = ++_i) {
        r = rowValues[indexRow];
        filter = {};
        filter[field] = r;
        cell = this.getCell(filter);
        if (cell != null) {
          cellString = JSON.stringify(OLAPCube.roundToSignificance(cell[metric], significance));
        } else {
          cellString = '';
        }
        maxColumnWidth = Math.max(maxColumnWidth, cellString.length);
        valueStrings.push(cellString);
      }
      maxColumnWidth += 1;
      fullWidth = rowLabelWidth + maxColumnWidth + 4;
      s = '| ' + (OLAPCube._padToWidth(field, rowLabelWidth, ' ', true)) + ' |';
      s += OLAPCube._padToWidth(metric, maxColumnWidth) + ' |';
      s += '\n|' + OLAPCube._padToWidth('', fullWidth, '=') + '|';
      for (indexRow = _j = 0, _len1 = rowValueStrings.length; _j < _len1; indexRow = ++_j) {
        r = rowValueStrings[indexRow];
        s += '\n| ';
        if (r === 'null') {
          s += OLAPCube._padToWidth('Total', rowLabelWidth, ' ', true);
        } else {
          s += OLAPCube._padToWidth(r, rowLabelWidth, ' ', true);
        }
        s += ' |' + OLAPCube._padToWidth(valueStrings[indexRow], maxColumnWidth) + ' |';
        if (r === 'null') {
          s += '\n|' + OLAPCube._padToWidth('', fullWidth, '-') + '|';
        }
      }
      return s;
    };

    OLAPCube.prototype.toStringTwoDimensions = function(rows, columns, metric, significance) {
      var c, cell, cellString, columnValueStrings, columnValues, filter, fullWidth, indexColumn, indexRow, maxColumnWidth, r, rowLabelWidth, rowValueStrings, rowValues, s, valueStrings, valueStringsRow, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _m;
      if (rows == null) {
        rows = this.config.dimensions[0].field;
      }
      if (columns == null) {
        columns = this.config.dimensions[1].field;
      }
      rowValues = this.getDimensionValues(rows);
      columnValues = this.getDimensionValues(columns);
      rowValueStrings = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = rowValues.length; _i < _len; _i++) {
          r = rowValues[_i];
          _results.push(JSON.stringify(r));
        }
        return _results;
      })();
      columnValueStrings = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = columnValues.length; _i < _len; _i++) {
          c = columnValues[_i];
          _results.push(JSON.stringify(c));
        }
        return _results;
      })();
      rowLabelWidth = Math.max.apply({}, (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = rowValueStrings.length; _i < _len; _i++) {
          s = rowValueStrings[_i];
          _results.push(s.length);
        }
        return _results;
      })());
      rowLabelWidth = Math.max(rowLabelWidth, 'Total'.length);
      valueStrings = [];
      maxColumnWidth = Math.max.apply({}, (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = columnValueStrings.length; _i < _len; _i++) {
          s = columnValueStrings[_i];
          _results.push(s.length);
        }
        return _results;
      })());
      maxColumnWidth = Math.max(maxColumnWidth, 'Total'.length);
      for (indexRow = _i = 0, _len = rowValues.length; _i < _len; indexRow = ++_i) {
        r = rowValues[indexRow];
        valueStringsRow = [];
        for (indexColumn = _j = 0, _len1 = columnValues.length; _j < _len1; indexColumn = ++_j) {
          c = columnValues[indexColumn];
          filter = {};
          filter[rows] = r;
          filter[columns] = c;
          cell = this.getCell(filter);
          if (cell != null) {
            cellString = JSON.stringify(OLAPCube.roundToSignificance(cell[metric], significance));
          } else {
            cellString = '';
          }
          maxColumnWidth = Math.max(maxColumnWidth, cellString.length);
          valueStringsRow.push(cellString);
        }
        valueStrings.push(valueStringsRow);
      }
      maxColumnWidth += 1;
      s = '|' + (OLAPCube._padToWidth('', rowLabelWidth)) + ' ||';
      for (indexColumn = _k = 0, _len2 = columnValueStrings.length; _k < _len2; indexColumn = ++_k) {
        c = columnValueStrings[indexColumn];
        if (c === 'null') {
          s += OLAPCube._padToWidth('Total', maxColumnWidth) + ' |';
        } else {
          s += OLAPCube._padToWidth(c, maxColumnWidth);
        }
      }
      fullWidth = rowLabelWidth + maxColumnWidth * columnValueStrings.length + 3;
      if (columnValueStrings[0] === 'null') {
        fullWidth += 2;
      }
      s += '|\n|' + OLAPCube._padToWidth('', fullWidth, '=');
      for (indexRow = _l = 0, _len3 = rowValueStrings.length; _l < _len3; indexRow = ++_l) {
        r = rowValueStrings[indexRow];
        s += '|\n|';
        if (r === 'null') {
          s += OLAPCube._padToWidth('Total', rowLabelWidth, ' ', true);
        } else {
          s += OLAPCube._padToWidth(r, rowLabelWidth, ' ', true);
        }
        s += ' ||';
        for (indexColumn = _m = 0, _len4 = columnValueStrings.length; _m < _len4; indexColumn = ++_m) {
          c = columnValueStrings[indexColumn];
          s += OLAPCube._padToWidth(valueStrings[indexRow][indexColumn], maxColumnWidth);
          if (c === 'null') {
            s += ' |';
          }
        }
        if (r === 'null') {
          s += '|\n|' + OLAPCube._padToWidth('', fullWidth, '-');
        }
      }
      s += '|';
      return s;
    };

    OLAPCube._padToWidth = function(s, width, padCharacter, rightPad) {
      var padding;
      if (padCharacter == null) {
        padCharacter = ' ';
      }
      if (rightPad == null) {
        rightPad = false;
      }
      if (s.length > width) {
        return s.substr(0, width);
      }
      padding = new Array(width - s.length + 1).join(padCharacter);
      if (rightPad) {
        return s + padding;
      } else {
        return padding + s;
      }
    };

    OLAPCube.prototype.getStateForSaving = function(meta) {
      /*
      @method getStateForSaving
        Enables saving the state of an OLAPCube.
      @param {Object} [meta] An optional parameter that will be added to the serialized output and added to the meta field
        within the deserialized OLAPCube
      @return {Object} Returns an Ojbect representing the state of the OLAPCube. This Object is suitable for saving to
        to an object store. Use the static method `newFromSavedState()` with this Object as the parameter to reconstitute the OLAPCube.
      
          facts = [
            {ProjectHierarchy: [1, 2, 3], Priority: 1},
            {ProjectHierarchy: [1, 2, 4], Priority: 2},
            {ProjectHierarchy: [5]      , Priority: 1},
            {ProjectHierarchy: [1, 2]   , Priority: 1},
          ]
      
          dimensions = [
            {field: "ProjectHierarchy", type: 'hierarchy'},
            {field: "Priority"}
          ]
      
          config = {dimensions, metrics: []}
          config.keepTotals = true
      
          originalCube = new OLAPCube(config, facts)
      
          dateString = '2012-12-27T12:34:56.789Z'
          savedState = originalCube.getStateForSaving({upToDate: dateString})
          restoredCube = OLAPCube.newFromSavedState(savedState)
      
          newFacts = [
            {ProjectHierarchy: [5], Priority: 3},
            {ProjectHierarchy: [1, 2, 4], Priority: 1}
          ]
          originalCube.addFacts(newFacts)
          restoredCube.addFacts(newFacts)
      
          console.log(restoredCube.toString() == originalCube.toString())
          # true
      
          console.log(restoredCube.meta.upToDate)
          # 2012-12-27T12:34:56.789Z
      */

      var out;
      out = {
        config: this.userConfig,
        cells: this.cells,
        summaryMetrics: this.summaryMetrics
      };
      if (meta != null) {
        out.meta = meta;
      }
      return out;
    };

    OLAPCube.newFromSavedState = function(p) {
      /*
      @method newFromSavedState
        Deserializes a previously stringified OLAPCube and returns a new OLAPCube.
      
        See `getStateForSaving()` documentation for a detailed example.
      
        Note, if you have specified config.keepFacts = true, the values for the facts will be restored, however, they
        will no longer be references to the original facts. For this reason, it's usually better to include a `values` or
        `uniqueValues` metric on some ID field if you want fact drill-down support to survive a save and restore.
      @static
      @param {String/Object} p A String or Object from a previously saved OLAPCube state
      @return {OLAPCube}
      */

      var c, cube, d, fieldValue, filterString, _i, _j, _k, _len, _len1, _len2, _ref1, _ref2, _ref3;
      if (utils.type(p) === 'string') {
        p = JSON.parse(p);
      }
      cube = new OLAPCube(p.config);
      cube.summaryMetrics = p.summaryMetrics;
      if (p.meta != null) {
        cube.meta = p.meta;
      }
      cube.cells = p.cells;
      cube.cellIndex = {};
      cube._dimensionValues = {};
      _ref1 = cube.config.dimensions;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        d = _ref1[_i];
        cube._dimensionValues[d.field] = {};
      }
      _ref2 = cube.cells;
      for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
        c = _ref2[_j];
        filterString = JSON.stringify(OLAPCube._extractFilter(c, cube.config.dimensions));
        cube.cellIndex[filterString] = c;
        _ref3 = cube.config.dimensions;
        for (_k = 0, _len2 = _ref3.length; _k < _len2; _k++) {
          d = _ref3[_k];
          fieldValue = c[d.field];
          cube._dimensionValues[d.field][JSON.stringify(fieldValue)] = fieldValue;
        }
      }
      return cube;
    };

    return OLAPCube;

  })();

  exports.OLAPCube = OLAPCube;

}).call(this);

});

require.define("/src/functions.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var JSON, functions, utils, _populateDependentValues;

  utils = require('tztime').utils;

  JSON = require('JSON2');

  /*
  @class functions
  
  Rules about dependencies:
  
    * If a function can be calculated incrementally from an oldResult and newValues, then you do not need to specify dependencies
    * If a funciton can be calculated from other incrementally calculable results, then you need only specify those dependencies
    * If a function needs the full list of values to be calculated (like percentile coverage), then you must specify 'values'
    * To support the direct passing in of OLAP cube cells, you can provide a prefix (field name) so the key in dependentValues
      can be generated
    * 'count' is special and does not use a prefix because it is not dependent up a particular field
    * You should calculate the dependencies before you calculate the thing that is depedent. The OLAP cube does some
      checking to confirm you've done this.
  */


  functions = {};

  _populateDependentValues = function(values, dependencies, dependentValues, prefix) {
    var d, key, out, _i, _len;
    if (dependentValues == null) {
      dependentValues = {};
    }
    if (prefix == null) {
      prefix = '';
    }
    out = {};
    for (_i = 0, _len = dependencies.length; _i < _len; _i++) {
      d = dependencies[_i];
      if (d === 'count') {
        if (prefix === '') {
          key = 'count';
        } else {
          key = '_count';
        }
      } else {
        key = prefix + d;
      }
      if (dependentValues[key] == null) {
        dependentValues[key] = functions[d](values, void 0, void 0, dependentValues, prefix);
      }
      out[d] = dependentValues[key];
    }
    return out;
  };

  /*
  @method sum
  @static
  @param {Number[]} [values] Must either provide values or oldResult and newValues
  @param {Number} [oldResult] for incremental calculation
  @param {Number[]} [newValues] for incremental calculation
  @return {Number} The sum of the values
  */


  functions.sum = function(values, oldResult, newValues) {
    var temp, tempValues, v, _i, _len;
    if (oldResult != null) {
      temp = oldResult;
      tempValues = newValues;
    } else {
      temp = 0;
      tempValues = values;
    }
    for (_i = 0, _len = tempValues.length; _i < _len; _i++) {
      v = tempValues[_i];
      temp += v;
    }
    return temp;
  };

  /*
  @method product
  @static
  @param {Number[]} [values] Must either provide values or oldResult and newValues
  @param {Number} [oldResult] for incremental calculation
  @param {Number[]} [newValues] for incremental calculation
  @return {Number} The product of the values
  */


  functions.product = function(values, oldResult, newValues) {
    var temp, tempValues, v, _i, _len;
    if (oldResult != null) {
      temp = oldResult;
      tempValues = newValues;
    } else {
      temp = 1;
      tempValues = values;
    }
    for (_i = 0, _len = tempValues.length; _i < _len; _i++) {
      v = tempValues[_i];
      temp = temp * v;
    }
    return temp;
  };

  /*
  @method sumSquares
  @static
  @param {Number[]} [values] Must either provide values or oldResult and newValues
  @param {Number} [oldResult] for incremental calculation
  @param {Number[]} [newValues] for incremental calculation
  @return {Number} The sum of the squares of the values
  */


  functions.sumSquares = function(values, oldResult, newValues) {
    var temp, tempValues, v, _i, _len;
    if (oldResult != null) {
      temp = oldResult;
      tempValues = newValues;
    } else {
      temp = 0;
      tempValues = values;
    }
    for (_i = 0, _len = tempValues.length; _i < _len; _i++) {
      v = tempValues[_i];
      temp += v * v;
    }
    return temp;
  };

  /*
  @method sumCubes
  @static
  @param {Number[]} [values] Must either provide values or oldResult and newValues
  @param {Number} [oldResult] for incremental calculation
  @param {Number[]} [newValues] for incremental calculation
  @return {Number} The sum of the cubes of the values
  */


  functions.sumCubes = function(values, oldResult, newValues) {
    var temp, tempValues, v, _i, _len;
    if (oldResult != null) {
      temp = oldResult;
      tempValues = newValues;
    } else {
      temp = 0;
      tempValues = values;
    }
    for (_i = 0, _len = tempValues.length; _i < _len; _i++) {
      v = tempValues[_i];
      temp += v * v * v;
    }
    return temp;
  };

  /*
  @method lastValue
  @static
  @param {Number[]} [values] Must either provide values or newValues
  @param {Number} [oldResult] Not used. It is included to make the interface consistent.
  @param {Number[]} [newValues] for incremental calculation
  @return {Number} The last value
  */


  functions.lastValue = function(values, oldResult, newValues) {
    if (newValues != null) {
      return newValues[newValues.length - 1];
    }
    return values[values.length - 1];
  };

  /*
  @method firstValue
  @static
  @param {Number[]} [values] Must either provide values or oldResult
  @param {Number} [oldResult] for incremental calculation
  @param {Number[]} [newValues] Not used. It is included to make the interface consistent.
  @return {Number} The first value
  */


  functions.firstValue = function(values, oldResult, newValues) {
    if (oldResult != null) {
      return oldResult;
    }
    return values[0];
  };

  /*
  @method count
  @static
  @param {Number[]} [values] Must either provide values or oldResult and newValues
  @param {Number} [oldResult] for incremental calculation
  @param {Number[]} [newValues] for incremental calculation
  @return {Number} The length of the values Array
  */


  functions.count = function(values, oldResult, newValues) {
    if (oldResult != null) {
      return oldResult + newValues.length;
    }
    return values.length;
  };

  /*
  @method min
  @static
  @param {Number[]} [values] Must either provide values or oldResult and newValues
  @param {Number} [oldResult] for incremental calculation
  @param {Number[]} [newValues] for incremental calculation
  @return {Number} The minimum value or null if no values
  */


  functions.min = function(values, oldResult, newValues) {
    var temp, v, _i, _len;
    if (oldResult != null) {
      return functions.min(newValues.concat([oldResult]));
    }
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
  @param {Number[]} [values] Must either provide values or oldResult and newValues
  @param {Number} [oldResult] for incremental calculation
  @param {Number[]} [newValues] for incremental calculation
  @return {Number} The maximum value or null if no values
  */


  functions.max = function(values, oldResult, newValues) {
    var temp, v, _i, _len;
    if (oldResult != null) {
      return functions.max(newValues.concat([oldResult]));
    }
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
  @method values
  @static
  @param {Object[]} [values] Must either provide values or oldResult and newValues
  @param {Number} [oldResult] for incremental calculation
  @param {Number[]} [newValues] for incremental calculation
  @return {Array} All values (allows duplicates). Can be used for drill down.
  */


  functions.values = function(values, oldResult, newValues) {
    if (oldResult != null) {
      return oldResult.concat(newValues);
    }
    return values;
  };

  /*
  @method uniqueValues
  @static
  @param {Object[]} [values] Must either provide values or oldResult and newValues
  @param {Number} [oldResult] for incremental calculation
  @param {Number[]} [newValues] for incremental calculation
  @return {Array} Unique values. This is good for generating an OLAP dimension or drill down.
  */


  functions.uniqueValues = function(values, oldResult, newValues) {
    var key, r, temp, temp2, tempValues, v, value, _i, _j, _len, _len1;
    temp = {};
    if (oldResult != null) {
      for (_i = 0, _len = oldResult.length; _i < _len; _i++) {
        r = oldResult[_i];
        temp[r] = null;
      }
      tempValues = newValues;
    } else {
      tempValues = values;
    }
    temp2 = [];
    for (_j = 0, _len1 = tempValues.length; _j < _len1; _j++) {
      v = tempValues[_j];
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
  @param {Number[]} [values] Must either provide values or oldResult and newValues
  @param {Number} [oldResult] not used by this function but included so all functions have a consistent signature
  @param {Number[]} [newValues] not used by this function but included so all functions have a consistent signature
  @param {Object} [dependentValues] If the function can be calculated from the results of other functions, this allows
    you to provide those pre-calculated values.
  @return {Number} The arithmetic mean
  */


  functions.average = function(values, oldResult, newValues, dependentValues, prefix) {
    var count, sum, _ref;
    _ref = _populateDependentValues(values, functions.average.dependencies, dependentValues, prefix), count = _ref.count, sum = _ref.sum;
    return sum / count;
  };

  functions.average.dependencies = ['count', 'sum'];

  /*
  @method errorSquared
  @static
  @param {Number[]} [values] Must either provide values or oldResult and newValues
  @param {Number} [oldResult] not used by this function but included so all functions have a consistent signature
  @param {Number[]} [newValues] not used by this function but included so all functions have a consistent signature
  @param {Object} [dependentValues] If the function can be calculated from the results of other functions, this allows
    you to provide those pre-calculated values.
  @return {Number} The error squared
  */


  functions.errorSquared = function(values, oldResult, newValues, dependentValues, prefix) {
    var count, difference, errorSquared, mean, sum, v, _i, _len, _ref;
    _ref = _populateDependentValues(values, functions.errorSquared.dependencies, dependentValues, prefix), count = _ref.count, sum = _ref.sum;
    mean = sum / count;
    errorSquared = 0;
    for (_i = 0, _len = values.length; _i < _len; _i++) {
      v = values[_i];
      difference = v - mean;
      errorSquared += difference * difference;
    }
    return errorSquared;
  };

  functions.errorSquared.dependencies = ['count', 'sum'];

  /*
  @method variance
  @static
  @param {Number[]} [values] Must either provide values or oldResult and newValues
  @param {Number} [oldResult] not used by this function but included so all functions have a consistent signature
  @param {Number[]} [newValues] not used by this function but included so all functions have a consistent signature
  @param {Object} [dependentValues] If the function can be calculated from the results of other functions, this allows
    you to provide those pre-calculated values.
  @return {Number} The variance
  */


  functions.variance = function(values, oldResult, newValues, dependentValues, prefix) {
    var count, sum, sumSquares, _ref;
    _ref = _populateDependentValues(values, functions.variance.dependencies, dependentValues, prefix), count = _ref.count, sum = _ref.sum, sumSquares = _ref.sumSquares;
    return (count * sumSquares - sum * sum) / (count * (count - 1));
  };

  functions.variance.dependencies = ['count', 'sum', 'sumSquares'];

  /*
  @method standardDeviation
  @static
  @param {Number[]} [values] Must either provide values or oldResult and newValues
  @param {Number} [oldResult] not used by this function but included so all functions have a consistent signature
  @param {Number[]} [newValues] not used by this function but included so all functions have a consistent signature
  @param {Object} [dependentValues] If the function can be calculated from the results of other functions, this allows
    you to provide those pre-calculated values.
  @return {Number} The standard deviation
  */


  functions.standardDeviation = function(values, oldResult, newValues, dependentValues, prefix) {
    return Math.sqrt(functions.variance(values, oldResult, newValues, dependentValues, prefix));
  };

  functions.standardDeviation.dependencies = functions.variance.dependencies;

  /*
  @method percentileCreator
  @static
  @param {Number} p The percentile for the resulting function (50 = median, 75, 99, etc.)
  @return {Function} A function to calculate the percentile
  
  When the user passes in `p<n>` as an aggregation function, this `percentileCreator` is called to return the appropriate
  percentile function. The returned function will find the `<n>`th percentile where `<n>` is some number in the form of
  `##[.##]`. (e.g. `p40`, `p99`, `p99.9`).
  
  There is no official definition of percentile. The most popular choices differ in the interpolation algorithm that they
  use. The function returned by this `percentileCreator` uses the Excel interpolation algorithm which differs from the NIST
  primary method. However, NIST lists something very similar to the Excel approach as an acceptible alternative. The only
  difference seems to be for the edge case for when you have only two data points in your data set. Agreement with Excel,
  NIST's acceptance of it as an alternative (almost), and the fact that it makes the most sense to me is why this approach
  was chosen.
  
  http://en.wikipedia.org/wiki/Percentile#Alternative_methods
  
  Note: `median` is an alias for `p50`. The approach chosen for calculating p50 gives you the
  exact same result as the definition for median even for edge cases like sets with only one or two data points.
  */


  functions.percentileCreator = function(p) {
    var f;
    f = function(values, oldResult, newValues, dependentValues, prefix) {
      var d, k, n, sortfunc, vLength;
      if (values == null) {
        values = _populateDependentValues(values, ['values'], dependentValues, prefix).values;
      }
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
    f.dependencies = ['values'];
    return f;
  };

  functions.expandFandAs = function(a) {
    /*
    @method expandFandAs
    @static
    @param {Object} a Will look like this `{as: 'mySum', f: 'sum', field: 'Points'}`
    @return {Object} returns the expanded specification
    
    Takes specifications for functions and expands them to include the actual function and 'as'. If you do not provide
    an 'as' property, it will build it from the field name and function with an underscore between. Also, if the
    'f' provided is a string, it is copied over to the 'metric' property before the 'f' property is replaced with the
    actual function. `{field: 'a', f: 'sum'}` would expand to `{as: 'a_sum', field: 'a', metric: 'sum', f: [Function]}`.
    */

    var p;
    utils.assert(a.f != null, "'f' missing from specification: \n" + (JSON.stringify(a, void 0, 4)));
    if (utils.type(a.f) === 'function') {
      utils.assert(a.as != null, 'Must provide "as" field with your aggregation when providing a user defined function');
      a.metric = a.f.toString();
    } else if (functions[a.f] != null) {
      a.metric = a.f;
      a.f = functions[a.f];
    } else if (a.f === 'median') {
      a.metric = 'median';
      a.f = functions.percentileCreator(50);
    } else if (a.f.substr(0, 1) === 'p') {
      a.metric = a.f;
      p = /\p(\d+(.\d+)?)/.exec(a.f)[1];
      a.f = functions.percentileCreator(Number(p));
    } else {
      throw new Error("" + a.f + " is not a recognized built-in function");
    }
    if (a.as == null) {
      if (a.metric === 'count') {
        a.field = '';
        a.metric = 'count';
      }
      a.as = "" + a.field + "_" + a.metric;
      utils.assert((a.field != null) || a.f === 'count', "'field' missing from specification: \n" + (JSON.stringify(a, void 0, 4)));
    }
    return a;
  };

  functions.expandMetrics = function(metrics, addCountIfMissing, addValuesForCustomFunctions) {
    var assureDependenciesAbove, confirmMetricAbove, countRow, dependencies, hasCount, index, m, metricsRow, valuesRow, _i, _j, _len, _len1;
    if (metrics == null) {
      metrics = [];
    }
    if (addCountIfMissing == null) {
      addCountIfMissing = false;
    }
    if (addValuesForCustomFunctions == null) {
      addValuesForCustomFunctions = false;
    }
    /*
    @method expandMetrics
    @static
    @private
    
    This is called internally by several Lumenize Calculators. You should probably not call it.
    */

    confirmMetricAbove = function(m, fieldName, aboveThisIndex) {
      var currentRow, i, lookingFor, metricsLength;
      if (m === 'count') {
        lookingFor = '_' + m;
      } else {
        lookingFor = fieldName + '_' + m;
      }
      i = 0;
      while (i < aboveThisIndex) {
        currentRow = metrics[i];
        if (currentRow.as === lookingFor) {
          return true;
        }
        i++;
      }
      i = aboveThisIndex + 1;
      metricsLength = metrics.length;
      while (i < metricsLength) {
        currentRow = metrics[i];
        if (currentRow.as === lookingFor) {
          throw new Error("Depdencies must appear before the metric they are dependant upon. " + m + " appears after.");
        }
        i++;
      }
      return false;
    };
    assureDependenciesAbove = function(dependencies, fieldName, aboveThisIndex) {
      var d, newRow, _i, _len;
      for (_i = 0, _len = dependencies.length; _i < _len; _i++) {
        d = dependencies[_i];
        if (!confirmMetricAbove(d, fieldName, aboveThisIndex)) {
          if (d === 'count') {
            newRow = {
              f: 'count'
            };
          } else {
            newRow = {
              f: d,
              field: fieldName
            };
          }
          functions.expandFandAs(newRow);
          metrics.unshift(newRow);
          return false;
        }
      }
      return true;
    };
    if (addValuesForCustomFunctions) {
      for (index = _i = 0, _len = metrics.length; _i < _len; index = ++_i) {
        m = metrics[index];
        if (utils.type(m.f) === 'function') {
          if (m.f.dependencies == null) {
            m.f.dependencies = [];
          }
          if (m.f.dependencies[0] !== 'values') {
            m.f.dependencies.push('values');
          }
          if (!confirmMetricAbove('values', m.field, index)) {
            valuesRow = {
              f: 'values',
              field: m.field
            };
            functions.expandFandAs(valuesRow);
            metrics.unshift(valuesRow);
          }
        }
      }
    }
    hasCount = false;
    for (_j = 0, _len1 = metrics.length; _j < _len1; _j++) {
      m = metrics[_j];
      functions.expandFandAs(m);
      if (m.metric === 'count') {
        hasCount = true;
      }
    }
    if (addCountIfMissing && !hasCount) {
      countRow = {
        f: 'count'
      };
      functions.expandFandAs(countRow);
      metrics.unshift(countRow);
    }
    index = 0;
    while (index < metrics.length) {
      metricsRow = metrics[index];
      if (utils.type(metricsRow.f) === 'function') {
        dependencies = ['values'];
      }
      if (metricsRow.f.dependencies != null) {
        if (!assureDependenciesAbove(metricsRow.f.dependencies, metricsRow.field, index)) {
          index = -1;
        }
      }
      index++;
    }
    return metrics;
  };

  exports.functions = functions;

}).call(this);

});

require.define("/src/dataTransform.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var JSON, Time, arrayOfMaps_To_CSVStyleArray, arrayOfMaps_To_HighChartsSeries, csvString_To_CSVStyleArray, csvStyleArray_To_ArrayOfMaps, csvStyleArray_To_CSVString, utils, _ref;

  _ref = require('tztime'), utils = _ref.utils, Time = _ref.Time;

  JSON = require('JSON2');

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

  arrayOfMaps_To_CSVStyleArray = function(arrayOfMaps, keys) {
    /*
    @method arrayOfMaps_To_CSVStyleArray
    @param {Object[]} arrayOfMaps
    @param {Object} [keys] If not provided, it will use the first row and get all fields
    @return {Array[]} The first row will be the column headers
    
    `arrayOfMaps_To_CSVStyleArray` is a convenience function that will convert an array of maps like:
    
        {arrayOfMaps_To_CSVStyleArray} = require('../')
    
        arrayOfMaps = [
          {column1: 10000, column2: 20000},
          {column1: 30000, column2: 40000},
          {column1: 50000, column2: 60000}
        ]
    
    to a CSV-style array like this:
    
        console.log(arrayOfMaps_To_CSVStyleArray(arrayOfMaps))
    
        # [ [ 'column1', 'column2' ],
        #   [ 10000, 20000 ],
        #   [ 30000, 40000 ],
        #   [ 50000, 60000 ] ]
    `
    */

    var csvStyleArray, inRow, key, outRow, value, _i, _j, _len, _len1, _ref1;
    if (arrayOfMaps.length === 0) {
      return [];
    }
    csvStyleArray = [];
    outRow = [];
    if (keys == null) {
      keys = [];
      _ref1 = arrayOfMaps[0];
      for (key in _ref1) {
        value = _ref1[key];
        keys.push(key);
      }
    }
    csvStyleArray.push(keys);
    for (_i = 0, _len = arrayOfMaps.length; _i < _len; _i++) {
      inRow = arrayOfMaps[_i];
      outRow = [];
      for (_j = 0, _len1 = keys.length; _j < _len1; _j++) {
        key = keys[_j];
        outRow.push(inRow[key]);
      }
      csvStyleArray.push(outRow);
    }
    return csvStyleArray;
  };

  arrayOfMaps_To_HighChartsSeries = function(arrayOfMaps, config) {
    /*
    @method arrayOfMaps_To_HighChartsSeries
    @param {Array[]} arrayOfMaps
    @param {Object} config You can use the same config you used to call TimeSeriesCalculator including your yAxis specifications
    @return {Object[]} in HighCharts form
    
    Takes an array of arrays that came from a call to TimeSeriesCalculator and looks like this:
    
        {arrayOfMaps_To_HighChartsSeries} = require('../')
    
        arrayOfMaps = [
          {"Series 1": 8, "Series 2": 5, "Series3": 10},
          {"Series 1": 2, "Series 2": 3},
          {"Series 1": 1, "Series 2": 2, "Series3": 40},
        ]
    
    and a list of series configurations
    
        config = [
          {name: "Series 1", yAxis: 1},
          {name: "Series 2"},
          {name: "Series3"}
        ]
        
    and extracts the data into seperate series
    
        console.log(arrayOfMaps_To_HighChartsSeries(arrayOfMaps, config))
        # [ { name: 'Series 1', data: [ 8, 2, 1 ], yAxis: 1 },
        #   { name: 'Series 2', data: [ 5, 3, 2 ] },
        #   { name: 'Series3', data: [ 10, null, 40 ] } ]
        
    Notice how the extra fields from the series array are included in the output. Also, notice how the missing second
    value for Series3 was replaced with a null. HighCharts will skip right over this for category charts as you would
    expect.
    */

    var a, aggregationRow, idx, key, output, outputRow, preOutput, s, seriesNames, seriesRow, value, _i, _j, _k, _l, _len, _len1, _len2, _len3;
    preOutput = {};
    seriesNames = [];
    for (_i = 0, _len = config.length; _i < _len; _i++) {
      a = config[_i];
      seriesNames.push(a.name);
    }
    for (_j = 0, _len1 = seriesNames.length; _j < _len1; _j++) {
      s = seriesNames[_j];
      preOutput[s] = [];
      for (_k = 0, _len2 = arrayOfMaps.length; _k < _len2; _k++) {
        aggregationRow = arrayOfMaps[_k];
        value = aggregationRow[s];
        if (value == null) {
          value = null;
        }
        preOutput[s].push(value);
      }
    }
    output = [];
    for (idx = _l = 0, _len3 = seriesNames.length; _l < _len3; idx = ++_l) {
      s = seriesNames[idx];
      outputRow = {
        name: s,
        data: preOutput[s]
      };
      seriesRow = config[idx];
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

  csvString_To_CSVStyleArray = function(s, asterixForUndefined) {
    var c, cValue, error, headerLength, index, newRow, out, rawRowArray, row, rows, _i, _j, _len, _len1;
    if (asterixForUndefined == null) {
      asterixForUndefined = true;
    }
    rows = s.split('\n');
    headerLength = rows[0].split(',').length;
    out = [];
    for (index = _i = 0, _len = rows.length; _i < _len; index = ++_i) {
      row = rows[index];
      newRow = [];
      rawRowArray = row.split(',');
      if (rawRowArray.length === headerLength) {
        for (_j = 0, _len1 = rawRowArray.length; _j < _len1; _j++) {
          c = rawRowArray[_j];
          if (asterixForUndefined && c === '*') {
            cValue = void 0;
          } else {
            try {
              cValue = JSON.parse(c);
            } catch (_error) {
              error = _error;
            }
          }
          newRow.push(cValue);
        }
        out.push(newRow);
      } else {
        console.log("Warning: Skipping row because length does not match header length in row " + index + ": " + row);
      }
    }
    return out;
  };

  csvStyleArray_To_CSVString = function(csvStyleArray) {
    var row, s, value, _i, _j, _len, _len1;
    s = '';
    for (_i = 0, _len = csvStyleArray.length; _i < _len; _i++) {
      row = csvStyleArray[_i];
      for (_j = 0, _len1 = row.length; _j < _len1; _j++) {
        value = row[_j];
        s += JSON.stringify(value) + ', ';
      }
      s += "\n";
    }
    return s;
  };

  exports.arrayOfMaps_To_CSVStyleArray = arrayOfMaps_To_CSVStyleArray;

  exports.csvStyleArray_To_ArrayOfMaps = csvStyleArray_To_ArrayOfMaps;

  exports.arrayOfMaps_To_HighChartsSeries = arrayOfMaps_To_HighChartsSeries;

  exports.csvString_To_CSVStyleArray = csvString_To_CSVStyleArray;

  exports.csvStyleArray_To_CSVString = csvStyleArray_To_CSVString;

}).call(this);

});

require.define("/src/TransitionsCalculator.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var JSON, OLAPCube, Time, Timeline, TransitionsCalculator, utils, _ref;

  OLAPCube = require('./OLAPCube').OLAPCube;

  _ref = require('tztime'), utils = _ref.utils, Time = _ref.Time, Timeline = _ref.Timeline;

  JSON = require('JSON2');

  TransitionsCalculator = (function() {
    /*
    @class TransitionsCalculator
    
    Used to accumlate counts and sums about transitions.
    
    Let's say that you want to create a throughput or velocity chart where each column on the chart represents the
    number of work items that cross over from one state into another state in a given month/week/quarter/etc. You would
    send a transitions to a temporal data store like Rally's Lookback API specifying both the current values and the
    previous values. For instance, the work items crossing from "In Progress" to "Completed" could be found
    with this query clause `"_PreviousValues.ScheduleState": {"$lte": "In Progress"}, "ScheduleState": {"$gt": "In Progress"}`
    
        {TransitionsCalculator, Time} = require('../')
    
        snapshots = [
          { id: 1, from: '2011-01-03T00:00:00.000Z', PlanEstimate: 10 },
          { id: 1, from: '2011-01-05T00:00:00.000Z', PlanEstimate: 10 },
          { id: 2, from: '2011-01-04T00:00:00.000Z', PlanEstimate: 20 },
          { id: 3, from: '2011-01-10T00:00:00.000Z', PlanEstimate: 30 },
          { id: 4, from: '2011-01-11T00:00:00.000Z', PlanEstimate: 40 },
          { id: 5, from: '2011-01-17T00:00:00.000Z', PlanEstimate: 50 },
          { id: 6, from: '2011-02-07T00:00:00.000Z', PlanEstimate: 60 },
          { id: 7, from: '2011-02-08T00:00:00.000Z', PlanEstimate: 70 },
        ]
    
    But that's not the entire story. What if something crosses over into "Completed" and beyond but crosses back. It could
    do this several times and get counted multiple times. That would be bad. The way we deal with this is to also
    look for the list of snapshots that pass backwards across the boundary and subract thier impact on the final calculations.
    
    One can think of alternative aproaches for avoiding this double counting. You could, for instance, only count the last
    transition for each unique work item. The problem with this approach is that the backward moving transition might
    occur in a different time period from the forward moving one. A later snapshot could invalidate an earlier calculation
    which is bad for incremental calculation and caching. To complicate matters, the field values being summed by the
    calculator might have changed between subsequent forward/backward transitions. The chosen algorithm is the only way I know to
    preserve the idempotency and cachable incremental calculation properties.
    
        snapshotsToSubtract = [
          { id: 1, from: '2011-01-04T00:00:00.000Z', PlanEstimate: 10 },
          { id: 7, from: '2011-02-09T00:00:00.000Z', PlanEstimate: 70 },
        ]
    
    The calculator will keep track of the count of items automatically (think throughput), but if you want to sum up a
    particular field (think velocity), you can specify that with the 'fieldsToSum' config property.
    
        fieldsToSum = ['PlanEstimate']
    
    Now let's build our config object.
    
        config =
          asOf: '2011-02-10'  # Leave this off if you want it to continuously update to today
          granularity: Time.MONTH
          tz: 'America/Chicago'
          validFromField: 'from'
          validToField: 'to'
          uniqueIDField: 'id'
          fieldsToSum: fieldsToSum
          asterixToDateTimePeriod: true  # Set to false or leave off if you are going to reformat the timePeriod
    
    In most cases, you'll want to leave off the `asOf` configuration property so the data can be continuously updated
    with new snapshots as they come in. We include it in this example so the output stays stable. If we hadn't, then
    the rows would continue to grow to encompass today.
    
        startOn = '2011-01-02T00:00:00.000Z'
        endBefore = '2011-02-27T00:00:00.000Z'
    
        calculator = new TransitionsCalculator(config)
        calculator.addSnapshots(snapshots, startOn, endBefore, snapshotsToSubtract)
    
        console.log(calculator.getResults())
        # [ { timePeriod: '2011-01', count: 5, PlanEstimate: 150 },
        #   { timePeriod: '2011-02*', count: 1, PlanEstimate: 60 } ]
    
    The asterix on the last row in the results is to indicate that it is a to-date value. As more snapshots come in, this
    last row will change. The caching and incremental calcuation capability of this Calculator are designed to take
    this into account.
    
    Now, let's use the same data but aggregate in granularity of weeks.
    
        config.granularity = Time.WEEK
        calculator = new TransitionsCalculator(config)
        calculator.addSnapshots(snapshots, startOn, endBefore, snapshotsToSubtract)
    
        console.log(calculator.getResults())
        # [ { timePeriod: '2010W52', count: 1, PlanEstimate: 10 },
        #   { timePeriod: '2011W01', count: 2, PlanEstimate: 50 },
        #   { timePeriod: '2011W02', count: 2, PlanEstimate: 90 },
        #   { timePeriod: '2011W03', count: 0, PlanEstimate: 0 },
        #   { timePeriod: '2011W04', count: 0, PlanEstimate: 0 },
        #   { timePeriod: '2011W05', count: 1, PlanEstimate: 60 },
        #   { timePeriod: '2011W06*', count: 0, PlanEstimate: 0 } ]
    
    Remember, you can easily convert weeks to other granularities for display.
    
        weekStartingLabel = 'week starting ' + new Time('2010W52').inGranularity(Time.DAY).toString()
        console.log(weekStartingLabel)
        # week starting 2010-12-27
    
    If you want to display spinners while the chart is rendering, you can read this calculator's upToDateISOString property and
    compare it directly to the getResults() row's timePeriod property using code like this. Yes, this works eventhough
    upToDateISOString is an ISOString.
    
        row = {timePeriod: '2011W07'}
        if calculator.upToDateISOString < row.timePeriod
          console.log("#{row.timePeriod} not yet calculated.")
        # 2011W07 not yet calculated.
    */

    function TransitionsCalculator(config) {
      /*
      @constructor
      @param {Object} config
      @cfg {String} tz The timezone for analysis in the form like `America/New_York`
      @cfg {String} [validFromField = "_ValidFrom"]
      @cfg {String} [validToField = "_ValidTo"]
      @cfg {String} [uniqueIDField = "ObjectID"] Not used right now but when drill-down is added it will be
      @cfg {String} granularity 'month', 'week', 'quarter', etc. Use Time.MONTH, Time.WEEK, etc.
      @cfg {String[]} [fieldsToSum=[]] It will track the count automatically but it can keep a running sum of other fields also
      @cfg {Boolean} [asterixToDateTimePeriod=false] If set to true, then the still-in-progress last time period will be asterixed
      */

      var cubeConfig, dimensions, f, metrics, _i, _len, _ref1, _ref2;
      this.config = utils.clone(config);
      if (this.config.validFromField == null) {
        this.config.validFromField = "_ValidFrom";
      }
      if (this.config.validToField == null) {
        this.config.validToField = "_ValidTo";
      }
      if (this.config.uniqueIDField == null) {
        this.config.uniqueIDField = "ObjectID";
      }
      if (this.config.fieldsToSum == null) {
        this.config.fieldsToSum = [];
      }
      if (this.config.asterixToDateTimePeriod == null) {
        this.config.asterixToDateTimePeriod = false;
      }
      utils.assert(this.config.tz != null, "Must provide a timezone to this calculator.");
      utils.assert(this.config.granularity != null, "Must provide a granularity to this calculator.");
      if ((_ref1 = this.config.granularity) === Time.HOUR || _ref1 === Time.MINUTE || _ref1 === Time.SECOND || _ref1 === Time.MILLISECOND) {
        throw new Error("Transitions calculator is not designed to work on granularities finer than 'day'");
      }
      dimensions = [
        {
          field: 'timePeriod'
        }
      ];
      metrics = [
        {
          field: 'count',
          f: 'sum'
        }
      ];
      _ref2 = this.config.fieldsToSum;
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        f = _ref2[_i];
        metrics.push({
          field: f,
          f: 'sum'
        });
      }
      cubeConfig = {
        dimensions: dimensions,
        metrics: metrics
      };
      this.cube = new OLAPCube(cubeConfig);
      this.upToDateISOString = null;
      this.lowestTimePeriod = null;
      if (this.config.asOf != null) {
        this.maxTimeString = new Time(this.config.asOf, Time.MILLISECOND).getISOStringInTZ(this.config.tz);
      } else {
        this.maxTimeString = Time.getISOStringFromJSDate();
      }
      this.virgin = true;
    }

    TransitionsCalculator.prototype.addSnapshots = function(snapshots, startOn, endBefore, snapshotsToSubtract) {
      var filteredSnapshots, filteredSnapshotsToSubstract, startOnString;
      if (snapshotsToSubtract == null) {
        snapshotsToSubtract = [];
      }
      /*
      @method addSnapshots
        Allows you to incrementally add snapshots to this calculator.
      @chainable
      @param {Object[]} snapshots An array of temporal data model snapshots.
      @param {String} startOn A ISOString (e.g. '2012-01-01T12:34:56.789Z') indicating the time start of the period of
        interest. On the second through nth call, this should equal the previous endBefore.
      @param {String} endBefore A ISOString (e.g. '2012-01-01T12:34:56.789Z') indicating the moment just past the time
        period of interest.
      @return {TransitionsCalculator}
      */

      if (this.upToDateISOString != null) {
        utils.assert(this.upToDateISOString === startOn, "startOn (" + startOn + ") parameter should equal endBefore of previous call (" + this.upToDateISOString + ") to addSnapshots.");
      }
      this.upToDateISOString = endBefore;
      startOnString = new Time(startOn, this.config.granularity, this.config.tz).toString();
      if (this.lowestTimePeriod != null) {
        if (startOnString < this.lowestTimePeriod) {
          this.lowestTimePeriod = startOnString;
        }
      } else {
        this.lowestTimePeriod = startOnString;
      }
      filteredSnapshots = this._filterSnapshots(snapshots);
      this.cube.addFacts(filteredSnapshots);
      filteredSnapshotsToSubstract = this._filterSnapshots(snapshotsToSubtract, -1);
      this.cube.addFacts(filteredSnapshotsToSubstract);
      this.virgin = false;
      return this;
    };

    TransitionsCalculator.prototype._filterSnapshots = function(snapshots, sign) {
      var f, filteredSnapshots, fs, s, _i, _j, _len, _len1, _ref1;
      if (sign == null) {
        sign = 1;
      }
      filteredSnapshots = [];
      for (_i = 0, _len = snapshots.length; _i < _len; _i++) {
        s = snapshots[_i];
        if (s[this.config.validFromField] <= this.maxTimeString) {
          if (s.count != null) {
            throw new Error('Snapshots passed into a TransitionsCalculator cannot have a `count` field.');
          }
          if (s.timePeriod != null) {
            throw new Error('Snapshots passed into a TransitionsCalculator cannot have a `timePeriod` field.');
          }
          fs = utils.clone(s);
          fs.count = sign * 1;
          fs.timePeriod = new Time(s[this.config.validFromField], this.config.granularity, this.config.tz).toString();
          _ref1 = this.config.fieldsToSum;
          for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
            f = _ref1[_j];
            fs[f] = sign * s[f];
          }
          filteredSnapshots.push(fs);
        }
      }
      return filteredSnapshots;
    };

    TransitionsCalculator.prototype.getResults = function() {
      /*
      @method getResults
        Returns the current state of the calculator
      @return {Object[]} Returns an Array of Maps like `{timePeriod: '2012-12', count: 10, otherField: 34}`
      */

      var cell, config, f, filter, out, outRow, t, timeLine, timePeriods, tp, _i, _j, _k, _len, _len1, _len2, _ref1, _ref2;
      if (this.virgin) {
        return [];
      }
      out = [];
      this.highestTimePeriod = new Time(this.maxTimeString, this.config.granularity, this.config.tz).toString();
      config = {
        startOn: this.lowestTimePeriod,
        endBefore: this.highestTimePeriod,
        granularity: this.config.granularity
      };
      timeLine = new Timeline(config);
      timePeriods = (function() {
        var _i, _len, _ref1, _results;
        _ref1 = timeLine.getAllRaw();
        _results = [];
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          t = _ref1[_i];
          _results.push(t.toString());
        }
        return _results;
      })();
      timePeriods.push(this.highestTimePeriod);
      for (_i = 0, _len = timePeriods.length; _i < _len; _i++) {
        tp = timePeriods[_i];
        filter = {};
        filter['timePeriod'] = tp;
        cell = this.cube.getCell(filter);
        outRow = {};
        outRow.timePeriod = tp;
        if (cell != null) {
          outRow.count = cell.count_sum;
          _ref1 = this.config.fieldsToSum;
          for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
            f = _ref1[_j];
            outRow[f] = cell[f + '_sum'];
          }
        } else {
          outRow.count = 0;
          _ref2 = this.config.fieldsToSum;
          for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
            f = _ref2[_k];
            outRow[f] = 0;
          }
        }
        out.push(outRow);
      }
      if (this.config.asterixToDateTimePeriod) {
        out[out.length - 1].timePeriod += '*';
      }
      return out;
    };

    TransitionsCalculator.prototype.getStateForSaving = function(meta) {
      /*
      @method getStateForSaving
        Enables saving the state of this calculator. See TimeInStateCalculator documentation for a detailed example.
      @param {Object} [meta] An optional parameter that will be added to the serialized output and added to the meta field
        within the deserialized calculator.
      @return {Object} Returns an Ojbect representing the state of the calculator. This Object is suitable for saving to
        to an object store. Use the static method `newFromSavedState()` with this Object as the parameter to reconstitute
        the calculator.
      */

      var out;
      out = {
        config: this.config,
        cubeSavedState: this.cube.getStateForSaving(),
        upToDateISOString: this.upToDateISOString,
        maxTimeString: this.maxTimeString,
        lowestTimePeriod: this.lowestTimePeriod,
        virgin: this.virgin
      };
      if (meta != null) {
        out.meta = meta;
      }
      return out;
    };

    TransitionsCalculator.newFromSavedState = function(p) {
      /*
      @method newFromSavedState
        Deserializes a previously saved calculator and returns a new calculator. See TimeInStateCalculator for a detailed example.
      @static
      @param {String/Object} p A String or Object from a previously saved state
      @return {TransitionsCalculator}
      */

      var calculator;
      if (utils.type(p) === 'string') {
        p = JSON.parse(p);
      }
      calculator = new TransitionsCalculator(p.config);
      calculator.cube = OLAPCube.newFromSavedState(p.cubeSavedState);
      calculator.upToDateISOString = p.upToDateISOString;
      calculator.maxTimeString = p.maxTimeString;
      calculator.lowestTimePeriod = p.lowestTimePeriod;
      calculator.virgin = p.virgin;
      if (p.meta != null) {
        calculator.meta = p.meta;
      }
      return calculator;
    };

    return TransitionsCalculator;

  })();

  exports.TransitionsCalculator = TransitionsCalculator;

}).call(this);

});

require.define("/src/TimeSeriesCalculator.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var JSON, OLAPCube, Time, TimeSeriesCalculator, Timeline, functions, utils, _ref,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  OLAPCube = require('./OLAPCube').OLAPCube;

  _ref = require('tztime'), utils = _ref.utils, Time = _ref.Time, Timeline = _ref.Timeline;

  functions = require('./functions').functions;

  JSON = require('JSON2');

  TimeSeriesCalculator = (function() {
    /*
    @class TimeSeriesCalculator
    This calculator is used to convert snapshot data into time series aggregations.
    
    Below are two examples of using the TimeSeriesCalculator. The first is a detailed example showing how you would create
    a set of single-metric series (line, spline, or column). The second, is an example of creating a set of group-by series
    (like you would use to create a stacked column or stacked area chart). You can mix and match these on the same chart, but
    one type (a set of single-metric series versus a single group-by meta-series) typically dominates.
    
    ## Time-series example - a burn chart ##
    
    Let's start with a fairly large set of snapshots and create a set of series for a burn (up/down) chart.
    
        lumenize = require('../')
        {TimeSeriesCalculator, Time} = lumenize
    
        snapshotsCSV = [
          ["ObjectID", "_ValidFrom",               "_ValidTo",                 "ScheduleState", "PlanEstimate", "TaskRemainingTotal", "TaskEstimateTotal"],
    
          [1,          "2010-10-10T15:00:00.000Z", "2011-01-02T13:00:00.000Z", "Ready to pull", 5             , 15                  , 15],
    
          [1,          "2011-01-02T13:00:00.000Z", "2011-01-02T15:10:00.000Z", "Ready to pull", 5             , 15                  , 15],
          [1,          "2011-01-02T15:10:00.000Z", "2011-01-03T15:00:00.000Z", "In progress"  , 5             , 20                  , 15],
          [2,          "2011-01-02T15:00:00.000Z", "2011-01-03T15:00:00.000Z", "Ready to pull", 3             , 5                   , 5],
          [3,          "2011-01-02T15:00:00.000Z", "2011-01-03T15:00:00.000Z", "Ready to pull", 5             , 12                  , 12],
    
          [2,          "2011-01-03T15:00:00.000Z", "2011-01-04T15:00:00.000Z", "In progress"  , 3             , 5                   , 5],
          [3,          "2011-01-03T15:00:00.000Z", "2011-01-04T15:00:00.000Z", "Ready to pull", 5             , 12                  , 12],
          [4,          "2011-01-03T15:00:00.000Z", "2011-01-04T15:00:00.000Z", "Ready to pull", 5             , 15                  , 15],
          [1,          "2011-01-03T15:10:00.000Z", "2011-01-04T15:00:00.000Z", "In progress"  , 5             , 12                  , 15],
    
          [1,          "2011-01-04T15:00:00.000Z", "2011-01-06T15:00:00.000Z", "Accepted"     , 5             , 0                   , 15],
          [2,          "2011-01-04T15:00:00.000Z", "2011-01-06T15:00:00.000Z", "In test"      , 3             , 1                   , 5],
          [3,          "2011-01-04T15:00:00.000Z", "2011-01-05T15:00:00.000Z", "In progress"  , 5             , 10                  , 12],
          [4,          "2011-01-04T15:00:00.000Z", "2011-01-06T15:00:00.000Z", "Ready to pull", 5             , 15                  , 15],
          [5,          "2011-01-04T15:00:00.000Z", "2011-01-06T15:00:00.000Z", "Ready to pull", 2             , 4                   , 4],
    
          [3,          "2011-01-05T15:00:00.000Z", "2011-01-07T15:00:00.000Z", "In test"      , 5             , 5                   , 12],
    
          [1,          "2011-01-06T15:00:00.000Z", "2011-01-07T15:00:00.000Z", "Released"     , 5             , 0                   , 15],
          [2,          "2011-01-06T15:00:00.000Z", "2011-01-07T15:00:00.000Z", "Accepted"     , 3             , 0                   , 5],
          [4,          "2011-01-06T15:00:00.000Z", "2011-01-07T15:00:00.000Z", "In progress"  , 5             , 7                   , 15],
          [5,          "2011-01-06T15:00:00.000Z", "2011-01-07T15:00:00.000Z", "Ready to pull", 2             , 4                   , 4],
    
          [1,          "2011-01-07T15:00:00.000Z", "9999-01-01T00:00:00.000Z", "Released"     , 5            , 0                    , 15],
          [2,          "2011-01-07T15:00:00.000Z", "9999-01-01T00:00:00.000Z", "Released"     , 3            , 0                    , 5],
          [3,          "2011-01-07T15:00:00.000Z", "9999-01-01T00:00:00.000Z", "Accepted"     , 5            , 0                    , 12],
          [4,          "2011-01-07T15:00:00.000Z", "9999-01-01T00:00:00.000Z", "In test"      , 5            , 3                    , 15]  # Note: ObjectID 5 deleted
        ]
    
        snapshots = lumenize.csvStyleArray_To_ArrayOfMaps(snapshotsCSV)
    
    Let's add our first aggregation specification. You can add virtual fields to the input rows by providing your own callback function.
    
        deriveFieldsOnInput = [
          {as: 'PercentRemaining', f: (row) -> 100 * row.TaskRemainingTotal / row.TaskEstimateTotal }
        ]
    
    You can have as many of these derived fields as you wish. They are calculated in order to it's OK to use an earlier
    derived field when calculating a later one.
    
    Next, we use the native fields in the snapshots, plus our derived field above to calculate most of the chart
    series. Sums and counts are bread and butter, but all Lumenize.functions functions are supported (standardDeviation,
    median, percentile coverage, etc.) and Lumenize includes some functions specifically well suited to burn chart
    calculations (filteredSum, and filteredCount) as we shall now demonstrate.
    
        acceptedValues = ['Accepted', 'Released']
    
        metrics = [
          {as: 'StoryCountBurnUp', f: 'filteredCount', filterField: 'ScheduleState', filterValues: acceptedValues},
          {as: 'StoryUnitBurnUp', field: 'PlanEstimate', f: 'filteredSum', filterField: 'ScheduleState', filterValues: acceptedValues},
          {as: 'StoryUnitScope', field: 'PlanEstimate', f: 'sum'},
          {as: 'StoryCountScope', f: 'count'},
          {as: 'TaskUnitBurnDown', field: 'TaskRemainingTotal', f: 'sum'},
          {as: 'TaskUnitScope', field: 'TaskEstimateTotal', f: 'sum'},
          {as: 'MedianPercentRemaining', field: 'PercentRemaining', f: 'median'}
        ]
    
    Let's break this down. The first series uses a `filteredCount` function. What this says is "count the number of items
    where the ScheduleState is either 'Accepted' or 'Released' and store that in a series named 'StoryCountBurnUp'. The
    second series is very similar but instead of counting, we are summing the PlanEstimate field and sticking it in
    the StoryUnitBurnUp series. The next four series are simple sums or counts (no filtering) and the final series
    is a gratuitous use of the 'median' function least you forget that it can do more than counts and sums.
    
    Next, we specify the summary metrics for the chart. We're not really interested in displaying any summary metrics for
    this chart but we need to calculate the max values of two of the existing series in order to add the two ideal line series.
    Notice how the summary metric for TaskUnitBurnDown_max_index uses an earlier summary metric. They are calculated
    in order and made avalable in the scope of the callback function to enable this.
    
        summaryMetricsConfig = [
          {field: 'TaskUnitScope', f: 'max'},
          {field: 'TaskUnitBurnDown', f: 'max'},
          {as: 'TaskUnitBurnDown_max_index', f: (seriesData, summaryMetrics) ->
            for row, index in seriesData
              if row.TaskUnitBurnDown is summaryMetrics.TaskUnitBurnDown_max
                return index
          }
        ]
    
    The calculations from the summary metrics above are passed into the calculations for 'deriveFieldsAfterSummary'.
    Here is where we calculate two alternatives for the burn down ideal line.
    
        deriveFieldsAfterSummary = [
          {as: 'Ideal', f: (row, index, summaryMetrics, seriesData) ->
            max = summaryMetrics.TaskUnitScope_max
            increments = seriesData.length - 1
            incrementAmount = max / increments
            return Math.floor(100 * (max - index * incrementAmount)) / 100
          },
          {as: 'Ideal2', f: (row, index, summaryMetrics, seriesData) ->
            if index < summaryMetrics.TaskUnitBurnDown_max_index
              return null
            else
              max = summaryMetrics.TaskUnitBurnDown_max
              increments = seriesData.length - 1 - summaryMetrics.TaskUnitBurnDown_max_index
              incrementAmount = max / increments
              return Math.floor(100 * (max - (index - summaryMetrics.TaskUnitBurnDown_max_index) * incrementAmount)) / 100
          }
        ]
    
    The two above series ignore the row values and simply key off of the index and summaryMetrics, but you could have
    used the row values to, for instance, add two existing series to create a third.
    
    Notice how the entire seriesData is available inside of your provided callback. This would allow you to derive a metric
    off of rows other than the current row like you would for a sliding-window calculation (Shewarts method).
    
    Just like all Lumenize Calculators, we can set holidays to be knocked out of the results.
    
        holidays = [
          {year: 2011, month: 1, day: 5}  # Made up holiday to test knockout
        ]
    
    Let's build the config Object from the above specifications and instantiate the calculator.
    
        config =
          deriveFieldsOnInput: deriveFieldsOnInput
          metrics: metrics
          summaryMetricsConfig: summaryMetricsConfig
          deriveFieldsAfterSummary: deriveFieldsAfterSummary
          granularity: lumenize.Time.DAY
          tz: 'America/Chicago'
          holidays: holidays
          workDays: 'Sunday,Monday,Tuesday,Wednesday,Thursday,Friday' # They work on Sundays
    
        calculator = new TimeSeriesCalculator(config)
    
    We can now send our snapshots into the calculator.
    
        startOnISOString = new Time('2011-01-02').getISOStringInTZ(config.tz)
        upToDateISOString = new Time('2011-01-10').getISOStringInTZ(config.tz)
        calculator.addSnapshots(snapshots, startOnISOString, upToDateISOString)
    
    Note, you must specify a startOnISOString and upToDateISOString. If you send in another round of snapshots, the new startOnISOString must match
    the upToDateISOString of the prior call to addSnapshots(). This is the key to  making sure that incremental calculations don't
    skip or double count anything. You can even send in the same snapshots in a later round and they won't be double
    counted. This idempotency property is also accomplished by the precise startOnISOString (current) upToDateISOString (prior) alignment.
    If you restore the calculator from a saved state, the upToDate property will contain the prior upToDateISOString. You can use
    this to compose a query that gets all of the snapshots necessary for the update. Just query with
    `_ValidTo: {$gte: upToDate}`. Note, this will refetch all the snapshots that were still active the last time
    you updated the calculator. This is expected and necessary.
    
    Let's print out our results and see what we have.
    
        keys = ['label', 'StoryUnitScope', 'StoryCountScope', 'StoryCountBurnUp',
          'StoryUnitBurnUp', 'TaskUnitBurnDown', 'TaskUnitScope', 'Ideal', 'Ideal2', 'MedianPercentRemaining']
    
        csv = lumenize.arrayOfMaps_To_CSVStyleArray(calculator.getResults().seriesData, keys)
    
        console.log(csv.slice(1))
        #  [ [ '2011-01-02', 13, 3, 0, 0, 37, 32, 51, null, 100 ],
        #    [ '2011-01-03', 18, 4, 0, 0, 44, 47, 42.5, 44, 100 ],
        #    [ '2011-01-04', 20, 5, 1, 5, 25, 51, 34, 35.2, 41.666666666666664 ],
        #    [ '2011-01-06', 20, 5, 2, 8, 16, 51, 25.5, 26.4, 41.666666666666664 ],
        #    [ '2011-01-07', 18, 4, 3, 13, 3, 47, 17, 17.59, 0 ],
        #    [ '2011-01-09', 18, 4, 3, 13, 3, 47, 8.5, 8.79, 0 ],
        #    [ '2011-01-10', 18, 4, 3, 13, 3, 47, 0, 0, 0 ] ]
    
    ## Time-series group-by example ##
    
        allowedValues = ['Ready to pull', 'In progress', 'In test', 'Accepted', 'Released']
    
    It supports both count and sum for group-by metrics
    
        metrics = [
          {f: 'groupBySum', field: 'PlanEstimate', groupByField: 'ScheduleState', allowedValues: allowedValues},
          {f: 'groupByCount', groupByField: 'ScheduleState', allowedValues: allowedValues, prefix: 'Count '},
          {as: 'MedianTaskRemainingTotal', field: 'TaskRemainingTotal', f: 'median'}  # An example of how you might overlay a line series
        ]
    
        holidays = [
          {year: 2011, month: 1, day: 5}  # Made up holiday to test knockout
        ]
    
        config =  # default workDays
          metrics: metrics
          granularity: Time.DAY
          tz: 'America/Chicago'
          holidays: holidays
          workDays: 'Sunday,Monday,Tuesday,Wednesday,Thursday,Friday' # They work on Sundays
    
        calculator = new TimeSeriesCalculator(config)
    
        startOnISOString = new Time('2010-12-31').getISOStringInTZ(config.tz)
        upToDateISOString = new Time('2011-01-09').getISOStringInTZ(config.tz)
        calculator.addSnapshots(snapshots, startOnISOString, upToDateISOString)
    
    Here is the output of the sum metrics
    
        keys = ['label'].concat(allowedValues)
        csv = lumenize.arrayOfMaps_To_CSVStyleArray(calculator.getResults().seriesData, keys)
        console.log(csv.slice(1))
        # [ [ '2010-12-31', 5, 0, 0, 0, 0 ],
        #   [ '2011-01-02', 8, 5, 0, 0, 0 ],
        #   [ '2011-01-03', 10, 8, 0, 0, 0 ],
        #   [ '2011-01-04', 7, 0, 8, 5, 0 ],
        #   [ '2011-01-06', 2, 5, 5, 3, 5 ],
        #   [ '2011-01-07', 0, 0, 5, 5, 8 ],
        #   [ '2011-01-09', 0, 0, 5, 5, 8 ] ]
    
    Here is the output of the count metrics
    
        keys = ['label'].concat('Count ' + a for a in allowedValues)
        csv = lumenize.arrayOfMaps_To_CSVStyleArray(calculator.getResults().seriesData, keys)
        console.log(csv.slice(1))
        # [ [ '2010-12-31', 1, 0, 0, 0, 0 ],
        #   [ '2011-01-02', 2, 1, 0, 0, 0 ],
        #   [ '2011-01-03', 2, 2, 0, 0, 0 ],
        #   [ '2011-01-04', 2, 0, 2, 1, 0 ],
        #   [ '2011-01-06', 1, 1, 1, 1, 1 ],
        #   [ '2011-01-07', 0, 0, 1, 1, 2 ],
        #   [ '2011-01-09', 0, 0, 1, 1, 2 ] ]
    
    We didn't output the MedianTaskRemainingTotal metric but it's in there. I included it to demonstrate that you can
    calculate non-group-by series along side group-by series.
    */

    function TimeSeriesCalculator(config) {
      /*
      @constructor
      @param {Object} config
      @cfg {String} tz The timezone for analysis
      @cfg {String} [validFromField = "_ValidFrom"]
      @cfg {String} [validToField = "_ValidTo"]
      @cfg {String} [uniqueIDField = "ObjectID"]
      @cfg {String} granularity 'month', 'week', 'quarter', 'day', etc. Use Time.MONTH, Time.WEEK, etc.
      @cfg {String[]/String} [workDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']] List of days of the week that you work on. You can specify this as an Array of Strings
         (['Monday', 'Tuesday', ...]) or a single comma seperated String ("Monday,Tuesday,...").
      @cfg {Object[]} [holidays] An optional Array containing rows that are either ISOStrings or JavaScript Objects
        (mix and match). Example: `[{month: 12, day: 25}, {year: 2011, month: 11, day: 24}, "2012-12-24"]`
         Notice how you can leave off the year if the holiday falls on the same day every year.
      @cfg {Object} [workDayStartOn] An optional object in the form {hour: 8, minute: 15}. If minute is zero it can be omitted.
         If workDayStartOn is later than workDayEndBefore, then it assumes that you work the night shift and your work
         hours span midnight. If tickGranularity is "hour" or finer, you probably want to set this; if tickGranularity is
         "day" or coarser, probably not.
      @cfg {Object} [workDayEndBefore] An optional object in the form {hour: 17, minute: 0}. If minute is zero it can be omitted.
         The use of workDayStartOn and workDayEndBefore only make sense when the granularity is "hour" or finer.
         Note: If the business closes at 5:00pm, you'll want to leave workDayEndBefore to 17:00, rather
         than 17:01. Think about it, you'll be open 4:59:59.999pm, but you'll be closed at 5:00pm. This also makes all of
         the math work. 9am to 5pm means 17 - 9 = an 8 hour work day.
      
      @cfg {Object[]} [metrics=[]] Array which specifies the metrics to calculate for tick in time.
      
        Example:
      
          config = {}
          config.metrics = [
            {field: 'field3'},                                      # defaults to metrics: ['sum']
            {field: 'field4', metrics: [
              {f: 'sum'},                                           # will add a metric named field4_sum
              {as: 'median4', f: 'p50'},                            # renamed p50 to median4 from default of field4_p50
              {as: 'myCount', f: (values) -> return values.length}  # user-supplied function
            ]}
          ]
      
        If you specify a field without any metrics, it will assume you want the sum but it will not automatically
        add the sum metric to fields with a metrics specification. User-supplied aggregation functions are also supported as
        shown in the 'myCount' metric above.
      
        Note, if the metric has dependencies (e.g. average depends upon count and sum) it will automatically add those to
        your metric definition. If you've already added a dependency but put it under a different "as", it's not smart
        enough to sense that and it will add it again. Either live with the duplication or leave
        dependency metrics named their default by not providing an "as" field.
      @cfg {Object[]} [deriveFieldsOnInput] An Array of Maps in the form `{field:'myField', f:(fact)->...}`
      @cfg {Object[]} [deriveFieldsOnOutput] same format at deriveFieldsOnInput, except the callback is in the form `f(row)`
        This is only called for dirty rows that were effected by the latest round of additions in an incremental calculation.
      @cfg {Object[]} [summaryMetricsConfig] Allows you to specify a list of metrics to calculate on the results before returning.
        These can either be in the form of `{as: 'myMetric', field: 'field4', f:'sum'}` which would extract all of the values
        for field `field4` and pass it as the values parameter to the `f` (`sum` in this example) function (from Lumenize.functions), or
        it can be in the form of `{as: 'myMetric', f:(seriesData, summaryMetrics) -> ...}`. Note, they are calculated
        in order, so you can use the result of an earlier summaryMetric to calculate a later one.
      @cfg {Object[]} [deriveFieldsAfterSummary] same format at deriveFieldsOnInput, except the callback is in the form `f(row, index, summaryMetrics, seriesData)`
        This is called on all rows every time you call getResults() so it's less efficient than deriveFieldsOnOutput. Only use it if you need
        the summaryMetrics in your calculation.
      @cfg {Object} [projectionsConfig] Allows you to project series into the future
      
        Example:
      
          projectionsConfig = {
            limit: 100  # optional, defaults to 300
            continueWhile: (point) ->  # Optional but recommended
              return point.StoryCountScope_projection > point.StoryCountBurnUp_projection
            minFractionToConsider: 1.0 / 2.0  # optional, defaults to 1/3
            minCountToConsider: 3  # optional, defaults to 15
            series: [
              {as: 'ScopeProjection', field: 'StoryUnitScope', slope: 0.5},
              {field: 'StoryCountScope', slope: 0},  # 0 slope is a level projection
              {field: 'StoryCountBurnUp'},  # Will use v-Optimal (least squares of difference in angle / count)
              {field: 'field5', startIndex: 0}  # 0 will use entire series. Add grab-handle to allow user to specify some other index
            ]
          }
      
        When a projectionsConfig is provided, the TimeSeriesCalculator will add points to the output seriesData showing
        the series being projected. These projected series will always start at the last point of the series and go out from there.
        By default, they are named the same as the series (field) they are projecting with '_projection' concatenated onto the end.
        However, this name can be overridden by using the `as` field of the series configuration.
      
        In addition to adding to the dataSeries, a summary of the projection is provided in the `projections` sub-field
        returned when you call `getResults()`. The format of this sub-field is something like this:
      
          projections = {
            "limit": 100,
            "series": [
              {"as": "ScopeProjection", "field": "StoryUnitScope", "slope": 0.5},
              {"field": "StoryCountScope", "slope": 0},
              {"field": "StoryCountBurnUp", "startIndex": 0, "slope": 0.6},
              {"field": "field5", "startIndex": 0, "slope": 0.123259838293}
            ],
            "minFractionToConsider": 0.5,
            "minCountToConsider": 3,
            "pointsAddedCount": 6,
            "lastPoint": {
              "tick": "2011-01-17T06:00:00.000Z",
              "label": "2011-01-16",
              "ScopeProjection": 21,
              "StoryCountScope_projection": 4,
              "StoryCountBurnUp_projection": 6.6
            }
          }
      
        You can inspect this returned Object to see what slope it used for each series. Also, if you were not
        rendering a chart but just wanted to use this calculator to make a holiday-knockout-precise forecast, you could
        inspect the `lastPoint.tick` field to identify when this work is forecast to finish.
      
        One thing to keep in mind when using this functionality is that these calculators in general and these projections
        in particular, is that the x-axis is a complex Timeline of ticks rather than simple linear calander time.
        So, these projections will take into account any holidays specified in the future.
      
        The `projectionsConfig` is a fairly complicated configuration in its own right. It is embedded in the config object
        for the overall TimeSeriesCalculator but it has a bunch of sub-configuration also. The five top level items are:
        `limit`, `continueWhile`, `minFractionToConsider`, `minCountToConsider`, and `series`.
      
        `limit` and `continueWhile`
        are used to control how far in the future the projection will go. It will stop at `limit` even if the `continueWhile`
        is always met. This will prevent the projection from becoming an infinite loop. The `continueWhile` predicate
        is technically not required but in almost all cases you will not know how far into the future you want to go
        so you will have to use it.
      
        `minFractionToConsider` and `minCountToConsider` are used for series where you allow the calculator to find
        the optimal starting point for the projection (the default behavior). It's very common for projects to start out slowly and then ramp up.
        The optimal algorithm is designed to find this knee where the difference in angle of the projection is the minimum
        of the square of the difference between the overall angle and all the sub-angles between this starting point going up to the point before
        the last point. This minimum is also divided by the number of points so using more data points for the projection
        is favored over using fewer. These two configuration parameters, `minFractionToConsider`, and `minCountToConsider`
        tell the v-optimal algorthim the minimum number or portion of points to consider. This prevents the algorithm
        from just using the angle of the last few points if they happen to be v-optimal. They currently default to the max of 1/3rd of the project or
        15 (3 work weeks if granularity is 'days'). Note, that the `minCountToConsider` default is optimized for
        granularity of 'days'. If you were to use granularity of weeks, I would suggest a much lower number like 3 to 5.
        If you were to use granularity of 'months' then maybe 2-3 months would suffice.
      
        The `series` sub-config is similar to the main series config, with a required `field` field and an optional
        `as` field. The remaining two possible fields (`startIndex` and `slope`) are both optional. They are also mutually
        exclusive with the `slope` trumping the `startIndex` in cases where both are mistakenly provided.
        If both are ommitted, then the projection will attempt to find the optimal starting point for the projection using the
        algorithm described above.
      
        If the `slope` is specified, it will override any `startingIndex` specification. You will commonly set this
        to 0 for scope series where you want the projection to only consider the current scope. If you set this manually,
        be sure to remember that the "run" (slope = rise / run) is ticks along the x-axis (holidays and weekends knocked out),
        not true calendar time. Also, note that in the output
        (`getResults().projections.series`), the slope will always be set even if you did not specify one in your original
        configuration. The startIndex or optimal (default) behaviors operate by setting this slope.
      
        The `startingIndex` is specified if you want to tell the projection from what point in time, the projection should
        start. Maybe the project doubled staff 3 months into the project and you want the projection to start from there.
        The common usage for this functionality is to provide a grab-handle on the chart and allow the user to use his
        insight combined with the visualization of the data series to pick his own optimal starting point. Note, if you
        specify a `startingIndex` you should not specify a `slope` and vice-versa.
      
        Note, that if you specify a `startIndex` or one is derived for you using the optimal algorithm, then the projection
        series will reach back into the seriesData to this startIndex. If you are using HighCharts, you will want to set
        connectNulls to true for projection series that have a startIndex. Projection series where you specify a `slope`
        start at the end of the dataSeries and only project into the future.
      
      @cfg {String/ISOString/Date/Lumenize.Time} [startOn=-infinity] This becomes the master startOn for the entire calculator limiting
        the calculator to only emit ticks equal to this or later.
      @cfg {String/ISOString/Date/Lumenize.Time} [endBefore=infinity] This becomes the master endBefore for the entire calculator
        limiting the calculator to only emit ticks before this.
      */

      var a, dimensions, f, field, fieldsMap, filterValue, filteredCountCreator, filteredSumCreator, inputCubeDimensions, inputCubeMetrics, m, newMetrics, row, ticks, timeline, timelineConfig, tl, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _len5, _m, _n, _ref1, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7;
      this.config = utils.clone(config);
      this.tickToLabelLookup = {};
      if (this.config.validFromField == null) {
        this.config.validFromField = "_ValidFrom";
      }
      if (this.config.validToField == null) {
        this.config.validToField = "_ValidTo";
      }
      if (this.config.uniqueIDField == null) {
        this.config.uniqueIDField = "ObjectID";
      }
      utils.assert(this.config.tz != null, "Must provide a timezone to this calculator.");
      utils.assert(this.config.granularity != null, "Must provide a granularity to this calculator.");
      newMetrics = [];
      _ref1 = this.config.metrics;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        a = _ref1[_i];
        if ((_ref2 = a.f) === 'groupBySum' || _ref2 === 'groupByCount') {
          if (a.prefix == null) {
            a.prefix = '';
          }
          _ref3 = a.allowedValues;
          for (_j = 0, _len1 = _ref3.length; _j < _len1; _j++) {
            filterValue = _ref3[_j];
            row = {
              as: a.prefix + filterValue,
              filterField: a.groupByField,
              filterValues: [filterValue]
            };
            if (a.f === 'groupBySum') {
              row.field = a.field;
              row.f = 'filteredSum';
            } else {
              row.f = 'filteredCount';
            }
            newMetrics.push(row);
          }
        } else {
          newMetrics.push(a);
        }
      }
      this.config.metrics = newMetrics;
      filteredCountCreator = function(filterField, filterValues) {
        var f;
        f = function(row) {
          var _ref4;
          if (_ref4 = row[filterField], __indexOf.call(filterValues, _ref4) >= 0) {
            return 1;
          } else {
            return 0;
          }
        };
        return f;
      };
      filteredSumCreator = function(field, filterField, filterValues) {
        var f;
        f = function(row) {
          var _ref4;
          if (_ref4 = row[filterField], __indexOf.call(filterValues, _ref4) >= 0) {
            return row[field];
          } else {
            return 0;
          }
        };
        return f;
      };
      _ref4 = this.config.metrics;
      for (_k = 0, _len2 = _ref4.length; _k < _len2; _k++) {
        a = _ref4[_k];
        if ((_ref5 = a.f) === 'filteredCount' || _ref5 === 'filteredSum') {
          if (a.f === 'filteredCount') {
            f = filteredCountCreator(a.filterField, a.filterValues);
          } else {
            f = filteredSumCreator(a.field, a.filterField, a.filterValues);
          }
          if (a.as == null) {
            throw new Error("Must provide `as` specification for a `" + a.f + "` metric.");
          }
          if (this.config.deriveFieldsOnInput == null) {
            this.config.deriveFieldsOnInput = [];
          }
          this.config.deriveFieldsOnInput.push({
            as: a.as,
            f: f
          });
          a.f = 'sum';
          a.field = a.as;
        }
      }
      inputCubeDimensions = [
        {
          field: this.config.uniqueIDField
        }, {
          field: 'tick'
        }
      ];
      fieldsMap = {};
      _ref6 = this.config.metrics;
      for (_l = 0, _len3 = _ref6.length; _l < _len3; _l++) {
        m = _ref6[_l];
        if (m.field != null) {
          fieldsMap[m.field] = true;
        }
      }
      inputCubeMetrics = [];
      for (field in fieldsMap) {
        inputCubeMetrics.push({
          field: field,
          f: 'firstValue',
          as: field
        });
      }
      this.inputCubeConfig = {
        dimensions: inputCubeDimensions,
        metrics: inputCubeMetrics,
        deriveFieldsOnInput: this.config.deriveFieldsOnInput
      };
      dimensions = [
        {
          field: 'tick'
        }
      ];
      this.cubeConfig = {
        dimensions: dimensions,
        metrics: this.config.metrics,
        deriveFieldsOnOutput: this.config.deriveFieldsOnOutput
      };
      this.toDateCubeConfig = utils.clone(this.cubeConfig);
      this.toDateCubeConfig.deriveFieldsOnInput = this.config.deriveFieldsOnInput;
      this.cube = new OLAPCube(this.cubeConfig);
      this.upToDateISOString = null;
      if (this.config.summaryMetricsConfig != null) {
        _ref7 = this.config.summaryMetricsConfig;
        for (_m = 0, _len4 = _ref7.length; _m < _len4; _m++) {
          m = _ref7[_m];
          functions.expandFandAs(m);
        }
      }
      if (config.startOn != null) {
        this.masterStartOnTime = new Time(config.startOn, this.config.granularity, this.config.tz);
      } else {
        this.masterStartOnTime = new Time('BEFORE_FIRST', this.config.granularity);
      }
      if (config.endBefore != null) {
        this.masterEndBeforeTime = new Time(config.endBefore, this.config.granularity, this.config.tz);
      } else {
        this.masterEndBeforeTime = new Time('PAST_LAST', this.config.granularity);
      }
      if ((config.startOn != null) && (config.endBefore != null)) {
        timelineConfig = utils.clone(this.config);
        timelineConfig.startOn = this.masterStartOnTime;
        timelineConfig.endBefore = this.masterEndBeforeTime;
        timeline = new Timeline(timelineConfig);
        ticks = timeline.getAll('Timeline', this.config.tz, this.config.granularity);
        for (_n = 0, _len5 = ticks.length; _n < _len5; _n++) {
          tl = ticks[_n];
          this.tickToLabelLookup[tl.endBefore.getISOStringInTZ(config.tz)] = tl.startOn.toString();
        }
      }
    }

    TimeSeriesCalculator.prototype.addSnapshots = function(snapshots, startOnISOString, upToDateISOString) {
      /*
      @method addSnapshots
        Allows you to incrementally add snapshots to this calculator.
      @chainable
      @param {Object[]} snapshots An array of temporal data model snapshots.
      @param {String} startOnISOString A ISOString (e.g. '2012-01-01T12:34:56.789Z') indicating the time start of the period of
        interest. On the second through nth call, this should equal the previous upToDateISOString.
      @param {String} upToDateISOString A ISOString (e.g. '2012-01-01T12:34:56.789Z') indicating the moment just past the time
        period of interest.
      @return {TimeInStateCalculator}
      */

      var advanceOneTimeline, advanceOneTimelineConfig, advanceOneTimelineIterator, endBeforeTime, inputCube, s, startOnTime, ticks, timeline, timelineConfig, tl, validSnapshots, _i, _j, _k, _len, _len1, _len2, _ref1;
      if (this.upToDateISOString != null) {
        utils.assert(this.upToDateISOString === startOnISOString, "startOnISOString (" + startOnISOString + ") parameter should equal upToDateISOString of previous call (" + this.upToDateISOString + ") to addSnapshots.");
      }
      this.upToDateISOString = upToDateISOString;
      advanceOneTimelineConfig = utils.clone(this.config);
      advanceOneTimelineConfig.startOn = new Time(upToDateISOString, this.config.granularity, this.config.tz);
      delete advanceOneTimelineConfig.endBefore;
      advanceOneTimelineConfig.limit = 2;
      advanceOneTimeline = new Timeline(advanceOneTimelineConfig);
      advanceOneTimelineIterator = advanceOneTimeline.getIterator();
      advanceOneTimelineIterator.next();
      endBeforeTime = advanceOneTimelineIterator.next();
      timelineConfig = utils.clone(this.config);
      startOnTime = new Time(startOnISOString, this.config.granularity, this.config.tz);
      if (startOnTime.greaterThan(this.masterStartOnTime)) {
        timelineConfig.startOn = startOnTime;
      } else {
        timelineConfig.startOn = this.masterStartOnTime;
      }
      if (endBeforeTime.lessThan(this.masterEndBeforeTime)) {
        timelineConfig.endBefore = endBeforeTime;
      } else {
        timelineConfig.endBefore = this.masterEndBeforeTime;
      }
      this.asOfISOString = timelineConfig.endBefore.getISOStringInTZ(this.config.tz);
      timeline = new Timeline(timelineConfig);
      ticks = timeline.getAll('Timeline', this.config.tz, this.config.granularity);
      for (_i = 0, _len = ticks.length; _i < _len; _i++) {
        tl = ticks[_i];
        this.tickToLabelLookup[tl.endBefore.getISOStringInTZ(this.config.tz)] = tl.startOn.toString();
      }
      validSnapshots = [];
      for (_j = 0, _len1 = snapshots.length; _j < _len1; _j++) {
        s = snapshots[_j];
        ticks = timeline.ticksThatIntersect(s[this.config.validFromField], s[this.config.validToField], this.config.tz);
        if (ticks.length > 0) {
          s.tick = ticks;
          validSnapshots.push(s);
        }
      }
      inputCube = new OLAPCube(this.inputCubeConfig, validSnapshots);
      this.cube.addFacts(inputCube.getCells());
      if (true || this.masterEndBeforeTime.greaterThanOrEqual(endBeforeTime)) {
        this.toDateSnapshots = [];
        for (_k = 0, _len2 = snapshots.length; _k < _len2; _k++) {
          s = snapshots[_k];
          if ((s[this.config.validToField] > (_ref1 = this.asOfISOString) && _ref1 >= s[this.config.validFromField])) {
            this.toDateSnapshots.push(s);
          }
        }
      } else {
        this.toDateSnapshots = void 0;
      }
      return this;
    };

    TimeSeriesCalculator.prototype.getResults = function() {
      /*
      @method getResults
        Returns the current state of the calculator
      @return {Object[]} Returns an Array of Maps like `{<uniqueIDField>: <id>, ticks: <ticks>, lastValidTo: <lastValidTo>}`
      */

      var as, cell, d, foundFirstNullCell, highestIndexAllowed, highestIndexAllowed1, highestIndexAllowed2, index, labels, lastIndex, lastPoint, lastTick, m, pointsAddedCount, projectedPoint, projectionSeries, projectionTimeline, projectionTimelineConfig, projectionTimelineIterator, projections, row, s, seriesData, startIndex, startOn, startPoint, summaryMetric, summaryMetrics, t, tick, tickIndex, ticks, toDateCell, toDateCube, values, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _len5, _len6, _len7, _len8, _len9, _m, _n, _o, _p, _q, _r, _ref1, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8;
      ticks = utils._.keys(this.tickToLabelLookup).sort();
      labels = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = ticks.length; _i < _len; _i++) {
          t = ticks[_i];
          _results.push(this.tickToLabelLookup[t]);
        }
        return _results;
      }).call(this);
      if ((this.toDateSnapshots != null) && this.toDateSnapshots.length > 0) {
        _ref1 = this.toDateSnapshots;
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          s = _ref1[_i];
          s.tick = 'To Date';
        }
        toDateCube = new OLAPCube(this.toDateCubeConfig, this.toDateSnapshots);
        toDateCell = toDateCube.getCells()[0];
        delete toDateCell._count;
      }
      seriesData = [];
      foundFirstNullCell = false;
      for (tickIndex = _j = 0, _len1 = ticks.length; _j < _len1; tickIndex = ++_j) {
        t = ticks[tickIndex];
        cell = utils.clone(this.cube.getCell({
          tick: t
        }));
        if (cell != null) {
          delete cell._count;
        } else {
          startOn = new Time(labels[tickIndex]).getISOStringInTZ(this.config.tz);
          if (toDateCell && (startOn < (_ref2 = this.asOfISOString) && _ref2 <= t)) {
            cell = toDateCell;
          } else {
            cell = {};
            _ref3 = this.config.metrics;
            for (_k = 0, _len2 = _ref3.length; _k < _len2; _k++) {
              m = _ref3[_k];
              cell[m.as] = null;
            }
          }
          cell.tick = t;
        }
        cell.label = this.tickToLabelLookup[cell.tick];
        seriesData.push(cell);
      }
      summaryMetrics = {};
      if (this.config.summaryMetricsConfig != null) {
        _ref4 = this.config.summaryMetricsConfig;
        for (_l = 0, _len3 = _ref4.length; _l < _len3; _l++) {
          summaryMetric = _ref4[_l];
          if (summaryMetric.field != null) {
            values = [];
            for (_m = 0, _len4 = seriesData.length; _m < _len4; _m++) {
              row = seriesData[_m];
              values.push(row[summaryMetric.field]);
            }
            summaryMetrics[summaryMetric.as] = summaryMetric.f(values);
          } else {
            summaryMetrics[summaryMetric.as] = summaryMetric.f(seriesData, summaryMetrics);
          }
        }
      }
      if (this.config.deriveFieldsAfterSummary != null) {
        for (index = _n = 0, _len5 = seriesData.length; _n < _len5; index = ++_n) {
          row = seriesData[index];
          _ref5 = this.config.deriveFieldsAfterSummary;
          for (_o = 0, _len6 = _ref5.length; _o < _len6; _o++) {
            d = _ref5[_o];
            row[d.as] = d.f(row, index, summaryMetrics, seriesData);
          }
        }
      }
      projections = {};
      if (this.config.projectionsConfig != null) {
        projections = utils.clone(this.config.projectionsConfig);
        lastIndex = seriesData.length - 1;
        lastPoint = seriesData[lastIndex];
        lastTick = lastPoint.tick;
        _ref6 = projections.series;
        for (_p = 0, _len7 = _ref6.length; _p < _len7; _p++) {
          projectionSeries = _ref6[_p];
          as = projectionSeries.as || projectionSeries.field + "_projection";
          lastPoint[as] = lastPoint[projectionSeries.field];
        }
        _ref7 = projections.series;
        for (_q = 0, _len8 = _ref7.length; _q < _len8; _q++) {
          projectionSeries = _ref7[_q];
          if (projectionSeries.slope == null) {
            if (projectionSeries.startIndex == null) {
              if (projections.minFractionToConsider == null) {
                projections.minFractionToConsider = 1.0 / 3.0;
              }
              if (projections.minCountToConsider == null) {
                projections.minCountToConsider = 15;
              }
              highestIndexAllowed1 = Math.floor((1 - projections.minFractionToConsider) * seriesData.length) - 1;
              highestIndexAllowed2 = seriesData.length - 1 - projections.minCountToConsider;
              highestIndexAllowed = Math.min(highestIndexAllowed1, highestIndexAllowed2);
              if (highestIndexAllowed < 1) {
                projectionSeries.startIndex = 0;
              } else {
                projectionSeries.startIndex = TimeSeriesCalculator._findVOptimalProjectionStartIndex(seriesData, projectionSeries.field, highestIndexAllowed);
              }
            }
            startIndex = projectionSeries.startIndex;
            startPoint = seriesData[startIndex];
            as = projectionSeries.as || projectionSeries.field + "_projection";
            startPoint[as] = startPoint[projectionSeries.field];
            projectionSeries.slope = (lastPoint[projectionSeries.field] - startPoint[projectionSeries.field]) / (lastIndex - startIndex);
          }
        }
        projectionTimelineConfig = utils.clone(this.config);
        projectionTimelineConfig.startOn = new Time(lastTick, this.config.granularity, this.config.tz);
        delete projectionTimelineConfig.endBefore;
        projectionTimelineConfig.limit = projections.limit || 300;
        projectionTimeline = new Timeline(projectionTimelineConfig);
        projectionTimelineIterator = projectionTimeline.getIterator('Timeline');
        pointsAddedCount = 0;
        projectedPoint = null;
        while (projectionTimelineIterator.hasNext() && ((projectedPoint == null) || ((projections.continueWhile == null) || projections.continueWhile(projectedPoint)))) {
          pointsAddedCount++;
          projectedPoint = {};
          tick = projectionTimelineIterator.next();
          projectedPoint.tick = tick.endBefore.getISOStringInTZ(this.config.tz);
          projectedPoint.label = tick.startOn.toString();
          _ref8 = projections.series;
          for (_r = 0, _len9 = _ref8.length; _r < _len9; _r++) {
            projectionSeries = _ref8[_r];
            as = projectionSeries.as || projectionSeries.field + "_projection";
            projectedPoint[as] = lastPoint[projectionSeries.field] + pointsAddedCount * projectionSeries.slope;
          }
          seriesData.push(projectedPoint);
        }
        projections.pointsAddedCount = pointsAddedCount;
        projections.lastPoint = projectedPoint;
      }
      return {
        seriesData: seriesData,
        summaryMetrics: summaryMetrics,
        projections: projections
      };
    };

    TimeSeriesCalculator._findVOptimalProjectionStartIndex = function(seriesData, field, highestIndexAllowed) {
      var calculateTotalErrorSquared, errorSquared, i, indexForMinNormalizedErrorSquared, lastIndex, lastPoint, minNormalizedErrorSquared, normalizedErrorSquared, slopeToEnd, _i,
        _this = this;
      utils.assert(highestIndexAllowed < seriesData.length - 2, "Cannot use the last two points for calculating v-optimal slope.");
      lastIndex = seriesData.length - 1;
      lastPoint = seriesData[lastIndex];
      slopeToEnd = function(index) {
        return (lastPoint[field] - seriesData[index][field]) / (lastIndex - index);
      };
      calculateTotalErrorSquared = function(index) {
        var currentAngle, currentSlope, error, i, totalErrorSquared, trialAngle, trialSlope, _i, _ref1, _ref2;
        trialSlope = slopeToEnd(index);
        trialAngle = Math.atan(trialSlope);
        totalErrorSquared = 0;
        for (i = _i = _ref1 = index + 1, _ref2 = lastIndex - 1; _ref1 <= _ref2 ? _i <= _ref2 : _i >= _ref2; i = _ref1 <= _ref2 ? ++_i : --_i) {
          currentSlope = slopeToEnd(i);
          currentAngle = Math.atan(currentSlope);
          error = trialAngle - currentAngle;
          totalErrorSquared += error * error;
        }
        return totalErrorSquared;
      };
      minNormalizedErrorSquared = Number.MAX_VALUE;
      indexForMinNormalizedErrorSquared = highestIndexAllowed;
      for (i = _i = highestIndexAllowed; highestIndexAllowed <= 0 ? _i <= 0 : _i >= 0; i = highestIndexAllowed <= 0 ? ++_i : --_i) {
        errorSquared = calculateTotalErrorSquared(i);
        normalizedErrorSquared = errorSquared / (seriesData.length - 2 - i);
        if (normalizedErrorSquared <= minNormalizedErrorSquared) {
          minNormalizedErrorSquared = normalizedErrorSquared;
          indexForMinNormalizedErrorSquared = i;
        }
      }
      return indexForMinNormalizedErrorSquared;
    };

    TimeSeriesCalculator.prototype.getStateForSaving = function(meta) {
      /*
      @method getStateForSaving
        Enables saving the state of this calculator. See class documentation for a detailed example.
      @param {Object} [meta] An optional parameter that will be added to the serialized output and added to the meta field
        within the deserialized calculator.
      @return {Object} Returns an Ojbect representing the state of the calculator. This Object is suitable for saving to
        to an object store. Use the static method `newFromSavedState()` with this Object as the parameter to reconstitute
        the calculator.
      */

      var out;
      out = {
        config: this.config,
        cubeSavedState: this.cube.getStateForSaving(),
        upToDateISOString: this.upToDateISOString
      };
      if (meta != null) {
        out.meta = meta;
      }
      return out;
    };

    TimeSeriesCalculator.newFromSavedState = function(p) {
      /*
      @method newFromSavedState
        Deserializes a previously saved calculator and returns a new calculator. See class documentation for a detailed example.
      @static
      @param {String/Object} p A String or Object from a previously saved state
      @return {TimeInStateCalculator}
      */

      var calculator;
      if (utils.type(p) === 'string') {
        p = JSON.parse(p);
      }
      calculator = new TimeSeriesCalculator(p.config);
      calculator.cube = OLAPCube.newFromSavedState(p.cubeSavedState);
      calculator.upToDateISOString = p.upToDateISOString;
      if (p.meta != null) {
        calculator.meta = p.meta;
      }
      return calculator;
    };

    return TimeSeriesCalculator;

  })();

  exports.TimeSeriesCalculator = TimeSeriesCalculator;

}).call(this);

});

require.define("/src/histogram.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var functions, getBucketCountMinMax, histogram, justHereForDocsAndDoctest, roundDownToSignificance, roundUpToSignificance, setParameters, utils;

  functions = require('./functions').functions;

  utils = require('tztime').utils;

  histogram = {};

  justHereForDocsAndDoctest = function() {
    /*
    @class histogram
    
    This module has functionality that will allow you to create histograms and do bucketing.
    
    Features:
    
      * Three bucketing strategies:
        1. constant width (default)
        2. constant depth - for an example of using this mode, look at the source code for the `bucketPercentile()` function
        3. [v-optimal](http://en.wikipedia.org/wiki/V-optimal_histograms)
      * Two operating modes modes:
        1. Automatic. Call histogram with data and all of your parameters and out pops a histogram.
        2. Piecemeal. Create buckets, put data into buckets, generate histograms from data and pre-calculated buckets.
           Sometimes you are less interested in the histogram than you are in the bucketing.
    
    Let's walk through some examples of both modes. But first a general discussion about how these functions accept raw data.
    
    ## Getting data into the histogram functions ##
    
    We have two ways to define data. We can pass in an Array of Objects and specify the field to use.
    
        grades = [
          {name: 'Joe', average: 105},
          {name: 'Jeff', average: 104.9}, # ...
    
        ]
    
        {histogram} = require('../')
        h = histogram.histogram(grades, 'average')
    
        console.log(h)
        # [ { index: 0, startOn: null, endBelow: null, label: 'all', count: 2 } ]
    
    Or, we can just pass in a list of values
    
        grades = [105, 104.9, 99, 98.7, 85, 78, 54, 98, 78, 20]
        h = histogram.histogram(grades)
        console.log((row.label + ': ' + row.count for row in h))
        # [ '< 41.25: 1', '41.25-62.5: 1', '62.5-83.75: 2', '>= 83.75: 6' ]
    
    ## Automatic histogram creation ##
    
    The above examples for the two ways of getting data into the histogram functions also demonstrates the use of
    automatic histogram creation. There are additional parameters to this function that allow you to control the
    type of bucketing (constantWidth, constantDepth, etc.), min and max values, significance of the bucket boundaries, etc.
    See the individual functions for details on these parameters.
    
    ## Piecemeal usage ##
    
    Sometimes you don't actually want a histogram. You want a way to create constantWidth or constantDepth or v-optimal buckets
    and you want a tool to know which bucket a particular value falls into. The cannonical example of this is for calculating
    percentiles for standardized testing... or for grading on a curve. The documentation for the `percentileBuckets()`
    function walks you through an example like this.
    */

  };

  getBucketCountMinMax = function(values) {
    var max, min, targetBucketCount;
    targetBucketCount = Math.floor(Math.sqrt(values.length)) + 1;
    if (targetBucketCount < 3) {
      targetBucketCount = 2;
    }
    min = functions.min(values);
    max = functions.max(values);
    return {
      targetBucketCount: targetBucketCount,
      min: min,
      max: max
    };
  };

  roundUpToSignificance = function(value, significance) {
    var multiple;
    if (significance == null) {
      return value;
    }
    multiple = 1 / significance;
    return Math.ceil(value * multiple) / multiple;
  };

  roundDownToSignificance = function(value, significance) {
    var multiple;
    if (significance == null) {
      return value;
    }
    multiple = 1 / significance;
    return Math.floor(value * multiple) / multiple;
  };

  setParameters = function(rows, valueField, firstStartOn, lastEndBelow, bucketCount, significance) {
    var lowerBase, max, min, row, targetBucketCount, upperBase, values, _ref;
    if (valueField != null) {
      values = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = rows.length; _i < _len; _i++) {
          row = rows[_i];
          _results.push(row[valueField]);
        }
        return _results;
      })();
    } else {
      values = rows;
    }
    _ref = getBucketCountMinMax(values), targetBucketCount = _ref.targetBucketCount, min = _ref.min, max = _ref.max;
    if (bucketCount == null) {
      bucketCount = targetBucketCount;
    }
    if (firstStartOn != null) {
      lowerBase = firstStartOn;
    } else {
      lowerBase = roundDownToSignificance(min, significance);
      firstStartOn = null;
    }
    if (lastEndBelow != null) {
      upperBase = lastEndBelow;
    } else {
      upperBase = roundUpToSignificance(max, significance);
      lastEndBelow = null;
    }
    return {
      values: values,
      bucketCount: bucketCount,
      firstStartOn: firstStartOn,
      lowerBase: lowerBase,
      lastEndBelow: lastEndBelow,
      upperBase: upperBase
    };
  };

  histogram.bucketsConstantWidth = function(rows, valueField, significance, firstStartOn, lastEndBelow, bucketCount) {
    var bucket, bucketSize, buckets, edge, i, lastEdge, lowerBase, upperBase, values, _i, _ref, _ref1;
    _ref = setParameters(rows, valueField, firstStartOn, lastEndBelow, bucketCount, significance), values = _ref.values, bucketCount = _ref.bucketCount, firstStartOn = _ref.firstStartOn, lowerBase = _ref.lowerBase, lastEndBelow = _ref.lastEndBelow, upperBase = _ref.upperBase;
    buckets = [];
    if (bucketCount < 3) {
      bucket = {
        index: 0,
        startOn: firstStartOn,
        endBelow: lastEndBelow,
        label: 'all'
      };
      buckets.push(bucket);
      return buckets;
    }
    bucketSize = roundDownToSignificance((upperBase - lowerBase) / bucketCount, significance);
    if (bucketSize <= 0) {
      throw new Error("Calculated bucketSizes <= 0 are not allowed. Try a smaller significance.");
    }
    lastEdge = lowerBase + bucketSize;
    bucket = {
      index: 0,
      startOn: firstStartOn,
      endBelow: lastEdge
    };
    buckets.push(bucket);
    for (i = _i = 1, _ref1 = bucketCount - 2; 1 <= _ref1 ? _i <= _ref1 : _i >= _ref1; i = 1 <= _ref1 ? ++_i : --_i) {
      edge = lastEdge + bucketSize;
      buckets.push({
        index: i,
        startOn: lastEdge,
        endBelow: edge
      });
      lastEdge = edge;
    }
    if ((lastEdge != null) && (lastEndBelow != null) && lastEdge >= lastEndBelow) {
      throw new Error("Somehow, the last bucket didn't work out. Try a smaller significance. lastEdge: " + lastEdge + "  lastEndBelow: " + lastEndBelow);
    }
    bucket = {
      index: bucketCount - 1,
      startOn: lastEdge,
      endBelow: lastEndBelow
    };
    buckets.push(bucket);
    return buckets;
  };

  histogram.bucketsConstantDepth = function(rows, valueField, significance, firstStartOn, lastEndBelow, bucketCount) {
    var bucket, bucketSize, buckets, currentBoundary, i, lastBoundary, lowerBase, upperBase, values, _i, _ref, _ref1;
    _ref = setParameters(rows, valueField, firstStartOn, lastEndBelow, bucketCount, significance), values = _ref.values, bucketCount = _ref.bucketCount, firstStartOn = _ref.firstStartOn, lowerBase = _ref.lowerBase, lastEndBelow = _ref.lastEndBelow, upperBase = _ref.upperBase;
    if (bucketCount < 3) {
      bucket = {
        index: 0,
        startOn: firstStartOn,
        endBelow: lastEndBelow
      };
      buckets.push(bucket);
      return buckets;
    }
    bucketSize = 100 / bucketCount;
    buckets = [];
    currentBoundary = roundDownToSignificance(functions.percentileCreator(bucketSize)(values), significance);
    bucket = {
      index: 0,
      startOn: firstStartOn,
      endBelow: currentBoundary
    };
    buckets.push(bucket);
    for (i = _i = 1, _ref1 = bucketCount - 2; 1 <= _ref1 ? _i <= _ref1 : _i >= _ref1; i = 1 <= _ref1 ? ++_i : --_i) {
      lastBoundary = currentBoundary;
      currentBoundary = roundDownToSignificance(functions.percentileCreator(bucketSize * (i + 1))(values), significance);
      buckets.push({
        index: i,
        startOn: lastBoundary,
        endBelow: currentBoundary
      });
    }
    if ((lastBoundary != null) && (lastEndBelow != null) && lastBoundary >= lastEndBelow) {
      throw new Error("Somehow, the last bucket didn't work out. Try a different bucketCount.");
    }
    bucket = {
      index: bucketCount - 1,
      startOn: currentBoundary,
      endBelow: lastEndBelow
    };
    buckets.push(bucket);
    return buckets;
  };

  histogram.bucketsPercentile = function(rows, valueField) {
    /*
    @method bucketsPercentile
    
    This is a short cut to creating a set of buckets for "scoring" in percentiles (think standardized testing).
    
    Note: You can't score in the 100th percentile because you can't beat your own score.
    If you have a higher score than anybody else, you didn't beat your own score. So, you aren't better than 100%. If there are
    less than 100 total scores then you technically can't even be in the 99th percentile. This function is hard-coded
    to only create 100 buckets. However, if you wanted to calculate fractional percentiles. Say you want to know who
    is in the 99.9th percentile, then you could simulate that yourself by calling bucketsConstantDepth with 1000 as
    the bucketCount parameter.
    
    Let's say you are a teacher and you only give out A's, B's, C's, and F's. Let's say you
    want the top 10% to get an A. This should only be one student, no matter what he scores. The next 30% of students
    to get a B. The next 50% of students to get a C and the last 10% to get an F (again, only 1 student). So with 10 students,
    the final distribution of grades will be this:
    
      * A: 1
      * B: 3
      * C: 5
      * F: 1
      * Total: 10
    
    Let's say you have these grades:
    
        grades = [
          {name: 'Joe', average: 105},    # 1 A 90th percentile and above
          {name: 'Jeff', average: 104.9}, # 1 B 60th percentile and above
          {name: 'John', average: 92},    # 2
          {name: 'Jess', average: 90},    # 3
          {name: 'Joseph', average: 87},  # 1 C 10th percentile and above
          {name: 'Julie', average: 87},   # 2
          {name: 'Juan', average: 75},    # 3
          {name: 'Jill', average: 73},    # 4
          {name: 'Jon', average: 71},     # 5
          {name: 'Jorge', average: 32}    # 1 F rest
        ]
    
    Now, let's create the percentile buckets for this by calling bucketsPercentile.
    
        {histogram} = require('../')
        buckets = histogram.bucketsPercentile(grades, 'average')
    
    Let's create a little helper function to convert the percentiles to grades. It includes a call to `histogram.bucket`.
    
        getGrade = (average, buckets) ->
          percentile = histogram.bucket(average, buckets).percentileHigherIsBetter
          if percentile >= 90
            return 'A'
          else if percentile >= 60
            return 'B'
          else if percentile >= 10
            return 'C'
          else
            return 'F'
    
    Now, if we loop over this and call getGrade, we can print out the final grade for each student.
    
        for student in grades
          console.log(student.name, getGrade(student.average, buckets))
    
        # Joe A
        # Jeff B
        # John B
        # Jess B
        # Joseph C
        # Julie C
        # Juan C
        # Jill C
        # Jon C
        # Jorge F
    
    @static
    @param {Object[]/Number[]} rows If no valueField is provided or the valueField parameter is null, then the first parameter is
    assumed to be an Array of Numbers representing the values to bucket. Otherwise, it is assumed to be an Array of Objects
    with a bunch of fields.
    
    @return {Object[]}
    
    Returns an Array of Objects (buckets) in the form of {index, startOn, endBelow, label, percentileHigherIsBetter, percentileLowerIsBetter}
    
    To convert a value into a percentile call `histogram.bucket(value, bucketsFromCallToBucketsPercentile)` and
    then read the percentileHigherIsBetter or percentileLowerIsBetter of the bucket that is returned.
    */

    var b, buckets, percentile, _i, _len;
    buckets = histogram.buckets(rows, valueField, histogram.bucketsConstantDepth, null, null, null, 100);
    percentile = 0;
    for (_i = 0, _len = buckets.length; _i < _len; _i++) {
      b = buckets[_i];
      if (b.matchingRangeIndexEnd != null) {
        b.percentileHigherIsBetter = b.matchingRangeIndexStart;
        b.percentileLowerIsBetter = 99 - b.matchingRangeIndexEnd;
        percentile = b.matchingRangeIndexEnd;
        delete b.matchingRangeIndexEnd;
        delete b.matchingRangeIndexStart;
      } else {
        b.percentileHigherIsBetter = percentile;
        b.percentileLowerIsBetter = 99 - percentile;
      }
      percentile++;
    }
    return buckets;
  };

  histogram.buckets = function(rows, valueField, type, significance, firstStartOn, lastEndBelow, bucketCount) {
    var bucket, buckets, currentBucket, gotToEnd, i, index, startOfMatching, tempBuckets, _i, _len;
    if (type == null) {
      type = histogram.bucketsConstantWidth;
    }
    /*
    @method buckets
    @static
    @param {Object[]/Number[]} rows If no valueField is provided or the valueField parameter is null, then the first parameter is
    assumed to be an Array of Numbers representing the values to bucket. Otherwise, it is assumed to be an Array of Objects
    with a bunch of fields.
    @param {String} [valueField] Specifies the field containing the values to calculate the histogram on
    @param {function} [type = histogram.constantWidth] Specifies how to pick the edges of the buckets. Three standard schemes
      are provided: histogram.bucketsConstantWidth, histogram.bucketsConstantDepth, and histogram.bucketsVOptimal.
      You could inject your own but this function simply calls that so you may as well just create the buckets yourself.
    @param {Number} [significance] The multiple to which you want to round the bucket edges. 1 means whole numbers.
     0.1 means to round to tenths. 0.01 to hundreds. Etc. If you provide all of these last four parameters, ensure
     that (lastEndBelow - firstStartOn) / bucketCount will naturally come out in the significance specified. So,
     (100 - 0) / 100 = 1. This works well with a significance of 1, 0.1, 0.01, etc. But (13 - 0) / 10  = 1.3. This
     would not work with a significance of 1. However, a signficance of 0.1 would work fine.
    
    @param {Number} [firstStartOn] This will be the startOn of the first bucket. Think of it as the min value.
    @param {Number} [lastEndBelow] This will be the endBelow of the last bucket. Think of it as the max value.
    @param {Number} [bucketCount] If provided, the histogram will have this many buckets.
    @return {Object[]}
    
    Returns an Array of Objects (buckets) in the form of {index, startOn, endBelow, label}
    
    The buckets array that is returned will have these properties:
    
    * Each bucket (row) will have these fields {index, startOn, endBelow, label}.
    * Duplicate buckets are merged. When they are merged two fields are added to the resulting merged bucket:
      {matchingRangeIndexStart, matchingRangeIndexEnd} indicating the range that this bucket replaces.
    * If firstStartOn is not provided, it will be null indicating -Infinity
    * If lastEndBelow is not provided, it will be null indicating Infinity.
    */

    tempBuckets = type(rows, valueField, significance, firstStartOn, lastEndBelow, bucketCount);
    if (tempBuckets.length < 2) {
      buckets = tempBuckets;
    } else {
      buckets = [];
      startOfMatching = tempBuckets[0];
      gotToEnd = false;
      i = 1;
      while (i < tempBuckets.length) {
        currentBucket = tempBuckets[i];
        if (startOfMatching.startOn === currentBucket.startOn) {
          i++;
          currentBucket = tempBuckets[i];
          while ((currentBucket != null) && startOfMatching.startOn === currentBucket.startOn && startOfMatching.endBelow === currentBucket.endBelow) {
            i++;
            currentBucket = tempBuckets[i];
          }
          if (i >= tempBuckets.length - 1) {
            currentBucket = tempBuckets[tempBuckets.length - 1];
            gotToEnd = true;
          }
          startOfMatching.matchingRangeIndexStart = startOfMatching.index;
          startOfMatching.matchingRangeIndexEnd = currentBucket.index;
          startOfMatching.endBelow = currentBucket.endBelow;
          buckets.push(startOfMatching);
          i++;
          currentBucket = tempBuckets[i];
        } else {
          buckets.push(startOfMatching);
        }
        startOfMatching = currentBucket;
        i++;
      }
      if (!gotToEnd) {
        buckets.push(currentBucket);
      }
    }
    for (index = _i = 0, _len = buckets.length; _i < _len; index = ++_i) {
      bucket = buckets[index];
      bucket.index = index;
      if ((bucket.startOn != null) && (bucket.endBelow != null)) {
        bucket.label = "" + bucket.startOn + "-" + bucket.endBelow;
      } else if (bucket.startOn != null) {
        bucket.label = ">= " + bucket.startOn;
      } else if (bucket.endBelow != null) {
        bucket.label = "< " + bucket.endBelow;
      } else {
        bucket.label = "all";
      }
    }
    return buckets;
  };

  histogram.bucket = function(value, buckets) {
    /*
    @method bucket
    @static
    @param {Number} value The value to bucket
    @param {Object[]} buckets Array of objects where each row is in the form {index, startOn, endBelow, label}
    @return {Object}
    
    Returns the bucket that contains the given value unless the data fits in none of the buckets, in which case, it returns
    `null`.
    
    Note: With default parameters, the buckets generated by this module will cover -Infinity to Infinity, (i.e. all
    possible values). However, if you hand generate your own buckets or you use firstStartOn or lastEndBelow parameters,
    when calling histogram.buckets, then it's possible for values to fall into no buckets.
    You can effectively use this as a way to filter out outliers or unexpected
    negative values. Also note that the firstStartOn (min) is inclusive, but the lastEndBelow (max) is exclusive. If
    you set the lastEndBelow to 100, then no values of 100 will get bucketed. You can't score in the 100th percentile
    because you can't beat your own score. This is simlar logic.
    */

    var b, i, _i, _ref;
    if (value == null) {
      return null;
    }
    if (buckets.length >= 3) {
      for (i = _i = 1, _ref = buckets.length - 2; 1 <= _ref ? _i <= _ref : _i >= _ref; i = 1 <= _ref ? ++_i : --_i) {
        b = buckets[i];
        if ((b.startOn <= value && value < b.endBelow)) {
          return b;
        }
      }
    }
    b = buckets[0];
    if ((b.startOn != null) && (b.endBelow != null)) {
      if ((b.startOn <= value && value < b.endBelow)) {
        return b;
      }
    } else if (b.startOn != null) {
      if (b.startOn <= value) {
        return b;
      }
    } else if (b.endBelow != null) {
      if (value < b.endBelow) {
        return b;
      }
    } else if ((b.startOn == null) && (b.endBelow == null)) {
      return b;
    }
    b = buckets[buckets.length - 1];
    if (b.endBelow != null) {
      if ((b.startOn <= value && value < b.endBelow)) {
        return b;
      }
    } else {
      if (b.startOn <= value) {
        return b;
      }
    }
    return null;
  };

  histogram.histogramFromBuckets = function(rows, valueField, buckets) {
    /*
    @method histogramFromBuckets
    @static
    @param {Object[]/Number[]} rows If no valueField is provided or the valueField parameter is null, then the first parameter is
     assumed to be an Array of Numbers representing the values to bucket. Otherwise, it is assumed to be an Array of Objects
     with a bunch of fields.
    @param {String} valueField Specifies the field containing the values to calculate the histogram on
    @param {Object[]} buckets Array of Objects as output from a get...Buckets() function. Each row {index, startOn, endBelow, label}
    @return {Object[]}
    
    Returns a histogram from rows using the provided buckets. See histogram.histogram() for details on the returned Array.
    */

    var bucket, h, histogramRow, row, v, values, _i, _j, _len, _len1;
    if (valueField != null) {
      values = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = rows.length; _i < _len; _i++) {
          row = rows[_i];
          _results.push(row[valueField]);
        }
        return _results;
      })();
    } else {
      values = rows;
    }
    h = utils.clone(buckets);
    for (_i = 0, _len = h.length; _i < _len; _i++) {
      histogramRow = h[_i];
      histogramRow.count = 0;
    }
    for (_j = 0, _len1 = values.length; _j < _len1; _j++) {
      v = values[_j];
      bucket = histogram.bucket(v, buckets);
      if (bucket != null) {
        h[bucket.index].count++;
      }
    }
    return h;
  };

  histogram.histogram = function(rows, valueField, type, significance, firstStartOn, lastEndBelow, bucketCount) {
    var buckets;
    if (type == null) {
      type = histogram.constantWidth;
    }
    /*
    @method histogram
    @static
    @param {Object[]/Number[]} rows If no valueField is provided or the valueField parameter is null, then the first parameter is
     assumed to be an Array of Numbers representing the values to bucket. Otherwise, it is assumed to be an Array of Objects
     with a bunch of fields.
    @param {String} [valueField] Specifies the field containing the values to calculate the histogram on
    @param {function} [type = histogram.constantWidth] Specifies how to pick the edges of the buckets. Three standard schemes
      are provided: histogram.bucketsConstantWidth, histogram.bucketsConstantDepth, and histogram.bucketsVOptimal.
      However, you can inject your own.
    @param {Number} [significance] The multiple to which you want to round the bucket edges. 1 means whole numbers.
     0.1 means to round to tenths. 0.01 to hundreds. Etc. If you provide all of these last four parameters, ensure
     that (lastEndBelow - firstStartOn) / bucketCount will naturally come out in the significance specified. So,
     (100 - 0) / 100 = 1. This works well with a significance of 1, 0.1, 0.01, etc. But (13 - 0) / 10  = 1.3. This
     would not work with a significance of 1. However, a signficance of 0.1 would work fine.
    @param {Number} [firstStartOn] This will be the startOn of the first bucket.
    @param {Number} [lastEndBelow] This will be the endBelow of the last bucket. Think of it as the max value.
    @param {Number} [bucketCount] If provided, the histogram will have this many buckets.
    @return {Object[]}
    
    Returns an Array of Objects (buckets) in the form of {index, startOn, endBelow, label, count} where count is the
    number of values in each bucket.
    
    Note: With default parameters, the buckets will cover -Infinity to Infinity, (i.e. all
    possible values). However, if firstStartOn or lastEndBelow are provided, then any values that you pass in that
    fall outside of this range will be ignored. You can effectively use this as a way to filter out outliers or unexpected
    negative values. Also note that the firstStartOn (min) is inclusive, but the lastEndBelow (max) is exclusive. If
    you set the lastEndBelow to 100, then no values of 100 will get counted. You can't score in the 100th percentile
    because you can't beat your own score. This is simlar logic.
    */

    buckets = histogram.buckets(rows, valueField, type, significance, firstStartOn, lastEndBelow, bucketCount);
    return histogram.histogramFromBuckets(rows, valueField, buckets);
  };

  histogram.clipping = function(rows, valueField, noClipping) {
    var b, bucket, bucketCount, bucketSize, buckets, c, chartMax, chartValues, chartValuesMinusOutliers, clipped, i, iqr, max, percentile, q1, q3, row, total, upperBound, valueMax, _i, _j, _k, _l, _len, _len1, _len2;
    if (noClipping == null) {
      noClipping = false;
    }
    /*
    @method clipping
    @static
    
    Note: The calling pattern and functionality of this method is legacy and a bit different from the other members of
    this histogram module. I just haven't yet had the opportunity to upgrade it to the new pattern.
    
    This histogram function is designed to work with data that is zero bound on the low end and might have outliers
    on the high end. It's not very general purpose but it's ideal for distributions that have a long-fat-tail.
    
    @param {Object[]} rows
    @param {String} valueField Specifies the field containing the values to calculate the histogram on
    @param {Boolean} [noClipping = false] If set to true, then it will not create a non-linear band for the outliers. The
     default behavior (noClipping = false) is to lump together outliers into a single bucket at the top.
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
    
        {buckets, chartMax} = histogram.clipping(rows, 'age')
        for b in buckets
          console.log(b.label, b.count)
        # 0-12 2
        # 12-24 5
        # 24-36 8
        # 36-48 1
        # 48-60 1
    
        console.log(chartMax)
        # 60
    
    This histogram calculator will also attempt to lump outliers into a single bucket at the top.
    
        rows.push({age: 85})
    
        {buckets, chartMax} = histogram.clipping(rows, 'age')
    
        lastBucket = buckets[buckets.length - 1]
        console.log(lastBucket.label, lastBucket.count)
        # 48-86* 2
    
    The asterix `*` is there to indicate that this bucket is not the same size as the others and non-linear.
    The histogram calculator will also "clip" the values for these outliers so that you can
    display them in a scatter chart on a linear scale with the last band compressed.
    The `clippedChartValue` will be guaranteed to be below the `chartMax` by interpolating it's position between
    the bounds of the top band where the actual max value is scaled down to the `chartMax`
    
        lastBucket = buckets[buckets.length - 1]
        console.log(lastBucket.rows[1].age, lastBucket.rows[1].clippedChartValue)
        # 85 59.68421052631579
    */

    if (valueField != null) {
      chartValues = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = rows.length; _i < _len; _i++) {
          row = rows[_i];
          _results.push(row[valueField]);
        }
        return _results;
      })();
    } else {
      chartValues = rows;
    }
    max = functions.max(chartValues);
    max = Math.max(max, 1);
    if (noClipping) {
      upperBound = max;
      chartValuesMinusOutliers = chartValues;
    } else {
      q3 = functions.percentileCreator(75)(chartValues);
      q1 = functions.percentileCreator(25)(chartValues);
      iqr = q3 - q1;
      upperBound = q3 + 1.5 * iqr;
      if (isNaN(upperBound) || upperBound > max) {
        upperBound = max;
      }
      chartValuesMinusOutliers = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = chartValues.length; _i < _len; _i++) {
          c = chartValues[_i];
          if (c <= upperBound) {
            _results.push(c);
          }
        }
        return _results;
      })();
    }
    bucketCount = Math.floor(Math.sqrt(chartValuesMinusOutliers.length));
    if (bucketCount < 3) {
      bucketCount = 2;
    }
    bucketSize = Math.floor(upperBound / bucketCount) + 1;
    upperBound = bucketSize * bucketCount;
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
      if (isNaN(percentile)) {
        b.percentile = 0;
      } else {
        b.percentile = percentile;
      }
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

require.define("/src/multiRegression.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var multiRegression, predict;

  multiRegression = {};

  multiRegression.calculateA = function(data) {
    /*
    @method calculateA
      Calculates the coefficient matrix for gaussian elimination solution
    */

    var a, i, j, k, n, numOfVariables, _i, _j, _k, _ref, _ref1;
    numOfVariables = data[0].length;
    n = data.length;
    a = [];
    for (i = _i = 0, _ref = numOfVariables - 1; 0 <= _ref ? _i <= _ref : _i >= _ref; i = 0 <= _ref ? ++_i : --_i) {
      a.push([]);
      for (j = _j = 0; 0 <= numOfVariables ? _j <= numOfVariables : _j >= numOfVariables; j = 0 <= numOfVariables ? ++_j : --_j) {
        a[i].push(0);
        for (k = _k = 0, _ref1 = n - 1; 0 <= _ref1 ? _k <= _ref1 : _k >= _ref1; k = 0 <= _ref1 ? ++_k : --_k) {
          a[i][j] += (i === 0 ? 1 : data[k][i - 1]) * (j === 0 ? 1 : data[k][j - 1]);
        }
      }
    }
    return a;
  };

  multiRegression.swapRows = function(a, firstRowIndex, secondRowIndex) {
    var j, temp, _i, _ref, _results;
    _results = [];
    for (j = _i = 0, _ref = a[0].length - 1; 0 <= _ref ? _i <= _ref : _i >= _ref; j = 0 <= _ref ? ++_i : --_i) {
      temp = a[firstRowIndex][j];
      a[firstRowIndex][j] = a[secondRowIndex][j];
      _results.push(a[secondRowIndex][j] = temp);
    }
    return _results;
  };

  predict = function(data, inputs) {
    /*
    @method predict
    @param {[][]} data A two-dimensional array
    @param
    
    Returns a prediction of the output based upon historical data and input "estimates"
    The last column of the Data array is the value we are trying to predict. The other
    columns are the inputs.  The input array will order-wise coorespond to the first
    n-1 columns of the data array.
    
    @return {Object}
    
    returns {A, Beta, variance, prediction}
    */

  };

  exports.multiRegression = multiRegression;

}).call(this);

});

require.define("/src/table.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var table, utils;

  utils = require('tztime').utils;

  table = {};

  /*
  @class table
  */


  table.padToWidth = function(s, width, padCharacter, rightPad) {
    var padding;
    if (padCharacter == null) {
      padCharacter = ' ';
    }
    if (rightPad == null) {
      rightPad = false;
    }
    if (s.length > width) {
      return s.substr(0, width);
    }
    padding = new Array(width - s.length + 1).join(padCharacter);
    if (rightPad) {
      return s + padding;
    } else {
      return padding + s;
    }
  };

  table.toString = function(rows, fields, sortBy, descending) {
    var field, index, key, maxWidths, row, s, sortedRows, value, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _len5, _m, _n, _ref;
    if (descending == null) {
      descending = false;
    }
    /*
    @method toString
    @param {Object[]} rows
    @param {Object} [fields] If not provided, it will use the fields found in the first row
    @param {String} [sortBy] If provided, it will sort the table by this field before returning
    @param {Boolean} [descending = false] By default, the sort will be ascending, setting this to true will sort descending
    @return {String} Returns a string for the table in Markdown format
    
        t = [
          {col1: 'hello', col2: 12, col3: true},
          {col1: 'goodbye', col2: 120, col3: false},
          {col1: 'yep', col2: -23, col3: true},
        ]
    
        console.log(require('../').table.toString(t, null, 'col2', true))
        # | col1    | col2 | col3  |
        # | ------- | ---- | ----- |
        # | goodbye | 120  | false |
        # | hello   | 12   | true  |
        # | yep     | -23  | true  |
    */

    if (fields == null) {
      fields = [];
      _ref = rows[0];
      for (key in _ref) {
        value = _ref[key];
        fields.push(key);
      }
    }
    maxWidths = [];
    for (index = _i = 0, _len = fields.length; _i < _len; index = ++_i) {
      field = fields[index];
      maxWidths.push(field.length);
      for (_j = 0, _len1 = rows.length; _j < _len1; _j++) {
        row = rows[_j];
        maxWidths[index] = Math.max(maxWidths[index], row[field].toString().length);
      }
    }
    if (sortBy != null) {
      sortedRows = utils._.sortBy(rows, sortBy);
      if (descending) {
        sortedRows = sortedRows.reverse();
      }
    } else {
      sortedRows = rows;
    }
    s = '|';
    for (index = _k = 0, _len2 = fields.length; _k < _len2; index = ++_k) {
      field = fields[index];
      s += ' ';
      s += table.padToWidth(field, maxWidths[index], void 0, true) + ' |';
    }
    s += '\n|';
    for (index = _l = 0, _len3 = fields.length; _l < _len3; index = ++_l) {
      field = fields[index];
      s += ' ';
      s += table.padToWidth('', maxWidths[index], '-', true) + ' |';
    }
    for (_m = 0, _len4 = sortedRows.length; _m < _len4; _m++) {
      row = sortedRows[_m];
      s += '\n|';
      for (index = _n = 0, _len5 = fields.length; _n < _len5; index = ++_n) {
        field = fields[index];
        s += ' ';
        s += table.padToWidth(row[field].toString(), maxWidths[index], void 0, true) + ' |';
      }
    }
    return s;
  };

  exports.table = table;

}).call(this);

});

require.define("/src/anova.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var anova, correlate, fDist, functions, normInverseUpper, utils, _ref;

  utils = require('tztime').utils;

  functions = require('./functions').functions;

  _ref = require('./distributions').distributions, fDist = _ref.fDist, normInverseUpper = _ref.normInverseUpper;

  correlate = require('./correlate').correlate;

  anova = function(rawData, overallPredicate, field, groups, ci) {
    var bucket, buckets, data, errorDF, errorMS, errorSS, factorDF, factorF, factorMS, factorP, factorSS, group, histogram, i, index, multiplier, nTimesMeanSquared, overallMean, overallN, overallSum, overallSumSquares, pooledNumerator, pooledStandardDeviation, r, rSquared, rSquaredAdjusted, residual, residualPlot, residuals, row, totalDF, totalSS, value, xStdDev, xValues, y, yStdDev, yValues, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _len5, _len6, _len7, _m, _n, _o, _p, _q, _r, _ref1;
    if (ci == null) {
      ci = 0.95;
    }
    /*
    @param {Object} groups {label, predicate} This is modified as a side-effect of this function. Many properties are added.
    
    https://onlinecourses.science.psu.edu/stat414/node/218
    
    http://www.calvin.edu/~rpruim/courses/m243/F03/overheads/ANOVAf03.ppt
    */

    utils.assert((0 < ci && ci < 1.0), "ci must be between 0.0 and 1.0");
    if (overallPredicate != null) {
      data = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = rawData.length; _i < _len; _i++) {
          row = rawData[_i];
          if (overallPredicate(row) && (row[field] != null)) {
            _results.push(row);
          }
        }
        return _results;
      })();
    } else {
      data = rawData;
    }
    utils.assert(groups.length < data.length, 'After filtering with the overallPredicate, there were fewer rows in the dataset than there were groups');
    overallN = 0;
    overallSum = 0;
    overallSumSquares = 0;
    pooledNumerator = 0;
    for (_i = 0, _len = groups.length; _i < _len; _i++) {
      group = groups[_i];
      group.values = (function() {
        var _j, _len1, _results;
        _results = [];
        for (_j = 0, _len1 = data.length; _j < _len1; _j++) {
          row = data[_j];
          if (group.predicate(row)) {
            _results.push(row[field]);
          }
        }
        return _results;
      })();
      group.sum = functions.sum(group.values);
      group.n = group.values.length;
      group.sumSquares = functions.sumSquares(group.values);
      group.variance = functions.variance(group.values);
      group.standardDeviation = Math.sqrt(group.variance);
      group.mean = group.sum / group.n;
      overallN += group.n;
      overallSum += group.sum;
      overallSumSquares += group.sumSquares;
      pooledNumerator += (group.n - 1) * group.variance;
    }
    overallMean = overallSum / overallN;
    pooledStandardDeviation = Math.sqrt(pooledNumerator / (overallN - groups.length));
    multiplier = normInverseUpper((1.0 - ci) / 2);
    for (_j = 0, _len1 = groups.length; _j < _len1; _j++) {
      group = groups[_j];
      group.ciDelta = multiplier * pooledStandardDeviation / Math.sqrt(group.n);
    }
    residuals = [];
    for (_k = 0, _len2 = groups.length; _k < _len2; _k++) {
      group = groups[_k];
      _ref1 = group.values;
      for (_l = 0, _len3 = _ref1.length; _l < _len3; _l++) {
        value = _ref1[_l];
        residual = group.mean - value;
        residuals.push(residual);
      }
    }
    residuals = residuals.sort(function(a, b) {
      return a - b;
    });
    residualPlot = [];
    for (index = _m = 0, _len4 = residuals.length; _m < _len4; index = ++_m) {
      r = residuals[index];
      i = index + 1;
      if (i === 1) {
        y = 1 - Math.pow(0.5, 1 / residuals.length);
      } else if (i === residuals.length) {
        y = Math.pow(0.5, 1 / residuals.length);
      } else {
        y = (i - 0.3175) / (residuals.length + 0.365);
      }
      y = y - 0.5;
      if (y === 0) {
        y = 0;
      } else {
        y = Math.abs(y) * y;
      }
      residualPlot.push({
        x: r,
        y: y
      });
    }
    xValues = (function() {
      var _len5, _n, _results;
      _results = [];
      for (_n = 0, _len5 = residualPlot.length; _n < _len5; _n++) {
        r = residualPlot[_n];
        _results.push(r.x);
      }
      return _results;
    })();
    yValues = (function() {
      var _len5, _n, _results;
      _results = [];
      for (_n = 0, _len5 = residualPlot.length; _n < _len5; _n++) {
        r = residualPlot[_n];
        _results.push(r.y);
      }
      return _results;
    })();
    xStdDev = functions.standardDeviation(xValues);
    yStdDev = functions.standardDeviation(yValues);
    for (_n = 0, _len5 = residualPlot.length; _n < _len5; _n++) {
      r = residualPlot[_n];
      r.x = r.x / xStdDev;
      r.y = r.y / yStdDev;
    }
    buckets = {};
    for (bucket = _o = -2.5; -2.5 <= 2.5 ? _o <= 2.5 : _o >= 2.5; bucket = -2.5 <= 2.5 ? ++_o : --_o) {
      buckets[bucket] = 0;
    }
    for (_p = 0, _len6 = residualPlot.length; _p < _len6; _p++) {
      r = residualPlot[_p];
      bucket = Math.floor(r.y + 1.0) - 0.5;
      buckets[bucket] += 1;
    }
    histogram = [];
    for (bucket = _q = -2.5; -2.5 <= 2.5 ? _q <= 2.5 : _q >= 2.5; bucket = -2.5 <= 2.5 ? ++_q : --_q) {
      row = {
        label: "" + (-0.5 + bucket) + " to " + (0.5 + bucket),
        center: bucket,
        count: buckets[bucket]
      };
      histogram.push(row);
    }
    factorDF = groups.length - 1;
    errorDF = overallN - groups.length;
    totalDF = factorDF + errorDF;
    factorSS = 0;
    for (_r = 0, _len7 = groups.length; _r < _len7; _r++) {
      group = groups[_r];
      factorSS += group.n * group.mean * group.mean;
    }
    nTimesMeanSquared = overallN * overallMean * overallMean;
    factorSS -= nTimesMeanSquared;
    totalSS = overallSumSquares - nTimesMeanSquared;
    errorSS = totalSS - factorSS;
    factorMS = factorSS / factorDF;
    errorMS = errorSS / errorDF;
    factorF = factorMS / errorMS;
    factorP = fDist(factorDF, errorDF, factorF);
    rSquared = factorSS / totalSS;
    rSquaredAdjusted = Math.abs(1 - (1 - rSquared) * (overallN - 1) / (overallN - groups.length));
    return {
      factorDF: factorDF,
      factorSS: factorSS,
      factorMS: factorMS,
      factorF: factorF,
      factorP: factorP,
      errorDF: errorDF,
      errorSS: errorSS,
      errorMS: errorMS,
      totalDF: totalDF,
      totalSS: totalSS,
      rSquared: rSquared,
      rSquaredAdjusted: rSquaredAdjusted,
      residualPlot: residualPlot,
      histogram: histogram,
      pooledStandardDeviation: pooledStandardDeviation
    };
  };

  exports.anova = anova;

}).call(this);

});

require.define("/src/distributions.coffee",function(require,module,exports,__dirname,__filename,process,global){/*
JavaScript version from which this CoffeeScript version was derived by Ben Tilly <btilly@gmail.com>
which was derived from the Perl version by Michael Kospach <mike.perl@gmx.at>
both of which are licensed under the Perl Artistic License which allows linking from MIT licensed code.

Note: these are approximations good to 5 digits (which is good enough for almost every thing)

https://code.google.com/p/statistics-distributions-js/source/browse/trunk/statistics-distributions.js
*/


(function() {
  var distributions;

  distributions = {};

  distributions.fDist = function(n, m, x) {
    /*
    Upper probability of the F distribution
    */

    var a, b, i, p, p1, y, z;
    p = void 0;
    if (x <= 0) {
      p = 1;
    } else if (m % 2 === 0) {
      z = m / (m + n * x);
      a = 1;
      i = m - 2;
      while (i >= 2) {
        a = 1 + (n + i - 2) / i * z * a;
        i -= 2;
      }
      p = 1 - (Math.pow(1 - z, n / 2) * a);
    } else if (n % 2 === 0) {
      z = n * x / (m + n * x);
      a = 1;
      i = n - 2;
      while (i >= 2) {
        a = 1 + (m + i - 2) / i * z * a;
        i -= 2;
      }
      p = Math.pow(1 - z, m / 2) * a;
    } else {
      y = Math.atan2(Math.sqrt(n * x / m), 1);
      z = Math.pow(Math.sin(y), 2);
      a = (n === 1 ? 0 : 1);
      i = n - 2;
      while (i >= 3) {
        a = 1 + (m + i - 2) / i * z * a;
        i -= 2;
      }
      b = Math.PI;
      i = 2;
      while (i <= m - 1) {
        b *= (i - 1) / i;
        i += 2;
      }
      p1 = 2 / b * Math.sin(y) * Math.pow(Math.cos(y), m) * a;
      z = Math.pow(Math.cos(y), 2);
      a = (m === 1 ? 0 : 1);
      i = m - 2;
      while (i >= 3) {
        a = 1 + (i - 1) / i * z * a;
        i -= 2;
      }
      p = Math.max(0, p1 + 1 - 2 * y / Math.PI - 2 / Math.PI * Math.sin(y) * Math.cos(y) * a);
    }
    return p;
  };

  distributions.tInverseUpper = function($n, p) {
    var $a, $b, $c, $d, $delta, $e, $n1, $round, $u, $u2, $x, p1;
    if (p >= 1 || p <= 0) {
      throw new Error("Invalid p: p\n");
    }
    if (p === 0.5) {
      return 0;
    } else {
      if (p < 0.5) {
        return -_subt($n, 1 - p);
      }
    }
    $u = _subu(p);
    $u2 = Math.pow($u, 2);
    $a = ($u2 + 1) / 4;
    $b = ((5 * $u2 + 16) * $u2 + 3) / 96;
    $c = (((3 * $u2 + 19) * $u2 + 17) * $u2 - 15) / 384;
    $d = ((((79 * $u2 + 776) * $u2 + 1482) * $u2 - 1920) * $u2 - 945) / 92160;
    $e = (((((27 * $u2 + 339) * $u2 + 930) * $u2 - 1782) * $u2 - 765) * $u2 + 17955) / 368640;
    $x = $u * (1 + ($a + ($b + ($c + ($d + $e / $n) / $n) / $n) / $n) / $n);
    if ($n <= Math.pow(log10(p), 2) + 3) {
      $round = void 0;
      while (true) {
        p1 = _subtprob($n, $x);
        $n1 = $n + 1;
        $delta = (p1 - p) / Math.exp(($n1 * Math.log($n1 / ($n + $x * $x)) + Math.log($n / $n1 / 2 / Math.PI) - 1 + (1 / $n1 - 1 / $n) / 6) / 2);
        $x += $delta;
        $round = round_to_precision($delta, Math.abs(integer(log10(Math.abs($x)) - 4)));
        if (!($x && ($round !== 0))) {
          break;
        }
      }
    }
    return $x;
  };

  distributions.tDist = function($n, $x) {
    var $a, $b, $i, $w, $y, $z;
    $a = void 0;
    $b = void 0;
    $w = Math.atan2($x / Math.sqrt($n), 1);
    $z = Math.pow(Math.cos($w), 2);
    $y = 1;
    $i = $n - 2;
    while ($i >= 2) {
      $y = 1 + ($i - 1) / $i * $z * $y;
      $i -= 2;
    }
    if ($n % 2 === 0) {
      $a = Math.sin($w) / 2;
      $b = .5;
    } else {
      $a = ($n === 1 ? 0 : Math.sin($w) * Math.cos($w) / Math.PI);
      $b = .5 + $w / Math.PI;
    }
    return Math.max(0, 1 - $b - $a * $y);
  };

  distributions.normDist = function($x) {
    var $absx, $i, p;
    p = 0;
    $absx = Math.abs($x);
    if ($absx < 1.9) {
      p = Math.pow(1 + $absx * (.049867347 + $absx * (.0211410061 + $absx * (.0032776263 + $absx * (.0000380036 + $absx * (.0000488906 + $absx * .000005383))))), -16) / 2;
    } else if ($absx <= 100) {
      $i = 18;
      while ($i >= 1) {
        p = $i / ($absx + p);
        $i--;
      }
      p = Math.exp(-.5 * $absx * $absx) / Math.sqrt(2 * Math.PI) / ($absx + p);
    }
    if ($x < 0) {
      p = 1 - p;
    }
    return p;
  };

  distributions.normInverseUpper = function(p) {
    var $x, $y;
    $y = -Math.log(4 * p * (1 - p));
    $x = Math.sqrt($y * (1.570796288 + $y * (.03706987906 + $y * (-.8364353589e-3 + $y * (-.2250947176e-3 + $y * (.6841218299e-5 + $y * (0.5824238515e-5 + $y * (-.104527497e-5 + $y * (.8360937017e-7 + $y * (-.3231081277e-8 + $y * (.3657763036e-10 + $y * .6936233982e-12)))))))))));
    if (p > .5) {
      $x = -$x;
    }
    return $x;
  };

  distributions.normInverse = function(p) {
    return distributions.normInverseUpper(1 - p);
  };

  exports.distributions = distributions;

}).call(this);

});

require.define("/src/correlate.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var correlate;

  correlate = function(points, xField, yField) {
    var div, intercept, n, point, rSquared, slope, sumX, sumX2, sumXY, sumY, sumY2, _i, _len;
    if (xField == null) {
      xField = 'x';
    }
    if (yField == null) {
      yField = 'y';
    }
    n = points.length;
    sumX = 0;
    sumY = 0;
    sumXY = 0;
    sumX2 = 0;
    sumY2 = 0;
    for (_i = 0, _len = points.length; _i < _len; _i++) {
      point = points[_i];
      sumX += point[xField];
      sumY += point[yField];
      sumXY += point[xField] * point[yField];
      sumX2 += point[xField] * point[xField];
      sumY2 += point[yField] * point[yField];
    }
    div = (n * sumX2) - (sumX * sumX);
    intercept = ((sumY * sumX2) - (sumX * sumXY)) / div;
    slope = ((n * sumXY) - (sumX * sumY)) / div;
    rSquared = Math.pow((n * sumXY - sumX * sumY) / Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)), 2);
    return {
      intercept: intercept,
      slope: slope,
      rSquared: rSquared
    };
  };

  exports.correlate = correlate;

}).call(this);

});

require.define("/src/DataFlow.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var DataFlow, utils;

  utils = require('tztime').utils;

  DataFlow = (function() {
    function DataFlow(userConfig, callback) {
      var c, _i, _len, _ref;
      this.userConfig = userConfig;
      this.callback = callback;
      this.config = utils.clone(this.userConfig);
      _ref = this.config;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        c = _ref[_i];
        c.allDependencies = [];
        if (c.parameters != null) {
          DataFlow._addDependencies(c.allDependencies, c.parameters);
        }
        if (c.triggerParameters != null) {
          DataFlow._addDependencies(c.allDependencies, c.triggerParameters);
        }
        if (c.addDataParameters != null) {
          DataFlow._addDependencies(c.allDependencies, c.c.addDataParameters);
        }
      }
    }

    DataFlow._addDependencies = function(dependencies, parameters) {
      var dependency, p, _i, _len, _results;
      _results = [];
      for (_i = 0, _len = parameters.length; _i < _len; _i++) {
        p = parameters[_i];
        if (utils.type(p) === 'string' && utils.startsWith(p, '@')) {
          dependency = p.split('.')[0].substring(1);
          _results.push(dependencies.push(dependency));
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    return DataFlow;

  })();

  exports.DataFlow = DataFlow;

}).call(this);

});

require.define("/src/Classifier.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var BayesianClassifier, Classifier, JSON, OLAPCube, functions, utils,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  functions = require('./functions').functions;

  utils = require('tztime').utils;

  OLAPCube = require('./OLAPCube').OLAPCube;

  JSON = require('JSON2');

  Classifier = (function() {
    function Classifier() {}

    /*
    @class Classifier
    
    __Base class for all Classifiers__
    
    See individual subclasses for usage details
    */


    Classifier.getBucketCountMinMax = function(values) {
      var max, min, targetBucketCount;
      targetBucketCount = Math.floor(Math.sqrt(values.length)) + 1;
      if (targetBucketCount < 3) {
        throw new Error("Need more training data");
      }
      min = functions.min(values);
      max = functions.max(values);
      return {
        targetBucketCount: targetBucketCount,
        min: min,
        max: max
      };
    };

    Classifier.generateConstantWidthBucketer = function(values) {
      var bucketSize, bucketer, i, max, min, targetBucketCount, _i, _ref, _ref1;
      _ref = Classifier.getBucketCountMinMax(values), targetBucketCount = _ref.targetBucketCount, min = _ref.min, max = _ref.max;
      bucketSize = (max - min) / targetBucketCount;
      bucketer = [];
      bucketer.push({
        value: 'B' + 0,
        startOn: null,
        endBelow: min + bucketSize
      });
      for (i = _i = 1, _ref1 = targetBucketCount - 2; 1 <= _ref1 ? _i <= _ref1 : _i >= _ref1; i = 1 <= _ref1 ? ++_i : --_i) {
        bucketer.push({
          value: 'B' + i,
          startOn: min + bucketSize * i,
          endBelow: min + bucketSize * (i + 1)
        });
      }
      bucketer.push({
        value: 'B' + (targetBucketCount - 1),
        startOn: min + bucketSize * (targetBucketCount - 1),
        endBelow: null
      });
      return bucketer;
    };

    Classifier.generateConstantQuantityBucketer = function(values) {
      var bucketSize, bucketer, currentBoundary, i, lastBoundary, max, min, targetBucketCount, _i, _ref, _ref1;
      _ref = Classifier.getBucketCountMinMax(values), targetBucketCount = _ref.targetBucketCount, min = _ref.min, max = _ref.max;
      bucketSize = 100 / targetBucketCount;
      bucketer = [];
      currentBoundary = functions.percentileCreator(bucketSize)(values);
      bucketer.push({
        value: 'B' + 0,
        startOn: null,
        endBelow: currentBoundary
      });
      for (i = _i = 1, _ref1 = targetBucketCount - 2; 1 <= _ref1 ? _i <= _ref1 : _i >= _ref1; i = 1 <= _ref1 ? ++_i : --_i) {
        lastBoundary = currentBoundary;
        currentBoundary = functions.percentileCreator(bucketSize * (i + 1))(values);
        bucketer.push({
          value: 'B' + i,
          startOn: lastBoundary,
          endBelow: currentBoundary
        });
      }
      bucketer.push({
        value: 'B' + (targetBucketCount - 1),
        startOn: currentBoundary,
        endBelow: null
      });
      return bucketer;
    };

    Classifier.splitAt = function(values, index) {
      var left, right;
      left = values.slice(0, index);
      right = values.slice(index);
      return {
        left: left,
        right: right
      };
    };

    Classifier.optimalSplitFor2Buckets = function(values) {
      var bestIndex, bestLeft, bestRight, bestTotalErrorSquared, i, left, right, splitAt, totalErrorSquared, _i, _ref, _ref1;
      bestIndex = 1;
      bestTotalErrorSquared = Number.MAX_VALUE;
      for (i = _i = 1, _ref = values.length - 1; 1 <= _ref ? _i <= _ref : _i >= _ref; i = 1 <= _ref ? ++_i : --_i) {
        _ref1 = Classifier.splitAt(values, i), left = _ref1.left, right = _ref1.right;
        totalErrorSquared = functions.errorSquared(left) + functions.errorSquared(right);
        if (totalErrorSquared < bestTotalErrorSquared) {
          bestTotalErrorSquared = totalErrorSquared;
          bestIndex = i;
          bestLeft = left;
          bestRight = right;
        }
      }
      splitAt = (values[bestIndex - 1] + values[bestIndex]) / 2;
      return {
        splitAt: splitAt,
        left: bestLeft,
        right: bestRight
      };
    };

    Classifier.areAllSame = function(values) {
      var firstValue, value, _i, _len;
      firstValue = values[0];
      for (_i = 0, _len = values.length; _i < _len; _i++) {
        value = values[_i];
        if (value !== firstValue) {
          return false;
        }
      }
      return true;
    };

    Classifier.findBucketSplits = function(currentSplits, values, targetBucketCount) {
      var left, right, splitAt, _ref;
      if (values.length < 5 || Classifier.areAllSame(values)) {
        return null;
      }
      _ref = Classifier.optimalSplitFor2Buckets(values), splitAt = _ref.splitAt, left = _ref.left, right = _ref.right;
      currentSplits.push(splitAt);
      if (currentSplits.length < targetBucketCount) {
        Classifier.findBucketSplits(currentSplits, left, targetBucketCount);
        Classifier.findBucketSplits(currentSplits, right, targetBucketCount);
      }
      return currentSplits;
    };

    Classifier.generateVOptimalBucketer = function(values) {
      var bucketer, currentBoundary, i, lastBoundary, max, min, splits, targetBucketCount, _i, _ref, _ref1;
      _ref = Classifier.getBucketCountMinMax(values), targetBucketCount = _ref.targetBucketCount, min = _ref.min, max = _ref.max;
      values.sort(function(a, b) {
        return a - b;
      });
      splits = [];
      Classifier.findBucketSplits(splits, values, targetBucketCount);
      splits.sort(function(a, b) {
        return a - b;
      });
      bucketer = [];
      currentBoundary = splits[0];
      bucketer.push({
        value: 'B' + 0,
        startOn: null,
        endBelow: currentBoundary
      });
      for (i = _i = 1, _ref1 = splits.length - 1; 1 <= _ref1 ? _i <= _ref1 : _i >= _ref1; i = 1 <= _ref1 ? ++_i : --_i) {
        lastBoundary = currentBoundary;
        currentBoundary = splits[i];
        bucketer.push({
          value: 'B' + i,
          startOn: lastBoundary,
          endBelow: currentBoundary
        });
      }
      bucketer.push({
        value: 'B' + splits.length,
        startOn: currentBoundary,
        endBelow: null
      });
      return bucketer;
    };

    Classifier.prototype.discreteizeRow = function(row) {
      var bin, feature, index, value, _i, _j, _len, _len1, _ref, _ref1;
      _ref = this.features;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        feature = _ref[_i];
        if (feature.type === 'continuous') {
          value = row[feature.field];
          if (value == null) {
            throw new Error("Could not find field " + feature.field + " in " + (JSON.stringify(row)) + ".");
          }
          _ref1 = feature.bins;
          for (index = _j = 0, _len1 = _ref1.length; _j < _len1; index = ++_j) {
            bin = _ref1[index];
            if (bin.startOn != null) {
              if (bin.endBelow != null) {
                if ((bin.startOn <= value && value < bin.endBelow)) {
                  row[feature.field] = bin.value;
                  break;
                }
              } else if (bin.startOn <= value) {
                row[feature.field] = bin.value;
                break;
              }
            } else if (value < bin.endBelow) {
              row[feature.field] = bin.value;
              break;
            }
          }
        }
      }
      return row;
    };

    return Classifier;

  })();

  BayesianClassifier = (function(_super) {
    __extends(BayesianClassifier, _super);

    /*
    @class BayesianClassifier
    
    __A Bayesian classifier with non-parametric modeling of distributions using v-optimal bucketing.__
    
    If you look for libraries for Bayesian classification, the primary use case is spam filtering and they assume that
    the presence or absence of a word is the only feature you are interested in. This is a more general purpose tool.
    
    ## Features ##
    
    * Works even for bi-modal and other non-normal distributions
    * No requirement that you identify the distribution
    * Uses [non-parametric modeling](http://en.wikipedia.org/wiki/Non-parametric_statistics)
    * Uses v-optimal bucketing so it deals well with outliers and sharp cliffs
    * Serialize (`getStateForSaving()`) and deserialize (`newFromSavedState()`) to preserve training between sessions
    
    ## Why the assumption of a normal distribution is bad in some cases ##
    
    The [wikipedia example of using Bayes](https://en.wikipedia.org/wiki/Naive_Bayes_classifier#Sex_classification) tries
    to determine if someone was male or female based upon the height, weight
    and shoe size. The assumption is that men are generally larger, heavier, and have larger shoe size than women. In the
    example, they use the mean and variance of the male-only and female-only populations to characterize those
    distributions. This works because these characteristics are generally normally distributed **and the distribution for
    men is generally to the right of the distribution for women**.
    
    However, let's ask a group of folks who work together if they consider themselves a team and let's try to use the size
    of the group as a feature to predict what a new group would say. If the group is very small (1-2 people), they are
    less likely to consider themselves a team (partnership maybe), but if they are too large (say > 10), they are also
    unlikely to refer to themselves as a team. The non-team distribution is bimodal, looking at its mean and variance
    completely mis-characterizes it. Also, the distribution is zero bound so it's likely to be asymmetric, which also
    poses problems for a normal distribution assumption.
    
    ## So what do we do instead? ##
    
    This classifier uses the actual sampled percentage for buckets of the data. This approach is often referred to
    as "building a non-parametric model", although "distribution-free" strikes me a better label.
    
    **Pros/Cons**. The use of a non-parametric approach will allow us to deal with non-normal distributions (asymmetric,
    bimodal, etc.) without ever having to identify which nominal distribution is the best fit or having to ask the user
    (who may not know) what distribution to use. The downside to this approach is that it generally requires a larger
    training set. You will need to experiment to determine how small is too small for your situation.
    
    This approach is hinted at in the [wikipedia article on Bayesian classifiers](https://en.wikipedia.org/wiki/Naive_Bayes_classifier)
    as "binning to discretize the feature values, to obtain a new set of Bernoulli-distributed features". However, this
    classifier does not create new separate Bernoulli features for each bin. Rather, it creates a mapping function from a feature
    value to a probability indicating how often the feature value is coincident with a particular outputField value. This mapping
    function is different for each bin.
    
    ## V-optimal bucketing ##
    
    There are two common approaches to bucketing:
    
    1. Make each bucket be equal in width along the x-axis (like we would for a histogram) (equi-width)
    2. Make each bucket have roughly the same number of data points (equi-depth)
    
    It turns out neither of the above works out well for this use case. Rather, there is an approach called [v-optimal
    bucketing](http://en.wikipedia.org/wiki/V-optimal_histograms) which attempts to find the optimal boundaries in the
    data. The basic idea is to look for the splits that
    provide the minimum total error-squared where the "error" for each point is the distance of that point from the
    arithmetic mean.
    
    The algorithm used here for v-optimal bucketing is slightly inspired by
    [this non-recursive code](http://www.mathcs.emory.edu/~cheung/Courses/584-StreamDB/Syllabus/06-Histograms/v-opt3.html).
    However, the implementation here is recursive and I've made some different choices about when to terminate the splitting. To
    understand the essence of the algorithm used, you need only look at the 9 lines of code in the `findBucketSplits()` function.
    The `optimalSplitFor2Buckets()` function will split the values into two buckets. It tries each possible split
    starting with only one in the bucket on the left all the way down to a split with only one in the bucket on the right.
    
    ## Simple example ##
    
    First we need to require the classifier.
    
        {BayesianClassifier} = require('../')
    
    Before we start, let's take a look at our training set. The assumption is that we think TeamSize and HasChildProject
    will be predictors for RealTeam.
    
        trainingSet = [
          {TeamSize: 5, HasChildProject: 0, RealTeam: 1},
          {TeamSize: 3, HasChildProject: 1, RealTeam: 0},
          {TeamSize: 3, HasChildProject: 1, RealTeam: 1},
          {TeamSize: 1, HasChildProject: 0, RealTeam: 0},
          {TeamSize: 2, HasChildProject: 1, RealTeam: 0},
          {TeamSize: 2, HasChildProject: 0, RealTeam: 0},
          {TeamSize: 15, HasChildProject: 1, RealTeam: 0},
          {TeamSize: 27, HasChildProject: 1, RealTeam: 0},
          {TeamSize: 13, HasChildProject: 1, RealTeam: 1},
          {TeamSize: 7, HasChildProject: 0, RealTeam: 1},
          {TeamSize: 7, HasChildProject: 0, RealTeam: 0},
          {TeamSize: 9, HasChildProject: 1, RealTeam: 1},
          {TeamSize: 6, HasChildProject: 0, RealTeam: 1},
          {TeamSize: 5, HasChildProject: 0, RealTeam: 1},
          {TeamSize: 5, HasChildProject: 0, RealTeam: 0},
        ]
    
    Now, let's set up a simple config indicating our assumptions. Note how the type for TeamSize is 'continuous'
    whereas the type for HasChildProject is 'discrete' eventhough a number is stored. Continuous types must be numbers
    but discrete types can either be numbers or strings.
    
        config =
          outputField: "RealTeam"
          features: [
            {field: 'TeamSize', type: 'continuous'},
            {field: 'HasChildProject', type: 'discrete'}
          ]
    
    We can now instantiate the classifier with that config,
    
        classifier = new BayesianClassifier(config)
    
    and pass in our training set.
    
        percentWins = classifier.train(trainingSet)
    
    The call to `train()` returns the percentage of times that the trained classifier gets the right answer for the training
    set. This should usually be pretty high. Anything below say, 70% and you probably don't have the right "features"
    in your training set or you don't have enough training set data. Our made up exmple is a borderline case.
    
        console.log(percentWins)
        # 0.7333333333333333
    
    Now, let's see how the trained classifier is used to predict "RealTeam"-ness. We simply pass in an object with
    fields for each of our features. A very small team with child projects are definitely not a RealTeam.
    
        console.log(classifier.predict({TeamSize: 1, HasChildProject: 1}))
        # 0
    
    However, a mid-sized project with no child projects most certainly is a RealTeam.
    
        console.log(classifier.predict({TeamSize: 7, HasChildProject: 0}))
        # 1
    
    Here is a less obvious case, with one indicator going one way (too big) and another going the other way (no child projects).
    
        console.log(classifier.predict({TeamSize: 29, HasChildProject: 0}))
        # 0
    
    If you want to know the strength of the prediction, you can pass in `true` as the second parameter to the `predict()` method.
    
        console.log(classifier.predict({TeamSize: 29, HasChildProject: 0}, true))
        # { '0': 0.6956521739130435, '1': 0.30434782608695654 }
    
    We're only 69.6% sure this is not a RealTeam. Notice how the keys for the output are strings eventhough we passed in values
    of type Number for the RealTeam field in our training set. We had no choice in this case because keys of JavaScript
    Objects must be strings. However, the classifier is smart enough to know that you wanted
    
    Like the Lumenize calculators, you can save and restore the state of a trained classifier.
    
        savedState = classifier.getStateForSaving('some meta data')
        newClassifier = BayesianClassifier.newFromSavedState(savedState)
        console.log(newClassifier.meta)
        # some meta data
    
    It will make the same predictions.
    
        console.log(newClassifier.predict({TeamSize: 29, HasChildProject: 0}, true))
        # { '0': 0.6956521739130435, '1': 0.30434782608695654 }
    */


    function BayesianClassifier(userConfig) {
      this.userConfig = userConfig;
      /*
      @constructor
      @param {Object} userConfig See Config options for details.
      @cfg {String} outputField String indicating which field in the training set is what we are trying to predict
      @cfg {Object[]} features Array of Maps which specifies the fields to use as features. Each row in the array should
       be in the form of `{field: <fieldName>, type: <'continuous' | 'discrete'>}`. Note, that you can even declare Number type
       fields as 'discrete'. It is preferable to do this if you know that it can only be one of a hand full of values
       (0 vs 1 for example).
      
       **WARNING: If you choose 'discrete' for the feature type, then ALL possible values for that feature must appear
       in the training set. If the classifier is asked to make a prediction with a value that it has never seen
       before, it will fail catostrophically.**
      */

      this.config = utils.clone(this.userConfig);
      this.outputField = this.config.outputField;
      this.features = this.config.features;
    }

    BayesianClassifier.prototype.train = function(userSuppliedTrainingSet) {
      /*
      @method train
       Train the classifier with a training set.
      @return {Number} The percentage of time that the trained classifier returns the expected outputField for the rows
       in the training set. If this is low (say below 70%), you need more predictive fields and/or more data in your
       training set.
      @param {Object[]} userSuppliedTrainingSet an Array of Maps containing a field for the outputField as well as a field
       for each of the features specified in the config.
      */

      var bin, bucketGenerator, bucketer, countForThisValue, denominator, denominatorCell, dimensions, feature, featureCube, featureValues, filter, loses, n, numerator, numeratorCell, outputDimension, outputValue, outputValuesCube, percentWins, prediction, row, trainingSet, value, values, wins, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _len5, _len6, _len7, _m, _n, _o, _p, _ref, _ref1, _ref2, _ref3, _ref4, _ref5;
      trainingSet = utils.clone(userSuppliedTrainingSet);
      outputDimension = [
        {
          field: this.outputField
        }
      ];
      outputValuesCube = new OLAPCube({
        dimensions: outputDimension
      }, trainingSet);
      this.outputValues = outputValuesCube.getDimensionValues(this.outputField);
      this.outputFieldTypeIsNumber = true;
      _ref = this.outputValues;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        value = _ref[_i];
        if (utils.type(value) !== 'number') {
          this.outputFieldTypeIsNumber = false;
        }
      }
      n = trainingSet.length;
      filter = {};
      this.baseProbabilities = {};
      _ref1 = this.outputValues;
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        outputValue = _ref1[_j];
        filter[this.outputField] = outputValue;
        countForThisValue = outputValuesCube.getCell(filter)._count;
        this.baseProbabilities[outputValue] = countForThisValue / n;
      }
      if (n >= 144) {
        bucketGenerator = Classifier.generateConstantQuantityBucketer;
      } else {
        bucketGenerator = Classifier.generateVOptimalBucketer;
      }
      _ref2 = this.features;
      for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
        feature = _ref2[_k];
        if (feature.type === 'continuous') {
          values = (function() {
            var _l, _len3, _results;
            _results = [];
            for (_l = 0, _len3 = trainingSet.length; _l < _len3; _l++) {
              row = trainingSet[_l];
              _results.push(row[feature.field]);
            }
            return _results;
          })();
          bucketer = bucketGenerator(values);
          feature.bins = bucketer;
        } else if (feature.type === 'discrete') {

        } else {
          throw new Error("Unrecognized feature type: " + feature.type + ".");
        }
      }
      for (_l = 0, _len3 = trainingSet.length; _l < _len3; _l++) {
        row = trainingSet[_l];
        this.discreteizeRow(row);
      }
      _ref3 = this.features;
      for (_m = 0, _len4 = _ref3.length; _m < _len4; _m++) {
        feature = _ref3[_m];
        dimensions = [
          {
            field: this.outputField,
            keepTotals: true
          }
        ];
        dimensions.push({
          field: feature.field
        });
        featureCube = new OLAPCube({
          dimensions: dimensions
        }, trainingSet);
        featureValues = featureCube.getDimensionValues(feature.field);
        if (feature.type === 'discrete') {
          feature.bins = (function() {
            var _len5, _n, _results;
            _results = [];
            for (_n = 0, _len5 = featureValues.length; _n < _len5; _n++) {
              value = featureValues[_n];
              _results.push({
                value: value
              });
            }
            return _results;
          })();
        }
        _ref4 = feature.bins;
        for (_n = 0, _len5 = _ref4.length; _n < _len5; _n++) {
          bin = _ref4[_n];
          bin.probabilities = {};
          _ref5 = this.outputValues;
          for (_o = 0, _len6 = _ref5.length; _o < _len6; _o++) {
            outputValue = _ref5[_o];
            filter = {};
            filter[feature.field] = bin.value;
            denominatorCell = featureCube.getCell(filter);
            if (denominatorCell != null) {
              denominator = denominatorCell._count;
            } else {
              denominator = 0;
            }
            filter[this.outputField] = outputValue;
            numeratorCell = featureCube.getCell(filter);
            numerator = (numeratorCell != null ? numeratorCell._count : void 0) | 0;
            bin.probabilities[outputValue] = numerator / denominator;
          }
        }
      }
      trainingSet = utils.clone(userSuppliedTrainingSet);
      wins = 0;
      loses = 0;
      for (_p = 0, _len7 = trainingSet.length; _p < _len7; _p++) {
        row = trainingSet[_p];
        prediction = this.predict(row);
        if (prediction === row[this.outputField]) {
          wins++;
        } else {
          loses++;
        }
      }
      percentWins = wins / (wins + loses);
      return percentWins;
    };

    BayesianClassifier.prototype.predict = function(row, returnProbabilities) {
      var bin, feature, matchingBin, max, outputValue, outputValueForMax, probabilities, probability, _i, _j, _len, _len1, _ref, _ref1, _ref2;
      if (returnProbabilities == null) {
        returnProbabilities = false;
      }
      /*
      @method predict
       Use the trained classifier to make a prediction.
      @return {String|Number|Object} If returnProbabilities is false (the default), then it will return the prediction.
       If returnProbabilities is true, then it will return an Object indicating the probability for each possible
       outputField value.
      @param {Object} row an Object containing a field for each of the features specified by the config.
      @param {Boolean} [returnProbabilities = false] If true, then the output will indicate the probabilities of each
       possible outputField value. Otherwise, the output of a call to `predict()` will return the predicted value with
       the highest probability.
      */

      row = this.discreteizeRow(row);
      probabilities = {};
      _ref = this.baseProbabilities;
      for (outputValue in _ref) {
        probability = _ref[outputValue];
        probabilities[outputValue] = probability;
      }
      _ref1 = this.features;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        feature = _ref1[_i];
        matchingBin = null;
        _ref2 = feature.bins;
        for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
          bin = _ref2[_j];
          if (row[feature.field] === bin.value) {
            matchingBin = bin;
            break;
          }
        }
        if (matchingBin == null) {
          throw new Error("No matching bin for " + feature.field + "=" + row[feature.field] + " in the training set.");
        }
        for (outputValue in probabilities) {
          probability = probabilities[outputValue];
          probabilities[outputValue] = probability * matchingBin.probabilities[outputValue] / (probability * matchingBin.probabilities[outputValue] + (1 - probability) * (1 - matchingBin.probabilities[outputValue]));
        }
      }
      max = 0;
      outputValueForMax = null;
      for (outputValue in probabilities) {
        probability = probabilities[outputValue];
        if (probability > max) {
          max = probability;
          outputValueForMax = outputValue;
        }
      }
      if (returnProbabilities) {
        return probabilities;
      } else {
        if (this.outputFieldTypeIsNumber) {
          return Number(outputValueForMax);
        } else {
          return outputValueForMax;
        }
      }
    };

    BayesianClassifier.prototype.getStateForSaving = function(meta) {
      /*
      @method getStateForSaving
        Enables saving the state of a Classifier.
      
        See the bottom of the "Simple example" for example code of using this
        saving and restoring functionality.
      
      @param {Object} [meta] An optional parameter that will be added to the serialized output and added to the meta field
        within the deserialized Classifier
      @return {Object} Returns an Ojbect representing the state of the Classifier. This Object is suitable for saving to
        an object store. Use the static method `newFromSavedState()` with this Object as the parameter to reconstitute the Classifier.
      */

      var out;
      out = {
        userConfig: this.userConfig,
        outputField: this.outputField,
        outputValues: this.outputValues,
        outputFieldTypeIsNumber: this.outputFieldTypeIsNumber,
        baseProbabilities: this.baseProbabilities,
        features: this.features
      };
      if (meta != null) {
        out.meta = meta;
      }
      return out;
    };

    BayesianClassifier.newFromSavedState = function(p) {
      /*
      @method newFromSavedState
        Deserializes a previously stringified Classifier and returns a new Classifier.
      
        See the bottom of the "Simple example" for example code of using this
        saving and restoring functionality.
      
      @static
      @param {String/Object} p A String or Object from a previously saved Classifier state
      @return {Classifier}
      */

      var classifier;
      if (utils.type(p) === 'string') {
        p = JSON.parse(p);
      }
      classifier = new BayesianClassifier(p.userConfig);
      classifier.outputField = p.outputField;
      classifier.outputValues = p.outputValues;
      classifier.outputFieldTypeIsNumber = p.outputFieldTypeIsNumber;
      classifier.baseProbabilities = p.baseProbabilities;
      classifier.features = p.features;
      if (p.meta != null) {
        classifier.meta = p.meta;
      }
      return classifier;
    };

    return BayesianClassifier;

  })(Classifier);

  exports.Classifier = Classifier;

  exports.BayesianClassifier = BayesianClassifier;

}).call(this);

});
