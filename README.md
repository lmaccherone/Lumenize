[![build status](https://secure.travis-ci.org/lmaccherone/Lumenize.png)](http://travis-ci.org/lmaccherone/Lumenize)
[![NPM version](https://badge.fury.io/js/Lumenize.png)](http://badge.fury.io/js/Lumenize)
[![build status](https://david-dm.org/lmaccherone/Lumenize.png)](https://david-dm.org/lmaccherone/Lumenize.png)

[![Stories in Ready](https://badge.waffle.io/lmaccherone/Lumenize.png)](http://waffle.io/lmaccherone/Lumenize)
# Lumenize #

Copyright (c) 2009-2013, Lawrence S. Maccherone, Jr.

_Illuminating the forest AND the trees in your data._

Lumenize is a collection of tools for making awesome visualizations out of your data.

## Features ##

* Fast, light, flexible client-side OLAP Cube with hierarchical rollup support
* Create aggregations from temporal data models like Rally's Lookback API
  * TimeSeriesCalculator - Show how performance changed over time. Visualize cumulative flow.
  * TimeInStateCalculator - Calculate the ratio of wait to touch time. Find 98 percentile
    of lead time to set service level agreements.
  * TransitionsCalculator - Throughput. Velocity. 
* Bundled with the [tzTime](https://github.com/lmaccherone/tzTime) library (same author) for
  timezone precise x-axis. Knockout weekends, holidays, non-work hours, etc.
* Tested - Over 600 tests (plus over 400 tests in tzTime)
* [Documented (Lumenize)](http://commondatastorage.googleapis.com/versions.lumenize.com/docs/Lumenize-docs/index.html) [(tzTime)](http://lmaccherone.github.com/tzTime/docs/tztime-docs/index.html) - Robust documentation and examples
* [DocTested](https://github.com/lmaccherone/coffeedoctest) - The examples will always match 
  the code because it fails automated testing when they don't

## Credits ##

Authors:

* [Larry Maccherone](http://maccherone.com)
* Jennifer Maccherone

Used when running:

* [tzTime](https://github.com/lmaccherone/tzTime) (by Larry Maccherone with Olson file
  parsing from [timezoneJS](https://github.com/mde/timezone-js))

Used when developing:

* [Node.js](http://nodejs.org/)
* [CoffeeScript](http://coffeescript.org/)
* [coffeedoctest](https://github.com/lmaccherone/coffeedoctest) (by Larry Maccherone)
* [nodeunit](https://github.com/caolan/nodeunit)
* [browserify with fileify plugin (modified)](https://github.com/substack/node-browserify)
* [uglify-js](https://github.com/mishoo/UglifyJS)
* [wrench](https://github.com/ryanmcgrath/wrench-js)
* [marked](https://github.com/chjj/marked)

## Usage in a browser ##

To use in a browser, either host it on your own site, or if your volume is low enough, you can directly hit the github pages for the deploy version:

`<script type="text/javascript" src="https://storage.googleapis.com/versions.lumenize.com/v{{version}}/Lumenize-min.js"></script>`

Replace `{{version}}` with the version of Lumenize you wish to use (probably the latest). See the Changelog section for information about versions. Example:

`<script type="text/javascript" src="https://storage.googleapis.com/versions.lumenize.com/v0.6.8/Lumenize-min.js"></script>`

The package is fairly large ~260KB but most of that is the embedded timezone files which compress really well.

Then at the top of the javascript where you want to call it, put the following:

`var lumenize = require('./lumenize');`

And call it like this.

`var stdDev = lumenize.functions.standardDeviation([20, 30, 50]);`
    
## Usage in node.js ##

To install, run the following from the root folder of your project:

`npm install lumenize --save`

Then in your code:

`var lumenize = require('lumenize')`

## Documentation and source code ##

* [API Documentation](http://commondatastorage.googleapis.com/versions.lumenize.com/docs/Lumenize-docs/index.html)
* [Source Repository](https://github.com/lmaccherone/Lumenize)

## Changelog ##

In November of 2012, Lumenize wanted to start keeping old versions around because it was about to undergo a huge backward-breaking change. For a few days between 11-25 and 11-30, we were using an approach of multiple copies but then we switched to using git tags.

* 0.7.3 - 2014-02-08 - Switched BayesianClassifier to use constant quantity bucketer for larger training sets
* 0.7.2 - 2013-08-30 - Upgraded to the latest tzTime 0.6.11
* 0.7.1 - 2013-07-07 - Added simple table output formatting. Added significance to OLAPCube 
  output. Evenutally, OLAPCube.toString will use table.toString(), but not yet. Bug fixes.
* 0.7.0 - 2013-06-01 - **Backward breaking change.** Histogram significantly upgraded. The old 
  clipping histogram has been moved to `histogram.clipping()`. The new functionality is more 
  complete and general purpose.
* 0.6.11 - 2013-05-19 - Added point to projection series for startIndex and now use angle 
  instead of slope for v-optimal projection algorithm
* 0.6.10 - 2013-05-18 - Added projection functionality to TimeSeriesCalculator
* 0.6.9 - 2013-04-24 - Upgraded to bug fixed latest tzTime
* 0.6.8 - 2013-04-24 - Uses JSON2 for IE7 compatibility
* 0.6.7 - 2013-04-24 - Updated to latest version of jsduckify. Added Bayesian Classifier
* 0.6.6 - 2013-02-11 - More precise toDateCell when incrementally calculated.
* 0.6.5 - 2013-02-09 - Fixed bug on TimeSeriesCalculator where toDateCell was including more
  than it should and was possible located wrong. Changed histogram to use Q3 + 1.5 * IQR as
  outlier detector and added option to not do outlier clipping. Lots of little documentation
  updates. Updated to tzTime 0.6.5.
* 0.6.4 - 2013-02-08 - Fixed bug where Friday current will double count Friday in labels by 
  adding a tick on Saturday. Now it advances all the way to Sunday night.
* 0.6.3 - 2013-02-07 - Updated to tzTime 0.6.4 (potentially backward breaking to those who 
  were incorrectly instantiating Time objects from an ISOString without providing a timezone)
  Also, changed the way TimeSeriesCalculator takes into account the start so it works as
  expected if it falls on a weekend. This is also potentially backward breaking.
* 0.6.2 - 2013-02-06 - Close issue #10
* 0.6.1 - 2013-02-03 - Updated to the laster version of tzTime 0.6.2
* 0.6.0 - 2013-02-03 **Major backward breaking changes** 
  * Time, Timeline, and TimelineIterator have been split out to their own package, 
    [tzTime](https://github.com/lmaccherone/tzTime)
  * Lumenize has been simplfified down to four main classes: TimeSeriesCalculator, 
    TransitionsCalculator, TimeInStateCalculator, and OLAPCube
  * There are still a few addional helpers for data transformation and a histogram calculator 
    function. 
  * The three main calculators implement the same interface and take similar config objects. 
  * They provide a superset of all of the functionality previously found in Lumenize. 
  * They all use the OLAPCube abstraction so they are much easier to understand, maintain, and 
    upgrade. 
  * They now all support incremental updating, and serialization so you can cache results of 
    an earlier calculation and restart justfeeding in the updated information. 
  * All this AND significant performance gains.
  
  Things removed and gone forever:
  
  * Removed the concept of an "AtArray" and any functions that used it including 
    deriveFieldsAt, aggregationAtArray_To_HighChartsSeries, 
    groupByAtArray_To_HighChartsSeries, and snapshotArray_To_AtArray 
  * Similarly, the function-form of timeSeriesCalculator and timeSeriesGroupByCalculator have
    been removed. Use the class-form replacement.
  * GroupBy functionality is now contained in the TimeSeriesCalculator. There is no seperate
    class for it like there was a seperate function for it before.
  * Removed aggregate, derive, and groupBy. Their functionality is now contained in the 3 main
    calculators.
    
* 0.5.8 - 2013-01-31 - TimeSeriesCalculator now includes groupBy support. There will be
  no TimeSeriesGroupByCalculator.
* 0.5.7 - 2013-01-27 - TimeSeriesCalculator evolved based upon learning from Burn Chart
* 0.5.6 - 2013-01-24 - TimeSeriesCalculator class introduced (incremental, OLAP, etc.)
* 0.5.5 - 2013-01-17 - Histogram now works all the way down to 0
* 0.5.4 - 2013-01-17 - Histogram now works for bucketCount < 3
* 0.5.3 - 2013-01-13 - Bug fix to work with Rally's Throughput chart
* 0.5.2 - 2013-01-13 
  * Added TransitionsCalculator using OLAPCube
  * OLAPCube now allows for keepTotals on individual dimensions while still supporting
    the global config.keepTotals    
* 0.5.1 - 2013-01-06 **Backward breaking change**
  * TimeInStateCalculator now requires you to specify `config.trackLastValueForTheseFields`
    for any fields you want the last value maintained. Previously, the _ValidTo was 
    automatically tracked.
  * OLAPCube now has flattened input and flattened output
  * Minor bug fixes
* 0.5.0 - 2012-12-15 **Major backward breaking changes - not released to npm**
  * Major refactor of names/variables for inclusion in Rally's App SDK
  * All functions that previously started with a `$` no longer do
  * `$push()` is now `values()`
  * `$addToSet()` is now `uniqueValues()`
  * More parameters are pushed into the config Object parameter
  * OLAPCube introduced. It's a great general purpose calculator and surprisingly it is as
    efficient as the hand-coded calculators. I reimplemented the TimeInStateCalculator
    to use the OLAPCube, which gave it incremental updating for free.
  * ChartTime is now Time, ChartTimeRange is now Timeline, ChartTimeIterator is now 
    TimelineIterator. All three have various other backward breaking changes mostly having to
    do with defaults, method names, and method signatures. There are no semantic changes. 
  * ChartTimeInStateCalculator is now TimeInStateCalculator.
* 0.4.8 - 2012-12-08 - Turn off prefer global
* 0.4.7 - 2012-12-08 - Updated dependencies
* 0.4.6 - 2012-12-06 - More testing build and automatic npm publishing
* 0.4.5 - 2012-12-06 - Testing build and automatic npm publishing
* 0.4.4 - 2012-12-06 - Fixing issue with README.css showing up as cover page on npm
* 0.4.3 - 2012-11-28 - Cleaning up doc issues
* 0.4.2 - 2012-11-28 - Playing with using git tags for keeping old versions
* 0.4.1 - 2012-11-28 - Playing with using git branches for keeping old versions
* 0.4.0 - 2012-11-27 **Backward breaking change** 
  * No longer required/allowed to call Time.setTZPath()
  * Using JSDuck for documentation now
  * Build system now keeps old deploy versions
  * Pre-compiled directory removed
  * Bug fix for TimeInStateCalculator and snapshotArray_To_AtArray. They now sort (correctly). 
    snapshotArray_To_AtArray will now also propertly remove from later ticks any entity that
    falls out of scope. Previously, deletions were not registered correctly by
    snapshotArray_To_AtArray.
* 0.3.0 - 2012-10-13
  * Support for instantiating Time objects relative to now using strings (e.g. 'this day in
    Pacific/Fiji')
  * Added tests and fixed some bugs for timelineConfigs
* 0.2.7 - 2012-10-10 **Backward breaking change** 
  * Change to the structure of the data returned by groupBy() to match groupByAt()

## MIT License ##

Copyright (c) 2011, 2012, 2013 Lawrence S. Maccherone, Jr.

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





