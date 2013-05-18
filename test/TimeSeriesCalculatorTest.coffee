{TimeSeriesCalculator, csvStyleArray_To_ArrayOfMaps, arrayOfMaps_To_CSVStyleArray} = require('../')
{Time, utils} = require('tztime')

snapshotsCSV = [
  ["ObjectID", "_ValidFrom",               "_ValidTo",                 "ScheduleState", "PlanEstimate", "TaskRemainingTotal", "TaskEstimateTotal"],

  [1,          "2010-10-10T15:00:00.001Z", "2011-01-02T13:00:00.001Z", "Ready to pull", 5             , 15                  , 15],  # Shouldn't show up, 2010 before start

  [1,          "2011-01-02T13:00:00.001Z", "2011-01-02T15:10:00.001Z", "Ready to pull", 5             , 15                  , 15],  # !TODO: Should get the same results even without this line
  [1,          "2011-01-02T15:10:00.001Z", "2011-01-03T15:00:00.001Z", "In progress"  , 5             , 20                  , 15],  # Testing it starting at one state and switching later to another
  [2,          "2011-01-02T15:00:00.002Z", "2011-01-03T15:00:00.002Z", "Ready to pull", 3             , 5                   , 5],
  [3,          "2011-01-02T15:00:00.003Z", "2011-01-03T15:00:00.003Z", "Ready to pull", 5             , 12                  , 12],

  [2,          "2011-01-03T15:00:00.002Z", "2011-01-04T15:00:00.002Z", "In progress"  , 3             , 5                   , 5],
  [3,          "2011-01-03T15:00:00.003Z", "2011-01-04T15:00:00.003Z", "Ready to pull", 5             , 12                  , 12],
  [4,          "2011-01-03T15:00:00.004Z", "2011-01-04T15:00:00.004Z", "Ready to pull", 5             , 15                  , 15],
  [1,          "2011-01-03T15:10:00.001Z", "2011-01-04T15:00:00.001Z", "In progress"  , 5             , 12                  , 15],  # Testing later change

  [1,          "2011-01-04T15:00:00.001Z", "2011-01-06T15:00:00.001Z", "Accepted"     , 5             , 0                   , 15],
  [2,          "2011-01-04T15:00:00.002Z", "2011-01-06T15:00:00.002Z", "In test"      , 3             , 1                   , 5],
  [3,          "2011-01-04T15:00:00.003Z", "2011-01-05T15:00:00.003Z", "In progress"  , 5             , 10                  , 12],
  [4,          "2011-01-04T15:00:00.004Z", "2011-01-06T15:00:00.004Z", "Ready to pull", 5             , 15                  , 15],
  [5,          "2011-01-04T15:00:00.005Z", "2011-01-06T15:00:00.005Z", "Ready to pull", 2             , 4                   , 4],

  [3,          "2011-01-05T15:00:00.003Z", "2011-01-07T15:00:00.003Z", "In test"      , 5             , 5                   , 12],

  [1,          "2011-01-06T15:00:00.001Z", "2011-01-07T15:00:00.001Z", "Released"     , 5             , 0                   , 15],
  [2,          "2011-01-06T15:00:00.002Z", "2011-01-07T15:00:00.002Z", "Accepted"     , 3             , 0                   , 5],
  [4,          "2011-01-06T15:00:00.004Z", "2011-01-07T15:00:00.004Z", "In progress"  , 5             , 7                   , 15],
  [5,          "2011-01-06T15:00:00.005Z", "2011-01-07T15:00:00.005Z", "Ready to pull", 2             , 4                   , 4],

  [1,          "2011-01-07T15:00:00.001Z", "9999-01-01T00:00:00.001Z", "Released"     , 5            , 0                    , 15],
  [2,          "2011-01-07T15:00:00.002Z", "9999-01-01T00:00:00.002Z", "Released"     , 3            , 0                    , 5],
  [3,          "2011-01-07T15:00:00.003Z", "9999-01-01T00:00:00.003Z", "Accepted"     , 5            , 0                    , 12],
  [4,          "2011-01-07T15:00:00.004Z", "9999-01-01T00:00:00.004Z", "In test"      , 5            , 3                    , 15]
  # Note: ObjectID 5 deleted
]

snapshots = csvStyleArray_To_ArrayOfMaps(snapshotsCSV)

