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
        var y = cwd || '.';
        
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
      var d, k, n, vLength;
      vLength = values.length;
      values.sort();
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

  /*
  # ChartTime #
  
  Copyright (c) 2012, Lawrence S. Maccherone, Jr.
  
  _Time axis creation/manipulation for charts_
  
  ## Features ##
  
  * Generate the values for time series chart axis
  * Allows for custom granularities like release/iteration/iteration_day
  * Knockout weekends and holidays
  * Knockout non-work hours
  * Drill up and down granularity (coneceptually supported by ChartTime, consumed by Lumenize)
  * Work with precision around timezone differences
  * Month is 1-indexed instead of 0-indexed like Javascript's Date object
  * Date/Time math (add 3 months, subtract 2 weeks, etc.)
  * Tested
  * Documented
  
  ## Credits ##
  
  Authors:
  
  * [Larry Maccherone](http://maccherone.com) (Larry @at@ Maccherone .dot. com)
  * Jennifer Maccherone
  
  Running:
  
  * [timezoneJS](https://github.com/mde/timezone-js) - library for [tz](http://www.twinsun.com/tz/tz-link.htm) parsing
  * [Node.js](http://nodejs.org/)
  * [CoffeeScript](http://coffeescript.org/)
  
  Developing/Documenting:
  
  * [coffeedoc](https://github.com/lmaccherone/coffeedoc) (Larry Maccherone's fork) forked from [coffeedoc](https://github.com/omarkhan/coffeedoc)
  * [coffeedoctest](https://github.com/lmaccherone/coffeedoctest) (by Larry Maccherone)
  * [nodeunit](https://github.com/caolan/nodeunit)
  
  ## Installation and developing ##
  
  To install in the node_modules directory of your project, run the following from the root folder of your project:
  
  `npm install ChartTime`
      
  To install globally:
  
  `sudo npm install -g ChartTime`
      
  Or if you want the latest from source, download/clone from GitHub and run:
  
  `cake install`
      
  If you want to add functionality to ChartTime and submit a pull request, add tests for your upgrades and make sure all test pass with:
  
  `cake test`
      
  Also, add examples in the "docstrings", then generate the docs (which will also confirm that the examples give the expected output when run):
  
  `cake docs`
      
  ## Documentation and source code ##
  
  * [API Documentation](http://lmaccherone.github.com/ChartTime/docs/index.html)
  * [github.com/lmaccherone/ChartTime](https://github.com/lmaccherone/ChartTime)
  
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
      
  ## Iterating over ranges skipping weekends, holidays, and non-workhours ##
  
      r = new ChartTimeRange({
        start: new ChartTime('2011-01-02'),
        pastEnd: new ChartTime('2011-01-07'),
        workDays: 'Monday, Tuesday, Thursday, Friday',  # very strange work week
        holidays: [
          {month: 1, day: 1},  # Notice the lack of a year specification
          {year: 2011, month: 1, day: 3}  # Got January 3 off also in 2011
        ]
      })
      
  Now let's get an iterator over this range.
      
      i = r.getIterator('ChartTime')
      
      while i.hasNext()
        console.log(i.next().toString()) 
             
      # 2011-01-04
      # 2011-01-06
      
  You can also specify work hours and iterate at hour, minute, or finer granularity
  
      r4 = new ChartTimeRange({
        granularity: 'hour',
        start:'2011-01-06',
        pastEnd:'2011-01-11',
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
  */

  var ChartTime, timezoneJS, utils;
  var __hasProp = Object.prototype.hasOwnProperty, __indexOf = Array.prototype.indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (__hasProp.call(this, i) && this[i] === item) return i; } return -1; };

  utils = require('./utils');

  timezoneJS = require('timezone-js').timezoneJS;

  ChartTime = (function() {

    /*
      `granularitySpecs` is a static object that is used to tell ChartTime what to do with particular granularties. You can think of
      each entry in it as a sort of sub-class of ChartTime. In that sense ChartTime is really a factory generating ChartTime objects
      of type granularity. When generic timebox granularities are added to ChartTime by `ChartTime.addGranularity()`, it adds to this
      `granularitySpecs` object.
    */

    var g, spec, _ref;

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

    function ChartTime(spec_RDN_Or_String, granularity, tz) {
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
      var jsDate, newCT, newSpec, rdn, s, _ref2;
      this.beforePastFlag = '';
      switch (utils.type(spec_RDN_Or_String)) {
        case 'string':
          s = spec_RDN_Or_String;
          if (tz != null) {
            newCT = new ChartTime(s, 'millisecond');
          } else {
            this._setFromString(s, granularity);
          }
          break;
        case 'number':
          rdn = spec_RDN_Or_String;
          if (tz != null) {
            newCT = new ChartTime(rdn, 'millisecond');
          } else {
            this._setFromRDN(rdn, granularity);
          }
          break;
        default:
          spec = spec_RDN_Or_String;
          if (tz != null) {
            spec.granularity = 'millisecond';
            newCT = new ChartTime(spec);
          } else {
            this._setFromSpec(spec);
          }
      }
      if (tz != null) {
        if ((_ref2 = this.beforePastFlag) === 'BEFORE_FIRST' || _ref2 === 'PAST_LAST') {
          throw new Error("Cannot do timezone manipulation on " + this.beforePastFlag);
        }
        jsDate = newCT.getJSDateInTZfromGMT(tz);
        if (granularity != null) this.granularity = granularity;
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
      var day, hour, jsDate, millisecond, minute, month, s, second, year;
      jsDate = this.getJSDate(tz);
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
    if (typeof XMLHttpRequest == 'undefined') {
      throw new Error('No XMLHttpRequest.');
    } else {
      xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      var ret = xhr.responseText;
      return _this.parseZones(ret);
    }
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
      
          {ChartTimeIterator, ChartTimeRange, ChartTime} = require('../node_modules')
          
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

    StopIteration = typeof StopIteration === 'undefined' ? utils.StopIteration : StopIteration;

    function ChartTimeIterator(ctr, emit, childGranularity, tz) {
      var _ref, _ref2;
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
      if ((_ref2 = this.tz) == null) this.tz = tz;
      if (ctr instanceof ChartTimeRange) {
        this.ctr = ctr;
      } else {
        this.ctr = new ChartTimeRange(ctr);
      }
      this.startOver();
    }

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
      
          {ChartTimeIterator, ChartTimeRange, ChartTime} = require('../node_modules')
          
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
          {groupByAtArray_To_HighChartsSeries, groupByAtArray_To_ExtData} = charttime
          {aggregationAtArray_To_ExtData, aggregationAtArray_To_HighChartsSeries} = charttime
          ChartTime.setTZPath("../vendor/tz")
      
      Will convert a csvStyleArray like:
      
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

  aggregationAtArray_To_HighChartsSeries = function(aggregationAtArray, series) {
    /* 
    Takes an array of arrays that came from charttime.aggregateAt and looks like this:
    
        aggregationAtArray = [
          {"Series 1": 8, "Series 2": 5, Series3: 10},
          {"Series 1": 2, "Series 2": 3, Series3: 20}
        ]
    
    and a list of series configurations
    
        series = [
          {name: "Series 1", yAxis: 1},
          {name: "Series 2"}
        ]
        
    and extracts the data into seperate series
    
        console.log(aggregationAtArray_To_HighChartsSeries(aggregationAtArray, series))
        # [ { name: 'Series 1', data: [ 8, 2 ], yAxis: 1 },
        #   { name: 'Series 2', data: [ 5, 3 ] } ]
        
    Notice how the extra fields from the series array are included in the output.
    */
    var aggregationRow, idx, key, output, outputRow, preOutput, s, seriesNames, seriesRow, value, _i, _j, _k, _len, _len2, _len3, _len4;
    preOutput = {};
    seriesNames = [];
    for (_i = 0, _len = series.length; _i < _len; _i++) {
      s = series[_i];
      seriesNames.push(s.name);
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
      seriesRow = series[idx];
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
  var charttime, functions, histogram;

  charttime = require('../');

  functions = charttime.functions;

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
          # 0-12 2
          # 13-25 7
          # 26-38 6
          # 39-51 1
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
        label: "" + (Math.floor(i * bucketSize)) + "-" + (Math.floor((i + 1) * bucketSize) - 1),
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

require.define("/index.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
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
