###

# Lumenize #

Lumenize provides tools for aggregating data and creating timezone precise timelines for creating visualizations of
all sorts, with particular strength in time-series charts. This somewhat long example utilizes most of Lumenize's
functionality and should provid a good introduction to its capabilities.

The first two lines include Lumenize in your project and set the path to the timezone files.  They assume you are
running on node.js. If you are using the browserified package you will not need the first line and you can put any
string for the path in the second line since the timezone files are already loaded.

    Lumenize = require('../')
    Lumenize.ChartTime.setTZPath('../files/tz')  # Note, you can use anything here when using the browserified package

    snapshotsCSVStyle = [
      ["ObjectID", "_ValidFrom",           "_ValidTo",             "ScheduleState"  , "PlanEstimate"],

      [1,          "2010-10-10T15:00:00Z", "2011-01-02T13:00:00Z", "Ready to pull", 5               ],

      [1,          "2011-01-02T15:10:00Z", "2011-01-04T15:00:00Z", "In progress"  , 5               ],
      [2,          "2011-01-02T15:00:00Z", "2011-01-03T15:00:00Z", "Ready to pull", 3               ],
      [3,          "2011-01-02T15:00:00Z", "2011-01-03T15:00:00Z", "Ready to pull", 5               ],

      [2,          "2011-01-03T15:00:00Z", "2011-01-04T15:00:00Z", "In progress"  , 3               ],
      [3,          "2011-01-03T15:00:00Z", "2011-01-04T15:00:00Z", "Ready to pull", 5               ],
      [4,          "2011-01-03T15:00:00Z", "2011-01-04T15:00:00Z", "Ready to pull", 5               ],
      [1,          "2011-01-03T15:10:00Z", "2011-01-04T15:00:00Z", "In progress"  , 5               ],

      [1,          "2011-01-04T15:00:00Z", "2011-01-06T15:00:00Z", "Accepted"     , 5               ],
      [2,          "2011-01-04T15:00:00Z", "2011-01-06T15:00:00Z", "In test"      , 3               ],
      [3,          "2011-01-04T15:00:00Z", "2011-01-05T15:00:00Z", "In progress"  , 5               ],
      [4,          "2011-01-04T15:00:00Z", "2011-01-06T15:00:00Z", "Ready to pull", 5               ],
      [5,          "2011-01-04T15:00:00Z", "2011-01-06T15:00:00Z", "Ready to pull", 2               ],

      [3,          "2011-01-05T15:00:00Z", "2011-01-07T15:00:00Z", "In test"      , 5               ],

      [1,          "2011-01-06T15:00:00Z", "2011-01-07T15:00:00Z", "Released"     , 5               ],
      [2,          "2011-01-06T15:00:00Z", "2011-01-07T15:00:00Z", "Accepted"     , 3               ],
      [4,          "2011-01-06T15:00:00Z", "2011-01-07T15:00:00Z", "In progress"  , 5               ],
      [5,          "2011-01-06T15:00:00Z", "2011-01-07T15:00:00Z", "Ready to pull", 2               ],

      [1,          "2011-01-07T15:00:00Z", "9999-01-01T00:00:00Z", "Released"     , 5               ],
      [2,          "2011-01-07T15:00:00Z", "9999-01-01T00:00:00Z", "Released"     , 3               ],
      [3,          "2011-01-07T15:00:00Z", "9999-01-01T00:00:00Z", "Accepted"     , 5               ],
      [4,          "2011-01-07T15:00:00Z", "9999-01-01T00:00:00Z", "In test"      , 5               ],
      [5,          "2011-01-07T15:00:00Z", "9999-01-01T00:00:00Z", "In progress"  , 2               ]
    ]

    snapshotArray = Lumenize.csvStyleArray_To_ArrayOfMaps(snapshotsCSVStyle)

    rangeSpec = {
      "start": "2011-01-02"
      "pastEnd": "2011-01-08",
      "workDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],  # Also supports "Monday, Tuesday, ..."
      "holidays": [
        {"month": 1, "day": 1},
        {"month": 12, "day": 25},
        "2011-01-05"  # Made up holiday to demo holiday knockout
      ]
    }

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

    aggregationSpec = [  # Also, supports arbitrary functions like the derivedFieldSpec example above
      {"as": "scope", "f": "$count", "field": "ObjectID"},
      {"as": "accepted", "f": "$sum", "field": "accepted"}
    ]

    config = {
      snapshotValidFromField: '_ValidFrom',
      snapshotValidToField: '_ValidTo',
      snapshotUniqueID: 'ObjectID',
      timezone: 'America/New_York',
      rangeSpec: rangeSpec,
      derivedFields: derivedFields,
      aggregationSpec: aggregationSpec
    }

    {listOfAtCTs, aggregationAtArray} = Lumenize.timeSeriesCalculator(snapshotArray, config)

    for value, index in listOfAtCTs
      console.log(value.toString(), aggregationAtArray[index])

    # 2011-01-03 { scope: 3, accepted: 0 }
    # 2011-01-04 { scope: 4, accepted: 0 }
    # 2011-01-06 { scope: 5, accepted: 1 }
    # 2011-01-07 { scope: 5, accepted: 2 }

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

    config.aggregationSpec = [
      {"as": "scope", "f": "$sum", "field": "PlanEstimate"},
      {"as": "accepted", "f": "$sum", "field": "accepted"}
    ]

    {listOfAtCTs, aggregationAtArray} = Lumenize.timeSeriesCalculator(snapshotArray, config)

    for value, index in listOfAtCTs
      console.log(value.toString(), aggregationAtArray[index])

    # 2011-01-03 { scope: 13, accepted: 0 }
    # 2011-01-04 { scope: 18, accepted: 0 }
    # 2011-01-06 { scope: 20, accepted: 5 }
    # 2011-01-07 { scope: 20, accepted: 8 }

###

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
exports.percentileCreator = aggregate.percentileCreator
exports.timeSeriesCalculator = aggregate.timeSeriesCalculator
exports.timeSeriesGroupByCalculator = aggregate.timeSeriesGroupByCalculator

exports.functions = require('./src/functions').functions

derive = require('./src/derive')
exports.deriveFields = derive.deriveFields
exports.deriveFieldsAt = derive.deriveFieldsAt

exports.histogram = require('./src/histogram').histogram