exports.TimeSeriesCalculatorTest =

  testBasic: (test) ->

    granularity = Time.DAY
    tz = 'America/Chicago'
    holidays = [
      {year: 2011, month: 1, day: 5}  # Made up holiday to test knockout
    ]

    deriveFieldsOnInput = [
      {as: 'AcceptedStoryCount', f: (row) ->
        if row.ScheduleState in ['Accepted', 'Released']
          return 1
        else
          return 0
      },
      {as: 'AcceptedStoryPoints', f: (row) ->
        if row.ScheduleState in ['Accepted', 'Released']
          return row.PlanEstimate
        else
          return 0
      }
    ]

    metrics = [
      {as: 'StoryUnitScope', field: 'PlanEstimate', f: 'sum'},
      {as: 'StoryCountScope', f: 'count'},
      {as: 'StoryCountBurnUp', field: 'AcceptedStoryCount', f: 'sum'},
      {as: 'StoryUnitBurnUp', field: 'AcceptedStoryPoints', f: 'sum'},
      {as: 'TaskUnitBurnDown', field: 'TaskRemainingTotal', f: 'sum'},
      {as: 'TaskUnitScope', field: 'TaskEstimateTotal', f: 'sum'}  # Note, we don't have the task count denormalized in stories so we can't have TaskCountScope nor TaskUnitBurnDown
    ]

    summaryMetricsConfig = [
      {field: 'TaskUnitScope', f: 'max'},
      {field: 'TaskUnitBurnDown', f: 'max'},
      {as: 'TaskUnitBurnDown_max_index', f: (seriesData, summaryMetrics) ->
        for row, index in seriesData
          if row.TaskUnitBurnDown is summaryMetrics.TaskUnitBurnDown_max
            return index
      }
    ]

    deriveFieldsAfterSummary = [
      {as: 'Ideal', f: (row, index, summaryMetrics, seriesData) ->
        max = summaryMetrics.TaskUnitScope_max
        increments = seriesData.length - 1
        incrementAmount = max / increments
        return Math.floor(100 * (max - index * incrementAmount)) / 100
      },
      {as: 'Ideal2', f: (row, index, summaryMetrics, seriesData) ->
        if index < summaryMetrics.TaskUnitBurnDown_max_index
          return null
        else
          max = summaryMetrics.TaskUnitBurnDown_max
          increments = seriesData.length - 1 - summaryMetrics.TaskUnitBurnDown_max_index
          incrementAmount = max / increments
          return Math.floor(100 * (max - (index - summaryMetrics.TaskUnitBurnDown_max_index) * incrementAmount)) / 100
      }
    ]

    config =  # default workDays
      deriveFieldsOnInput: deriveFieldsOnInput
      metrics: metrics
      summaryMetricsConfig: summaryMetricsConfig
      deriveFieldsAfterSummary: deriveFieldsAfterSummary
      granularity: granularity
      tz: tz
      holidays: holidays
      workDays: 'Sunday,Monday,Tuesday,Wednesday,Thursday,Friday' # They work on Sundays

    calculator = new TimeSeriesCalculator(config)

    startOnISOString = new Time('2011-01-01').getISOStringInTZ(tz)
    upToDateISOString = new Time('2011-01-09').getISOStringInTZ(tz)

    calculator.addSnapshots(snapshots, startOnISOString, upToDateISOString)

    expected = {
      "seriesData": [
        {
          "tick": "2011-01-03T06:00:00.000Z",
          "StoryUnitScope": 13,
          "StoryCountScope": 3,
          "StoryCountBurnUp": 0,
          "StoryUnitBurnUp": 0,
          "TaskUnitBurnDown": 37,
          "TaskUnitScope": 32,
          "label": "2011-01-02",
          "Ideal": 51,
          "Ideal2": null
        },
        {
          "tick": "2011-01-04T06:00:00.000Z",
          "StoryUnitScope": 18,
          "StoryCountScope": 4,
          "StoryCountBurnUp": 0,
          "StoryUnitBurnUp": 0,
          "TaskUnitBurnDown": 44,
          "TaskUnitScope": 47,
          "label": "2011-01-03",
          "Ideal": 40.79,
          "Ideal2": 44
        },
        {
          "tick": "2011-01-06T06:00:00.000Z",
          "StoryUnitScope": 20,
          "StoryCountScope": 5,
          "StoryCountBurnUp": 1,
          "StoryUnitBurnUp": 5,
          "TaskUnitBurnDown": 25,
          "TaskUnitScope": 51,
          "label": "2011-01-04",
          "Ideal": 30.6,
          "Ideal2": 33
        },
        {
          "tick": "2011-01-07T06:00:00.000Z",
          "StoryUnitScope": 20,
          "StoryCountScope": 5,
          "StoryCountBurnUp": 2,
          "StoryUnitBurnUp": 8,
          "TaskUnitBurnDown": 16,
          "TaskUnitScope": 51,
          "label": "2011-01-06",
          "Ideal": 20.4,
          "Ideal2": 22
        },
        {
          "tick": "2011-01-09T06:00:00.000Z",
          "StoryUnitScope": 18,
          "StoryCountScope": 4,
          "StoryCountBurnUp": 3,
          "StoryUnitBurnUp": 13,
          "TaskUnitBurnDown": 3,
          "TaskUnitScope": 47,
          "label": "2011-01-07",
          "Ideal": 10.2,
          "Ideal2": 11
        },
        {
          "tick": "2011-01-10T06:00:00.000Z",
          "StoryUnitScope": 18,
          "StoryCountScope": 4,
          "StoryCountBurnUp": 3,
          "StoryUnitBurnUp": 13,
          "TaskUnitBurnDown": 3,
          "TaskUnitScope": 47,
          "label": "2011-01-09",
          "Ideal": 0,
          "Ideal2": 0
        }
      ],
      "summaryMetrics": {
        "TaskUnitScope_max": 51,
        "TaskUnitBurnDown_max": 44,
        "TaskUnitBurnDown_max_index": 1
      },
      projections: {}
    }

    test.deepEqual(calculator.getResults(), expected)

    test.done()

  testIncremental: (test) ->

    granularity = Time.DAY
    tz = 'America/Chicago'
    holidays = [
      {year: 2011, month: 1, day: 5}  # Made up holiday to test knockout
    ]

    deriveFieldsOnInput = [
      {as: 'AcceptedStoryCount', f: (row) ->
        if row.ScheduleState in ['Accepted', 'Released']
          return 1
        else
          return 0
      },
      {as: 'AcceptedStoryPoints', f: (row) ->
        if row.ScheduleState in ['Accepted', 'Released']
          return row.PlanEstimate
        else
          return 0
      }
    ]

    metrics = [
      {as: 'StoryUnitScope', field: 'PlanEstimate', f: 'sum'},
      {as: 'StoryCountScope', f: 'count'},
      {as: 'StoryCountBurnUp', field: 'AcceptedStoryCount', f: 'sum'},
      {as: 'StoryUnitBurnUp', field: 'AcceptedStoryPoints', f: 'sum'},
      {as: 'TaskUnitBurnDown', field: 'TaskRemainingTotal', f: 'sum'},
      {as: 'TaskUnitScope', field: 'TaskEstimateTotal', f: 'sum'}  # Note, we don't have the task count denormalized in stories so we can't have TaskCountScope nor TaskUnitBurnDown
    ]

    config =  # default workDays
      deriveFieldsOnInput: deriveFieldsOnInput
      metrics: metrics
      granularity: granularity
      tz: tz
      holidays: holidays
      workDays: 'Sunday,Monday,Tuesday,Wednesday,Thursday,Friday' # They work on Sundays

    config2 = utils.clone(config)

    calculator = new TimeSeriesCalculator(config)
    startOnISOString = new Time('2011-01-03').getISOStringInTZ(tz)
    upToDateISOString = new Time('2011-01-10').getISOStringInTZ(tz)
    calculator.addSnapshots(snapshots, startOnISOString, upToDateISOString)

    calculator2 = new TimeSeriesCalculator(config2)

    startOnISOString = new Time('2011-01-03').getISOStringInTZ(tz)
    upToDateISOString = new Time('2011-01-05').getISOStringInTZ(tz)
    calculator2.addSnapshots(snapshots.slice(0, 9), startOnISOString, upToDateISOString)

    startOnISOString = upToDateISOString
    upToDateISOString = new Time('2011-01-10').getISOStringInTZ(tz)
    calculator2.addSnapshots(snapshots.slice(5), startOnISOString, upToDateISOString)

    test.deepEqual(calculator.getResults(), calculator2.getResults())

    test.done()

  testFilteredCountAndSum: (test) ->

    acceptedValues = ['Accepted', 'Released']

    metrics = [
      {as: 'StoryCountBurnUp', f: 'filteredCount', filterField: 'ScheduleState', filterValues: acceptedValues},
      {as: 'StoryUnitBurnUp', field: 'PlanEstimate', f: 'filteredSum', filterField: 'ScheduleState', filterValues: acceptedValues}
    ]

    holidays = [
      {year: 2011, month: 1, day: 5}  # Made up holiday to test knockout
    ]

    config =  # default workDays
      metrics: metrics
      granularity: Time.DAY
      tz: 'America/Chicago'
      holidays: holidays
      workDays: 'Sunday,Monday,Tuesday,Wednesday,Thursday,Friday' # They work on Sundays

    calculator = new TimeSeriesCalculator(config)

    startOnISOString = new Time('2011-01-01').getISOStringInTZ(config.tz)
    upToDateISOString = new Time('2011-01-09').getISOStringInTZ(config.tz)

    calculator.addSnapshots(snapshots, startOnISOString, upToDateISOString)

    expected = {
      seriesData: [
        {tick: '2011-01-03T06:00:00.000Z', StoryCountBurnUp: 0, StoryUnitBurnUp: 0, label: '2011-01-02'},
        {tick: '2011-01-04T06:00:00.000Z', StoryCountBurnUp: 0, StoryUnitBurnUp: 0, label: '2011-01-03'},
        {tick: '2011-01-06T06:00:00.000Z', StoryCountBurnUp: 1, StoryUnitBurnUp: 5, label: '2011-01-04'},
        {tick: '2011-01-07T06:00:00.000Z', StoryCountBurnUp: 2, StoryUnitBurnUp: 8, label: '2011-01-06'},
        {tick: '2011-01-09T06:00:00.000Z', StoryCountBurnUp: 3, StoryUnitBurnUp: 13, label: '2011-01-07'},
        {tick: '2011-01-10T06:00:00.000Z', StoryCountBurnUp: 3, StoryUnitBurnUp: 13, label: '2011-01-09'}
      ],
      summaryMetrics: {},
      projections: {}
    }

    test.deepEqual(calculator.getResults(), expected)

    test.done()

  testGroupBy: (test) ->

    allowedValues = ['Ready to pull', 'In progress', 'In test', 'Accepted', 'Released']

    metrics = [
      {f: 'groupBySum', field: 'PlanEstimate', groupByField: 'ScheduleState', allowedValues: allowedValues},
      {f: 'groupByCount', groupByField: 'ScheduleState', allowedValues: allowedValues, prefix: 'Count '},
      {as: 'MedianTaskRemainingTotal', field: 'TaskRemainingTotal', f: 'median'}  # An example of how you might overlay a line series
    ]

    holidays = [
      {year: 2011, month: 1, day: 5}  # Made up holiday to test knockout
    ]

    config =  # default workDays
      metrics: metrics
      granularity: Time.DAY
      tz: 'America/Chicago'
      holidays: holidays
      workDays: 'Sunday,Monday,Tuesday,Wednesday,Thursday,Friday' # They work on Sundays

    calculator = new TimeSeriesCalculator(config)

    startOnISOString = new Time('2010-12-31').getISOStringInTZ(config.tz)
    upToDateISOString = new Time('2011-01-09').getISOStringInTZ(config.tz)
    calculator.addSnapshots(snapshots, startOnISOString, upToDateISOString)

    keys = ['label'].concat(allowedValues)

    csv = arrayOfMaps_To_CSVStyleArray(calculator.getResults().seriesData, keys)

    expected = [
      [ '2010-12-31', 5, 0, 0, 0, 0 ],
      [ '2011-01-02', 8, 5, 0, 0, 0 ],
      [ '2011-01-03', 10, 8, 0, 0, 0 ],
      [ '2011-01-04', 7, 0, 8, 5, 0 ],
      [ '2011-01-06', 2, 5, 5, 3, 5 ],
      [ '2011-01-07', 0, 0, 5, 5, 8 ],
      [ '2011-01-09', 0, 0, 5, 5, 8 ]
    ]
    test.deepEqual(csv.slice(1), expected)

    keys = ['label'].concat('Count ' + a for a in allowedValues)

    csv = arrayOfMaps_To_CSVStyleArray(calculator.getResults().seriesData, keys)

    expected = [
      [ '2010-12-31', 1, 0, 0, 0, 0 ],
      [ '2011-01-02', 2, 1, 0, 0, 0 ],
      [ '2011-01-03', 2, 2, 0, 0, 0 ],
      [ '2011-01-04', 2, 0, 2, 1, 0 ],
      [ '2011-01-06', 1, 1, 1, 1, 1 ],
      [ '2011-01-07', 0, 0, 1, 1, 2 ],
      [ '2011-01-09', 0, 0, 1, 1, 2 ]
    ]
    test.deepEqual(csv.slice(1), expected)

    test.done()

  testSmall: (test) ->  # Duplicates the error in Issue #10

    granularity = Time.DAY
    tz = 'America/Chicago'

    metrics = [
      {as: 'StoryUnitScope', field: 'PlanEstimate', f: 'sum'},
    ]

    config =  # default workDays
      metrics: metrics
      granularity: granularity
      tz: tz

    calculator = new TimeSeriesCalculator(config)
    startOnISOString = new Time('2011-01-03').getISOStringInTZ(tz)
    upToDateISOString = new Time('2011-01-10').getISOStringInTZ(tz)

    oneRowOfSnapshots = snapshots.slice(7, 8)
    calculator.addSnapshots(oneRowOfSnapshots, startOnISOString, upToDateISOString)
    expected = {
      tick: '2011-01-04T06:00:00.000Z',
      StoryUnitScope: 5,
      label: '2011-01-03'
    }
    test.deepEqual(calculator.getResults().seriesData[0], expected)

    test.done()

  testTimezoneBoundaries: (test) ->
    csvStyleArray = [
      ["ObjectID",    "_ValidFrom",               "_ValidTo",                 "Value"],
      [1,             "2011-01-04T01:00:00.000Z", "2011-01-05T04:59:59.999Z", 10,    ], # Start and end in 01-03 in NY
      [1,             "2011-01-05T04:59:59.999Z", "2011-01-06T05:00:00.000Z", 5,     ], # Start on 01-03 end in 01-04 but last moment
      [1,             "2011-01-06T05:00:00.000Z", "2011-01-07T15:00:00.000Z", 3,     ], # Start on 01-05 but very first momement end in middle of 01-06
      [1,             "2011-01-07T15:00:00.000Z", "9999-01-01T00:00:00.000Z", 2,     ],
    ]

    snapshots = csvStyleArray_To_ArrayOfMaps(csvStyleArray)

    config =
      granularity: Time.DAY
      tz: "America/New_York"
      metrics: [
        {field: 'Value', f: 'sum'}
      ]

    calculator = new TimeSeriesCalculator(config)

    startOnISOString = new Time("2011-01-02").getISOStringInTZ(config.tz)
    upToDateISOString = new Time("2011-01-10").getISOStringInTZ(config.tz)
    calculator.addSnapshots(snapshots, startOnISOString, upToDateISOString)

