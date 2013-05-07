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

acceptedValues = ['Accepted', 'Released']

exports.TimeSeriesProjection =

  testBasic: (test) ->

    granularity = Time.DAY
    tz = 'America/Chicago'
    holidays = [
      {year: 2011, month: 1, day: 5}  # Made up holiday to test knockout
    ]

    metrics = [
      {as: 'StoryUnitScope', field: 'PlanEstimate', f: 'sum'},
      {as: 'StoryCountScope', f: 'count'},
      {as: 'StoryUnitBurnUp', field: 'PlanEstimate', f: 'filteredSum', filterField: 'ScheduleState', filterValues: acceptedValues},
      {as: 'StoryCountBurnUp', f: 'filteredCount', filterField: 'ScheduleState', filterValues: acceptedValues}
    ]

    projectionsConfig = {
      limit: 6,
      series: [
        {as: 'ScopeProjection', field: 'StoryUnitScope', slope: 0.5},
        {field: 'StoryCountScope', slope: 0},  # How you do a level projection
        {field: 'StoryCountBurnUp'}
      ]
    }

    config =
      metrics: metrics
      projectionsConfig: projectionsConfig
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
          "label": "2011-01-02",
        },
        {
          "tick": "2011-01-04T06:00:00.000Z",
          "StoryUnitScope": 18,
          "StoryCountScope": 4,
          "StoryCountBurnUp": 0,
          "StoryUnitBurnUp": 0,
          "label": "2011-01-03",
        },
        {
          "tick": "2011-01-06T06:00:00.000Z",
          "StoryUnitScope": 20,
          "StoryCountScope": 5,
          "StoryCountBurnUp": 1,
          "StoryUnitBurnUp": 5,
          "label": "2011-01-04",
        },
        {
          "tick": "2011-01-07T06:00:00.000Z",
          "StoryUnitScope": 20,
          "StoryCountScope": 5,
          "StoryCountBurnUp": 2,
          "StoryUnitBurnUp": 8,
          "label": "2011-01-06",
        },
        {
          "tick": "2011-01-09T06:00:00.000Z",
          "StoryUnitScope": 18,
          "StoryCountScope": 4,
          "StoryCountBurnUp": 3,
          "StoryUnitBurnUp": 13,
          "label": "2011-01-07",
        },
        {
          "tick": "2011-01-10T06:00:00.000Z",
          "StoryUnitScope": 18,
          "StoryCountScope": 4,
          "StoryCountBurnUp": 3,
          "StoryUnitBurnUp": 13,
          "label": "2011-01-09",
          "ScopeProjection": 18,
          "StoryCountScope_projection": 4,
          "StoryCountBurnUp_projection": 3
        },
        {
          "tick": "2011-01-11T06:00:00.000Z",
          "label": "2011-01-10",
          "ScopeProjection": 18.5,
          "StoryCountScope_projection": 4,
          "StoryCountBurnUp_projection": 3.6
        },
        {
          "tick": "2011-01-12T06:00:00.000Z",
          "label": "2011-01-11",
          "ScopeProjection": 19,
          "StoryCountScope_projection": 4,
          "StoryCountBurnUp_projection": 4.2
        },
        {
          "tick": "2011-01-13T06:00:00.000Z",
          "label": "2011-01-12",
          "ScopeProjection": 19.5,
          "StoryCountScope_projection": 4,
          "StoryCountBurnUp_projection": 4.8
        },
        {
          "tick": "2011-01-14T06:00:00.000Z",
          "label": "2011-01-13",
          "ScopeProjection": 20,
          "StoryCountScope_projection": 4,
          "StoryCountBurnUp_projection": 5.4
        },
        {
          "tick": "2011-01-16T06:00:00.000Z",
          "label": "2011-01-14",
          "ScopeProjection": 20.5,
          "StoryCountScope_projection": 4,
          "StoryCountBurnUp_projection": 6.0
        },
        {
          "tick": "2011-01-17T06:00:00.000Z",
          "label": "2011-01-16",
          "ScopeProjection": 21,
          "StoryCountScope_projection": 4,
          "StoryCountBurnUp_projection": 6.6
        }
      ],
      summaryMetrics: {}
    }

    test.deepEqual(calculator.getResults(), expected)

    test.done()

  # !TODO: NEED TEST FOR UPTODATE CELL

  testPredicateToEnd: (test) ->

    granularity = Time.DAY
    tz = 'America/Chicago'
    holidays = [
      {year: 2011, month: 1, day: 5}  # Made up holiday to test knockout
    ]

    metrics = [
      {as: 'StoryCountScope', f: 'count'},
      {as: 'StoryCountBurnUp', f: 'filteredCount', filterField: 'ScheduleState', filterValues: acceptedValues}
    ]

    projectionsConfig = {
      continueWhile: (point) ->
        return point.StoryCountScope_projection > point.StoryCountBurnUp_projection
      series: [
        {field: 'StoryCountScope', slope: 0.4},  # How you do a level projection
        {field: 'StoryCountBurnUp'}
      ]
    }

    config =
      metrics: metrics
      projectionsConfig: projectionsConfig
      granularity: granularity
      tz: tz
      holidays: holidays
      workDays: 'Sunday,Monday,Tuesday,Wednesday,Thursday,Friday' # They work on Sundays

    calculator = new TimeSeriesCalculator(config)

    startOnISOString = new Time('2011-01-01').getISOStringInTZ(tz)
    upToDateISOString = new Time('2011-01-09').getISOStringInTZ(tz)

    calculator.addSnapshots(snapshots, startOnISOString, upToDateISOString)

    expected = {
      "tick": "2011-01-16T06:00:00.000Z",
      "label": "2011-01-14",
      "StoryCountScope_projection": 6.0,
      "StoryCountBurnUp_projection": 6.0
    }

    test.deepEqual(calculator.getResults().seriesData[10], expected)

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


