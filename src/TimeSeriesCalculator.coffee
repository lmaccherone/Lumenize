# !TODO: Add drill-down support with uniqueIDField or maybe keepFacts = true

OLAPCube = require('./OLAPCube').OLAPCube
{utils, Time, Timeline} = require('tztime')
functions = require('./functions').functions
JSON = require('JSON2')

class TimeSeriesCalculator # implements iCalculator
  ###
  @class TimeSeriesCalculator
  This calculator is used to convert snapshot data into time series aggregations.

  Below are two examples of using the TimeSeriesCalculator. The first is a detailed example showing how you would create
  a set of single-metric series (line, spline, or column). The second, is an example of creating a set of group-by series
  (like you would use to create a stacked column or stacked area chart). You can mix and match these on the same chart, but
  one type (a set of single-metric series versus a single group-by meta-series) typically dominates.

  ## Time-series example - a burn chart ##

  Let's start with a fairly large set of snapshots and create a set of series for a burn (up/down) chart.

      lumenize = require('../')
      {TimeSeriesCalculator, Time} = lumenize

      snapshotsCSV = [
        ["ObjectID", "_ValidFrom",               "_ValidTo",                 "ScheduleState", "PlanEstimate", "TaskRemainingTotal", "TaskEstimateTotal"],

        [1,          "2010-10-10T15:00:00.000Z", "2011-01-02T13:00:00.000Z", "Ready to pull", 5             , 15                  , 15],

        [1,          "2011-01-02T13:00:00.000Z", "2011-01-02T15:10:00.000Z", "Ready to pull", 5             , 15                  , 15],
        [1,          "2011-01-02T15:10:00.000Z", "2011-01-03T15:00:00.000Z", "In progress"  , 5             , 20                  , 15],
        [2,          "2011-01-02T15:00:00.000Z", "2011-01-03T15:00:00.000Z", "Ready to pull", 3             , 5                   , 5],
        [3,          "2011-01-02T15:00:00.000Z", "2011-01-03T15:00:00.000Z", "Ready to pull", 5             , 12                  , 12],

        [2,          "2011-01-03T15:00:00.000Z", "2011-01-04T15:00:00.000Z", "In progress"  , 3             , 5                   , 5],
        [3,          "2011-01-03T15:00:00.000Z", "2011-01-04T15:00:00.000Z", "Ready to pull", 5             , 12                  , 12],
        [4,          "2011-01-03T15:00:00.000Z", "2011-01-04T15:00:00.000Z", "Ready to pull", 5             , 15                  , 15],
        [1,          "2011-01-03T15:10:00.000Z", "2011-01-04T15:00:00.000Z", "In progress"  , 5             , 12                  , 15],

        [1,          "2011-01-04T15:00:00.000Z", "2011-01-06T15:00:00.000Z", "Accepted"     , 5             , 0                   , 15],
        [2,          "2011-01-04T15:00:00.000Z", "2011-01-06T15:00:00.000Z", "In test"      , 3             , 1                   , 5],
        [3,          "2011-01-04T15:00:00.000Z", "2011-01-05T15:00:00.000Z", "In progress"  , 5             , 10                  , 12],
        [4,          "2011-01-04T15:00:00.000Z", "2011-01-06T15:00:00.000Z", "Ready to pull", 5             , 15                  , 15],
        [5,          "2011-01-04T15:00:00.000Z", "2011-01-06T15:00:00.000Z", "Ready to pull", 2             , 4                   , 4],

        [3,          "2011-01-05T15:00:00.000Z", "2011-01-07T15:00:00.000Z", "In test"      , 5             , 5                   , 12],

        [1,          "2011-01-06T15:00:00.000Z", "2011-01-07T15:00:00.000Z", "Released"     , 5             , 0                   , 15],
        [2,          "2011-01-06T15:00:00.000Z", "2011-01-07T15:00:00.000Z", "Accepted"     , 3             , 0                   , 5],
        [4,          "2011-01-06T15:00:00.000Z", "2011-01-07T15:00:00.000Z", "In progress"  , 5             , 7                   , 15],
        [5,          "2011-01-06T15:00:00.000Z", "2011-01-07T15:00:00.000Z", "Ready to pull", 2             , 4                   , 4],

        [1,          "2011-01-07T15:00:00.000Z", "9999-01-01T00:00:00.000Z", "Released"     , 5            , 0                    , 15],
        [2,          "2011-01-07T15:00:00.000Z", "9999-01-01T00:00:00.000Z", "Released"     , 3            , 0                    , 5],
        [3,          "2011-01-07T15:00:00.000Z", "9999-01-01T00:00:00.000Z", "Accepted"     , 5            , 0                    , 12],
        [4,          "2011-01-07T15:00:00.000Z", "9999-01-01T00:00:00.000Z", "In test"      , 5            , 3                    , 15]  # Note: ObjectID 5 deleted
      ]

      snapshots = lumenize.csvStyleArray_To_ArrayOfMaps(snapshotsCSV)

  Let's add our first aggregation specification. You can add virtual fields to the input rows by providing your own callback function.

      deriveFieldsOnInput = [
        {as: 'PercentRemaining', f: (row) -> 100 * row.TaskRemainingTotal / row.TaskEstimateTotal }
      ]

  You can have as many of these derived fields as you wish. They are calculated in order to it's OK to use an earlier
  derived field when calculating a later one.

  Next, we use the native fields in the snapshots, plus our derived field above to calculate most of the chart
  series. Sums and counts are bread and butter, but all Lumenize.functions functions are supported (standardDeviation,
  median, percentile coverage, etc.) and Lumenize includes some functions specifically well suited to burn chart
  calculations (filteredSum, and filteredCount) as we shall now demonstrate.

      acceptedValues = ['Accepted', 'Released']

      metrics = [
        {as: 'StoryCountBurnUp', f: 'filteredCount', filterField: 'ScheduleState', filterValues: acceptedValues},
        {as: 'StoryUnitBurnUp', field: 'PlanEstimate', f: 'filteredSum', filterField: 'ScheduleState', filterValues: acceptedValues},
        {as: 'StoryUnitScope', field: 'PlanEstimate', f: 'sum'},
        {as: 'StoryCountScope', f: 'count'},
        {as: 'TaskUnitBurnDown', field: 'TaskRemainingTotal', f: 'sum'},
        {as: 'TaskUnitScope', field: 'TaskEstimateTotal', f: 'sum'},
        {as: 'MedianPercentRemaining', field: 'PercentRemaining', f: 'median'}
      ]

  Let's break this down. The first series uses a `filteredCount` function. What this says is "count the number of items
  where the ScheduleState is either 'Accepted' or 'Released' and store that in a series named 'StoryCountBurnUp'. The
  second series is very similar but instead of counting, we are summing the PlanEstimate field and sticking it in
  the StoryUnitBurnUp series. The next four series are simple sums or counts (no filtering) and the final series
  is a gratuitous use of the 'median' function least you forget that it can do more than counts and sums.

  Next, we specify the summary metrics for the chart. We're not really interested in displaying any summary metrics for
  this chart but we need to calculate the max values of two of the existing series in order to add the two ideal line series.
  Notice how the summary metric for TaskUnitBurnDown_max_index uses an earlier summary metric. They are calculated
  in order and made avalable in the scope of the callback function to enable this.

      summaryMetricsConfig = [
        {field: 'TaskUnitScope', f: 'max'},
        {field: 'TaskUnitBurnDown', f: 'max'},
        {as: 'TaskUnitBurnDown_max_index', f: (seriesData, summaryMetrics) ->
          for row, index in seriesData
            if row.TaskUnitBurnDown is summaryMetrics.TaskUnitBurnDown_max
              return index
        }
      ]

  The calculations from the summary metrics above are passed into the calculations for 'deriveFieldsAfterSummary'.
  Here is where we calculate two alternatives for the burn down ideal line.

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

  The two above series ignore the row values and simply key off of the index and summaryMetrics, but you could have
  used the row values to, for instance, add two existing series to create a third.

  Notice how the entire seriesData is available inside of your provided callback. This would allow you to derive a metric
  off of rows other than the current row like you would for a sliding-window calculation (Shewarts method).

  Just like all Lumenize Calculators, we can set holidays to be knocked out of the results.

      holidays = [
        {year: 2011, month: 1, day: 5}  # Made up holiday to test knockout
      ]

  Let's build the config Object from the above specifications and instantiate the calculator.

      config =
        deriveFieldsOnInput: deriveFieldsOnInput
        metrics: metrics
        summaryMetricsConfig: summaryMetricsConfig
        deriveFieldsAfterSummary: deriveFieldsAfterSummary
        granularity: lumenize.Time.DAY
        tz: 'America/Chicago'
        holidays: holidays
        workDays: 'Sunday,Monday,Tuesday,Wednesday,Thursday,Friday' # They work on Sundays

      calculator = new TimeSeriesCalculator(config)

  We can now send our snapshots into the calculator.

      startOnISOString = new Time('2011-01-02').getISOStringInTZ(config.tz)
      upToDateISOString = new Time('2011-01-10').getISOStringInTZ(config.tz)
      calculator.addSnapshots(snapshots, startOnISOString, upToDateISOString)

  Note, you must specify a startOnISOString and upToDateISOString. If you send in another round of snapshots, the new startOnISOString must match
  the upToDateISOString of the prior call to addSnapshots(). This is the key to  making sure that incremental calculations don't
  skip or double count anything. You can even send in the same snapshots in a later round and they won't be double
  counted. This idempotency property is also accomplished by the precise startOnISOString (current) upToDateISOString (prior) alignment.
  If you restore the calculator from a saved state, the upToDate property will contain the prior upToDateISOString. You can use
  this to compose a query that gets all of the snapshots necessary for the update. Just query with
  `_ValidTo: {$gte: upToDate}`. Note, this will refetch all the snapshots that were still active the last time
  you updated the calculator. This is expected and necessary.

  Let's print out our results and see what we have.

      keys = ['label', 'StoryUnitScope', 'StoryCountScope', 'StoryCountBurnUp',
        'StoryUnitBurnUp', 'TaskUnitBurnDown', 'TaskUnitScope', 'Ideal', 'Ideal2', 'MedianPercentRemaining']

      csv = lumenize.arrayOfMaps_To_CSVStyleArray(calculator.getResults().seriesData, keys)

      console.log(csv.slice(1))
      #  [ [ '2011-01-02', 13, 3, 0, 0, 37, 32, 51, null, 100 ],
      #    [ '2011-01-03', 18, 4, 0, 0, 44, 47, 42.5, 44, 100 ],
      #    [ '2011-01-04', 20, 5, 1, 5, 25, 51, 34, 35.2, 41.666666666666664 ],
      #    [ '2011-01-06', 20, 5, 2, 8, 16, 51, 25.5, 26.4, 41.666666666666664 ],
      #    [ '2011-01-07', 18, 4, 3, 13, 3, 47, 17, 17.59, 0 ],
      #    [ '2011-01-09', 18, 4, 3, 13, 3, 47, 8.5, 8.79, 0 ],
      #    [ '2011-01-10', 18, 4, 3, 13, 3, 47, 0, 0, 0 ] ]

  ## Time-series group-by example ##

      allowedValues = ['Ready to pull', 'In progress', 'In test', 'Accepted', 'Released']

  It supports both count and sum for group-by metrics

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

  Here is the output of the sum metrics

      keys = ['label'].concat(allowedValues)
      csv = lumenize.arrayOfMaps_To_CSVStyleArray(calculator.getResults().seriesData, keys)
      console.log(csv.slice(1))
      # [ [ '2010-12-31', 5, 0, 0, 0, 0 ],
      #   [ '2011-01-02', 8, 5, 0, 0, 0 ],
      #   [ '2011-01-03', 10, 8, 0, 0, 0 ],
      #   [ '2011-01-04', 7, 0, 8, 5, 0 ],
      #   [ '2011-01-06', 2, 5, 5, 3, 5 ],
      #   [ '2011-01-07', 0, 0, 5, 5, 8 ],
      #   [ '2011-01-09', 0, 0, 5, 5, 8 ] ]

  Here is the output of the count metrics

      keys = ['label'].concat('Count ' + a for a in allowedValues)
      csv = lumenize.arrayOfMaps_To_CSVStyleArray(calculator.getResults().seriesData, keys)
      console.log(csv.slice(1))
      # [ [ '2010-12-31', 1, 0, 0, 0, 0 ],
      #   [ '2011-01-02', 2, 1, 0, 0, 0 ],
      #   [ '2011-01-03', 2, 2, 0, 0, 0 ],
      #   [ '2011-01-04', 2, 0, 2, 1, 0 ],
      #   [ '2011-01-06', 1, 1, 1, 1, 1 ],
      #   [ '2011-01-07', 0, 0, 1, 1, 2 ],
      #   [ '2011-01-09', 0, 0, 1, 1, 2 ] ]

  We didn't output the MedianTaskRemainingTotal metric but it's in there. I included it to demonstrate that you can
  calculate non-group-by series along side group-by series.

  ###

  constructor: (config) ->
    ###
    @constructor
    @param {Object} config
    @cfg {String} tz The timezone for analysis
    @cfg {String} [validFromField = "_ValidFrom"]
    @cfg {String} [validToField = "_ValidTo"]
    @cfg {String} [uniqueIDField = "ObjectID"]
    @cfg {String} granularity 'month', 'week', 'quarter', 'day', etc. Use Time.MONTH, Time.WEEK, etc.
    @cfg {String[]/String} [workDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']] List of days of the week that you work on. You can specify this as an Array of Strings
       (['Monday', 'Tuesday', ...]) or a single comma seperated String ("Monday,Tuesday,...").
    @cfg {Object[]} [holidays] An optional Array containing rows that are either ISOStrings or JavaScript Objects
      (mix and match). Example: `[{month: 12, day: 25}, {year: 2011, month: 11, day: 24}, "2012-12-24"]`
       Notice how you can leave off the year if the holiday falls on the same day every year.
    @cfg {Object} [workDayStartOn] An optional object in the form {hour: 8, minute: 15}. If minute is zero it can be omitted.
       If workDayStartOn is later than workDayEndBefore, then it assumes that you work the night shift and your work
       hours span midnight. If tickGranularity is "hour" or finer, you probably want to set this; if tickGranularity is
       "day" or coarser, probably not.
    @cfg {Object} [workDayEndBefore] An optional object in the form {hour: 17, minute: 0}. If minute is zero it can be omitted.
       The use of workDayStartOn and workDayEndBefore only make sense when the granularity is "hour" or finer.
       Note: If the business closes at 5:00pm, you'll want to leave workDayEndBefore to 17:00, rather
       than 17:01. Think about it, you'll be open 4:59:59.999pm, but you'll be closed at 5:00pm. This also makes all of
       the math work. 9am to 5pm means 17 - 9 = an 8 hour work day.

    @cfg {Object[]} [metrics=[]] Array which specifies the metrics to calculate for tick in time.

      Example:

        config = {}
        config.metrics = [
          {field: 'field3'},                                      # defaults to metrics: ['sum']
          {field: 'field4', metrics: [
            {f: 'sum'},                                           # will add a metric named field4_sum
            {as: 'median4', f: 'p50'},                            # renamed p50 to median4 from default of field4_p50
            {as: 'myCount', f: (values) -> return values.length}  # user-supplied function
          ]}
        ]

      If you specify a field without any metrics, it will assume you want the sum but it will not automatically
      add the sum metric to fields with a metrics specification. User-supplied aggregation functions are also supported as
      shown in the 'myCount' metric above.

      Note, if the metric has dependencies (e.g. average depends upon count and sum) it will automatically add those to
      your metric definition. If you've already added a dependency but put it under a different "as", it's not smart
      enough to sense that and it will add it again. Either live with the duplication or leave
      dependency metrics named their default by not providing an "as" field.
    @cfg {Object[]} [deriveFieldsOnInput] An Array of Maps in the form `{field:'myField', f:(fact)->...}`
    @cfg {Object[]} [deriveFieldsOnOutput] same format at deriveFieldsOnInput, except the callback is in the form `f(row)`
      This is only called for dirty rows that were effected by the latest round of additions in an incremental calculation.
    @cfg {Object[]} [summaryMetricsConfig] Allows you to specify a list of metrics to calculate on the results before returning.
      These can either be in the form of `{as: 'myMetric', field: 'field4', f:'sum'}` which would extract all of the values
      for field `field4` and pass it as the values parameter to the `f` (`sum` in this example) function (from Lumenize.functions), or
      it can be in the form of `{as: 'myMetric', f:(seriesData, summaryMetrics) -> ...}`. Note, they are calculated
      in order, so you can use the result of an earlier summaryMetric to calculate a later one.
    @cfg {Object[]} [deriveFieldsAfterSummary] same format at deriveFieldsOnInput, except the callback is in the form `f(row, index, summaryMetrics, seriesData)`
      This is called on all rows every time you call getResults() so it's less efficient than deriveFieldsOnOutput. Only use it if you need
      the summaryMetrics in your calculation.
    @cfg {Object} [projectionsConfig] Allows you to project series into the future

      Example:

        projectionsConfig = {
          limit: 100  # optional, defaults to 300
          continueWhile: (point) ->  # Optional but recommended
            return point.StoryCountScope_projection > point.StoryCountBurnUp_projection
          minFractionToConsider: 1.0 / 2.0  # optional, defaults to 1/3
          minCountToConsider: 3  # optional, defaults to 15
          series: [
            {as: 'ScopeProjection', field: 'StoryUnitScope', slope: 0.5},
            {field: 'StoryCountScope', slope: 0},  # 0 slope is a level projection
            {field: 'StoryCountBurnUp'},  # Will use v-Optimal (least squares of difference in angle / count)
            {field: 'field5', startIndex: 0}  # 0 will use entire series. Add grab-handle to allow user to specify some other index
          ]
        }

      When a projectionsConfig is provided, the TimeSeriesCalculator will add points to the output seriesData showing
      the series being projected. These projected series will always start at the last point of the series and go out from there.
      By default, they are named the same as the series (field) they are projecting with '_projection' concatenated onto the end.
      However, this name can be overridden by using the `as` field of the series configuration.

      In addition to adding to the dataSeries, a summary of the projection is provided in the `projections` sub-field
      returned when you call `getResults()`. The format of this sub-field is something like this:

        projections = {
          "limit": 100,
          "series": [
            {"as": "ScopeProjection", "field": "StoryUnitScope", "slope": 0.5},
            {"field": "StoryCountScope", "slope": 0},
            {"field": "StoryCountBurnUp", "startIndex": 0, "slope": 0.6},
            {"field": "field5", "startIndex": 0, "slope": 0.123259838293}
          ],
          "minFractionToConsider": 0.5,
          "minCountToConsider": 3,
          "pointsAddedCount": 6,
          "lastPoint": {
            "tick": "2011-01-17T06:00:00.000Z",
            "label": "2011-01-16",
            "ScopeProjection": 21,
            "StoryCountScope_projection": 4,
            "StoryCountBurnUp_projection": 6.6
          }
        }

      You can inspect this returned Object to see what slope it used for each series. Also, if you were not
      rendering a chart but just wanted to use this calculator to make a holiday-knockout-precise forecast, you could
      inspect the `lastPoint.tick` field to identify when this work is forecast to finish.

      One thing to keep in mind when using this functionality is that these calculators in general and these projections
      in particular, is that the x-axis is a complex Timeline of ticks rather than simple linear calander time.
      So, these projections will take into account any holidays specified in the future.

      The `projectionsConfig` is a fairly complicated configuration in its own right. It is embedded in the config object
      for the overall TimeSeriesCalculator but it has a bunch of sub-configuration also. The five top level items are:
      `limit`, `continueWhile`, `minFractionToConsider`, `minCountToConsider`, and `series`.

      `limit` and `continueWhile`
      are used to control how far in the future the projection will go. It will stop at `limit` even if the `continueWhile`
      is always met. This will prevent the projection from becoming an infinite loop. The `continueWhile` predicate
      is technically not required but in almost all cases you will not know how far into the future you want to go
      so you will have to use it.

      `minFractionToConsider` and `minCountToConsider` are used for series where you allow the calculator to find
      the optimal starting point for the projection (the default behavior). It's very common for projects to start out slowly and then ramp up.
      The optimal algorithm is designed to find this knee where the difference in angle of the projection is the minimum
      of the square of the difference between the overall angle and all the sub-angles between this starting point going up to the point before
      the last point. This minimum is also divided by the number of points so using more data points for the projection
      is favored over using fewer. These two configuration parameters, `minFractionToConsider`, and `minCountToConsider`
      tell the v-optimal algorthim the minimum number or portion of points to consider. This prevents the algorithm
      from just using the angle of the last few points if they happen to be v-optimal. They currently default to the max of 1/3rd of the project or
      15 (3 work weeks if granularity is 'days'). Note, that the `minCountToConsider` default is optimized for
      granularity of 'days'. If you were to use granularity of weeks, I would suggest a much lower number like 3 to 5.
      If you were to use granularity of 'months' then maybe 2-3 months would suffice.

      The `series` sub-config is similar to the main series config, with a required `field` field and an optional
      `as` field. The remaining two possible fields (`startIndex` and `slope`) are both optional. They are also mutually
      exclusive with the `slope` trumping the `startIndex` in cases where both are mistakenly provided.
      If both are ommitted, then the projection will attempt to find the optimal starting point for the projection using the
      algorithm described above.

      If the `slope` is specified, it will override any `startingIndex` specification. You will commonly set this
      to 0 for scope series where you want the projection to only consider the current scope. If you set this manually,
      be sure to remember that the "run" (slope = rise / run) is ticks along the x-axis (holidays and weekends knocked out),
      not true calendar time. Also, note that in the output
      (`getResults().projections.series`), the slope will always be set even if you did not specify one in your original
      configuration. The startIndex or optimal (default) behaviors operate by setting this slope.

      The `startingIndex` is specified if you want to tell the projection from what point in time, the projection should
      start. Maybe the project doubled staff 3 months into the project and you want the projection to start from there.
      The common usage for this functionality is to provide a grab-handle on the chart and allow the user to use his
      insight combined with the visualization of the data series to pick his own optimal starting point. Note, if you
      specify a `startingIndex` you should not specify a `slope` and vice-versa.

      Note, that if you specify a `startIndex` or one is derived for you using the optimal algorithm, then the projection
      series will reach back into the seriesData to this startIndex. If you are using HighCharts, you will want to set
      connectNulls to true for projection series that have a startIndex. Projection series where you specify a `slope`
      start at the end of the dataSeries and only project into the future.

    @cfg {String/ISOString/Date/Lumenize.Time} [startOn=-infinity] This becomes the master startOn for the entire calculator limiting
      the calculator to only emit ticks equal to this or later.
    @cfg {String/ISOString/Date/Lumenize.Time} [endBefore=infinity] This becomes the master endBefore for the entire calculator
      limiting the calculator to only emit ticks before this.
    ###
    @config = utils.clone(config)
    @tickToLabelLookup = {}
    # Assert that the configuration object is self-consistent and required parameters are present
    unless @config.validFromField?
      @config.validFromField = "_ValidFrom"
    unless @config.validToField?
      @config.validToField = "_ValidTo"
    unless @config.uniqueIDField?
      @config.uniqueIDField = "ObjectID"
    utils.assert(@config.tz?, "Must provide a timezone to this calculator.")
    utils.assert(@config.granularity?, "Must provide a granularity to this calculator.")

    # translate groupByCount and groupBySum into deriveFieldsOnInput so:
    #   {field: 'PlanEstimate', groupByField: 'ScheduleState', f: 'groupBySum', allowedValues: ["a", "b"]}
    #
    # becomes in the deriveFieldsOnInput array:
    #   {as: "a", field: 'PlanEstimate', f: 'filteredSum', filterField: 'ScheduleState', filterValues: ["a"]}
    #   {as: "b", field: 'PlanEstimate', f: 'filteredSum', filterField: 'ScheduleState', filterValues: ["b"]}
    newMetrics = []
    for a in @config.metrics
      if a.f in ['groupBySum', 'groupByCount']
        unless a.prefix?
          a.prefix = ''
        for filterValue in a.allowedValues
          row = {
            as: a.prefix + filterValue,
            filterField: a.groupByField,
            filterValues: [filterValue]
          }
          if a.f == 'groupBySum'
            row.field = a.field
            row.f = 'filteredSum'
          else
            row.f = 'filteredCount'
          newMetrics.push(row)
      else
        newMetrics.push(a)

    @config.metrics = newMetrics

    filteredCountCreator = (filterField, filterValues) ->  # !TODO: Change this and the one below to strings with eval so they can be serialized and deserialized
      f = (row) ->
        if row[filterField] in filterValues then return 1 else return 0
      return f

    filteredSumCreator = (field, filterField, filterValues) ->
      f = (row) ->
        if row[filterField] in filterValues then return row[field] else return 0
      return f

    # add to deriveFieldsOnInput for filteredCount and filteredSum
    for a in @config.metrics
      if a.f in ['filteredCount', 'filteredSum']
        if a.f == 'filteredCount'
          f = filteredCountCreator(a.filterField, a.filterValues)
        else
          f = filteredSumCreator(a.field, a.filterField, a.filterValues)
        unless a.as?
          throw new Error("Must provide `as` specification for a `#{a.f}` metric.")
        unless @config.deriveFieldsOnInput?
          @config.deriveFieldsOnInput = []
        @config.deriveFieldsOnInput.push({as: a.as, f: f})
        a.f = 'sum'
        a.field = a.as

    inputCubeDimensions = [
      {field: @config.uniqueIDField},
      {field: 'tick'}
    ]

    fieldsMap = {}
    for m in @config.metrics
      if m.field?
        fieldsMap[m.field] = true

    inputCubeMetrics = []
    for field of fieldsMap
      inputCubeMetrics.push({field, f: 'firstValue', as: field})

    @inputCubeConfig =  # We just hold into this and use it when new snapshots are added
      dimensions: inputCubeDimensions
      metrics: inputCubeMetrics
      deriveFieldsOnInput: @config.deriveFieldsOnInput

    dimensions = [{field: 'tick'}]

    @cubeConfig =
      dimensions: dimensions
      metrics: @config.metrics
      deriveFieldsOnOutput: @config.deriveFieldsOnOutput

    @toDateCubeConfig = utils.clone(@cubeConfig)
    @toDateCubeConfig.deriveFieldsOnInput = @config.deriveFieldsOnInput

    @cube = new OLAPCube(@cubeConfig)
    @upToDateISOString = null

    if @config.summaryMetricsConfig?
      for m in @config.summaryMetricsConfig
        functions.expandFandAs(m)

    if config.startOn?
      @masterStartOnTime = new Time(config.startOn, @config.granularity, @config.tz)
    else
      @masterStartOnTime = new Time('BEFORE_FIRST', @config.granularity)
    if config.endBefore?
      @masterEndBeforeTime = new Time(config.endBefore, @config.granularity, @config.tz)
    else
      @masterEndBeforeTime = new Time('PAST_LAST', @config.granularity)

    if config.startOn? and config.endBefore?
      timelineConfig = utils.clone(@config)
      timelineConfig.startOn = @masterStartOnTime
      timelineConfig.endBefore = @masterEndBeforeTime
      timeline = new Timeline(timelineConfig)
      ticks = timeline.getAll('Timeline', @config.tz, @config.granularity)
      @tickToLabelLookup[tl.endBefore.getISOStringInTZ(config.tz)] = tl.startOn.toString() for tl in ticks

  addSnapshots: (snapshots, startOnISOString, upToDateISOString) ->
    ###
    @method addSnapshots
      Allows you to incrementally add snapshots to this calculator.
    @chainable
    @param {Object[]} snapshots An array of temporal data model snapshots.
    @param {String} startOnISOString A ISOString (e.g. '2012-01-01T12:34:56.789Z') indicating the time start of the period of
      interest. On the second through nth call, this should equal the previous upToDateISOString.
    @param {String} upToDateISOString A ISOString (e.g. '2012-01-01T12:34:56.789Z') indicating the moment just past the time
      period of interest.
    @return {TimeInStateCalculator}
    ###
    if @upToDateISOString?
      utils.assert(@upToDateISOString == startOnISOString, "startOnISOString (#{startOnISOString}) parameter should equal upToDateISOString of previous call (#{@upToDateISOString}) to addSnapshots.")

    @upToDateISOString = upToDateISOString

    advanceOneTimelineConfig = utils.clone(@config)
    advanceOneTimelineConfig.startOn = new Time(upToDateISOString, @config.granularity, @config.tz)
    delete advanceOneTimelineConfig.endBefore
    advanceOneTimelineConfig.limit = 2
    advanceOneTimeline = new Timeline(advanceOneTimelineConfig)
    advanceOneTimelineIterator = advanceOneTimeline.getIterator()
    advanceOneTimelineIterator.next()
    endBeforeTime = advanceOneTimelineIterator.next()

    timelineConfig = utils.clone(@config)

    startOnTime = new Time(startOnISOString, @config.granularity, @config.tz)

    if startOnTime.greaterThan(@masterStartOnTime)
      timelineConfig.startOn = startOnTime
    else
      timelineConfig.startOn = @masterStartOnTime

    if endBeforeTime.lessThan(@masterEndBeforeTime)
      timelineConfig.endBefore = endBeforeTime
    else
      timelineConfig.endBefore = @masterEndBeforeTime

    @asOfISOString = timelineConfig.endBefore.getISOStringInTZ(@config.tz)

    timeline = new Timeline(timelineConfig)
    ticks = timeline.getAll('Timeline', @config.tz, @config.granularity)
    @tickToLabelLookup[tl.endBefore.getISOStringInTZ(@config.tz)] = tl.startOn.toString() for tl in ticks

    validSnapshots = []
    for s in snapshots
      ticks = timeline.ticksThatIntersect(s[@config.validFromField], s[@config.validToField], @config.tz)
      if ticks.length > 0
        s.tick = ticks
        validSnapshots.push(s)

    inputCube = new OLAPCube(@inputCubeConfig, validSnapshots)

    @cube.addFacts(inputCube.getCells())

    if true or @masterEndBeforeTime.greaterThanOrEqual(endBeforeTime)
      @toDateSnapshots = []
      for s in snapshots
        if s[@config.validToField] > @asOfISOString >= s[@config.validFromField]
          @toDateSnapshots.push(s)
    else
      @toDateSnapshots = undefined

    return this

  getResults: () ->
    ###
    @method getResults
      Returns the current state of the calculator
    @return {Object[]} Returns an Array of Maps like `{<uniqueIDField>: <id>, ticks: <ticks>, lastValidTo: <lastValidTo>}`
    ###

    ticks = utils._.keys(@tickToLabelLookup).sort()
    labels = (@tickToLabelLookup[t] for t in ticks)

    # Calculate metrics for @toDateSnapshots
    if @toDateSnapshots? and @toDateSnapshots.length > 0
      for s in @toDateSnapshots
        s.tick = 'To Date'
      toDateCube = new OLAPCube(@toDateCubeConfig, @toDateSnapshots)
      toDateCell = toDateCube.getCells()[0]
      delete toDateCell._count

    # Add toDateCell and put labels on cells
    seriesData = []
    foundFirstNullCell = false
    for t, tickIndex in ticks
      cell = utils.clone(@cube.getCell({tick: t}))
      if cell?
        delete cell._count
      else
        startOn = new Time(labels[tickIndex]).getISOStringInTZ(@config.tz)
        if toDateCell and startOn < @asOfISOString <= t  # Then it's the to-date value
          cell = toDateCell
        else  # it's blank and should be filled in with nulls
          cell = {}
          for m in @config.metrics
            cell[m.as] = null
        cell.tick = t

      cell.label = @tickToLabelLookup[cell.tick]
      seriesData.push(cell)

    # derive summary metrics
    summaryMetrics = {}
    if @config.summaryMetricsConfig?
      for summaryMetric in @config.summaryMetricsConfig
        if summaryMetric.field?
          # get all values of that field
          values = []
          for row in seriesData
            values.push(row[summaryMetric.field])
          summaryMetrics[summaryMetric.as] = summaryMetric.f(values)
        else
          summaryMetrics[summaryMetric.as] = summaryMetric.f(seriesData, summaryMetrics)

    # deriveFieldsAfterSummaryMetrics - This is more expensive than deriveFieldsOnOutput so only use it if you must.
    if @config.deriveFieldsAfterSummary?
      for row, index in seriesData
        for d in @config.deriveFieldsAfterSummary
          row[d.as] = d.f(row, index, summaryMetrics, seriesData)

    # derive projections
    projections = {}
    if @config.projectionsConfig?
      projections = utils.clone(@config.projectionsConfig)
      # add to last point in seriesData
      lastIndex = seriesData.length - 1
      lastPoint = seriesData[lastIndex]
      lastTick = lastPoint.tick  # !TODO: May need to do something different if there is an upToDateCell
      for projectionSeries in projections.series
        as = projectionSeries.as || projectionSeries.field + "_projection"
        lastPoint[as] = lastPoint[projectionSeries.field]

      # set slope if missing
      for projectionSeries in projections.series
        unless projectionSeries.slope?
          unless projectionSeries.startIndex?
            unless projections.minFractionToConsider?
              projections.minFractionToConsider = 1.0 / 3.0
            unless projections.minCountToConsider?
              projections.minCountToConsider = 15

            highestIndexAllowed1 = Math.floor((1 - projections.minFractionToConsider) * seriesData.length) - 1
            highestIndexAllowed2 = seriesData.length - 1 - projections.minCountToConsider
            highestIndexAllowed = Math.min(highestIndexAllowed1, highestIndexAllowed2)

            if highestIndexAllowed < 1
              projectionSeries.startIndex = 0
            else
              projectionSeries.startIndex = TimeSeriesCalculator._findVOptimalProjectionStartIndex(seriesData, projectionSeries.field, highestIndexAllowed)

          startIndex = projectionSeries.startIndex
          startPoint = seriesData[startIndex]
          # Add first point in projection series for series where a startIndex is specified
          as = projectionSeries.as || projectionSeries.field + "_projection"
          startPoint[as] = startPoint[projectionSeries.field]
          # calculate slope
          projectionSeries.slope = (lastPoint[projectionSeries.field] - startPoint[projectionSeries.field]) / (lastIndex - startIndex)

      # get projectionTimelineIterator
      projectionTimelineConfig = utils.clone(@config)
      projectionTimelineConfig.startOn = new Time(lastTick, @config.granularity, @config.tz)
      delete projectionTimelineConfig.endBefore
      projectionTimelineConfig.limit = projections.limit || 300
      projectionTimeline = new Timeline(projectionTimelineConfig)
      projectionTimelineIterator = projectionTimeline.getIterator('Timeline')

      pointsAddedCount = 0
      projectedPoint = null
      while projectionTimelineIterator.hasNext() and (not projectedPoint? or (not projections.continueWhile? or projections.continueWhile(projectedPoint)))
        pointsAddedCount++
        projectedPoint = {}
        tick = projectionTimelineIterator.next()
        projectedPoint.tick = tick.endBefore.getISOStringInTZ(@config.tz)
        projectedPoint.label = tick.startOn.toString()
        for projectionSeries in projections.series
          as = projectionSeries.as || projectionSeries.field + "_projection"
          projectedPoint[as] = lastPoint[projectionSeries.field] + pointsAddedCount * projectionSeries.slope
        seriesData.push(projectedPoint)

      projections.pointsAddedCount = pointsAddedCount
      projections.lastPoint = projectedPoint

    return {seriesData, summaryMetrics, projections}

  @_findVOptimalProjectionStartIndex: (seriesData, field, highestIndexAllowed) ->
    utils.assert(highestIndexAllowed < seriesData.length - 2, "Cannot use the last two points for calculating v-optimal slope.")

    lastIndex = seriesData.length - 1
    lastPoint = seriesData[lastIndex]

    slopeToEnd = (index) =>
      return (lastPoint[field] - seriesData[index][field]) / (lastIndex - index)

    calculateTotalErrorSquared = (index) =>
      trialSlope = slopeToEnd(index)
      trialAngle = Math.atan(trialSlope)
      totalErrorSquared = 0
      for i in [(index + 1)..(lastIndex - 1)]
        currentSlope = slopeToEnd(i)
        currentAngle = Math.atan(currentSlope)
#        error = trialSlope - currentSlope
        error = trialAngle - currentAngle
        totalErrorSquared += error * error
      return totalErrorSquared

    minNormalizedErrorSquared = Number.MAX_VALUE
    indexForMinNormalizedErrorSquared = highestIndexAllowed
    for i in [highestIndexAllowed..0]
      errorSquared = calculateTotalErrorSquared(i)
      normalizedErrorSquared = errorSquared / (seriesData.length - 2 - i)
      if normalizedErrorSquared <= minNormalizedErrorSquared
        minNormalizedErrorSquared = normalizedErrorSquared
        indexForMinNormalizedErrorSquared = i

    return indexForMinNormalizedErrorSquared


  getStateForSaving: (meta) ->
    ###
    @method getStateForSaving
      Enables saving the state of this calculator. See class documentation for a detailed example.
    @param {Object} [meta] An optional parameter that will be added to the serialized output and added to the meta field
      within the deserialized calculator.
    @return {Object} Returns an Ojbect representing the state of the calculator. This Object is suitable for saving to
      to an object store. Use the static method `newFromSavedState()` with this Object as the parameter to reconstitute
      the calculator.
    ###
    out =
      config: @config
      cubeSavedState: @cube.getStateForSaving()
      upToDateISOString: @upToDateISOString
    if meta?
      out.meta = meta
    return out

  @newFromSavedState: (p) ->
    ###
    @method newFromSavedState
      Deserializes a previously saved calculator and returns a new calculator. See class documentation for a detailed example.
    @static
    @param {String/Object} p A String or Object from a previously saved state
    @return {TimeInStateCalculator}
    ###
    if utils.type(p) is 'string'
      p = JSON.parse(p)
    calculator = new TimeSeriesCalculator(p.config)
    calculator.cube = OLAPCube.newFromSavedState(p.cubeSavedState)
    calculator.upToDateISOString = p.upToDateISOString
    if p.meta?
      calculator.meta = p.meta

    return calculator

exports.TimeSeriesCalculator = TimeSeriesCalculator