#    console.log(arrayOfMaps_To_CSVStyleArray(calculator.getResults().seriesData))

    expected = [
      [ 'tick', 'Value_sum', 'label' ],
      [ '2011-01-04T05:00:00.000Z', 10, '2011-01-03' ],
      [ '2011-01-05T05:00:00.000Z', 5, '2011-01-04' ],
      [ '2011-01-06T05:00:00.000Z', 3, '2011-01-05' ],
      [ '2011-01-07T05:00:00.000Z', 3, '2011-01-06' ],
      [ '2011-01-10T05:00:00.000Z', 2, '2011-01-07' ],
      [ '2011-01-11T05:00:00.000Z', 2, '2011-01-10' ]
    ]

    test.deepEqual(arrayOfMaps_To_CSVStyleArray(calculator.getResults().seriesData), expected)

    test.done()

  testMasterTicksAndLabels: (test) ->
    config =
      startOn: "2010-12-29"
      endBefore: "2011-01-07"
      granularity: Time.DAY
      tz: "America/New_York"
      metrics: [
        {field: 'Value', f: 'sum'}
      ]

    calculator = new TimeSeriesCalculator(config)

    expected = [
      {tick: '2010-12-30T05:00:00.000Z', label: '2010-12-29'},
      {tick: '2010-12-31T05:00:00.000Z', label: '2010-12-30'},
      {tick: '2011-01-03T05:00:00.000Z', label: '2010-12-31'},
      {tick: '2011-01-04T05:00:00.000Z', label: '2011-01-03'},
      {tick: '2011-01-05T05:00:00.000Z', label: '2011-01-04'},
      {tick: '2011-01-06T05:00:00.000Z', label: '2011-01-05'},
      {tick: '2011-01-07T05:00:00.000Z', label: '2011-01-06'}
    ]

    results = ({tick: r.tick, label: r.label} for r in calculator.getResults().seriesData)

    test.deepEqual(results, expected)

    test.done()

  testIncrementalTicksAndLabels: (test) ->
    csvStyleArray = [
      ["ObjectID",    "_ValidFrom",               "_ValidTo",                 "Value"],
      [1,             "2011-01-03T01:00:00.000Z", "2011-01-04T04:59:59.999Z", 10,    ], # Start and end in 01-03 in NY
      [1,             "2011-01-04T04:59:59.999Z", "2011-01-05T05:00:00.000Z", 5,     ], # Start on 01-03 end in 01-04 but last moment
      [1,             "2011-01-05T05:00:00.000Z", "2011-01-06T15:00:00.000Z", 3,     ], # Start on 01-05 but very first momement end in middle of 01-06
      [1,             "2011-01-06T15:00:00.000Z", "9999-01-01T00:00:00.000Z", 2,     ],
    ]

    snapshots = csvStyleArray_To_ArrayOfMaps(csvStyleArray)

    config =
      granularity: Time.DAY
      tz: "America/New_York"
      metrics: [
        {field: 'Value', f: 'sum'}
      ]

    calculator = new TimeSeriesCalculator(config)

    startOnISOString = new Time("2010-12-29").getISOStringInTZ(config.tz)
    upToDateISOString = new Time("2011-01-06").getISOStringInTZ(config.tz)
    calculator.addSnapshots(snapshots, startOnISOString, upToDateISOString)

    expected = [
      {tick: '2010-12-30T05:00:00.000Z', label: '2010-12-29'},
      {tick: '2010-12-31T05:00:00.000Z', label: '2010-12-30'},
      {tick: '2011-01-03T05:00:00.000Z', label: '2010-12-31'},
      {tick: '2011-01-04T05:00:00.000Z', label: '2011-01-03'},
      {tick: '2011-01-05T05:00:00.000Z', label: '2011-01-04'},
      {tick: '2011-01-06T05:00:00.000Z', label: '2011-01-05'},
      {tick: '2011-01-07T05:00:00.000Z', label: '2011-01-06'}
    ]

    results = ({tick: r.tick, label: r.label} for r in calculator.getResults().seriesData)

    test.deepEqual(results, expected)

    test.done()

  testClampingToMasterTimeline: (test) ->
    csvStyleArray = [
      ["ObjectID",    "_ValidFrom",               "_ValidTo",                 "Value"],
      [1,             "2009-01-01T12:00:00.000Z", "2013-01-01T12:00:00.000Z", 1,    ], # Start before end after 2011
      [2,             "2009-01-01T12:00:00.000Z", "2011-06-01T12:00:00.000Z", 2,    ], # Start before end inside 2011
      [3,             "2011-06-01T12:00:00.000Z", "2011-08-01T12:00:00.000Z", 3,    ], # Start and end inside 2011
      [4,             "2011-06-01T12:00:00.000Z", "2013-01-01T12:00:00.000Z", 4,    ], # Start inside and end after 2011
      [5,             "2009-01-01T12:00:00.000Z", "2009-03-01T12:00:00.000Z", 5,    ], # Start and end before 2011
      [6,             "2013-01-01T12:00:00.000Z", "2013-03-01T12:00:00.000Z", 6,    ], # Start and end after 2011
    ]

    snapshots = csvStyleArray_To_ArrayOfMaps(csvStyleArray)

    config =
      granularity: Time.MONTH
      tz: "America/New_York"
      metrics: [
        {as: 'values', field: 'ObjectID', f: 'values'}
      ]

    calculator = new TimeSeriesCalculator(config)

    startOnISOString = new Time("2011-01-01").getISOStringInTZ(config.tz)
    upToDateISOString = new Time("2011-12-31").getISOStringInTZ(config.tz)
    calculator.addSnapshots(snapshots, startOnISOString, upToDateISOString)

    expected = [
      {label: '2011-01', values: [1, 2]},
      {label: '2011-02', values: [1, 2]},
      {label: '2011-03', values: [1, 2]},
      {label: '2011-04', values: [1, 2]},
      {label: '2011-05', values: [1, 2]},
      {label: '2011-06', values: [1, 3, 4]},
      {label: '2011-07', values: [1, 3, 4]},
      {label: '2011-08', values: [1, 4]},
      {label: '2011-09', values: [1, 4]},
      {label: '2011-10', values: [1, 4]},
      {label: '2011-11', values: [1, 4]},
      {label: '2011-12', values: [1, 4]},
    ]

    values = ({label: r.label, values: r.values} for r in calculator.getResults().seriesData)

    test.deepEqual(values, expected)

    test.done()
