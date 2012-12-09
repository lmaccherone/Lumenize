
# Lumenize #

Copyright (c) 2009-2012, Lawrence S. Maccherone, Jr.

_Illuminating the forest AND the trees in your data._

Lumenize is a collection of tools for making awesome visualizations out of your data.

## Features ##

* Create time-series axis for charts
  * Knockout weekends, holidays, non-workhours
  * Work with timezone precision
  * Work in any granularity
    * Year, quarter, week, day, hour, etc.
    * No more recording `2012-03-05T00:00:00.000Z` when you really just mean `2012-03-05`
    * Create and use custom granularities: `R02I04-07` = Seventh day of fourth iteration in second release
* Create aggregations from temporal data models like Rally's Lookback API
* Tested - Over 300 tests
* [Documented](http://lmaccherone.github.com/Lumenize/docs/Lumenize-docs/index.html) - Robust documentation for an open source library
* [DocTested](https://github.com/lmaccherone/coffeedoctest) - The examples will always match the code because it fails automated testing
   when they don't

## Credits ##

Authors:

* [Larry Maccherone](http://maccherone.com)
* Jennifer Maccherone

Used when running:

* [timezoneJS](https://github.com/mde/timezone-js) - library for [tz file](http://www.twinsun.com/tz/tz-link.htm) parsing. Although I haven't touched the actual tz file parsing code, I have modified timezoneJS fairly significantly. The original included a drop-in replacement for JavaScript's Date object which I have removed. I also modified it to work on node.js and in the browser once "browserified" by bundling the tz files.

Used when developing:

* [Node.js](http://nodejs.org/)
* [CoffeeScript](http://coffeescript.org/)
* [coffeedoctest](https://github.com/lmaccherone/coffeedoctest) (by Larry Maccherone)
* [nodeunit](https://github.com/caolan/nodeunit)
* [browserify with fileify plugin (modified)](https://github.com/substack/node-browserify)
* [uglify-js](https://github.com/mishoo/UglifyJS)
* [wrench](https://github.com/ryanmcgrath/wrench-js)
* [marked](https://github.com/chjj/marked)

## Using from a browser ##

To use in a browser, either host it on your own site, or if your volume is low enough, you can directly hit the github pages for the deploy version:

`<script type="text/javascript" src="https://raw.github.com/lmaccherone/Lumenize/v{{version}}/deploy/Lumenize-min.js"></script>`

Replace `{{version}}` with the version of Lumenize you wish to use (probably the latest). See the Changelog section for information about versions. Example:

`<script type="text/javascript" src="https://raw.github.com/lmaccherone/Lumenize/v0.4.3/deploy/Lumenize-min.js"></script>`

The package is fairly large ~212KB but most of that is the embedded timezone files which compress really well. The Github pages server will gzip the package so it's only ~45KB over the wire.

Then at the top of the javascript where you want to call it, put the following:

`var lumenize = require('./lumenize');`

Then to use it, you can either create local aliases like:

`var ChartTime = lumenize.ChartTime;`

or you can just use the lumenize namespace:

`var stdDev = lumenize.functions.$standardDeviation([20, 30, 50]);`
    
## Installation for node.js usage ##

To install, run the following from the root folder of your project:

`npm install Lumenize --save`

## Contributing to Lumenize ##
    
If you want to add functionality to Lumenize, you'll need a working dev environment which is based upon node.js, so the first step is to install that on your system.
Once Node.js is installed, you should be able to run a few node package manager (npm) commands. Install the following:

* `sudo npm -g install coffee-script`
* `sudo npm -g install nodeunit`
 
Add the following to your ~/.profile or your ~/.bash_profile file
  
`NODE_PATH=/usr/local/lib/node_modules; export NODE_PATH`

After edit, restart your session or use command `source ~/.[bash_]profile` to activate the changes immediately.

Once you have the above installed, add tests for your upgrades and make sure all test pass with:

`cake test`
    
Also, add examples in the "docstrings", then generate the docs (which will also confirm that the examples give the expected output when run):

`cake docs`

Once you have that all working, submit a pull request on GitHub.

## Documentation and source code ##

* [API Documentation](http://lmaccherone.github.com/Lumenize/docs/Lumenize-docs/index.html)
* [Source Repository](https://github.com/lmaccherone/Lumenize)

## Changelog ##

In November of 2012, Lumenize wanted to start keeping old versions around because it was about to undergo a huge backward-breaking change. For a few days between 11-25 and 11-30, we were using an approach of multiple copies but then we switched to using git tags.

* 0.5.0 - 2012-12-15 (not pushed to github yet)
  * Major refactor of names/variables for inclusion in Rally's App SDK
* 0.4.8 - 2012-12-08 - Turn off prefer global
* 0.4.7 - 2012-12-08 - Updated dependencies
* 0.4.6 - 2012-12-06 - More testing build and automatic npm publishing
* 0.4.5 - 2012-12-06 - Testing build and automatic npm publishing
* 0.4.4 - 2012-12-06 - Fixing issue with README.css showing up as cover page on npm
* 0.4.3 - 2012-11-28 - Cleaning up doc issues
* 0.4.2 - 2012-11-28 - Playing with using git tags for keeping old versions
* 0.4.1 - 2012-11-28 - Playing with using git branches for keeping old versions
* 0.4.0 - 2012-11-27
  * **Backward breaking change** No longer required/allowed to call ChartTime.setTZPath()
  * Using JSDuck for documentation now
  * Build system now keeps old deploy versions
  * Pre-compiled directory removed
  * Bug fix for TimeInStateCalculator and snapshotArray_To_AtArray. They now sort (correctly). snapshotArray_To_AtArray will now also 
    propertly remove from later ticks any entity that falls out of scope. Previously, deletions were not registered correctly by
    snapshotArray_To_AtArray.
* 0.3.0 - 2012-10-13
  * Support for instantiating ChartTime objects relative to now using strings (e.g. 'this day in Pacific/Fiji')
  * Added tests and fixed some bugs for rangeSpecs
* 0.2.7 - 2012-10-10 - **Backward breaking change** to the structure of the data returned by groupBy() to match groupByAt()

## MIT License ##

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





