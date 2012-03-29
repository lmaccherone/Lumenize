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









