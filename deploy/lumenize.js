var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var res = mod._cached ? mod._cached : mod();
    return res;
}

require.paths = [];
require.modules = {};
require.extensions = [".js",".coffee"];

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
            var pkgfile = x + '/package.json';
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
        for (var key in obj) res.push(key)
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

require.define = function (filename, fn) {
    var dirname = require._core[filename]
        ? ''
        : require.modules.path().dirname(filename)
    ;
    
    var require_ = function (file) {
        return require(file, dirname)
    };
    require_.resolve = function (name) {
        return require.resolve(name, dirname);
    };
    require_.modules = require.modules;
    require_.define = require.define;
    var module_ = { exports : {} };
    
    require.modules[filename] = function () {
        require.modules[filename]._cached = module_.exports;
        fn.call(
            module_.exports,
            require_,
            module_,
            module_.exports,
            dirname,
            filename
        );
        require.modules[filename]._cached = module_.exports;
        return module_.exports;
    };
};

if (typeof process === 'undefined') process = {};

if (!process.nextTick) process.nextTick = (function () {
    var queue = [];
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;
    
    if (canPost) {
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);
    }
    
    return function (fn) {
        if (canPost) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        }
        else setTimeout(fn, 0);
    };
})();

if (!process.title) process.title = 'browser';

if (!process.binding) process.binding = function (name) {
    if (name === 'evals') return require('vm')
    else throw new Error('No such module')
};

if (!process.cwd) process.cwd = function () { return '.' };

require.define("path", function (require, module, exports, __dirname, __filename) {
function filter (xs, fn) {
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

require.define("/node_modules/files", function (require, module, exports, __dirname, __filename) {
module.exports = {"tz/africa":"Rule\tAlgeria\t1916\tonly\t-\tJun\t14\t23:00s\t1:00\tS\nRule\tAlgeria\t1916\t1919\t-\tOct\tSun>=1\t23:00s\t0\t-\nRule\tAlgeria\t1917\tonly\t-\tMar\t24\t23:00s\t1:00\tS\nRule\tAlgeria\t1918\tonly\t-\tMar\t 9\t23:00s\t1:00\tS\nRule\tAlgeria\t1919\tonly\t-\tMar\t 1\t23:00s\t1:00\tS\nRule\tAlgeria\t1920\tonly\t-\tFeb\t14\t23:00s\t1:00\tS\nRule\tAlgeria\t1920\tonly\t-\tOct\t23\t23:00s\t0\t-\nRule\tAlgeria\t1921\tonly\t-\tMar\t14\t23:00s\t1:00\tS\nRule\tAlgeria\t1921\tonly\t-\tJun\t21\t23:00s\t0\t-\nRule\tAlgeria\t1939\tonly\t-\tSep\t11\t23:00s\t1:00\tS\nRule\tAlgeria\t1939\tonly\t-\tNov\t19\t 1:00\t0\t-\nRule\tAlgeria\t1944\t1945\t-\tApr\tMon>=1\t 2:00\t1:00\tS\nRule\tAlgeria\t1944\tonly\t-\tOct\t 8\t 2:00\t0\t-\nRule\tAlgeria\t1945\tonly\t-\tSep\t16\t 1:00\t0\t-\nRule\tAlgeria\t1971\tonly\t-\tApr\t25\t23:00s\t1:00\tS\nRule\tAlgeria\t1971\tonly\t-\tSep\t26\t23:00s\t0\t-\nRule\tAlgeria\t1977\tonly\t-\tMay\t 6\t 0:00\t1:00\tS\nRule\tAlgeria\t1977\tonly\t-\tOct\t21\t 0:00\t0\t-\nRule\tAlgeria\t1978\tonly\t-\tMar\t24\t 1:00\t1:00\tS\nRule\tAlgeria\t1978\tonly\t-\tSep\t22\t 3:00\t0\t-\nRule\tAlgeria\t1980\tonly\t-\tApr\t25\t 0:00\t1:00\tS\nRule\tAlgeria\t1980\tonly\t-\tOct\t31\t 2:00\t0\t-\nZone\tAfrica/Algiers\t0:12:12 -\tLMT\t1891 Mar 15 0:01\n\t\t\t0:09:21\t-\tPMT\t1911 Mar 11    # Paris Mean Time\n\t\t\t0:00\tAlgeria\tWE%sT\t1940 Feb 25 2:00\n\t\t\t1:00\tAlgeria\tCE%sT\t1946 Oct  7\n\t\t\t0:00\t-\tWET\t1956 Jan 29\n\t\t\t1:00\t-\tCET\t1963 Apr 14\n\t\t\t0:00\tAlgeria\tWE%sT\t1977 Oct 21\n\t\t\t1:00\tAlgeria\tCE%sT\t1979 Oct 26\n\t\t\t0:00\tAlgeria\tWE%sT\t1981 May\n\t\t\t1:00\t-\tCET\nZone\tAfrica/Luanda\t0:52:56\t-\tLMT\t1892\n\t\t\t0:52:04\t-\tAOT\t1911 May 26 # Angola Time\n\t\t\t1:00\t-\tWAT\nZone Africa/Porto-Novo\t0:10:28\t-\tLMT\t1912\n\t\t\t0:00\t-\tGMT\t1934 Feb 26\n\t\t\t1:00\t-\tWAT\nZone\tAfrica/Gaborone\t1:43:40 -\tLMT\t1885\n\t\t\t2:00\t-\tCAT\t1943 Sep 19 2:00\n\t\t\t2:00\t1:00\tCAST\t1944 Mar 19 2:00\n\t\t\t2:00\t-\tCAT\nZone Africa/Ouagadougou\t-0:06:04 -\tLMT\t1912\n\t\t\t 0:00\t-\tGMT\nZone Africa/Bujumbura\t1:57:28\t-\tLMT\t1890\n\t\t\t2:00\t-\tCAT\nZone\tAfrica/Douala\t0:38:48\t-\tLMT\t1912\n\t\t\t1:00\t-\tWAT\nZone Atlantic/Cape_Verde -1:34:04 -\tLMT\t1907\t\t\t# Praia\n\t\t\t-2:00\t-\tCVT\t1942 Sep\n\t\t\t-2:00\t1:00\tCVST\t1945 Oct 15\n\t\t\t-2:00\t-\tCVT\t1975 Nov 25 2:00\n\t\t\t-1:00\t-\tCVT\nZone\tAfrica/Bangui\t1:14:20\t-\tLMT\t1912\n\t\t\t1:00\t-\tWAT\nZone\tAfrica/Ndjamena\t1:00:12 -\tLMT\t1912\n\t\t\t1:00\t-\tWAT\t1979 Oct 14\n\t\t\t1:00\t1:00\tWAST\t1980 Mar  8\n\t\t\t1:00\t-\tWAT\nZone\tIndian/Comoro\t2:53:04 -\tLMT\t1911 Jul   # Moroni, Gran Comoro\n\t\t\t3:00\t-\tEAT\nZone Africa/Kinshasa\t1:01:12 -\tLMT\t1897 Nov 9\n\t\t\t1:00\t-\tWAT\nZone Africa/Lubumbashi\t1:49:52 -\tLMT\t1897 Nov 9\n\t\t\t2:00\t-\tCAT\nZone Africa/Brazzaville\t1:01:08 -\tLMT\t1912\n\t\t\t1:00\t-\tWAT\nZone\tAfrica/Abidjan\t-0:16:08 -\tLMT\t1912\n\t\t\t 0:00\t-\tGMT\nZone\tAfrica/Djibouti\t2:52:36 -\tLMT\t1911 Jul\n\t\t\t3:00\t-\tEAT\nRule\tEgypt\t1940\tonly\t-\tJul\t15\t0:00\t1:00\tS\nRule\tEgypt\t1940\tonly\t-\tOct\t 1\t0:00\t0\t-\nRule\tEgypt\t1941\tonly\t-\tApr\t15\t0:00\t1:00\tS\nRule\tEgypt\t1941\tonly\t-\tSep\t16\t0:00\t0\t-\nRule\tEgypt\t1942\t1944\t-\tApr\t 1\t0:00\t1:00\tS\nRule\tEgypt\t1942\tonly\t-\tOct\t27\t0:00\t0\t-\nRule\tEgypt\t1943\t1945\t-\tNov\t 1\t0:00\t0\t-\nRule\tEgypt\t1945\tonly\t-\tApr\t16\t0:00\t1:00\tS\nRule\tEgypt\t1957\tonly\t-\tMay\t10\t0:00\t1:00\tS\nRule\tEgypt\t1957\t1958\t-\tOct\t 1\t0:00\t0\t-\nRule\tEgypt\t1958\tonly\t-\tMay\t 1\t0:00\t1:00\tS\nRule\tEgypt\t1959\t1981\t-\tMay\t 1\t1:00\t1:00\tS\nRule\tEgypt\t1959\t1965\t-\tSep\t30\t3:00\t0\t-\nRule\tEgypt\t1966\t1994\t-\tOct\t 1\t3:00\t0\t-\nRule\tEgypt\t1982\tonly\t-\tJul\t25\t1:00\t1:00\tS\nRule\tEgypt\t1983\tonly\t-\tJul\t12\t1:00\t1:00\tS\nRule\tEgypt\t1984\t1988\t-\tMay\t 1\t1:00\t1:00\tS\nRule\tEgypt\t1989\tonly\t-\tMay\t 6\t1:00\t1:00\tS\nRule\tEgypt\t1990\t1994\t-\tMay\t 1\t1:00\t1:00\tS\nRule\tEgypt\t1995\t2010\t-\tApr\tlastFri\t 0:00s\t1:00\tS\nRule\tEgypt\t1995\t2005\t-\tSep\tlastThu\t23:00s\t0\t-\nRule\tEgypt\t2006\tonly\t-\tSep\t21\t23:00s\t0\t-\nRule\tEgypt\t2007\tonly\t-\tSep\tThu>=1\t23:00s\t0\t-\nRule\tEgypt\t2008\tonly\t-\tAug\tlastThu\t23:00s\t0\t-\nRule\tEgypt\t2009\tonly\t-\tAug\t20\t23:00s\t0\t-\nRule\tEgypt\t2010\tonly\t-\tAug\t11\t0:00\t0\t-\nRule\tEgypt\t2010\tonly\t-\tSep\t10\t0:00\t1:00\tS\nRule\tEgypt\t2010\tonly\t-\tSep\tlastThu\t23:00s\t0\t-\nZone\tAfrica/Cairo\t2:05:00 -\tLMT\t1900 Oct\n\t\t\t2:00\tEgypt\tEE%sT\nZone\tAfrica/Malabo\t0:35:08 -\tLMT\t1912\n\t\t\t0:00\t-\tGMT\t1963 Dec 15\n\t\t\t1:00\t-\tWAT\nZone\tAfrica/Asmara\t2:35:32 -\tLMT\t1870\n\t\t\t2:35:32\t-\tAMT\t1890\t      # Asmara Mean Time\n\t\t\t2:35:20\t-\tADMT\t1936 May 5    # Adis Dera MT\n\t\t\t3:00\t-\tEAT\nZone Africa/Addis_Ababa\t2:34:48 -\tLMT\t1870\n\t\t\t2:35:20\t-\tADMT\t1936 May 5    # Adis Dera MT\n\t\t\t3:00\t-\tEAT\nZone Africa/Libreville\t0:37:48 -\tLMT\t1912\n\t\t\t1:00\t-\tWAT\nZone\tAfrica/Banjul\t-1:06:36 -\tLMT\t1912\n\t\t\t-1:06:36 -\tBMT\t1935\t# Banjul Mean Time\n\t\t\t-1:00\t-\tWAT\t1964\n\t\t\t 0:00\t-\tGMT\nRule\tGhana\t1936\t1942\t-\tSep\t 1\t0:00\t0:20\tGHST\nRule\tGhana\t1936\t1942\t-\tDec\t31\t0:00\t0\tGMT\nZone\tAfrica/Accra\t-0:00:52 -\tLMT\t1918\n\t\t\t 0:00\tGhana\t%s\nZone\tAfrica/Conakry\t-0:54:52 -\tLMT\t1912\n\t\t\t 0:00\t-\tGMT\t1934 Feb 26\n\t\t\t-1:00\t-\tWAT\t1960\n\t\t\t 0:00\t-\tGMT\nZone\tAfrica/Bissau\t-1:02:20 -\tLMT\t1911 May 26\n\t\t\t-1:00\t-\tWAT\t1975\n\t\t\t 0:00\t-\tGMT\nZone\tAfrica/Nairobi\t2:27:16\t-\tLMT\t1928 Jul\n\t\t\t3:00\t-\tEAT\t1930\n\t\t\t2:30\t-\tBEAT\t1940\n\t\t\t2:45\t-\tBEAUT\t1960\n\t\t\t3:00\t-\tEAT\nZone\tAfrica/Maseru\t1:50:00 -\tLMT\t1903 Mar\n\t\t\t2:00\t-\tSAST\t1943 Sep 19 2:00\n\t\t\t2:00\t1:00\tSAST\t1944 Mar 19 2:00\n\t\t\t2:00\t-\tSAST\nZone\tAfrica/Monrovia\t-0:43:08 -\tLMT\t1882\n\t\t\t-0:43:08 -\tMMT\t1919 Mar # Monrovia Mean Time\n\t\t\t-0:44:30 -\tLRT\t1972 May # Liberia Time\n\t\t\t 0:00\t-\tGMT\nRule\tLibya\t1951\tonly\t-\tOct\t14\t2:00\t1:00\tS\nRule\tLibya\t1952\tonly\t-\tJan\t 1\t0:00\t0\t-\nRule\tLibya\t1953\tonly\t-\tOct\t 9\t2:00\t1:00\tS\nRule\tLibya\t1954\tonly\t-\tJan\t 1\t0:00\t0\t-\nRule\tLibya\t1955\tonly\t-\tSep\t30\t0:00\t1:00\tS\nRule\tLibya\t1956\tonly\t-\tJan\t 1\t0:00\t0\t-\nRule\tLibya\t1982\t1984\t-\tApr\t 1\t0:00\t1:00\tS\nRule\tLibya\t1982\t1985\t-\tOct\t 1\t0:00\t0\t-\nRule\tLibya\t1985\tonly\t-\tApr\t 6\t0:00\t1:00\tS\nRule\tLibya\t1986\tonly\t-\tApr\t 4\t0:00\t1:00\tS\nRule\tLibya\t1986\tonly\t-\tOct\t 3\t0:00\t0\t-\nRule\tLibya\t1987\t1989\t-\tApr\t 1\t0:00\t1:00\tS\nRule\tLibya\t1987\t1989\t-\tOct\t 1\t0:00\t0\t-\nZone\tAfrica/Tripoli\t0:52:44 -\tLMT\t1920\n\t\t\t1:00\tLibya\tCE%sT\t1959\n\t\t\t2:00\t-\tEET\t1982\n\t\t\t1:00\tLibya\tCE%sT\t1990 May  4\n\t\t\t2:00\t-\tEET\t1996 Sep 30\n\t\t\t1:00\t-\tCET\t1997 Apr  4\n\t\t\t1:00\t1:00\tCEST\t1997 Oct  4\n\t\t\t2:00\t-\tEET\nZone Indian/Antananarivo 3:10:04 -\tLMT\t1911 Jul\n\t\t\t3:00\t-\tEAT\t1954 Feb 27 23:00s\n\t\t\t3:00\t1:00\tEAST\t1954 May 29 23:00s\n\t\t\t3:00\t-\tEAT\nZone\tAfrica/Blantyre\t2:20:00 -\tLMT\t1903 Mar\n\t\t\t2:00\t-\tCAT\nZone\tAfrica/Bamako\t-0:32:00 -\tLMT\t1912\n\t\t\t 0:00\t-\tGMT\t1934 Feb 26\n\t\t\t-1:00\t-\tWAT\t1960 Jun 20\n\t\t\t 0:00\t-\tGMT\nZone Africa/Nouakchott\t-1:03:48 -\tLMT\t1912\n\t\t\t 0:00\t-\tGMT\t1934 Feb 26\n\t\t\t-1:00\t-\tWAT\t1960 Nov 28\n\t\t\t 0:00\t-\tGMT\nRule Mauritius\t1982\tonly\t-\tOct\t10\t0:00\t1:00\tS\nRule Mauritius\t1983\tonly\t-\tMar\t21\t0:00\t0\t-\nRule Mauritius\t2008\tonly\t-\tOct\tlastSun\t2:00\t1:00\tS\nRule Mauritius\t2009\tonly\t-\tMar\tlastSun\t2:00\t0\t-\nZone Indian/Mauritius\t3:50:00 -\tLMT\t1907\t\t# Port Louis\n\t\t\t4:00 Mauritius\tMU%sT\t# Mauritius Time\nZone\tIndian/Mayotte\t3:00:56 -\tLMT\t1911 Jul\t# Mamoutzou\n\t\t\t3:00\t-\tEAT\nRule\tMorocco\t1939\tonly\t-\tSep\t12\t 0:00\t1:00\tS\nRule\tMorocco\t1939\tonly\t-\tNov\t19\t 0:00\t0\t-\nRule\tMorocco\t1940\tonly\t-\tFeb\t25\t 0:00\t1:00\tS\nRule\tMorocco\t1945\tonly\t-\tNov\t18\t 0:00\t0\t-\nRule\tMorocco\t1950\tonly\t-\tJun\t11\t 0:00\t1:00\tS\nRule\tMorocco\t1950\tonly\t-\tOct\t29\t 0:00\t0\t-\nRule\tMorocco\t1967\tonly\t-\tJun\t 3\t12:00\t1:00\tS\nRule\tMorocco\t1967\tonly\t-\tOct\t 1\t 0:00\t0\t-\nRule\tMorocco\t1974\tonly\t-\tJun\t24\t 0:00\t1:00\tS\nRule\tMorocco\t1974\tonly\t-\tSep\t 1\t 0:00\t0\t-\nRule\tMorocco\t1976\t1977\t-\tMay\t 1\t 0:00\t1:00\tS\nRule\tMorocco\t1976\tonly\t-\tAug\t 1\t 0:00\t0\t-\nRule\tMorocco\t1977\tonly\t-\tSep\t28\t 0:00\t0\t-\nRule\tMorocco\t1978\tonly\t-\tJun\t 1\t 0:00\t1:00\tS\nRule\tMorocco\t1978\tonly\t-\tAug\t 4\t 0:00\t0\t-\nRule\tMorocco\t2008\tonly\t-\tJun\t 1\t 0:00\t1:00\tS\nRule\tMorocco\t2008\tonly\t-\tSep\t 1\t 0:00\t0\t-\nRule\tMorocco\t2009\tonly\t-\tJun\t 1\t 0:00\t1:00\tS\nRule\tMorocco\t2009\tonly\t-\tAug\t 21\t 0:00\t0\t-\nRule\tMorocco\t2010\tonly\t-\tMay\t 2\t 0:00\t1:00\tS\nRule\tMorocco\t2010\tonly\t-\tAug\t 8\t 0:00\t0\t-\nRule\tMorocco\t2011\tonly\t-\tApr\t 3\t 0:00\t1:00\tS\nRule\tMorocco\t2011\tonly\t-\tJul\t 31\t 0\t0\t-\nZone Africa/Casablanca\t-0:30:20 -\tLMT\t1913 Oct 26\n\t\t\t 0:00\tMorocco\tWE%sT\t1984 Mar 16\n\t\t\t 1:00\t-\tCET\t1986\n\t\t\t 0:00\tMorocco\tWE%sT\nZone Africa/El_Aaiun\t-0:52:48 -\tLMT\t1934 Jan\n\t\t\t-1:00\t-\tWAT\t1976 Apr 14\n\t\t\t 0:00\t-\tWET\nZone\tAfrica/Maputo\t2:10:20 -\tLMT\t1903 Mar\n\t\t\t2:00\t-\tCAT\nRule\tNamibia\t1994\tmax\t-\tSep\tSun>=1\t2:00\t1:00\tS\nRule\tNamibia\t1995\tmax\t-\tApr\tSun>=1\t2:00\t0\t-\nZone\tAfrica/Windhoek\t1:08:24 -\tLMT\t1892 Feb 8\n\t\t\t1:30\t-\tSWAT\t1903 Mar\t# SW Africa Time\n\t\t\t2:00\t-\tSAST\t1942 Sep 20 2:00\n\t\t\t2:00\t1:00\tSAST\t1943 Mar 21 2:00\n\t\t\t2:00\t-\tSAST\t1990 Mar 21 # independence\n\t\t\t2:00\t-\tCAT\t1994 Apr  3\n\t\t\t1:00\tNamibia\tWA%sT\nZone\tAfrica/Niamey\t 0:08:28 -\tLMT\t1912\n\t\t\t-1:00\t-\tWAT\t1934 Feb 26\n\t\t\t 0:00\t-\tGMT\t1960\n\t\t\t 1:00\t-\tWAT\nZone\tAfrica/Lagos\t0:13:36 -\tLMT\t1919 Sep\n\t\t\t1:00\t-\tWAT\nZone\tIndian/Reunion\t3:41:52 -\tLMT\t1911 Jun\t# Saint-Denis\n\t\t\t4:00\t-\tRET\t# Reunion Time\nZone\tAfrica/Kigali\t2:00:16 -\tLMT\t1935 Jun\n\t\t\t2:00\t-\tCAT\nZone Atlantic/St_Helena\t-0:22:48 -\tLMT\t1890\t\t# Jamestown\n\t\t\t-0:22:48 -\tJMT\t1951\t# Jamestown Mean Time\n\t\t\t 0:00\t-\tGMT\nZone\tAfrica/Sao_Tome\t 0:26:56 -\tLMT\t1884\n\t\t\t-0:36:32 -\tLMT\t1912\t# Lisbon Mean Time\n\t\t\t 0:00\t-\tGMT\nZone\tAfrica/Dakar\t-1:09:44 -\tLMT\t1912\n\t\t\t-1:00\t-\tWAT\t1941 Jun\n\t\t\t 0:00\t-\tGMT\nZone\tIndian/Mahe\t3:41:48 -\tLMT\t1906 Jun\t# Victoria\n\t\t\t4:00\t-\tSCT\t# Seychelles Time\nRule\tSL\t1935\t1942\t-\tJun\t 1\t0:00\t0:40\tSLST\nRule\tSL\t1935\t1942\t-\tOct\t 1\t0:00\t0\tWAT\nRule\tSL\t1957\t1962\t-\tJun\t 1\t0:00\t1:00\tSLST\nRule\tSL\t1957\t1962\t-\tSep\t 1\t0:00\t0\tGMT\nZone\tAfrica/Freetown\t-0:53:00 -\tLMT\t1882\n\t\t\t-0:53:00 -\tFMT\t1913 Jun # Freetown Mean Time\n\t\t\t-1:00\tSL\t%s\t1957\n\t\t\t 0:00\tSL\t%s\nZone Africa/Mogadishu\t3:01:28 -\tLMT\t1893 Nov\n\t\t\t3:00\t-\tEAT\t1931\n\t\t\t2:30\t-\tBEAT\t1957\n\t\t\t3:00\t-\tEAT\nRule\tSA\t1942\t1943\t-\tSep\tSun>=15\t2:00\t1:00\t-\nRule\tSA\t1943\t1944\t-\tMar\tSun>=15\t2:00\t0\t-\nZone Africa/Johannesburg 1:52:00 -\tLMT\t1892 Feb 8\n\t\t\t1:30\t-\tSAST\t1903 Mar\n\t\t\t2:00\tSA\tSAST\nRule\tSudan\t1970\tonly\t-\tMay\t 1\t0:00\t1:00\tS\nRule\tSudan\t1970\t1985\t-\tOct\t15\t0:00\t0\t-\nRule\tSudan\t1971\tonly\t-\tApr\t30\t0:00\t1:00\tS\nRule\tSudan\t1972\t1985\t-\tApr\tlastSun\t0:00\t1:00\tS\nZone\tAfrica/Khartoum\t2:10:08 -\tLMT\t1931\n\t\t\t2:00\tSudan\tCA%sT\t2000 Jan 15 12:00\n\t\t\t3:00\t-\tEAT\nZone\tAfrica/Juba\t2:06:24 -\tLMT\t1931\n\t\t\t2:00\tSudan\tCA%sT\t2000 Jan 15 12:00\n\t\t\t3:00\t-\tEAT\nZone\tAfrica/Mbabane\t2:04:24 -\tLMT\t1903 Mar\n\t\t\t2:00\t-\tSAST\nZone Africa/Dar_es_Salaam 2:37:08 -\tLMT\t1931\n\t\t\t3:00\t-\tEAT\t1948\n\t\t\t2:45\t-\tBEAUT\t1961\n\t\t\t3:00\t-\tEAT\nZone\tAfrica/Lome\t0:04:52 -\tLMT\t1893\n\t\t\t0:00\t-\tGMT\nRule\tTunisia\t1939\tonly\t-\tApr\t15\t23:00s\t1:00\tS\nRule\tTunisia\t1939\tonly\t-\tNov\t18\t23:00s\t0\t-\nRule\tTunisia\t1940\tonly\t-\tFeb\t25\t23:00s\t1:00\tS\nRule\tTunisia\t1941\tonly\t-\tOct\t 6\t 0:00\t0\t-\nRule\tTunisia\t1942\tonly\t-\tMar\t 9\t 0:00\t1:00\tS\nRule\tTunisia\t1942\tonly\t-\tNov\t 2\t 3:00\t0\t-\nRule\tTunisia\t1943\tonly\t-\tMar\t29\t 2:00\t1:00\tS\nRule\tTunisia\t1943\tonly\t-\tApr\t17\t 2:00\t0\t-\nRule\tTunisia\t1943\tonly\t-\tApr\t25\t 2:00\t1:00\tS\nRule\tTunisia\t1943\tonly\t-\tOct\t 4\t 2:00\t0\t-\nRule\tTunisia\t1944\t1945\t-\tApr\tMon>=1\t 2:00\t1:00\tS\nRule\tTunisia\t1944\tonly\t-\tOct\t 8\t 0:00\t0\t-\nRule\tTunisia\t1945\tonly\t-\tSep\t16\t 0:00\t0\t-\nRule\tTunisia\t1977\tonly\t-\tApr\t30\t 0:00s\t1:00\tS\nRule\tTunisia\t1977\tonly\t-\tSep\t24\t 0:00s\t0\t-\nRule\tTunisia\t1978\tonly\t-\tMay\t 1\t 0:00s\t1:00\tS\nRule\tTunisia\t1978\tonly\t-\tOct\t 1\t 0:00s\t0\t-\nRule\tTunisia\t1988\tonly\t-\tJun\t 1\t 0:00s\t1:00\tS\nRule\tTunisia\t1988\t1990\t-\tSep\tlastSun\t 0:00s\t0\t-\nRule\tTunisia\t1989\tonly\t-\tMar\t26\t 0:00s\t1:00\tS\nRule\tTunisia\t1990\tonly\t-\tMay\t 1\t 0:00s\t1:00\tS\nRule\tTunisia\t2005\tonly\t-\tMay\t 1\t 0:00s\t1:00\tS\nRule\tTunisia\t2005\tonly\t-\tSep\t30\t 1:00s\t0\t-\nRule\tTunisia\t2006\t2008\t-\tMar\tlastSun\t 2:00s\t1:00\tS\nRule\tTunisia\t2006\t2008\t-\tOct\tlastSun\t 2:00s\t0\t-\nZone\tAfrica/Tunis\t0:40:44 -\tLMT\t1881 May 12\n\t\t\t0:09:21\t-\tPMT\t1911 Mar 11    # Paris Mean Time\n\t\t\t1:00\tTunisia\tCE%sT\nZone\tAfrica/Kampala\t2:09:40 -\tLMT\t1928 Jul\n\t\t\t3:00\t-\tEAT\t1930\n\t\t\t2:30\t-\tBEAT\t1948\n\t\t\t2:45\t-\tBEAUT\t1957\n\t\t\t3:00\t-\tEAT\nZone\tAfrica/Lusaka\t1:53:08 -\tLMT\t1903 Mar\n\t\t\t2:00\t-\tCAT\nZone\tAfrica/Harare\t2:04:12 -\tLMT\t1903 Mar\n\t\t\t2:00\t-\tCAT\n","tz/antarctica":"Rule\tArgAQ\t1964\t1966\t-\tMar\t 1\t0:00\t0\t-\nRule\tArgAQ\t1964\t1966\t-\tOct\t15\t0:00\t1:00\tS\nRule\tArgAQ\t1967\tonly\t-\tApr\t 2\t0:00\t0\t-\nRule\tArgAQ\t1967\t1968\t-\tOct\tSun>=1\t0:00\t1:00\tS\nRule\tArgAQ\t1968\t1969\t-\tApr\tSun>=1\t0:00\t0\t-\nRule\tArgAQ\t1974\tonly\t-\tJan\t23\t0:00\t1:00\tS\nRule\tArgAQ\t1974\tonly\t-\tMay\t 1\t0:00\t0\t-\nRule\tChileAQ\t1972\t1986\t-\tMar\tSun>=9\t3:00u\t0\t-\nRule\tChileAQ\t1974\t1987\t-\tOct\tSun>=9\t4:00u\t1:00\tS\nRule\tChileAQ\t1987\tonly\t-\tApr\t12\t3:00u\t0\t-\nRule\tChileAQ\t1988\t1989\t-\tMar\tSun>=9\t3:00u\t0\t-\nRule\tChileAQ\t1988\tonly\t-\tOct\tSun>=1\t4:00u\t1:00\tS\nRule\tChileAQ\t1989\tonly\t-\tOct\tSun>=9\t4:00u\t1:00\tS\nRule\tChileAQ\t1990\tonly\t-\tMar\t18\t3:00u\t0\t-\nRule\tChileAQ\t1990\tonly\t-\tSep\t16\t4:00u\t1:00\tS\nRule\tChileAQ\t1991\t1996\t-\tMar\tSun>=9\t3:00u\t0\t-\nRule\tChileAQ\t1991\t1997\t-\tOct\tSun>=9\t4:00u\t1:00\tS\nRule\tChileAQ\t1997\tonly\t-\tMar\t30\t3:00u\t0\t-\nRule\tChileAQ\t1998\tonly\t-\tMar\tSun>=9\t3:00u\t0\t-\nRule\tChileAQ\t1998\tonly\t-\tSep\t27\t4:00u\t1:00\tS\nRule\tChileAQ\t1999\tonly\t-\tApr\t 4\t3:00u\t0\t-\nRule\tChileAQ\t1999\tmax\t-\tOct\tSun>=9\t4:00u\t1:00\tS\nRule\tChileAQ\t2000\tmax\t-\tMar\tSun>=9\t3:00u\t0\t-\nRule\tAusAQ\t1917\tonly\t-\tJan\t 1\t0:01\t1:00\t-\nRule\tAusAQ\t1917\tonly\t-\tMar\t25\t2:00\t0\t-\nRule\tAusAQ\t1942\tonly\t-\tJan\t 1\t2:00\t1:00\t-\nRule\tAusAQ\t1942\tonly\t-\tMar\t29\t2:00\t0\t-\nRule\tAusAQ\t1942\tonly\t-\tSep\t27\t2:00\t1:00\t-\nRule\tAusAQ\t1943\t1944\t-\tMar\tlastSun\t2:00\t0\t-\nRule\tAusAQ\t1943\tonly\t-\tOct\t 3\t2:00\t1:00\t-\nRule\tATAQ\t1967\tonly\t-\tOct\tSun>=1\t2:00s\t1:00\t-\nRule\tATAQ\t1968\tonly\t-\tMar\tlastSun\t2:00s\t0\t-\nRule\tATAQ\t1968\t1985\t-\tOct\tlastSun\t2:00s\t1:00\t-\nRule\tATAQ\t1969\t1971\t-\tMar\tSun>=8\t2:00s\t0\t-\nRule\tATAQ\t1972\tonly\t-\tFeb\tlastSun\t2:00s\t0\t-\nRule\tATAQ\t1973\t1981\t-\tMar\tSun>=1\t2:00s\t0\t-\nRule\tATAQ\t1982\t1983\t-\tMar\tlastSun\t2:00s\t0\t-\nRule\tATAQ\t1984\t1986\t-\tMar\tSun>=1\t2:00s\t0\t-\nRule\tATAQ\t1986\tonly\t-\tOct\tSun>=15\t2:00s\t1:00\t-\nRule\tATAQ\t1987\t1990\t-\tMar\tSun>=15\t2:00s\t0\t-\nRule\tATAQ\t1987\tonly\t-\tOct\tSun>=22\t2:00s\t1:00\t-\nRule\tATAQ\t1988\t1990\t-\tOct\tlastSun\t2:00s\t1:00\t-\nRule\tATAQ\t1991\t1999\t-\tOct\tSun>=1\t2:00s\t1:00\t-\nRule\tATAQ\t1991\t2005\t-\tMar\tlastSun\t2:00s\t0\t-\nRule\tATAQ\t2000\tonly\t-\tAug\tlastSun\t2:00s\t1:00\t-\nRule\tATAQ\t2001\tmax\t-\tOct\tSun>=1\t2:00s\t1:00\t-\nRule\tATAQ\t2006\tonly\t-\tApr\tSun>=1\t2:00s\t0\t-\nRule\tATAQ\t2007\tonly\t-\tMar\tlastSun\t2:00s\t0\t-\nRule\tATAQ\t2008\tmax\t-\tApr\tSun>=1\t2:00s\t0\t-\nZone Antarctica/Casey\t0\t-\tzzz\t1969\n\t\t\t8:00\t-\tWST\t2009 Oct 18 2:00\n\t\t\t\t\t\t# Western (Aus) Standard Time\n\t\t\t11:00\t-\tCAST\t2010 Mar 5 2:00\n\t\t\t\t\t\t# Casey Time\n\t\t\t8:00\t-\tWST\nZone Antarctica/Davis\t0\t-\tzzz\t1957 Jan 13\n\t\t\t7:00\t-\tDAVT\t1964 Nov # Davis Time\n\t\t\t0\t-\tzzz\t1969 Feb\n\t\t\t7:00\t-\tDAVT\t2009 Oct 18 2:00\n\t\t\t5:00\t-\tDAVT\t2010 Mar 10 20:00u\n\t\t\t7:00\t-\tDAVT\nZone Antarctica/Mawson\t0\t-\tzzz\t1954 Feb 13\n\t\t\t6:00\t-\tMAWT\t2009 Oct 18 2:00\n\t\t\t\t\t\t# Mawson Time\n\t\t\t5:00\t-\tMAWT\nZone Antarctica/Macquarie 0\t-\tzzz\t1911\n\t\t\t10:00\t-\tEST\t1916 Oct 1 2:00\n\t\t\t10:00\t1:00\tEST\t1917 Feb\n\t\t\t10:00\tAusAQ\tEST\t1967\n\t\t\t10:00\tATAQ\tEST\t2010 Apr 4 3:00\n\t\t\t11:00\t-\tMIST\t# Macquarie Island Time\nZone Indian/Kerguelen\t0\t-\tzzz\t1950\t# Port-aux-Francais\n\t\t\t5:00\t-\tTFT\t# ISO code TF Time\nZone Antarctica/DumontDUrville 0 -\tzzz\t1947\n\t\t\t10:00\t-\tPMT\t1952 Jan 14 # Port-Martin Time\n\t\t\t0\t-\tzzz\t1956 Nov\n\t\t\t10:00\t-\tDDUT\t# Dumont-d'Urville Time\nZone Antarctica/Syowa\t0\t-\tzzz\t1957 Jan 29\n\t\t\t3:00\t-\tSYOT\t# Syowa Time\nRule\tNZAQ\t1974\tonly\t-\tNov\t 3\t2:00s\t1:00\tD\nRule\tNZAQ\t1975\t1988\t-\tOct\tlastSun\t2:00s\t1:00\tD\nRule\tNZAQ\t1989\tonly\t-\tOct\t 8\t2:00s\t1:00\tD\nRule\tNZAQ\t1990\t2006\t-\tOct\tSun>=1\t2:00s\t1:00\tD\nRule\tNZAQ\t1975\tonly\t-\tFeb\t23\t2:00s\t0\tS\nRule\tNZAQ\t1976\t1989\t-\tMar\tSun>=1\t2:00s\t0\tS\nRule\tNZAQ\t1990\t2007\t-\tMar\tSun>=15\t2:00s\t0\tS\nRule\tNZAQ\t2007\tmax\t-\tSep\tlastSun\t2:00s\t1:00\tD\nRule\tNZAQ\t2008\tmax\t-\tApr\tSun>=1\t2:00s\t0\tS\nZone Antarctica/Vostok\t0\t-\tzzz\t1957 Dec 16\n\t\t\t6:00\t-\tVOST\t# Vostok time\nZone Antarctica/Rothera\t0\t-\tzzz\t1976 Dec  1\n\t\t\t-3:00\t-\tROTT\t# Rothera time\nZone Antarctica/Palmer\t0\t-\tzzz\t1965\n\t\t\t-4:00\tArgAQ\tAR%sT\t1969 Oct 5\n\t\t\t-3:00\tArgAQ\tAR%sT\t1982 May\n\t\t\t-4:00\tChileAQ\tCL%sT\nZone Antarctica/McMurdo\t0\t-\tzzz\t1956\n\t\t\t12:00\tNZAQ\tNZ%sT\nLink\tAntarctica/McMurdo\tAntarctica/South_Pole\n","tz/asia":"Rule\tEUAsia\t1981\tmax\t-\tMar\tlastSun\t 1:00u\t1:00\tS\nRule\tEUAsia\t1979\t1995\t-\tSep\tlastSun\t 1:00u\t0\t-\nRule\tEUAsia\t1996\tmax\t-\tOct\tlastSun\t 1:00u\t0\t-\nRule E-EurAsia\t1981\tmax\t-\tMar\tlastSun\t 0:00\t1:00\tS\nRule E-EurAsia\t1979\t1995\t-\tSep\tlastSun\t 0:00\t0\t-\nRule E-EurAsia\t1996\tmax\t-\tOct\tlastSun\t 0:00\t0\t-\nRule RussiaAsia\t1981\t1984\t-\tApr\t1\t 0:00\t1:00\tS\nRule RussiaAsia\t1981\t1983\t-\tOct\t1\t 0:00\t0\t-\nRule RussiaAsia\t1984\t1991\t-\tSep\tlastSun\t 2:00s\t0\t-\nRule RussiaAsia\t1985\t1991\t-\tMar\tlastSun\t 2:00s\t1:00\tS\nRule RussiaAsia\t1992\tonly\t-\tMar\tlastSat\t23:00\t1:00\tS\nRule RussiaAsia\t1992\tonly\t-\tSep\tlastSat\t23:00\t0\t-\nRule RussiaAsia\t1993\tmax\t-\tMar\tlastSun\t 2:00s\t1:00\tS\nRule RussiaAsia\t1993\t1995\t-\tSep\tlastSun\t 2:00s\t0\t-\nRule RussiaAsia\t1996\tmax\t-\tOct\tlastSun\t 2:00s\t0\t-\nZone\tAsia/Kabul\t4:36:48 -\tLMT\t1890\n\t\t\t4:00\t-\tAFT\t1945\n\t\t\t4:30\t-\tAFT\nZone\tAsia/Yerevan\t2:58:00 -\tLMT\t1924 May  2\n\t\t\t3:00\t-\tYERT\t1957 Mar    # Yerevan Time\n\t\t\t4:00 RussiaAsia YER%sT\t1991 Mar 31 2:00s\n\t\t\t3:00\t1:00\tYERST\t1991 Sep 23 # independence\n\t\t\t3:00 RussiaAsia\tAM%sT\t1995 Sep 24 2:00s\n\t\t\t4:00\t-\tAMT\t1997\n\t\t\t4:00 RussiaAsia\tAM%sT\nRule\tAzer\t1997\tmax\t-\tMar\tlastSun\t 4:00\t1:00\tS\nRule\tAzer\t1997\tmax\t-\tOct\tlastSun\t 5:00\t0\t-\nZone\tAsia/Baku\t3:19:24 -\tLMT\t1924 May  2\n\t\t\t3:00\t-\tBAKT\t1957 Mar    # Baku Time\n\t\t\t4:00 RussiaAsia BAK%sT\t1991 Mar 31 2:00s\n\t\t\t3:00\t1:00\tBAKST\t1991 Aug 30 # independence\n\t\t\t3:00 RussiaAsia\tAZ%sT\t1992 Sep lastSat 23:00\n\t\t\t4:00\t-\tAZT\t1996 # Azerbaijan time\n\t\t\t4:00\tEUAsia\tAZ%sT\t1997\n\t\t\t4:00\tAzer\tAZ%sT\nZone\tAsia/Bahrain\t3:22:20 -\tLMT\t1920\t\t# Al Manamah\n\t\t\t4:00\t-\tGST\t1972 Jun\n\t\t\t3:00\t-\tAST\nRule\tDhaka\t2009\tonly\t-\tJun\t19\t23:00\t1:00\tS\nRule\tDhaka\t2009\tonly\t-\tDec\t31\t23:59\t0\t-\nZone\tAsia/Dhaka\t6:01:40 -\tLMT\t1890\n\t\t\t5:53:20\t-\tHMT\t1941 Oct    # Howrah Mean Time?\n\t\t\t6:30\t-\tBURT\t1942 May 15 # Burma Time\n\t\t\t5:30\t-\tIST\t1942 Sep\n\t\t\t6:30\t-\tBURT\t1951 Sep 30\n\t\t\t6:00\t-\tDACT\t1971 Mar 26 # Dacca Time\n\t\t\t6:00\t-\tBDT\t2009\n\t\t\t6:00\tDhaka\tBD%sT\nZone\tAsia/Thimphu\t5:58:36 -\tLMT\t1947 Aug 15 # or Thimbu\n\t\t\t5:30\t-\tIST\t1987 Oct\n\t\t\t6:00\t-\tBTT\t# Bhutan Time\nZone\tIndian/Chagos\t4:49:40\t-\tLMT\t1907\n\t\t\t5:00\t-\tIOT\t1996 # BIOT Time\n\t\t\t6:00\t-\tIOT\nZone\tAsia/Brunei\t7:39:40 -\tLMT\t1926 Mar   # Bandar Seri Begawan\n\t\t\t7:30\t-\tBNT\t1933\n\t\t\t8:00\t-\tBNT\nZone\tAsia/Rangoon\t6:24:40 -\tLMT\t1880\t\t# or Yangon\n\t\t\t6:24:36\t-\tRMT\t1920\t   # Rangoon Mean Time?\n\t\t\t6:30\t-\tBURT\t1942 May   # Burma Time\n\t\t\t9:00\t-\tJST\t1945 May 3\n\t\t\t6:30\t-\tMMT\t\t   # Myanmar Time\nZone\tAsia/Phnom_Penh\t6:59:40 -\tLMT\t1906 Jun  9\n\t\t\t7:06:20\t-\tSMT\t1911 Mar 11 0:01 # Saigon MT?\n\t\t\t7:00\t-\tICT\t1912 May\n\t\t\t8:00\t-\tICT\t1931 May\n\t\t\t7:00\t-\tICT\nRule\tShang\t1940\tonly\t-\tJun\t 3\t0:00\t1:00\tD\nRule\tShang\t1940\t1941\t-\tOct\t 1\t0:00\t0\tS\nRule\tShang\t1941\tonly\t-\tMar\t16\t0:00\t1:00\tD\nRule\tPRC\t1986\tonly\t-\tMay\t 4\t0:00\t1:00\tD\nRule\tPRC\t1986\t1991\t-\tSep\tSun>=11\t0:00\t0\tS\nRule\tPRC\t1987\t1991\t-\tApr\tSun>=10\t0:00\t1:00\tD\nZone\tAsia/Harbin\t8:26:44\t-\tLMT\t1928 # or Haerbin\n\t\t\t8:30\t-\tCHAT\t1932 Mar # Changbai Time\n\t\t\t8:00\t-\tCST\t1940\n\t\t\t9:00\t-\tCHAT\t1966 May\n\t\t\t8:30\t-\tCHAT\t1980 May\n\t\t\t8:00\tPRC\tC%sT\nZone\tAsia/Shanghai\t8:05:52\t-\tLMT\t1928\n\t\t\t8:00\tShang\tC%sT\t1949\n\t\t\t8:00\tPRC\tC%sT\nZone\tAsia/Chongqing\t7:06:20\t-\tLMT\t1928 # or Chungking\n\t\t\t7:00\t-\tLONT\t1980 May # Long-shu Time\n\t\t\t8:00\tPRC\tC%sT\nZone\tAsia/Urumqi\t5:50:20\t-\tLMT\t1928 # or Urumchi\n\t\t\t6:00\t-\tURUT\t1980 May # Urumqi Time\n\t\t\t8:00\tPRC\tC%sT\nZone\tAsia/Kashgar\t5:03:56\t-\tLMT\t1928 # or Kashi or Kaxgar\n\t\t\t5:30\t-\tKAST\t1940\t # Kashgar Time\n\t\t\t5:00\t-\tKAST\t1980 May\n\t\t\t8:00\tPRC\tC%sT\nRule\tHK\t1941\tonly\t-\tApr\t1\t3:30\t1:00\tS\nRule\tHK\t1941\tonly\t-\tSep\t30\t3:30\t0\t-\nRule\tHK\t1946\tonly\t-\tApr\t20\t3:30\t1:00\tS\nRule\tHK\t1946\tonly\t-\tDec\t1\t3:30\t0\t-\nRule\tHK\t1947\tonly\t-\tApr\t13\t3:30\t1:00\tS\nRule\tHK\t1947\tonly\t-\tDec\t30\t3:30\t0\t-\nRule\tHK\t1948\tonly\t-\tMay\t2\t3:30\t1:00\tS\nRule\tHK\t1948\t1951\t-\tOct\tlastSun\t3:30\t0\t-\nRule\tHK\t1952\tonly\t-\tOct\t25\t3:30\t0\t-\nRule\tHK\t1949\t1953\t-\tApr\tSun>=1\t3:30\t1:00\tS\nRule\tHK\t1953\tonly\t-\tNov\t1\t3:30\t0\t-\nRule\tHK\t1954\t1964\t-\tMar\tSun>=18\t3:30\t1:00\tS\nRule\tHK\t1954\tonly\t-\tOct\t31\t3:30\t0\t-\nRule\tHK\t1955\t1964\t-\tNov\tSun>=1\t3:30\t0\t-\nRule\tHK\t1965\t1976\t-\tApr\tSun>=16\t3:30\t1:00\tS\nRule\tHK\t1965\t1976\t-\tOct\tSun>=16\t3:30\t0\t-\nRule\tHK\t1973\tonly\t-\tDec\t30\t3:30\t1:00\tS\nRule\tHK\t1979\tonly\t-\tMay\tSun>=8\t3:30\t1:00\tS\nRule\tHK\t1979\tonly\t-\tOct\tSun>=16\t3:30\t0\t-\nZone\tAsia/Hong_Kong\t7:36:36 -\tLMT\t1904 Oct 30\n\t\t\t8:00\tHK\tHK%sT\t1941 Dec 25\n\t\t\t9:00\t-\tJST\t1945 Sep 15\n\t\t\t8:00\tHK\tHK%sT\nRule\tTaiwan\t1945\t1951\t-\tMay\t1\t0:00\t1:00\tD\nRule\tTaiwan\t1945\t1951\t-\tOct\t1\t0:00\t0\tS\nRule\tTaiwan\t1952\tonly\t-\tMar\t1\t0:00\t1:00\tD\nRule\tTaiwan\t1952\t1954\t-\tNov\t1\t0:00\t0\tS\nRule\tTaiwan\t1953\t1959\t-\tApr\t1\t0:00\t1:00\tD\nRule\tTaiwan\t1955\t1961\t-\tOct\t1\t0:00\t0\tS\nRule\tTaiwan\t1960\t1961\t-\tJun\t1\t0:00\t1:00\tD\nRule\tTaiwan\t1974\t1975\t-\tApr\t1\t0:00\t1:00\tD\nRule\tTaiwan\t1974\t1975\t-\tOct\t1\t0:00\t0\tS\nRule\tTaiwan\t1979\tonly\t-\tJun\t30\t0:00\t1:00\tD\nRule\tTaiwan\t1979\tonly\t-\tSep\t30\t0:00\t0\tS\nZone\tAsia/Taipei\t8:06:00 -\tLMT\t1896 # or Taibei or T'ai-pei\n\t\t\t8:00\tTaiwan\tC%sT\nRule\tMacau\t1961\t1962\t-\tMar\tSun>=16\t3:30\t1:00\tS\nRule\tMacau\t1961\t1964\t-\tNov\tSun>=1\t3:30\t0\t-\nRule\tMacau\t1963\tonly\t-\tMar\tSun>=16\t0:00\t1:00\tS\nRule\tMacau\t1964\tonly\t-\tMar\tSun>=16\t3:30\t1:00\tS\nRule\tMacau\t1965\tonly\t-\tMar\tSun>=16\t0:00\t1:00\tS\nRule\tMacau\t1965\tonly\t-\tOct\t31\t0:00\t0\t-\nRule\tMacau\t1966\t1971\t-\tApr\tSun>=16\t3:30\t1:00\tS\nRule\tMacau\t1966\t1971\t-\tOct\tSun>=16\t3:30\t0\t-\nRule\tMacau\t1972\t1974\t-\tApr\tSun>=15\t0:00\t1:00\tS\nRule\tMacau\t1972\t1973\t-\tOct\tSun>=15\t0:00\t0\t-\nRule\tMacau\t1974\t1977\t-\tOct\tSun>=15\t3:30\t0\t-\nRule\tMacau\t1975\t1977\t-\tApr\tSun>=15\t3:30\t1:00\tS\nRule\tMacau\t1978\t1980\t-\tApr\tSun>=15\t0:00\t1:00\tS\nRule\tMacau\t1978\t1980\t-\tOct\tSun>=15\t0:00\t0\t-\nZone\tAsia/Macau\t7:34:20 -\tLMT\t1912\n\t\t\t8:00\tMacau\tMO%sT\t1999 Dec 20 # return to China\n\t\t\t8:00\tPRC\tC%sT\nRule\tCyprus\t1975\tonly\t-\tApr\t13\t0:00\t1:00\tS\nRule\tCyprus\t1975\tonly\t-\tOct\t12\t0:00\t0\t-\nRule\tCyprus\t1976\tonly\t-\tMay\t15\t0:00\t1:00\tS\nRule\tCyprus\t1976\tonly\t-\tOct\t11\t0:00\t0\t-\nRule\tCyprus\t1977\t1980\t-\tApr\tSun>=1\t0:00\t1:00\tS\nRule\tCyprus\t1977\tonly\t-\tSep\t25\t0:00\t0\t-\nRule\tCyprus\t1978\tonly\t-\tOct\t2\t0:00\t0\t-\nRule\tCyprus\t1979\t1997\t-\tSep\tlastSun\t0:00\t0\t-\nRule\tCyprus\t1981\t1998\t-\tMar\tlastSun\t0:00\t1:00\tS\nZone\tAsia/Nicosia\t2:13:28 -\tLMT\t1921 Nov 14\n\t\t\t2:00\tCyprus\tEE%sT\t1998 Sep\n\t\t\t2:00\tEUAsia\tEE%sT\nLink\tAsia/Nicosia\tEurope/Nicosia\nZone\tAsia/Tbilisi\t2:59:16 -\tLMT\t1880\n\t\t\t2:59:16\t-\tTBMT\t1924 May  2 # Tbilisi Mean Time\n\t\t\t3:00\t-\tTBIT\t1957 Mar    # Tbilisi Time\n\t\t\t4:00 RussiaAsia TBI%sT\t1991 Mar 31 2:00s\n\t\t\t3:00\t1:00\tTBIST\t1991 Apr  9 # independence\n\t\t\t3:00 RussiaAsia GE%sT\t1992 # Georgia Time\n\t\t\t3:00 E-EurAsia\tGE%sT\t1994 Sep lastSun\n\t\t\t4:00 E-EurAsia\tGE%sT\t1996 Oct lastSun\n\t\t\t4:00\t1:00\tGEST\t1997 Mar lastSun\n\t\t\t4:00 E-EurAsia\tGE%sT\t2004 Jun 27\n\t\t\t3:00 RussiaAsia\tGE%sT\t2005 Mar lastSun 2:00\n\t\t\t4:00\t-\tGET\nZone\tAsia/Dili\t8:22:20 -\tLMT\t1912\n\t\t\t8:00\t-\tTLT\t1942 Feb 21 23:00 # E Timor Time\n\t\t\t9:00\t-\tJST\t1945 Sep 23\n\t\t\t9:00\t-\tTLT\t1976 May  3\n\t\t\t8:00\t-\tCIT\t2000 Sep 17 00:00\n\t\t\t9:00\t-\tTLT\nZone\tAsia/Kolkata\t5:53:28 -\tLMT\t1880\t# Kolkata\n\t\t\t5:53:20\t-\tHMT\t1941 Oct    # Howrah Mean Time?\n\t\t\t6:30\t-\tBURT\t1942 May 15 # Burma Time\n\t\t\t5:30\t-\tIST\t1942 Sep\n\t\t\t5:30\t1:00\tIST\t1945 Oct 15\n\t\t\t5:30\t-\tIST\nZone Asia/Jakarta\t7:07:12 -\tLMT\t1867 Aug 10\n\t\t\t7:07:12\t-\tJMT\t1923 Dec 31 23:47:12 # Jakarta\n\t\t\t7:20\t-\tJAVT\t1932 Nov\t # Java Time\n\t\t\t7:30\t-\tWIT\t1942 Mar 23\n\t\t\t9:00\t-\tJST\t1945 Sep 23\n\t\t\t7:30\t-\tWIT\t1948 May\n\t\t\t8:00\t-\tWIT\t1950 May\n\t\t\t7:30\t-\tWIT\t1964\n\t\t\t7:00\t-\tWIT\nZone Asia/Pontianak\t7:17:20\t-\tLMT\t1908 May\n\t\t\t7:17:20\t-\tPMT\t1932 Nov    # Pontianak MT\n\t\t\t7:30\t-\tWIT\t1942 Jan 29\n\t\t\t9:00\t-\tJST\t1945 Sep 23\n\t\t\t7:30\t-\tWIT\t1948 May\n\t\t\t8:00\t-\tWIT\t1950 May\n\t\t\t7:30\t-\tWIT\t1964\n\t\t\t8:00\t-\tCIT\t1988 Jan  1\n\t\t\t7:00\t-\tWIT\nZone Asia/Makassar\t7:57:36 -\tLMT\t1920\n\t\t\t7:57:36\t-\tMMT\t1932 Nov    # Macassar MT\n\t\t\t8:00\t-\tCIT\t1942 Feb  9\n\t\t\t9:00\t-\tJST\t1945 Sep 23\n\t\t\t8:00\t-\tCIT\nZone Asia/Jayapura\t9:22:48 -\tLMT\t1932 Nov\n\t\t\t9:00\t-\tEIT\t1944 Sep  1\n\t\t\t9:30\t-\tCST\t1964\n\t\t\t9:00\t-\tEIT\nRule\tIran\t1978\t1980\t-\tMar\t21\t0:00\t1:00\tD\nRule\tIran\t1978\tonly\t-\tOct\t21\t0:00\t0\tS\nRule\tIran\t1979\tonly\t-\tSep\t19\t0:00\t0\tS\nRule\tIran\t1980\tonly\t-\tSep\t23\t0:00\t0\tS\nRule\tIran\t1991\tonly\t-\tMay\t 3\t0:00\t1:00\tD\nRule\tIran\t1992\t1995\t-\tMar\t22\t0:00\t1:00\tD\nRule\tIran\t1991\t1995\t-\tSep\t22\t0:00\t0\tS\nRule\tIran\t1996\tonly\t-\tMar\t21\t0:00\t1:00\tD\nRule\tIran\t1996\tonly\t-\tSep\t21\t0:00\t0\tS\nRule\tIran\t1997\t1999\t-\tMar\t22\t0:00\t1:00\tD\nRule\tIran\t1997\t1999\t-\tSep\t22\t0:00\t0\tS\nRule\tIran\t2000\tonly\t-\tMar\t21\t0:00\t1:00\tD\nRule\tIran\t2000\tonly\t-\tSep\t21\t0:00\t0\tS\nRule\tIran\t2001\t2003\t-\tMar\t22\t0:00\t1:00\tD\nRule\tIran\t2001\t2003\t-\tSep\t22\t0:00\t0\tS\nRule\tIran\t2004\tonly\t-\tMar\t21\t0:00\t1:00\tD\nRule\tIran\t2004\tonly\t-\tSep\t21\t0:00\t0\tS\nRule\tIran\t2005\tonly\t-\tMar\t22\t0:00\t1:00\tD\nRule\tIran\t2005\tonly\t-\tSep\t22\t0:00\t0\tS\nRule\tIran\t2008\tonly\t-\tMar\t21\t0:00\t1:00\tD\nRule\tIran\t2008\tonly\t-\tSep\t21\t0:00\t0\tS\nRule\tIran\t2009\t2011\t-\tMar\t22\t0:00\t1:00\tD\nRule\tIran\t2009\t2011\t-\tSep\t22\t0:00\t0\tS\nRule\tIran\t2012\tonly\t-\tMar\t21\t0:00\t1:00\tD\nRule\tIran\t2012\tonly\t-\tSep\t21\t0:00\t0\tS\nRule\tIran\t2013\t2015\t-\tMar\t22\t0:00\t1:00\tD\nRule\tIran\t2013\t2015\t-\tSep\t22\t0:00\t0\tS\nRule\tIran\t2016\tonly\t-\tMar\t21\t0:00\t1:00\tD\nRule\tIran\t2016\tonly\t-\tSep\t21\t0:00\t0\tS\nRule\tIran\t2017\t2019\t-\tMar\t22\t0:00\t1:00\tD\nRule\tIran\t2017\t2019\t-\tSep\t22\t0:00\t0\tS\nRule\tIran\t2020\tonly\t-\tMar\t21\t0:00\t1:00\tD\nRule\tIran\t2020\tonly\t-\tSep\t21\t0:00\t0\tS\nRule\tIran\t2021\t2023\t-\tMar\t22\t0:00\t1:00\tD\nRule\tIran\t2021\t2023\t-\tSep\t22\t0:00\t0\tS\nRule\tIran\t2024\tonly\t-\tMar\t21\t0:00\t1:00\tD\nRule\tIran\t2024\tonly\t-\tSep\t21\t0:00\t0\tS\nRule\tIran\t2025\t2027\t-\tMar\t22\t0:00\t1:00\tD\nRule\tIran\t2025\t2027\t-\tSep\t22\t0:00\t0\tS\nRule\tIran\t2028\t2029\t-\tMar\t21\t0:00\t1:00\tD\nRule\tIran\t2028\t2029\t-\tSep\t21\t0:00\t0\tS\nRule\tIran\t2030\t2031\t-\tMar\t22\t0:00\t1:00\tD\nRule\tIran\t2030\t2031\t-\tSep\t22\t0:00\t0\tS\nRule\tIran\t2032\t2033\t-\tMar\t21\t0:00\t1:00\tD\nRule\tIran\t2032\t2033\t-\tSep\t21\t0:00\t0\tS\nRule\tIran\t2034\t2035\t-\tMar\t22\t0:00\t1:00\tD\nRule\tIran\t2034\t2035\t-\tSep\t22\t0:00\t0\tS\nRule\tIran\t2036\t2037\t-\tMar\t21\t0:00\t1:00\tD\nRule\tIran\t2036\t2037\t-\tSep\t21\t0:00\t0\tS\nZone\tAsia/Tehran\t3:25:44\t-\tLMT\t1916\n\t\t\t3:25:44\t-\tTMT\t1946\t# Tehran Mean Time\n\t\t\t3:30\t-\tIRST\t1977 Nov\n\t\t\t4:00\tIran\tIR%sT\t1979\n\t\t\t3:30\tIran\tIR%sT\nRule\tIraq\t1982\tonly\t-\tMay\t1\t0:00\t1:00\tD\nRule\tIraq\t1982\t1984\t-\tOct\t1\t0:00\t0\tS\nRule\tIraq\t1983\tonly\t-\tMar\t31\t0:00\t1:00\tD\nRule\tIraq\t1984\t1985\t-\tApr\t1\t0:00\t1:00\tD\nRule\tIraq\t1985\t1990\t-\tSep\tlastSun\t1:00s\t0\tS\nRule\tIraq\t1986\t1990\t-\tMar\tlastSun\t1:00s\t1:00\tD\nRule\tIraq\t1991\t2007\t-\tApr\t 1\t3:00s\t1:00\tD\nRule\tIraq\t1991\t2007\t-\tOct\t 1\t3:00s\t0\tS\nZone\tAsia/Baghdad\t2:57:40\t-\tLMT\t1890\n\t\t\t2:57:36\t-\tBMT\t1918\t    # Baghdad Mean Time?\n\t\t\t3:00\t-\tAST\t1982 May\n\t\t\t3:00\tIraq\tA%sT\nRule\tZion\t1940\tonly\t-\tJun\t 1\t0:00\t1:00\tD\nRule\tZion\t1942\t1944\t-\tNov\t 1\t0:00\t0\tS\nRule\tZion\t1943\tonly\t-\tApr\t 1\t2:00\t1:00\tD\nRule\tZion\t1944\tonly\t-\tApr\t 1\t0:00\t1:00\tD\nRule\tZion\t1945\tonly\t-\tApr\t16\t0:00\t1:00\tD\nRule\tZion\t1945\tonly\t-\tNov\t 1\t2:00\t0\tS\nRule\tZion\t1946\tonly\t-\tApr\t16\t2:00\t1:00\tD\nRule\tZion\t1946\tonly\t-\tNov\t 1\t0:00\t0\tS\nRule\tZion\t1948\tonly\t-\tMay\t23\t0:00\t2:00\tDD\nRule\tZion\t1948\tonly\t-\tSep\t 1\t0:00\t1:00\tD\nRule\tZion\t1948\t1949\t-\tNov\t 1\t2:00\t0\tS\nRule\tZion\t1949\tonly\t-\tMay\t 1\t0:00\t1:00\tD\nRule\tZion\t1950\tonly\t-\tApr\t16\t0:00\t1:00\tD\nRule\tZion\t1950\tonly\t-\tSep\t15\t3:00\t0\tS\nRule\tZion\t1951\tonly\t-\tApr\t 1\t0:00\t1:00\tD\nRule\tZion\t1951\tonly\t-\tNov\t11\t3:00\t0\tS\nRule\tZion\t1952\tonly\t-\tApr\t20\t2:00\t1:00\tD\nRule\tZion\t1952\tonly\t-\tOct\t19\t3:00\t0\tS\nRule\tZion\t1953\tonly\t-\tApr\t12\t2:00\t1:00\tD\nRule\tZion\t1953\tonly\t-\tSep\t13\t3:00\t0\tS\nRule\tZion\t1954\tonly\t-\tJun\t13\t0:00\t1:00\tD\nRule\tZion\t1954\tonly\t-\tSep\t12\t0:00\t0\tS\nRule\tZion\t1955\tonly\t-\tJun\t11\t2:00\t1:00\tD\nRule\tZion\t1955\tonly\t-\tSep\t11\t0:00\t0\tS\nRule\tZion\t1956\tonly\t-\tJun\t 3\t0:00\t1:00\tD\nRule\tZion\t1956\tonly\t-\tSep\t30\t3:00\t0\tS\nRule\tZion\t1957\tonly\t-\tApr\t29\t2:00\t1:00\tD\nRule\tZion\t1957\tonly\t-\tSep\t22\t0:00\t0\tS\nRule\tZion\t1974\tonly\t-\tJul\t 7\t0:00\t1:00\tD\nRule\tZion\t1974\tonly\t-\tOct\t13\t0:00\t0\tS\nRule\tZion\t1975\tonly\t-\tApr\t20\t0:00\t1:00\tD\nRule\tZion\t1975\tonly\t-\tAug\t31\t0:00\t0\tS\nRule\tZion\t1985\tonly\t-\tApr\t14\t0:00\t1:00\tD\nRule\tZion\t1985\tonly\t-\tSep\t15\t0:00\t0\tS\nRule\tZion\t1986\tonly\t-\tMay\t18\t0:00\t1:00\tD\nRule\tZion\t1986\tonly\t-\tSep\t 7\t0:00\t0\tS\nRule\tZion\t1987\tonly\t-\tApr\t15\t0:00\t1:00\tD\nRule\tZion\t1987\tonly\t-\tSep\t13\t0:00\t0\tS\nRule\tZion\t1988\tonly\t-\tApr\t 9\t0:00\t1:00\tD\nRule\tZion\t1988\tonly\t-\tSep\t 3\t0:00\t0\tS\nRule\tZion\t1989\tonly\t-\tApr\t30\t0:00\t1:00\tD\nRule\tZion\t1989\tonly\t-\tSep\t 3\t0:00\t0\tS\nRule\tZion\t1990\tonly\t-\tMar\t25\t0:00\t1:00\tD\nRule\tZion\t1990\tonly\t-\tAug\t26\t0:00\t0\tS\nRule\tZion\t1991\tonly\t-\tMar\t24\t0:00\t1:00\tD\nRule\tZion\t1991\tonly\t-\tSep\t 1\t0:00\t0\tS\nRule\tZion\t1992\tonly\t-\tMar\t29\t0:00\t1:00\tD\nRule\tZion\t1992\tonly\t-\tSep\t 6\t0:00\t0\tS\nRule\tZion\t1993\tonly\t-\tApr\t 2\t0:00\t1:00\tD\nRule\tZion\t1993\tonly\t-\tSep\t 5\t0:00\t0\tS\nRule\tZion\t1994\tonly\t-\tApr\t 1\t0:00\t1:00\tD\nRule\tZion\t1994\tonly\t-\tAug\t28\t0:00\t0\tS\nRule\tZion\t1995\tonly\t-\tMar\t31\t0:00\t1:00\tD\nRule\tZion\t1995\tonly\t-\tSep\t 3\t0:00\t0\tS\nRule\tZion\t1996\tonly\t-\tMar\t15\t0:00\t1:00\tD\nRule\tZion\t1996\tonly\t-\tSep\t16\t0:00\t0\tS\nRule\tZion\t1997\tonly\t-\tMar\t21\t0:00\t1:00\tD\nRule\tZion\t1997\tonly\t-\tSep\t14\t0:00\t0\tS\nRule\tZion\t1998\tonly\t-\tMar\t20\t0:00\t1:00\tD\nRule\tZion\t1998\tonly\t-\tSep\t 6\t0:00\t0\tS\nRule\tZion\t1999\tonly\t-\tApr\t 2\t2:00\t1:00\tD\nRule\tZion\t1999\tonly\t-\tSep\t 3\t2:00\t0\tS\nRule\tZion\t2000\tonly\t-\tApr\t14\t2:00\t1:00\tD\nRule\tZion\t2000\tonly\t-\tOct\t 6\t1:00\t0\tS\nRule\tZion\t2001\tonly\t-\tApr\t 9\t1:00\t1:00\tD\nRule\tZion\t2001\tonly\t-\tSep\t24\t1:00\t0\tS\nRule\tZion\t2002\tonly\t-\tMar\t29\t1:00\t1:00\tD\nRule\tZion\t2002\tonly\t-\tOct\t 7\t1:00\t0\tS\nRule\tZion\t2003\tonly\t-\tMar\t28\t1:00\t1:00\tD\nRule\tZion\t2003\tonly\t-\tOct\t 3\t1:00\t0\tS\nRule\tZion\t2004\tonly\t-\tApr\t 7\t1:00\t1:00\tD\nRule\tZion\t2004\tonly\t-\tSep\t22\t1:00\t0\tS\nRule\tZion\t2005\tonly\t-\tApr\t 1\t2:00\t1:00\tD\nRule\tZion\t2005\tonly\t-\tOct\t 9\t2:00\t0\tS\nRule\tZion\t2006\t2010\t-\tMar\tFri>=26\t2:00\t1:00\tD\nRule\tZion\t2006\tonly\t-\tOct\t 1\t2:00\t0\tS\nRule\tZion\t2007\tonly\t-\tSep\t16\t2:00\t0\tS\nRule\tZion\t2008\tonly\t-\tOct\t 5\t2:00\t0\tS\nRule\tZion\t2009\tonly\t-\tSep\t27\t2:00\t0\tS\nRule\tZion\t2010\tonly\t-\tSep\t12\t2:00\t0\tS\nRule\tZion\t2011\tonly\t-\tApr\t 1\t2:00\t1:00\tD\nRule\tZion\t2011\tonly\t-\tOct\t 2\t2:00\t0\tS\nRule\tZion\t2012\t2015\t-\tMar\tFri>=26\t2:00\t1:00\tD\nRule\tZion\t2012\tonly\t-\tSep\t23\t2:00\t0\tS\nRule\tZion\t2013\tonly\t-\tSep\t 8\t2:00\t0\tS\nRule\tZion\t2014\tonly\t-\tSep\t28\t2:00\t0\tS\nRule\tZion\t2015\tonly\t-\tSep\t20\t2:00\t0\tS\nRule\tZion\t2016\tonly\t-\tApr\t 1\t2:00\t1:00\tD\nRule\tZion\t2016\tonly\t-\tOct\t 9\t2:00\t0\tS\nRule\tZion\t2017\t2021\t-\tMar\tFri>=26\t2:00\t1:00\tD\nRule\tZion\t2017\tonly\t-\tSep\t24\t2:00\t0\tS\nRule\tZion\t2018\tonly\t-\tSep\t16\t2:00\t0\tS\nRule\tZion\t2019\tonly\t-\tOct\t 6\t2:00\t0\tS\nRule\tZion\t2020\tonly\t-\tSep\t27\t2:00\t0\tS\nRule\tZion\t2021\tonly\t-\tSep\t12\t2:00\t0\tS\nRule\tZion\t2022\tonly\t-\tApr\t 1\t2:00\t1:00\tD\nRule\tZion\t2022\tonly\t-\tOct\t 2\t2:00\t0\tS\nRule\tZion\t2023\t2032\t-\tMar\tFri>=26\t2:00\t1:00\tD\nRule\tZion\t2023\tonly\t-\tSep\t24\t2:00\t0\tS\nRule\tZion\t2024\tonly\t-\tOct\t 6\t2:00\t0\tS\nRule\tZion\t2025\tonly\t-\tSep\t28\t2:00\t0\tS\nRule\tZion\t2026\tonly\t-\tSep\t20\t2:00\t0\tS\nRule\tZion\t2027\tonly\t-\tOct\t10\t2:00\t0\tS\nRule\tZion\t2028\tonly\t-\tSep\t24\t2:00\t0\tS\nRule\tZion\t2029\tonly\t-\tSep\t16\t2:00\t0\tS\nRule\tZion\t2030\tonly\t-\tOct\t 6\t2:00\t0\tS\nRule\tZion\t2031\tonly\t-\tSep\t21\t2:00\t0\tS\nRule\tZion\t2032\tonly\t-\tSep\t12\t2:00\t0\tS\nRule\tZion\t2033\tonly\t-\tApr\t 1\t2:00\t1:00\tD\nRule\tZion\t2033\tonly\t-\tOct\t 2\t2:00\t0\tS\nRule\tZion\t2034\t2037\t-\tMar\tFri>=26\t2:00\t1:00\tD\nRule\tZion\t2034\tonly\t-\tSep\t17\t2:00\t0\tS\nRule\tZion\t2035\tonly\t-\tOct\t 7\t2:00\t0\tS\nRule\tZion\t2036\tonly\t-\tSep\t28\t2:00\t0\tS\nRule\tZion\t2037\tonly\t-\tSep\t13\t2:00\t0\tS\nZone\tAsia/Jerusalem\t2:20:56 -\tLMT\t1880\n\t\t\t2:20:40\t-\tJMT\t1918\t# Jerusalem Mean Time?\n\t\t\t2:00\tZion\tI%sT\nRule\tJapan\t1948\tonly\t-\tMay\tSun>=1\t2:00\t1:00\tD\nRule\tJapan\t1948\t1951\t-\tSep\tSat>=8\t2:00\t0\tS\nRule\tJapan\t1949\tonly\t-\tApr\tSun>=1\t2:00\t1:00\tD\nRule\tJapan\t1950\t1951\t-\tMay\tSun>=1\t2:00\t1:00\tD\nZone\tAsia/Tokyo\t9:18:59\t-\tLMT\t1887 Dec 31 15:00u\n\t\t\t9:00\t-\tJST\t1896\n\t\t\t9:00\t-\tCJT\t1938\n\t\t\t9:00\tJapan\tJ%sT\nRule\tJordan\t1973\tonly\t-\tJun\t6\t0:00\t1:00\tS\nRule\tJordan\t1973\t1975\t-\tOct\t1\t0:00\t0\t-\nRule\tJordan\t1974\t1977\t-\tMay\t1\t0:00\t1:00\tS\nRule\tJordan\t1976\tonly\t-\tNov\t1\t0:00\t0\t-\nRule\tJordan\t1977\tonly\t-\tOct\t1\t0:00\t0\t-\nRule\tJordan\t1978\tonly\t-\tApr\t30\t0:00\t1:00\tS\nRule\tJordan\t1978\tonly\t-\tSep\t30\t0:00\t0\t-\nRule\tJordan\t1985\tonly\t-\tApr\t1\t0:00\t1:00\tS\nRule\tJordan\t1985\tonly\t-\tOct\t1\t0:00\t0\t-\nRule\tJordan\t1986\t1988\t-\tApr\tFri>=1\t0:00\t1:00\tS\nRule\tJordan\t1986\t1990\t-\tOct\tFri>=1\t0:00\t0\t-\nRule\tJordan\t1989\tonly\t-\tMay\t8\t0:00\t1:00\tS\nRule\tJordan\t1990\tonly\t-\tApr\t27\t0:00\t1:00\tS\nRule\tJordan\t1991\tonly\t-\tApr\t17\t0:00\t1:00\tS\nRule\tJordan\t1991\tonly\t-\tSep\t27\t0:00\t0\t-\nRule\tJordan\t1992\tonly\t-\tApr\t10\t0:00\t1:00\tS\nRule\tJordan\t1992\t1993\t-\tOct\tFri>=1\t0:00\t0\t-\nRule\tJordan\t1993\t1998\t-\tApr\tFri>=1\t0:00\t1:00\tS\nRule\tJordan\t1994\tonly\t-\tSep\tFri>=15\t0:00\t0\t-\nRule\tJordan\t1995\t1998\t-\tSep\tFri>=15\t0:00s\t0\t-\nRule\tJordan\t1999\tonly\t-\tJul\t 1\t0:00s\t1:00\tS\nRule\tJordan\t1999\t2002\t-\tSep\tlastFri\t0:00s\t0\t-\nRule\tJordan\t2000\t2001\t-\tMar\tlastThu\t0:00s\t1:00\tS\nRule\tJordan\t2002\tmax\t-\tMar\tlastThu\t24:00\t1:00\tS\nRule\tJordan\t2003\tonly\t-\tOct\t24\t0:00s\t0\t-\nRule\tJordan\t2004\tonly\t-\tOct\t15\t0:00s\t0\t-\nRule\tJordan\t2005\tonly\t-\tSep\tlastFri\t0:00s\t0\t-\nRule\tJordan\t2006\tmax\t-\tOct\tlastFri\t0:00s\t0\t-\nZone\tAsia/Amman\t2:23:44 -\tLMT\t1931\n\t\t\t2:00\tJordan\tEE%sT\nZone\tAsia/Almaty\t5:07:48 -\tLMT\t1924 May  2 # or Alma-Ata\n\t\t\t5:00\t-\tALMT\t1930 Jun 21 # Alma-Ata Time\n\t\t\t6:00 RussiaAsia ALM%sT\t1991\n\t\t\t6:00\t-\tALMT\t1992\n\t\t\t6:00 RussiaAsia\tALM%sT\t2005 Mar 15\n\t\t\t6:00\t-\tALMT\nZone\tAsia/Qyzylorda\t4:21:52 -\tLMT\t1924 May  2\n\t\t\t4:00\t-\tKIZT\t1930 Jun 21 # Kizilorda Time\n\t\t\t5:00\t-\tKIZT\t1981 Apr  1\n\t\t\t5:00\t1:00\tKIZST\t1981 Oct  1\n\t\t\t6:00\t-\tKIZT\t1982 Apr  1\n\t\t\t5:00 RussiaAsia\tKIZ%sT\t1991\n\t\t\t5:00\t-\tKIZT\t1991 Dec 16 # independence\n\t\t\t5:00\t-\tQYZT\t1992 Jan 19 2:00\n\t\t\t6:00 RussiaAsia\tQYZ%sT\t2005 Mar 15\n\t\t\t6:00\t-\tQYZT\nZone\tAsia/Aqtobe\t3:48:40\t-\tLMT\t1924 May  2\n\t\t\t4:00\t-\tAKTT\t1930 Jun 21 # Aktyubinsk Time\n\t\t\t5:00\t-\tAKTT\t1981 Apr  1\n\t\t\t5:00\t1:00\tAKTST\t1981 Oct  1\n\t\t\t6:00\t-\tAKTT\t1982 Apr  1\n\t\t\t5:00 RussiaAsia\tAKT%sT\t1991\n\t\t\t5:00\t-\tAKTT\t1991 Dec 16 # independence\n\t\t\t5:00 RussiaAsia\tAQT%sT\t2005 Mar 15 # Aqtobe Time\n\t\t\t5:00\t-\tAQTT\nZone\tAsia/Aqtau\t3:21:04\t-\tLMT\t1924 May  2\n\t\t\t4:00\t-\tFORT\t1930 Jun 21 # Fort Shevchenko T\n\t\t\t5:00\t-\tFORT\t1963\n\t\t\t5:00\t-\tSHET\t1981 Oct  1 # Shevchenko Time\n\t\t\t6:00\t-\tSHET\t1982 Apr  1\n\t\t\t5:00 RussiaAsia\tSHE%sT\t1991\n\t\t\t5:00\t-\tSHET\t1991 Dec 16 # independence\n\t\t\t5:00 RussiaAsia\tAQT%sT\t1995 Mar lastSun 2:00 # Aqtau Time\n\t\t\t4:00 RussiaAsia\tAQT%sT\t2005 Mar 15\n\t\t\t5:00\t-\tAQTT\nZone\tAsia/Oral\t3:25:24\t-\tLMT\t1924 May  2 # or Ural'sk\n\t\t\t4:00\t-\tURAT\t1930 Jun 21 # Ural'sk time\n\t\t\t5:00\t-\tURAT\t1981 Apr  1\n\t\t\t5:00\t1:00\tURAST\t1981 Oct  1\n\t\t\t6:00\t-\tURAT\t1982 Apr  1\n\t\t\t5:00 RussiaAsia\tURA%sT\t1989 Mar 26 2:00\n\t\t\t4:00 RussiaAsia\tURA%sT\t1991\n\t\t\t4:00\t-\tURAT\t1991 Dec 16 # independence\n\t\t\t4:00 RussiaAsia\tORA%sT\t2005 Mar 15 # Oral Time\n\t\t\t5:00\t-\tORAT\nRule\tKyrgyz\t1992\t1996\t-\tApr\tSun>=7\t0:00s\t1:00\tS\nRule\tKyrgyz\t1992\t1996\t-\tSep\tlastSun\t0:00\t0\t-\nRule\tKyrgyz\t1997\t2005\t-\tMar\tlastSun\t2:30\t1:00\tS\nRule\tKyrgyz\t1997\t2004\t-\tOct\tlastSun\t2:30\t0\t-\nZone\tAsia/Bishkek\t4:58:24 -\tLMT\t1924 May  2\n\t\t\t5:00\t-\tFRUT\t1930 Jun 21 # Frunze Time\n\t\t\t6:00 RussiaAsia FRU%sT\t1991 Mar 31 2:00s\n\t\t\t5:00\t1:00\tFRUST\t1991 Aug 31 2:00 # independence\n\t\t\t5:00\tKyrgyz\tKG%sT\t2005 Aug 12    # Kyrgyzstan Time\n\t\t\t6:00\t-\tKGT\nRule\tROK\t1960\tonly\t-\tMay\t15\t0:00\t1:00\tD\nRule\tROK\t1960\tonly\t-\tSep\t13\t0:00\t0\tS\nRule\tROK\t1987\t1988\t-\tMay\tSun>=8\t0:00\t1:00\tD\nRule\tROK\t1987\t1988\t-\tOct\tSun>=8\t0:00\t0\tS\nZone\tAsia/Seoul\t8:27:52\t-\tLMT\t1890\n\t\t\t8:30\t-\tKST\t1904 Dec\n\t\t\t9:00\t-\tKST\t1928\n\t\t\t8:30\t-\tKST\t1932\n\t\t\t9:00\t-\tKST\t1954 Mar 21\n\t\t\t8:00\tROK\tK%sT\t1961 Aug 10\n\t\t\t8:30\t-\tKST\t1968 Oct\n\t\t\t9:00\tROK\tK%sT\nZone\tAsia/Pyongyang\t8:23:00 -\tLMT\t1890\n\t\t\t8:30\t-\tKST\t1904 Dec\n\t\t\t9:00\t-\tKST\t1928\n\t\t\t8:30\t-\tKST\t1932\n\t\t\t9:00\t-\tKST\t1954 Mar 21\n\t\t\t8:00\t-\tKST\t1961 Aug 10\n\t\t\t9:00\t-\tKST\nZone\tAsia/Kuwait\t3:11:56 -\tLMT\t1950\n\t\t\t3:00\t-\tAST\nZone\tAsia/Vientiane\t6:50:24 -\tLMT\t1906 Jun  9 # or Viangchan\n\t\t\t7:06:20\t-\tSMT\t1911 Mar 11 0:01 # Saigon MT?\n\t\t\t7:00\t-\tICT\t1912 May\n\t\t\t8:00\t-\tICT\t1931 May\n\t\t\t7:00\t-\tICT\nRule\tLebanon\t1920\tonly\t-\tMar\t28\t0:00\t1:00\tS\nRule\tLebanon\t1920\tonly\t-\tOct\t25\t0:00\t0\t-\nRule\tLebanon\t1921\tonly\t-\tApr\t3\t0:00\t1:00\tS\nRule\tLebanon\t1921\tonly\t-\tOct\t3\t0:00\t0\t-\nRule\tLebanon\t1922\tonly\t-\tMar\t26\t0:00\t1:00\tS\nRule\tLebanon\t1922\tonly\t-\tOct\t8\t0:00\t0\t-\nRule\tLebanon\t1923\tonly\t-\tApr\t22\t0:00\t1:00\tS\nRule\tLebanon\t1923\tonly\t-\tSep\t16\t0:00\t0\t-\nRule\tLebanon\t1957\t1961\t-\tMay\t1\t0:00\t1:00\tS\nRule\tLebanon\t1957\t1961\t-\tOct\t1\t0:00\t0\t-\nRule\tLebanon\t1972\tonly\t-\tJun\t22\t0:00\t1:00\tS\nRule\tLebanon\t1972\t1977\t-\tOct\t1\t0:00\t0\t-\nRule\tLebanon\t1973\t1977\t-\tMay\t1\t0:00\t1:00\tS\nRule\tLebanon\t1978\tonly\t-\tApr\t30\t0:00\t1:00\tS\nRule\tLebanon\t1978\tonly\t-\tSep\t30\t0:00\t0\t-\nRule\tLebanon\t1984\t1987\t-\tMay\t1\t0:00\t1:00\tS\nRule\tLebanon\t1984\t1991\t-\tOct\t16\t0:00\t0\t-\nRule\tLebanon\t1988\tonly\t-\tJun\t1\t0:00\t1:00\tS\nRule\tLebanon\t1989\tonly\t-\tMay\t10\t0:00\t1:00\tS\nRule\tLebanon\t1990\t1992\t-\tMay\t1\t0:00\t1:00\tS\nRule\tLebanon\t1992\tonly\t-\tOct\t4\t0:00\t0\t-\nRule\tLebanon\t1993\tmax\t-\tMar\tlastSun\t0:00\t1:00\tS\nRule\tLebanon\t1993\t1998\t-\tSep\tlastSun\t0:00\t0\t-\nRule\tLebanon\t1999\tmax\t-\tOct\tlastSun\t0:00\t0\t-\nZone\tAsia/Beirut\t2:22:00 -\tLMT\t1880\n\t\t\t2:00\tLebanon\tEE%sT\nRule\tNBorneo\t1935\t1941\t-\tSep\t14\t0:00\t0:20\tTS # one-Third Summer\nRule\tNBorneo\t1935\t1941\t-\tDec\t14\t0:00\t0\t-\nZone Asia/Kuala_Lumpur\t6:46:46 -\tLMT\t1901 Jan  1\n\t\t\t6:55:25\t-\tSMT\t1905 Jun  1 # Singapore M.T.\n\t\t\t7:00\t-\tMALT\t1933 Jan  1 # Malaya Time\n\t\t\t7:00\t0:20\tMALST\t1936 Jan  1\n\t\t\t7:20\t-\tMALT\t1941 Sep  1\n\t\t\t7:30\t-\tMALT\t1942 Feb 16\n\t\t\t9:00\t-\tJST\t1945 Sep 12\n\t\t\t7:30\t-\tMALT\t1982 Jan  1\n\t\t\t8:00\t-\tMYT\t# Malaysia Time\nZone Asia/Kuching\t7:21:20\t-\tLMT\t1926 Mar\n\t\t\t7:30\t-\tBORT\t1933\t# Borneo Time\n\t\t\t8:00\tNBorneo\tBOR%sT\t1942 Feb 16\n\t\t\t9:00\t-\tJST\t1945 Sep 12\n\t\t\t8:00\t-\tBORT\t1982 Jan  1\n\t\t\t8:00\t-\tMYT\nZone\tIndian/Maldives\t4:54:00 -\tLMT\t1880\t# Male\n\t\t\t4:54:00\t-\tMMT\t1960\t# Male Mean Time\n\t\t\t5:00\t-\tMVT\t\t# Maldives Time\nRule\tMongol\t1983\t1984\t-\tApr\t1\t0:00\t1:00\tS\nRule\tMongol\t1983\tonly\t-\tOct\t1\t0:00\t0\t-\nRule\tMongol\t1985\t1998\t-\tMar\tlastSun\t0:00\t1:00\tS\nRule\tMongol\t1984\t1998\t-\tSep\tlastSun\t0:00\t0\t-\nRule\tMongol\t2001\tonly\t-\tApr\tlastSat\t2:00\t1:00\tS\nRule\tMongol\t2001\t2006\t-\tSep\tlastSat\t2:00\t0\t-\nRule\tMongol\t2002\t2006\t-\tMar\tlastSat\t2:00\t1:00\tS\nZone\tAsia/Hovd\t6:06:36 -\tLMT\t1905 Aug\n\t\t\t6:00\t-\tHOVT\t1978\t# Hovd Time\n\t\t\t7:00\tMongol\tHOV%sT\nZone\tAsia/Ulaanbaatar 7:07:32 -\tLMT\t1905 Aug\n\t\t\t7:00\t-\tULAT\t1978\t# Ulaanbaatar Time\n\t\t\t8:00\tMongol\tULA%sT\nZone\tAsia/Choibalsan\t7:38:00 -\tLMT\t1905 Aug\n\t\t\t7:00\t-\tULAT\t1978\n\t\t\t8:00\t-\tULAT\t1983 Apr\n\t\t\t9:00\tMongol\tCHO%sT\t2008 Mar 31 # Choibalsan Time\n\t\t\t8:00\tMongol\tCHO%sT\nZone\tAsia/Kathmandu\t5:41:16 -\tLMT\t1920\n\t\t\t5:30\t-\tIST\t1986\n\t\t\t5:45\t-\tNPT\t# Nepal Time\nZone\tAsia/Muscat\t3:54:20 -\tLMT\t1920\n\t\t\t4:00\t-\tGST\nRule Pakistan\t2002\tonly\t-\tApr\tSun>=2\t0:01\t1:00\tS\nRule Pakistan\t2002\tonly\t-\tOct\tSun>=2\t0:01\t0\t-\nRule Pakistan\t2008\tonly\t-\tJun\t1\t0:00\t1:00\tS\nRule Pakistan\t2008\tonly\t-\tNov\t1\t0:00\t0\t-\nRule Pakistan\t2009\tonly\t-\tApr\t15\t0:00\t1:00\tS\nRule Pakistan\t2009\tonly\t-\tNov\t1\t0:00\t0\t-\nZone\tAsia/Karachi\t4:28:12 -\tLMT\t1907\n\t\t\t5:30\t-\tIST\t1942 Sep\n\t\t\t5:30\t1:00\tIST\t1945 Oct 15\n\t\t\t5:30\t-\tIST\t1951 Sep 30\n\t\t\t5:00\t-\tKART\t1971 Mar 26 # Karachi Time\n\t\t\t5:00 Pakistan\tPK%sT\t# Pakistan Time\nRule EgyptAsia\t1957\tonly\t-\tMay\t10\t0:00\t1:00\tS\nRule EgyptAsia\t1957\t1958\t-\tOct\t 1\t0:00\t0\t-\nRule EgyptAsia\t1958\tonly\t-\tMay\t 1\t0:00\t1:00\tS\nRule EgyptAsia\t1959\t1967\t-\tMay\t 1\t1:00\t1:00\tS\nRule EgyptAsia\t1959\t1965\t-\tSep\t30\t3:00\t0\t-\nRule EgyptAsia\t1966\tonly\t-\tOct\t 1\t3:00\t0\t-\nRule Palestine\t1999\t2005\t-\tApr\tFri>=15\t0:00\t1:00\tS\nRule Palestine\t1999\t2003\t-\tOct\tFri>=15\t0:00\t0\t-\nRule Palestine\t2004\tonly\t-\tOct\t 1\t1:00\t0\t-\nRule Palestine\t2005\tonly\t-\tOct\t 4\t2:00\t0\t-\nRule Palestine\t2006\t2008\t-\tApr\t 1\t0:00\t1:00\tS\nRule Palestine\t2006\tonly\t-\tSep\t22\t0:00\t0\t-\nRule Palestine\t2007\tonly\t-\tSep\tThu>=8\t2:00\t0\t-\nRule Palestine\t2008\tonly\t-\tAug\tlastFri\t0:00\t0\t-\nRule Palestine\t2009\tonly\t-\tMar\tlastFri\t0:00\t1:00\tS\nRule Palestine\t2009\tonly\t-\tSep\tFri>=1\t2:00\t0\t-\nRule Palestine\t2010\tonly\t-\tMar\tlastSat\t0:01\t1:00\tS\nRule Palestine\t2010\tonly\t-\tAug\t11\t0:00\t0\t-\nZone\tAsia/Gaza\t2:17:52\t-\tLMT\t1900 Oct\n\t\t\t2:00\tZion\tEET\t1948 May 15\n\t\t\t2:00 EgyptAsia\tEE%sT\t1967 Jun  5\n\t\t\t2:00\tZion\tI%sT\t1996\n\t\t\t2:00\tJordan\tEE%sT\t1999\n\t\t\t2:00 Palestine\tEE%sT\t2011 Apr  2 12:01\n\t\t\t2:00\t1:00\tEEST\t2011 Aug  1\n\t\t\t2:00\t-\tEET\nZone\tAsia/Hebron\t2:20:23\t-\tLMT\t1900 Oct\n\t\t\t2:00\tZion\tEET\t1948 May 15\n\t\t\t2:00 EgyptAsia\tEE%sT\t1967 Jun  5\n\t\t\t2:00\tZion\tI%sT\t1996\n\t\t\t2:00\tJordan\tEE%sT\t1999\n\t\t\t2:00 Palestine\tEE%sT\t2008 Aug\n\t\t\t2:00 \t1:00\tEEST\t2008 Sep\n\t\t\t2:00 Palestine\tEE%sT\t2011 Apr  1 12:01\n\t\t\t2:00\t1:00\tEEST\t2011 Aug  1\n\t\t\t2:00\t-\tEET\t2011 Aug 30\n\t\t\t2:00\t1:00\tEEST\t2011 Sep 30 3:00\n\t\t\t2:00\t-\tEET\nRule\tPhil\t1936\tonly\t-\tNov\t1\t0:00\t1:00\tS\nRule\tPhil\t1937\tonly\t-\tFeb\t1\t0:00\t0\t-\nRule\tPhil\t1954\tonly\t-\tApr\t12\t0:00\t1:00\tS\nRule\tPhil\t1954\tonly\t-\tJul\t1\t0:00\t0\t-\nRule\tPhil\t1978\tonly\t-\tMar\t22\t0:00\t1:00\tS\nRule\tPhil\t1978\tonly\t-\tSep\t21\t0:00\t0\t-\nZone\tAsia/Manila\t-15:56:00 -\tLMT\t1844 Dec 31\n\t\t\t8:04:00 -\tLMT\t1899 May 11\n\t\t\t8:00\tPhil\tPH%sT\t1942 May\n\t\t\t9:00\t-\tJST\t1944 Nov\n\t\t\t8:00\tPhil\tPH%sT\nZone\tAsia/Qatar\t3:26:08 -\tLMT\t1920\t# Al Dawhah / Doha\n\t\t\t4:00\t-\tGST\t1972 Jun\n\t\t\t3:00\t-\tAST\nZone\tAsia/Riyadh\t3:06:52 -\tLMT\t1950\n\t\t\t3:00\t-\tAST\nZone\tAsia/Singapore\t6:55:25 -\tLMT\t1901 Jan  1\n\t\t\t6:55:25\t-\tSMT\t1905 Jun  1 # Singapore M.T.\n\t\t\t7:00\t-\tMALT\t1933 Jan  1 # Malaya Time\n\t\t\t7:00\t0:20\tMALST\t1936 Jan  1\n\t\t\t7:20\t-\tMALT\t1941 Sep  1\n\t\t\t7:30\t-\tMALT\t1942 Feb 16\n\t\t\t9:00\t-\tJST\t1945 Sep 12\n\t\t\t7:30\t-\tMALT\t1965 Aug  9 # independence\n\t\t\t7:30\t-\tSGT\t1982 Jan  1 # Singapore Time\n\t\t\t8:00\t-\tSGT\nZone\tAsia/Colombo\t5:19:24 -\tLMT\t1880\n\t\t\t5:19:32\t-\tMMT\t1906\t# Moratuwa Mean Time\n\t\t\t5:30\t-\tIST\t1942 Jan  5\n\t\t\t5:30\t0:30\tIHST\t1942 Sep\n\t\t\t5:30\t1:00\tIST\t1945 Oct 16 2:00\n\t\t\t5:30\t-\tIST\t1996 May 25 0:00\n\t\t\t6:30\t-\tLKT\t1996 Oct 26 0:30\n\t\t\t6:00\t-\tLKT\t2006 Apr 15 0:30\n\t\t\t5:30\t-\tIST\nRule\tSyria\t1920\t1923\t-\tApr\tSun>=15\t2:00\t1:00\tS\nRule\tSyria\t1920\t1923\t-\tOct\tSun>=1\t2:00\t0\t-\nRule\tSyria\t1962\tonly\t-\tApr\t29\t2:00\t1:00\tS\nRule\tSyria\t1962\tonly\t-\tOct\t1\t2:00\t0\t-\nRule\tSyria\t1963\t1965\t-\tMay\t1\t2:00\t1:00\tS\nRule\tSyria\t1963\tonly\t-\tSep\t30\t2:00\t0\t-\nRule\tSyria\t1964\tonly\t-\tOct\t1\t2:00\t0\t-\nRule\tSyria\t1965\tonly\t-\tSep\t30\t2:00\t0\t-\nRule\tSyria\t1966\tonly\t-\tApr\t24\t2:00\t1:00\tS\nRule\tSyria\t1966\t1976\t-\tOct\t1\t2:00\t0\t-\nRule\tSyria\t1967\t1978\t-\tMay\t1\t2:00\t1:00\tS\nRule\tSyria\t1977\t1978\t-\tSep\t1\t2:00\t0\t-\nRule\tSyria\t1983\t1984\t-\tApr\t9\t2:00\t1:00\tS\nRule\tSyria\t1983\t1984\t-\tOct\t1\t2:00\t0\t-\nRule\tSyria\t1986\tonly\t-\tFeb\t16\t2:00\t1:00\tS\nRule\tSyria\t1986\tonly\t-\tOct\t9\t2:00\t0\t-\nRule\tSyria\t1987\tonly\t-\tMar\t1\t2:00\t1:00\tS\nRule\tSyria\t1987\t1988\t-\tOct\t31\t2:00\t0\t-\nRule\tSyria\t1988\tonly\t-\tMar\t15\t2:00\t1:00\tS\nRule\tSyria\t1989\tonly\t-\tMar\t31\t2:00\t1:00\tS\nRule\tSyria\t1989\tonly\t-\tOct\t1\t2:00\t0\t-\nRule\tSyria\t1990\tonly\t-\tApr\t1\t2:00\t1:00\tS\nRule\tSyria\t1990\tonly\t-\tSep\t30\t2:00\t0\t-\nRule\tSyria\t1991\tonly\t-\tApr\t 1\t0:00\t1:00\tS\nRule\tSyria\t1991\t1992\t-\tOct\t 1\t0:00\t0\t-\nRule\tSyria\t1992\tonly\t-\tApr\t 8\t0:00\t1:00\tS\nRule\tSyria\t1993\tonly\t-\tMar\t26\t0:00\t1:00\tS\nRule\tSyria\t1993\tonly\t-\tSep\t25\t0:00\t0\t-\nRule\tSyria\t1994\t1996\t-\tApr\t 1\t0:00\t1:00\tS\nRule\tSyria\t1994\t2005\t-\tOct\t 1\t0:00\t0\t-\nRule\tSyria\t1997\t1998\t-\tMar\tlastMon\t0:00\t1:00\tS\nRule\tSyria\t1999\t2006\t-\tApr\t 1\t0:00\t1:00\tS\nRule\tSyria\t2006\tonly\t-\tSep\t22\t0:00\t0\t-\nRule\tSyria\t2007\tonly\t-\tMar\tlastFri\t0:00\t1:00\tS\nRule\tSyria\t2007\tonly\t-\tNov\t Fri>=1\t0:00\t0\t-\nRule\tSyria\t2008\tonly\t-\tApr\tFri>=1\t0:00\t1:00\tS\nRule\tSyria\t2008\tonly\t-\tNov\t1\t0:00\t0\t-\nRule\tSyria\t2009\tonly\t-\tMar\tlastFri\t0:00\t1:00\tS\nRule\tSyria\t2010\tmax\t-\tApr\tFri>=1\t0:00\t1:00\tS\nRule\tSyria\t2009\tmax\t-\tOct\tlastFri\t0:00\t0\t-\nZone\tAsia/Damascus\t2:25:12 -\tLMT\t1920\t# Dimashq\n\t\t\t2:00\tSyria\tEE%sT\nZone\tAsia/Dushanbe\t4:35:12 -\tLMT\t1924 May  2\n\t\t\t5:00\t-\tDUST\t1930 Jun 21 # Dushanbe Time\n\t\t\t6:00 RussiaAsia DUS%sT\t1991 Mar 31 2:00s\n\t\t\t5:00\t1:00\tDUSST\t1991 Sep  9 2:00s\n\t\t\t5:00\t-\tTJT\t\t    # Tajikistan Time\nZone\tAsia/Bangkok\t6:42:04\t-\tLMT\t1880\n\t\t\t6:42:04\t-\tBMT\t1920 Apr # Bangkok Mean Time\n\t\t\t7:00\t-\tICT\nZone\tAsia/Ashgabat\t3:53:32 -\tLMT\t1924 May  2 # or Ashkhabad\n\t\t\t4:00\t-\tASHT\t1930 Jun 21 # Ashkhabad Time\n\t\t\t5:00 RussiaAsia\tASH%sT\t1991 Mar 31 2:00\n\t\t\t4:00 RussiaAsia\tASH%sT\t1991 Oct 27 # independence\n\t\t\t4:00 RussiaAsia\tTM%sT\t1992 Jan 19 2:00\n\t\t\t5:00\t-\tTMT\nZone\tAsia/Dubai\t3:41:12 -\tLMT\t1920\n\t\t\t4:00\t-\tGST\nZone\tAsia/Samarkand\t4:27:12 -\tLMT\t1924 May  2\n\t\t\t4:00\t-\tSAMT\t1930 Jun 21 # Samarkand Time\n\t\t\t5:00\t-\tSAMT\t1981 Apr  1\n\t\t\t5:00\t1:00\tSAMST\t1981 Oct  1\n\t\t\t6:00\t-\tTAST\t1982 Apr  1 # Tashkent Time\n\t\t\t5:00 RussiaAsia\tSAM%sT\t1991 Sep  1 # independence\n\t\t\t5:00 RussiaAsia\tUZ%sT\t1992\n\t\t\t5:00\t-\tUZT\nZone\tAsia/Tashkent\t4:37:12 -\tLMT\t1924 May  2\n\t\t\t5:00\t-\tTAST\t1930 Jun 21 # Tashkent Time\n\t\t\t6:00 RussiaAsia\tTAS%sT\t1991 Mar 31 2:00\n\t\t\t5:00 RussiaAsia\tTAS%sT\t1991 Sep  1 # independence\n\t\t\t5:00 RussiaAsia\tUZ%sT\t1992\n\t\t\t5:00\t-\tUZT\nZone\tAsia/Ho_Chi_Minh\t7:06:40 -\tLMT\t1906 Jun  9\n\t\t\t7:06:20\t-\tSMT\t1911 Mar 11 0:01 # Saigon MT?\n\t\t\t7:00\t-\tICT\t1912 May\n\t\t\t8:00\t-\tICT\t1931 May\n\t\t\t7:00\t-\tICT\nZone\tAsia/Aden\t3:00:48\t-\tLMT\t1950\n\t\t\t3:00\t-\tAST\n","tz/australasia":"Rule\tAus\t1917\tonly\t-\tJan\t 1\t0:01\t1:00\t-\nRule\tAus\t1917\tonly\t-\tMar\t25\t2:00\t0\t-\nRule\tAus\t1942\tonly\t-\tJan\t 1\t2:00\t1:00\t-\nRule\tAus\t1942\tonly\t-\tMar\t29\t2:00\t0\t-\nRule\tAus\t1942\tonly\t-\tSep\t27\t2:00\t1:00\t-\nRule\tAus\t1943\t1944\t-\tMar\tlastSun\t2:00\t0\t-\nRule\tAus\t1943\tonly\t-\tOct\t 3\t2:00\t1:00\t-\nZone Australia/Darwin\t 8:43:20 -\tLMT\t1895 Feb\n\t\t\t 9:00\t-\tCST\t1899 May\n\t\t\t 9:30\tAus\tCST\nRule\tAW\t1974\tonly\t-\tOct\tlastSun\t2:00s\t1:00\t-\nRule\tAW\t1975\tonly\t-\tMar\tSun>=1\t2:00s\t0\t-\nRule\tAW\t1983\tonly\t-\tOct\tlastSun\t2:00s\t1:00\t-\nRule\tAW\t1984\tonly\t-\tMar\tSun>=1\t2:00s\t0\t-\nRule\tAW\t1991\tonly\t-\tNov\t17\t2:00s\t1:00\t-\nRule\tAW\t1992\tonly\t-\tMar\tSun>=1\t2:00s\t0\t-\nRule\tAW\t2006\tonly\t-\tDec\t 3\t2:00s\t1:00\t-\nRule\tAW\t2007\t2009\t-\tMar\tlastSun\t2:00s\t0\t-\nRule\tAW\t2007\t2008\t-\tOct\tlastSun\t2:00s\t1:00\t-\nZone Australia/Perth\t 7:43:24 -\tLMT\t1895 Dec\n\t\t\t 8:00\tAus\tWST\t1943 Jul\n\t\t\t 8:00\tAW\tWST\nZone Australia/Eucla\t 8:35:28 -\tLMT\t1895 Dec\n\t\t\t 8:45\tAus\tCWST\t1943 Jul\n\t\t\t 8:45\tAW\tCWST\nRule\tAQ\t1971\tonly\t-\tOct\tlastSun\t2:00s\t1:00\t-\nRule\tAQ\t1972\tonly\t-\tFeb\tlastSun\t2:00s\t0\t-\nRule\tAQ\t1989\t1991\t-\tOct\tlastSun\t2:00s\t1:00\t-\nRule\tAQ\t1990\t1992\t-\tMar\tSun>=1\t2:00s\t0\t-\nRule\tHoliday\t1992\t1993\t-\tOct\tlastSun\t2:00s\t1:00\t-\nRule\tHoliday\t1993\t1994\t-\tMar\tSun>=1\t2:00s\t0\t-\nZone Australia/Brisbane\t10:12:08 -\tLMT\t1895\n\t\t\t10:00\tAus\tEST\t1971\n\t\t\t10:00\tAQ\tEST\nZone Australia/Lindeman  9:55:56 -\tLMT\t1895\n\t\t\t10:00\tAus\tEST\t1971\n\t\t\t10:00\tAQ\tEST\t1992 Jul\n\t\t\t10:00\tHoliday\tEST\nRule\tAS\t1971\t1985\t-\tOct\tlastSun\t2:00s\t1:00\t-\nRule\tAS\t1986\tonly\t-\tOct\t19\t2:00s\t1:00\t-\nRule\tAS\t1987\t2007\t-\tOct\tlastSun\t2:00s\t1:00\t-\nRule\tAS\t1972\tonly\t-\tFeb\t27\t2:00s\t0\t-\nRule\tAS\t1973\t1985\t-\tMar\tSun>=1\t2:00s\t0\t-\nRule\tAS\t1986\t1990\t-\tMar\tSun>=15\t2:00s\t0\t-\nRule\tAS\t1991\tonly\t-\tMar\t3\t2:00s\t0\t-\nRule\tAS\t1992\tonly\t-\tMar\t22\t2:00s\t0\t-\nRule\tAS\t1993\tonly\t-\tMar\t7\t2:00s\t0\t-\nRule\tAS\t1994\tonly\t-\tMar\t20\t2:00s\t0\t-\nRule\tAS\t1995\t2005\t-\tMar\tlastSun\t2:00s\t0\t-\nRule\tAS\t2006\tonly\t-\tApr\t2\t2:00s\t0\t-\nRule\tAS\t2007\tonly\t-\tMar\tlastSun\t2:00s\t0\t-\nRule\tAS\t2008\tmax\t-\tApr\tSun>=1\t2:00s\t0\t-\nRule\tAS\t2008\tmax\t-\tOct\tSun>=1\t2:00s\t1:00\t-\nZone Australia/Adelaide\t9:14:20 -\tLMT\t1895 Feb\n\t\t\t9:00\t-\tCST\t1899 May\n\t\t\t9:30\tAus\tCST\t1971\n\t\t\t9:30\tAS\tCST\nRule\tAT\t1967\tonly\t-\tOct\tSun>=1\t2:00s\t1:00\t-\nRule\tAT\t1968\tonly\t-\tMar\tlastSun\t2:00s\t0\t-\nRule\tAT\t1968\t1985\t-\tOct\tlastSun\t2:00s\t1:00\t-\nRule\tAT\t1969\t1971\t-\tMar\tSun>=8\t2:00s\t0\t-\nRule\tAT\t1972\tonly\t-\tFeb\tlastSun\t2:00s\t0\t-\nRule\tAT\t1973\t1981\t-\tMar\tSun>=1\t2:00s\t0\t-\nRule\tAT\t1982\t1983\t-\tMar\tlastSun\t2:00s\t0\t-\nRule\tAT\t1984\t1986\t-\tMar\tSun>=1\t2:00s\t0\t-\nRule\tAT\t1986\tonly\t-\tOct\tSun>=15\t2:00s\t1:00\t-\nRule\tAT\t1987\t1990\t-\tMar\tSun>=15\t2:00s\t0\t-\nRule\tAT\t1987\tonly\t-\tOct\tSun>=22\t2:00s\t1:00\t-\nRule\tAT\t1988\t1990\t-\tOct\tlastSun\t2:00s\t1:00\t-\nRule\tAT\t1991\t1999\t-\tOct\tSun>=1\t2:00s\t1:00\t-\nRule\tAT\t1991\t2005\t-\tMar\tlastSun\t2:00s\t0\t-\nRule\tAT\t2000\tonly\t-\tAug\tlastSun\t2:00s\t1:00\t-\nRule\tAT\t2001\tmax\t-\tOct\tSun>=1\t2:00s\t1:00\t-\nRule\tAT\t2006\tonly\t-\tApr\tSun>=1\t2:00s\t0\t-\nRule\tAT\t2007\tonly\t-\tMar\tlastSun\t2:00s\t0\t-\nRule\tAT\t2008\tmax\t-\tApr\tSun>=1\t2:00s\t0\t-\nZone Australia/Hobart\t9:49:16\t-\tLMT\t1895 Sep\n\t\t\t10:00\t-\tEST\t1916 Oct 1 2:00\n\t\t\t10:00\t1:00\tEST\t1917 Feb\n\t\t\t10:00\tAus\tEST\t1967\n\t\t\t10:00\tAT\tEST\nZone Australia/Currie\t9:35:28\t-\tLMT\t1895 Sep\n\t\t\t10:00\t-\tEST\t1916 Oct 1 2:00\n\t\t\t10:00\t1:00\tEST\t1917 Feb\n\t\t\t10:00\tAus\tEST\t1971 Jul\n\t\t\t10:00\tAT\tEST\nRule\tAV\t1971\t1985\t-\tOct\tlastSun\t2:00s\t1:00\t-\nRule\tAV\t1972\tonly\t-\tFeb\tlastSun\t2:00s\t0\t-\nRule\tAV\t1973\t1985\t-\tMar\tSun>=1\t2:00s\t0\t-\nRule\tAV\t1986\t1990\t-\tMar\tSun>=15\t2:00s\t0\t-\nRule\tAV\t1986\t1987\t-\tOct\tSun>=15\t2:00s\t1:00\t-\nRule\tAV\t1988\t1999\t-\tOct\tlastSun\t2:00s\t1:00\t-\nRule\tAV\t1991\t1994\t-\tMar\tSun>=1\t2:00s\t0\t-\nRule\tAV\t1995\t2005\t-\tMar\tlastSun\t2:00s\t0\t-\nRule\tAV\t2000\tonly\t-\tAug\tlastSun\t2:00s\t1:00\t-\nRule\tAV\t2001\t2007\t-\tOct\tlastSun\t2:00s\t1:00\t-\nRule\tAV\t2006\tonly\t-\tApr\tSun>=1\t2:00s\t0\t-\nRule\tAV\t2007\tonly\t-\tMar\tlastSun\t2:00s\t0\t-\nRule\tAV\t2008\tmax\t-\tApr\tSun>=1\t2:00s\t0\t-\nRule\tAV\t2008\tmax\t-\tOct\tSun>=1\t2:00s\t1:00\t-\nZone Australia/Melbourne 9:39:52 -\tLMT\t1895 Feb\n\t\t\t10:00\tAus\tEST\t1971\n\t\t\t10:00\tAV\tEST\nRule\tAN\t1971\t1985\t-\tOct\tlastSun\t2:00s\t1:00\t-\nRule\tAN\t1972\tonly\t-\tFeb\t27\t2:00s\t0\t-\nRule\tAN\t1973\t1981\t-\tMar\tSun>=1\t2:00s\t0\t-\nRule\tAN\t1982\tonly\t-\tApr\tSun>=1\t2:00s\t0\t-\nRule\tAN\t1983\t1985\t-\tMar\tSun>=1\t2:00s\t0\t-\nRule\tAN\t1986\t1989\t-\tMar\tSun>=15\t2:00s\t0\t-\nRule\tAN\t1986\tonly\t-\tOct\t19\t2:00s\t1:00\t-\nRule\tAN\t1987\t1999\t-\tOct\tlastSun\t2:00s\t1:00\t-\nRule\tAN\t1990\t1995\t-\tMar\tSun>=1\t2:00s\t0\t-\nRule\tAN\t1996\t2005\t-\tMar\tlastSun\t2:00s\t0\t-\nRule\tAN\t2000\tonly\t-\tAug\tlastSun\t2:00s\t1:00\t-\nRule\tAN\t2001\t2007\t-\tOct\tlastSun\t2:00s\t1:00\t-\nRule\tAN\t2006\tonly\t-\tApr\tSun>=1\t2:00s\t0\t-\nRule\tAN\t2007\tonly\t-\tMar\tlastSun\t2:00s\t0\t-\nRule\tAN\t2008\tmax\t-\tApr\tSun>=1\t2:00s\t0\t-\nRule\tAN\t2008\tmax\t-\tOct\tSun>=1\t2:00s\t1:00\t-\nZone Australia/Sydney\t10:04:52 -\tLMT\t1895 Feb\n\t\t\t10:00\tAus\tEST\t1971\n\t\t\t10:00\tAN\tEST\nZone Australia/Broken_Hill 9:25:48 -\tLMT\t1895 Feb\n\t\t\t10:00\t-\tEST\t1896 Aug 23\n\t\t\t9:00\t-\tCST\t1899 May\n\t\t\t9:30\tAus\tCST\t1971\n\t\t\t9:30\tAN\tCST\t2000\n\t\t\t9:30\tAS\tCST\nRule\tLH\t1981\t1984\t-\tOct\tlastSun\t2:00\t1:00\t-\nRule\tLH\t1982\t1985\t-\tMar\tSun>=1\t2:00\t0\t-\nRule\tLH\t1985\tonly\t-\tOct\tlastSun\t2:00\t0:30\t-\nRule\tLH\t1986\t1989\t-\tMar\tSun>=15\t2:00\t0\t-\nRule\tLH\t1986\tonly\t-\tOct\t19\t2:00\t0:30\t-\nRule\tLH\t1987\t1999\t-\tOct\tlastSun\t2:00\t0:30\t-\nRule\tLH\t1990\t1995\t-\tMar\tSun>=1\t2:00\t0\t-\nRule\tLH\t1996\t2005\t-\tMar\tlastSun\t2:00\t0\t-\nRule\tLH\t2000\tonly\t-\tAug\tlastSun\t2:00\t0:30\t-\nRule\tLH\t2001\t2007\t-\tOct\tlastSun\t2:00\t0:30\t-\nRule\tLH\t2006\tonly\t-\tApr\tSun>=1\t2:00\t0\t-\nRule\tLH\t2007\tonly\t-\tMar\tlastSun\t2:00\t0\t-\nRule\tLH\t2008\tmax\t-\tApr\tSun>=1\t2:00\t0\t-\nRule\tLH\t2008\tmax\t-\tOct\tSun>=1\t2:00\t0:30\t-\nZone Australia/Lord_Howe 10:36:20 -\tLMT\t1895 Feb\n\t\t\t10:00\t-\tEST\t1981 Mar\n\t\t\t10:30\tLH\tLHST\nZone Indian/Christmas\t7:02:52 -\tLMT\t1895 Feb\n\t\t\t7:00\t-\tCXT\t# Christmas Island Time\nRule\tCook\t1978\tonly\t-\tNov\t12\t0:00\t0:30\tHS\nRule\tCook\t1979\t1991\t-\tMar\tSun>=1\t0:00\t0\t-\nRule\tCook\t1979\t1990\t-\tOct\tlastSun\t0:00\t0:30\tHS\nZone Pacific/Rarotonga\t-10:39:04 -\tLMT\t1901\t\t# Avarua\n\t\t\t-10:30\t-\tCKT\t1978 Nov 12\t# Cook Is Time\n\t\t\t-10:00\tCook\tCK%sT\nZone\tIndian/Cocos\t6:27:40\t-\tLMT\t1900\n\t\t\t6:30\t-\tCCT\t# Cocos Islands Time\nRule\tFiji\t1998\t1999\t-\tNov\tSun>=1\t2:00\t1:00\tS\nRule\tFiji\t1999\t2000\t-\tFeb\tlastSun\t3:00\t0\t-\nRule\tFiji\t2009\tonly\t-\tNov\t29\t2:00\t1:00\tS\nRule\tFiji\t2010\tonly\t-\tMar\tlastSun\t3:00\t0\t-\nRule\tFiji\t2010\tonly\t-\tOct\t24\t2:00\t1:00\tS\nRule\tFiji\t2011\tonly\t-\tMar\tSun>=1\t3:00\t0\t-\nRule\tFiji\t2011\tonly\t-\tOct\t23\t2:00\t1:00\tS\nRule\tFiji\t2012\tonly\t-\tJan\t22\t3:00\t0\t-\nZone\tPacific/Fiji\t11:53:40 -\tLMT\t1915 Oct 26\t# Suva\n\t\t\t12:00\tFiji\tFJ%sT\t# Fiji Time\nZone\tPacific/Gambier\t -8:59:48 -\tLMT\t1912 Oct\t# Rikitea\n\t\t\t -9:00\t-\tGAMT\t# Gambier Time\nZone\tPacific/Marquesas -9:18:00 -\tLMT\t1912 Oct\n\t\t\t -9:30\t-\tMART\t# Marquesas Time\nZone\tPacific/Tahiti\t -9:58:16 -\tLMT\t1912 Oct\t# Papeete\n\t\t\t-10:00\t-\tTAHT\t# Tahiti Time\nZone\tPacific/Guam\t-14:21:00 -\tLMT\t1844 Dec 31\n\t\t\t 9:39:00 -\tLMT\t1901\t\t# Agana\n\t\t\t10:00\t-\tGST\t2000 Dec 23\t# Guam\n\t\t\t10:00\t-\tChST\t# Chamorro Standard Time\nZone Pacific/Tarawa\t 11:32:04 -\tLMT\t1901\t\t# Bairiki\n\t\t\t 12:00\t-\tGILT\t\t # Gilbert Is Time\nZone Pacific/Enderbury\t-11:24:20 -\tLMT\t1901\n\t\t\t-12:00\t-\tPHOT\t1979 Oct # Phoenix Is Time\n\t\t\t-11:00\t-\tPHOT\t1995\n\t\t\t 13:00\t-\tPHOT\nZone Pacific/Kiritimati\t-10:29:20 -\tLMT\t1901\n\t\t\t-10:40\t-\tLINT\t1979 Oct # Line Is Time\n\t\t\t-10:00\t-\tLINT\t1995\n\t\t\t 14:00\t-\tLINT\nZone Pacific/Saipan\t-14:17:00 -\tLMT\t1844 Dec 31\n\t\t\t 9:43:00 -\tLMT\t1901\n\t\t\t 9:00\t-\tMPT\t1969 Oct # N Mariana Is Time\n\t\t\t10:00\t-\tMPT\t2000 Dec 23\n\t\t\t10:00\t-\tChST\t# Chamorro Standard Time\nZone Pacific/Majuro\t11:24:48 -\tLMT\t1901\n\t\t\t11:00\t-\tMHT\t1969 Oct # Marshall Islands Time\n\t\t\t12:00\t-\tMHT\nZone Pacific/Kwajalein\t11:09:20 -\tLMT\t1901\n\t\t\t11:00\t-\tMHT\t1969 Oct\n\t\t\t-12:00\t-\tKWAT\t1993 Aug 20\t# Kwajalein Time\n\t\t\t12:00\t-\tMHT\nZone Pacific/Chuuk\t10:07:08 -\tLMT\t1901\n\t\t\t10:00\t-\tCHUT\t\t\t# Chuuk Time\nZone Pacific/Pohnpei\t10:32:52 -\tLMT\t1901\t\t# Kolonia\n\t\t\t11:00\t-\tPONT\t\t\t# Pohnpei Time\nZone Pacific/Kosrae\t10:51:56 -\tLMT\t1901\n\t\t\t11:00\t-\tKOST\t1969 Oct\t# Kosrae Time\n\t\t\t12:00\t-\tKOST\t1999\n\t\t\t11:00\t-\tKOST\nZone\tPacific/Nauru\t11:07:40 -\tLMT\t1921 Jan 15\t# Uaobe\n\t\t\t11:30\t-\tNRT\t1942 Mar 15\t# Nauru Time\n\t\t\t9:00\t-\tJST\t1944 Aug 15\n\t\t\t11:30\t-\tNRT\t1979 May\n\t\t\t12:00\t-\tNRT\nRule\tNC\t1977\t1978\t-\tDec\tSun>=1\t0:00\t1:00\tS\nRule\tNC\t1978\t1979\t-\tFeb\t27\t0:00\t0\t-\nRule\tNC\t1996\tonly\t-\tDec\t 1\t2:00s\t1:00\tS\nRule\tNC\t1997\tonly\t-\tMar\t 2\t2:00s\t0\t-\nZone\tPacific/Noumea\t11:05:48 -\tLMT\t1912 Jan 13\n\t\t\t11:00\tNC\tNC%sT\nRule\tNZ\t1927\tonly\t-\tNov\t 6\t2:00\t1:00\tS\nRule\tNZ\t1928\tonly\t-\tMar\t 4\t2:00\t0\tM\nRule\tNZ\t1928\t1933\t-\tOct\tSun>=8\t2:00\t0:30\tS\nRule\tNZ\t1929\t1933\t-\tMar\tSun>=15\t2:00\t0\tM\nRule\tNZ\t1934\t1940\t-\tApr\tlastSun\t2:00\t0\tM\nRule\tNZ\t1934\t1940\t-\tSep\tlastSun\t2:00\t0:30\tS\nRule\tNZ\t1946\tonly\t-\tJan\t 1\t0:00\t0\tS\nRule\tNZ\t1974\tonly\t-\tNov\tSun>=1\t2:00s\t1:00\tD\nRule\tChatham\t1974\tonly\t-\tNov\tSun>=1\t2:45s\t1:00\tD\nRule\tNZ\t1975\tonly\t-\tFeb\tlastSun\t2:00s\t0\tS\nRule\tChatham\t1975\tonly\t-\tFeb\tlastSun\t2:45s\t0\tS\nRule\tNZ\t1975\t1988\t-\tOct\tlastSun\t2:00s\t1:00\tD\nRule\tChatham\t1975\t1988\t-\tOct\tlastSun\t2:45s\t1:00\tD\nRule\tNZ\t1976\t1989\t-\tMar\tSun>=1\t2:00s\t0\tS\nRule\tChatham\t1976\t1989\t-\tMar\tSun>=1\t2:45s\t0\tS\nRule\tNZ\t1989\tonly\t-\tOct\tSun>=8\t2:00s\t1:00\tD\nRule\tChatham\t1989\tonly\t-\tOct\tSun>=8\t2:45s\t1:00\tD\nRule\tNZ\t1990\t2006\t-\tOct\tSun>=1\t2:00s\t1:00\tD\nRule\tChatham\t1990\t2006\t-\tOct\tSun>=1\t2:45s\t1:00\tD\nRule\tNZ\t1990\t2007\t-\tMar\tSun>=15\t2:00s\t0\tS\nRule\tChatham\t1990\t2007\t-\tMar\tSun>=15\t2:45s\t0\tS\nRule\tNZ\t2007\tmax\t-\tSep\tlastSun\t2:00s\t1:00\tD\nRule\tChatham\t2007\tmax\t-\tSep\tlastSun\t2:45s\t1:00\tD\nRule\tNZ\t2008\tmax\t-\tApr\tSun>=1\t2:00s\t0\tS\nRule\tChatham\t2008\tmax\t-\tApr\tSun>=1\t2:45s\t0\tS\nZone Pacific/Auckland\t11:39:04 -\tLMT\t1868 Nov  2\n\t\t\t11:30\tNZ\tNZ%sT\t1946 Jan  1\n\t\t\t12:00\tNZ\tNZ%sT\nZone Pacific/Chatham\t12:13:48 -\tLMT\t1957 Jan  1\n\t\t\t12:45\tChatham\tCHA%sT\nZone\tPacific/Niue\t-11:19:40 -\tLMT\t1901\t\t# Alofi\n\t\t\t-11:20\t-\tNUT\t1951\t# Niue Time\n\t\t\t-11:30\t-\tNUT\t1978 Oct 1\n\t\t\t-11:00\t-\tNUT\nZone\tPacific/Norfolk\t11:11:52 -\tLMT\t1901\t\t# Kingston\n\t\t\t11:12\t-\tNMT\t1951\t# Norfolk Mean Time\n\t\t\t11:30\t-\tNFT\t\t# Norfolk Time\nZone Pacific/Palau\t8:57:56 -\tLMT\t1901\t\t# Koror\n\t\t\t9:00\t-\tPWT\t# Palau Time\nZone Pacific/Port_Moresby 9:48:40 -\tLMT\t1880\n\t\t\t9:48:32\t-\tPMMT\t1895\t# Port Moresby Mean Time\n\t\t\t10:00\t-\tPGT\t\t# Papua New Guinea Time\nZone Pacific/Pitcairn\t-8:40:20 -\tLMT\t1901\t\t# Adamstown\n\t\t\t-8:30\t-\tPNT\t1998 Apr 27 00:00\n\t\t\t-8:00\t-\tPST\t# Pitcairn Standard Time\nZone Pacific/Pago_Pago\t 12:37:12 -\tLMT\t1879 Jul  5\n\t\t\t-11:22:48 -\tLMT\t1911\n\t\t\t-11:30\t-\tSAMT\t1950\t\t# Samoa Time\n\t\t\t-11:00\t-\tNST\t1967 Apr\t# N=Nome\n\t\t\t-11:00\t-\tBST\t1983 Nov 30\t# B=Bering\n\t\t\t-11:00\t-\tSST\t\t\t# S=Samoa\nZone Pacific/Apia\t 12:33:04 -\tLMT\t1879 Jul  5\n\t\t\t-11:26:56 -\tLMT\t1911\n\t\t\t-11:30\t-\tSAMT\t1950\t\t# Samoa Time\n\t\t\t-11:00\t-\tWST\t2010 Sep 26\n\t\t\t-11:00\t1:00\tWSDT\t2011 Apr 2 4:00\n\t\t\t-11:00\t-\tWST\t2011 Sep 24 3:00\n\t\t\t-11:00\t1:00\tWSDT\t2011 Dec 30\n\t\t\t 13:00\t1:00\tWSDT\t2012 Apr 1 4:00\n\t\t\t 13:00\t-\tWST\nZone Pacific/Guadalcanal 10:39:48 -\tLMT\t1912 Oct\t# Honiara\n\t\t\t11:00\t-\tSBT\t# Solomon Is Time\nZone\tPacific/Fakaofo\t-11:24:56 -\tLMT\t1901\n\t\t\t-10:00\t-\tTKT\t# Tokelau Time\nRule\tTonga\t1999\tonly\t-\tOct\t 7\t2:00s\t1:00\tS\nRule\tTonga\t2000\tonly\t-\tMar\t19\t2:00s\t0\t-\nRule\tTonga\t2000\t2001\t-\tNov\tSun>=1\t2:00\t1:00\tS\nRule\tTonga\t2001\t2002\t-\tJan\tlastSun\t2:00\t0\t-\nZone Pacific/Tongatapu\t12:19:20 -\tLMT\t1901\n\t\t\t12:20\t-\tTOT\t1941 # Tonga Time\n\t\t\t13:00\t-\tTOT\t1999\n\t\t\t13:00\tTonga\tTO%sT\nZone Pacific/Funafuti\t11:56:52 -\tLMT\t1901\n\t\t\t12:00\t-\tTVT\t# Tuvalu Time\nZone Pacific/Johnston\t-10:00\t-\tHST\nZone Pacific/Midway\t-11:49:28 -\tLMT\t1901\n\t\t\t-11:00\t-\tNST\t1956 Jun  3\n\t\t\t-11:00\t1:00\tNDT\t1956 Sep  2\n\t\t\t-11:00\t-\tNST\t1967 Apr\t# N=Nome\n\t\t\t-11:00\t-\tBST\t1983 Nov 30\t# B=Bering\n\t\t\t-11:00\t-\tSST\t\t\t# S=Samoa\nZone\tPacific/Wake\t11:06:28 -\tLMT\t1901\n\t\t\t12:00\t-\tWAKT\t# Wake Time\nRule\tVanuatu\t1983\tonly\t-\tSep\t25\t0:00\t1:00\tS\nRule\tVanuatu\t1984\t1991\t-\tMar\tSun>=23\t0:00\t0\t-\nRule\tVanuatu\t1984\tonly\t-\tOct\t23\t0:00\t1:00\tS\nRule\tVanuatu\t1985\t1991\t-\tSep\tSun>=23\t0:00\t1:00\tS\nRule\tVanuatu\t1992\t1993\t-\tJan\tSun>=23\t0:00\t0\t-\nRule\tVanuatu\t1992\tonly\t-\tOct\tSun>=23\t0:00\t1:00\tS\nZone\tPacific/Efate\t11:13:16 -\tLMT\t1912 Jan 13\t\t# Vila\n\t\t\t11:00\tVanuatu\tVU%sT\t# Vanuatu Time\nZone\tPacific/Wallis\t12:15:20 -\tLMT\t1901\n\t\t\t12:00\t-\tWFT\t# Wallis & Futuna Time\n","tz/backward":"# <pre>\n# @(#)backward\t8.11\n# This file is in the public domain, so clarified as of\n# 2009-05-17 by Arthur David Olson.\n\n# This file provides links between current names for time zones\n# and their old names.  Many names changed in late 1993.\n\nLink\tAfrica/Asmara\t\tAfrica/Asmera\nLink\tAfrica/Bamako\t\tAfrica/Timbuktu\nLink\tAmerica/Argentina/Catamarca\tAmerica/Argentina/ComodRivadavia\nLink\tAmerica/Adak\t\tAmerica/Atka\nLink\tAmerica/Argentina/Buenos_Aires\tAmerica/Buenos_Aires\nLink\tAmerica/Argentina/Catamarca\tAmerica/Catamarca\nLink\tAmerica/Atikokan\tAmerica/Coral_Harbour\nLink\tAmerica/Argentina/Cordoba\tAmerica/Cordoba\nLink\tAmerica/Tijuana\t\tAmerica/Ensenada\nLink\tAmerica/Indiana/Indianapolis\tAmerica/Fort_Wayne\nLink\tAmerica/Indiana/Indianapolis\tAmerica/Indianapolis\nLink\tAmerica/Argentina/Jujuy\tAmerica/Jujuy\nLink\tAmerica/Indiana/Knox\tAmerica/Knox_IN\nLink\tAmerica/Kentucky/Louisville\tAmerica/Louisville\nLink\tAmerica/Argentina/Mendoza\tAmerica/Mendoza\nLink\tAmerica/Rio_Branco\tAmerica/Porto_Acre\nLink\tAmerica/Argentina/Cordoba\tAmerica/Rosario\nLink\tAmerica/St_Thomas\tAmerica/Virgin\nLink\tAsia/Ashgabat\t\tAsia/Ashkhabad\nLink\tAsia/Chongqing\t\tAsia/Chungking\nLink\tAsia/Dhaka\t\tAsia/Dacca\nLink\tAsia/Kathmandu\t\tAsia/Katmandu\nLink\tAsia/Kolkata\t\tAsia/Calcutta\nLink\tAsia/Macau\t\tAsia/Macao\nLink\tAsia/Jerusalem\t\tAsia/Tel_Aviv\nLink\tAsia/Ho_Chi_Minh\tAsia/Saigon\nLink\tAsia/Thimphu\t\tAsia/Thimbu\nLink\tAsia/Makassar\t\tAsia/Ujung_Pandang\nLink\tAsia/Ulaanbaatar\tAsia/Ulan_Bator\nLink\tAtlantic/Faroe\t\tAtlantic/Faeroe\nLink\tEurope/Oslo\t\tAtlantic/Jan_Mayen\nLink\tAustralia/Sydney\tAustralia/ACT\nLink\tAustralia/Sydney\tAustralia/Canberra\nLink\tAustralia/Lord_Howe\tAustralia/LHI\nLink\tAustralia/Sydney\tAustralia/NSW\nLink\tAustralia/Darwin\tAustralia/North\nLink\tAustralia/Brisbane\tAustralia/Queensland\nLink\tAustralia/Adelaide\tAustralia/South\nLink\tAustralia/Hobart\tAustralia/Tasmania\nLink\tAustralia/Melbourne\tAustralia/Victoria\nLink\tAustralia/Perth\t\tAustralia/West\nLink\tAustralia/Broken_Hill\tAustralia/Yancowinna\nLink\tAmerica/Rio_Branco\tBrazil/Acre\nLink\tAmerica/Noronha\t\tBrazil/DeNoronha\nLink\tAmerica/Sao_Paulo\tBrazil/East\nLink\tAmerica/Manaus\t\tBrazil/West\nLink\tAmerica/Halifax\t\tCanada/Atlantic\nLink\tAmerica/Winnipeg\tCanada/Central\nLink\tAmerica/Regina\t\tCanada/East-Saskatchewan\nLink\tAmerica/Toronto\t\tCanada/Eastern\nLink\tAmerica/Edmonton\tCanada/Mountain\nLink\tAmerica/St_Johns\tCanada/Newfoundland\nLink\tAmerica/Vancouver\tCanada/Pacific\nLink\tAmerica/Regina\t\tCanada/Saskatchewan\nLink\tAmerica/Whitehorse\tCanada/Yukon\nLink\tAmerica/Santiago\tChile/Continental\nLink\tPacific/Easter\t\tChile/EasterIsland\nLink\tAmerica/Havana\t\tCuba\nLink\tAfrica/Cairo\t\tEgypt\nLink\tEurope/Dublin\t\tEire\nLink\tEurope/London\t\tEurope/Belfast\nLink\tEurope/Chisinau\t\tEurope/Tiraspol\nLink\tEurope/London\t\tGB\nLink\tEurope/London\t\tGB-Eire\nLink\tEtc/GMT\t\t\tGMT+0\nLink\tEtc/GMT\t\t\tGMT-0\nLink\tEtc/GMT\t\t\tGMT0\nLink\tEtc/GMT\t\t\tGreenwich\nLink\tAsia/Hong_Kong\t\tHongkong\nLink\tAtlantic/Reykjavik\tIceland\nLink\tAsia/Tehran\t\tIran\nLink\tAsia/Jerusalem\t\tIsrael\nLink\tAmerica/Jamaica\t\tJamaica\nLink\tAsia/Tokyo\t\tJapan\nLink\tPacific/Kwajalein\tKwajalein\nLink\tAfrica/Tripoli\t\tLibya\nLink\tAmerica/Tijuana\t\tMexico/BajaNorte\nLink\tAmerica/Mazatlan\tMexico/BajaSur\nLink\tAmerica/Mexico_City\tMexico/General\nLink\tPacific/Auckland\tNZ\nLink\tPacific/Chatham\t\tNZ-CHAT\nLink\tAmerica/Denver\t\tNavajo\nLink\tAsia/Shanghai\t\tPRC\nLink\tPacific/Pago_Pago\tPacific/Samoa\nLink\tPacific/Chuuk\t\tPacific/Yap\nLink\tPacific/Chuuk\t\tPacific/Truk\nLink\tPacific/Pohnpei\t\tPacific/Ponape\nLink\tEurope/Warsaw\t\tPoland\nLink\tEurope/Lisbon\t\tPortugal\nLink\tAsia/Taipei\t\tROC\nLink\tAsia/Seoul\t\tROK\nLink\tAsia/Singapore\t\tSingapore\nLink\tEurope/Istanbul\t\tTurkey\nLink\tEtc/UCT\t\t\tUCT\nLink\tAmerica/Anchorage\tUS/Alaska\nLink\tAmerica/Adak\t\tUS/Aleutian\nLink\tAmerica/Phoenix\t\tUS/Arizona\nLink\tAmerica/Chicago\t\tUS/Central\nLink\tAmerica/Indiana/Indianapolis\tUS/East-Indiana\nLink\tAmerica/New_York\tUS/Eastern\nLink\tPacific/Honolulu\tUS/Hawaii\nLink\tAmerica/Indiana/Knox\tUS/Indiana-Starke\nLink\tAmerica/Detroit\t\tUS/Michigan\nLink\tAmerica/Denver\t\tUS/Mountain\nLink\tAmerica/Los_Angeles\tUS/Pacific\nLink\tPacific/Pago_Pago\tUS/Samoa\nLink\tEtc/UTC\t\t\tUTC\nLink\tEtc/UTC\t\t\tUniversal\nLink\tEurope/Moscow\t\tW-SU\nLink\tEtc/UTC\t\t\tZulu\n","tz/etcetera":"Zone\tEtc/GMT\t\t0\t-\tGMT\nZone\tEtc/UTC\t\t0\t-\tUTC\nZone\tEtc/UCT\t\t0\t-\tUCT\nLink\tEtc/GMT\t\t\t\tGMT\nLink\tEtc/UTC\t\t\t\tEtc/Universal\nLink\tEtc/UTC\t\t\t\tEtc/Zulu\nLink\tEtc/GMT\t\t\t\tEtc/Greenwich\nLink\tEtc/GMT\t\t\t\tEtc/GMT-0\nLink\tEtc/GMT\t\t\t\tEtc/GMT+0\nLink\tEtc/GMT\t\t\t\tEtc/GMT0\nZone\tEtc/GMT-14\t14\t-\tGMT-14\t# 14 hours ahead of GMT\nZone\tEtc/GMT-13\t13\t-\tGMT-13\nZone\tEtc/GMT-12\t12\t-\tGMT-12\nZone\tEtc/GMT-11\t11\t-\tGMT-11\nZone\tEtc/GMT-10\t10\t-\tGMT-10\nZone\tEtc/GMT-9\t9\t-\tGMT-9\nZone\tEtc/GMT-8\t8\t-\tGMT-8\nZone\tEtc/GMT-7\t7\t-\tGMT-7\nZone\tEtc/GMT-6\t6\t-\tGMT-6\nZone\tEtc/GMT-5\t5\t-\tGMT-5\nZone\tEtc/GMT-4\t4\t-\tGMT-4\nZone\tEtc/GMT-3\t3\t-\tGMT-3\nZone\tEtc/GMT-2\t2\t-\tGMT-2\nZone\tEtc/GMT-1\t1\t-\tGMT-1\nZone\tEtc/GMT+1\t-1\t-\tGMT+1\nZone\tEtc/GMT+2\t-2\t-\tGMT+2\nZone\tEtc/GMT+3\t-3\t-\tGMT+3\nZone\tEtc/GMT+4\t-4\t-\tGMT+4\nZone\tEtc/GMT+5\t-5\t-\tGMT+5\nZone\tEtc/GMT+6\t-6\t-\tGMT+6\nZone\tEtc/GMT+7\t-7\t-\tGMT+7\nZone\tEtc/GMT+8\t-8\t-\tGMT+8\nZone\tEtc/GMT+9\t-9\t-\tGMT+9\nZone\tEtc/GMT+10\t-10\t-\tGMT+10\nZone\tEtc/GMT+11\t-11\t-\tGMT+11\nZone\tEtc/GMT+12\t-12\t-\tGMT+12\n","tz/europe":"Rule\tGB-Eire\t1916\tonly\t-\tMay\t21\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1916\tonly\t-\tOct\t 1\t2:00s\t0\tGMT\nRule\tGB-Eire\t1917\tonly\t-\tApr\t 8\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1917\tonly\t-\tSep\t17\t2:00s\t0\tGMT\nRule\tGB-Eire\t1918\tonly\t-\tMar\t24\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1918\tonly\t-\tSep\t30\t2:00s\t0\tGMT\nRule\tGB-Eire\t1919\tonly\t-\tMar\t30\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1919\tonly\t-\tSep\t29\t2:00s\t0\tGMT\nRule\tGB-Eire\t1920\tonly\t-\tMar\t28\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1920\tonly\t-\tOct\t25\t2:00s\t0\tGMT\nRule\tGB-Eire\t1921\tonly\t-\tApr\t 3\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1921\tonly\t-\tOct\t 3\t2:00s\t0\tGMT\nRule\tGB-Eire\t1922\tonly\t-\tMar\t26\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1922\tonly\t-\tOct\t 8\t2:00s\t0\tGMT\nRule\tGB-Eire\t1923\tonly\t-\tApr\tSun>=16\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1923\t1924\t-\tSep\tSun>=16\t2:00s\t0\tGMT\nRule\tGB-Eire\t1924\tonly\t-\tApr\tSun>=9\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1925\t1926\t-\tApr\tSun>=16\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1925\t1938\t-\tOct\tSun>=2\t2:00s\t0\tGMT\nRule\tGB-Eire\t1927\tonly\t-\tApr\tSun>=9\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1928\t1929\t-\tApr\tSun>=16\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1930\tonly\t-\tApr\tSun>=9\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1931\t1932\t-\tApr\tSun>=16\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1933\tonly\t-\tApr\tSun>=9\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1934\tonly\t-\tApr\tSun>=16\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1935\tonly\t-\tApr\tSun>=9\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1936\t1937\t-\tApr\tSun>=16\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1938\tonly\t-\tApr\tSun>=9\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1939\tonly\t-\tApr\tSun>=16\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1939\tonly\t-\tNov\tSun>=16\t2:00s\t0\tGMT\nRule\tGB-Eire\t1940\tonly\t-\tFeb\tSun>=23\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1941\tonly\t-\tMay\tSun>=2\t1:00s\t2:00\tBDST\nRule\tGB-Eire\t1941\t1943\t-\tAug\tSun>=9\t1:00s\t1:00\tBST\nRule\tGB-Eire\t1942\t1944\t-\tApr\tSun>=2\t1:00s\t2:00\tBDST\nRule\tGB-Eire\t1944\tonly\t-\tSep\tSun>=16\t1:00s\t1:00\tBST\nRule\tGB-Eire\t1945\tonly\t-\tApr\tMon>=2\t1:00s\t2:00\tBDST\nRule\tGB-Eire\t1945\tonly\t-\tJul\tSun>=9\t1:00s\t1:00\tBST\nRule\tGB-Eire\t1945\t1946\t-\tOct\tSun>=2\t2:00s\t0\tGMT\nRule\tGB-Eire\t1946\tonly\t-\tApr\tSun>=9\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1947\tonly\t-\tMar\t16\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1947\tonly\t-\tApr\t13\t1:00s\t2:00\tBDST\nRule\tGB-Eire\t1947\tonly\t-\tAug\t10\t1:00s\t1:00\tBST\nRule\tGB-Eire\t1947\tonly\t-\tNov\t 2\t2:00s\t0\tGMT\nRule\tGB-Eire\t1948\tonly\t-\tMar\t14\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1948\tonly\t-\tOct\t31\t2:00s\t0\tGMT\nRule\tGB-Eire\t1949\tonly\t-\tApr\t 3\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1949\tonly\t-\tOct\t30\t2:00s\t0\tGMT\nRule\tGB-Eire\t1950\t1952\t-\tApr\tSun>=14\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1950\t1952\t-\tOct\tSun>=21\t2:00s\t0\tGMT\nRule\tGB-Eire\t1953\tonly\t-\tApr\tSun>=16\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1953\t1960\t-\tOct\tSun>=2\t2:00s\t0\tGMT\nRule\tGB-Eire\t1954\tonly\t-\tApr\tSun>=9\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1955\t1956\t-\tApr\tSun>=16\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1957\tonly\t-\tApr\tSun>=9\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1958\t1959\t-\tApr\tSun>=16\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1960\tonly\t-\tApr\tSun>=9\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1961\t1963\t-\tMar\tlastSun\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1961\t1968\t-\tOct\tSun>=23\t2:00s\t0\tGMT\nRule\tGB-Eire\t1964\t1967\t-\tMar\tSun>=19\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1968\tonly\t-\tFeb\t18\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1972\t1980\t-\tMar\tSun>=16\t2:00s\t1:00\tBST\nRule\tGB-Eire\t1972\t1980\t-\tOct\tSun>=23\t2:00s\t0\tGMT\nRule\tGB-Eire\t1981\t1995\t-\tMar\tlastSun\t1:00u\t1:00\tBST\nRule\tGB-Eire 1981\t1989\t-\tOct\tSun>=23\t1:00u\t0\tGMT\nRule\tGB-Eire 1990\t1995\t-\tOct\tSun>=22\t1:00u\t0\tGMT\nZone\tEurope/London\t-0:01:15 -\tLMT\t1847 Dec  1 0:00s\n\t\t\t 0:00\tGB-Eire\t%s\t1968 Oct 27\n\t\t\t 1:00\t-\tBST\t1971 Oct 31 2:00u\n\t\t\t 0:00\tGB-Eire\t%s\t1996\n\t\t\t 0:00\tEU\tGMT/BST\nLink\tEurope/London\tEurope/Jersey\nLink\tEurope/London\tEurope/Guernsey\nLink\tEurope/London\tEurope/Isle_of_Man\nZone\tEurope/Dublin\t-0:25:00 -\tLMT\t1880 Aug  2\n\t\t\t-0:25:21 -\tDMT\t1916 May 21 2:00\n\t\t\t-0:25:21 1:00\tIST\t1916 Oct  1 2:00s\n\t\t\t 0:00\tGB-Eire\t%s\t1921 Dec  6 # independence\n\t\t\t 0:00\tGB-Eire\tGMT/IST\t1940 Feb 25 2:00\n\t\t\t 0:00\t1:00\tIST\t1946 Oct  6 2:00\n\t\t\t 0:00\t-\tGMT\t1947 Mar 16 2:00\n\t\t\t 0:00\t1:00\tIST\t1947 Nov  2 2:00\n\t\t\t 0:00\t-\tGMT\t1948 Apr 18 2:00\n\t\t\t 0:00\tGB-Eire\tGMT/IST\t1968 Oct 27\n\t\t\t 1:00\t-\tIST\t1971 Oct 31 2:00u\n\t\t\t 0:00\tGB-Eire\tGMT/IST\t1996\n\t\t\t 0:00\tEU\tGMT/IST\nRule\tEU\t1977\t1980\t-\tApr\tSun>=1\t 1:00u\t1:00\tS\nRule\tEU\t1977\tonly\t-\tSep\tlastSun\t 1:00u\t0\t-\nRule\tEU\t1978\tonly\t-\tOct\t 1\t 1:00u\t0\t-\nRule\tEU\t1979\t1995\t-\tSep\tlastSun\t 1:00u\t0\t-\nRule\tEU\t1981\tmax\t-\tMar\tlastSun\t 1:00u\t1:00\tS\nRule\tEU\t1996\tmax\t-\tOct\tlastSun\t 1:00u\t0\t-\nRule\tW-Eur\t1977\t1980\t-\tApr\tSun>=1\t 1:00s\t1:00\tS\nRule\tW-Eur\t1977\tonly\t-\tSep\tlastSun\t 1:00s\t0\t-\nRule\tW-Eur\t1978\tonly\t-\tOct\t 1\t 1:00s\t0\t-\nRule\tW-Eur\t1979\t1995\t-\tSep\tlastSun\t 1:00s\t0\t-\nRule\tW-Eur\t1981\tmax\t-\tMar\tlastSun\t 1:00s\t1:00\tS\nRule\tW-Eur\t1996\tmax\t-\tOct\tlastSun\t 1:00s\t0\t-\nRule\tC-Eur\t1916\tonly\t-\tApr\t30\t23:00\t1:00\tS\nRule\tC-Eur\t1916\tonly\t-\tOct\t 1\t 1:00\t0\t-\nRule\tC-Eur\t1917\t1918\t-\tApr\tMon>=15\t 2:00s\t1:00\tS\nRule\tC-Eur\t1917\t1918\t-\tSep\tMon>=15\t 2:00s\t0\t-\nRule\tC-Eur\t1940\tonly\t-\tApr\t 1\t 2:00s\t1:00\tS\nRule\tC-Eur\t1942\tonly\t-\tNov\t 2\t 2:00s\t0\t-\nRule\tC-Eur\t1943\tonly\t-\tMar\t29\t 2:00s\t1:00\tS\nRule\tC-Eur\t1943\tonly\t-\tOct\t 4\t 2:00s\t0\t-\nRule\tC-Eur\t1944\t1945\t-\tApr\tMon>=1\t 2:00s\t1:00\tS\nRule\tC-Eur\t1944\tonly\t-\tOct\t 2\t 2:00s\t0\t-\nRule\tC-Eur\t1945\tonly\t-\tSep\t16\t 2:00s\t0\t-\nRule\tC-Eur\t1977\t1980\t-\tApr\tSun>=1\t 2:00s\t1:00\tS\nRule\tC-Eur\t1977\tonly\t-\tSep\tlastSun\t 2:00s\t0\t-\nRule\tC-Eur\t1978\tonly\t-\tOct\t 1\t 2:00s\t0\t-\nRule\tC-Eur\t1979\t1995\t-\tSep\tlastSun\t 2:00s\t0\t-\nRule\tC-Eur\t1981\tmax\t-\tMar\tlastSun\t 2:00s\t1:00\tS\nRule\tC-Eur\t1996\tmax\t-\tOct\tlastSun\t 2:00s\t0\t-\nRule\tE-Eur\t1977\t1980\t-\tApr\tSun>=1\t 0:00\t1:00\tS\nRule\tE-Eur\t1977\tonly\t-\tSep\tlastSun\t 0:00\t0\t-\nRule\tE-Eur\t1978\tonly\t-\tOct\t 1\t 0:00\t0\t-\nRule\tE-Eur\t1979\t1995\t-\tSep\tlastSun\t 0:00\t0\t-\nRule\tE-Eur\t1981\tmax\t-\tMar\tlastSun\t 0:00\t1:00\tS\nRule\tE-Eur\t1996\tmax\t-\tOct\tlastSun\t 0:00\t0\t-\nRule\tRussia\t1917\tonly\t-\tJul\t 1\t23:00\t1:00\tMST\t# Moscow Summer Time\nRule\tRussia\t1917\tonly\t-\tDec\t28\t 0:00\t0\tMMT\t# Moscow Mean Time\nRule\tRussia\t1918\tonly\t-\tMay\t31\t22:00\t2:00\tMDST\t# Moscow Double Summer Time\nRule\tRussia\t1918\tonly\t-\tSep\t16\t 1:00\t1:00\tMST\nRule\tRussia\t1919\tonly\t-\tMay\t31\t23:00\t2:00\tMDST\nRule\tRussia\t1919\tonly\t-\tJul\t 1\t 2:00\t1:00\tS\nRule\tRussia\t1919\tonly\t-\tAug\t16\t 0:00\t0\t-\nRule\tRussia\t1921\tonly\t-\tFeb\t14\t23:00\t1:00\tS\nRule\tRussia\t1921\tonly\t-\tMar\t20\t23:00\t2:00\tM # Midsummer\nRule\tRussia\t1921\tonly\t-\tSep\t 1\t 0:00\t1:00\tS\nRule\tRussia\t1921\tonly\t-\tOct\t 1\t 0:00\t0\t-\nRule\tRussia\t1981\t1984\t-\tApr\t 1\t 0:00\t1:00\tS\nRule\tRussia\t1981\t1983\t-\tOct\t 1\t 0:00\t0\t-\nRule\tRussia\t1984\t1991\t-\tSep\tlastSun\t 2:00s\t0\t-\nRule\tRussia\t1985\t1991\t-\tMar\tlastSun\t 2:00s\t1:00\tS\nRule\tRussia\t1992\tonly\t-\tMar\tlastSat\t 23:00\t1:00\tS\nRule\tRussia\t1992\tonly\t-\tSep\tlastSat\t 23:00\t0\t-\nRule\tRussia\t1993\t2010\t-\tMar\tlastSun\t 2:00s\t1:00\tS\nRule\tRussia\t1993\t1995\t-\tSep\tlastSun\t 2:00s\t0\t-\nRule\tRussia\t1996\t2010\t-\tOct\tlastSun\t 2:00s\t0\t-\nZone\tWET\t\t0:00\tEU\tWE%sT\nZone\tCET\t\t1:00\tC-Eur\tCE%sT\nZone\tMET\t\t1:00\tC-Eur\tME%sT\nZone\tEET\t\t2:00\tEU\tEE%sT\nRule\tAlbania\t1940\tonly\t-\tJun\t16\t0:00\t1:00\tS\nRule\tAlbania\t1942\tonly\t-\tNov\t 2\t3:00\t0\t-\nRule\tAlbania\t1943\tonly\t-\tMar\t29\t2:00\t1:00\tS\nRule\tAlbania\t1943\tonly\t-\tApr\t10\t3:00\t0\t-\nRule\tAlbania\t1974\tonly\t-\tMay\t 4\t0:00\t1:00\tS\nRule\tAlbania\t1974\tonly\t-\tOct\t 2\t0:00\t0\t-\nRule\tAlbania\t1975\tonly\t-\tMay\t 1\t0:00\t1:00\tS\nRule\tAlbania\t1975\tonly\t-\tOct\t 2\t0:00\t0\t-\nRule\tAlbania\t1976\tonly\t-\tMay\t 2\t0:00\t1:00\tS\nRule\tAlbania\t1976\tonly\t-\tOct\t 3\t0:00\t0\t-\nRule\tAlbania\t1977\tonly\t-\tMay\t 8\t0:00\t1:00\tS\nRule\tAlbania\t1977\tonly\t-\tOct\t 2\t0:00\t0\t-\nRule\tAlbania\t1978\tonly\t-\tMay\t 6\t0:00\t1:00\tS\nRule\tAlbania\t1978\tonly\t-\tOct\t 1\t0:00\t0\t-\nRule\tAlbania\t1979\tonly\t-\tMay\t 5\t0:00\t1:00\tS\nRule\tAlbania\t1979\tonly\t-\tSep\t30\t0:00\t0\t-\nRule\tAlbania\t1980\tonly\t-\tMay\t 3\t0:00\t1:00\tS\nRule\tAlbania\t1980\tonly\t-\tOct\t 4\t0:00\t0\t-\nRule\tAlbania\t1981\tonly\t-\tApr\t26\t0:00\t1:00\tS\nRule\tAlbania\t1981\tonly\t-\tSep\t27\t0:00\t0\t-\nRule\tAlbania\t1982\tonly\t-\tMay\t 2\t0:00\t1:00\tS\nRule\tAlbania\t1982\tonly\t-\tOct\t 3\t0:00\t0\t-\nRule\tAlbania\t1983\tonly\t-\tApr\t18\t0:00\t1:00\tS\nRule\tAlbania\t1983\tonly\t-\tOct\t 1\t0:00\t0\t-\nRule\tAlbania\t1984\tonly\t-\tApr\t 1\t0:00\t1:00\tS\nZone\tEurope/Tirane\t1:19:20 -\tLMT\t1914\n\t\t\t1:00\t-\tCET\t1940 Jun 16\n\t\t\t1:00\tAlbania\tCE%sT\t1984 Jul\n\t\t\t1:00\tEU\tCE%sT\nZone\tEurope/Andorra\t0:06:04 -\tLMT\t1901\n\t\t\t0:00\t-\tWET\t1946 Sep 30\n\t\t\t1:00\t-\tCET\t1985 Mar 31 2:00\n\t\t\t1:00\tEU\tCE%sT\nRule\tAustria\t1920\tonly\t-\tApr\t 5\t2:00s\t1:00\tS\nRule\tAustria\t1920\tonly\t-\tSep\t13\t2:00s\t0\t-\nRule\tAustria\t1946\tonly\t-\tApr\t14\t2:00s\t1:00\tS\nRule\tAustria\t1946\t1948\t-\tOct\tSun>=1\t2:00s\t0\t-\nRule\tAustria\t1947\tonly\t-\tApr\t 6\t2:00s\t1:00\tS\nRule\tAustria\t1948\tonly\t-\tApr\t18\t2:00s\t1:00\tS\nRule\tAustria\t1980\tonly\t-\tApr\t 6\t0:00\t1:00\tS\nRule\tAustria\t1980\tonly\t-\tSep\t28\t0:00\t0\t-\nZone\tEurope/Vienna\t1:05:20 -\tLMT\t1893 Apr\n\t\t\t1:00\tC-Eur\tCE%sT\t1920\n\t\t\t1:00\tAustria\tCE%sT\t1940 Apr  1 2:00s\n\t\t\t1:00\tC-Eur\tCE%sT\t1945 Apr  2 2:00s\n\t\t\t1:00\t1:00\tCEST\t1945 Apr 12 2:00s\n\t\t\t1:00\t-\tCET\t1946\n\t\t\t1:00\tAustria\tCE%sT\t1981\n\t\t\t1:00\tEU\tCE%sT\nZone\tEurope/Minsk\t1:50:16 -\tLMT\t1880\n\t\t\t1:50\t-\tMMT\t1924 May 2 # Minsk Mean Time\n\t\t\t2:00\t-\tEET\t1930 Jun 21\n\t\t\t3:00\t-\tMSK\t1941 Jun 28\n\t\t\t1:00\tC-Eur\tCE%sT\t1944 Jul  3\n\t\t\t3:00\tRussia\tMSK/MSD\t1990\n\t\t\t3:00\t-\tMSK\t1991 Mar 31 2:00s\n\t\t\t2:00\t1:00\tEEST\t1991 Sep 29 2:00s\n\t\t\t2:00\t-\tEET\t1992 Mar 29 0:00s\n\t\t\t2:00\t1:00\tEEST\t1992 Sep 27 0:00s\n\t\t\t2:00\tRussia\tEE%sT\t2011 Mar 27 2:00s\n\t\t\t3:00\t-\tFET # Further-eastern European Time\nRule\tBelgium\t1918\tonly\t-\tMar\t 9\t 0:00s\t1:00\tS\nRule\tBelgium\t1918\t1919\t-\tOct\tSat>=1\t23:00s\t0\t-\nRule\tBelgium\t1919\tonly\t-\tMar\t 1\t23:00s\t1:00\tS\nRule\tBelgium\t1920\tonly\t-\tFeb\t14\t23:00s\t1:00\tS\nRule\tBelgium\t1920\tonly\t-\tOct\t23\t23:00s\t0\t-\nRule\tBelgium\t1921\tonly\t-\tMar\t14\t23:00s\t1:00\tS\nRule\tBelgium\t1921\tonly\t-\tOct\t25\t23:00s\t0\t-\nRule\tBelgium\t1922\tonly\t-\tMar\t25\t23:00s\t1:00\tS\nRule\tBelgium\t1922\t1927\t-\tOct\tSat>=1\t23:00s\t0\t-\nRule\tBelgium\t1923\tonly\t-\tApr\t21\t23:00s\t1:00\tS\nRule\tBelgium\t1924\tonly\t-\tMar\t29\t23:00s\t1:00\tS\nRule\tBelgium\t1925\tonly\t-\tApr\t 4\t23:00s\t1:00\tS\nRule\tBelgium\t1926\tonly\t-\tApr\t17\t23:00s\t1:00\tS\nRule\tBelgium\t1927\tonly\t-\tApr\t 9\t23:00s\t1:00\tS\nRule\tBelgium\t1928\tonly\t-\tApr\t14\t23:00s\t1:00\tS\nRule\tBelgium\t1928\t1938\t-\tOct\tSun>=2\t 2:00s\t0\t-\nRule\tBelgium\t1929\tonly\t-\tApr\t21\t 2:00s\t1:00\tS\nRule\tBelgium\t1930\tonly\t-\tApr\t13\t 2:00s\t1:00\tS\nRule\tBelgium\t1931\tonly\t-\tApr\t19\t 2:00s\t1:00\tS\nRule\tBelgium\t1932\tonly\t-\tApr\t 3\t 2:00s\t1:00\tS\nRule\tBelgium\t1933\tonly\t-\tMar\t26\t 2:00s\t1:00\tS\nRule\tBelgium\t1934\tonly\t-\tApr\t 8\t 2:00s\t1:00\tS\nRule\tBelgium\t1935\tonly\t-\tMar\t31\t 2:00s\t1:00\tS\nRule\tBelgium\t1936\tonly\t-\tApr\t19\t 2:00s\t1:00\tS\nRule\tBelgium\t1937\tonly\t-\tApr\t 4\t 2:00s\t1:00\tS\nRule\tBelgium\t1938\tonly\t-\tMar\t27\t 2:00s\t1:00\tS\nRule\tBelgium\t1939\tonly\t-\tApr\t16\t 2:00s\t1:00\tS\nRule\tBelgium\t1939\tonly\t-\tNov\t19\t 2:00s\t0\t-\nRule\tBelgium\t1940\tonly\t-\tFeb\t25\t 2:00s\t1:00\tS\nRule\tBelgium\t1944\tonly\t-\tSep\t17\t 2:00s\t0\t-\nRule\tBelgium\t1945\tonly\t-\tApr\t 2\t 2:00s\t1:00\tS\nRule\tBelgium\t1945\tonly\t-\tSep\t16\t 2:00s\t0\t-\nRule\tBelgium\t1946\tonly\t-\tMay\t19\t 2:00s\t1:00\tS\nRule\tBelgium\t1946\tonly\t-\tOct\t 7\t 2:00s\t0\t-\nZone\tEurope/Brussels\t0:17:30 -\tLMT\t1880\n\t\t\t0:17:30\t-\tBMT\t1892 May  1 12:00 # Brussels MT\n\t\t\t0:00\t-\tWET\t1914 Nov  8\n\t\t\t1:00\t-\tCET\t1916 May  1  0:00\n\t\t\t1:00\tC-Eur\tCE%sT\t1918 Nov 11 11:00u\n\t\t\t0:00\tBelgium\tWE%sT\t1940 May 20  2:00s\n\t\t\t1:00\tC-Eur\tCE%sT\t1944 Sep  3\n\t\t\t1:00\tBelgium\tCE%sT\t1977\n\t\t\t1:00\tEU\tCE%sT\nRule\tBulg\t1979\tonly\t-\tMar\t31\t23:00\t1:00\tS\nRule\tBulg\t1979\tonly\t-\tOct\t 1\t 1:00\t0\t-\nRule\tBulg\t1980\t1982\t-\tApr\tSat>=1\t23:00\t1:00\tS\nRule\tBulg\t1980\tonly\t-\tSep\t29\t 1:00\t0\t-\nRule\tBulg\t1981\tonly\t-\tSep\t27\t 2:00\t0\t-\nZone\tEurope/Sofia\t1:33:16 -\tLMT\t1880\n\t\t\t1:56:56\t-\tIMT\t1894 Nov 30 # Istanbul MT?\n\t\t\t2:00\t-\tEET\t1942 Nov  2  3:00\n\t\t\t1:00\tC-Eur\tCE%sT\t1945\n\t\t\t1:00\t-\tCET\t1945 Apr 2 3:00\n\t\t\t2:00\t-\tEET\t1979 Mar 31 23:00\n\t\t\t2:00\tBulg\tEE%sT\t1982 Sep 26  2:00\n\t\t\t2:00\tC-Eur\tEE%sT\t1991\n\t\t\t2:00\tE-Eur\tEE%sT\t1997\n\t\t\t2:00\tEU\tEE%sT\nRule\tCzech\t1945\tonly\t-\tApr\t 8\t2:00s\t1:00\tS\nRule\tCzech\t1945\tonly\t-\tNov\t18\t2:00s\t0\t-\nRule\tCzech\t1946\tonly\t-\tMay\t 6\t2:00s\t1:00\tS\nRule\tCzech\t1946\t1949\t-\tOct\tSun>=1\t2:00s\t0\t-\nRule\tCzech\t1947\tonly\t-\tApr\t20\t2:00s\t1:00\tS\nRule\tCzech\t1948\tonly\t-\tApr\t18\t2:00s\t1:00\tS\nRule\tCzech\t1949\tonly\t-\tApr\t 9\t2:00s\t1:00\tS\nZone\tEurope/Prague\t0:57:44 -\tLMT\t1850\n\t\t\t0:57:44\t-\tPMT\t1891 Oct     # Prague Mean Time\n\t\t\t1:00\tC-Eur\tCE%sT\t1944 Sep 17 2:00s\n\t\t\t1:00\tCzech\tCE%sT\t1979\n\t\t\t1:00\tEU\tCE%sT\nRule\tDenmark\t1916\tonly\t-\tMay\t14\t23:00\t1:00\tS\nRule\tDenmark\t1916\tonly\t-\tSep\t30\t23:00\t0\t-\nRule\tDenmark\t1940\tonly\t-\tMay\t15\t 0:00\t1:00\tS\nRule\tDenmark\t1945\tonly\t-\tApr\t 2\t 2:00s\t1:00\tS\nRule\tDenmark\t1945\tonly\t-\tAug\t15\t 2:00s\t0\t-\nRule\tDenmark\t1946\tonly\t-\tMay\t 1\t 2:00s\t1:00\tS\nRule\tDenmark\t1946\tonly\t-\tSep\t 1\t 2:00s\t0\t-\nRule\tDenmark\t1947\tonly\t-\tMay\t 4\t 2:00s\t1:00\tS\nRule\tDenmark\t1947\tonly\t-\tAug\t10\t 2:00s\t0\t-\nRule\tDenmark\t1948\tonly\t-\tMay\t 9\t 2:00s\t1:00\tS\nRule\tDenmark\t1948\tonly\t-\tAug\t 8\t 2:00s\t0\t-\nZone Europe/Copenhagen\t 0:50:20 -\tLMT\t1890\n\t\t\t 0:50:20 -\tCMT\t1894 Jan  1 # Copenhagen MT\n\t\t\t 1:00\tDenmark\tCE%sT\t1942 Nov  2 2:00s\n\t\t\t 1:00\tC-Eur\tCE%sT\t1945 Apr  2 2:00\n\t\t\t 1:00\tDenmark\tCE%sT\t1980\n\t\t\t 1:00\tEU\tCE%sT\nZone Atlantic/Faroe\t-0:27:04 -\tLMT\t1908 Jan 11\t# Torshavn\n\t\t\t 0:00\t-\tWET\t1981\n\t\t\t 0:00\tEU\tWE%sT\nRule\tThule\t1991\t1992\t-\tMar\tlastSun\t2:00\t1:00\tD\nRule\tThule\t1991\t1992\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tThule\t1993\t2006\t-\tApr\tSun>=1\t2:00\t1:00\tD\nRule\tThule\t1993\t2006\t-\tOct\tlastSun\t2:00\t0\tS\nRule\tThule\t2007\tmax\t-\tMar\tSun>=8\t2:00\t1:00\tD\nRule\tThule\t2007\tmax\t-\tNov\tSun>=1\t2:00\t0\tS\nZone America/Danmarkshavn -1:14:40 -\tLMT\t1916 Jul 28\n\t\t\t-3:00\t-\tWGT\t1980 Apr  6 2:00\n\t\t\t-3:00\tEU\tWG%sT\t1996\n\t\t\t0:00\t-\tGMT\nZone America/Scoresbysund -1:27:52 -\tLMT\t1916 Jul 28 # Ittoqqortoormiit\n\t\t\t-2:00\t-\tCGT\t1980 Apr  6 2:00\n\t\t\t-2:00\tC-Eur\tCG%sT\t1981 Mar 29\n\t\t\t-1:00\tEU\tEG%sT\nZone America/Godthab\t-3:26:56 -\tLMT\t1916 Jul 28 # Nuuk\n\t\t\t-3:00\t-\tWGT\t1980 Apr  6 2:00\n\t\t\t-3:00\tEU\tWG%sT\nZone America/Thule\t-4:35:08 -\tLMT\t1916 Jul 28 # Pituffik air base\n\t\t\t-4:00\tThule\tA%sT\nZone\tEurope/Tallinn\t1:39:00\t-\tLMT\t1880\n\t\t\t1:39:00\t-\tTMT\t1918 Feb # Tallinn Mean Time\n\t\t\t1:00\tC-Eur\tCE%sT\t1919 Jul\n\t\t\t1:39:00\t-\tTMT\t1921 May\n\t\t\t2:00\t-\tEET\t1940 Aug  6\n\t\t\t3:00\t-\tMSK\t1941 Sep 15\n\t\t\t1:00\tC-Eur\tCE%sT\t1944 Sep 22\n\t\t\t3:00\tRussia\tMSK/MSD\t1989 Mar 26 2:00s\n\t\t\t2:00\t1:00\tEEST\t1989 Sep 24 2:00s\n\t\t\t2:00\tC-Eur\tEE%sT\t1998 Sep 22\n\t\t\t2:00\tEU\tEE%sT\t1999 Nov  1\n\t\t\t2:00\t-\tEET\t2002 Feb 21\n\t\t\t2:00\tEU\tEE%sT\nRule\tFinland\t1942\tonly\t-\tApr\t3\t0:00\t1:00\tS\nRule\tFinland\t1942\tonly\t-\tOct\t3\t0:00\t0\t-\nRule\tFinland\t1981\t1982\t-\tMar\tlastSun\t2:00\t1:00\tS\nRule\tFinland\t1981\t1982\t-\tSep\tlastSun\t3:00\t0\t-\nZone\tEurope/Helsinki\t1:39:52 -\tLMT\t1878 May 31\n\t\t\t1:39:52\t-\tHMT\t1921 May    # Helsinki Mean Time\n\t\t\t2:00\tFinland\tEE%sT\t1983\n\t\t\t2:00\tEU\tEE%sT\nLink\tEurope/Helsinki\tEurope/Mariehamn\nRule\tFrance\t1916\tonly\t-\tJun\t14\t23:00s\t1:00\tS\nRule\tFrance\t1916\t1919\t-\tOct\tSun>=1\t23:00s\t0\t-\nRule\tFrance\t1917\tonly\t-\tMar\t24\t23:00s\t1:00\tS\nRule\tFrance\t1918\tonly\t-\tMar\t 9\t23:00s\t1:00\tS\nRule\tFrance\t1919\tonly\t-\tMar\t 1\t23:00s\t1:00\tS\nRule\tFrance\t1920\tonly\t-\tFeb\t14\t23:00s\t1:00\tS\nRule\tFrance\t1920\tonly\t-\tOct\t23\t23:00s\t0\t-\nRule\tFrance\t1921\tonly\t-\tMar\t14\t23:00s\t1:00\tS\nRule\tFrance\t1921\tonly\t-\tOct\t25\t23:00s\t0\t-\nRule\tFrance\t1922\tonly\t-\tMar\t25\t23:00s\t1:00\tS\nRule\tFrance\t1922\t1938\t-\tOct\tSat>=1\t23:00s\t0\t-\nRule\tFrance\t1923\tonly\t-\tMay\t26\t23:00s\t1:00\tS\nRule\tFrance\t1924\tonly\t-\tMar\t29\t23:00s\t1:00\tS\nRule\tFrance\t1925\tonly\t-\tApr\t 4\t23:00s\t1:00\tS\nRule\tFrance\t1926\tonly\t-\tApr\t17\t23:00s\t1:00\tS\nRule\tFrance\t1927\tonly\t-\tApr\t 9\t23:00s\t1:00\tS\nRule\tFrance\t1928\tonly\t-\tApr\t14\t23:00s\t1:00\tS\nRule\tFrance\t1929\tonly\t-\tApr\t20\t23:00s\t1:00\tS\nRule\tFrance\t1930\tonly\t-\tApr\t12\t23:00s\t1:00\tS\nRule\tFrance\t1931\tonly\t-\tApr\t18\t23:00s\t1:00\tS\nRule\tFrance\t1932\tonly\t-\tApr\t 2\t23:00s\t1:00\tS\nRule\tFrance\t1933\tonly\t-\tMar\t25\t23:00s\t1:00\tS\nRule\tFrance\t1934\tonly\t-\tApr\t 7\t23:00s\t1:00\tS\nRule\tFrance\t1935\tonly\t-\tMar\t30\t23:00s\t1:00\tS\nRule\tFrance\t1936\tonly\t-\tApr\t18\t23:00s\t1:00\tS\nRule\tFrance\t1937\tonly\t-\tApr\t 3\t23:00s\t1:00\tS\nRule\tFrance\t1938\tonly\t-\tMar\t26\t23:00s\t1:00\tS\nRule\tFrance\t1939\tonly\t-\tApr\t15\t23:00s\t1:00\tS\nRule\tFrance\t1939\tonly\t-\tNov\t18\t23:00s\t0\t-\nRule\tFrance\t1940\tonly\t-\tFeb\t25\t 2:00\t1:00\tS\nRule\tFrance\t1941\tonly\t-\tMay\t 5\t 0:00\t2:00\tM # Midsummer\nRule\tFrance\t1941\tonly\t-\tOct\t 6\t 0:00\t1:00\tS\nRule\tFrance\t1942\tonly\t-\tMar\t 9\t 0:00\t2:00\tM\nRule\tFrance\t1942\tonly\t-\tNov\t 2\t 3:00\t1:00\tS\nRule\tFrance\t1943\tonly\t-\tMar\t29\t 2:00\t2:00\tM\nRule\tFrance\t1943\tonly\t-\tOct\t 4\t 3:00\t1:00\tS\nRule\tFrance\t1944\tonly\t-\tApr\t 3\t 2:00\t2:00\tM\nRule\tFrance\t1944\tonly\t-\tOct\t 8\t 1:00\t1:00\tS\nRule\tFrance\t1945\tonly\t-\tApr\t 2\t 2:00\t2:00\tM\nRule\tFrance\t1945\tonly\t-\tSep\t16\t 3:00\t0\t-\nRule\tFrance\t1976\tonly\t-\tMar\t28\t 1:00\t1:00\tS\nRule\tFrance\t1976\tonly\t-\tSep\t26\t 1:00\t0\t-\nZone\tEurope/Paris\t0:09:21 -\tLMT\t1891 Mar 15  0:01\n\t\t\t0:09:21\t-\tPMT\t1911 Mar 11  0:01  # Paris MT\n\t\t\t0:00\tFrance\tWE%sT\t1940 Jun 14 23:00\n\t\t\t1:00\tC-Eur\tCE%sT\t1944 Aug 25\n\t\t\t0:00\tFrance\tWE%sT\t1945 Sep 16  3:00\n\t\t\t1:00\tFrance\tCE%sT\t1977\n\t\t\t1:00\tEU\tCE%sT\nRule\tGermany\t1946\tonly\t-\tApr\t14\t2:00s\t1:00\tS\nRule\tGermany\t1946\tonly\t-\tOct\t 7\t2:00s\t0\t-\nRule\tGermany\t1947\t1949\t-\tOct\tSun>=1\t2:00s\t0\t-\nRule\tGermany\t1947\tonly\t-\tApr\t 6\t3:00s\t1:00\tS\nRule\tGermany\t1947\tonly\t-\tMay\t11\t2:00s\t2:00\tM\nRule\tGermany\t1947\tonly\t-\tJun\t29\t3:00\t1:00\tS\nRule\tGermany\t1948\tonly\t-\tApr\t18\t2:00s\t1:00\tS\nRule\tGermany\t1949\tonly\t-\tApr\t10\t2:00s\t1:00\tS\nRule SovietZone\t1945\tonly\t-\tMay\t24\t2:00\t2:00\tM # Midsummer\nRule SovietZone\t1945\tonly\t-\tSep\t24\t3:00\t1:00\tS\nRule SovietZone\t1945\tonly\t-\tNov\t18\t2:00s\t0\t-\nZone\tEurope/Berlin\t0:53:28 -\tLMT\t1893 Apr\n\t\t\t1:00\tC-Eur\tCE%sT\t1945 May 24 2:00\n\t\t\t1:00 SovietZone\tCE%sT\t1946\n\t\t\t1:00\tGermany\tCE%sT\t1980\n\t\t\t1:00\tEU\tCE%sT\nZone Europe/Gibraltar\t-0:21:24 -\tLMT\t1880 Aug  2 0:00s\n\t\t\t0:00\tGB-Eire\t%s\t1957 Apr 14 2:00\n\t\t\t1:00\t-\tCET\t1982\n\t\t\t1:00\tEU\tCE%sT\nRule\tGreece\t1932\tonly\t-\tJul\t 7\t0:00\t1:00\tS\nRule\tGreece\t1932\tonly\t-\tSep\t 1\t0:00\t0\t-\nRule\tGreece\t1941\tonly\t-\tApr\t 7\t0:00\t1:00\tS\nRule\tGreece\t1942\tonly\t-\tNov\t 2\t3:00\t0\t-\nRule\tGreece\t1943\tonly\t-\tMar\t30\t0:00\t1:00\tS\nRule\tGreece\t1943\tonly\t-\tOct\t 4\t0:00\t0\t-\nRule\tGreece\t1952\tonly\t-\tJul\t 1\t0:00\t1:00\tS\nRule\tGreece\t1952\tonly\t-\tNov\t 2\t0:00\t0\t-\nRule\tGreece\t1975\tonly\t-\tApr\t12\t0:00s\t1:00\tS\nRule\tGreece\t1975\tonly\t-\tNov\t26\t0:00s\t0\t-\nRule\tGreece\t1976\tonly\t-\tApr\t11\t2:00s\t1:00\tS\nRule\tGreece\t1976\tonly\t-\tOct\t10\t2:00s\t0\t-\nRule\tGreece\t1977\t1978\t-\tApr\tSun>=1\t2:00s\t1:00\tS\nRule\tGreece\t1977\tonly\t-\tSep\t26\t2:00s\t0\t-\nRule\tGreece\t1978\tonly\t-\tSep\t24\t4:00\t0\t-\nRule\tGreece\t1979\tonly\t-\tApr\t 1\t9:00\t1:00\tS\nRule\tGreece\t1979\tonly\t-\tSep\t29\t2:00\t0\t-\nRule\tGreece\t1980\tonly\t-\tApr\t 1\t0:00\t1:00\tS\nRule\tGreece\t1980\tonly\t-\tSep\t28\t0:00\t0\t-\nZone\tEurope/Athens\t1:34:52 -\tLMT\t1895 Sep 14\n\t\t\t1:34:52\t-\tAMT\t1916 Jul 28 0:01     # Athens MT\n\t\t\t2:00\tGreece\tEE%sT\t1941 Apr 30\n\t\t\t1:00\tGreece\tCE%sT\t1944 Apr  4\n\t\t\t2:00\tGreece\tEE%sT\t1981\n\t\t\t# Shanks & Pottenger say it switched to C-Eur in 1981;\n\t\t\t# go with EU instead, since Greece joined it on Jan 1.\n\t\t\t2:00\tEU\tEE%sT\nRule\tHungary\t1918\tonly\t-\tApr\t 1\t 3:00\t1:00\tS\nRule\tHungary\t1918\tonly\t-\tSep\t29\t 3:00\t0\t-\nRule\tHungary\t1919\tonly\t-\tApr\t15\t 3:00\t1:00\tS\nRule\tHungary\t1919\tonly\t-\tSep\t15\t 3:00\t0\t-\nRule\tHungary\t1920\tonly\t-\tApr\t 5\t 3:00\t1:00\tS\nRule\tHungary\t1920\tonly\t-\tSep\t30\t 3:00\t0\t-\nRule\tHungary\t1945\tonly\t-\tMay\t 1\t23:00\t1:00\tS\nRule\tHungary\t1945\tonly\t-\tNov\t 3\t 0:00\t0\t-\nRule\tHungary\t1946\tonly\t-\tMar\t31\t 2:00s\t1:00\tS\nRule\tHungary\t1946\t1949\t-\tOct\tSun>=1\t 2:00s\t0\t-\nRule\tHungary\t1947\t1949\t-\tApr\tSun>=4\t 2:00s\t1:00\tS\nRule\tHungary\t1950\tonly\t-\tApr\t17\t 2:00s\t1:00\tS\nRule\tHungary\t1950\tonly\t-\tOct\t23\t 2:00s\t0\t-\nRule\tHungary\t1954\t1955\t-\tMay\t23\t 0:00\t1:00\tS\nRule\tHungary\t1954\t1955\t-\tOct\t 3\t 0:00\t0\t-\nRule\tHungary\t1956\tonly\t-\tJun\tSun>=1\t 0:00\t1:00\tS\nRule\tHungary\t1956\tonly\t-\tSep\tlastSun\t 0:00\t0\t-\nRule\tHungary\t1957\tonly\t-\tJun\tSun>=1\t 1:00\t1:00\tS\nRule\tHungary\t1957\tonly\t-\tSep\tlastSun\t 3:00\t0\t-\nRule\tHungary\t1980\tonly\t-\tApr\t 6\t 1:00\t1:00\tS\nZone\tEurope/Budapest\t1:16:20 -\tLMT\t1890 Oct\n\t\t\t1:00\tC-Eur\tCE%sT\t1918\n\t\t\t1:00\tHungary\tCE%sT\t1941 Apr  6  2:00\n\t\t\t1:00\tC-Eur\tCE%sT\t1945\n\t\t\t1:00\tHungary\tCE%sT\t1980 Sep 28  2:00s\n\t\t\t1:00\tEU\tCE%sT\nRule\tIceland\t1917\t1918\t-\tFeb\t19\t23:00\t1:00\tS\nRule\tIceland\t1917\tonly\t-\tOct\t21\t 1:00\t0\t-\nRule\tIceland\t1918\tonly\t-\tNov\t16\t 1:00\t0\t-\nRule\tIceland\t1939\tonly\t-\tApr\t29\t23:00\t1:00\tS\nRule\tIceland\t1939\tonly\t-\tNov\t29\t 2:00\t0\t-\nRule\tIceland\t1940\tonly\t-\tFeb\t25\t 2:00\t1:00\tS\nRule\tIceland\t1940\tonly\t-\tNov\t 3\t 2:00\t0\t-\nRule\tIceland\t1941\tonly\t-\tMar\t 2\t 1:00s\t1:00\tS\nRule\tIceland\t1941\tonly\t-\tNov\t 2\t 1:00s\t0\t-\nRule\tIceland\t1942\tonly\t-\tMar\t 8\t 1:00s\t1:00\tS\nRule\tIceland\t1942\tonly\t-\tOct\t25\t 1:00s\t0\t-\nRule\tIceland\t1943\t1946\t-\tMar\tSun>=1\t 1:00s\t1:00\tS\nRule\tIceland\t1943\t1948\t-\tOct\tSun>=22\t 1:00s\t0\t-\nRule\tIceland\t1947\t1967\t-\tApr\tSun>=1\t 1:00s\t1:00\tS\nRule\tIceland\t1949\tonly\t-\tOct\t30\t 1:00s\t0\t-\nRule\tIceland\t1950\t1966\t-\tOct\tSun>=22\t 1:00s\t0\t-\nRule\tIceland\t1967\tonly\t-\tOct\t29\t 1:00s\t0\t-\nZone Atlantic/Reykjavik\t-1:27:24 -\tLMT\t1837\n\t\t\t-1:27:48 -\tRMT\t1908 # Reykjavik Mean Time?\n\t\t\t-1:00\tIceland\tIS%sT\t1968 Apr 7 1:00s\n\t\t\t 0:00\t-\tGMT\nRule\tItaly\t1916\tonly\t-\tJun\t 3\t0:00s\t1:00\tS\nRule\tItaly\t1916\tonly\t-\tOct\t 1\t0:00s\t0\t-\nRule\tItaly\t1917\tonly\t-\tApr\t 1\t0:00s\t1:00\tS\nRule\tItaly\t1917\tonly\t-\tSep\t30\t0:00s\t0\t-\nRule\tItaly\t1918\tonly\t-\tMar\t10\t0:00s\t1:00\tS\nRule\tItaly\t1918\t1919\t-\tOct\tSun>=1\t0:00s\t0\t-\nRule\tItaly\t1919\tonly\t-\tMar\t 2\t0:00s\t1:00\tS\nRule\tItaly\t1920\tonly\t-\tMar\t21\t0:00s\t1:00\tS\nRule\tItaly\t1920\tonly\t-\tSep\t19\t0:00s\t0\t-\nRule\tItaly\t1940\tonly\t-\tJun\t15\t0:00s\t1:00\tS\nRule\tItaly\t1944\tonly\t-\tSep\t17\t0:00s\t0\t-\nRule\tItaly\t1945\tonly\t-\tApr\t 2\t2:00\t1:00\tS\nRule\tItaly\t1945\tonly\t-\tSep\t15\t0:00s\t0\t-\nRule\tItaly\t1946\tonly\t-\tMar\t17\t2:00s\t1:00\tS\nRule\tItaly\t1946\tonly\t-\tOct\t 6\t2:00s\t0\t-\nRule\tItaly\t1947\tonly\t-\tMar\t16\t0:00s\t1:00\tS\nRule\tItaly\t1947\tonly\t-\tOct\t 5\t0:00s\t0\t-\nRule\tItaly\t1948\tonly\t-\tFeb\t29\t2:00s\t1:00\tS\nRule\tItaly\t1948\tonly\t-\tOct\t 3\t2:00s\t0\t-\nRule\tItaly\t1966\t1968\t-\tMay\tSun>=22\t0:00\t1:00\tS\nRule\tItaly\t1966\t1969\t-\tSep\tSun>=22\t0:00\t0\t-\nRule\tItaly\t1969\tonly\t-\tJun\t 1\t0:00\t1:00\tS\nRule\tItaly\t1970\tonly\t-\tMay\t31\t0:00\t1:00\tS\nRule\tItaly\t1970\tonly\t-\tSep\tlastSun\t0:00\t0\t-\nRule\tItaly\t1971\t1972\t-\tMay\tSun>=22\t0:00\t1:00\tS\nRule\tItaly\t1971\tonly\t-\tSep\tlastSun\t1:00\t0\t-\nRule\tItaly\t1972\tonly\t-\tOct\t 1\t0:00\t0\t-\nRule\tItaly\t1973\tonly\t-\tJun\t 3\t0:00\t1:00\tS\nRule\tItaly\t1973\t1974\t-\tSep\tlastSun\t0:00\t0\t-\nRule\tItaly\t1974\tonly\t-\tMay\t26\t0:00\t1:00\tS\nRule\tItaly\t1975\tonly\t-\tJun\t 1\t0:00s\t1:00\tS\nRule\tItaly\t1975\t1977\t-\tSep\tlastSun\t0:00s\t0\t-\nRule\tItaly\t1976\tonly\t-\tMay\t30\t0:00s\t1:00\tS\nRule\tItaly\t1977\t1979\t-\tMay\tSun>=22\t0:00s\t1:00\tS\nRule\tItaly\t1978\tonly\t-\tOct\t 1\t0:00s\t0\t-\nRule\tItaly\t1979\tonly\t-\tSep\t30\t0:00s\t0\t-\nZone\tEurope/Rome\t0:49:56 -\tLMT\t1866 Sep 22\n\t\t\t0:49:56\t-\tRMT\t1893 Nov  1 0:00s # Rome Mean\n\t\t\t1:00\tItaly\tCE%sT\t1942 Nov  2 2:00s\n\t\t\t1:00\tC-Eur\tCE%sT\t1944 Jul\n\t\t\t1:00\tItaly\tCE%sT\t1980\n\t\t\t1:00\tEU\tCE%sT\nLink\tEurope/Rome\tEurope/Vatican\nLink\tEurope/Rome\tEurope/San_Marino\nRule\tLatvia\t1989\t1996\t-\tMar\tlastSun\t 2:00s\t1:00\tS\nRule\tLatvia\t1989\t1996\t-\tSep\tlastSun\t 2:00s\t0\t-\nZone\tEurope/Riga\t1:36:24\t-\tLMT\t1880\n\t\t\t1:36:24\t-\tRMT\t1918 Apr 15 2:00 #Riga Mean Time\n\t\t\t1:36:24\t1:00\tLST\t1918 Sep 16 3:00 #Latvian Summer\n\t\t\t1:36:24\t-\tRMT\t1919 Apr  1 2:00\n\t\t\t1:36:24\t1:00\tLST\t1919 May 22 3:00\n\t\t\t1:36:24\t-\tRMT\t1926 May 11\n\t\t\t2:00\t-\tEET\t1940 Aug  5\n\t\t\t3:00\t-\tMSK\t1941 Jul\n\t\t\t1:00\tC-Eur\tCE%sT\t1944 Oct 13\n\t\t\t3:00\tRussia\tMSK/MSD\t1989 Mar lastSun 2:00s\n\t\t\t2:00\t1:00\tEEST\t1989 Sep lastSun 2:00s\n\t\t\t2:00\tLatvia\tEE%sT\t1997 Jan 21\n\t\t\t2:00\tEU\tEE%sT\t2000 Feb 29\n\t\t\t2:00\t-\tEET\t2001 Jan  2\n\t\t\t2:00\tEU\tEE%sT\nZone\tEurope/Vaduz\t0:38:04 -\tLMT\t1894 Jun\n\t\t\t1:00\t-\tCET\t1981\n\t\t\t1:00\tEU\tCE%sT\nZone\tEurope/Vilnius\t1:41:16\t-\tLMT\t1880\n\t\t\t1:24:00\t-\tWMT\t1917\t    # Warsaw Mean Time\n\t\t\t1:35:36\t-\tKMT\t1919 Oct 10 # Kaunas Mean Time\n\t\t\t1:00\t-\tCET\t1920 Jul 12\n\t\t\t2:00\t-\tEET\t1920 Oct  9\n\t\t\t1:00\t-\tCET\t1940 Aug  3\n\t\t\t3:00\t-\tMSK\t1941 Jun 24\n\t\t\t1:00\tC-Eur\tCE%sT\t1944 Aug\n\t\t\t3:00\tRussia\tMSK/MSD\t1991 Mar 31 2:00s\n\t\t\t2:00\t1:00\tEEST\t1991 Sep 29 2:00s\n\t\t\t2:00\tC-Eur\tEE%sT\t1998\n\t\t\t2:00\t-\tEET\t1998 Mar 29 1:00u\n\t\t\t1:00\tEU\tCE%sT\t1999 Oct 31 1:00u\n\t\t\t2:00\t-\tEET\t2003 Jan  1\n\t\t\t2:00\tEU\tEE%sT\nRule\tLux\t1916\tonly\t-\tMay\t14\t23:00\t1:00\tS\nRule\tLux\t1916\tonly\t-\tOct\t 1\t 1:00\t0\t-\nRule\tLux\t1917\tonly\t-\tApr\t28\t23:00\t1:00\tS\nRule\tLux\t1917\tonly\t-\tSep\t17\t 1:00\t0\t-\nRule\tLux\t1918\tonly\t-\tApr\tMon>=15\t 2:00s\t1:00\tS\nRule\tLux\t1918\tonly\t-\tSep\tMon>=15\t 2:00s\t0\t-\nRule\tLux\t1919\tonly\t-\tMar\t 1\t23:00\t1:00\tS\nRule\tLux\t1919\tonly\t-\tOct\t 5\t 3:00\t0\t-\nRule\tLux\t1920\tonly\t-\tFeb\t14\t23:00\t1:00\tS\nRule\tLux\t1920\tonly\t-\tOct\t24\t 2:00\t0\t-\nRule\tLux\t1921\tonly\t-\tMar\t14\t23:00\t1:00\tS\nRule\tLux\t1921\tonly\t-\tOct\t26\t 2:00\t0\t-\nRule\tLux\t1922\tonly\t-\tMar\t25\t23:00\t1:00\tS\nRule\tLux\t1922\tonly\t-\tOct\tSun>=2\t 1:00\t0\t-\nRule\tLux\t1923\tonly\t-\tApr\t21\t23:00\t1:00\tS\nRule\tLux\t1923\tonly\t-\tOct\tSun>=2\t 2:00\t0\t-\nRule\tLux\t1924\tonly\t-\tMar\t29\t23:00\t1:00\tS\nRule\tLux\t1924\t1928\t-\tOct\tSun>=2\t 1:00\t0\t-\nRule\tLux\t1925\tonly\t-\tApr\t 5\t23:00\t1:00\tS\nRule\tLux\t1926\tonly\t-\tApr\t17\t23:00\t1:00\tS\nRule\tLux\t1927\tonly\t-\tApr\t 9\t23:00\t1:00\tS\nRule\tLux\t1928\tonly\t-\tApr\t14\t23:00\t1:00\tS\nRule\tLux\t1929\tonly\t-\tApr\t20\t23:00\t1:00\tS\nZone Europe/Luxembourg\t0:24:36 -\tLMT\t1904 Jun\n\t\t\t1:00\tLux\tCE%sT\t1918 Nov 25\n\t\t\t0:00\tLux\tWE%sT\t1929 Oct  6 2:00s\n\t\t\t0:00\tBelgium\tWE%sT\t1940 May 14 3:00\n\t\t\t1:00\tC-Eur\tWE%sT\t1944 Sep 18 3:00\n\t\t\t1:00\tBelgium\tCE%sT\t1977\n\t\t\t1:00\tEU\tCE%sT\nRule\tMalta\t1973\tonly\t-\tMar\t31\t0:00s\t1:00\tS\nRule\tMalta\t1973\tonly\t-\tSep\t29\t0:00s\t0\t-\nRule\tMalta\t1974\tonly\t-\tApr\t21\t0:00s\t1:00\tS\nRule\tMalta\t1974\tonly\t-\tSep\t16\t0:00s\t0\t-\nRule\tMalta\t1975\t1979\t-\tApr\tSun>=15\t2:00\t1:00\tS\nRule\tMalta\t1975\t1980\t-\tSep\tSun>=15\t2:00\t0\t-\nRule\tMalta\t1980\tonly\t-\tMar\t31\t2:00\t1:00\tS\nZone\tEurope/Malta\t0:58:04 -\tLMT\t1893 Nov  2 0:00s # Valletta\n\t\t\t1:00\tItaly\tCE%sT\t1942 Nov  2 2:00s\n\t\t\t1:00\tC-Eur\tCE%sT\t1945 Apr  2 2:00s\n\t\t\t1:00\tItaly\tCE%sT\t1973 Mar 31\n\t\t\t1:00\tMalta\tCE%sT\t1981\n\t\t\t1:00\tEU\tCE%sT\nZone\tEurope/Chisinau\t1:55:20 -\tLMT\t1880\n\t\t\t1:55\t-\tCMT\t1918 Feb 15 # Chisinau MT\n\t\t\t1:44:24\t-\tBMT\t1931 Jul 24 # Bucharest MT\n\t\t\t2:00\tRomania\tEE%sT\t1940 Aug 15\n\t\t\t2:00\t1:00\tEEST\t1941 Jul 17\n\t\t\t1:00\tC-Eur\tCE%sT\t1944 Aug 24\n\t\t\t3:00\tRussia\tMSK/MSD\t1990\n\t\t\t3:00\t-\tMSK\t1990 May 6\n\t\t\t2:00\t-\tEET\t1991\n\t\t\t2:00\tRussia\tEE%sT\t1992\n\t\t\t2:00\tE-Eur\tEE%sT\t1997\n\t\t\t2:00\tEU\tEE%sT\nZone\tEurope/Monaco\t0:29:32 -\tLMT\t1891 Mar 15\n\t\t\t0:09:21\t-\tPMT\t1911 Mar 11    # Paris Mean Time\n\t\t\t0:00\tFrance\tWE%sT\t1945 Sep 16 3:00\n\t\t\t1:00\tFrance\tCE%sT\t1977\n\t\t\t1:00\tEU\tCE%sT\nRule\tNeth\t1916\tonly\t-\tMay\t 1\t0:00\t1:00\tNST\t# Netherlands Summer Time\nRule\tNeth\t1916\tonly\t-\tOct\t 1\t0:00\t0\tAMT\t# Amsterdam Mean Time\nRule\tNeth\t1917\tonly\t-\tApr\t16\t2:00s\t1:00\tNST\nRule\tNeth\t1917\tonly\t-\tSep\t17\t2:00s\t0\tAMT\nRule\tNeth\t1918\t1921\t-\tApr\tMon>=1\t2:00s\t1:00\tNST\nRule\tNeth\t1918\t1921\t-\tSep\tlastMon\t2:00s\t0\tAMT\nRule\tNeth\t1922\tonly\t-\tMar\tlastSun\t2:00s\t1:00\tNST\nRule\tNeth\t1922\t1936\t-\tOct\tSun>=2\t2:00s\t0\tAMT\nRule\tNeth\t1923\tonly\t-\tJun\tFri>=1\t2:00s\t1:00\tNST\nRule\tNeth\t1924\tonly\t-\tMar\tlastSun\t2:00s\t1:00\tNST\nRule\tNeth\t1925\tonly\t-\tJun\tFri>=1\t2:00s\t1:00\tNST\nRule\tNeth\t1926\t1931\t-\tMay\t15\t2:00s\t1:00\tNST\nRule\tNeth\t1932\tonly\t-\tMay\t22\t2:00s\t1:00\tNST\nRule\tNeth\t1933\t1936\t-\tMay\t15\t2:00s\t1:00\tNST\nRule\tNeth\t1937\tonly\t-\tMay\t22\t2:00s\t1:00\tNST\nRule\tNeth\t1937\tonly\t-\tJul\t 1\t0:00\t1:00\tS\nRule\tNeth\t1937\t1939\t-\tOct\tSun>=2\t2:00s\t0\t-\nRule\tNeth\t1938\t1939\t-\tMay\t15\t2:00s\t1:00\tS\nRule\tNeth\t1945\tonly\t-\tApr\t 2\t2:00s\t1:00\tS\nRule\tNeth\t1945\tonly\t-\tSep\t16\t2:00s\t0\t-\nZone Europe/Amsterdam\t0:19:32 -\tLMT\t1835\n\t\t\t0:19:32\tNeth\t%s\t1937 Jul  1\n\t\t\t0:20\tNeth\tNE%sT\t1940 May 16 0:00 # Dutch Time\n\t\t\t1:00\tC-Eur\tCE%sT\t1945 Apr  2 2:00\n\t\t\t1:00\tNeth\tCE%sT\t1977\n\t\t\t1:00\tEU\tCE%sT\nRule\tNorway\t1916\tonly\t-\tMay\t22\t1:00\t1:00\tS\nRule\tNorway\t1916\tonly\t-\tSep\t30\t0:00\t0\t-\nRule\tNorway\t1945\tonly\t-\tApr\t 2\t2:00s\t1:00\tS\nRule\tNorway\t1945\tonly\t-\tOct\t 1\t2:00s\t0\t-\nRule\tNorway\t1959\t1964\t-\tMar\tSun>=15\t2:00s\t1:00\tS\nRule\tNorway\t1959\t1965\t-\tSep\tSun>=15\t2:00s\t0\t-\nRule\tNorway\t1965\tonly\t-\tApr\t25\t2:00s\t1:00\tS\nZone\tEurope/Oslo\t0:43:00 -\tLMT\t1895 Jan  1\n\t\t\t1:00\tNorway\tCE%sT\t1940 Aug 10 23:00\n\t\t\t1:00\tC-Eur\tCE%sT\t1945 Apr  2  2:00\n\t\t\t1:00\tNorway\tCE%sT\t1980\n\t\t\t1:00\tEU\tCE%sT\nLink\tEurope/Oslo\tArctic/Longyearbyen\nRule\tPoland\t1918\t1919\t-\tSep\t16\t2:00s\t0\t-\nRule\tPoland\t1919\tonly\t-\tApr\t15\t2:00s\t1:00\tS\nRule\tPoland\t1944\tonly\t-\tApr\t 3\t2:00s\t1:00\tS\nRule\tPoland\t1944\tonly\t-\tOct\t 4\t2:00\t0\t-\nRule\tPoland\t1945\tonly\t-\tApr\t29\t0:00\t1:00\tS\nRule\tPoland\t1945\tonly\t-\tNov\t 1\t0:00\t0\t-\nRule\tPoland\t1946\tonly\t-\tApr\t14\t0:00s\t1:00\tS\nRule\tPoland\t1946\tonly\t-\tOct\t 7\t2:00s\t0\t-\nRule\tPoland\t1947\tonly\t-\tMay\t 4\t2:00s\t1:00\tS\nRule\tPoland\t1947\t1949\t-\tOct\tSun>=1\t2:00s\t0\t-\nRule\tPoland\t1948\tonly\t-\tApr\t18\t2:00s\t1:00\tS\nRule\tPoland\t1949\tonly\t-\tApr\t10\t2:00s\t1:00\tS\nRule\tPoland\t1957\tonly\t-\tJun\t 2\t1:00s\t1:00\tS\nRule\tPoland\t1957\t1958\t-\tSep\tlastSun\t1:00s\t0\t-\nRule\tPoland\t1958\tonly\t-\tMar\t30\t1:00s\t1:00\tS\nRule\tPoland\t1959\tonly\t-\tMay\t31\t1:00s\t1:00\tS\nRule\tPoland\t1959\t1961\t-\tOct\tSun>=1\t1:00s\t0\t-\nRule\tPoland\t1960\tonly\t-\tApr\t 3\t1:00s\t1:00\tS\nRule\tPoland\t1961\t1964\t-\tMay\tlastSun\t1:00s\t1:00\tS\nRule\tPoland\t1962\t1964\t-\tSep\tlastSun\t1:00s\t0\t-\nZone\tEurope/Warsaw\t1:24:00 -\tLMT\t1880\n\t\t\t1:24:00\t-\tWMT\t1915 Aug  5   # Warsaw Mean Time\n\t\t\t1:00\tC-Eur\tCE%sT\t1918 Sep 16 3:00\n\t\t\t2:00\tPoland\tEE%sT\t1922 Jun\n\t\t\t1:00\tPoland\tCE%sT\t1940 Jun 23 2:00\n\t\t\t1:00\tC-Eur\tCE%sT\t1944 Oct\n\t\t\t1:00\tPoland\tCE%sT\t1977\n\t\t\t1:00\tW-Eur\tCE%sT\t1988\n\t\t\t1:00\tEU\tCE%sT\nRule\tPort\t1916\tonly\t-\tJun\t17\t23:00\t1:00\tS\nRule\tPort\t1916\tonly\t-\tNov\t 1\t 1:00\t0\t-\nRule\tPort\t1917\tonly\t-\tFeb\t28\t23:00s\t1:00\tS\nRule\tPort\t1917\t1921\t-\tOct\t14\t23:00s\t0\t-\nRule\tPort\t1918\tonly\t-\tMar\t 1\t23:00s\t1:00\tS\nRule\tPort\t1919\tonly\t-\tFeb\t28\t23:00s\t1:00\tS\nRule\tPort\t1920\tonly\t-\tFeb\t29\t23:00s\t1:00\tS\nRule\tPort\t1921\tonly\t-\tFeb\t28\t23:00s\t1:00\tS\nRule\tPort\t1924\tonly\t-\tApr\t16\t23:00s\t1:00\tS\nRule\tPort\t1924\tonly\t-\tOct\t14\t23:00s\t0\t-\nRule\tPort\t1926\tonly\t-\tApr\t17\t23:00s\t1:00\tS\nRule\tPort\t1926\t1929\t-\tOct\tSat>=1\t23:00s\t0\t-\nRule\tPort\t1927\tonly\t-\tApr\t 9\t23:00s\t1:00\tS\nRule\tPort\t1928\tonly\t-\tApr\t14\t23:00s\t1:00\tS\nRule\tPort\t1929\tonly\t-\tApr\t20\t23:00s\t1:00\tS\nRule\tPort\t1931\tonly\t-\tApr\t18\t23:00s\t1:00\tS\nRule\tPort\t1931\t1932\t-\tOct\tSat>=1\t23:00s\t0\t-\nRule\tPort\t1932\tonly\t-\tApr\t 2\t23:00s\t1:00\tS\nRule\tPort\t1934\tonly\t-\tApr\t 7\t23:00s\t1:00\tS\nRule\tPort\t1934\t1938\t-\tOct\tSat>=1\t23:00s\t0\t-\nRule\tPort\t1935\tonly\t-\tMar\t30\t23:00s\t1:00\tS\nRule\tPort\t1936\tonly\t-\tApr\t18\t23:00s\t1:00\tS\nRule\tPort\t1937\tonly\t-\tApr\t 3\t23:00s\t1:00\tS\nRule\tPort\t1938\tonly\t-\tMar\t26\t23:00s\t1:00\tS\nRule\tPort\t1939\tonly\t-\tApr\t15\t23:00s\t1:00\tS\nRule\tPort\t1939\tonly\t-\tNov\t18\t23:00s\t0\t-\nRule\tPort\t1940\tonly\t-\tFeb\t24\t23:00s\t1:00\tS\nRule\tPort\t1940\t1941\t-\tOct\t 5\t23:00s\t0\t-\nRule\tPort\t1941\tonly\t-\tApr\t 5\t23:00s\t1:00\tS\nRule\tPort\t1942\t1945\t-\tMar\tSat>=8\t23:00s\t1:00\tS\nRule\tPort\t1942\tonly\t-\tApr\t25\t22:00s\t2:00\tM # Midsummer\nRule\tPort\t1942\tonly\t-\tAug\t15\t22:00s\t1:00\tS\nRule\tPort\t1942\t1945\t-\tOct\tSat>=24\t23:00s\t0\t-\nRule\tPort\t1943\tonly\t-\tApr\t17\t22:00s\t2:00\tM\nRule\tPort\t1943\t1945\t-\tAug\tSat>=25\t22:00s\t1:00\tS\nRule\tPort\t1944\t1945\t-\tApr\tSat>=21\t22:00s\t2:00\tM\nRule\tPort\t1946\tonly\t-\tApr\tSat>=1\t23:00s\t1:00\tS\nRule\tPort\t1946\tonly\t-\tOct\tSat>=1\t23:00s\t0\t-\nRule\tPort\t1947\t1949\t-\tApr\tSun>=1\t 2:00s\t1:00\tS\nRule\tPort\t1947\t1949\t-\tOct\tSun>=1\t 2:00s\t0\t-\nRule\tPort\t1951\t1965\t-\tApr\tSun>=1\t 2:00s\t1:00\tS\nRule\tPort\t1951\t1965\t-\tOct\tSun>=1\t 2:00s\t0\t-\nRule\tPort\t1977\tonly\t-\tMar\t27\t 0:00s\t1:00\tS\nRule\tPort\t1977\tonly\t-\tSep\t25\t 0:00s\t0\t-\nRule\tPort\t1978\t1979\t-\tApr\tSun>=1\t 0:00s\t1:00\tS\nRule\tPort\t1978\tonly\t-\tOct\t 1\t 0:00s\t0\t-\nRule\tPort\t1979\t1982\t-\tSep\tlastSun\t 1:00s\t0\t-\nRule\tPort\t1980\tonly\t-\tMar\tlastSun\t 0:00s\t1:00\tS\nRule\tPort\t1981\t1982\t-\tMar\tlastSun\t 1:00s\t1:00\tS\nRule\tPort\t1983\tonly\t-\tMar\tlastSun\t 2:00s\t1:00\tS\nZone\tEurope/Lisbon\t-0:36:32 -\tLMT\t1884\n\t\t\t-0:36:32 -\tLMT\t1912 Jan  1  # Lisbon Mean Time\n\t\t\t 0:00\tPort\tWE%sT\t1966 Apr  3 2:00\n\t\t\t 1:00\t-\tCET\t1976 Sep 26 1:00\n\t\t\t 0:00\tPort\tWE%sT\t1983 Sep 25 1:00s\n\t\t\t 0:00\tW-Eur\tWE%sT\t1992 Sep 27 1:00s\n\t\t\t 1:00\tEU\tCE%sT\t1996 Mar 31 1:00u\n\t\t\t 0:00\tEU\tWE%sT\nZone Atlantic/Azores\t-1:42:40 -\tLMT\t1884\t\t# Ponta Delgada\n\t\t\t-1:54:32 -\tHMT\t1911 May 24  # Horta Mean Time\n\t\t\t-2:00\tPort\tAZO%sT\t1966 Apr  3 2:00 # Azores Time\n\t\t\t-1:00\tPort\tAZO%sT\t1983 Sep 25 1:00s\n\t\t\t-1:00\tW-Eur\tAZO%sT\t1992 Sep 27 1:00s\n\t\t\t 0:00\tEU\tWE%sT\t1993 Mar 28 1:00u\n\t\t\t-1:00\tEU\tAZO%sT\nZone Atlantic/Madeira\t-1:07:36 -\tLMT\t1884\t\t# Funchal\n\t\t\t-1:07:36 -\tFMT\t1911 May 24  # Funchal Mean Time\n\t\t\t-1:00\tPort\tMAD%sT\t1966 Apr  3 2:00 # Madeira Time\n\t\t\t 0:00\tPort\tWE%sT\t1983 Sep 25 1:00s\n\t\t\t 0:00\tEU\tWE%sT\nRule\tRomania\t1932\tonly\t-\tMay\t21\t 0:00s\t1:00\tS\nRule\tRomania\t1932\t1939\t-\tOct\tSun>=1\t 0:00s\t0\t-\nRule\tRomania\t1933\t1939\t-\tApr\tSun>=2\t 0:00s\t1:00\tS\nRule\tRomania\t1979\tonly\t-\tMay\t27\t 0:00\t1:00\tS\nRule\tRomania\t1979\tonly\t-\tSep\tlastSun\t 0:00\t0\t-\nRule\tRomania\t1980\tonly\t-\tApr\t 5\t23:00\t1:00\tS\nRule\tRomania\t1980\tonly\t-\tSep\tlastSun\t 1:00\t0\t-\nRule\tRomania\t1991\t1993\t-\tMar\tlastSun\t 0:00s\t1:00\tS\nRule\tRomania\t1991\t1993\t-\tSep\tlastSun\t 0:00s\t0\t-\nZone Europe/Bucharest\t1:44:24 -\tLMT\t1891 Oct\n\t\t\t1:44:24\t-\tBMT\t1931 Jul 24\t# Bucharest MT\n\t\t\t2:00\tRomania\tEE%sT\t1981 Mar 29 2:00s\n\t\t\t2:00\tC-Eur\tEE%sT\t1991\n\t\t\t2:00\tRomania\tEE%sT\t1994\n\t\t\t2:00\tE-Eur\tEE%sT\t1997\n\t\t\t2:00\tEU\tEE%sT\nZone Europe/Kaliningrad\t 1:22:00 -\tLMT\t1893 Apr\n\t\t\t 1:00\tC-Eur\tCE%sT\t1945\n\t\t\t 2:00\tPoland\tCE%sT\t1946\n\t\t\t 3:00\tRussia\tMSK/MSD\t1991 Mar 31 2:00s\n\t\t\t 2:00\tRussia\tEE%sT\t2011 Mar 27 2:00s\n\t\t\t 3:00\t-\tFET # Further-eastern European Time\nZone Europe/Moscow\t 2:30:20 -\tLMT\t1880\n\t\t\t 2:30\t-\tMMT\t1916 Jul  3 # Moscow Mean Time\n\t\t\t 2:30:48 Russia\t%s\t1919 Jul  1 2:00\n\t\t\t 3:00\tRussia\tMSK/MSD\t1922 Oct\n\t\t\t 2:00\t-\tEET\t1930 Jun 21\n\t\t\t 3:00\tRussia\tMSK/MSD\t1991 Mar 31 2:00s\n\t\t\t 2:00\tRussia\tEE%sT\t1992 Jan 19 2:00s\n\t\t\t 3:00\tRussia\tMSK/MSD\t2011 Mar 27 2:00s\n\t\t\t 4:00\t-\tMSK\nZone Europe/Volgograd\t 2:57:40 -\tLMT\t1920 Jan  3\n\t\t\t 3:00\t-\tTSAT\t1925 Apr  6 # Tsaritsyn Time\n\t\t\t 3:00\t-\tSTAT\t1930 Jun 21 # Stalingrad Time\n\t\t\t 4:00\t-\tSTAT\t1961 Nov 11\n\t\t\t 4:00\tRussia\tVOL%sT\t1989 Mar 26 2:00s # Volgograd T\n\t\t\t 3:00\tRussia\tVOL%sT\t1991 Mar 31 2:00s\n\t\t\t 4:00\t-\tVOLT\t1992 Mar 29 2:00s\n\t\t\t 3:00\tRussia\tVOL%sT\t2011 Mar 27 2:00s\n\t\t\t 4:00\t-\tVOLT\nZone Europe/Samara\t 3:20:36 -\tLMT\t1919 Jul  1 2:00\n\t\t\t 3:00\t-\tSAMT\t1930 Jun 21\n\t\t\t 4:00\t-\tSAMT\t1935 Jan 27\n\t\t\t 4:00\tRussia\tKUY%sT\t1989 Mar 26 2:00s # Kuybyshev\n\t\t\t 3:00\tRussia\tKUY%sT\t1991 Mar 31 2:00s\n\t\t\t 2:00\tRussia\tKUY%sT\t1991 Sep 29 2:00s\n\t\t\t 3:00\t-\tKUYT\t1991 Oct 20 3:00\n\t\t\t 4:00\tRussia\tSAM%sT\t2010 Mar 28 2:00s # Samara Time\n\t\t\t 3:00\tRussia\tSAM%sT\t2011 Mar 27 2:00s\n\t\t\t 4:00\t-\tSAMT\nZone Asia/Yekaterinburg\t 4:02:24 -\tLMT\t1919 Jul 15 4:00\n\t\t\t 4:00\t-\tSVET\t1930 Jun 21 # Sverdlovsk Time\n\t\t\t 5:00\tRussia\tSVE%sT\t1991 Mar 31 2:00s\n\t\t\t 4:00\tRussia\tSVE%sT\t1992 Jan 19 2:00s\n\t\t\t 5:00\tRussia\tYEK%sT\t2011 Mar 27 2:00s\n\t\t\t 6:00\t-\tYEKT\t# Yekaterinburg Time\nZone Asia/Omsk\t\t 4:53:36 -\tLMT\t1919 Nov 14\n\t\t\t 5:00\t-\tOMST\t1930 Jun 21 # Omsk TIme\n\t\t\t 6:00\tRussia\tOMS%sT\t1991 Mar 31 2:00s\n\t\t\t 5:00\tRussia\tOMS%sT\t1992 Jan 19 2:00s\n\t\t\t 6:00\tRussia\tOMS%sT\t2011 Mar 27 2:00s\n\t\t\t 7:00\t-\tOMST\nZone Asia/Novosibirsk\t 5:31:40 -\tLMT\t1919 Dec 14 6:00\n\t\t\t 6:00\t-\tNOVT\t1930 Jun 21 # Novosibirsk Time\n\t\t\t 7:00\tRussia\tNOV%sT\t1991 Mar 31 2:00s\n\t\t\t 6:00\tRussia\tNOV%sT\t1992 Jan 19 2:00s\n\t\t\t 7:00\tRussia\tNOV%sT\t1993 May 23 # say Shanks & P.\n\t\t\t 6:00\tRussia\tNOV%sT\t2011 Mar 27 2:00s\n\t\t\t 7:00\t-\tNOVT\nZone Asia/Novokuznetsk\t 5:48:48 -\tNMT\t1920 Jan  6\n\t\t\t 6:00\t-\tKRAT\t1930 Jun 21 # Krasnoyarsk Time\n\t\t\t 7:00\tRussia\tKRA%sT\t1991 Mar 31 2:00s\n\t\t\t 6:00\tRussia\tKRA%sT\t1992 Jan 19 2:00s\n\t\t\t 7:00\tRussia\tKRA%sT\t2010 Mar 28 2:00s\n\t\t\t 6:00\tRussia\tNOV%sT\t2011 Mar 27 2:00s\n\t\t\t 7:00\t-\tNOVT # Novosibirsk/Novokuznetsk Time\nZone Asia/Krasnoyarsk\t 6:11:20 -\tLMT\t1920 Jan  6\n\t\t\t 6:00\t-\tKRAT\t1930 Jun 21 # Krasnoyarsk Time\n\t\t\t 7:00\tRussia\tKRA%sT\t1991 Mar 31 2:00s\n\t\t\t 6:00\tRussia\tKRA%sT\t1992 Jan 19 2:00s\n\t\t\t 7:00\tRussia\tKRA%sT\t2011 Mar 27 2:00s\n\t\t\t 8:00\t-\tKRAT\nZone Asia/Irkutsk\t 6:57:20 -\tLMT\t1880\n\t\t\t 6:57:20 -\tIMT\t1920 Jan 25 # Irkutsk Mean Time\n\t\t\t 7:00\t-\tIRKT\t1930 Jun 21 # Irkutsk Time\n\t\t\t 8:00\tRussia\tIRK%sT\t1991 Mar 31 2:00s\n\t\t\t 7:00\tRussia\tIRK%sT\t1992 Jan 19 2:00s\n\t\t\t 8:00\tRussia\tIRK%sT\t2011 Mar 27 2:00s\n\t\t\t 9:00\t-\tIRKT\nZone Asia/Yakutsk\t 8:38:40 -\tLMT\t1919 Dec 15\n\t\t\t 8:00\t-\tYAKT\t1930 Jun 21 # Yakutsk Time\n\t\t\t 9:00\tRussia\tYAK%sT\t1991 Mar 31 2:00s\n\t\t\t 8:00\tRussia\tYAK%sT\t1992 Jan 19 2:00s\n\t\t\t 9:00\tRussia\tYAK%sT\t2011 Mar 27 2:00s\n\t\t\t 10:00\t-\tYAKT\nZone Asia/Vladivostok\t 8:47:44 -\tLMT\t1922 Nov 15\n\t\t\t 9:00\t-\tVLAT\t1930 Jun 21 # Vladivostok Time\n\t\t\t10:00\tRussia\tVLA%sT\t1991 Mar 31 2:00s\n\t\t\t 9:00\tRussia\tVLA%sST\t1992 Jan 19 2:00s\n\t\t\t10:00\tRussia\tVLA%sT\t2011 Mar 27 2:00s\n\t\t\t11:00\t-\tVLAT\nZone Asia/Sakhalin\t 9:30:48 -\tLMT\t1905 Aug 23\n\t\t\t 9:00\t-\tCJT\t1938\n\t\t\t 9:00\t-\tJST\t1945 Aug 25\n\t\t\t11:00\tRussia\tSAK%sT\t1991 Mar 31 2:00s # Sakhalin T.\n\t\t\t10:00\tRussia\tSAK%sT\t1992 Jan 19 2:00s\n\t\t\t11:00\tRussia\tSAK%sT\t1997 Mar lastSun 2:00s\n\t\t\t10:00\tRussia\tSAK%sT\t2011 Mar 27 2:00s\n\t\t\t11:00\t-\tSAKT\nZone Asia/Magadan\t10:03:12 -\tLMT\t1924 May  2\n\t\t\t10:00\t-\tMAGT\t1930 Jun 21 # Magadan Time\n\t\t\t11:00\tRussia\tMAG%sT\t1991 Mar 31 2:00s\n\t\t\t10:00\tRussia\tMAG%sT\t1992 Jan 19 2:00s\n\t\t\t11:00\tRussia\tMAG%sT\t2011 Mar 27 2:00s\n\t\t\t12:00\t-\tMAGT\nZone Asia/Kamchatka\t10:34:36 -\tLMT\t1922 Nov 10\n\t\t\t11:00\t-\tPETT\t1930 Jun 21 # P-K Time\n\t\t\t12:00\tRussia\tPET%sT\t1991 Mar 31 2:00s\n\t\t\t11:00\tRussia\tPET%sT\t1992 Jan 19 2:00s\n\t\t\t12:00\tRussia\tPET%sT\t2010 Mar 28 2:00s\n\t\t\t11:00\tRussia\tPET%sT\t2011 Mar 27 2:00s\n\t\t\t12:00\t-\tPETT\nZone Asia/Anadyr\t11:49:56 -\tLMT\t1924 May  2\n\t\t\t12:00\t-\tANAT\t1930 Jun 21 # Anadyr Time\n\t\t\t13:00\tRussia\tANA%sT\t1982 Apr  1 0:00s\n\t\t\t12:00\tRussia\tANA%sT\t1991 Mar 31 2:00s\n\t\t\t11:00\tRussia\tANA%sT\t1992 Jan 19 2:00s\n\t\t\t12:00\tRussia\tANA%sT\t2010 Mar 28 2:00s\n\t\t\t11:00\tRussia\tANA%sT\t2011 Mar 27 2:00s\n\t\t\t12:00\t-\tANAT\nZone\tEurope/Belgrade\t1:22:00\t-\tLMT\t1884\n\t\t\t1:00\t-\tCET\t1941 Apr 18 23:00\n\t\t\t1:00\tC-Eur\tCE%sT\t1945\n\t\t\t1:00\t-\tCET\t1945 May 8 2:00s\n\t\t\t1:00\t1:00\tCEST\t1945 Sep 16  2:00s\n\t\t\t1:00\t-\tCET\t1982 Nov 27\n\t\t\t1:00\tEU\tCE%sT\nLink Europe/Belgrade Europe/Ljubljana\t# Slovenia\nLink Europe/Belgrade Europe/Podgorica\t# Montenegro\nLink Europe/Belgrade Europe/Sarajevo\t# Bosnia and Herzegovina\nLink Europe/Belgrade Europe/Skopje\t# Macedonia\nLink Europe/Belgrade Europe/Zagreb\t# Croatia\nLink Europe/Prague Europe/Bratislava\nRule\tSpain\t1917\tonly\t-\tMay\t 5\t23:00s\t1:00\tS\nRule\tSpain\t1917\t1919\t-\tOct\t 6\t23:00s\t0\t-\nRule\tSpain\t1918\tonly\t-\tApr\t15\t23:00s\t1:00\tS\nRule\tSpain\t1919\tonly\t-\tApr\t 5\t23:00s\t1:00\tS\nRule\tSpain\t1924\tonly\t-\tApr\t16\t23:00s\t1:00\tS\nRule\tSpain\t1924\tonly\t-\tOct\t 4\t23:00s\t0\t-\nRule\tSpain\t1926\tonly\t-\tApr\t17\t23:00s\t1:00\tS\nRule\tSpain\t1926\t1929\t-\tOct\tSat>=1\t23:00s\t0\t-\nRule\tSpain\t1927\tonly\t-\tApr\t 9\t23:00s\t1:00\tS\nRule\tSpain\t1928\tonly\t-\tApr\t14\t23:00s\t1:00\tS\nRule\tSpain\t1929\tonly\t-\tApr\t20\t23:00s\t1:00\tS\nRule\tSpain\t1937\tonly\t-\tMay\t22\t23:00s\t1:00\tS\nRule\tSpain\t1937\t1939\t-\tOct\tSat>=1\t23:00s\t0\t-\nRule\tSpain\t1938\tonly\t-\tMar\t22\t23:00s\t1:00\tS\nRule\tSpain\t1939\tonly\t-\tApr\t15\t23:00s\t1:00\tS\nRule\tSpain\t1940\tonly\t-\tMar\t16\t23:00s\t1:00\tS\nRule\tSpain\t1942\tonly\t-\tMay\t 2\t22:00s\t2:00\tM # Midsummer\nRule\tSpain\t1942\tonly\t-\tSep\t 1\t22:00s\t1:00\tS\nRule\tSpain\t1943\t1946\t-\tApr\tSat>=13\t22:00s\t2:00\tM\nRule\tSpain\t1943\tonly\t-\tOct\t 3\t22:00s\t1:00\tS\nRule\tSpain\t1944\tonly\t-\tOct\t10\t22:00s\t1:00\tS\nRule\tSpain\t1945\tonly\t-\tSep\t30\t 1:00\t1:00\tS\nRule\tSpain\t1946\tonly\t-\tSep\t30\t 0:00\t0\t-\nRule\tSpain\t1949\tonly\t-\tApr\t30\t23:00\t1:00\tS\nRule\tSpain\t1949\tonly\t-\tSep\t30\t 1:00\t0\t-\nRule\tSpain\t1974\t1975\t-\tApr\tSat>=13\t23:00\t1:00\tS\nRule\tSpain\t1974\t1975\t-\tOct\tSun>=1\t 1:00\t0\t-\nRule\tSpain\t1976\tonly\t-\tMar\t27\t23:00\t1:00\tS\nRule\tSpain\t1976\t1977\t-\tSep\tlastSun\t 1:00\t0\t-\nRule\tSpain\t1977\t1978\t-\tApr\t 2\t23:00\t1:00\tS\nRule\tSpain\t1978\tonly\t-\tOct\t 1\t 1:00\t0\t-\nRule SpainAfrica 1967\tonly\t-\tJun\t 3\t12:00\t1:00\tS\nRule SpainAfrica 1967\tonly\t-\tOct\t 1\t 0:00\t0\t-\nRule SpainAfrica 1974\tonly\t-\tJun\t24\t 0:00\t1:00\tS\nRule SpainAfrica 1974\tonly\t-\tSep\t 1\t 0:00\t0\t-\nRule SpainAfrica 1976\t1977\t-\tMay\t 1\t 0:00\t1:00\tS\nRule SpainAfrica 1976\tonly\t-\tAug\t 1\t 0:00\t0\t-\nRule SpainAfrica 1977\tonly\t-\tSep\t28\t 0:00\t0\t-\nRule SpainAfrica 1978\tonly\t-\tJun\t 1\t 0:00\t1:00\tS\nRule SpainAfrica 1978\tonly\t-\tAug\t 4\t 0:00\t0\t-\nZone\tEurope/Madrid\t-0:14:44 -\tLMT\t1901 Jan  1  0:00s\n\t\t\t 0:00\tSpain\tWE%sT\t1946 Sep 30\n\t\t\t 1:00\tSpain\tCE%sT\t1979\n\t\t\t 1:00\tEU\tCE%sT\nZone\tAfrica/Ceuta\t-0:21:16 -\tLMT\t1901\n\t\t\t 0:00\t-\tWET\t1918 May  6 23:00\n\t\t\t 0:00\t1:00\tWEST\t1918 Oct  7 23:00\n\t\t\t 0:00\t-\tWET\t1924\n\t\t\t 0:00\tSpain\tWE%sT\t1929\n\t\t\t 0:00 SpainAfrica WE%sT 1984 Mar 16\n\t\t\t 1:00\t-\tCET\t1986\n\t\t\t 1:00\tEU\tCE%sT\nZone\tAtlantic/Canary\t-1:01:36 -\tLMT\t1922 Mar # Las Palmas de Gran C.\n\t\t\t-1:00\t-\tCANT\t1946 Sep 30 1:00 # Canaries Time\n\t\t\t 0:00\t-\tWET\t1980 Apr  6 0:00s\n\t\t\t 0:00\t1:00\tWEST\t1980 Sep 28 0:00s\n\t\t\t 0:00\tEU\tWE%sT\nZone Europe/Stockholm\t1:12:12 -\tLMT\t1879 Jan  1\n\t\t\t1:00:14\t-\tSET\t1900 Jan  1\t# Swedish Time\n\t\t\t1:00\t-\tCET\t1916 May 14 23:00\n\t\t\t1:00\t1:00\tCEST\t1916 Oct  1 01:00\n\t\t\t1:00\t-\tCET\t1980\n\t\t\t1:00\tEU\tCE%sT\nRule\tSwiss\t1941\t1942\t-\tMay\tMon>=1\t1:00\t1:00\tS\nRule\tSwiss\t1941\t1942\t-\tOct\tMon>=1\t2:00\t0\t-\nZone\tEurope/Zurich\t0:34:08 -\tLMT\t1848 Sep 12\n\t\t\t0:29:44\t-\tBMT\t1894 Jun # Bern Mean Time\n\t\t\t1:00\tSwiss\tCE%sT\t1981\n\t\t\t1:00\tEU\tCE%sT\nRule\tTurkey\t1916\tonly\t-\tMay\t 1\t0:00\t1:00\tS\nRule\tTurkey\t1916\tonly\t-\tOct\t 1\t0:00\t0\t-\nRule\tTurkey\t1920\tonly\t-\tMar\t28\t0:00\t1:00\tS\nRule\tTurkey\t1920\tonly\t-\tOct\t25\t0:00\t0\t-\nRule\tTurkey\t1921\tonly\t-\tApr\t 3\t0:00\t1:00\tS\nRule\tTurkey\t1921\tonly\t-\tOct\t 3\t0:00\t0\t-\nRule\tTurkey\t1922\tonly\t-\tMar\t26\t0:00\t1:00\tS\nRule\tTurkey\t1922\tonly\t-\tOct\t 8\t0:00\t0\t-\nRule\tTurkey\t1924\tonly\t-\tMay\t13\t0:00\t1:00\tS\nRule\tTurkey\t1924\t1925\t-\tOct\t 1\t0:00\t0\t-\nRule\tTurkey\t1925\tonly\t-\tMay\t 1\t0:00\t1:00\tS\nRule\tTurkey\t1940\tonly\t-\tJun\t30\t0:00\t1:00\tS\nRule\tTurkey\t1940\tonly\t-\tOct\t 5\t0:00\t0\t-\nRule\tTurkey\t1940\tonly\t-\tDec\t 1\t0:00\t1:00\tS\nRule\tTurkey\t1941\tonly\t-\tSep\t21\t0:00\t0\t-\nRule\tTurkey\t1942\tonly\t-\tApr\t 1\t0:00\t1:00\tS\nRule\tTurkey\t1942\tonly\t-\tNov\t 1\t0:00\t0\t-\nRule\tTurkey\t1945\tonly\t-\tApr\t 2\t0:00\t1:00\tS\nRule\tTurkey\t1945\tonly\t-\tOct\t 8\t0:00\t0\t-\nRule\tTurkey\t1946\tonly\t-\tJun\t 1\t0:00\t1:00\tS\nRule\tTurkey\t1946\tonly\t-\tOct\t 1\t0:00\t0\t-\nRule\tTurkey\t1947\t1948\t-\tApr\tSun>=16\t0:00\t1:00\tS\nRule\tTurkey\t1947\t1950\t-\tOct\tSun>=2\t0:00\t0\t-\nRule\tTurkey\t1949\tonly\t-\tApr\t10\t0:00\t1:00\tS\nRule\tTurkey\t1950\tonly\t-\tApr\t19\t0:00\t1:00\tS\nRule\tTurkey\t1951\tonly\t-\tApr\t22\t0:00\t1:00\tS\nRule\tTurkey\t1951\tonly\t-\tOct\t 8\t0:00\t0\t-\nRule\tTurkey\t1962\tonly\t-\tJul\t15\t0:00\t1:00\tS\nRule\tTurkey\t1962\tonly\t-\tOct\t 8\t0:00\t0\t-\nRule\tTurkey\t1964\tonly\t-\tMay\t15\t0:00\t1:00\tS\nRule\tTurkey\t1964\tonly\t-\tOct\t 1\t0:00\t0\t-\nRule\tTurkey\t1970\t1972\t-\tMay\tSun>=2\t0:00\t1:00\tS\nRule\tTurkey\t1970\t1972\t-\tOct\tSun>=2\t0:00\t0\t-\nRule\tTurkey\t1973\tonly\t-\tJun\t 3\t1:00\t1:00\tS\nRule\tTurkey\t1973\tonly\t-\tNov\t 4\t3:00\t0\t-\nRule\tTurkey\t1974\tonly\t-\tMar\t31\t2:00\t1:00\tS\nRule\tTurkey\t1974\tonly\t-\tNov\t 3\t5:00\t0\t-\nRule\tTurkey\t1975\tonly\t-\tMar\t30\t0:00\t1:00\tS\nRule\tTurkey\t1975\t1976\t-\tOct\tlastSun\t0:00\t0\t-\nRule\tTurkey\t1976\tonly\t-\tJun\t 1\t0:00\t1:00\tS\nRule\tTurkey\t1977\t1978\t-\tApr\tSun>=1\t0:00\t1:00\tS\nRule\tTurkey\t1977\tonly\t-\tOct\t16\t0:00\t0\t-\nRule\tTurkey\t1979\t1980\t-\tApr\tSun>=1\t3:00\t1:00\tS\nRule\tTurkey\t1979\t1982\t-\tOct\tMon>=11\t0:00\t0\t-\nRule\tTurkey\t1981\t1982\t-\tMar\tlastSun\t3:00\t1:00\tS\nRule\tTurkey\t1983\tonly\t-\tJul\t31\t0:00\t1:00\tS\nRule\tTurkey\t1983\tonly\t-\tOct\t 2\t0:00\t0\t-\nRule\tTurkey\t1985\tonly\t-\tApr\t20\t0:00\t1:00\tS\nRule\tTurkey\t1985\tonly\t-\tSep\t28\t0:00\t0\t-\nRule\tTurkey\t1986\t1990\t-\tMar\tlastSun\t2:00s\t1:00\tS\nRule\tTurkey\t1986\t1990\t-\tSep\tlastSun\t2:00s\t0\t-\nRule\tTurkey\t1991\t2006\t-\tMar\tlastSun\t1:00s\t1:00\tS\nRule\tTurkey\t1991\t1995\t-\tSep\tlastSun\t1:00s\t0\t-\nRule\tTurkey\t1996\t2006\t-\tOct\tlastSun\t1:00s\t0\t-\nZone\tEurope/Istanbul\t1:55:52 -\tLMT\t1880\n\t\t\t1:56:56\t-\tIMT\t1910 Oct # Istanbul Mean Time?\n\t\t\t2:00\tTurkey\tEE%sT\t1978 Oct 15\n\t\t\t3:00\tTurkey\tTR%sT\t1985 Apr 20 # Turkey Time\n\t\t\t2:00\tTurkey\tEE%sT\t2007\n\t\t\t2:00\tEU\tEE%sT\t2011 Mar 27 1:00u\n\t\t\t2:00\t-\tEET\t2011 Mar 28 1:00u\n\t\t\t2:00\tEU\tEE%sT\nLink\tEurope/Istanbul\tAsia/Istanbul\t# Istanbul is in both continents.\nZone Europe/Kiev\t2:02:04 -\tLMT\t1880\n\t\t\t2:02:04\t-\tKMT\t1924 May  2 # Kiev Mean Time\n\t\t\t2:00\t-\tEET\t1930 Jun 21\n\t\t\t3:00\t-\tMSK\t1941 Sep 20\n\t\t\t1:00\tC-Eur\tCE%sT\t1943 Nov  6\n\t\t\t3:00\tRussia\tMSK/MSD\t1990\n\t\t\t3:00\t-\tMSK\t1990 Jul  1 2:00\n\t\t\t2:00\t-\tEET\t1992\n\t\t\t2:00\tE-Eur\tEE%sT\t1995\n\t\t\t2:00\tEU\tEE%sT\nZone Europe/Uzhgorod\t1:29:12 -\tLMT\t1890 Oct\n\t\t\t1:00\t-\tCET\t1940\n\t\t\t1:00\tC-Eur\tCE%sT\t1944 Oct\n\t\t\t1:00\t1:00\tCEST\t1944 Oct 26\n\t\t\t1:00\t-\tCET\t1945 Jun 29\n\t\t\t3:00\tRussia\tMSK/MSD\t1990\n\t\t\t3:00\t-\tMSK\t1990 Jul  1 2:00\n\t\t\t1:00\t-\tCET\t1991 Mar 31 3:00\n\t\t\t2:00\t-\tEET\t1992\n\t\t\t2:00\tE-Eur\tEE%sT\t1995\n\t\t\t2:00\tEU\tEE%sT\nZone Europe/Zaporozhye\t2:20:40 -\tLMT\t1880\n\t\t\t2:20\t-\tCUT\t1924 May  2 # Central Ukraine T\n\t\t\t2:00\t-\tEET\t1930 Jun 21\n\t\t\t3:00\t-\tMSK\t1941 Aug 25\n\t\t\t1:00\tC-Eur\tCE%sT\t1943 Oct 25\n\t\t\t3:00\tRussia\tMSK/MSD\t1991 Mar 31 2:00\n\t\t\t2:00\tE-Eur\tEE%sT\t1995\n\t\t\t2:00\tEU\tEE%sT\nZone Europe/Simferopol\t2:16:24 -\tLMT\t1880\n\t\t\t2:16\t-\tSMT\t1924 May  2 # Simferopol Mean T\n\t\t\t2:00\t-\tEET\t1930 Jun 21\n\t\t\t3:00\t-\tMSK\t1941 Nov\n\t\t\t1:00\tC-Eur\tCE%sT\t1944 Apr 13\n\t\t\t3:00\tRussia\tMSK/MSD\t1990\n\t\t\t3:00\t-\tMSK\t1990 Jul  1 2:00\n\t\t\t2:00\t-\tEET\t1992\n\t\t\t2:00\tE-Eur\tEE%sT\t1994 May\n\t\t\t3:00\tE-Eur\tMSK/MSD\t1996 Mar 31 3:00s\n\t\t\t3:00\t1:00\tMSD\t1996 Oct 27 3:00s\n\t\t\t3:00\tRussia\tMSK/MSD\t1997\n\t\t\t3:00\t-\tMSK\t1997 Mar lastSun 1:00u\n\t\t\t2:00\tEU\tEE%sT\n","tz/northamerica":"Rule\tUS\t1918\t1919\t-\tMar\tlastSun\t2:00\t1:00\tD\nRule\tUS\t1918\t1919\t-\tOct\tlastSun\t2:00\t0\tS\nRule\tUS\t1942\tonly\t-\tFeb\t9\t2:00\t1:00\tW # War\nRule\tUS\t1945\tonly\t-\tAug\t14\t23:00u\t1:00\tP # Peace\nRule\tUS\t1945\tonly\t-\tSep\t30\t2:00\t0\tS\nRule\tUS\t1967\t2006\t-\tOct\tlastSun\t2:00\t0\tS\nRule\tUS\t1967\t1973\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tUS\t1974\tonly\t-\tJan\t6\t2:00\t1:00\tD\nRule\tUS\t1975\tonly\t-\tFeb\t23\t2:00\t1:00\tD\nRule\tUS\t1976\t1986\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tUS\t1987\t2006\t-\tApr\tSun>=1\t2:00\t1:00\tD\nRule\tUS\t2007\tmax\t-\tMar\tSun>=8\t2:00\t1:00\tD\nRule\tUS\t2007\tmax\t-\tNov\tSun>=1\t2:00\t0\tS\nZone\tEST\t\t -5:00\t-\tEST\nZone\tMST\t\t -7:00\t-\tMST\nZone\tHST\t\t-10:00\t-\tHST\nZone\tEST5EDT\t\t -5:00\tUS\tE%sT\nZone\tCST6CDT\t\t -6:00\tUS\tC%sT\nZone\tMST7MDT\t\t -7:00\tUS\tM%sT\nZone\tPST8PDT\t\t -8:00\tUS\tP%sT\nRule\tNYC\t1920\tonly\t-\tMar\tlastSun\t2:00\t1:00\tD\nRule\tNYC\t1920\tonly\t-\tOct\tlastSun\t2:00\t0\tS\nRule\tNYC\t1921\t1966\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tNYC\t1921\t1954\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tNYC\t1955\t1966\t-\tOct\tlastSun\t2:00\t0\tS\nZone America/New_York\t-4:56:02 -\tLMT\t1883 Nov 18 12:03:58\n\t\t\t-5:00\tUS\tE%sT\t1920\n\t\t\t-5:00\tNYC\tE%sT\t1942\n\t\t\t-5:00\tUS\tE%sT\t1946\n\t\t\t-5:00\tNYC\tE%sT\t1967\n\t\t\t-5:00\tUS\tE%sT\nRule\tChicago\t1920\tonly\t-\tJun\t13\t2:00\t1:00\tD\nRule\tChicago\t1920\t1921\t-\tOct\tlastSun\t2:00\t0\tS\nRule\tChicago\t1921\tonly\t-\tMar\tlastSun\t2:00\t1:00\tD\nRule\tChicago\t1922\t1966\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tChicago\t1922\t1954\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tChicago\t1955\t1966\t-\tOct\tlastSun\t2:00\t0\tS\nZone America/Chicago\t-5:50:36 -\tLMT\t1883 Nov 18 12:09:24\n\t\t\t-6:00\tUS\tC%sT\t1920\n\t\t\t-6:00\tChicago\tC%sT\t1936 Mar  1 2:00\n\t\t\t-5:00\t-\tEST\t1936 Nov 15 2:00\n\t\t\t-6:00\tChicago\tC%sT\t1942\n\t\t\t-6:00\tUS\tC%sT\t1946\n\t\t\t-6:00\tChicago\tC%sT\t1967\n\t\t\t-6:00\tUS\tC%sT\nZone America/North_Dakota/Center -6:45:12 - LMT\t1883 Nov 18 12:14:48\n\t\t\t-7:00\tUS\tM%sT\t1992 Oct 25 02:00\n\t\t\t-6:00\tUS\tC%sT\nZone America/North_Dakota/New_Salem -6:45:39 - LMT 1883 Nov 18 12:14:21\n\t\t\t-7:00\tUS\tM%sT\t2003 Oct 26 02:00\n\t\t\t-6:00\tUS\tC%sT\nZone America/North_Dakota/Beulah -6:47:07 - LMT 1883 Nov 18 12:12:53\n\t\t\t-7:00\tUS\tM%sT\t2010 Nov  7 2:00\n\t\t\t-6:00\tUS\tC%sT\nRule\tDenver\t1920\t1921\t-\tMar\tlastSun\t2:00\t1:00\tD\nRule\tDenver\t1920\tonly\t-\tOct\tlastSun\t2:00\t0\tS\nRule\tDenver\t1921\tonly\t-\tMay\t22\t2:00\t0\tS\nRule\tDenver\t1965\t1966\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tDenver\t1965\t1966\t-\tOct\tlastSun\t2:00\t0\tS\nZone America/Denver\t-6:59:56 -\tLMT\t1883 Nov 18 12:00:04\n\t\t\t-7:00\tUS\tM%sT\t1920\n\t\t\t-7:00\tDenver\tM%sT\t1942\n\t\t\t-7:00\tUS\tM%sT\t1946\n\t\t\t-7:00\tDenver\tM%sT\t1967\n\t\t\t-7:00\tUS\tM%sT\nRule\tCA\t1948\tonly\t-\tMar\t14\t2:00\t1:00\tD\nRule\tCA\t1949\tonly\t-\tJan\t 1\t2:00\t0\tS\nRule\tCA\t1950\t1966\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tCA\t1950\t1961\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tCA\t1962\t1966\t-\tOct\tlastSun\t2:00\t0\tS\nZone America/Los_Angeles -7:52:58 -\tLMT\t1883 Nov 18 12:07:02\n\t\t\t-8:00\tUS\tP%sT\t1946\n\t\t\t-8:00\tCA\tP%sT\t1967\n\t\t\t-8:00\tUS\tP%sT\nZone America/Juneau\t 15:02:19 -\tLMT\t1867 Oct 18\n\t\t\t -8:57:41 -\tLMT\t1900 Aug 20 12:00\n\t\t\t -8:00\t-\tPST\t1942\n\t\t\t -8:00\tUS\tP%sT\t1946\n\t\t\t -8:00\t-\tPST\t1969\n\t\t\t -8:00\tUS\tP%sT\t1980 Apr 27 2:00\n\t\t\t -9:00\tUS\tY%sT\t1980 Oct 26 2:00\t\n\t\t\t -8:00\tUS\tP%sT\t1983 Oct 30 2:00\n\t\t\t -9:00\tUS\tY%sT\t1983 Nov 30\n\t\t\t -9:00\tUS\tAK%sT\nZone America/Sitka\t 14:58:47 -\tLMT\t1867 Oct 18\n\t\t\t -9:01:13 -\tLMT\t1900 Aug 20 12:00\n\t\t\t -8:00\t-\tPST\t1942\n\t\t\t -8:00\tUS\tP%sT\t1946\n\t\t\t -8:00\t-\tPST\t1969\n\t\t\t -8:00\tUS\tP%sT\t1983 Oct 30 2:00\n\t\t\t -9:00\tUS\tY%sT\t1983 Nov 30\n\t\t\t -9:00\tUS\tAK%sT\nZone America/Metlakatla\t 15:13:42 -\tLMT\t1867 Oct 18\n\t\t\t -8:46:18 -\tLMT\t1900 Aug 20 12:00\n\t\t\t -8:00\t-\tPST\t1942\n\t\t\t -8:00\tUS\tP%sT\t1946\n\t\t\t -8:00\t-\tPST\t1969\n\t\t\t -8:00\tUS\tP%sT\t1983 Oct 30 2:00\n\t\t\t -8:00\t-\tMeST\nZone America/Yakutat\t 14:41:05 -\tLMT\t1867 Oct 18\n\t\t\t -9:18:55 -\tLMT\t1900 Aug 20 12:00\n\t\t\t -9:00\t-\tYST\t1942\n\t\t\t -9:00\tUS\tY%sT\t1946\n\t\t\t -9:00\t-\tYST\t1969\n\t\t\t -9:00\tUS\tY%sT\t1983 Nov 30\n\t\t\t -9:00\tUS\tAK%sT\nZone America/Anchorage\t 14:00:24 -\tLMT\t1867 Oct 18\n\t\t\t -9:59:36 -\tLMT\t1900 Aug 20 12:00\n\t\t\t-10:00\t-\tCAT\t1942\n\t\t\t-10:00\tUS\tCAT/CAWT 1945 Aug 14 23:00u\n\t\t\t-10:00\tUS\tCAT/CAPT 1946 # Peace\n\t\t\t-10:00\t-\tCAT\t1967 Apr\n\t\t\t-10:00\t-\tAHST\t1969\n\t\t\t-10:00\tUS\tAH%sT\t1983 Oct 30 2:00\n\t\t\t -9:00\tUS\tY%sT\t1983 Nov 30\n\t\t\t -9:00\tUS\tAK%sT\nZone America/Nome\t 12:58:21 -\tLMT\t1867 Oct 18\n\t\t\t-11:01:38 -\tLMT\t1900 Aug 20 12:00\n\t\t\t-11:00\t-\tNST\t1942\n\t\t\t-11:00\tUS\tN%sT\t1946\n\t\t\t-11:00\t-\tNST\t1967 Apr\n\t\t\t-11:00\t-\tBST\t1969\n\t\t\t-11:00\tUS\tB%sT\t1983 Oct 30 2:00\n\t\t\t -9:00\tUS\tY%sT\t1983 Nov 30\n\t\t\t -9:00\tUS\tAK%sT\nZone America/Adak\t 12:13:21 -\tLMT\t1867 Oct 18\n\t\t\t-11:46:38 -\tLMT\t1900 Aug 20 12:00\n\t\t\t-11:00\t-\tNST\t1942\n\t\t\t-11:00\tUS\tN%sT\t1946\n\t\t\t-11:00\t-\tNST\t1967 Apr\n\t\t\t-11:00\t-\tBST\t1969\n\t\t\t-11:00\tUS\tB%sT\t1983 Oct 30 2:00\n\t\t\t-10:00\tUS\tAH%sT\t1983 Nov 30\n\t\t\t-10:00\tUS\tHA%sT\nZone Pacific/Honolulu\t-10:31:26 -\tLMT\t1896 Jan 13 12:00 #Schmitt&Cox\n\t\t\t-10:30\t-\tHST\t1933 Apr 30 2:00 #Laws 1933\n\t\t\t-10:30\t1:00\tHDT\t1933 May 21 12:00 #Laws 1933+12\n\t\t\t-10:30\t-\tHST\t1942 Feb 09 2:00 #Schmitt&Cox+2\n\t\t\t-10:30\t1:00\tHDT\t1945 Sep 30 2:00 #Schmitt&Cox+2\n\t\t\t-10:30\t-\tHST\t1947 Jun  8 2:00 #Schmitt&Cox+2\n\t\t\t-10:00\t-\tHST\nZone America/Phoenix\t-7:28:18 -\tLMT\t1883 Nov 18 11:31:42\n\t\t\t-7:00\tUS\tM%sT\t1944 Jan  1 00:01\n\t\t\t-7:00\t-\tMST\t1944 Apr  1 00:01\n\t\t\t-7:00\tUS\tM%sT\t1944 Oct  1 00:01\n\t\t\t-7:00\t-\tMST\t1967\n\t\t\t-7:00\tUS\tM%sT\t1968 Mar 21\n\t\t\t-7:00\t-\tMST\nLink America/Denver America/Shiprock\nZone America/Boise\t-7:44:49 -\tLMT\t1883 Nov 18 12:15:11\n\t\t\t-8:00\tUS\tP%sT\t1923 May 13 2:00\n\t\t\t-7:00\tUS\tM%sT\t1974\n\t\t\t-7:00\t-\tMST\t1974 Feb  3 2:00\n\t\t\t-7:00\tUS\tM%sT\nRule Indianapolis 1941\tonly\t-\tJun\t22\t2:00\t1:00\tD\nRule Indianapolis 1941\t1954\t-\tSep\tlastSun\t2:00\t0\tS\nRule Indianapolis 1946\t1954\t-\tApr\tlastSun\t2:00\t1:00\tD\nZone America/Indiana/Indianapolis -5:44:38 - LMT 1883 Nov 18 12:15:22\n\t\t\t-6:00\tUS\tC%sT\t1920\n\t\t\t-6:00 Indianapolis C%sT\t1942\n\t\t\t-6:00\tUS\tC%sT\t1946\n\t\t\t-6:00 Indianapolis C%sT\t1955 Apr 24 2:00\n\t\t\t-5:00\t-\tEST\t1957 Sep 29 2:00\n\t\t\t-6:00\t-\tCST\t1958 Apr 27 2:00\n\t\t\t-5:00\t-\tEST\t1969\n\t\t\t-5:00\tUS\tE%sT\t1971\n\t\t\t-5:00\t-\tEST\t2006\n\t\t\t-5:00\tUS\tE%sT\nRule\tMarengo\t1951\tonly\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tMarengo\t1951\tonly\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tMarengo\t1954\t1960\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tMarengo\t1954\t1960\t-\tSep\tlastSun\t2:00\t0\tS\nZone America/Indiana/Marengo -5:45:23 -\tLMT\t1883 Nov 18 12:14:37\n\t\t\t-6:00\tUS\tC%sT\t1951\n\t\t\t-6:00\tMarengo\tC%sT\t1961 Apr 30 2:00\n\t\t\t-5:00\t-\tEST\t1969\n\t\t\t-5:00\tUS\tE%sT\t1974 Jan  6 2:00\n\t\t\t-6:00\t1:00\tCDT\t1974 Oct 27 2:00\n\t\t\t-5:00\tUS\tE%sT\t1976\n\t\t\t-5:00\t-\tEST\t2006\n\t\t\t-5:00\tUS\tE%sT\nRule Vincennes\t1946\tonly\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule Vincennes\t1946\tonly\t-\tSep\tlastSun\t2:00\t0\tS\nRule Vincennes\t1953\t1954\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule Vincennes\t1953\t1959\t-\tSep\tlastSun\t2:00\t0\tS\nRule Vincennes\t1955\tonly\t-\tMay\t 1\t0:00\t1:00\tD\nRule Vincennes\t1956\t1963\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule Vincennes\t1960\tonly\t-\tOct\tlastSun\t2:00\t0\tS\nRule Vincennes\t1961\tonly\t-\tSep\tlastSun\t2:00\t0\tS\nRule Vincennes\t1962\t1963\t-\tOct\tlastSun\t2:00\t0\tS\nZone America/Indiana/Vincennes -5:50:07 - LMT\t1883 Nov 18 12:09:53\n\t\t\t-6:00\tUS\tC%sT\t1946\n\t\t\t-6:00 Vincennes\tC%sT\t1964 Apr 26 2:00\n\t\t\t-5:00\t-\tEST\t1969\n\t\t\t-5:00\tUS\tE%sT\t1971\n\t\t\t-5:00\t-\tEST\t2006 Apr  2 2:00\n\t\t\t-6:00\tUS\tC%sT\t2007 Nov  4 2:00\n\t\t\t-5:00\tUS\tE%sT\nRule Perry\t1946\tonly\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule Perry\t1946\tonly\t-\tSep\tlastSun\t2:00\t0\tS\nRule Perry\t1953\t1954\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule Perry\t1953\t1959\t-\tSep\tlastSun\t2:00\t0\tS\nRule Perry\t1955\tonly\t-\tMay\t 1\t0:00\t1:00\tD\nRule Perry\t1956\t1963\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule Perry\t1960\tonly\t-\tOct\tlastSun\t2:00\t0\tS\nRule Perry\t1961\tonly\t-\tSep\tlastSun\t2:00\t0\tS\nRule Perry\t1962\t1963\t-\tOct\tlastSun\t2:00\t0\tS\nZone America/Indiana/Tell_City -5:47:03 - LMT\t1883 Nov 18 12:12:57\n\t\t\t-6:00\tUS\tC%sT\t1946\n\t\t\t-6:00 Perry\tC%sT\t1964 Apr 26 2:00\n\t\t\t-5:00\t-\tEST\t1969\n\t\t\t-5:00\tUS\tE%sT\t1971\n\t\t\t-5:00\t-\tEST\t2006 Apr  2 2:00\n\t\t\t-6:00\tUS\tC%sT\nRule\tPike\t1955\tonly\t-\tMay\t 1\t0:00\t1:00\tD\nRule\tPike\t1955\t1960\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tPike\t1956\t1964\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tPike\t1961\t1964\t-\tOct\tlastSun\t2:00\t0\tS\nZone America/Indiana/Petersburg -5:49:07 - LMT\t1883 Nov 18 12:10:53\n\t\t\t-6:00\tUS\tC%sT\t1955\n\t\t\t-6:00\tPike\tC%sT\t1965 Apr 25 2:00\n\t\t\t-5:00\t-\tEST\t1966 Oct 30 2:00\n\t\t\t-6:00\tUS\tC%sT\t1977 Oct 30 2:00\n\t\t\t-5:00\t-\tEST\t2006 Apr  2 2:00\n\t\t\t-6:00\tUS\tC%sT\t2007 Nov  4 2:00\n\t\t\t-5:00\tUS\tE%sT\nRule\tStarke\t1947\t1961\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tStarke\t1947\t1954\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tStarke\t1955\t1956\t-\tOct\tlastSun\t2:00\t0\tS\nRule\tStarke\t1957\t1958\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tStarke\t1959\t1961\t-\tOct\tlastSun\t2:00\t0\tS\nZone America/Indiana/Knox -5:46:30 -\tLMT\t1883 Nov 18 12:13:30\n\t\t\t-6:00\tUS\tC%sT\t1947\n\t\t\t-6:00\tStarke\tC%sT\t1962 Apr 29 2:00\n\t\t\t-5:00\t-\tEST\t1963 Oct 27 2:00\n\t\t\t-6:00\tUS\tC%sT\t1991 Oct 27 2:00\n\t\t\t-5:00\t-\tEST\t2006 Apr  2 2:00\n\t\t\t-6:00\tUS\tC%sT\nRule\tPulaski\t1946\t1960\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tPulaski\t1946\t1954\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tPulaski\t1955\t1956\t-\tOct\tlastSun\t2:00\t0\tS\nRule\tPulaski\t1957\t1960\t-\tSep\tlastSun\t2:00\t0\tS\nZone America/Indiana/Winamac -5:46:25 - LMT\t1883 Nov 18 12:13:35\n\t\t\t-6:00\tUS\tC%sT\t1946\n\t\t\t-6:00\tPulaski\tC%sT\t1961 Apr 30 2:00\n\t\t\t-5:00\t-\tEST\t1969\n\t\t\t-5:00\tUS\tE%sT\t1971\n\t\t\t-5:00\t-\tEST\t2006 Apr  2 2:00\n\t\t\t-6:00\tUS\tC%sT\t2007 Mar 11 2:00\n\t\t\t-5:00\tUS\tE%sT\nZone America/Indiana/Vevay -5:40:16 -\tLMT\t1883 Nov 18 12:19:44\n\t\t\t-6:00\tUS\tC%sT\t1954 Apr 25 2:00\n\t\t\t-5:00\t-\tEST\t1969\n\t\t\t-5:00\tUS\tE%sT\t1973\n\t\t\t-5:00\t-\tEST\t2006\n\t\t\t-5:00\tUS\tE%sT\nRule Louisville\t1921\tonly\t-\tMay\t1\t2:00\t1:00\tD\nRule Louisville\t1921\tonly\t-\tSep\t1\t2:00\t0\tS\nRule Louisville\t1941\t1961\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule Louisville\t1941\tonly\t-\tSep\tlastSun\t2:00\t0\tS\nRule Louisville\t1946\tonly\t-\tJun\t2\t2:00\t0\tS\nRule Louisville\t1950\t1955\t-\tSep\tlastSun\t2:00\t0\tS\nRule Louisville\t1956\t1960\t-\tOct\tlastSun\t2:00\t0\tS\nZone America/Kentucky/Louisville -5:43:02 -\tLMT\t1883 Nov 18 12:16:58\n\t\t\t-6:00\tUS\tC%sT\t1921\n\t\t\t-6:00 Louisville C%sT\t1942\n\t\t\t-6:00\tUS\tC%sT\t1946\n\t\t\t-6:00 Louisville C%sT\t1961 Jul 23 2:00\n\t\t\t-5:00\t-\tEST\t1968\n\t\t\t-5:00\tUS\tE%sT\t1974 Jan  6 2:00\n\t\t\t-6:00\t1:00\tCDT\t1974 Oct 27 2:00\n\t\t\t-5:00\tUS\tE%sT\nZone America/Kentucky/Monticello -5:39:24 - LMT\t1883 Nov 18 12:20:36\n\t\t\t-6:00\tUS\tC%sT\t1946\n\t\t\t-6:00\t-\tCST\t1968\n\t\t\t-6:00\tUS\tC%sT\t2000 Oct 29  2:00\n\t\t\t-5:00\tUS\tE%sT\nRule\tDetroit\t1948\tonly\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tDetroit\t1948\tonly\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tDetroit\t1967\tonly\t-\tJun\t14\t2:00\t1:00\tD\nRule\tDetroit\t1967\tonly\t-\tOct\tlastSun\t2:00\t0\tS\nZone America/Detroit\t-5:32:11 -\tLMT\t1905\n\t\t\t-6:00\t-\tCST\t1915 May 15 2:00\n\t\t\t-5:00\t-\tEST\t1942\n\t\t\t-5:00\tUS\tE%sT\t1946\n\t\t\t-5:00\tDetroit\tE%sT\t1973\n\t\t\t-5:00\tUS\tE%sT\t1975\n\t\t\t-5:00\t-\tEST\t1975 Apr 27 2:00\n\t\t\t-5:00\tUS\tE%sT\nRule Menominee\t1946\tonly\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule Menominee\t1946\tonly\t-\tSep\tlastSun\t2:00\t0\tS\nRule Menominee\t1966\tonly\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule Menominee\t1966\tonly\t-\tOct\tlastSun\t2:00\t0\tS\nZone America/Menominee\t-5:50:27 -\tLMT\t1885 Sep 18 12:00\n\t\t\t-6:00\tUS\tC%sT\t1946\n\t\t\t-6:00 Menominee\tC%sT\t1969 Apr 27 2:00\n\t\t\t-5:00\t-\tEST\t1973 Apr 29 2:00\n\t\t\t-6:00\tUS\tC%sT\nRule\tCanada\t1918\tonly\t-\tApr\t14\t2:00\t1:00\tD\nRule\tCanada\t1918\tonly\t-\tOct\t31\t2:00\t0\tS\nRule\tCanada\t1942\tonly\t-\tFeb\t 9\t2:00\t1:00\tW # War\nRule\tCanada\t1945\tonly\t-\tAug\t14\t23:00u\t1:00\tP # Peace\nRule\tCanada\t1945\tonly\t-\tSep\t30\t2:00\t0\tS\nRule\tCanada\t1974\t1986\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tCanada\t1974\t2006\t-\tOct\tlastSun\t2:00\t0\tS\nRule\tCanada\t1987\t2006\t-\tApr\tSun>=1\t2:00\t1:00\tD\nRule\tCanada\t2007\tmax\t-\tMar\tSun>=8\t2:00\t1:00\tD\nRule\tCanada\t2007\tmax\t-\tNov\tSun>=1\t2:00\t0\tS\nRule\tStJohns\t1917\tonly\t-\tApr\t 8\t2:00\t1:00\tD\nRule\tStJohns\t1917\tonly\t-\tSep\t17\t2:00\t0\tS\nRule\tStJohns\t1919\tonly\t-\tMay\t 5\t23:00\t1:00\tD\nRule\tStJohns\t1919\tonly\t-\tAug\t12\t23:00\t0\tS\nRule\tStJohns\t1920\t1935\t-\tMay\tSun>=1\t23:00\t1:00\tD\nRule\tStJohns\t1920\t1935\t-\tOct\tlastSun\t23:00\t0\tS\nRule\tStJohns\t1936\t1941\t-\tMay\tMon>=9\t0:00\t1:00\tD\nRule\tStJohns\t1936\t1941\t-\tOct\tMon>=2\t0:00\t0\tS\nRule\tStJohns\t1946\t1950\t-\tMay\tSun>=8\t2:00\t1:00\tD\nRule\tStJohns\t1946\t1950\t-\tOct\tSun>=2\t2:00\t0\tS\nRule\tStJohns\t1951\t1986\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tStJohns\t1951\t1959\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tStJohns\t1960\t1986\t-\tOct\tlastSun\t2:00\t0\tS\nRule\tStJohns\t1987\tonly\t-\tApr\tSun>=1\t0:01\t1:00\tD\nRule\tStJohns\t1987\t2006\t-\tOct\tlastSun\t0:01\t0\tS\nRule\tStJohns\t1988\tonly\t-\tApr\tSun>=1\t0:01\t2:00\tDD\nRule\tStJohns\t1989\t2006\t-\tApr\tSun>=1\t0:01\t1:00\tD\nRule\tStJohns\t2007\t2011\t-\tMar\tSun>=8\t0:01\t1:00\tD\nRule\tStJohns\t2007\t2010\t-\tNov\tSun>=1\t0:01\t0\tS\nZone America/St_Johns\t-3:30:52 -\tLMT\t1884\n\t\t\t-3:30:52 StJohns N%sT\t1918\n\t\t\t-3:30:52 Canada\tN%sT\t1919\n\t\t\t-3:30:52 StJohns N%sT\t1935 Mar 30\n\t\t\t-3:30\tStJohns\tN%sT\t1942 May 11\n\t\t\t-3:30\tCanada\tN%sT\t1946\n\t\t\t-3:30\tStJohns\tN%sT\t2011 Nov\n\t\t\t-3:30\tCanada\tN%sT\nZone America/Goose_Bay\t-4:01:40 -\tLMT\t1884 # Happy Valley-Goose Bay\n\t\t\t-3:30:52 -\tNST\t1918\n\t\t\t-3:30:52 Canada N%sT\t1919\n\t\t\t-3:30:52 -\tNST\t1935 Mar 30\n\t\t\t-3:30\t-\tNST\t1936\n\t\t\t-3:30\tStJohns\tN%sT\t1942 May 11\n\t\t\t-3:30\tCanada\tN%sT\t1946\n\t\t\t-3:30\tStJohns\tN%sT\t1966 Mar 15 2:00\n\t\t\t-4:00\tStJohns\tA%sT\t2011 Nov\n\t\t\t-4:00\tCanada\tA%sT\nRule\tHalifax\t1916\tonly\t-\tApr\t 1\t0:00\t1:00\tD\nRule\tHalifax\t1916\tonly\t-\tOct\t 1\t0:00\t0\tS\nRule\tHalifax\t1920\tonly\t-\tMay\t 9\t0:00\t1:00\tD\nRule\tHalifax\t1920\tonly\t-\tAug\t29\t0:00\t0\tS\nRule\tHalifax\t1921\tonly\t-\tMay\t 6\t0:00\t1:00\tD\nRule\tHalifax\t1921\t1922\t-\tSep\t 5\t0:00\t0\tS\nRule\tHalifax\t1922\tonly\t-\tApr\t30\t0:00\t1:00\tD\nRule\tHalifax\t1923\t1925\t-\tMay\tSun>=1\t0:00\t1:00\tD\nRule\tHalifax\t1923\tonly\t-\tSep\t 4\t0:00\t0\tS\nRule\tHalifax\t1924\tonly\t-\tSep\t15\t0:00\t0\tS\nRule\tHalifax\t1925\tonly\t-\tSep\t28\t0:00\t0\tS\nRule\tHalifax\t1926\tonly\t-\tMay\t16\t0:00\t1:00\tD\nRule\tHalifax\t1926\tonly\t-\tSep\t13\t0:00\t0\tS\nRule\tHalifax\t1927\tonly\t-\tMay\t 1\t0:00\t1:00\tD\nRule\tHalifax\t1927\tonly\t-\tSep\t26\t0:00\t0\tS\nRule\tHalifax\t1928\t1931\t-\tMay\tSun>=8\t0:00\t1:00\tD\nRule\tHalifax\t1928\tonly\t-\tSep\t 9\t0:00\t0\tS\nRule\tHalifax\t1929\tonly\t-\tSep\t 3\t0:00\t0\tS\nRule\tHalifax\t1930\tonly\t-\tSep\t15\t0:00\t0\tS\nRule\tHalifax\t1931\t1932\t-\tSep\tMon>=24\t0:00\t0\tS\nRule\tHalifax\t1932\tonly\t-\tMay\t 1\t0:00\t1:00\tD\nRule\tHalifax\t1933\tonly\t-\tApr\t30\t0:00\t1:00\tD\nRule\tHalifax\t1933\tonly\t-\tOct\t 2\t0:00\t0\tS\nRule\tHalifax\t1934\tonly\t-\tMay\t20\t0:00\t1:00\tD\nRule\tHalifax\t1934\tonly\t-\tSep\t16\t0:00\t0\tS\nRule\tHalifax\t1935\tonly\t-\tJun\t 2\t0:00\t1:00\tD\nRule\tHalifax\t1935\tonly\t-\tSep\t30\t0:00\t0\tS\nRule\tHalifax\t1936\tonly\t-\tJun\t 1\t0:00\t1:00\tD\nRule\tHalifax\t1936\tonly\t-\tSep\t14\t0:00\t0\tS\nRule\tHalifax\t1937\t1938\t-\tMay\tSun>=1\t0:00\t1:00\tD\nRule\tHalifax\t1937\t1941\t-\tSep\tMon>=24\t0:00\t0\tS\nRule\tHalifax\t1939\tonly\t-\tMay\t28\t0:00\t1:00\tD\nRule\tHalifax\t1940\t1941\t-\tMay\tSun>=1\t0:00\t1:00\tD\nRule\tHalifax\t1946\t1949\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tHalifax\t1946\t1949\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tHalifax\t1951\t1954\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tHalifax\t1951\t1954\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tHalifax\t1956\t1959\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tHalifax\t1956\t1959\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tHalifax\t1962\t1973\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tHalifax\t1962\t1973\t-\tOct\tlastSun\t2:00\t0\tS\nZone America/Halifax\t-4:14:24 -\tLMT\t1902 Jun 15\n\t\t\t-4:00\tHalifax\tA%sT\t1918\n\t\t\t-4:00\tCanada\tA%sT\t1919\n\t\t\t-4:00\tHalifax\tA%sT\t1942 Feb  9 2:00s\n\t\t\t-4:00\tCanada\tA%sT\t1946\n\t\t\t-4:00\tHalifax\tA%sT\t1974\n\t\t\t-4:00\tCanada\tA%sT\nZone America/Glace_Bay\t-3:59:48 -\tLMT\t1902 Jun 15\n\t\t\t-4:00\tCanada\tA%sT\t1953\n\t\t\t-4:00\tHalifax\tA%sT\t1954\n\t\t\t-4:00\t-\tAST\t1972\n\t\t\t-4:00\tHalifax\tA%sT\t1974\n\t\t\t-4:00\tCanada\tA%sT\nRule\tMoncton\t1933\t1935\t-\tJun\tSun>=8\t1:00\t1:00\tD\nRule\tMoncton\t1933\t1935\t-\tSep\tSun>=8\t1:00\t0\tS\nRule\tMoncton\t1936\t1938\t-\tJun\tSun>=1\t1:00\t1:00\tD\nRule\tMoncton\t1936\t1938\t-\tSep\tSun>=1\t1:00\t0\tS\nRule\tMoncton\t1939\tonly\t-\tMay\t27\t1:00\t1:00\tD\nRule\tMoncton\t1939\t1941\t-\tSep\tSat>=21\t1:00\t0\tS\nRule\tMoncton\t1940\tonly\t-\tMay\t19\t1:00\t1:00\tD\nRule\tMoncton\t1941\tonly\t-\tMay\t 4\t1:00\t1:00\tD\nRule\tMoncton\t1946\t1972\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tMoncton\t1946\t1956\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tMoncton\t1957\t1972\t-\tOct\tlastSun\t2:00\t0\tS\nRule\tMoncton\t1993\t2006\t-\tApr\tSun>=1\t0:01\t1:00\tD\nRule\tMoncton\t1993\t2006\t-\tOct\tlastSun\t0:01\t0\tS\nZone America/Moncton\t-4:19:08 -\tLMT\t1883 Dec  9\n\t\t\t-5:00\t-\tEST\t1902 Jun 15\n\t\t\t-4:00\tCanada\tA%sT\t1933\n\t\t\t-4:00\tMoncton\tA%sT\t1942\n\t\t\t-4:00\tCanada\tA%sT\t1946\n\t\t\t-4:00\tMoncton\tA%sT\t1973\n\t\t\t-4:00\tCanada\tA%sT\t1993\n\t\t\t-4:00\tMoncton\tA%sT\t2007\n\t\t\t-4:00\tCanada\tA%sT\nRule\tMont\t1917\tonly\t-\tMar\t25\t2:00\t1:00\tD\nRule\tMont\t1917\tonly\t-\tApr\t24\t0:00\t0\tS\nRule\tMont\t1919\tonly\t-\tMar\t31\t2:30\t1:00\tD\nRule\tMont\t1919\tonly\t-\tOct\t25\t2:30\t0\tS\nRule\tMont\t1920\tonly\t-\tMay\t 2\t2:30\t1:00\tD\nRule\tMont\t1920\t1922\t-\tOct\tSun>=1\t2:30\t0\tS\nRule\tMont\t1921\tonly\t-\tMay\t 1\t2:00\t1:00\tD\nRule\tMont\t1922\tonly\t-\tApr\t30\t2:00\t1:00\tD\nRule\tMont\t1924\tonly\t-\tMay\t17\t2:00\t1:00\tD\nRule\tMont\t1924\t1926\t-\tSep\tlastSun\t2:30\t0\tS\nRule\tMont\t1925\t1926\t-\tMay\tSun>=1\t2:00\t1:00\tD\nRule\tMont\t1927\tonly\t-\tMay\t1\t0:00\t1:00\tD\nRule\tMont\t1927\t1932\t-\tSep\tlastSun\t0:00\t0\tS\nRule\tMont\t1928\t1931\t-\tApr\tlastSun\t0:00\t1:00\tD\nRule\tMont\t1932\tonly\t-\tMay\t1\t0:00\t1:00\tD\nRule\tMont\t1933\t1940\t-\tApr\tlastSun\t0:00\t1:00\tD\nRule\tMont\t1933\tonly\t-\tOct\t1\t0:00\t0\tS\nRule\tMont\t1934\t1939\t-\tSep\tlastSun\t0:00\t0\tS\nRule\tMont\t1946\t1973\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tMont\t1945\t1948\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tMont\t1949\t1950\t-\tOct\tlastSun\t2:00\t0\tS\nRule\tMont\t1951\t1956\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tMont\t1957\t1973\t-\tOct\tlastSun\t2:00\t0\tS\nZone America/Blanc-Sablon -3:48:28 -\tLMT\t1884\n\t\t\t-4:00\tCanada\tA%sT\t1970\n\t\t\t-4:00\t-\tAST\nZone America/Montreal\t-4:54:16 -\tLMT\t1884\n\t\t\t-5:00\tMont\tE%sT\t1918\n\t\t\t-5:00\tCanada\tE%sT\t1919\n\t\t\t-5:00\tMont\tE%sT\t1942 Feb  9 2:00s\n\t\t\t-5:00\tCanada\tE%sT\t1946\n\t\t\t-5:00\tMont\tE%sT\t1974\n\t\t\t-5:00\tCanada\tE%sT\nRule\tToronto\t1919\tonly\t-\tMar\t30\t23:30\t1:00\tD\nRule\tToronto\t1919\tonly\t-\tOct\t26\t0:00\t0\tS\nRule\tToronto\t1920\tonly\t-\tMay\t 2\t2:00\t1:00\tD\nRule\tToronto\t1920\tonly\t-\tSep\t26\t0:00\t0\tS\nRule\tToronto\t1921\tonly\t-\tMay\t15\t2:00\t1:00\tD\nRule\tToronto\t1921\tonly\t-\tSep\t15\t2:00\t0\tS\nRule\tToronto\t1922\t1923\t-\tMay\tSun>=8\t2:00\t1:00\tD\nRule\tToronto\t1922\t1926\t-\tSep\tSun>=15\t2:00\t0\tS\nRule\tToronto\t1924\t1927\t-\tMay\tSun>=1\t2:00\t1:00\tD\nRule\tToronto\t1927\t1932\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tToronto\t1928\t1931\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tToronto\t1932\tonly\t-\tMay\t1\t2:00\t1:00\tD\nRule\tToronto\t1933\t1940\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tToronto\t1933\tonly\t-\tOct\t1\t2:00\t0\tS\nRule\tToronto\t1934\t1939\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tToronto\t1945\t1946\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tToronto\t1946\tonly\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tToronto\t1947\t1949\t-\tApr\tlastSun\t0:00\t1:00\tD\nRule\tToronto\t1947\t1948\t-\tSep\tlastSun\t0:00\t0\tS\nRule\tToronto\t1949\tonly\t-\tNov\tlastSun\t0:00\t0\tS\nRule\tToronto\t1950\t1973\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tToronto\t1950\tonly\t-\tNov\tlastSun\t2:00\t0\tS\nRule\tToronto\t1951\t1956\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tToronto\t1957\t1973\t-\tOct\tlastSun\t2:00\t0\tS\nZone America/Toronto\t-5:17:32 -\tLMT\t1895\n\t\t\t-5:00\tCanada\tE%sT\t1919\n\t\t\t-5:00\tToronto\tE%sT\t1942 Feb  9 2:00s\n\t\t\t-5:00\tCanada\tE%sT\t1946\n\t\t\t-5:00\tToronto\tE%sT\t1974\n\t\t\t-5:00\tCanada\tE%sT\nZone America/Thunder_Bay -5:57:00 -\tLMT\t1895\n\t\t\t-6:00\t-\tCST\t1910\n\t\t\t-5:00\t-\tEST\t1942\n\t\t\t-5:00\tCanada\tE%sT\t1970\n\t\t\t-5:00\tMont\tE%sT\t1973\n\t\t\t-5:00\t-\tEST\t1974\n\t\t\t-5:00\tCanada\tE%sT\nZone America/Nipigon\t-5:53:04 -\tLMT\t1895\n\t\t\t-5:00\tCanada\tE%sT\t1940 Sep 29\n\t\t\t-5:00\t1:00\tEDT\t1942 Feb  9 2:00s\n\t\t\t-5:00\tCanada\tE%sT\nZone America/Rainy_River -6:18:16 -\tLMT\t1895\n\t\t\t-6:00\tCanada\tC%sT\t1940 Sep 29\n\t\t\t-6:00\t1:00\tCDT\t1942 Feb  9 2:00s\n\t\t\t-6:00\tCanada\tC%sT\nZone America/Atikokan\t-6:06:28 -\tLMT\t1895\n\t\t\t-6:00\tCanada\tC%sT\t1940 Sep 29\n\t\t\t-6:00\t1:00\tCDT\t1942 Feb  9 2:00s\n\t\t\t-6:00\tCanada\tC%sT\t1945 Sep 30 2:00\n\t\t\t-5:00\t-\tEST\nRule\tWinn\t1916\tonly\t-\tApr\t23\t0:00\t1:00\tD\nRule\tWinn\t1916\tonly\t-\tSep\t17\t0:00\t0\tS\nRule\tWinn\t1918\tonly\t-\tApr\t14\t2:00\t1:00\tD\nRule\tWinn\t1918\tonly\t-\tOct\t31\t2:00\t0\tS\nRule\tWinn\t1937\tonly\t-\tMay\t16\t2:00\t1:00\tD\nRule\tWinn\t1937\tonly\t-\tSep\t26\t2:00\t0\tS\nRule\tWinn\t1942\tonly\t-\tFeb\t 9\t2:00\t1:00\tW # War\nRule\tWinn\t1945\tonly\t-\tAug\t14\t23:00u\t1:00\tP # Peace\nRule\tWinn\t1945\tonly\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tWinn\t1946\tonly\t-\tMay\t12\t2:00\t1:00\tD\nRule\tWinn\t1946\tonly\t-\tOct\t13\t2:00\t0\tS\nRule\tWinn\t1947\t1949\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tWinn\t1947\t1949\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tWinn\t1950\tonly\t-\tMay\t 1\t2:00\t1:00\tD\nRule\tWinn\t1950\tonly\t-\tSep\t30\t2:00\t0\tS\nRule\tWinn\t1951\t1960\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tWinn\t1951\t1958\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tWinn\t1959\tonly\t-\tOct\tlastSun\t2:00\t0\tS\nRule\tWinn\t1960\tonly\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tWinn\t1963\tonly\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tWinn\t1963\tonly\t-\tSep\t22\t2:00\t0\tS\nRule\tWinn\t1966\t1986\t-\tApr\tlastSun\t2:00s\t1:00\tD\nRule\tWinn\t1966\t2005\t-\tOct\tlastSun\t2:00s\t0\tS\nRule\tWinn\t1987\t2005\t-\tApr\tSun>=1\t2:00s\t1:00\tD\nZone America/Winnipeg\t-6:28:36 -\tLMT\t1887 Jul 16\n\t\t\t-6:00\tWinn\tC%sT\t2006\n\t\t\t-6:00\tCanada\tC%sT\nRule\tRegina\t1918\tonly\t-\tApr\t14\t2:00\t1:00\tD\nRule\tRegina\t1918\tonly\t-\tOct\t31\t2:00\t0\tS\nRule\tRegina\t1930\t1934\t-\tMay\tSun>=1\t0:00\t1:00\tD\nRule\tRegina\t1930\t1934\t-\tOct\tSun>=1\t0:00\t0\tS\nRule\tRegina\t1937\t1941\t-\tApr\tSun>=8\t0:00\t1:00\tD\nRule\tRegina\t1937\tonly\t-\tOct\tSun>=8\t0:00\t0\tS\nRule\tRegina\t1938\tonly\t-\tOct\tSun>=1\t0:00\t0\tS\nRule\tRegina\t1939\t1941\t-\tOct\tSun>=8\t0:00\t0\tS\nRule\tRegina\t1942\tonly\t-\tFeb\t 9\t2:00\t1:00\tW # War\nRule\tRegina\t1945\tonly\t-\tAug\t14\t23:00u\t1:00\tP # Peace\nRule\tRegina\t1945\tonly\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tRegina\t1946\tonly\t-\tApr\tSun>=8\t2:00\t1:00\tD\nRule\tRegina\t1946\tonly\t-\tOct\tSun>=8\t2:00\t0\tS\nRule\tRegina\t1947\t1957\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tRegina\t1947\t1957\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tRegina\t1959\tonly\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tRegina\t1959\tonly\t-\tOct\tlastSun\t2:00\t0\tS\nRule\tSwift\t1957\tonly\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tSwift\t1957\tonly\t-\tOct\tlastSun\t2:00\t0\tS\nRule\tSwift\t1959\t1961\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tSwift\t1959\tonly\t-\tOct\tlastSun\t2:00\t0\tS\nRule\tSwift\t1960\t1961\t-\tSep\tlastSun\t2:00\t0\tS\nZone America/Regina\t-6:58:36 -\tLMT\t1905 Sep\n\t\t\t-7:00\tRegina\tM%sT\t1960 Apr lastSun 2:00\n\t\t\t-6:00\t-\tCST\nZone America/Swift_Current -7:11:20 -\tLMT\t1905 Sep\n\t\t\t-7:00\tCanada\tM%sT\t1946 Apr lastSun 2:00\n\t\t\t-7:00\tRegina\tM%sT\t1950\n\t\t\t-7:00\tSwift\tM%sT\t1972 Apr lastSun 2:00\n\t\t\t-6:00\t-\tCST\nRule\tEdm\t1918\t1919\t-\tApr\tSun>=8\t2:00\t1:00\tD\nRule\tEdm\t1918\tonly\t-\tOct\t31\t2:00\t0\tS\nRule\tEdm\t1919\tonly\t-\tMay\t27\t2:00\t0\tS\nRule\tEdm\t1920\t1923\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tEdm\t1920\tonly\t-\tOct\tlastSun\t2:00\t0\tS\nRule\tEdm\t1921\t1923\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tEdm\t1942\tonly\t-\tFeb\t 9\t2:00\t1:00\tW # War\nRule\tEdm\t1945\tonly\t-\tAug\t14\t23:00u\t1:00\tP # Peace\nRule\tEdm\t1945\tonly\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tEdm\t1947\tonly\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tEdm\t1947\tonly\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tEdm\t1967\tonly\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tEdm\t1967\tonly\t-\tOct\tlastSun\t2:00\t0\tS\nRule\tEdm\t1969\tonly\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tEdm\t1969\tonly\t-\tOct\tlastSun\t2:00\t0\tS\nRule\tEdm\t1972\t1986\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tEdm\t1972\t2006\t-\tOct\tlastSun\t2:00\t0\tS\nZone America/Edmonton\t-7:33:52 -\tLMT\t1906 Sep\n\t\t\t-7:00\tEdm\tM%sT\t1987\n\t\t\t-7:00\tCanada\tM%sT\nRule\tVanc\t1918\tonly\t-\tApr\t14\t2:00\t1:00\tD\nRule\tVanc\t1918\tonly\t-\tOct\t31\t2:00\t0\tS\nRule\tVanc\t1942\tonly\t-\tFeb\t 9\t2:00\t1:00\tW # War\nRule\tVanc\t1945\tonly\t-\tAug\t14\t23:00u\t1:00\tP # Peace\nRule\tVanc\t1945\tonly\t-\tSep\t30\t2:00\t0\tS\nRule\tVanc\t1946\t1986\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tVanc\t1946\tonly\t-\tOct\t13\t2:00\t0\tS\nRule\tVanc\t1947\t1961\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tVanc\t1962\t2006\t-\tOct\tlastSun\t2:00\t0\tS\nZone America/Vancouver\t-8:12:28 -\tLMT\t1884\n\t\t\t-8:00\tVanc\tP%sT\t1987\n\t\t\t-8:00\tCanada\tP%sT\nZone America/Dawson_Creek -8:00:56 -\tLMT\t1884\n\t\t\t-8:00\tCanada\tP%sT\t1947\n\t\t\t-8:00\tVanc\tP%sT\t1972 Aug 30 2:00\n\t\t\t-7:00\t-\tMST\nRule\tNT_YK\t1918\tonly\t-\tApr\t14\t2:00\t1:00\tD\nRule\tNT_YK\t1918\tonly\t-\tOct\t27\t2:00\t0\tS\nRule\tNT_YK\t1919\tonly\t-\tMay\t25\t2:00\t1:00\tD\nRule\tNT_YK\t1919\tonly\t-\tNov\t 1\t0:00\t0\tS\nRule\tNT_YK\t1942\tonly\t-\tFeb\t 9\t2:00\t1:00\tW # War\nRule\tNT_YK\t1945\tonly\t-\tAug\t14\t23:00u\t1:00\tP # Peace\nRule\tNT_YK\t1945\tonly\t-\tSep\t30\t2:00\t0\tS\nRule\tNT_YK\t1965\tonly\t-\tApr\tlastSun\t0:00\t2:00\tDD\nRule\tNT_YK\t1965\tonly\t-\tOct\tlastSun\t2:00\t0\tS\nRule\tNT_YK\t1980\t1986\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tNT_YK\t1980\t2006\t-\tOct\tlastSun\t2:00\t0\tS\nRule\tNT_YK\t1987\t2006\t-\tApr\tSun>=1\t2:00\t1:00\tD\nZone America/Pangnirtung 0\t-\tzzz\t1921 # trading post est.\n\t\t\t-4:00\tNT_YK\tA%sT\t1995 Apr Sun>=1 2:00\n\t\t\t-5:00\tCanada\tE%sT\t1999 Oct 31 2:00\n\t\t\t-6:00\tCanada\tC%sT\t2000 Oct 29 2:00\n\t\t\t-5:00\tCanada\tE%sT\nZone America/Iqaluit\t0\t-\tzzz\t1942 Aug # Frobisher Bay est.\n\t\t\t-5:00\tNT_YK\tE%sT\t1999 Oct 31 2:00\n\t\t\t-6:00\tCanada\tC%sT\t2000 Oct 29 2:00\n\t\t\t-5:00\tCanada\tE%sT\nZone America/Resolute\t0\t-\tzzz\t1947 Aug 31 # Resolute founded\n\t\t\t-6:00\tNT_YK\tC%sT\t2000 Oct 29 2:00\n\t\t\t-5:00\t-\tEST\t2001 Apr  1 3:00\n\t\t\t-6:00\tCanada\tC%sT\t2006 Oct 29 2:00\n\t\t\t-5:00\t-\tEST\t2007 Mar 11 3:00\n\t\t\t-6:00\tCanada\tC%sT\nZone America/Rankin_Inlet 0\t-\tzzz\t1957 # Rankin Inlet founded\n\t\t\t-6:00\tNT_YK\tC%sT\t2000 Oct 29 2:00\n\t\t\t-5:00\t-\tEST\t2001 Apr  1 3:00\n\t\t\t-6:00\tCanada\tC%sT\nZone America/Cambridge_Bay 0\t-\tzzz\t1920 # trading post est.?\n\t\t\t-7:00\tNT_YK\tM%sT\t1999 Oct 31 2:00\n\t\t\t-6:00\tCanada\tC%sT\t2000 Oct 29 2:00\n\t\t\t-5:00\t-\tEST\t2000 Nov  5 0:00\n\t\t\t-6:00\t-\tCST\t2001 Apr  1 3:00\n\t\t\t-7:00\tCanada\tM%sT\nZone America/Yellowknife 0\t-\tzzz\t1935 # Yellowknife founded?\n\t\t\t-7:00\tNT_YK\tM%sT\t1980\n\t\t\t-7:00\tCanada\tM%sT\nZone America/Inuvik\t0\t-\tzzz\t1953 # Inuvik founded\n\t\t\t-8:00\tNT_YK\tP%sT\t1979 Apr lastSun 2:00\n\t\t\t-7:00\tNT_YK\tM%sT\t1980\n\t\t\t-7:00\tCanada\tM%sT\nZone America/Whitehorse\t-9:00:12 -\tLMT\t1900 Aug 20\n\t\t\t-9:00\tNT_YK\tY%sT\t1966 Jul 1 2:00\n\t\t\t-8:00\tNT_YK\tP%sT\t1980\n\t\t\t-8:00\tCanada\tP%sT\nZone America/Dawson\t-9:17:40 -\tLMT\t1900 Aug 20\n\t\t\t-9:00\tNT_YK\tY%sT\t1973 Oct 28 0:00\n\t\t\t-8:00\tNT_YK\tP%sT\t1980\n\t\t\t-8:00\tCanada\tP%sT\nRule\tMexico\t1939\tonly\t-\tFeb\t5\t0:00\t1:00\tD\nRule\tMexico\t1939\tonly\t-\tJun\t25\t0:00\t0\tS\nRule\tMexico\t1940\tonly\t-\tDec\t9\t0:00\t1:00\tD\nRule\tMexico\t1941\tonly\t-\tApr\t1\t0:00\t0\tS\nRule\tMexico\t1943\tonly\t-\tDec\t16\t0:00\t1:00\tW # War\nRule\tMexico\t1944\tonly\t-\tMay\t1\t0:00\t0\tS\nRule\tMexico\t1950\tonly\t-\tFeb\t12\t0:00\t1:00\tD\nRule\tMexico\t1950\tonly\t-\tJul\t30\t0:00\t0\tS\nRule\tMexico\t1996\t2000\t-\tApr\tSun>=1\t2:00\t1:00\tD\nRule\tMexico\t1996\t2000\t-\tOct\tlastSun\t2:00\t0\tS\nRule\tMexico\t2001\tonly\t-\tMay\tSun>=1\t2:00\t1:00\tD\nRule\tMexico\t2001\tonly\t-\tSep\tlastSun\t2:00\t0\tS\nRule\tMexico\t2002\tmax\t-\tApr\tSun>=1\t2:00\t1:00\tD\nRule\tMexico\t2002\tmax\t-\tOct\tlastSun\t2:00\t0\tS\nZone America/Cancun\t-5:47:04 -\tLMT\t1922 Jan  1  0:12:56\n\t\t\t-6:00\t-\tCST\t1981 Dec 23\n\t\t\t-5:00\tMexico\tE%sT\t1998 Aug  2  2:00\n\t\t\t-6:00\tMexico\tC%sT\nZone America/Merida\t-5:58:28 -\tLMT\t1922 Jan  1  0:01:32\n\t\t\t-6:00\t-\tCST\t1981 Dec 23\n\t\t\t-5:00\t-\tEST\t1982 Dec  2\n\t\t\t-6:00\tMexico\tC%sT\nZone America/Matamoros\t-6:40:00 -\tLMT\t1921 Dec 31 23:20:00\n\t\t\t-6:00\t-\tCST\t1988\n\t\t\t-6:00\tUS\tC%sT\t1989\n\t\t\t-6:00\tMexico\tC%sT\t2010\n\t\t\t-6:00\tUS\tC%sT\nZone America/Monterrey\t-6:41:16 -\tLMT\t1921 Dec 31 23:18:44\n\t\t\t-6:00\t-\tCST\t1988\n\t\t\t-6:00\tUS\tC%sT\t1989\n\t\t\t-6:00\tMexico\tC%sT\nZone America/Mexico_City -6:36:36 -\tLMT\t1922 Jan  1 0:23:24\n\t\t\t-7:00\t-\tMST\t1927 Jun 10 23:00\n\t\t\t-6:00\t-\tCST\t1930 Nov 15\n\t\t\t-7:00\t-\tMST\t1931 May  1 23:00\n\t\t\t-6:00\t-\tCST\t1931 Oct\n\t\t\t-7:00\t-\tMST\t1932 Apr  1\n\t\t\t-6:00\tMexico\tC%sT\t2001 Sep 30 02:00\n\t\t\t-6:00\t-\tCST\t2002 Feb 20\n\t\t\t-6:00\tMexico\tC%sT\nZone America/Ojinaga\t-6:57:40 -\tLMT\t1922 Jan 1 0:02:20\n\t\t\t-7:00\t-\tMST\t1927 Jun 10 23:00\n\t\t\t-6:00\t-\tCST\t1930 Nov 15\n\t\t\t-7:00\t-\tMST\t1931 May  1 23:00\n\t\t\t-6:00\t-\tCST\t1931 Oct\n\t\t\t-7:00\t-\tMST\t1932 Apr  1\n\t\t\t-6:00\t-\tCST\t1996\n\t\t\t-6:00\tMexico\tC%sT\t1998\n\t\t\t-6:00\t-\tCST\t1998 Apr Sun>=1 3:00\n\t\t\t-7:00\tMexico\tM%sT\t2010\n\t\t\t-7:00\tUS\tM%sT\nZone America/Chihuahua\t-7:04:20 -\tLMT\t1921 Dec 31 23:55:40\n\t\t\t-7:00\t-\tMST\t1927 Jun 10 23:00\n\t\t\t-6:00\t-\tCST\t1930 Nov 15\n\t\t\t-7:00\t-\tMST\t1931 May  1 23:00\n\t\t\t-6:00\t-\tCST\t1931 Oct\n\t\t\t-7:00\t-\tMST\t1932 Apr  1\n\t\t\t-6:00\t-\tCST\t1996\n\t\t\t-6:00\tMexico\tC%sT\t1998\n\t\t\t-6:00\t-\tCST\t1998 Apr Sun>=1 3:00\n\t\t\t-7:00\tMexico\tM%sT\nZone America/Hermosillo\t-7:23:52 -\tLMT\t1921 Dec 31 23:36:08\n\t\t\t-7:00\t-\tMST\t1927 Jun 10 23:00\n\t\t\t-6:00\t-\tCST\t1930 Nov 15\n\t\t\t-7:00\t-\tMST\t1931 May  1 23:00\n\t\t\t-6:00\t-\tCST\t1931 Oct\n\t\t\t-7:00\t-\tMST\t1932 Apr  1\n\t\t\t-6:00\t-\tCST\t1942 Apr 24\n\t\t\t-7:00\t-\tMST\t1949 Jan 14\n\t\t\t-8:00\t-\tPST\t1970\n\t\t\t-7:00\tMexico\tM%sT\t1999\n\t\t\t-7:00\t-\tMST\nZone America/Mazatlan\t-7:05:40 -\tLMT\t1921 Dec 31 23:54:20\n\t\t\t-7:00\t-\tMST\t1927 Jun 10 23:00\n\t\t\t-6:00\t-\tCST\t1930 Nov 15\n\t\t\t-7:00\t-\tMST\t1931 May  1 23:00\n\t\t\t-6:00\t-\tCST\t1931 Oct\n\t\t\t-7:00\t-\tMST\t1932 Apr  1\n\t\t\t-6:00\t-\tCST\t1942 Apr 24\n\t\t\t-7:00\t-\tMST\t1949 Jan 14\n\t\t\t-8:00\t-\tPST\t1970\n\t\t\t-7:00\tMexico\tM%sT\nZone America/Bahia_Banderas\t-7:01:00 -\tLMT\t1921 Dec 31 23:59:00\n\t\t\t-7:00\t-\tMST\t1927 Jun 10 23:00\n\t\t\t-6:00\t-\tCST\t1930 Nov 15\n\t\t\t-7:00\t-\tMST\t1931 May  1 23:00\n\t\t\t-6:00\t-\tCST\t1931 Oct\n\t\t\t-7:00\t-\tMST\t1932 Apr  1\n\t\t\t-6:00\t-\tCST\t1942 Apr 24\n\t\t\t-7:00\t-\tMST\t1949 Jan 14\n\t\t\t-8:00\t-\tPST\t1970\n\t\t\t-7:00\tMexico\tM%sT\t2010 Apr 4 2:00\n\t\t\t-6:00\tMexico\tC%sT\nZone America/Tijuana\t-7:48:04 -\tLMT\t1922 Jan  1  0:11:56\n\t\t\t-7:00\t-\tMST\t1924\n\t\t\t-8:00\t-\tPST\t1927 Jun 10 23:00\n\t\t\t-7:00\t-\tMST\t1930 Nov 15\n\t\t\t-8:00\t-\tPST\t1931 Apr  1\n\t\t\t-8:00\t1:00\tPDT\t1931 Sep 30\n\t\t\t-8:00\t-\tPST\t1942 Apr 24\n\t\t\t-8:00\t1:00\tPWT\t1945 Aug 14 23:00u\n\t\t\t-8:00\t1:00\tPPT\t1945 Nov 12 # Peace\n\t\t\t-8:00\t-\tPST\t1948 Apr  5\n\t\t\t-8:00\t1:00\tPDT\t1949 Jan 14\n\t\t\t-8:00\t-\tPST\t1954\n\t\t\t-8:00\tCA\tP%sT\t1961\n\t\t\t-8:00\t-\tPST\t1976\n\t\t\t-8:00\tUS\tP%sT\t1996\n\t\t\t-8:00\tMexico\tP%sT\t2001\n\t\t\t-8:00\tUS\tP%sT\t2002 Feb 20\n\t\t\t-8:00\tMexico\tP%sT\t2010\n\t\t\t-8:00\tUS\tP%sT\nZone America/Santa_Isabel\t-7:39:28 -\tLMT\t1922 Jan  1  0:20:32\n\t\t\t-7:00\t-\tMST\t1924\n\t\t\t-8:00\t-\tPST\t1927 Jun 10 23:00\n\t\t\t-7:00\t-\tMST\t1930 Nov 15\n\t\t\t-8:00\t-\tPST\t1931 Apr  1\n\t\t\t-8:00\t1:00\tPDT\t1931 Sep 30\n\t\t\t-8:00\t-\tPST\t1942 Apr 24\n\t\t\t-8:00\t1:00\tPWT\t1945 Aug 14 23:00u\n\t\t\t-8:00\t1:00\tPPT\t1945 Nov 12 # Peace\n\t\t\t-8:00\t-\tPST\t1948 Apr  5\n\t\t\t-8:00\t1:00\tPDT\t1949 Jan 14\n\t\t\t-8:00\t-\tPST\t1954\n\t\t\t-8:00\tCA\tP%sT\t1961\n\t\t\t-8:00\t-\tPST\t1976\n\t\t\t-8:00\tUS\tP%sT\t1996\n\t\t\t-8:00\tMexico\tP%sT\t2001\n\t\t\t-8:00\tUS\tP%sT\t2002 Feb 20\n\t\t\t-8:00\tMexico\tP%sT\nZone America/Anguilla\t-4:12:16 -\tLMT\t1912 Mar 2\n\t\t\t-4:00\t-\tAST\nZone\tAmerica/Antigua\t-4:07:12 -\tLMT\t1912 Mar 2\n\t\t\t-5:00\t-\tEST\t1951\n\t\t\t-4:00\t-\tAST\nRule\tBahamas\t1964\t1975\t-\tOct\tlastSun\t2:00\t0\tS\nRule\tBahamas\t1964\t1975\t-\tApr\tlastSun\t2:00\t1:00\tD\nZone\tAmerica/Nassau\t-5:09:24 -\tLMT\t1912 Mar 2\n\t\t\t-5:00\tBahamas\tE%sT\t1976\n\t\t\t-5:00\tUS\tE%sT\nRule\tBarb\t1977\tonly\t-\tJun\t12\t2:00\t1:00\tD\nRule\tBarb\t1977\t1978\t-\tOct\tSun>=1\t2:00\t0\tS\nRule\tBarb\t1978\t1980\t-\tApr\tSun>=15\t2:00\t1:00\tD\nRule\tBarb\t1979\tonly\t-\tSep\t30\t2:00\t0\tS\nRule\tBarb\t1980\tonly\t-\tSep\t25\t2:00\t0\tS\nZone America/Barbados\t-3:58:28 -\tLMT\t1924\t\t# Bridgetown\n\t\t\t-3:58:28 -\tBMT\t1932\t  # Bridgetown Mean Time\n\t\t\t-4:00\tBarb\tA%sT\nRule\tBelize\t1918\t1942\t-\tOct\tSun>=2\t0:00\t0:30\tHD\nRule\tBelize\t1919\t1943\t-\tFeb\tSun>=9\t0:00\t0\tS\nRule\tBelize\t1973\tonly\t-\tDec\t 5\t0:00\t1:00\tD\nRule\tBelize\t1974\tonly\t-\tFeb\t 9\t0:00\t0\tS\nRule\tBelize\t1982\tonly\t-\tDec\t18\t0:00\t1:00\tD\nRule\tBelize\t1983\tonly\t-\tFeb\t12\t0:00\t0\tS\nZone\tAmerica/Belize\t-5:52:48 -\tLMT\t1912 Apr\n\t\t\t-6:00\tBelize\tC%sT\nZone Atlantic/Bermuda\t-4:19:04 -\tLMT\t1930 Jan  1 2:00    # Hamilton\n\t\t\t-4:00\t-\tAST\t1974 Apr 28 2:00\n\t\t\t-4:00\tBahamas\tA%sT\t1976\n\t\t\t-4:00\tUS\tA%sT\nZone\tAmerica/Cayman\t-5:25:32 -\tLMT\t1890\t\t# Georgetown\n\t\t\t-5:07:12 -\tKMT\t1912 Feb    # Kingston Mean Time\n\t\t\t-5:00\t-\tEST\nRule\tCR\t1979\t1980\t-\tFeb\tlastSun\t0:00\t1:00\tD\nRule\tCR\t1979\t1980\t-\tJun\tSun>=1\t0:00\t0\tS\nRule\tCR\t1991\t1992\t-\tJan\tSat>=15\t0:00\t1:00\tD\nRule\tCR\t1991\tonly\t-\tJul\t 1\t0:00\t0\tS\nRule\tCR\t1992\tonly\t-\tMar\t15\t0:00\t0\tS\nZone America/Costa_Rica\t-5:36:20 -\tLMT\t1890\t\t# San Jose\n\t\t\t-5:36:20 -\tSJMT\t1921 Jan 15 # San Jose Mean Time\n\t\t\t-6:00\tCR\tC%sT\nRule\tCuba\t1928\tonly\t-\tJun\t10\t0:00\t1:00\tD\nRule\tCuba\t1928\tonly\t-\tOct\t10\t0:00\t0\tS\nRule\tCuba\t1940\t1942\t-\tJun\tSun>=1\t0:00\t1:00\tD\nRule\tCuba\t1940\t1942\t-\tSep\tSun>=1\t0:00\t0\tS\nRule\tCuba\t1945\t1946\t-\tJun\tSun>=1\t0:00\t1:00\tD\nRule\tCuba\t1945\t1946\t-\tSep\tSun>=1\t0:00\t0\tS\nRule\tCuba\t1965\tonly\t-\tJun\t1\t0:00\t1:00\tD\nRule\tCuba\t1965\tonly\t-\tSep\t30\t0:00\t0\tS\nRule\tCuba\t1966\tonly\t-\tMay\t29\t0:00\t1:00\tD\nRule\tCuba\t1966\tonly\t-\tOct\t2\t0:00\t0\tS\nRule\tCuba\t1967\tonly\t-\tApr\t8\t0:00\t1:00\tD\nRule\tCuba\t1967\t1968\t-\tSep\tSun>=8\t0:00\t0\tS\nRule\tCuba\t1968\tonly\t-\tApr\t14\t0:00\t1:00\tD\nRule\tCuba\t1969\t1977\t-\tApr\tlastSun\t0:00\t1:00\tD\nRule\tCuba\t1969\t1971\t-\tOct\tlastSun\t0:00\t0\tS\nRule\tCuba\t1972\t1974\t-\tOct\t8\t0:00\t0\tS\nRule\tCuba\t1975\t1977\t-\tOct\tlastSun\t0:00\t0\tS\nRule\tCuba\t1978\tonly\t-\tMay\t7\t0:00\t1:00\tD\nRule\tCuba\t1978\t1990\t-\tOct\tSun>=8\t0:00\t0\tS\nRule\tCuba\t1979\t1980\t-\tMar\tSun>=15\t0:00\t1:00\tD\nRule\tCuba\t1981\t1985\t-\tMay\tSun>=5\t0:00\t1:00\tD\nRule\tCuba\t1986\t1989\t-\tMar\tSun>=14\t0:00\t1:00\tD\nRule\tCuba\t1990\t1997\t-\tApr\tSun>=1\t0:00\t1:00\tD\nRule\tCuba\t1991\t1995\t-\tOct\tSun>=8\t0:00s\t0\tS\nRule\tCuba\t1996\tonly\t-\tOct\t 6\t0:00s\t0\tS\nRule\tCuba\t1997\tonly\t-\tOct\t12\t0:00s\t0\tS\nRule\tCuba\t1998\t1999\t-\tMar\tlastSun\t0:00s\t1:00\tD\nRule\tCuba\t1998\t2003\t-\tOct\tlastSun\t0:00s\t0\tS\nRule\tCuba\t2000\t2004\t-\tApr\tSun>=1\t0:00s\t1:00\tD\nRule\tCuba\t2006\t2010\t-\tOct\tlastSun\t0:00s\t0\tS\nRule\tCuba\t2007\tonly\t-\tMar\tSun>=8\t0:00s\t1:00\tD\nRule\tCuba\t2008\tonly\t-\tMar\tSun>=15\t0:00s\t1:00\tD\nRule\tCuba\t2009\t2010\t-\tMar\tSun>=8\t0:00s\t1:00\tD\nRule\tCuba\t2011\tonly\t-\tMar\tSun>=15\t0:00s\t1:00\tD\nRule\tCuba\t2011\tonly\t-\tNov\t13\t0:00s\t0\tS\nRule\tCuba\t2012\tmax\t-\tMar\tSun>=8\t0:00s\t1:00\tD\nRule\tCuba\t2012\tmax\t-\tOct\tlastSun\t0:00s\t0\tS\nZone\tAmerica/Havana\t-5:29:28 -\tLMT\t1890\n\t\t\t-5:29:36 -\tHMT\t1925 Jul 19 12:00 # Havana MT\n\t\t\t-5:00\tCuba\tC%sT\nZone America/Dominica\t-4:05:36 -\tLMT\t1911 Jul 1 0:01\t\t# Roseau\n\t\t\t-4:00\t-\tAST\nRule\tDR\t1966\tonly\t-\tOct\t30\t0:00\t1:00\tD\nRule\tDR\t1967\tonly\t-\tFeb\t28\t0:00\t0\tS\nRule\tDR\t1969\t1973\t-\tOct\tlastSun\t0:00\t0:30\tHD\nRule\tDR\t1970\tonly\t-\tFeb\t21\t0:00\t0\tS\nRule\tDR\t1971\tonly\t-\tJan\t20\t0:00\t0\tS\nRule\tDR\t1972\t1974\t-\tJan\t21\t0:00\t0\tS\nZone America/Santo_Domingo -4:39:36 -\tLMT\t1890\n\t\t\t-4:40\t-\tSDMT\t1933 Apr  1 12:00 # S. Dom. MT\n\t\t\t-5:00\tDR\tE%sT\t1974 Oct 27\n\t\t\t-4:00\t-\tAST\t2000 Oct 29 02:00\n\t\t\t-5:00\tUS\tE%sT\t2000 Dec  3 01:00\n\t\t\t-4:00\t-\tAST\nRule\tSalv\t1987\t1988\t-\tMay\tSun>=1\t0:00\t1:00\tD\nRule\tSalv\t1987\t1988\t-\tSep\tlastSun\t0:00\t0\tS\nZone America/El_Salvador -5:56:48 -\tLMT\t1921\t\t# San Salvador\n\t\t\t-6:00\tSalv\tC%sT\nZone\tAmerica/Grenada\t-4:07:00 -\tLMT\t1911 Jul\t# St George's\n\t\t\t-4:00\t-\tAST\nZone America/Guadeloupe\t-4:06:08 -\tLMT\t1911 Jun 8\t# Pointe a Pitre\n\t\t\t-4:00\t-\tAST\nLink America/Guadeloupe\tAmerica/St_Barthelemy\nLink America/Guadeloupe\tAmerica/Marigot\nRule\tGuat\t1973\tonly\t-\tNov\t25\t0:00\t1:00\tD\nRule\tGuat\t1974\tonly\t-\tFeb\t24\t0:00\t0\tS\nRule\tGuat\t1983\tonly\t-\tMay\t21\t0:00\t1:00\tD\nRule\tGuat\t1983\tonly\t-\tSep\t22\t0:00\t0\tS\nRule\tGuat\t1991\tonly\t-\tMar\t23\t0:00\t1:00\tD\nRule\tGuat\t1991\tonly\t-\tSep\t 7\t0:00\t0\tS\nRule\tGuat\t2006\tonly\t-\tApr\t30\t0:00\t1:00\tD\nRule\tGuat\t2006\tonly\t-\tOct\t 1\t0:00\t0\tS\nZone America/Guatemala\t-6:02:04 -\tLMT\t1918 Oct 5\n\t\t\t-6:00\tGuat\tC%sT\nRule\tHaiti\t1983\tonly\t-\tMay\t8\t0:00\t1:00\tD\nRule\tHaiti\t1984\t1987\t-\tApr\tlastSun\t0:00\t1:00\tD\nRule\tHaiti\t1983\t1987\t-\tOct\tlastSun\t0:00\t0\tS\nRule\tHaiti\t1988\t1997\t-\tApr\tSun>=1\t1:00s\t1:00\tD\nRule\tHaiti\t1988\t1997\t-\tOct\tlastSun\t1:00s\t0\tS\nRule\tHaiti\t2005\t2006\t-\tApr\tSun>=1\t0:00\t1:00\tD\nRule\tHaiti\t2005\t2006\t-\tOct\tlastSun\t0:00\t0\tS\nZone America/Port-au-Prince -4:49:20 -\tLMT\t1890\n\t\t\t-4:49\t-\tPPMT\t1917 Jan 24 12:00 # P-a-P MT\n\t\t\t-5:00\tHaiti\tE%sT\nRule\tHond\t1987\t1988\t-\tMay\tSun>=1\t0:00\t1:00\tD\nRule\tHond\t1987\t1988\t-\tSep\tlastSun\t0:00\t0\tS\nRule\tHond\t2006\tonly\t-\tMay\tSun>=1\t0:00\t1:00\tD\nRule\tHond\t2006\tonly\t-\tAug\tMon>=1\t0:00\t0\tS\nZone America/Tegucigalpa -5:48:52 -\tLMT\t1921 Apr\n\t\t\t-6:00\tHond\tC%sT\nZone\tAmerica/Jamaica\t-5:07:12 -\tLMT\t1890\t\t# Kingston\n\t\t\t-5:07:12 -\tKMT\t1912 Feb    # Kingston Mean Time\n\t\t\t-5:00\t-\tEST\t1974 Apr 28 2:00\n\t\t\t-5:00\tUS\tE%sT\t1984\n\t\t\t-5:00\t-\tEST\nZone America/Martinique\t-4:04:20 -      LMT\t1890\t\t# Fort-de-France\n\t\t\t-4:04:20 -\tFFMT\t1911 May     # Fort-de-France MT\n\t\t\t-4:00\t-\tAST\t1980 Apr  6\n\t\t\t-4:00\t1:00\tADT\t1980 Sep 28\n\t\t\t-4:00\t-\tAST\nZone America/Montserrat\t-4:08:52 -\tLMT\t1911 Jul 1 0:01   # Cork Hill\n\t\t\t-4:00\t-\tAST\nRule\tNic\t1979\t1980\t-\tMar\tSun>=16\t0:00\t1:00\tD\nRule\tNic\t1979\t1980\t-\tJun\tMon>=23\t0:00\t0\tS\nRule\tNic\t2005\tonly\t-\tApr\t10\t0:00\t1:00\tD\nRule\tNic\t2005\tonly\t-\tOct\tSun>=1\t0:00\t0\tS\nRule\tNic\t2006\tonly\t-\tApr\t30\t2:00\t1:00\tD\nRule\tNic\t2006\tonly\t-\tOct\tSun>=1\t1:00\t0\tS\nZone\tAmerica/Managua\t-5:45:08 -\tLMT\t1890\n\t\t\t-5:45:12 -\tMMT\t1934 Jun 23 # Managua Mean Time?\n\t\t\t-6:00\t-\tCST\t1973 May\n\t\t\t-5:00\t-\tEST\t1975 Feb 16\n\t\t\t-6:00\tNic\tC%sT\t1992 Jan  1 4:00\n\t\t\t-5:00\t-\tEST\t1992 Sep 24\n\t\t\t-6:00\t-\tCST\t1993\n\t\t\t-5:00\t-\tEST\t1997\n\t\t\t-6:00\tNic\tC%sT\nZone\tAmerica/Panama\t-5:18:08 -\tLMT\t1890\n\t\t\t-5:19:36 -\tCMT\t1908 Apr 22   # Colon Mean Time\n\t\t\t-5:00\t-\tEST\nZone America/Puerto_Rico -4:24:25 -\tLMT\t1899 Mar 28 12:00    # San Juan\n\t\t\t-4:00\t-\tAST\t1942 May  3\n\t\t\t-4:00\tUS\tA%sT\t1946\n\t\t\t-4:00\t-\tAST\nZone America/St_Kitts\t-4:10:52 -\tLMT\t1912 Mar 2\t# Basseterre\n\t\t\t-4:00\t-\tAST\nZone America/St_Lucia\t-4:04:00 -\tLMT\t1890\t\t# Castries\n\t\t\t-4:04:00 -\tCMT\t1912\t    # Castries Mean Time\n\t\t\t-4:00\t-\tAST\nZone America/Miquelon\t-3:44:40 -\tLMT\t1911 May 15\t# St Pierre\n\t\t\t-4:00\t-\tAST\t1980 May\n\t\t\t-3:00\t-\tPMST\t1987 # Pierre & Miquelon Time\n\t\t\t-3:00\tCanada\tPM%sT\nZone America/St_Vincent\t-4:04:56 -\tLMT\t1890\t\t# Kingstown\n\t\t\t-4:04:56 -\tKMT\t1912\t   # Kingstown Mean Time\n\t\t\t-4:00\t-\tAST\nRule\tTC\t1979\t1986\t-\tApr\tlastSun\t2:00\t1:00\tD\nRule\tTC\t1979\t2006\t-\tOct\tlastSun\t2:00\t0\tS\nRule\tTC\t1987\t2006\t-\tApr\tSun>=1\t2:00\t1:00\tD\nRule\tTC\t2007\tmax\t-\tMar\tSun>=8\t2:00\t1:00\tD\nRule\tTC\t2007\tmax\t-\tNov\tSun>=1\t2:00\t0\tS\nZone America/Grand_Turk\t-4:44:32 -\tLMT\t1890\n\t\t\t-5:07:12 -\tKMT\t1912 Feb    # Kingston Mean Time\n\t\t\t-5:00\tTC\tE%sT\nZone America/Tortola\t-4:18:28 -\tLMT\t1911 Jul    # Road Town\n\t\t\t-4:00\t-\tAST\nZone America/St_Thomas\t-4:19:44 -\tLMT\t1911 Jul    # Charlotte Amalie\n\t\t\t-4:00\t-\tAST\n","tz/pacificnew":"Link\tAmerica/Los_Angeles\tUS/Pacific-New\t##\n","tz/southamerica":"Rule\tArg\t1930\tonly\t-\tDec\t 1\t0:00\t1:00\tS\nRule\tArg\t1931\tonly\t-\tApr\t 1\t0:00\t0\t-\nRule\tArg\t1931\tonly\t-\tOct\t15\t0:00\t1:00\tS\nRule\tArg\t1932\t1940\t-\tMar\t 1\t0:00\t0\t-\nRule\tArg\t1932\t1939\t-\tNov\t 1\t0:00\t1:00\tS\nRule\tArg\t1940\tonly\t-\tJul\t 1\t0:00\t1:00\tS\nRule\tArg\t1941\tonly\t-\tJun\t15\t0:00\t0\t-\nRule\tArg\t1941\tonly\t-\tOct\t15\t0:00\t1:00\tS\nRule\tArg\t1943\tonly\t-\tAug\t 1\t0:00\t0\t-\nRule\tArg\t1943\tonly\t-\tOct\t15\t0:00\t1:00\tS\nRule\tArg\t1946\tonly\t-\tMar\t 1\t0:00\t0\t-\nRule\tArg\t1946\tonly\t-\tOct\t 1\t0:00\t1:00\tS\nRule\tArg\t1963\tonly\t-\tOct\t 1\t0:00\t0\t-\nRule\tArg\t1963\tonly\t-\tDec\t15\t0:00\t1:00\tS\nRule\tArg\t1964\t1966\t-\tMar\t 1\t0:00\t0\t-\nRule\tArg\t1964\t1966\t-\tOct\t15\t0:00\t1:00\tS\nRule\tArg\t1967\tonly\t-\tApr\t 2\t0:00\t0\t-\nRule\tArg\t1967\t1968\t-\tOct\tSun>=1\t0:00\t1:00\tS\nRule\tArg\t1968\t1969\t-\tApr\tSun>=1\t0:00\t0\t-\nRule\tArg\t1974\tonly\t-\tJan\t23\t0:00\t1:00\tS\nRule\tArg\t1974\tonly\t-\tMay\t 1\t0:00\t0\t-\nRule\tArg\t1988\tonly\t-\tDec\t 1\t0:00\t1:00\tS\nRule\tArg\t1989\t1993\t-\tMar\tSun>=1\t0:00\t0\t-\nRule\tArg\t1989\t1992\t-\tOct\tSun>=15\t0:00\t1:00\tS\nRule\tArg\t1999\tonly\t-\tOct\tSun>=1\t0:00\t1:00\tS\nRule\tArg\t2000\tonly\t-\tMar\t3\t0:00\t0\t-\nRule\tArg\t2007\tonly\t-\tDec\t30\t0:00\t1:00\tS\nRule\tArg\t2008\t2009\t-\tMar\tSun>=15\t0:00\t0\t-\nRule\tArg\t2008\tonly\t-\tOct\tSun>=15\t0:00\t1:00\tS\n \nZone America/Argentina/Buenos_Aires -3:53:48 - LMT 1894 Oct 31\n\t\t\t-4:16:48 -\tCMT\t1920 May # Cordoba Mean Time\n\t\t\t-4:00\t-\tART\t1930 Dec\n\t\t\t-4:00\tArg\tAR%sT\t1969 Oct  5\n\t\t\t-3:00\tArg\tAR%sT\t1999 Oct  3\n\t\t\t-4:00\tArg\tAR%sT\t2000 Mar  3\n\t\t\t-3:00\tArg\tAR%sT\nZone America/Argentina/Cordoba -4:16:48 - LMT\t1894 Oct 31\n\t\t\t-4:16:48 -\tCMT\t1920 May\n\t\t\t-4:00\t-\tART\t1930 Dec\n\t\t\t-4:00\tArg\tAR%sT\t1969 Oct  5\n\t\t\t-3:00\tArg\tAR%sT\t1991 Mar  3\n\t\t\t-4:00\t-\tWART\t1991 Oct 20\n\t\t\t-3:00\tArg\tAR%sT\t1999 Oct  3\n\t\t\t-4:00\tArg\tAR%sT\t2000 Mar  3\n\t\t\t-3:00\tArg\tAR%sT\nZone America/Argentina/Salta -4:21:40 - LMT\t1894 Oct 31\n\t\t\t-4:16:48 -\tCMT\t1920 May\n\t\t\t-4:00\t-\tART\t1930 Dec\n\t\t\t-4:00\tArg\tAR%sT\t1969 Oct  5\n\t\t\t-3:00\tArg\tAR%sT\t1991 Mar  3\n\t\t\t-4:00\t-\tWART\t1991 Oct 20\n\t\t\t-3:00\tArg\tAR%sT\t1999 Oct  3\n\t\t\t-4:00\tArg\tAR%sT\t2000 Mar  3\n\t\t\t-3:00\tArg\tAR%sT\t2008 Oct 18\n\t\t\t-3:00\t-\tART\nZone America/Argentina/Tucuman -4:20:52 - LMT\t1894 Oct 31\n\t\t\t-4:16:48 -\tCMT\t1920 May\n\t\t\t-4:00\t-\tART\t1930 Dec\n\t\t\t-4:00\tArg\tAR%sT\t1969 Oct  5\n\t\t\t-3:00\tArg\tAR%sT\t1991 Mar  3\n\t\t\t-4:00\t-\tWART\t1991 Oct 20\n\t\t\t-3:00\tArg\tAR%sT\t1999 Oct  3\n\t\t\t-4:00\tArg\tAR%sT\t2000 Mar  3\n\t\t\t-3:00\t-\tART\t2004 Jun  1\n\t\t\t-4:00\t-\tWART\t2004 Jun 13\n\t\t\t-3:00\tArg\tAR%sT\nZone America/Argentina/La_Rioja -4:27:24 - LMT\t1894 Oct 31\n\t\t\t-4:16:48 -\tCMT\t1920 May\n\t\t\t-4:00\t-\tART\t1930 Dec\n\t\t\t-4:00\tArg\tAR%sT\t1969 Oct  5\n\t\t\t-3:00\tArg\tAR%sT\t1991 Mar  1\n\t\t\t-4:00\t-\tWART\t1991 May  7\n\t\t\t-3:00\tArg\tAR%sT\t1999 Oct  3\n\t\t\t-4:00\tArg\tAR%sT\t2000 Mar  3\n\t\t\t-3:00\t-\tART\t2004 Jun  1\n\t\t\t-4:00\t-\tWART\t2004 Jun 20\n\t\t\t-3:00\tArg\tAR%sT\t2008 Oct 18\n\t\t\t-3:00\t-\tART\nZone America/Argentina/San_Juan -4:34:04 - LMT\t1894 Oct 31\n\t\t\t-4:16:48 -\tCMT\t1920 May\n\t\t\t-4:00\t-\tART\t1930 Dec\n\t\t\t-4:00\tArg\tAR%sT\t1969 Oct  5\n\t\t\t-3:00\tArg\tAR%sT\t1991 Mar  1\n\t\t\t-4:00\t-\tWART\t1991 May  7\n\t\t\t-3:00\tArg\tAR%sT\t1999 Oct  3\n\t\t\t-4:00\tArg\tAR%sT\t2000 Mar  3\n\t\t\t-3:00\t-\tART\t2004 May 31\n\t\t\t-4:00\t-\tWART\t2004 Jul 25\n\t\t\t-3:00\tArg\tAR%sT\t2008 Oct 18\n\t\t\t-3:00\t-\tART\nZone America/Argentina/Jujuy -4:21:12 -\tLMT\t1894 Oct 31\n\t\t\t-4:16:48 -\tCMT\t1920 May\n\t\t\t-4:00\t-\tART\t1930 Dec\n\t\t\t-4:00\tArg\tAR%sT\t1969 Oct  5\n\t\t\t-3:00\tArg\tAR%sT\t1990 Mar  4\n\t\t\t-4:00\t-\tWART\t1990 Oct 28\n\t\t\t-4:00\t1:00\tWARST\t1991 Mar 17\n\t\t\t-4:00\t-\tWART\t1991 Oct  6\n\t\t\t-3:00\t1:00\tARST\t1992\n\t\t\t-3:00\tArg\tAR%sT\t1999 Oct  3\n\t\t\t-4:00\tArg\tAR%sT\t2000 Mar  3\n\t\t\t-3:00\tArg\tAR%sT\t2008 Oct 18\n\t\t\t-3:00\t-\tART\nZone America/Argentina/Catamarca -4:23:08 - LMT\t1894 Oct 31\n\t\t\t-4:16:48 -\tCMT\t1920 May\n\t\t\t-4:00\t-\tART\t1930 Dec\n\t\t\t-4:00\tArg\tAR%sT\t1969 Oct  5\n\t\t\t-3:00\tArg\tAR%sT\t1991 Mar  3\n\t\t\t-4:00\t-\tWART\t1991 Oct 20\n\t\t\t-3:00\tArg\tAR%sT\t1999 Oct  3\n\t\t\t-4:00\tArg\tAR%sT\t2000 Mar  3\n\t\t\t-3:00\t-\tART\t2004 Jun  1\n\t\t\t-4:00\t-\tWART\t2004 Jun 20\n\t\t\t-3:00\tArg\tAR%sT\t2008 Oct 18\n\t\t\t-3:00\t-\tART\nZone America/Argentina/Mendoza -4:35:16 - LMT\t1894 Oct 31\n\t\t\t-4:16:48 -\tCMT\t1920 May\n\t\t\t-4:00\t-\tART\t1930 Dec\n\t\t\t-4:00\tArg\tAR%sT\t1969 Oct  5\n\t\t\t-3:00\tArg\tAR%sT\t1990 Mar  4\n\t\t\t-4:00\t-\tWART\t1990 Oct 15\n\t\t\t-4:00\t1:00\tWARST\t1991 Mar  1\n\t\t\t-4:00\t-\tWART\t1991 Oct 15\n\t\t\t-4:00\t1:00\tWARST\t1992 Mar  1\n\t\t\t-4:00\t-\tWART\t1992 Oct 18\n\t\t\t-3:00\tArg\tAR%sT\t1999 Oct  3\n\t\t\t-4:00\tArg\tAR%sT\t2000 Mar  3\n\t\t\t-3:00\t-\tART\t2004 May 23\n\t\t\t-4:00\t-\tWART\t2004 Sep 26\n\t\t\t-3:00\tArg\tAR%sT\t2008 Oct 18\n\t\t\t-3:00\t-\tART\nRule\tSanLuis\t2008\t2009\t-\tMar\tSun>=8\t0:00\t0\t-\nRule\tSanLuis\t2007\t2009\t-\tOct\tSun>=8\t0:00\t1:00\tS\nZone America/Argentina/San_Luis -4:25:24 - LMT\t1894 Oct 31\n\t\t\t-4:16:48 -\tCMT\t1920 May\n\t\t\t-4:00\t-\tART\t1930 Dec\n\t\t\t-4:00\tArg\tAR%sT\t1969 Oct  5\n\t\t\t-3:00\tArg\tAR%sT\t1990\n\t\t\t-3:00\t1:00\tARST\t1990 Mar 14\n\t\t\t-4:00\t-\tWART\t1990 Oct 15\n\t\t\t-4:00\t1:00\tWARST\t1991 Mar  1\n\t\t\t-4:00\t-\tWART\t1991 Jun  1\n\t\t\t-3:00\t-\tART\t1999 Oct  3\n\t\t\t-4:00\t1:00\tWARST\t2000 Mar  3\n\t\t\t-3:00\t-\tART\t2004 May 31\n\t\t\t-4:00\t-\tWART\t2004 Jul 25\n\t\t\t-3:00\tArg\tAR%sT\t2008 Jan 21\n\t\t\t-4:00\tSanLuis\tWAR%sT\nZone America/Argentina/Rio_Gallegos -4:36:52 - LMT 1894 Oct 31\n\t\t\t-4:16:48 -\tCMT\t1920 May # Cordoba Mean Time\n\t\t\t-4:00\t-\tART\t1930 Dec\n\t\t\t-4:00\tArg\tAR%sT\t1969 Oct  5\n\t\t\t-3:00\tArg\tAR%sT\t1999 Oct  3\n\t\t\t-4:00\tArg\tAR%sT\t2000 Mar  3\n\t\t\t-3:00\t-\tART\t2004 Jun  1\n\t\t\t-4:00\t-\tWART\t2004 Jun 20\n\t\t\t-3:00\tArg\tAR%sT\t2008 Oct 18\n\t\t\t-3:00\t-\tART\nZone America/Argentina/Ushuaia -4:33:12 - LMT 1894 Oct 31\n\t\t\t-4:16:48 -\tCMT\t1920 May # Cordoba Mean Time\n\t\t\t-4:00\t-\tART\t1930 Dec\n\t\t\t-4:00\tArg\tAR%sT\t1969 Oct  5\n\t\t\t-3:00\tArg\tAR%sT\t1999 Oct  3\n\t\t\t-4:00\tArg\tAR%sT\t2000 Mar  3\n\t\t\t-3:00\t-\tART\t2004 May 30\n\t\t\t-4:00\t-\tWART\t2004 Jun 20\n\t\t\t-3:00\tArg\tAR%sT\t2008 Oct 18\n\t\t\t-3:00\t-\tART\nZone\tAmerica/Aruba\t-4:40:24 -\tLMT\t1912 Feb 12\t# Oranjestad\n\t\t\t-4:30\t-\tANT\t1965 # Netherlands Antilles Time\n\t\t\t-4:00\t-\tAST\nZone\tAmerica/La_Paz\t-4:32:36 -\tLMT\t1890\n\t\t\t-4:32:36 -\tCMT\t1931 Oct 15 # Calamarca MT\n\t\t\t-4:32:36 1:00\tBOST\t1932 Mar 21 # Bolivia ST\n\t\t\t-4:00\t-\tBOT\t# Bolivia Time\nRule\tBrazil\t1931\tonly\t-\tOct\t 3\t11:00\t1:00\tS\nRule\tBrazil\t1932\t1933\t-\tApr\t 1\t 0:00\t0\t-\nRule\tBrazil\t1932\tonly\t-\tOct\t 3\t 0:00\t1:00\tS\nRule\tBrazil\t1949\t1952\t-\tDec\t 1\t 0:00\t1:00\tS\nRule\tBrazil\t1950\tonly\t-\tApr\t16\t 1:00\t0\t-\nRule\tBrazil\t1951\t1952\t-\tApr\t 1\t 0:00\t0\t-\nRule\tBrazil\t1953\tonly\t-\tMar\t 1\t 0:00\t0\t-\nRule\tBrazil\t1963\tonly\t-\tDec\t 9\t 0:00\t1:00\tS\nRule\tBrazil\t1964\tonly\t-\tMar\t 1\t 0:00\t0\t-\nRule\tBrazil\t1965\tonly\t-\tJan\t31\t 0:00\t1:00\tS\nRule\tBrazil\t1965\tonly\t-\tMar\t31\t 0:00\t0\t-\nRule\tBrazil\t1965\tonly\t-\tDec\t 1\t 0:00\t1:00\tS\nRule\tBrazil\t1966\t1968\t-\tMar\t 1\t 0:00\t0\t-\nRule\tBrazil\t1966\t1967\t-\tNov\t 1\t 0:00\t1:00\tS\nRule\tBrazil\t1985\tonly\t-\tNov\t 2\t 0:00\t1:00\tS\nRule\tBrazil\t1986\tonly\t-\tMar\t15\t 0:00\t0\t-\nRule\tBrazil\t1986\tonly\t-\tOct\t25\t 0:00\t1:00\tS\nRule\tBrazil\t1987\tonly\t-\tFeb\t14\t 0:00\t0\t-\nRule\tBrazil\t1987\tonly\t-\tOct\t25\t 0:00\t1:00\tS\nRule\tBrazil\t1988\tonly\t-\tFeb\t 7\t 0:00\t0\t-\nRule\tBrazil\t1988\tonly\t-\tOct\t16\t 0:00\t1:00\tS\nRule\tBrazil\t1989\tonly\t-\tJan\t29\t 0:00\t0\t-\nRule\tBrazil\t1989\tonly\t-\tOct\t15\t 0:00\t1:00\tS\nRule\tBrazil\t1990\tonly\t-\tFeb\t11\t 0:00\t0\t-\nRule\tBrazil\t1990\tonly\t-\tOct\t21\t 0:00\t1:00\tS\nRule\tBrazil\t1991\tonly\t-\tFeb\t17\t 0:00\t0\t-\nRule\tBrazil\t1991\tonly\t-\tOct\t20\t 0:00\t1:00\tS\nRule\tBrazil\t1992\tonly\t-\tFeb\t 9\t 0:00\t0\t-\nRule\tBrazil\t1992\tonly\t-\tOct\t25\t 0:00\t1:00\tS\nRule\tBrazil\t1993\tonly\t-\tJan\t31\t 0:00\t0\t-\nRule\tBrazil\t1993\t1995\t-\tOct\tSun>=11\t 0:00\t1:00\tS\nRule\tBrazil\t1994\t1995\t-\tFeb\tSun>=15\t 0:00\t0\t-\nRule\tBrazil\t1996\tonly\t-\tFeb\t11\t 0:00\t0\t-\nRule\tBrazil\t1996\tonly\t-\tOct\t 6\t 0:00\t1:00\tS\nRule\tBrazil\t1997\tonly\t-\tFeb\t16\t 0:00\t0\t-\nRule\tBrazil\t1997\tonly\t-\tOct\t 6\t 0:00\t1:00\tS\nRule\tBrazil\t1998\tonly\t-\tMar\t 1\t 0:00\t0\t-\nRule\tBrazil\t1998\tonly\t-\tOct\t11\t 0:00\t1:00\tS\nRule\tBrazil\t1999\tonly\t-\tFeb\t21\t 0:00\t0\t-\nRule\tBrazil\t1999\tonly\t-\tOct\t 3\t 0:00\t1:00\tS\nRule\tBrazil\t2000\tonly\t-\tFeb\t27\t 0:00\t0\t-\nRule\tBrazil\t2000\t2001\t-\tOct\tSun>=8\t 0:00\t1:00\tS\nRule\tBrazil\t2001\t2006\t-\tFeb\tSun>=15\t 0:00\t0\t-\nRule\tBrazil\t2002\tonly\t-\tNov\t 3\t 0:00\t1:00\tS\nRule\tBrazil\t2003\tonly\t-\tOct\t19\t 0:00\t1:00\tS\nRule\tBrazil\t2004\tonly\t-\tNov\t 2\t 0:00\t1:00\tS\nRule\tBrazil\t2005\tonly\t-\tOct\t16\t 0:00\t1:00\tS\nRule\tBrazil\t2006\tonly\t-\tNov\t 5\t 0:00\t1:00\tS\nRule\tBrazil\t2007\tonly\t-\tFeb\t25\t 0:00\t0\t-\nRule\tBrazil\t2007\tonly\t-\tOct\tSun>=8\t 0:00\t1:00\tS\nRule\tBrazil\t2008\tmax\t-\tOct\tSun>=15\t0:00\t1:00\tS\nRule\tBrazil\t2008\t2011\t-\tFeb\tSun>=15\t0:00\t0\t-\nRule\tBrazil\t2012\tonly\t-\tFeb\tSun>=22\t0:00\t0\t-\nRule\tBrazil\t2013\t2014\t-\tFeb\tSun>=15\t0:00\t0\t-\nRule\tBrazil\t2015\tonly\t-\tFeb\tSun>=22\t0:00\t0\t-\nRule\tBrazil\t2016\t2022\t-\tFeb\tSun>=15\t0:00\t0\t-\nRule\tBrazil\t2023\tonly\t-\tFeb\tSun>=22\t0:00\t0\t-\nRule\tBrazil\t2024\t2025\t-\tFeb\tSun>=15\t0:00\t0\t-\nRule\tBrazil\t2026\tonly\t-\tFeb\tSun>=22\t0:00\t0\t-\nRule\tBrazil\t2027\t2033\t-\tFeb\tSun>=15\t0:00\t0\t-\nRule\tBrazil\t2034\tonly\t-\tFeb\tSun>=22\t0:00\t0\t-\nRule\tBrazil\t2035\t2036\t-\tFeb\tSun>=15\t0:00\t0\t-\nRule\tBrazil\t2037\tonly\t-\tFeb\tSun>=22\t0:00\t0\t-\nRule\tBrazil\t2038\tmax\t-\tFeb\tSun>=15\t0:00\t0\t-\nZone America/Noronha\t-2:09:40 -\tLMT\t1914\n\t\t\t-2:00\tBrazil\tFN%sT\t1990 Sep 17\n\t\t\t-2:00\t-\tFNT\t1999 Sep 30\n\t\t\t-2:00\tBrazil\tFN%sT\t2000 Oct 15\n\t\t\t-2:00\t-\tFNT\t2001 Sep 13\n\t\t\t-2:00\tBrazil\tFN%sT\t2002 Oct  1\n\t\t\t-2:00\t-\tFNT\nZone America/Belem\t-3:13:56 -\tLMT\t1914\n\t\t\t-3:00\tBrazil\tBR%sT\t1988 Sep 12\n\t\t\t-3:00\t-\tBRT\nZone America/Santarem\t-3:38:48 -\tLMT\t1914\n\t\t\t-4:00\tBrazil\tAM%sT\t1988 Sep 12\n\t\t\t-4:00\t-\tAMT\t2008 Jun 24 00:00\n\t\t\t-3:00\t-\tBRT\nZone America/Fortaleza\t-2:34:00 -\tLMT\t1914\n\t\t\t-3:00\tBrazil\tBR%sT\t1990 Sep 17\n\t\t\t-3:00\t-\tBRT\t1999 Sep 30\n\t\t\t-3:00\tBrazil\tBR%sT\t2000 Oct 22\n\t\t\t-3:00\t-\tBRT\t2001 Sep 13\n\t\t\t-3:00\tBrazil\tBR%sT\t2002 Oct  1\n\t\t\t-3:00\t-\tBRT\nZone America/Recife\t-2:19:36 -\tLMT\t1914\n\t\t\t-3:00\tBrazil\tBR%sT\t1990 Sep 17\n\t\t\t-3:00\t-\tBRT\t1999 Sep 30\n\t\t\t-3:00\tBrazil\tBR%sT\t2000 Oct 15\n\t\t\t-3:00\t-\tBRT\t2001 Sep 13\n\t\t\t-3:00\tBrazil\tBR%sT\t2002 Oct  1\n\t\t\t-3:00\t-\tBRT\nZone America/Araguaina\t-3:12:48 -\tLMT\t1914\n\t\t\t-3:00\tBrazil\tBR%sT\t1990 Sep 17\n\t\t\t-3:00\t-\tBRT\t1995 Sep 14\n\t\t\t-3:00\tBrazil\tBR%sT\t2003 Sep 24\n\t\t\t-3:00\t-\tBRT\nZone America/Maceio\t-2:22:52 -\tLMT\t1914\n\t\t\t-3:00\tBrazil\tBR%sT\t1990 Sep 17\n\t\t\t-3:00\t-\tBRT\t1995 Oct 13\n\t\t\t-3:00\tBrazil\tBR%sT\t1996 Sep  4\n\t\t\t-3:00\t-\tBRT\t1999 Sep 30\n\t\t\t-3:00\tBrazil\tBR%sT\t2000 Oct 22\n\t\t\t-3:00\t-\tBRT\t2001 Sep 13\n\t\t\t-3:00\tBrazil\tBR%sT\t2002 Oct  1\n\t\t\t-3:00\t-\tBRT\nZone America/Bahia\t-2:34:04 -\tLMT\t1914\n\t\t\t-3:00\tBrazil\tBR%sT\t2003 Sep 24\n\t\t\t-3:00\t-\tBRT\t2011 Oct 16\n\t\t\t-3:00\tBrazil\tBR%sT\nZone America/Sao_Paulo\t-3:06:28 -\tLMT\t1914\n\t\t\t-3:00\tBrazil\tBR%sT\t1963 Oct 23 00:00\n\t\t\t-3:00\t1:00\tBRST\t1964\n\t\t\t-3:00\tBrazil\tBR%sT\nZone America/Campo_Grande -3:38:28 -\tLMT\t1914\n\t\t\t-4:00\tBrazil\tAM%sT\nZone America/Cuiaba\t-3:44:20 -\tLMT\t1914\n\t\t\t-4:00\tBrazil\tAM%sT\t2003 Sep 24\n\t\t\t-4:00\t-\tAMT\t2004 Oct  1\n\t\t\t-4:00\tBrazil\tAM%sT\nZone America/Porto_Velho -4:15:36 -\tLMT\t1914\n\t\t\t-4:00\tBrazil\tAM%sT\t1988 Sep 12\n\t\t\t-4:00\t-\tAMT\nZone America/Boa_Vista\t-4:02:40 -\tLMT\t1914\n\t\t\t-4:00\tBrazil\tAM%sT\t1988 Sep 12\n\t\t\t-4:00\t-\tAMT\t1999 Sep 30\n\t\t\t-4:00\tBrazil\tAM%sT\t2000 Oct 15\n\t\t\t-4:00\t-\tAMT\nZone America/Manaus\t-4:00:04 -\tLMT\t1914\n\t\t\t-4:00\tBrazil\tAM%sT\t1988 Sep 12\n\t\t\t-4:00\t-\tAMT\t1993 Sep 28\n\t\t\t-4:00\tBrazil\tAM%sT\t1994 Sep 22\n\t\t\t-4:00\t-\tAMT\nZone America/Eirunepe\t-4:39:28 -\tLMT\t1914\n\t\t\t-5:00\tBrazil\tAC%sT\t1988 Sep 12\n\t\t\t-5:00\t-\tACT\t1993 Sep 28\n\t\t\t-5:00\tBrazil\tAC%sT\t1994 Sep 22\n\t\t\t-5:00\t-\tACT\t2008 Jun 24 00:00\n\t\t\t-4:00\t-\tAMT\nZone America/Rio_Branco\t-4:31:12 -\tLMT\t1914\n\t\t\t-5:00\tBrazil\tAC%sT\t1988 Sep 12\n\t\t\t-5:00\t-\tACT\t2008 Jun 24 00:00\n\t\t\t-4:00\t-\tAMT\nRule\tChile\t1927\t1932\t-\tSep\t 1\t0:00\t1:00\tS\nRule\tChile\t1928\t1932\t-\tApr\t 1\t0:00\t0\t-\nRule\tChile\t1942\tonly\t-\tJun\t 1\t4:00u\t0\t-\nRule\tChile\t1942\tonly\t-\tAug\t 1\t5:00u\t1:00\tS\nRule\tChile\t1946\tonly\t-\tJul\t15\t4:00u\t1:00\tS\nRule\tChile\t1946\tonly\t-\tSep\t 1\t3:00u\t0:00\t-\nRule\tChile\t1947\tonly\t-\tApr\t 1\t4:00u\t0\t-\nRule\tChile\t1968\tonly\t-\tNov\t 3\t4:00u\t1:00\tS\nRule\tChile\t1969\tonly\t-\tMar\t30\t3:00u\t0\t-\nRule\tChile\t1969\tonly\t-\tNov\t23\t4:00u\t1:00\tS\nRule\tChile\t1970\tonly\t-\tMar\t29\t3:00u\t0\t-\nRule\tChile\t1971\tonly\t-\tMar\t14\t3:00u\t0\t-\nRule\tChile\t1970\t1972\t-\tOct\tSun>=9\t4:00u\t1:00\tS\nRule\tChile\t1972\t1986\t-\tMar\tSun>=9\t3:00u\t0\t-\nRule\tChile\t1973\tonly\t-\tSep\t30\t4:00u\t1:00\tS\nRule\tChile\t1974\t1987\t-\tOct\tSun>=9\t4:00u\t1:00\tS\nRule\tChile\t1987\tonly\t-\tApr\t12\t3:00u\t0\t-\nRule\tChile\t1988\t1989\t-\tMar\tSun>=9\t3:00u\t0\t-\nRule\tChile\t1988\tonly\t-\tOct\tSun>=1\t4:00u\t1:00\tS\nRule\tChile\t1989\tonly\t-\tOct\tSun>=9\t4:00u\t1:00\tS\nRule\tChile\t1990\tonly\t-\tMar\t18\t3:00u\t0\t-\nRule\tChile\t1990\tonly\t-\tSep\t16\t4:00u\t1:00\tS\nRule\tChile\t1991\t1996\t-\tMar\tSun>=9\t3:00u\t0\t-\nRule\tChile\t1991\t1997\t-\tOct\tSun>=9\t4:00u\t1:00\tS\nRule\tChile\t1997\tonly\t-\tMar\t30\t3:00u\t0\t-\nRule\tChile\t1998\tonly\t-\tMar\tSun>=9\t3:00u\t0\t-\nRule\tChile\t1998\tonly\t-\tSep\t27\t4:00u\t1:00\tS\nRule\tChile\t1999\tonly\t-\tApr\t 4\t3:00u\t0\t-\nRule\tChile\t1999\t2010\t-\tOct\tSun>=9\t4:00u\t1:00\tS\nRule\tChile\t2011\tonly\t-\tAug\tSun>=16\t4:00u\t1:00\tS\nRule\tChile\t2012\tmax\t-\tOct\tSun>=9\t4:00u\t1:00\tS\nRule\tChile\t2000\t2007\t-\tMar\tSun>=9\t3:00u\t0\t-\nRule\tChile\t2008\tonly\t-\tMar\t30\t3:00u\t0\t-\nRule\tChile\t2009\tonly\t-\tMar\tSun>=9\t3:00u\t0\t-\nRule\tChile\t2010\tonly\t-\tApr\tSun>=1\t3:00u\t0\t-\nRule\tChile\t2011\tonly\t-\tMay\tSun>=2\t3:00u\t0\t-\nRule\tChile\t2012\tmax\t-\tMar\tSun>=9\t3:00u\t0\t-\nZone America/Santiago\t-4:42:46 -\tLMT\t1890\n\t\t\t-4:42:46 -\tSMT\t1910 \t    # Santiago Mean Time\n\t\t\t-5:00\t-\tCLT\t1916 Jul  1 # Chile Time\n\t\t\t-4:42:46 -\tSMT\t1918 Sep  1 # Santiago Mean Time\n\t\t\t-4:00\t-\tCLT\t1919 Jul  1 # Chile Time\n\t\t\t-4:42:46 -\tSMT\t1927 Sep  1 # Santiago Mean Time\n\t\t\t-5:00\tChile\tCL%sT\t1947 May 22 # Chile Time\n\t\t\t-4:00\tChile\tCL%sT\nZone Pacific/Easter\t-7:17:44 -\tLMT\t1890\n\t\t\t-7:17:28 -\tEMT\t1932 Sep    # Easter Mean Time\n\t\t\t-7:00\tChile\tEAS%sT\t1982 Mar 13 21:00 # Easter I Time\n\t\t\t-6:00\tChile\tEAS%sT\nRule\tCO\t1992\tonly\t-\tMay\t 3\t0:00\t1:00\tS\nRule\tCO\t1993\tonly\t-\tApr\t 4\t0:00\t0\t-\nZone\tAmerica/Bogota\t-4:56:20 -\tLMT\t1884 Mar 13\n\t\t\t-4:56:20 -\tBMT\t1914 Nov 23 # Bogota Mean Time\n\t\t\t-5:00\tCO\tCO%sT\t# Colombia Time\nZone\tAmerica/Curacao\t-4:35:44 -\tLMT\t1912 Feb 12\t# Willemstad\n\t\t\t-4:30\t-\tANT\t1965 # Netherlands Antilles Time\n\t\t\t-4:00\t-\tAST\nLink\tAmerica/Curacao\tAmerica/Lower_Princes # Sint Maarten\nLink\tAmerica/Curacao\tAmerica/Kralendijk # Bonaire, Sint Estatius and Saba\nZone America/Guayaquil\t-5:19:20 -\tLMT\t1890\n\t\t\t-5:14:00 -\tQMT\t1931 # Quito Mean Time\n\t\t\t-5:00\t-\tECT\t     # Ecuador Time\nZone Pacific/Galapagos\t-5:58:24 -\tLMT\t1931 # Puerto Baquerizo Moreno\n\t\t\t-5:00\t-\tECT\t1986\n\t\t\t-6:00\t-\tGALT\t     # Galapagos Time\nRule\tFalk\t1937\t1938\t-\tSep\tlastSun\t0:00\t1:00\tS\nRule\tFalk\t1938\t1942\t-\tMar\tSun>=19\t0:00\t0\t-\nRule\tFalk\t1939\tonly\t-\tOct\t1\t0:00\t1:00\tS\nRule\tFalk\t1940\t1942\t-\tSep\tlastSun\t0:00\t1:00\tS\nRule\tFalk\t1943\tonly\t-\tJan\t1\t0:00\t0\t-\nRule\tFalk\t1983\tonly\t-\tSep\tlastSun\t0:00\t1:00\tS\nRule\tFalk\t1984\t1985\t-\tApr\tlastSun\t0:00\t0\t-\nRule\tFalk\t1984\tonly\t-\tSep\t16\t0:00\t1:00\tS\nRule\tFalk\t1985\t2000\t-\tSep\tSun>=9\t0:00\t1:00\tS\nRule\tFalk\t1986\t2000\t-\tApr\tSun>=16\t0:00\t0\t-\nRule\tFalk\t2001\t2010\t-\tApr\tSun>=15\t2:00\t0\t-\nRule\tFalk\t2012\tmax\t-\tApr\tSun>=15\t2:00\t0\t-\nRule\tFalk\t2001\tmax\t-\tSep\tSun>=1\t2:00\t1:00\tS\nZone Atlantic/Stanley\t-3:51:24 -\tLMT\t1890\n\t\t\t-3:51:24 -\tSMT\t1912 Mar 12  # Stanley Mean Time\n\t\t\t-4:00\tFalk\tFK%sT\t1983 May     # Falkland Is Time\n\t\t\t-3:00\tFalk\tFK%sT\t1985 Sep 15\n\t\t\t-4:00\tFalk\tFK%sT\nZone America/Cayenne\t-3:29:20 -\tLMT\t1911 Jul\n\t\t\t-4:00\t-\tGFT\t1967 Oct # French Guiana Time\n\t\t\t-3:00\t-\tGFT\nZone\tAmerica/Guyana\t-3:52:40 -\tLMT\t1915 Mar\t# Georgetown\n\t\t\t-3:45\t-\tGBGT\t1966 May 26 # Br Guiana Time\n\t\t\t-3:45\t-\tGYT\t1975 Jul 31 # Guyana Time\n\t\t\t-3:00\t-\tGYT\t1991\n\t\t\t-4:00\t-\tGYT\nRule\tPara\t1975\t1988\t-\tOct\t 1\t0:00\t1:00\tS\nRule\tPara\t1975\t1978\t-\tMar\t 1\t0:00\t0\t-\nRule\tPara\t1979\t1991\t-\tApr\t 1\t0:00\t0\t-\nRule\tPara\t1989\tonly\t-\tOct\t22\t0:00\t1:00\tS\nRule\tPara\t1990\tonly\t-\tOct\t 1\t0:00\t1:00\tS\nRule\tPara\t1991\tonly\t-\tOct\t 6\t0:00\t1:00\tS\nRule\tPara\t1992\tonly\t-\tMar\t 1\t0:00\t0\t-\nRule\tPara\t1992\tonly\t-\tOct\t 5\t0:00\t1:00\tS\nRule\tPara\t1993\tonly\t-\tMar\t31\t0:00\t0\t-\nRule\tPara\t1993\t1995\t-\tOct\t 1\t0:00\t1:00\tS\nRule\tPara\t1994\t1995\t-\tFeb\tlastSun\t0:00\t0\t-\nRule\tPara\t1996\tonly\t-\tMar\t 1\t0:00\t0\t-\nRule\tPara\t1996\t2001\t-\tOct\tSun>=1\t0:00\t1:00\tS\nRule\tPara\t1997\tonly\t-\tFeb\tlastSun\t0:00\t0\t-\nRule\tPara\t1998\t2001\t-\tMar\tSun>=1\t0:00\t0\t-\nRule\tPara\t2002\t2004\t-\tApr\tSun>=1\t0:00\t0\t-\nRule\tPara\t2002\t2003\t-\tSep\tSun>=1\t0:00\t1:00\tS\nRule\tPara\t2004\t2009\t-\tOct\tSun>=15\t0:00\t1:00\tS\nRule\tPara\t2005\t2009\t-\tMar\tSun>=8\t0:00\t0\t-\nRule\tPara\t2010\tmax\t-\tOct\tSun>=1\t0:00\t1:00\tS\nRule\tPara\t2010\tmax\t-\tApr\tSun>=8\t0:00\t0\t-\nZone America/Asuncion\t-3:50:40 -\tLMT\t1890\n\t\t\t-3:50:40 -\tAMT\t1931 Oct 10 # Asuncion Mean Time\n\t\t\t-4:00\t-\tPYT\t1972 Oct # Paraguay Time\n\t\t\t-3:00\t-\tPYT\t1974 Apr\n\t\t\t-4:00\tPara\tPY%sT\nRule\tPeru\t1938\tonly\t-\tJan\t 1\t0:00\t1:00\tS\nRule\tPeru\t1938\tonly\t-\tApr\t 1\t0:00\t0\t-\nRule\tPeru\t1938\t1939\t-\tSep\tlastSun\t0:00\t1:00\tS\nRule\tPeru\t1939\t1940\t-\tMar\tSun>=24\t0:00\t0\t-\nRule\tPeru\t1986\t1987\t-\tJan\t 1\t0:00\t1:00\tS\nRule\tPeru\t1986\t1987\t-\tApr\t 1\t0:00\t0\t-\nRule\tPeru\t1990\tonly\t-\tJan\t 1\t0:00\t1:00\tS\nRule\tPeru\t1990\tonly\t-\tApr\t 1\t0:00\t0\t-\nRule\tPeru\t1994\tonly\t-\tJan\t 1\t0:00\t1:00\tS\nRule\tPeru\t1994\tonly\t-\tApr\t 1\t0:00\t0\t-\nZone\tAmerica/Lima\t-5:08:12 -\tLMT\t1890\n\t\t\t-5:08:36 -\tLMT\t1908 Jul 28 # Lima Mean Time?\n\t\t\t-5:00\tPeru\tPE%sT\t# Peru Time\nZone Atlantic/South_Georgia -2:26:08 -\tLMT\t1890\t\t# Grytviken\n\t\t\t-2:00\t-\tGST\t# South Georgia Time\nZone America/Paramaribo\t-3:40:40 -\tLMT\t1911\n\t\t\t-3:40:52 -\tPMT\t1935     # Paramaribo Mean Time\n\t\t\t-3:40:36 -\tPMT\t1945 Oct # The capital moved?\n\t\t\t-3:30\t-\tNEGT\t1975 Nov 20 # Dutch Guiana Time\n\t\t\t-3:30\t-\tSRT\t1984 Oct # Suriname Time\n\t\t\t-3:00\t-\tSRT\nZone America/Port_of_Spain -4:06:04 -\tLMT\t1912 Mar 2\n\t\t\t-4:00\t-\tAST\nRule\tUruguay\t1923\tonly\t-\tOct\t 2\t 0:00\t0:30\tHS\nRule\tUruguay\t1924\t1926\t-\tApr\t 1\t 0:00\t0\t-\nRule\tUruguay\t1924\t1925\t-\tOct\t 1\t 0:00\t0:30\tHS\nRule\tUruguay\t1933\t1935\t-\tOct\tlastSun\t 0:00\t0:30\tHS\nRule\tUruguay\t1934\t1936\t-\tMar\tSat>=25\t23:30s\t0\t-\nRule\tUruguay\t1936\tonly\t-\tNov\t 1\t 0:00\t0:30\tHS\nRule\tUruguay\t1937\t1941\t-\tMar\tlastSun\t 0:00\t0\t-\nRule\tUruguay\t1937\t1940\t-\tOct\tlastSun\t 0:00\t0:30\tHS\nRule\tUruguay\t1941\tonly\t-\tAug\t 1\t 0:00\t0:30\tHS\nRule\tUruguay\t1942\tonly\t-\tJan\t 1\t 0:00\t0\t-\nRule\tUruguay\t1942\tonly\t-\tDec\t14\t 0:00\t1:00\tS\nRule\tUruguay\t1943\tonly\t-\tMar\t14\t 0:00\t0\t-\nRule\tUruguay\t1959\tonly\t-\tMay\t24\t 0:00\t1:00\tS\nRule\tUruguay\t1959\tonly\t-\tNov\t15\t 0:00\t0\t-\nRule\tUruguay\t1960\tonly\t-\tJan\t17\t 0:00\t1:00\tS\nRule\tUruguay\t1960\tonly\t-\tMar\t 6\t 0:00\t0\t-\nRule\tUruguay\t1965\t1967\t-\tApr\tSun>=1\t 0:00\t1:00\tS\nRule\tUruguay\t1965\tonly\t-\tSep\t26\t 0:00\t0\t-\nRule\tUruguay\t1966\t1967\t-\tOct\t31\t 0:00\t0\t-\nRule\tUruguay\t1968\t1970\t-\tMay\t27\t 0:00\t0:30\tHS\nRule\tUruguay\t1968\t1970\t-\tDec\t 2\t 0:00\t0\t-\nRule\tUruguay\t1972\tonly\t-\tApr\t24\t 0:00\t1:00\tS\nRule\tUruguay\t1972\tonly\t-\tAug\t15\t 0:00\t0\t-\nRule\tUruguay\t1974\tonly\t-\tMar\t10\t 0:00\t0:30\tHS\nRule\tUruguay\t1974\tonly\t-\tDec\t22\t 0:00\t1:00\tS\nRule\tUruguay\t1976\tonly\t-\tOct\t 1\t 0:00\t0\t-\nRule\tUruguay\t1977\tonly\t-\tDec\t 4\t 0:00\t1:00\tS\nRule\tUruguay\t1978\tonly\t-\tApr\t 1\t 0:00\t0\t-\nRule\tUruguay\t1979\tonly\t-\tOct\t 1\t 0:00\t1:00\tS\nRule\tUruguay\t1980\tonly\t-\tMay\t 1\t 0:00\t0\t-\nRule\tUruguay\t1987\tonly\t-\tDec\t14\t 0:00\t1:00\tS\nRule\tUruguay\t1988\tonly\t-\tMar\t14\t 0:00\t0\t-\nRule\tUruguay\t1988\tonly\t-\tDec\t11\t 0:00\t1:00\tS\nRule\tUruguay\t1989\tonly\t-\tMar\t12\t 0:00\t0\t-\nRule\tUruguay\t1989\tonly\t-\tOct\t29\t 0:00\t1:00\tS\nRule\tUruguay\t1990\t1992\t-\tMar\tSun>=1\t 0:00\t0\t-\nRule\tUruguay\t1990\t1991\t-\tOct\tSun>=21\t 0:00\t1:00\tS\nRule\tUruguay\t1992\tonly\t-\tOct\t18\t 0:00\t1:00\tS\nRule\tUruguay\t1993\tonly\t-\tFeb\t28\t 0:00\t0\t-\nRule\tUruguay\t2004\tonly\t-\tSep\t19\t 0:00\t1:00\tS\nRule\tUruguay\t2005\tonly\t-\tMar\t27\t 2:00\t0\t-\nRule\tUruguay\t2005\tonly\t-\tOct\t 9\t 2:00\t1:00\tS\nRule\tUruguay\t2006\tonly\t-\tMar\t12\t 2:00\t0\t-\nRule\tUruguay\t2006\tmax\t-\tOct\tSun>=1\t 2:00\t1:00\tS\nRule\tUruguay\t2007\tmax\t-\tMar\tSun>=8\t 2:00\t0\t-\nZone America/Montevideo\t-3:44:44 -\tLMT\t1898 Jun 28\n\t\t\t-3:44:44 -\tMMT\t1920 May  1\t# Montevideo MT\n\t\t\t-3:30\tUruguay\tUY%sT\t1942 Dec 14\t# Uruguay Time\n\t\t\t-3:00\tUruguay\tUY%sT\nZone\tAmerica/Caracas\t-4:27:44 -\tLMT\t1890\n\t\t\t-4:27:40 -\tCMT\t1912 Feb 12 # Caracas Mean Time?\n\t\t\t-4:30\t-\tVET\t1965\t     # Venezuela Time\n\t\t\t-4:00\t-\tVET\t2007 Dec  9 03:00\n\t\t\t-4:30\t-\tVET\n"}

});

require.define("/aggregate.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var ChartTime, ChartTimeIterator, ChartTimeRange, aggregate, aggregateAt, deriveFieldsAt, functions, groupBy, groupByAt, percentileCreator, snapshotArray_To_AtArray, timeSeriesCalculator, timeSeriesGroupByCalculator, utils, _extractFandAs, _ref;
  var __hasProp = Object.prototype.hasOwnProperty, __indexOf = Array.prototype.indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (__hasProp.call(this, i) && this[i] === item) return i; } return -1; };

  utils = require('./utils');

  ChartTime = require('./ChartTime').ChartTime;

  _ref = require('./ChartTimeIteratorAndRange'), ChartTimeRange = _ref.ChartTimeRange, ChartTimeIterator = _ref.ChartTimeIterator;

  deriveFieldsAt = require('./derive').deriveFieldsAt;

  snapshotArray_To_AtArray = require('./datatransform').snapshotArray_To_AtArray;

  functions = {};

  functions.$sum = function(values) {
    var temp, v, _i, _len;
    temp = 0;
    for (_i = 0, _len = values.length; _i < _len; _i++) {
      v = values[_i];
      temp += v;
    }
    return temp;
  };

  functions.$sumSquares = function(values) {
    var temp, v, _i, _len;
    temp = 0;
    for (_i = 0, _len = values.length; _i < _len; _i++) {
      v = values[_i];
      temp += v * v;
    }
    return temp;
  };

  functions.$count = function(values) {
    return values.length;
  };

  functions.$min = function(values) {
    var temp, v, _i, _len;
    if (values.length === 0) return null;
    temp = values[0];
    for (_i = 0, _len = values.length; _i < _len; _i++) {
      v = values[_i];
      if (v < temp) temp = v;
    }
    return temp;
  };

  functions.$max = function(values) {
    var temp, v, _i, _len;
    if (values.length === 0) return null;
    temp = values[0];
    for (_i = 0, _len = values.length; _i < _len; _i++) {
      v = values[_i];
      if (v > temp) temp = v;
    }
    return temp;
  };

  functions.$push = function(values) {
    /*
      An Array of all values (allows duplicates). Can be used for drill down when you know they will be unique.
    */
    var temp, v, _i, _len;
    temp = [];
    for (_i = 0, _len = values.length; _i < _len; _i++) {
      v = values[_i];
      temp.push(v);
    }
    return temp;
  };

  functions.$addToSet = function(values) {
    /*
      An Array of unique values. This is good for generating an OLAP dimension or drill down.
    */
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

  functions.$average = function(values) {
    var count, sum, v, _i, _len;
    count = values.length;
    sum = 0;
    for (_i = 0, _len = values.length; _i < _len; _i++) {
      v = values[_i];
      sum += v;
    }
    return sum / count;
  };

  functions.$variance = function(values) {
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

  functions.$standardDeviation = function(values) {
    return Math.sqrt(functions.$variance(values));
  };

  percentileCreator = function(p) {
    /*
      When the user passes in `$p<n>` as an aggregation function, this `percentileCreator` is called to return the appropriate percentile function. 
      The returned function will find the `<n>`th percentile where `<n>` is some number in the form of `##[.##]`. (e.g. `$p40`, `$p99`, `$p99.9`).
      
      Note: `$median` is an alias for `$p50`.
      
      There is no official definition of percentile. The function returned by this `percentileCreator` uses the Excel interpolation algorithm 
      which is close to the NIST recommendation and makes the most sense to me.
    */    return function(values) {
      var d, k, n, sortfunc, vLength;
      sortfunc = function(a, b) {
        return a - b;
      };
      vLength = values.length;
      values.sort(sortfunc);
      n = (p * (vLength - 1) / 100) + 1;
      k = Math.floor(n);
      d = n - k;
      if (n === 1) return values[1 - 1];
      if (n === vLength) return values[vLength - 1];
      return values[k - 1] + d * (values[k] - values[k - 1]);
    };
  };

  _extractFandAs = function(a) {
    /*
      Returns an object with `f` and `as` references from an aggregation spec `a`.
      This is needed because `as` is optional and must be generated if missing. Also, the percentile
      and median calculators have to call `percentileCreator` to find those `f`s.
    */
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
    } else if (a.f === '$median') {
      f = percentileCreator(50);
    } else if (a.f.substr(0, 2) === '$p') {
      p = /\$p(\d+(.\d+)?)/.exec(a.f)[1];
      f = percentileCreator(Number(p));
    } else {
      throw new Error("" + a.f + " is not a recognized built-in function");
    }
    return {
      f: f,
      as: as
    };
  };

  aggregate = function(list, aggregations) {
    /*
      Takes a list like this:
          
          {aggregate} = require('../')
      
          list = [
            { ObjectID: '1', KanbanState: 'In progress', PlanEstimate: 5, TaskRemainingTotal: 20 },
            { ObjectID: '2', KanbanState: 'Ready to pull', PlanEstimate: 3, TaskRemainingTotal: 5 },
            { ObjectID: '3', KanbanState: 'Ready to pull', PlanEstimate: 5, TaskRemainingTotal: 12 }
          ]
          
      and a list of aggregations like this:
    
          aggregations = [
            {field: 'ObjectID', f: '$count'}
            {as: 'Drill-down', field:'ObjectID', f:'$push'}
            {field: 'PlanEstimate', f: '$sum'}
            {as: 'mySum', field: 'PlanEstimate', f: (values) ->
              temp = 0
              for v in values
                temp += v
              return temp
            }
          ]
          
      and returns the aggregations like this:
        
          a = aggregate(list, aggregations)
          console.log(a)
     
          #   { 'ObjectID_$count': 3, 
          #     'Drill-down': [ '1', '2', '3' ], 
          #     'PlanEstimate_$sum': 13, 
          #     mySum: 13 } 
          
      For each aggregation, you must provide a `field` and `f` (function) value. You can optionally 
      provide an alias for the aggregation with the 'as` field. There are a number of built in functions 
      documented above.
      
      Alternatively, you can provide your own function (it takes one parameter, which is an
      Array of values to aggregate) like the `mySum` example in our `aggregations` list above.
    */
    var a, as, f, output, row, valuesArray, _i, _j, _len, _len2, _ref2;
    output = {};
    for (_i = 0, _len = aggregations.length; _i < _len; _i++) {
      a = aggregations[_i];
      valuesArray = [];
      for (_j = 0, _len2 = list.length; _j < _len2; _j++) {
        row = list[_j];
        valuesArray.push(row[a.field]);
      }
      _ref2 = _extractFandAs(a), f = _ref2.f, as = _ref2.as;
      output[as] = f(valuesArray);
    }
    return output;
  };

  aggregateAt = function(atArray, aggregations) {
    /*
      Each row in atArray is passed to the `aggregate` function and the results are collected into a single output.
      This is essentially a wrapper around the aggregate function so the spec parameter is the same.
    */
    var a, idx, output, row, _len;
    output = [];
    for (idx = 0, _len = atArray.length; idx < _len; idx++) {
      row = atArray[idx];
      a = aggregate(row, aggregations);
      output.push(a);
    }
    return output;
  };

  groupBy = function(list, spec) {
    /*
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
            aggregations: [
              {field: 'ObjectID', f: '$count'}
              {as: 'Drill-down', field:'ObjectID', f:'$push'}
              {field: 'PlanEstimate', f: '$sum'}
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
    
          # { 'In progress': 
          #     { 'ObjectID_$count': 1,
          #       'Drill-down': [ '1' ], 
          #       'PlanEstimate_$sum': 5, 
          #       mySum: 5 },
          #   'Ready to pull': 
          #     { 'ObjectID_$count': 2, 
          #       'Drill-down': [ '2', '3' ], 
          #       'PlanEstimate_$sum': 8, 
          #       mySum: 8 } }
          
      The first element of this specification is the `groupBy` field. This is analagous to
      the `GROUP BY` column in an SQL express.
      
      Uses the same aggregation functions at the `aggregate` function.
    */
    var a, as, f, groupByValue, grouped, output, outputRow, row, valuesArray, valuesForThisGroup, _i, _j, _k, _len, _len2, _len3, _ref2, _ref3;
    grouped = {};
    for (_i = 0, _len = list.length; _i < _len; _i++) {
      row = list[_i];
      if (grouped[row[spec.groupBy]] == null) grouped[row[spec.groupBy]] = [];
      grouped[row[spec.groupBy]].push(row);
    }
    output = {};
    for (groupByValue in grouped) {
      valuesForThisGroup = grouped[groupByValue];
      outputRow = {};
      _ref2 = spec.aggregations;
      for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
        a = _ref2[_j];
        valuesArray = [];
        for (_k = 0, _len3 = valuesForThisGroup.length; _k < _len3; _k++) {
          row = valuesForThisGroup[_k];
          valuesArray.push(row[a.field]);
        }
        _ref3 = _extractFandAs(a), f = _ref3.f, as = _ref3.as;
        outputRow[as] = f(valuesArray);
      }
      output[groupByValue] = outputRow;
    }
    return output;
  };

  groupByAt = function(atArray, spec) {
    /*
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
    var a, as, blank, f, idx, key, newRow, output, row, t, temp, u, uniqueValues, value, _i, _j, _k, _l, _len, _len2, _len3, _len4, _len5, _ref2, _ref3;
    temp = [];
    for (idx = 0, _len = atArray.length; idx < _len; idx++) {
      row = atArray[idx];
      temp.push(groupBy(row, spec));
    }
    if (spec.uniqueValues != null) {
      uniqueValues = spec.uniqueValues;
    } else {
      uniqueValues = [];
    }
    for (_i = 0, _len2 = temp.length; _i < _len2; _i++) {
      t = temp[_i];
      for (key in t) {
        value = t[key];
        if (__indexOf.call(uniqueValues, key) < 0) uniqueValues.push(key);
      }
    }
    blank = {};
    _ref2 = spec.aggregations;
    for (_j = 0, _len3 = _ref2.length; _j < _len3; _j++) {
      a = _ref2[_j];
      _ref3 = _extractFandAs(a), f = _ref3.f, as = _ref3.as;
      blank[as] = f([]);
    }
    output = [];
    for (_k = 0, _len4 = temp.length; _k < _len4; _k++) {
      t = temp[_k];
      row = [];
      for (_l = 0, _len5 = uniqueValues.length; _l < _len5; _l++) {
        u = uniqueValues[_l];
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
      Takes an MVCC style `snapshotArray` array and returns the time series calculations `At` each moment specified by
      the ChartTimeRange spec (`rangeSpec`) within the config object.
      
      This is really just a thin wrapper around various ChartTime calculations, so look at the documentation for each of
      those to get the detail picture of what this timeSeriesCalculator does. The general flow is:
      
      1. Use `ChartTimeRange` and `ChartTimeIterator` against the `rangeSpec` to find the points for the x-axis.
         We're interested in the ends of those time ranges so the output of this work is a `listOfAtCTs` array.
      2. Use `snapshotArray_To_AtArray` to figure out what state those objects were in at each point in the `listOfAtCTs` array.
         The output of this operation is called an `atArray`
      3. Use `deriveFieldsAt` to add fields in each object in the `atArray` whose values are derived from the other fields in the object.
      4. Use `aggregateAt` to calculate aggregations into an `aggregationAtArray` which contains chartable values.
      
      Note: We assume the snapshotArray is sorted by the config.snapshotValidFromField
    */
    var aggregationAtArray, atArray, listOfAtCTs, r, range, subRanges;
    range = new ChartTimeRange(config.rangeSpec);
    subRanges = range.getIterator('ChartTimeRange').getAll();
    listOfAtCTs = (function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = subRanges.length; _i < _len; _i++) {
        r = subRanges[_i];
        _results.push(r.pastEnd);
      }
      return _results;
    })();
    atArray = snapshotArray_To_AtArray(snapshotArray, listOfAtCTs, config.snapshotValidFromField, config.snapshotUniqueID, config.timezone);
    deriveFieldsAt(atArray, config.derivedFields);
    aggregationAtArray = aggregateAt(atArray, config.aggregations);
    return {
      listOfAtCTs: listOfAtCTs,
      aggregationAtArray: aggregationAtArray
    };
  };

  timeSeriesGroupByCalculator = function(snapshotArray, config) {
    /*
      Takes an MVCC syle `snapshotArray` array and returns the data groupedBy a particular field `At` each moment specified by
      the ChartTimeRange spec (`rangeSpec`) within the config object. 
      
      This is really just a thin wrapper around various ChartTime calculations, so look at the documentation for each of
      those to get the detail picture of what this timeSeriesGroupByCalculator does. The general flow is:
      
      1. Use `ChartTimeRange` and `ChartTimeIterator` against the `rangeSpec` to find the points for the x-axis.
         We're interested in the ends of those time ranges so the output of this work is a `listOfAtCTs` array.
      2. Use `snapshotArray_To_AtArray` to figure out what state those objects were in at each point in the `listOfAtCTs` array.
         The output of this operation is called an `atArray`
      3. Use `groupByAt` to create a `groupByAtArray` of grouped aggregations to chart
    
      Note: We assume the snapshotArray is sorted by the config.snapshotValidFromField
    */
    var aggregationSpec, atArray, groupByAtArray, listOfAtCTs, r, range, subRanges, v, _i, _len, _ref2;
    range = new ChartTimeRange(config.rangeSpec);
    subRanges = range.getIterator('ChartTimeRange').getAll();
    listOfAtCTs = (function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = subRanges.length; _i < _len; _i++) {
        r = subRanges[_i];
        _results.push(r.pastEnd);
      }
      return _results;
    })();
    atArray = snapshotArray_To_AtArray(snapshotArray, listOfAtCTs, config.snapshotValidFromField, config.snapshotUniqueID, config.timezone);
    aggregationSpec = {
      groupBy: config.groupByField,
      uniqueValues: utils.clone(config.groupByFieldValues),
      aggregations: [
        {
          as: 'GroupBy',
          field: config.aggregationField,
          f: config.aggregationFunction
        }, {
          as: 'DrillDown',
          field: 'ObjectID',
          f: '$push'
        }
      ]
    };
    groupByAtArray = groupByAt(atArray, aggregationSpec);
    if ((config.groupByFieldValues != null) && config.groupByFieldValues.length < aggregationSpec.uniqueValues.length) {
      console.error('WARNING: Data found for values that are not in config.groupByFieldValues. Data found for values:');
      _ref2 = aggregationSpec.uniqueValues;
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        v = _ref2[_i];
        if (__indexOf.call(config.groupByFieldValues, v) < 0) {
          console.error('    ' + v);
        }
      }
    }
    return {
      listOfAtCTs: listOfAtCTs,
      groupByAtArray: groupByAtArray,
      uniqueValues: utils.clone(aggregationSpec.uniqueValues)
    };
  };

  exports.functions = functions;

  exports.percentileCreator = percentileCreator;

  exports.aggregate = aggregate;

  exports.aggregateAt = aggregateAt;

  exports.groupBy = groupBy;

  exports.groupByAt = groupByAt;

  exports.timeSeriesCalculator = timeSeriesCalculator;

  exports.timeSeriesGroupByCalculator = timeSeriesGroupByCalculator;

}).call(this);

});

require.define("/utils.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var AssertException, ErrorBase, StopIteration, assert, clone, isArray, match, trim, type;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  exports.MAX_INT = 2147483647;

  exports.MIN_INT = -2147483648;

  ErrorBase = (function() {

    __extends(ErrorBase, Error);

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

  })();

  AssertException = (function() {

    __extends(AssertException, ErrorBase);

    function AssertException() {
      AssertException.__super__.constructor.apply(this, arguments);
    }

    return AssertException;

  })();

  StopIteration = (function() {

    __extends(StopIteration, ErrorBase);

    function StopIteration() {
      StopIteration.__super__.constructor.apply(this, arguments);
    }

    return StopIteration;

  })();

  assert = function(exp, message) {
    if (!exp) throw new exports.AssertException(message);
  };

  match = function(obj1, obj2) {
    var key, value;
    for (key in obj1) {
      if (!__hasProp.call(obj1, key)) continue;
      value = obj1[key];
      if (value !== obj2[key]) return false;
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
    if (!(obj != null) || typeof obj !== 'object') return obj;
    newInstance = new obj.constructor();
    for (key in obj) {
      newInstance[key] = clone(obj[key]);
    }
    return newInstance;
  };

  exports.AssertException = AssertException;

  exports.StopIteration = StopIteration;

  exports.assert = assert;

  exports.match = match;

  exports.trim = trim;

  exports.isArray = isArray;

  exports.type = type;

  exports.clone = clone;

}).call(this);

});

require.define("/ChartTime.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var ChartTime, timezoneJS, utils;
  var __hasProp = Object.prototype.hasOwnProperty, __indexOf = Array.prototype.indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (__hasProp.call(this, i) && this[i] === item) return i; } return -1; };

  utils = require('./utils');

  timezoneJS = require('timezone-js').timezoneJS;

  ChartTime = (function() {

    /*
      # ChartTime #
      
      _Time axis creation/manipulation for charts_
      
      ## Features ##
      
      * Generate the values for time series chart axis
      * Allows for custom granularities like release/iteration/iteration_day
      * Knockout weekends and holidays (ChartTimeIterator)
      * Knockout non-work hours (ChartTimeIterator)
      * Drill up and down granularity
      * Work with precision around timezone differences
      * Month is 1-indexed instead of 0-indexed like Javascript's Date object
      * Date/Time math (add 3 months, subtract 2 weeks, etc.)
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
      Deciding if a piece of work finished in one iteration versus another can make a difference for
      you iteration metrics. The iteration metrics for a distributed team should look the same regardless
      of whether those metrics were generated in New York versus Los Angeles... versus Bangalore.
      
      The javascript Date object lets you work in either the local time or Zulu (GMT/UTC) time but it doesn't let you
      control the timezone. Do you know the correct way to apply the timezone shift to a JavaScript Date Object? 
      Do you know when Daylight Savings Time kicks in and New York is 4 hours shifted from GMT instead of 5? Will
      you remember to do it perfectly every time it's needed in your code?
      
      If you need this precision, ChartTime helps by clearly delineating the moment when you need to do 
      timezone manipulation... the moment you need to compare two or more dates. You can do all of your
      holiday/weekend knockout manipulation without regard to timezone and only consider the timezone
      upon comparison. 
      
      ## Month is 1-indexed as you would expect ##
      
      Javascript's date object uses 0 for January and 11 for December. ChartTime uses 1 for January and 12 for December...
      which is what ISO-8601 uses and what humans expect. Everyone who works with the javascript Date Object at one
      point or another gets burned by this.
      
      ## Week support ##
      
      ChartTime follows ISO-8601 where ever it makes sense. Implications of using this ISO format (paraphrased info from wikipedia):
      
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
          
          d1 = new ChartTime({granularity: 'day', year: 2011, month: 2, day: 28})
          console.log(d1.toString())
          # 2011-02-28
          
      You can use the string short-hand rather than spell out the segments seperately. The granularity
      is automatically inferred from how many segments you provide.
      
          d2 = new ChartTime('2011-03-01')
          console.log(d2.toString())
          # 2011-03-01
          
      Increment/decrement and compare ChartTimes without regard to timezone
      
          console.log(d1.$gte(d2)) 
          d1.increment()
          console.log(d1.$eq(d2))
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
          console.log(w1.inGranularity('day').toString())
          # 2005-01-01
          
      Convert between any of the standard granularities. Also converts custom granularities (not shown) to
      standard granularities if you provide a `rataDieNumber()` function with your custom granularities.
      
          d5 = new ChartTime('2005-01-01')  # goes the other direction also
          console.log(d5.inGranularity('week_day').toString())
          # 2004W53-6
          
          q1 = new ChartTime('2011Q3')
          console.log(q1.inGranularity('millisecond').toString())
          # 2011-07-01T00:00:00.000
          
      ## Timezones ##
      
      ChartTime does timezone sensitive conversions. You must set the path to the tz files before doing any timezone sensitive comparisons.
      
          ChartTime.setTZPath('../vendor/tz')
          
          console.log(new ChartTime('2011-01-01').getJSDate('America/New_York'))
          # Sat, 01 Jan 2011 05:00:00 GMT
    */

    var g, spec, _ref;

    function ChartTime(spec_RDN_Date_Or_String, granularity, tz) {
      /*
          The constructor for ChartTime supports the passing in of a String, a rata die number (RDN), or a spec Object
          
          ## String ##
          
          When you pass in a **String**, ChartTime uses the masks that are defined for each granularity to figure out the granularity...
          unless you explicitly provide a granularity. This parser does not work on all valid ISO-8601 forms. Ordinal dates are not 
          supported at all but week number form (`"2009W52-7"`) is supported. The canonical form (`"2009-01-01T12:34:56.789"`) will work
          as will any shortened subset of it (`"2009-01-01"`, `"2009-01-01T12:34"`, etc.). We've added a form for Quarter
          granularity (`"2009Q4"`). Plus it will even parse strings in whatever custom granularity you provide based
          upon the mask that you provide for that granularity.
          
          If the granularity is specified but not all of the segments are provided, ChartTime will fill in the missing value 
          with the `lowest` value from granularitySpecs.
          
          The Lumenize hierarchy tools rely upon the property that a single character is used between segments so the ISO forms that 
          omit the delimeters are not supported.
          
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
          option is even really useful. In most cases, you are probably better off using ChartTime.getZuluString()
          
          ## Spec ##
          
          You can also explicitly spell out the segments in a **spec** Object in the form of 
          `{granularity: 'day', year: 2009, month: 1, day: 1}`. If the granularity is specified but not all of the segments are 
          provided, ChartTime will fill in the missing value with the appropriate `lowest` value from granularitySpecs.
          
          ## granularity ##
          
          If you provide a granularity it will take precedence over whatever fields you've provided in your spec or whatever segments
          you have provided in your string. ChartTime will leave off extra values and fill in missing ones with the appropriate `lowest`
          value.
          
          ## tz ##
          
          Most of the time, ChartTime assumes that any dates you pass in are timezone less. You'll specify Christmas as 12-25, then you'll
          shift the boundaries of Christmas for a specific timezone for boundary comparison.
          
          However, if you provide a tz parameter to this constructor, ChartTime will assume you are passing in a true GMT date/time and shift into 
          the provided timezone. So...
          
              d = new ChartTime('2011-01-01T02:00:00:00.000Z', 'day', 'America/New_York')
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
      switch (utils.type(spec_RDN_Date_Or_String)) {
        case 'string':
          s = spec_RDN_Date_Or_String;
          if (tz != null) {
            newCT = new ChartTime(s, 'millisecond');
            jsDate = newCT.getJSDateInTZfromGMT(tz);
          } else {
            this._setFromString(s, granularity);
          }
          break;
        case 'number':
          rdn = spec_RDN_Date_Or_String;
          if (tz != null) {
            newCT = new ChartTime(rdn, 'millisecond');
            jsDate = newCT.getJSDateInTZfromGMT(tz);
          } else {
            this._setFromRDN(rdn, granularity);
          }
          break;
        case 'date':
          jsDate = spec_RDN_Date_Or_String;
          if (tz == null) tz = 'GMT';
          break;
        case 'object':
          spec = spec_RDN_Date_Or_String;
          if (tz != null) {
            spec.granularity = 'millisecond';
            newCT = new ChartTime(spec);
            jsDate = newCT.getJSDateInTZfromGMT(tz);
          } else {
            this._setFromSpec(spec);
          }
      }
      if (tz != null) {
        if ((_ref = this.beforePastFlag) === 'BEFORE_FIRST' || _ref === 'PAST_LAST') {
          throw new Error("Cannot do timezone manipulation on " + this.beforePastFlag);
        }
        if (granularity != null) this.granularity = granularity;
        if (this.granularity == null) this.granularity = 'millisecond';
        newSpec = {
          year: jsDate.getUTCFullYear(),
          month: jsDate.getUTCMonth() + 1,
          day: jsDate.getUTCDate(),
          hour: jsDate.getUTCHours(),
          minute: jsDate.getUTCMinutes(),
          second: jsDate.getUTCSeconds(),
          millisecond: jsDate.getUTCMilliseconds(),
          granularity: this.granularity
        };
        this._setFromSpec(newSpec);
      }
      this._inBoundsCheck();
      this._overUnderFlow();
    }

    ChartTime.granularitySpecs = {};

    ChartTime.granularitySpecs['millisecond'] = {
      segments: ['year', 'month', 'day', 'hour', 'minute', 'second', 'millisecond'],
      mask: '####-##-##T##:##:##.###',
      lowest: 0,
      pastHighest: function() {
        return 1000;
      }
    };

    ChartTime.granularitySpecs['second'] = {
      segments: ['year', 'month', 'day', 'hour', 'minute', 'second'],
      mask: '####-##-##T##:##:##',
      lowest: 0,
      pastHighest: function() {
        return 60;
      }
    };

    ChartTime.granularitySpecs['minute'] = {
      segments: ['year', 'month', 'day', 'hour', 'minute'],
      mask: '####-##-##T##:##',
      lowest: 0,
      pastHighest: function() {
        return 60;
      }
    };

    ChartTime.granularitySpecs['hour'] = {
      segments: ['year', 'month', 'day', 'hour'],
      mask: '####-##-##T##',
      lowest: 0,
      pastHighest: function() {
        return 24;
      }
    };

    ChartTime.granularitySpecs['day'] = {
      segments: ['year', 'month', 'day'],
      mask: '####-##-##',
      lowest: 1,
      pastHighest: function(ct) {
        return ct.daysInMonth() + 1;
      }
    };

    ChartTime.granularitySpecs['month'] = {
      segments: ['year', 'month'],
      mask: '####-##',
      lowest: 1,
      pastHighest: function() {
        return 12 + 1;
      }
    };

    ChartTime.granularitySpecs['year'] = {
      segments: ['year'],
      mask: '####',
      lowest: 1,
      pastHighest: function() {
        return 9999 + 1;
      }
    };

    ChartTime.granularitySpecs['week'] = {
      segments: ['year', 'week'],
      mask: '####W##',
      lowest: 1,
      pastHighest: function(ct) {
        if (ct.is53WeekYear()) {
          return 53 + 1;
        } else {
          return 52 + 1;
        }
      }
    };

    ChartTime.granularitySpecs['week_day'] = {
      segments: ['year', 'week', 'week_day'],
      mask: '####W##-#',
      lowest: 1,
      pastHighest: function(ct) {
        return 7 + 1;
      }
    };

    ChartTime.granularitySpecs['quarter'] = {
      segments: ['year', 'quarter'],
      mask: '####Q#',
      lowest: 1,
      pastHighest: function() {
        return 4 + 1;
      }
    };

    ChartTime._expandMask = function(granularitySpec) {
      var char, i, mask, segmentEnd;
      mask = granularitySpec.mask;
      if (mask != null) {
        if (mask.indexOf('#') >= 0) {
          i = mask.length - 1;
          while (mask[i] !== '#') {
            i--;
          }
          segmentEnd = i;
          while (mask[i] === '#') {
            i--;
          }
          granularitySpec.segmentStart = i + 1;
          granularitySpec.segmentLength = segmentEnd - i;
          return granularitySpec.regex = new RegExp(((function() {
            var _i, _len, _ref, _results;
            _ref = mask.split('');
            _results = [];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              char = _ref[_i];
              _results.push(char === '#' ? '\\d' : char);
            }
            return _results;
          })()).join(''));
        } else {
          return granularitySpec.regex = new RegExp(mask);
        }
      }
    };

    _ref = ChartTime.granularitySpecs;
    for (g in _ref) {
      spec = _ref[g];
      ChartTime._expandMask(spec);
    }

    ChartTime.prototype._inBoundsCheck = function() {
      var gs, lowest, pastHighest, segment, segments, temp, _i, _len, _results;
      if (this.beforePastFlag === '' || !(this.beforePastFlag != null)) {
        segments = ChartTime.granularitySpecs[this.granularity].segments;
        _results = [];
        for (_i = 0, _len = segments.length; _i < _len; _i++) {
          segment = segments[_i];
          gs = ChartTime.granularitySpecs[segment];
          temp = this[segment];
          lowest = gs.lowest;
          pastHighest = gs.pastHighest(this);
          if (temp < lowest || temp >= pastHighest) {
            if (temp === lowest - 1) {
              this[segment]++;
              _results.push(this.decrement(segment));
            } else if (temp === pastHighest) {
              this[segment]--;
              _results.push(this.increment(segment));
            } else {
              throw new Error("Tried to set " + segment + " to " + temp + ". It must be >= " + lowest + " and < " + pastHighest);
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
      segments = ChartTime.granularitySpecs[this.granularity].segments;
      _results = [];
      for (_i = 0, _len = segments.length; _i < _len; _i++) {
        segment = segments[_i];
        if (spec[segment] != null) {
          _results.push(this[segment] = spec[segment]);
        } else {
          _results.push(this[segment] = ChartTime.granularitySpecs[segment].lowest);
        }
      }
      return _results;
    };

    ChartTime.prototype._setFromString = function(s, granularity) {
      var g, gs, l, segment, segments, spec, stillParsing, sub, _i, _len, _ref2, _ref3, _results;
      if (s.slice(-3, -2) === ':' && (_ref2 = s.slice(-6, -5), __indexOf.call('+-', _ref2) >= 0)) {
        console.log("WARNING: Ignoring the timeshift information at the end of " + s + ".");
        s = s.slice(0, -6);
      }
      if (s.slice(-1) === 'Z') s = s.slice(0, -1);
      if (s === 'PAST_LAST' || s === 'BEFORE_FIRST') {
        if (granularity != null) {
          this.granularity = granularity;
          this.beforePastFlag = s;
          return;
        } else {
          throw new Error('PAST_LAST/BEFORE_FIRST must have a granularity');
        }
      }
      _ref3 = ChartTime.granularitySpecs;
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
      segments = ChartTime.granularitySpecs[this.granularity].segments;
      stillParsing = true;
      _results = [];
      for (_i = 0, _len = segments.length; _i < _len; _i++) {
        segment = segments[_i];
        if (stillParsing) {
          gs = ChartTime.granularitySpecs[segment];
          l = gs.segmentLength;
          sub = ChartTime._getStringPart(s, segment);
          if (sub.length !== l) stillParsing = false;
        }
        if (stillParsing) {
          _results.push(this[segment] = Number(sub));
        } else {
          _results.push(this[segment] = ChartTime.granularitySpecs[segment].lowest);
        }
      }
      return _results;
    };

    ChartTime._getStringPart = function(s, segment) {
      var l, st, sub;
      spec = ChartTime.granularitySpecs[segment];
      l = spec.segmentLength;
      st = spec.segmentStart;
      sub = s.substr(st, l);
      return sub;
    };

    ChartTime.prototype._setFromRDN = function(rdn, granularity) {
      var J, a, afterCT, afterRDN, b, beforeCT, beforeRDN, c, d, da, db, dc, dg, granularitySpec, j, m, n, segment, specForLowest, w, x, y, z, _i, _len, _ref2;
      spec = {
        granularity: granularity
      };
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
          granularitySpec = ChartTime.granularitySpecs[granularity];
          specForLowest = {
            granularity: granularity
          };
          _ref2 = granularitySpec.segments;
          for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
            segment = _ref2[_i];
            specForLowest[segment] = ChartTime.granularitySpecs[segment].lowest;
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
              if (rdn >= ChartTime.granularitySpecs[beforeCT.granularity].dayPastEnd.rataDieNumber()) {
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

    ChartTime.prototype.granularityAboveDay = function() {
      /*
          Convenience function to tell if the ChartTime Object's granularity is above (courser than) "day" level.
      */
      var segment, _i, _len, _ref2;
      _ref2 = ChartTime.granularitySpecs[this.granularity].segments;
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        segment = _ref2[_i];
        if (segment.indexOf('day') >= 0) return false;
      }
      return true;
    };

    ChartTime.setTZPath = function(tzPath) {
      /*
          Allows you to set the path (can be relative) to the tz files. Must be called prior to doing timezone sensitive comparisons.
      */      timezoneJS.timezone.zoneFileBasePath = tzPath;
      return timezoneJS.timezone.init();
    };

    ChartTime.prototype.getJSDate = function(tz) {
      /*
          Returns a JavaScript Date Object properly shifted. This Date Object can be compared to other Date Objects that you know
          are already in the desired timezone. If you have data that comes from an API in GMT. You can first create a ChartTime object from
          it and then (using this getJSDate() function) you can compare it to JavaScript Date Objects created in local time.
          
          The full name of this function should be getJSDateInGMTasummingThisCTDateIsInTimezone(tz). It converts **TO** GMT 
          (actually something that can be compared to GMT). It does **NOT** convert **FROM** GMT. Use getJSDateInTZfromGMT()
          if you want to go in the other direction.
          
          Note, you must set the path to the tz files with `ChartTime.setTZPath('path/to/tz/files')` before you do timezone 
          sensitive comparisions.
        
          ## Usage ##
          
              ct = new ChartTime('2011-01-01')
              d = new Date(Date.UTC(2011, 0, 1))
              
              console.log(ct.getJSDate('GMT').getTime() == d.getTime())
              # true
              
              console.log(ct.inGranularity('hour').add(-5).getJSDate('America/New_York').getTime() == d.getTime())
              # true
      */
      var ct, newDate, offset, utcMilliseconds;
      if (this.beforePastFlag === 'PAST_LAST') return new Date(9999, 0, 1);
      if (this.beforePastFlag === 'BEFORE_FIRST') return new Date('0001-01-01');
      utils.assert(tz != null, 'Must provide a timezone when calling getJSDate');
      utils.assert(timezoneJS.timezone.zoneFileBasePath != null, 'Call ChartTime.setTZPath("path/to/tz/files") before calling getJSDate');
      ct = this.inGranularity('millisecond');
      utcMilliseconds = Date.UTC(ct.year, ct.month - 1, ct.day, ct.hour, ct.minute, ct.second, ct.millisecond);
      offset = timezoneJS.timezone.getTzInfo(new Date(utcMilliseconds), tz).tzOffset;
      utcMilliseconds += offset * 1000 * 60;
      newDate = new Date(utcMilliseconds);
      return newDate;
    };

    ChartTime.prototype.getJSDateString = function(tz) {
      /*
          Returns the canonical ISO-8601 date in zulu representation but shifted to the specified tz
      */
      var jsDate;
      jsDate = this.getJSDate(tz);
      return ChartTime.getZuluString(jsDate);
    };

    ChartTime.getZuluString = function(jsDate) {
      /*
          Given a JavaScript Date() Object, this will return the canonical ISO-8601 form.
          
          If you don't provide any parameters, it will return now, like `new Date()` except this is a zulu string.
      */
      var day, hour, millisecond, minute, month, s, second, year;
      if (jsDate == null) jsDate = new Date();
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

    ChartTime.prototype.getJSDateInTZfromGMT = function(tz) {
      /*
          This assumes that the ChartTime is an actual GMT date/time as opposed to some abstract day like Christmas and shifts
          it into the specified timezone.
          
          Note, this function will be off by an hour for the times near midnight on the days where there is a shift to/from daylight 
          savings time. The tz rules engine is designed to go in the other direction so we're mis-using it and will be using the wrong
          moment in rules-space for that hour. The cost of fixing this issue was deamed to high for chart applications.
      */
      var ct, newDate, offset, utcMilliseconds;
      if (this.beforePastFlag === 'PAST_LAST') return new Date(9999, 0, 1);
      if (this.beforePastFlag === 'BEFORE_FIRST') return new Date('0001-01-01');
      utils.assert(tz != null, 'Must provide a timezone when calling getJSDate');
      utils.assert(timezoneJS.timezone.zoneFileBasePath != null, 'Call ChartTime.setTZPath("path/to/tz/files") before calling getJSDate');
      ct = this.inGranularity('millisecond');
      utcMilliseconds = Date.UTC(ct.year, ct.month - 1, ct.day, ct.hour, ct.minute, ct.second, ct.millisecond);
      offset = timezoneJS.timezone.getTzInfo(new Date(utcMilliseconds), tz).tzOffset;
      utcMilliseconds -= offset * 1000 * 60;
      newDate = new Date(utcMilliseconds);
      return newDate;
    };

    ChartTime.prototype.toString = function() {
      /*
          Uses granularity `mask` to generate the string representation.
      */
      var after, before, granularitySpec, l, s, segment, segments, start, _i, _len, _ref2;
      if ((_ref2 = this.beforePastFlag) === 'BEFORE_FIRST' || _ref2 === 'PAST_LAST') {
        s = "" + this.beforePastFlag;
      } else {
        s = ChartTime.granularitySpecs[this.granularity].mask;
        segments = ChartTime.granularitySpecs[this.granularity].segments;
        for (_i = 0, _len = segments.length; _i < _len; _i++) {
          segment = segments[_i];
          granularitySpec = ChartTime.granularitySpecs[segment];
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
          Returns the day of the week as a number. Monday = 1, Sunday = 7
      */
      var dayNumber, y, _ref2;
      if (this.granularity === 'week_day') return this.week_day;
      if ((_ref2 = this.granularity) === 'day' || _ref2 === 'hour' || _ref2 === 'minute' || _ref2 === 'second' || _ref2 === 'millisecond') {
        y = this.year;
        if (this.month < 3) y--;
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
          Returns the day of the week as a String.
      */      return ChartTime.DOW_N_TO_S_MAP[this.dowNumber()];
    };

    ChartTime.prototype.rataDieNumber = function() {
      /*
          Returns the number of days since 0001-01-01. Works for granularities finer than day (hour, minute, second, millisecond) but ignores the 
          segments of finer granularity than day.
      */
      var ew, monthDays, y, yearDays;
      if (this.beforePastFlag === 'BEFORE_FIRST') {
        return -1;
      } else if (this.beforePastFlag === 'PAST_LAST') {
        return utils.MAX_INT;
      } else if (ChartTime.granularitySpecs[this.granularity].rataDieNumber != null) {
        return ChartTime.granularitySpecs[this.granularity].rataDieNumber(this);
      } else {
        y = this.year - 1;
        yearDays = y * 365 + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400);
        ew = Math.floor((yearDays + 3) / 7);
        if (this.month != null) {
          monthDays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334][this.month - 1];
          if (this.isLeapYear() && this.month >= 3) monthDays++;
        } else if (this.quarter != null) {
          monthDays = [0, 90, 181, 273][this.quarter - 1];
          if (this.isLeapYear() && this.quarter >= 2) monthDays++;
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
          Returns a new ChartTime object for the same date-time as this object but in the specified granularity.
          Fills in missing finer granularity bits with `lowest` values.
      */
      var newChartTime, tempGranularity, _ref2;
      if ((_ref2 = this.granularity) === 'year' || _ref2 === 'month' || _ref2 === 'day' || _ref2 === 'hour' || _ref2 === 'minute' || _ref2 === 'second' || _ref2 === 'millisecond') {
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
          Returns the number of days in the current month for this ChartTime
      */      switch (this.month) {
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
          True if this is a leap year.
      */      if (this.year % 4 === 0) {
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
          True if this is a 53-week year.
      */
      var lookup;
      lookup = this.year % 400;
      return __indexOf.call(ChartTime.YEARS_WITH_53_WEEKS, lookup) >= 0;
    };

    ChartTime.prototype.$eq = function(other) {
      /*
          Returns true if this equals other. Throws an error if the granularities don't match.
      
              d3 = new ChartTime({granularity: 'day', year: 2011, month: 12, day: 31})
              d4 = new ChartTime('2012-01-01').add(-1)
              console.log(d3.$eq(d4))
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
      segments = ChartTime.granularitySpecs[this.granularity].segments;
      for (_i = 0, _len = segments.length; _i < _len; _i++) {
        segment = segments[_i];
        if (this[segment] !== other[segment]) return false;
      }
      return true;
    };

    ChartTime.prototype.$gt = function(other) {
      /*
          Returns true if this is greater than other. Throws an error if the granularities don't match
      
              d1 = new ChartTime({granularity: 'day', year: 2011, month: 2, day: 28})
              d2 = new ChartTime({granularity: 'day', year: 2011, month: 3, day: 1})
              console.log(d1.$gt(d2))
              # false
              console.log(d2.$gt(d1))
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
      segments = ChartTime.granularitySpecs[this.granularity].segments;
      for (_i = 0, _len = segments.length; _i < _len; _i++) {
        segment = segments[_i];
        if (this[segment] > other[segment]) return true;
        if (this[segment] < other[segment]) return false;
      }
      return false;
    };

    ChartTime.prototype.$gte = function(other) {
      /*
          True if this is greater than or equal to other.
      */
      var gt;
      gt = this.$gt(other);
      if (gt) return true;
      return this.$eq(other);
    };

    ChartTime.prototype.$lt = function(other) {
      /*
          True if this is less than other.
      */      return other.$gt(this);
    };

    ChartTime.prototype.$lte = function(other) {
      /*
          True if this is less than or equal to other.
      */      return other.$gte(this);
    };

    ChartTime.prototype._overUnderFlow = function() {
      var granularitySpec, highestLevel, highestLevelSpec, lowest, pastHighest, value, _ref2;
      if ((_ref2 = this.beforePastFlag) === 'BEFORE_FIRST' || _ref2 === 'PAST_LAST') {
        return true;
      } else {
        granularitySpec = ChartTime.granularitySpecs[this.granularity];
        highestLevel = granularitySpec.segments[0];
        highestLevelSpec = ChartTime.granularitySpecs[highestLevel];
        value = this[highestLevel];
        pastHighest = highestLevelSpec.pastHighest(this);
        lowest = highestLevelSpec.lowest;
        if (value >= pastHighest) {
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
          Decrements by 1.
      */
      var granularitySpec, gs, i, lastDayInMonthFlag, segment, segments, _i, _len, _results;
      if (this.beforePastFlag === 'PAST_LAST') {
        this.beforePastFlag = '';
        granularitySpec = ChartTime.granularitySpecs[this.granularity];
        segments = granularitySpec.segments;
        _results = [];
        for (_i = 0, _len = segments.length; _i < _len; _i++) {
          segment = segments[_i];
          gs = ChartTime.granularitySpecs[segment];
          _results.push(this[segment] = gs.pastHighest(this) - 1);
        }
        return _results;
      } else {
        lastDayInMonthFlag = this.day === this.daysInMonth();
        if (granularity == null) granularity = this.granularity;
        granularitySpec = ChartTime.granularitySpecs[granularity];
        segments = granularitySpec.segments;
        this[granularity]--;
        if (granularity === 'year') {
          if (this.day > this.daysInMonth()) this.day = this.daysInMonth();
        } else {
          i = segments.length - 1;
          segment = segments[i];
          granularitySpec = ChartTime.granularitySpecs[segment];
          while ((i > 0) && (this[segment] < granularitySpec.lowest)) {
            this[segments[i - 1]]--;
            this[segment] = granularitySpec.pastHighest(this) - 1;
            i--;
            segment = segments[i];
            granularitySpec = ChartTime.granularitySpecs[segment];
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
          Increments by 1.
      */
      var granularitySpec, gs, i, lastDayInMonthFlag, segment, segments, _i, _len, _results;
      if (this.beforePastFlag === 'BEFORE_FIRST') {
        this.beforePastFlag = '';
        granularitySpec = ChartTime.granularitySpecs[this.granularity];
        segments = granularitySpec.segments;
        _results = [];
        for (_i = 0, _len = segments.length; _i < _len; _i++) {
          segment = segments[_i];
          gs = ChartTime.granularitySpecs[segment];
          _results.push(this[segment] = gs.lowest);
        }
        return _results;
      } else {
        lastDayInMonthFlag = this.day === this.daysInMonth();
        if (granularity == null) granularity = this.granularity;
        granularitySpec = ChartTime.granularitySpecs[granularity];
        segments = granularitySpec.segments;
        this[granularity]++;
        if (granularity === 'year') {
          if (this.day > this.daysInMonth()) this.day = this.daysInMonth();
        } else {
          i = segments.length - 1;
          segment = segments[i];
          granularitySpec = ChartTime.granularitySpecs[segment];
          while ((i > 0) && (this[segment] >= granularitySpec.pastHighest(this))) {
            this[segment] = granularitySpec.lowest;
            this[segments[i - 1]]++;
            i--;
            segment = segments[i];
            granularitySpec = ChartTime.granularitySpecs[segment];
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
          Adds qty to the ChartTime object. It uses increment and decrement so it's not going to be efficient for large values
          of qty, but it should be fine for charts where we'll increment/decrement small values of qty.
      
          qty can be negative for subtraction.
      */      if (granularity == null) granularity = this.granularity;
      if (qty === 0) return;
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
          Adds (or subtracts) quantity (negative quantity) and returns a new ChartTime.
      */
      var newChartTime;
      newChartTime = new ChartTime(this);
      newChartTime.addInPlace(qty, granularity);
      return newChartTime;
    };

    ChartTime.addGranularity = function(granularitySpec) {
      /*
          addGranularity allows you to add your own hierarchical granularities to ChartTime. Once you add a granularity to ChartTime
          you can then instantiate ChartTime objects in your newly specified granularity. You specify new granularities with 
          granularitySpec object like this:
              
              granularitySpec = {
                release: {
                  segments: ['release'],
                  mask: 'R##',
                  lowest: 1,
                  dayPastEnd: new ChartTime('2011-07-01')
                  pastHighest: (ct) ->
                    return ChartTime.granularitySpecs.iteration.timeBoxes.length + 1  # Yes, it's correct to use the length of iteration.timeBoxes
                  rataDieNumber: (ct) ->
                    return ChartTime.granularitySpecs.iteration.timeBoxes[ct.release-1][1-1].start.rataDieNumber()
                },
                iteration: {
                  segments: ['release', 'iteration'],
                  mask: 'R##I##',
                  lowest: 1,
                  dayPastEnd: new ChartTime('2011-07-01')        
                  timeBoxes: [
                    [
                      {start: new ChartTime('2011-01-01'), label: 'R1 Iteration 1'},
                      {start: new ChartTime('2011-02-01'), label: 'R1 Iteration 2'},
                      {start: new ChartTime('2011-03-01'), label: 'R1 Iteration 3'},
                    ],
                    [
                      {start: new ChartTime('2011-04-01'), label: 'R2 Iteration 1'},
                      {start: new ChartTime('2011-05-01'), label: 'R2 Iteration 2'},
                      {start: new ChartTime('2011-06-01'), label: 'R2 Iteration 3'},
                    ]
                  ]
                  pastHighest: (ct) ->
                    temp = ChartTime.granularitySpecs.iteration.timeBoxes[ct.release-1]?.length + 1
                    if temp? and not isNaN(temp) and ct.beforePastFlag != 'PAST_LAST'
                      return temp
                    else
                      numberOfReleases = ChartTime.granularitySpecs.iteration.timeBoxes.length
                      return ChartTime.granularitySpecs.iteration.timeBoxes[numberOfReleases-1].length + 1
          
                  rataDieNumber: (ct) ->
                    return ChartTime.granularitySpecs.iteration.timeBoxes[ct.release-1][ct.iteration-1].start.rataDieNumber()
                },
                iteration_day: {  # By convention, it knows to use day functions on it. This is the lowest allowed custom granularity
                  segments: ['release', 'iteration', 'iteration_day'],
                  mask: 'R##I##-##',
                  lowest: 1,
                  dayPastEnd: new ChartTime('2011-07-01'),
                  pastHighest: (ct) ->
                    iterationTimeBox = ChartTime.granularitySpecs.iteration.timeBoxes[ct.release-1]?[ct.iteration-1]
                    if !iterationTimeBox? or ct.beforePastFlag == 'PAST_LAST'
                      numberOfReleases = ChartTime.granularitySpecs.iteration.timeBoxes.length
                      numberOfIterationsInLastRelease = ChartTime.granularitySpecs.iteration.timeBoxes[numberOfReleases-1].length
                      iterationTimeBox = ChartTime.granularitySpecs.iteration.timeBoxes[numberOfReleases-1][numberOfIterationsInLastRelease-1]
                      
                    thisIteration = iterationTimeBox.start.inGranularity('iteration')
                    nextIteration = thisIteration.add(1)
                    if nextIteration.beforePastFlag == 'PAST_LAST'
                      return ChartTime.granularitySpecs.iteration_day.dayPastEnd.rataDieNumber() - iterationTimeBox.start.rataDieNumber() + 1
                    else
                      return nextIteration.rataDieNumber() - iterationTimeBox.start.rataDieNumber() + 1 
                     
                  rataDieNumber: (ct) ->
                    return ChartTime.granularitySpecs.iteration.timeBoxes[ct.release-1][ct.iteration-1].start.rataDieNumber() + ct.iteration_day - 1
                }
              }    
              ChartTime.addGranularity(granularitySpec)
      
          
          The `mask` must cover all of the segments to get down to the granularity being specified. The digits of the granularity segments
          are represented with `#`. Any other characters can be used as a delimeter, but it should always be one character to comply with 
          the expectations of the Lumenize hierarchy visualizations. All of the standard granularities start with a 4-digit year to
          distinguish your custom granularity, your highest level must start with some number of digits other than 4 or a prefix letter 
          (`R` in the example above).
          
          In order for the ChartTimeIterator to work, you must provide `pastHighest` and `rataDieNumber` callback functions. You should
          be able to mimic (or use as-is) the example above for most use cases. Notice how the `rataDieNumber` function simply leverages
          `rataDieNumber` functions for the standard granularities.
          
          In order to convert into this granularity from some other granularity, you must provide an `inGranularity` callback [NOT YET IMPLEMENTED].
          But ChartTime will convert to any of the standard granularities from even custom granularities as long as a `rataDieNumber()` function
          is provided.
          
          **The `timeBoxes` propoerty in the `granularitySpec` Object above has no special meaning** to ChartTime or ChartTimeIterator. It's simply used
          by the `pastHighest` and `rataDieNumber` functions. The boundaries could come from where ever you want and even have been encoded as
          literals in the `pastHighest` and `rataDieNumber` callback functions.
          
          The convention of naming the lowest order granularity with `_day` at the end IS signficant. ChartTime knows to treat that as a day-level
          granularity. If there is a use-case for it, ChartTime could be upgraded to allow you to drill down into hours, minutes, etc. from any
          `_day` granularity but right now those lower order time granularities are only supported for the canonical ISO-6801 form.
      */
      var g, spec, _results;
      _results = [];
      for (g in granularitySpec) {
        spec = granularitySpec[g];
        ChartTime._expandMask(spec);
        _results.push(this.granularitySpecs[g] = spec);
      }
      return _results;
    };

    return ChartTime;

  })();

  exports.ChartTime = ChartTime;

}).call(this);

});

require.define("/node_modules/timezone-js.js", function (require, module, exports, __dirname, __filename) {
/*
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
      if (path.existsSync(url)) {
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
    
/*
    // If running in the browser with a zoneFileBasePath set
    if (typeof XMLHttpRequest == 'undefined') {
      throw new Error('No XMLHttpRequest.');
    } else { 
      xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      var ret = xhr.responseText;
      return _this.parseZones(ret);
    }
*/
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

require.define("fs", function (require, module, exports, __dirname, __filename) {
// nothing to see here... no file methods for the browser

});

require.define("/ChartTimeIteratorAndRange.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var ChartTime, ChartTimeInStateCalculator, ChartTimeIterator, ChartTimeRange, timezoneJS, utils;
  var __hasProp = Object.prototype.hasOwnProperty, __indexOf = Array.prototype.indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (__hasProp.call(this, i) && this[i] === item) return i; } return -1; };

  ChartTime = require('./ChartTime').ChartTime;

  ChartTimeInStateCalculator = require('./ChartTimeInStateCalculator').ChartTimeInStateCalculator;

  timezoneJS = require('timezone-js').timezoneJS;

  utils = require('./utils');

  ChartTimeIterator = (function() {

    /*
      # ChartTimeIterator #
      
      Iterate through days, months, years, etc. skipping weekends and holidays that you 
      specify. It will also iterate over hours, minutes, seconds, etc. and skip times that are not
      between the specified work hours.
      
      ## Usage ##
      
          {ChartTimeIterator, ChartTimeRange, ChartTime} = require('../')
          
          ChartTime.setTZPath('../vendor/tz')
          
          cti = new ChartTimeIterator({
            start:new ChartTime({granularity: 'day', year: 2009, month:1, day: 1}),
            pastEnd:new ChartTime({granularity: 'day', year: 2009, month:1, day: 8}),
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
      var _ref, _ref2, _ref3;
      this.emit = emit != null ? emit : 'ChartTime';
      this.childGranularity = childGranularity != null ? childGranularity : 'day';
      /*
          * **ctr** is a ChartTimeRange or a raw Object with all the necessary properties to be a spec for a new ChartTimeRange.
             Using a ChartTimeRange is now the prefered method. The raw Object is supported for backward compatibility.
          * **emit** is an optional String that specifies what should be emitted. Possible values are 'ChartTime' (default),
             'ChartTimeRange', and 'Date' (javascript Date Object). Note, to maintain backward compatibility with the time
             before ChartTimeRange existed, the default for emit when instantiating a new ChartTimeIterator directly is 
             'ChartTime'. However, if you request a new ChartTimeIterator from a ChartTimeRange object using getIterator(),
             the default is 'ChartTimeRange'.
          * **childGranularity** When emit is 'ChartTimeRange', this is the granularity for the start and pastEnd of the
             ChartTimeRange that is emitted.
          * **tz** is a Sting specifying the timezone in the standard form,`America/New_York` for example.
            
          Note, skip is assumed to be 1 or -1 for emitted ChartTimeRanges
      */
      utils.assert((_ref = this.emit) === 'ChartTime' || _ref === 'ChartTimeRange' || _ref === 'Date', "emit must be 'ChartTime', 'ChartTimeRange', or 'Date'. You provided " + this.emit + ".");
      utils.assert(this.emit !== 'Date' || (tz != null), 'Must provide a tz (timezone) parameter when emitting Dates.');
      if ((_ref2 = ctr.granularity) === 'Minute' || _ref2 === 'Second' || _ref2 === 'Millisecond') {
        console.error("Warning: iterating at granularity " + ctr.granularity + " can be very slow.");
      }
      if ((_ref3 = this.tz) == null) this.tz = tz;
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
          Will go back to the where the iterator started.
      */      if (this.ctr.skip > 0) {
        this.current = new ChartTime(this.ctr.start);
      } else {
        this.current = new ChartTime(this.ctr.pastEnd);
        this.current.decrement();
      }
      this.count = 0;
      return this._proceedToNextValid();
    };

    ChartTimeIterator.prototype.hasNext = function() {
      /*
          Returns true if there are still things left to iterator over. Note that if there are holidays, weekends or non-workhours to skip,
          then hasNext() will take that into account. For example if the pastEnd is a Sunday, hasNext() will return true the next
          time it is called after the Friday is emitted.
      */      return this.ctr.contains(this.current) && (this.count < this.ctr.limit);
    };

    ChartTimeIterator.prototype._shouldBeExcluded = function() {
      var currentInDay, currentMinutes, holiday, _i, _len, _ref, _ref2, _ref3;
      if (this.current.granularityAboveDay()) return false;
      currentInDay = this.current.inGranularity('day');
      if (_ref = this.current.dowString(), __indexOf.call(this.ctr.workDays, _ref) < 0) {
        return true;
      }
      _ref2 = this.ctr.holidays;
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        holiday = _ref2[_i];
        if (utils.match(holiday, currentInDay)) return true;
      }
      if ((_ref3 = this.ctr.granularity) === 'hour' || _ref3 === 'minute' || _ref3 === ' second' || _ref3 === 'millisecond') {
        currentMinutes = this.current.hour * 60;
        if (this.current.minute != null) currentMinutes += this.current.minute;
        if (this.ctr.startWorkMinutes <= this.ctr.pastEndWorkMinutes) {
          if ((currentMinutes < this.ctr.startWorkMinutes) || (currentMinutes >= this.ctr.pastEndWorkMinutes)) {
            return true;
          }
        } else {
          if ((this.ctr.startWorkMinutes >= currentMinutes && currentMinutes > this.ctr.pastEndWorkMinutes)) {
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
        if (this.ctr.skip > 0) {
          _results.push(this.current.increment());
        } else {
          _results.push(this.current.decrement());
        }
      }
      return _results;
    };

    ChartTimeIterator.prototype.next = function() {
      /*
          Emits the next value of the iterator. The start will be the first value emitted unless it should be skipped due
          to holiday, weekend, or workhour knockouts.
      */
      var childCTR, currentCopy, i, spec, _ref;
      if (!this.hasNext()) throw new StopIteration('Cannot call next() past end.');
      currentCopy = new ChartTime(this.current);
      this.count++;
      for (i = _ref = Math.abs(this.ctr.skip); _ref <= 1 ? i <= 1 : i >= 1; _ref <= 1 ? i++ : i--) {
        if (this.ctr.skip > 0) {
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
            start: currentCopy.inGranularity(this.childGranularity),
            pastEnd: this.current.inGranularity(this.childGranularity),
            workDays: this.ctr.workDays,
            holidays: this.ctr.holidays,
            startWorkTime: this.ctr.startWorkTime,
            pastEndWorkTime: this.ctr.pastEndWorkTime
          };
          childCTR = new ChartTimeRange(spec);
          return childCTR;
      }
    };

    ChartTimeIterator.prototype.getAll = function() {
      /*
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
      # ChartTimeRange #
      
      Allows you to specify a range for iterating over or identifying if it `contains()` some other date.
      This `contains()` comparision can be done in a timezone sensitive way.
      
      ## Usage ##
     
      Let's create the `spec` for our ChartTimeRange
      
          {ChartTimeIterator, ChartTimeRange, ChartTime} = require('../')
          
          ChartTime.setTZPath('../vendor/tz')
          
          r = new ChartTimeRange({
            start:new ChartTime('2011-01-02'),
            pastEnd:new ChartTime('2011-01-07'),
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
      
      Notice how 2011-01-02 was skipped because it was a holiday. Also notice how the pastEnd is not included.
      Ranges are inclusive of the start and exclusive of the pastEnd. This allows the pastEnd of one to be
      the start of the next with no overlap or gap. This focus on precision pervades the design of the ChartTime library.
      
      Now, let's create a ChartTimeRange with `hour` granularity to elaborate on this inclusive/exclusive behavior.
          
          r2 = new ChartTimeRange({
            start:new ChartTime('2011-01-02T00'),
            pastEnd:new ChartTime('2011-01-07T00'),
          })
          
      `start` is inclusive.
      
          console.log(r2.contains(new ChartTime('2011-01-02T00')))
          # true
          
      But `pastEnd` is exclusive
      
          console.log(r2.contains(new ChartTime('2011-01-07T00')))
          # false
      
      But just before `pastEnd` is OK
      
          console.log(r2.contains('2011-01-06T23'))
          # true
          
      In the above line, notice how we omitted the `new ChartTime(...)`. If you pass in a string without a timezone, 
      it will automatically create the ChartTime to do the comparison.
      
      All of the above comparisons assume that the `start`/`pastEnd` boundaries are in the same timezone as the contains date.
      
      ## Timezone sensitive comparisions ##
      
      Now, let's look at how you do timezone sensitive comparisions.
          
      Note, you must set the path to the tz files with `ChartTime.setTZPath('path/to/tz/files')` before you do timezone 
      sensitive comparisions.
      
      If you pass in a timezone, then it will shift the CharTimeRange boundaries to that timezone to compare to the 
      date/timestamp that you pass in. This system is optimized to the pattern where you first define your boundaries without regard 
      to timezone. Christmas day is a holiday in any timezone. Saturday and Sunday are non work days in any timezone. The iteration
      starts on July 10th; etc. THEN you have a bunch of data that you have stored in a database in GMT. Maybe you've pulled
      it down from an API but the data is represented with a GMT date/timestamp. You then want to decide if the GMT date/timestamp 
      is contained within the iteration as defined by a particular timezone, or is a Saturday, or is during workhours, etc. 
      The key concept to remember is that the timebox boundaries are shifted NOT the other way around. It says at what moment
      in time July 10th starts in a particular timezone and internally represents that in a way that can be compared to a GMT 
      date/timestamp.
      
      So, when it's 3am in GMT on 2011-01-02, it's still 2011-01-01 in New York. Using the above `r2` range, we say:
      
          console.log(r2.contains('2011-01-02T03:00:00.000Z', 'America/New_York'))
          # false
          
      But it's still 2011-01-06 in New York, when it's 3am in GMT on 2011-01-07
          
          console.log(r2.contains('2011-01-07T03:00:00.000Z', 'America/New_York'))
          # true
          
      Now, let's explore how ChartTimeRanges and ChartTimeIterators are used together. Here is a range spec.
    
          r3 = new ChartTimeRange({
            start:new ChartTime('2011-01-06'),
            pastEnd:new ChartTime('2011-01-11'),
            startWorkTime: {hour: 9, minute: 0},
            pastEndWorkTime: {hour: 11, minute: 0}  # Very short work day for demo purposes
          })
              
      You can ask for an iterator to emit ChartTimeRanges rather than ChartTime values. On each call to `next()`, the
      iterator will give you a new ChartTimeRange with the `start` value set to what you would have gotten had you 
      requested that it emit ChartTimes. The `pastEnd' of the emitted ChartTimeRange will be set to the following value.
      This is how you drill-down from one granularity into a lower granularity.
      
      By default, the granularity of the iterator will equal the `start`/`pastEnd` of the original ChartTimeRange. 
      However, you can provide a different granularity (`hour` in the example below) for the iterator if you want 
      to drill-down at a lower granularity.
      
          i3 = r3.getIterator('ChartTimeRange', 'hour')
          
          while i3.hasNext()
            subRange = i3.next()
            console.log("Sub range goes from #{subRange.start.toString()} to #{subRange.pastEnd.toString()}")
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
            start:'2011-01-06T00',  # Notice how we include the hour now
            pastEnd:'2011-01-11T00',
            startWorkTime: {hour: 9, minute: 0},
            pastEndWorkTime: {hour: 11, minute: 0}  # Very short work day for demo purposes
          })
              
      Notice how we are able to simply use strings to represent the start/pastEnd dates. ChartTimeRange automatically constructs 
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
          spec can have the following properties:
      
          * **start** is a ChartTime object or a string. The first value that next() returns.
          * **pastEnd** is a ChartTime object or string. Must match granularity. hasNext() returns false when current is here or later.
          * **skip** is an optional num. Defaults to 1 or -1. Use -1 to march backwards from pastEnd - 1. Currently any
             values other than 1 and -1 give unexpected behavior.
          * **limit** you can specify limit plus one of start/pastEnd and only get back this many.
          * **workDays** list of days of the week that you work on. Either ['Monday', 'Tuesday', ...] or "Monday,Tuesday,..."
             Defaults to ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].
          * **holidays** is an optional Array like: [{month: 12, day: 25}, {year: 2011, month: 11, day: 24}]. Notice how
             you can leave off the year if the holiday falls on the same day every year.
          * **startWorkTime** is an optional object in the form {hour: 8, minute: 15}. Must include minute even when 0.
             If startWorkTime is later than pastEndWorkTime, then it assumes that you work the night shift and your work
             hours span midnight.
          * **pastEndWorkTime** is an optional object in the form {hour: 17, minute: 0}. Must include minute even when 0.
             The use of startWorkTime and pastEndWorkTime only make sense when the granularity is "hour" or finer.
             Note: If the business closes at 5:00pm, you'll want to leave pastEndWorkTime to 17:00, rather
             than 17:01. Think about it, you'll be open 4:59:59.999pm, but you'll be closed at 5:00pm. This also makes all of
             the math work. 9am to 5pm means 17 - 9 = an 8 hour work day.
      */
      var s, _ref;
      if (spec.pastEnd != null) {
        this.pastEnd = spec.pastEnd;
        if (this.pastEnd !== 'PAST_LAST') {
          if (utils.type(this.pastEnd) === 'string') {
            this.pastEnd = new ChartTime(this.pastEnd);
          }
          this.granularity = this.pastEnd.granularity;
        }
      }
      if (spec.start != null) {
        this.start = spec.start;
        if (this.start !== 'BEFORE_FIRST') {
          if (utils.type(this.start) === 'string') {
            this.start = new ChartTime(this.start);
          }
          this.granularity = this.start.granularity;
        }
      }
      if (spec.granularity != null) {
        this.granularity = spec.granularity;
        this.start = this.start.inGranularity(this.granularity);
        this.pastEnd = this.pastEnd.inGranularity(this.granularity);
      }
      if (!this.granularity) {
        throw new Error('Cannot determine granularity for ChartTimeRange.');
      }
      if (this.start === 'BEFORE_FIRST') {
        this.start = new ChartTime(this.start, this.granularity);
      }
      if (this.pastEnd === 'PAST_LAST') {
        this.pastEnd === new ChartTime(this.pastEnd, this.granularity);
      }
      if (!this.pastEnd) {
        this.pastEnd = new ChartTime('PAST_LAST', this.granularity);
      }
      if (!this.start) {
        this.start = new ChartTime('BEFORE_FIRST', this.granularity);
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
      this.startWorkTime = spec.startWorkTime != null ? spec.startWorkTime : void 0;
      this.startWorkMinutes = this.startWorkTime != null ? this.startWorkTime.hour * 60 + this.startWorkTime.minute : 0;
      this.pastEndWorkTime = spec.pastEndWorkTime != null ? spec.pastEndWorkTime : void 0;
      this.pastEndWorkMinutes = this.pastEndWorkTime != null ? this.pastEndWorkTime.hour * 60 + this.pastEndWorkTime.minute : 24 * 60;
      if (spec.skip != null) {
        this.skip = spec.skip;
      } else if ((spec.pastEnd != null) && ((_ref = this.start) != null ? _ref.$gt(this.pastEnd) : void 0)) {
        this.skip = -1;
      } else if ((spec.pastEnd != null) && !(spec.start != null) && (spec.limit != null)) {
        this.skip = -1;
      } else {
        this.skip = 1;
      }
      utils.assert(((spec.start != null) && (spec.pastEnd != null)) || ((spec.start != null) && (spec.limit != null) && this.skip > 0) || ((spec.pastEnd != null) && (spec.limit != null) && this.skip < 0), 'Must provide two out of "start", "pastEnd", or "limit" and the sign of skip must match.');
    }

    ChartTimeRange.prototype.getIterator = function(emit, childGranularity, tz) {
      if (emit == null) emit = 'ChartTimeRange';
      if (childGranularity == null) childGranularity = 'day';
      /*
          Returns a new ChartTimeIterator using this ChartTimeRange as the boundaries.
          
          Note, to maintain backward compatibility with the time before ChartTimeRange existed, the default for emit when 
          instantiating a new ChartTimeIterator directly is 'ChartTime'. However, if you request a new ChartTimeIterator 
          from a ChartTimeRange object using getIterator(), the default is 'ChartTimeRange'.
      */
      return new ChartTimeIterator(this, emit, childGranularity, tz);
    };

    ChartTimeRange.prototype.contains = function(date, tz) {
      /*
          True if the date provided is within this ChartTimeRange.
          
          ## Usage: ##
          
          We can create a range from May to July.
          
              r = new ChartTimeRange({
                start: '2011-05',
                pastEnd: '2011-07'
              })
              
              console.log(r.contains('2011-06-15T12:00:00.000Z', 'America/New_York'))
              # true
      */
      var pastEnd, start, target;
      if (date instanceof ChartTime) {
        return date.$lt(this.pastEnd) && date.$gte(this.start);
      }
      utils.assert((tz != null) || utils.type(date) !== 'date', 'ChartTimeRange.contains() requires a second parameter (timezone) when the first parameter is a Date()');
      switch (utils.type(date)) {
        case 'string':
          if (tz != null) {
            target = timezoneJS.parseISO(date);
          } else {
            target = new ChartTime(date);
            return target.$lt(this.pastEnd) && target.$gte(this.start);
          }
          break;
        case 'date':
          target = date.getTime();
          break;
        default:
          throw new Error('ChartTimeRange.contains() requires that the first parameter be of type ChartTime, String, or Date');
      }
      start = this.start.getJSDate(tz);
      pastEnd = this.pastEnd.getJSDate(tz);
      return target < pastEnd && target >= start;
    };

    return ChartTimeRange;

  })();

  exports.ChartTimeRange = ChartTimeRange;

  exports.ChartTimeIterator = ChartTimeIterator;

}).call(this);

});

require.define("/ChartTimeInStateCalculator.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var ChartTimeInStateCalculator, utils;

  utils = require('./utils');

  ChartTimeInStateCalculator = (function() {

    /*
      Used to calculate how much time each uniqueID spent in-state.
      
      Usage:
      
          charttime = require('../')
          {ChartTimeRange, ChartTime, ChartTimeIterator, ChartTimeInStateCalculator} = charttime
          ChartTime.setTZPath('../vendor/tz')
          
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
            start: new ChartTime(snapshots[0].from, granularity, timezone).decrement()
            pastEnd: '2011-01-11T00:00:00.000'
            startWorkTime: {hour: 9, minute: 0}  # 15:00 in Chicago
            pastEndWorkTime: {hour: 11, minute: 0}  # 17:00 in Chicago.
          
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
      var allCTs, allCTsLength, ct, ctPlus1, idx, previousState, _len, _ref;
      this.iterator = iterator;
      this.granularity = this.iterator.ctr.granularity;
      if ((_ref = this.granularity) === 'minute' || _ref === 'second' || _ref === 'millisecond') {
        console.error('Warning: time-in-state calculations at granularities finer than hour can take a long time.');
      }
      if (tz != null) {
        this.tz = tz;
      } else {
        this.tz = this.iterator.tz;
      }
      utils.assert(this.tz != null, 'Must specify a timezone `tz` if none specified by the iterator.');
      this.iterator.emit = 'ChartTime';
      utils.assert(this.tz, 'Must provide a timezone to the ChartTimeIterator used for in-state calculation');
      allCTs = this.iterator.getAll();
      if (this.iterator.skip < 0) allCTs.reverse();
      this.ticks = [];
      previousState = false;
      allCTsLength = allCTs.length;
      for (idx = 0, _len = allCTs.length; idx < _len; idx++) {
        ct = allCTs[idx];
        ctPlus1 = ct.add(1);
        if (previousState) {
          previousState = true;
          this.ticks.push({
            at: ct.getJSDateString(this.tz),
            state: true
          });
          if (idx + 1 === allCTsLength) {
            previousState = false;
            this.ticks.push({
              at: ctPlus1.getJSDateString(this.tz),
              state: false
            });
          } else {
            if (!ctPlus1.$eq(allCTs[idx + 1])) {
              previousState = false;
              this.ticks.push({
                at: ctPlus1.getJSDateString(this.tz),
                state: false
              });
            }
          }
        } else {
          this.ticks.push({
            at: ct.getJSDateString(this.tz),
            state: true
          });
          previousState = true;
        }
      }
    }

    ChartTimeInStateCalculator.prototype.timeInState = function(snapshotArray, validFromField, validToField, uniqueIDField, excludeStillInState) {
      var currentSnapshotEvent, currentTick, currentTickState, d, eventRow, finalOutput, lastTickAt, output, outputRow, row, s, snapshotEvents, snapshotIndex, snapshotLength, tickIndex, tickLength, toDelete, uniqueID, _i, _j, _len, _len2;
      if (excludeStillInState == null) excludeStillInState = true;
      /*
          Assumptions about the snapshotArray that's passed in:
          
          * The snapshotArray includes all snapshots where the logical state you want
            to measure the "time in" is true. So, send the predicate you want to be true as part of the query to the snapshot service.
          * The `validFromField` and `validToField` in the `snapshotArray` contain strings in ISO-6801 canonical
            Zulu format (eg `'2011-01-01T12:34:56.789Z'`).
      */
      utils.assert(snapshotArray[0][validFromField] >= this.ticks[0].at, 'The iterator used must go back at least as far as the first entry in the snapshotArray.');
      lastTickAt = this.ticks[this.ticks.length - 1].at;
      snapshotEvents = [];
      for (_i = 0, _len = snapshotArray.length; _i < _len; _i++) {
        s = snapshotArray[_i];
        eventRow = {
          at: s[validFromField],
          state: true
        };
        eventRow[uniqueIDField] = s[uniqueIDField];
        snapshotEvents.push(eventRow);
        if (s[validToField] < lastTickAt) {
          eventRow = {
            at: s[validToField],
            state: false
          };
          eventRow[uniqueIDField] = s[uniqueIDField];
          snapshotEvents.push(eventRow);
        }
      }
      snapshotEvents.sort(function(a, b) {
        if (a.at > b.at) {
          return 1;
        } else if (a.at === b.at) {
          return 0;
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
          if (outputRow.finalState) toDelete.push(uniqueID);
        }
        for (_j = 0, _len2 = toDelete.length; _j < _len2; _j++) {
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

require.define("/derive.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var deriveFields, deriveFieldsAt;

  deriveFields = function(list, derivedFields) {
    /*  
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
    that appears later in the derivations list.
    */
    var d, row, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = list.length; _i < _len; _i++) {
      row = list[_i];
      _results.push((function() {
        var _j, _len2, _results2;
        _results2 = [];
        for (_j = 0, _len2 = derivedFields.length; _j < _len2; _j++) {
          d = derivedFields[_j];
          _results2.push(row[d.name] = d.f(row));
        }
        return _results2;
      })());
    }
    return _results;
  };

  deriveFieldsAt = function(atArray, derivedFields) {
    /*
      Sends every sub-array in atArray to deriveFields upgrading the atArray in place.
    */
    var a, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = atArray.length; _i < _len; _i++) {
      a = atArray[_i];
      _results.push(deriveFields(a, derivedFields));
    }
    return _results;
  };

  exports.deriveFields = deriveFields;

  exports.deriveFieldsAt = deriveFieldsAt;

}).call(this);

});

require.define("/datatransform.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var ChartTime, aggregationAtArray_To_HighChartsSeries, csvStyleArray_To_ArrayOfMaps, groupByAtArray_To_HighChartsSeries, snapshotArray_To_AtArray, utils;

  ChartTime = require('./ChartTime').ChartTime;

  utils = require('./utils');

  csvStyleArray_To_ArrayOfMaps = function(csvStyleArray, rowKeys) {
    /*
      To use this module, you must `require` it:
      
          charttime = require('../')
          {csvStyleArray_To_ArrayOfMaps, snapshotArray_To_AtArray, ChartTime} = charttime
          {groupByAtArray_To_HighChartsSeries, aggregationAtArray_To_HighChartsSeries} = charttime
          ChartTime.setTZPath("../vendor/tz")
      
      `csvStyleArry_To_ArryOfMaps` will convert a csvStyleArray like:
      
          csvStyleArray = [
            ['column1', 'column2'],
            [1         , 2         ],
            [3         , 4         ],
            [5         , 6         ]
          ]
      
      to an Array of Maps like this:
      
          console.log(csvStyleArray_To_ArrayOfMaps(csvStyleArray))
      
          # [ { column1: 1, column2: 2 },
          #   { column1: 3, column2: 4 },
          #   { column1: 5, column2: 6 } ]
      
      Parameters
      
      * **CSVStyleArray** An Array of Arrays. The first row is usually the list of column headers but if not, you can
          provide your own such list in the second parameter.
      * **rowKeys** Optional second parameter specifying the column headers like `['column1', 'column2']`
    */
    var arrayOfMaps, i, index, inputRow, key, outputRow, tableLength, _len;
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
      for (index = 0, _len = rowKeys.length; index < _len; index++) {
        key = rowKeys[index];
        outputRow[key] = inputRow[index];
      }
      arrayOfMaps.push(outputRow);
      i++;
    }
    return arrayOfMaps;
  };

  snapshotArray_To_AtArray = function(snapshotArray, listOfAtCTs, dateField, keyField, tz) {
    /*
      If you have a list of snapshots representing the changes in a set of work items over time (MVCC-style), this function will return the state of
      each item at each moment of interest. It's useful for time-series charts where you have snapshot or change records but you need to know
      the values at particular moments in time (the times in listOfAtCTs).
      
      It will convert an snapshotArray like:
      
          snapshotArray = [
            {_ValidFrom: '2011-01-01T12:00:00.000Z', ObjectID: 1, someColumn: 'some value', someOtherColumn: 'some other value'},
            {_ValidFrom: '2011-01-02T12:00:00.000Z', ObjectID: 2, someColumn: 'some value 2', someOtherColumn: 'some other value 2'},      
          ]
          
      And a listOfAtCTs like:
      
          listOfAtCTs = [new ChartTime('2011-01-02'), new ChartTime('2011-01-03')]
          
      To an atArray with the value of each ObjectID at each of the points in the listOfAtCTs like:
      
          a = snapshotArray_To_AtArray(snapshotArray, listOfAtCTs, '_ValidFrom', 'ObjectID', 'America/New_York')
          
          console.log(a)
      
          # [ [ { ObjectID: '1', 
          #         someColumn: 'some value', 
          #         someOtherColumn: 'some other value' } ],
          #   [ { ObjectID: '1', 
          #         someColumn: 'some value', 
          #         someOtherColumn: 'some other value' }, 
          #     { ObjectID: '2', 
          #         someColumn: 'some value 2', 
          #         someOtherColumn: 'some other value 2' } ] ]
          
      Parameters
      
      * **snapshotArray** Array of snapshots or change events. Sorted by dateField.
      * **atArray** Array of ChartTime objects representing the moments we want the snapshots at
      * **dateField** String containing the name of the field that holds a date string in ISO-8601 canonical format (eg `2011-01-01T12:34:56.789Z`)
         Note, it should also work if there are ChartTime's in this position.
      * **keyField** String containing the name of the field that holds the unique ID. Note, no matter the input type, they will come
         out the other side as Strings. I could fix this if it ever became a problem.
      * **tz** String indicating the timezone, like 'America/New_York'
    */
    var atLength, atPointer, atRow, currentAtCT, currentRow, currentSnapshot, currentSnapshotCT, granularity, key, output, outputRow, preOutput, snapshotLength, snapshotPointer, value, _i, _len;
    atLength = listOfAtCTs.length;
    snapshotLength = snapshotArray.length;
    preOutput = [];
    if (atLength <= 0 || snapshotLength <= 0) return preOutput;
    atPointer = 0;
    currentAtCT = listOfAtCTs[atPointer];
    granularity = currentAtCT.granularity;
    snapshotPointer = 0;
    currentSnapshot = snapshotArray[snapshotPointer];
    currentSnapshotCT = new ChartTime(currentSnapshot[dateField], granularity, tz);
    currentRow = {};
    while (snapshotPointer < snapshotLength) {
      if (currentSnapshotCT.$gte(currentAtCT)) {
        preOutput.push(currentRow);
        currentRow = utils.clone(currentRow);
        atPointer++;
        if (atPointer < atLength) {
          currentAtCT = listOfAtCTs[atPointer];
        } else {
          break;
        }
      } else {
        if (currentRow[keyField] == null) {
          currentRow[currentSnapshot[keyField]] = {};
        }
        for (key in currentSnapshot) {
          value = currentSnapshot[key];
          if (key !== dateField) {
            currentRow[currentSnapshot[keyField]][key] = value;
          }
        }
        snapshotPointer++;
        if (snapshotPointer < snapshotLength) {
          currentSnapshot = snapshotArray[snapshotPointer];
          currentSnapshotCT = new ChartTime(currentSnapshot[dateField], granularity, tz);
        } else {
          while (atPointer < atLength) {
            preOutput.push(currentRow);
            atPointer++;
          }
        }
      }
    }
    output = [];
    for (_i = 0, _len = preOutput.length; _i < _len; _i++) {
      atRow = preOutput[_i];
      outputRow = [];
      for (key in atRow) {
        value = atRow[key];
        value[keyField] = key;
        outputRow.push(value);
      }
      output.push(outputRow);
    }
    return output;
  };

  groupByAtArray_To_HighChartsSeries = function(groupByAtArray, nameField, valueField, nameFieldValues, returnPreOutput) {
    /* 
    Takes an array of arrays that came from charttime.groupByAt and looks like this:
    
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
    var f, groupByRow, name, output, outputRow, perNameValueRow, preOutput, _i, _j, _k, _l, _len, _len2, _len3, _len4, _ref;
    preOutput = {};
    if (nameFieldValues == null) {
      nameFieldValues = [];
      _ref = groupByAtArray[0];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        f = _ref[_i];
        nameFieldValues.push(f[nameField]);
      }
    }
    for (_j = 0, _len2 = groupByAtArray.length; _j < _len2; _j++) {
      groupByRow = groupByAtArray[_j];
      for (_k = 0, _len3 = groupByRow.length; _k < _len3; _k++) {
        perNameValueRow = groupByRow[_k];
        if (preOutput[perNameValueRow[nameField]] == null) {
          preOutput[perNameValueRow[nameField]] = [];
        }
        preOutput[perNameValueRow[nameField]].push(perNameValueRow[valueField]);
      }
    }
    if ((returnPreOutput != null) && returnPreOutput) return preOutput;
    output = [];
    for (_l = 0, _len4 = nameFieldValues.length; _l < _len4; _l++) {
      name = nameFieldValues[_l];
      outputRow = {
        name: name,
        data: preOutput[name]
      };
      output.push(outputRow);
    }
    return output;
  };

  aggregationAtArray_To_HighChartsSeries = function(aggregationAtArray, aggregations) {
    /* 
    Takes an array of arrays that came from charttime.aggregateAt and looks like this:
    
        aggregationAtArray = [
          {"Series 1": 8, "Series 2": 5, "Series3": 10},
          {"Series 1": 2, "Series 2": 3, "Series3": 20}
        ]
    
    and a list of series configurations
    
        aggregations = [
          {name: "Series 1", yAxis: 1},
          {name: "Series 2"}
        ]
        
    and extracts the data into seperate series
    
        console.log(aggregationAtArray_To_HighChartsSeries(aggregationAtArray, aggregations))
        # [ { name: 'Series 1', data: [ 8, 2 ], yAxis: 1 },
        #   { name: 'Series 2', data: [ 5, 3 ] } ]
        
    Notice how the extra fields from the series array are included in the output.
    */
    var a, aggregationRow, idx, key, output, outputRow, preOutput, s, seriesNames, seriesRow, value, _i, _j, _k, _len, _len2, _len3, _len4;
    preOutput = {};
    seriesNames = [];
    for (_i = 0, _len = aggregations.length; _i < _len; _i++) {
      a = aggregations[_i];
      seriesNames.push(a.name);
    }
    for (_j = 0, _len2 = aggregationAtArray.length; _j < _len2; _j++) {
      aggregationRow = aggregationAtArray[_j];
      for (_k = 0, _len3 = seriesNames.length; _k < _len3; _k++) {
        s = seriesNames[_k];
        if (preOutput[s] == null) preOutput[s] = [];
        preOutput[s].push(aggregationRow[s]);
      }
    }
    output = [];
    for (idx = 0, _len4 = seriesNames.length; idx < _len4; idx++) {
      s = seriesNames[idx];
      outputRow = {
        name: s,
        data: preOutput[s]
      };
      seriesRow = aggregations[idx];
      for (key in seriesRow) {
        value = seriesRow[key];
        if (key !== 'name' && key !== 'data') outputRow[key] = value;
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

require.define("/histogram.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var functions, histogram;

  functions = require('./aggregate').functions;

  histogram = function(rows, valueField) {
    /*
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
    var average, b, bucket, bucketCount, bucketSize, buckets, c, chartMax, chartMin, chartValues, chartValuesMinusOutliers, clipped, i, percentile, row, standardDeviation, total, upperBound, valueMax, _i, _j, _k, _len, _len2, _len3;
    chartValues = (function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = rows.length; _i < _len; _i++) {
        row = rows[_i];
        _results.push(row[valueField]);
      }
      return _results;
    })();
    average = functions.$average(chartValues);
    standardDeviation = functions.$standardDeviation(chartValues);
    upperBound = average + 2 * standardDeviation;
    chartValuesMinusOutliers = (function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = chartValues.length; _i < _len; _i++) {
        c = chartValues[_i];
        if (c < upperBound) _results.push(c);
      }
      return _results;
    })();
    bucketCount = Math.floor(Math.sqrt(chartValuesMinusOutliers.length));
    if (bucketCount < 3) return;
    bucketSize = Math.floor(upperBound / bucketCount) + 1;
    upperBound = bucketSize * bucketCount;
    chartMin = 0;
    chartMax = upperBound + bucketSize;
    valueMax = Math.floor(functions.$max(chartValues)) + 1;
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
    for (i = 0; 0 <= bucketCount ? i <= bucketCount : i >= bucketCount; 0 <= bucketCount ? i++ : i--) {
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
    for (_j = 0, _len2 = rows.length; _j < _len2; _j++) {
      row = rows[_j];
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
    for (_k = 0, _len3 = buckets.length; _k < _len3; _k++) {
      b = buckets[_k];
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

require.define("/lumenize.coffee", function (require, module, exports, __dirname, __filename) {
(function() {

  /*
  # Lumenize #
  
  Copyright (c) 2009-2012, Lawrence S. Maccherone, Jr.
  
  _Illuminating the forest AND the trees in your data._
  
  ## Features ##
  
  * Implementation of DSL and visualization patterns from Larry Maccherone's PhD
  * Hierarchical OLAP cubes
  * Date-time precision optimized for charting: timezone manipulation (eg America/New_York), knockout weekends/holidays,
    non-workhours, work in any granularity (year, quarter, week, day, hour, etc.), etc.
  * Tested
  * [Documented](http://lmaccherone.github.com/Lumenize/docs/index.html)
  * [DocTested](https://github.com/lmaccherone/coffeedoctest)
  
  ## Credits ##
  
  Authors:
  
  * [Larry Maccherone](http://maccherone.com) (Larry @at@ Maccherone .dot. com)
  * Jennifer Maccherone
  
  Running:
  
  * [timezoneJS](https://github.com/mde/timezone-js) - library for [tz](http://www.twinsun.com/tz/tz-link.htm) parsing.
    Although I haven't touched the actual tz file parsing code, I have modified timezoneJS fairly significantly. 
    The original included a drop-in replacement for JavaScript's Date object.
    I also modified it to work on node.js and in the browser once "browserified" by bundling the tz files.
  
  Developing/Documenting:
  
  * [Node.js](http://nodejs.org/)
  * [CoffeeScript](http://coffeescript.org/)
  * [coffeedoc](https://github.com/lmaccherone/coffeedoc) (Larry Maccherone's fork) forked from [coffeedoc](https://github.com/omarkhan/coffeedoc)
  * [coffeedoctest](https://github.com/lmaccherone/coffeedoctest) (by Larry Maccherone)
  * [nodeunit](https://github.com/caolan/nodeunit)
  * [browserify with fileify plugin](https://github.com/substack/node-browserify)
  * [uglify-js](https://github.com/mishoo/UglifyJS)
  
  ## Using from a browser ##
  
  To use in a browser, either host it on your own site, or if your volume is low enough, you can directly hit the github pages for the deploy version:
  
  `<script type="text/javascript" src="http://lmaccherone.github.com/Lumenize/deploy/lumenize-min.js"></script>`
  
  The package is fairly large ~252KB but most of that is the embedded timezone files which compress really well. The Github pages server will gzip 
  the package so it's only ~59KB over the wire.
  
  Then at the top of the javascript where you want to call it, put the following:
  
  `var lumenize = require('./lumenize');`
  
  Then to use it, you can either create local aliases like:
  
  `var ChartTime = lumenize.ChartTime;`
  
  or you can just use the lumenize namespace:
  
  `var stdDev = lumenize.functions.$standardDeviation([20, 30, 50]);`
      
  ## Installation for node.js usage ##
  
  To install in the node_modules directory of your project, run the following from the root folder of your project:
  
  `npm install Lumenize`
      
  To install globally:
  
  `sudo npm install -g Lumenize`
      
  If you want the latest from source, download/clone from GitHub and run:
  
  `cake install`
  
  ## Contributing to Lumenize ##
      
  If you want to add functionality to Lumenize, add tests for your upgrades and make sure all test pass with:
  
  `cake test`
      
  Also, add examples in the "docstrings", then generate the docs (which will also confirm that the examples give the expected output when run):
  
  `cake docs`
  
  Once you have that all working, submit a pull request on GitHub.
  
  ## Documentation and source code ##
  
  * [API Documentation](http://lmaccherone.github.com/Lumenize/docs/index.html)
  * [Source Repository](https://github.com/lmaccherone/Lumenize)
  
  ## License ##
  
  Copyright (c) 2011, 2012, Lawrence S. Maccherone, Jr.
  
  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated 
  documentation files (the "Software"), to deal in the Software without restriction, including without limitation 
  the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and 
  to permit persons to whom the Software is furnished to do so, subject to the following conditions:
  
  The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
  
  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED 
  TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL 
  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF 
  CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS 
  IN THE SOFTWARE.
  */

  var aggregate, chartTimeIteratorAndRange, datatransform, derive;

  exports.timezoneJS = require('timezone-js').timezoneJS;

  exports.utils = require('./utils');

  exports.ChartTime = require('./ChartTime').ChartTime;

  chartTimeIteratorAndRange = require('./ChartTimeIteratorAndRange');

  exports.ChartTimeIterator = chartTimeIteratorAndRange.ChartTimeIterator;

  exports.ChartTimeRange = chartTimeIteratorAndRange.ChartTimeRange;

  exports.ChartTimeInStateCalculator = require('./ChartTimeInStateCalculator').ChartTimeInStateCalculator;

  datatransform = require('./datatransform');

  exports.csvStyleArray_To_ArrayOfMaps = datatransform.csvStyleArray_To_ArrayOfMaps;

  exports.snapshotArray_To_AtArray = datatransform.snapshotArray_To_AtArray;

  exports.groupByAtArray_To_HighChartsSeries = datatransform.groupByAtArray_To_HighChartsSeries;

  exports.aggregationAtArray_To_HighChartsSeries = datatransform.aggregationAtArray_To_HighChartsSeries;

  aggregate = require('./aggregate');

  exports.aggregate = aggregate.aggregate;

  exports.aggregateAt = aggregate.aggregateAt;

  exports.groupBy = aggregate.groupBy;

  exports.groupByAt = aggregate.groupByAt;

  exports.functions = aggregate.functions;

  exports.percentileCreator = aggregate.percentileCreator;

  exports.timeSeriesCalculator = aggregate.timeSeriesCalculator;

  exports.timeSeriesGroupByCalculator = aggregate.timeSeriesGroupByCalculator;

  derive = require('./derive');

  exports.deriveFields = derive.deriveFields;

  exports.deriveFieldsAt = derive.deriveFieldsAt;

  exports.histogram = require('./histogram').histogram;

}).call(this);

});
