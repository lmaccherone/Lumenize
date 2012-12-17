###

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

The `timelineConfig` defines the specification for the x-axis. Notice how you can exclude weekends and holidays. Here we
specify a `startOn` and a `endBefore`. However, it's fairly common in charts to specify `endBefore: "this day"` and
`limit: 60` (no `startOn`). A number of human readable dates like `"next month"` or `"previous week"` are supported. You
need to specify any 2 of startOn, endBefore, or limit.

    timelineConfig = {
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

The `aggregationConfig` supports a number of functions including sum, count, addToSet, standardDeviation,
p50 (for median), and p?? (for any quartile/percentile). It will also allow you to specify a callback function
like in derivedFields above if none of the built-in functions serves.

    aggregationConfig = [
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
      timelineConfig: timelineConfig,
      derivedFields: derivedFields,
      aggregationConfig: aggregationConfig
    }

Next, we call `Lumenize.timeSeriesCalculator` with the snapshots as well as the config object that we just built.
It will calculate the time-series data according to our specifications. It returns two values. A list of Time
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

    config.aggregationConfig = [
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

###

exports.Time = require('./src/Time').Time

Timeline = require('./src/Timeline')
exports.TimelineIterator = Timeline.TimelineIterator
exports.Timeline = Timeline.Timeline

exports.TimeInStateCalculator = require('./src/TimeInStateCalculator').TimeInStateCalculator

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
exports.timeSeriesCalculator = aggregate.timeSeriesCalculator
exports.timeSeriesGroupByCalculator = aggregate.timeSeriesGroupByCalculator

exports.functions = require('./src/functions').functions

derive = require('./src/derive')
exports.deriveFields = derive.deriveFields
exports.deriveFieldsAt = derive.deriveFieldsAt

exports.histogram = require('./src/histogram').histogram
