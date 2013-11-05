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
        {field: 'StoryCountScope', slope: 0},  # 0 slope is a level projection
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
          "StoryUnitBurnUp": 0,
          "StoryCountBurnUp": 0,
          "label": "2011-01-02",
          "StoryCountBurnUp_projection": 0
        },
        {
          "tick": "2011-01-04T06:00:00.000Z",
          "StoryUnitScope": 18,
          "StoryCountScope": 4,
          "StoryUnitBurnUp": 0,
          "StoryCountBurnUp": 0,
          "label": "2011-01-03",
        },
        {
          "tick": "2011-01-06T06:00:00.000Z",
          "StoryUnitScope": 20,
          "StoryCountScope": 5,
          "StoryUnitBurnUp": 5,
          "StoryCountBurnUp": 1,
          "label": "2011-01-04",
        },
        {
          "tick": "2011-01-07T06:00:00.000Z",
          "StoryUnitScope": 20,
          "StoryCountScope": 5,
          "StoryUnitBurnUp": 8,
          "StoryCountBurnUp": 2,
          "label": "2011-01-06",
        },
        {
          "tick": "2011-01-09T06:00:00.000Z",
          "StoryUnitScope": 18,
          "StoryCountScope": 4,
          "StoryUnitBurnUp": 13,
          "StoryCountBurnUp": 3,
          "label": "2011-01-07",
        },
        {
          "tick": "2011-01-10T06:00:00.000Z",
          "StoryUnitScope": 18,
          "StoryCountScope": 4,
          "StoryUnitBurnUp": 13,
          "StoryCountBurnUp": 3,
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
      summaryMetrics: {},
      projections: {
        "limit": 6,
        "series": [
          {
            "as": "ScopeProjection",
            "field": "StoryUnitScope",
            "slope": 0.5
          },
          {
            "field": "StoryCountScope",
            "slope": 0
          },
          {
            "field": "StoryCountBurnUp",
            "startIndex": 0,
            "slope": 0.6
          }
        ],
        "minFractionToConsider": 0.3333333333333333,
        "minCountToConsider": 15,
        "pointsAddedCount": 6
        "lastPoint": {
          "tick": "2011-01-17T06:00:00.000Z",
          "label": "2011-01-16",
          "ScopeProjection": 21,
          "StoryCountScope_projection": 4,
          "StoryCountBurnUp_projection": 6.6
        }
      }
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
        {field: 'StoryCountScope', slope: 0.4},
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

  testVOptimal: (test) ->
    data = [{y: 1}, {y: 2}, {y: 3}, {y: 5}]
    result = TimeSeriesCalculator._findVOptimalProjectionStartIndex(data, 'y', 1)
    test.equal(result, 1)

    data.push({y: 8})
    result = TimeSeriesCalculator._findVOptimalProjectionStartIndex(data, 'y', 2)
    test.equal(result, 2)

    # shallow slope switching to steep slope should find the bend
    seriesDataCSV = [["a"],[1],[2],[3],[4],[5],[6],[7],[8],[9],[10],[20],[30],[40],[50],[60],[70],[80],[90],[100]]
    seriesData = csvStyleArray_To_ArrayOfMaps(seriesDataCSV)
    index = TimeSeriesCalculator._findVOptimalProjectionStartIndex(seriesData, 'a', 16)
    test.equal(index, 9)

    # steep slope switching to shallow slope should find the bend
    seriesDataCSV = [["a"],[0],[10],[20],[30],[40],[50],[60],[70],[80],[90],[100],[101],[102],[103],[104],[105],[106],[107],[108]]
    seriesData = csvStyleArray_To_ArrayOfMaps(seriesDataCSV)
    index = TimeSeriesCalculator._findVOptimalProjectionStartIndex(seriesData, 'a', 16)
    test.equal(index, 10)

    # shallow slope switching to steep slope should find the bend
    seriesDataCSV = [["a"],[1],[2],[3],[4],[5],[6],[7],[8],[9],[10],[22],[29],[38],[47],[63],[72],[79],[86],[100]]
    seriesData = csvStyleArray_To_ArrayOfMaps(seriesDataCSV)
    index = TimeSeriesCalculator._findVOptimalProjectionStartIndex(seriesData, 'a', 16)
    test.equal(index, 9)

    # steep slope switching to shallow slope should find the bend
    seriesDataCSV = [["a"],[0],[10],[20],[30],[40],[50],[60],[70],[80],[90],[100],[102],[102],[104],[105],[105],[106],[106],[108]]
    seriesData = csvStyleArray_To_ArrayOfMaps(seriesDataCSV)
    index = TimeSeriesCalculator._findVOptimalProjectionStartIndex(seriesData, 'a', 16)
    test.equal(index, 10)

    test.done()

  testVOptimalEndToEnd: (test) ->

    moreSnapshots = utils.clone(snapshots)

    moreSnapshots[16].PlanEstimate = 50
    moreSnapshots[20].PlanEstimate = 100

    granularity = Time.DAY
    tz = 'America/Chicago'
    holidays = [
      {year: 2011, month: 1, day: 5}  # Made up holiday to test knockout
    ]

    metrics = [
      {as: 'StoryUnitScope', field: 'PlanEstimate', f: 'sum'},
      {as: 'StoryUnitBurnUp', field: 'PlanEstimate', f: 'filteredSum', filterField: 'ScheduleState', filterValues: acceptedValues}
    ]

    projectionsConfig = {
      continueWhile: (point) ->
        return point.StoryCountScope_projection > point.StoryCountBurnUp_projection
      series: [
        {field: 'StoryUnitScope', slope: 0.4},
        {field: 'StoryUnitBurnUp'}
      ],
      minFractionToConsider: 0,
      minCountToConsider: 2
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

    calculator.addSnapshots(moreSnapshots, startOnISOString, upToDateISOString)
    projectionSeries = calculator.getResults().projections.series[1]

    test.equal(projectionSeries.startIndex, 0)
    test.equal(projectionSeries.slope, 22)

    test.done()

