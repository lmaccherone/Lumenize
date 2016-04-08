# [Documentation](https://cdn.rawgit.com/lmaccherone/Lumenize/v1.0.3/docs/lumenize-docs/index.html)

[![build status](https://secure.travis-ci.org/lmaccherone/Lumenize.svg)](http://travis-ci.org/lmaccherone/Lumenize)
[![bitHound](https://www.bithound.io/github/lmaccherone/Lumenize/badges/score.svg)](https://www.bithound.io/github/lmaccherone/Lumenize/master)
[![Coverage Status](https://coveralls.io/repos/lmaccherone/Lumenize/badge.svg?branch=master&service=github)](https://coveralls.io/github/lmaccherone/Lumenize?branch=master)

# Lumenize #

Copyright (c) 2009-2013, Lawrence S. Maccherone, Jr.

_Illuminating the forest AND the trees in your data._

Lumenize is a collection of tools for analyzing and making awesome visualizations out of your data.

## Documentation and source code ##

* [API Documentation](https://cdn.rawgit.com/lmaccherone/Lumenize/v1.0.3/docs/lumenize-docs/index.html)
* [Source Repository](https://github.com/lmaccherone/Lumenize)

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
* [Documented (Lumenize)](https://cdn.rawgit.com/lmaccherone/Lumenize/v1.0.3/docs/lumenize-docs/index.html) [(tzTime)](http://lmaccherone.github.com/tzTime/docs/tztime-docs/index.html) - Robust documentation and examples
* [DocTested](https://github.com/lmaccherone/coffeedoctest) - The examples will always match 
  the code because it fails automated testing when they don't

## Credits ##

Authors:

* [Larry Maccherone](http://maccherone.com)
* Jennifer Maccherone

## Usage in a browser ##

To use in a browser, either host it on your own site, or if your volume is low enough, you can directly hit the github pages for the deploy version:

`<script type="text/javascript" src="https://cdn.rawgit.com/lmaccherone/Lumenize/v{{version}}/deploy/lumenize-min.js"></script>`

Replace `{{version}}` with the version of Lumenize you wish to use (probably the latest). See the Changelog section for information about versions. Example:

`<script type="text/javascript" src="https://cdn.rawgit.com/lmaccherone/Lumenize/v1.0.3/deploy/lumenize-min.js"></script>`

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

## Changelog ##

* 1.2.0 - 2016-04-08 - **Very slight chance this is backward breaking**. Finally fixed the v-opimal bucketer lopsideness
* 1.1.5 - 2016-03-29 - Made histogram.discriminated data better match HighCharts expectations
* 1.1.4 - 2016-03-29 - Upgraded histogram.discriminated to show the strength of the discrimination and output in HighCharts format 
* 1.1.3 - 2016-03-29 - Added histogram.discriminated 
* 1.1.2 - 2016-03-28 - keepFacts fix wasn't quite right 
* 1.1.1 - 2016-03-28 - Fixed bug with config.keepFacts only kept the first one. Note, this fix won't work with totals and 
  I have some question whether or not it will with hierarchical dimensions... but it didn't work at all before this fix
* 1.1.0 - 2016-03-12 - **Slightly backward breaking** OLAPCube.slice() now returns the column label rather than 'x'
  in the upper right corner
* 1.0.5 - 2016-03-02 - OLAPCube.slice() now implements default metric parameter 
* 1.0.4 - 2016-03-01 - Upgraded to tzTime latest to support webpack 
* 1.0.3 - 2015-12-14 - Still trying to fix caching 
* 1.0.2 - 2015-12-14 - Fixing CDN caching of old docs 
* 1.0.1 - 2015-12-14 - Switched from googleapis CDN to rawgit because publishing to googleapis has been troublesome 
* 1.0.0 - 2015-12-14 - **Backward breaking** UniqueIDField now defaults to "_EntityID" to match with Temporalize. 
  After several years, it's time to go 1.0.
* 0.9.12 - 2015-07-14 - OLAPCube now accepts facts with missing dimension and field values without erroring
* 0.9.11 - 2015-07-10 - Fixes missing .js from npm
* 0.9.10 - 2015-07-10 - Whoops, I removed iCalculator but not the reference to it. This version removes all reference.
* 0.9.9 - 2015-07-09 - Cleanup to enable code coverage with coffee-coverage and coveralls.io
* 0.9.8 - 2015-07-07 - Filters out facts missing any fields mentioned in dimensions or metrics
* 0.9.7 - 2015-06-02 - Removed JSON2 dependency. Updated to latest tzTime.
* 0.9.6 - 2015-05-31 - Updated Bower version
* 0.9.5 - 2015-05-06 - Added RandomPicker
* 0.9.4 - 2015-04-03 - Fixed broken link to documentation
* 0.9.3 - 2015-03-19 - Added OLAPCube.slice() and functions.median()
* 0.9.2 - 2015-02-23 - Table now gracefully handles missing data
* 0.9.1 - 2015-02-15 - Deal with real-world miner case for Store
* 0.9.0 - 2015-02-14 - Upgrades to Store for mining
* 0.8.6 - 2014-10-19 - Store now puts key dates into zulu time
* 0.8.5 - 2014-10-02 - Update to tzTime 0.7.0 which also has .js in npm for meteor
* 0.8.4 - 2014-10-02 - Fixes so .js files make it to npm and thus meteor
* 0.8.3 - 2014-10-02 - Fix for TravisCI failure due to not having coffee to compile upon npm install
* 0.8.2 - 2014-10-02 - Now compiles .coffee files upon npm install
* 0.8.1 - 2014-09-28 - Cleaned up documentation for Store
* 0.8.0 - 2014-09-23 - Added Store for snapshots
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





