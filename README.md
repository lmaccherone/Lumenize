# Lumenize #

Copyright (c) 2009-2012, Lawrence S. Maccherone, Jr.

_Illuminating the forest AND the trees in your data._

## Features ##

* Implementation of DSL and visualization patterns from Larry Maccherone's PhD
* Hierarchical OLAP cubes
* Date-time precision optimized for charting: timezone manipulation (eg America/New_York), knockout weekends/holidays,
  non-workhours, work in any granularity (year, quarter, week, day, hour, etc.), etc.
* Tested
* Documented
* [DocTested](https://github.com/lmaccherone/coffeedoctest)

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

`npm install Lumenize`
    
To install globally:

`sudo npm install -g Lumenize`
    
Or if you want the latest from source, download/clone from GitHub and run:

`cake install`
    
If you want to add functionality to Lumenize and submit a pull request, add tests for your upgrades and make sure all test pass with:

`cake test`
    
Also, add examples in the "docstrings", then generate the docs (which will also confirm that the examples give the expected output when run):

`cake docs`
    
## Documentation and source code ##

* [API Documentation](http://lmaccherone.github.com/Lumenize/docs/index.html)
* [github.com/lmaccherone/ChartTime](https://github.com/lmaccherone/Lumenize)



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







