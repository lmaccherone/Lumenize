# !TODO: Clean up dependencies in package.json to only allow for patch updates so say, 0.3.x rather than >=0.3.0
###
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

* [Larry Maccherone](http://maccherone.com) (<Larry@Maccherone.com>)
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

`<script type="text/javascript" src="https://raw.github.com/lmaccherone/Lumenize/master/deploy/lumenize-min.js"></script>`

The package is fairly large ~240KB but most of that is the embedded timezone files which compress really well. The Github pages server will gzip 
the package so it's only ~49KB over the wire.

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
    
If you want to add functionality to Lumenize, you'll need a working dev environment. The following seems to accomplish that:

Once Node.js is installed, you should be able to run a few node package manager (npm) commands. Install the following:

* `sudo npm -g install coffee-script`
* `sudo npm -g install coffeedoc-lm`
* `sudo npm -g install coffeedoctest`
* `sudo npm -g install jitter`
* `sudo npm -g install nodeunit`
 
Add the following to your ~/.profile file
  
`NODE_PATH=/usr/local/lib/node_modules; export NODE_PATH`

After edit, restart your session or use command `source ~/.profile` to activate the changes immediately.

Once you have the above installed, add tests for your upgrades and make sure all test pass with:

`cake test`
    
Also, add examples in the "docstrings", then generate the docs (which will also confirm that the examples give the expected output when run):

`cake docs`

Once you have that all working, submit a pull request on GitHub.

## Documentation and source code ##

* [API Documentation](http://lmaccherone.github.com/Lumenize/docs/index.html)
* [Source Repository](https://github.com/lmaccherone/Lumenize)

## Changelog ##

* 0.3.0 - 2012-10-13
  * Support for instantiating ChartTime objects relative to now using strings (e.g. 'this day in Pacific/Fiji')
  * Added tests and fixed some bugs for rangeSpecs
  * Major refactor of aggregate module/file so the bigger calculators are all in their own module/file
* 0.2.7 - 2012-10-10 - **Backward breaking change** to the structure of the data returned by groupBy() to match groupByAt()

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

###

exports.timezoneJS = require('timezone-js').timezoneJS

exports.utils = require('./src/utils')

exports.ChartTime = require('./src/ChartTime').ChartTime

chartTimeIteratorAndRange = require('./src/ChartTimeIteratorAndRange')
exports.ChartTimeIterator = chartTimeIteratorAndRange.ChartTimeIterator
exports.ChartTimeRange = chartTimeIteratorAndRange.ChartTimeRange

exports.ChartTimeInStateCalculator = require('./src/ChartTimeInStateCalculator').ChartTimeInStateCalculator

datatransform = require('./src/dataTransform')
exports.csvStyleArray_To_ArrayOfMaps = datatransform.csvStyleArray_To_ArrayOfMaps
exports.snapshotArray_To_AtArray = datatransform.snapshotArray_To_AtArray
exports.groupByAtArray_To_HighChartsSeries = datatransform.groupByAtArray_To_HighChartsSeries
exports.aggregationAtArray_To_HighChartsSeries = datatransform.aggregationAtArray_To_HighChartsSeries

aggregate = require('./src/aggregate')
exports.aggregate = aggregate.aggregate
exports.aggregateAt = aggregate.aggregateAt
exports.groupBy = aggregate.groupBy
exports.groupByAt = aggregate.groupByAt
exports.functions = aggregate.functions
exports.percentileCreator = aggregate.percentileCreator
exports.timeSeriesCalculator = aggregate.timeSeriesCalculator
exports.timeSeriesGroupByCalculator = aggregate.timeSeriesGroupByCalculator

derive = require('./src/derive')
exports.deriveFields = derive.deriveFields
exports.deriveFieldsAt = derive.deriveFieldsAt

exports.histogram = require('./src/histogram').histogram
