# !TODO: Add deriveFieldsOnInput with @config.deriveFieldsOnInputConfig calling deriveFieldsOnInput in OLAPCube
# !TODO: Add deriveFieldsOnOutput with @config.deriveFieldsOnOutputConfig calling deriveFieldsOnOutputConfig
# !TODO: Add drill-down support with uniqueIDField or maybe keepFacts = true

utils = require('./utils')
OLAPCube = require('./OLAPCube').OLAPCube
Timeline = require('./Timeline').Timeline
Time = require('./Time').Time
functions = require('./functions').functions

class TimeSeriesCalculator # implements iCalculator
  ###
  @class TimeSeriesCalculator
  This calculator is used to...

      lumenize = require('../')
      {TimeSeriesCalculator, Time} = lumenize

      snapshotsCSV = [
        ["ObjectID", "_ValidFrom",               "_ValidTo",                 "ScheduleState", "PlanEstimate", "TaskRemainingTotal", "TaskEstimateTotal"],

        [1,          "2010-10-10T15:00:00.000Z", "2011-01-02T13:00:00.000Z", "Ready to pull", 5             , 15                  , 15],  # Shouldn't show up, 2010 before start

        [1,          "2011-01-02T13:00:00.000Z", "2011-01-02T15:10:00.000Z", "Ready to pull", 5             , 15                  , 15],  # !TODO: Should get the same results even without this line
        [1,          "2011-01-02T15:10:00.000Z", "2011-01-03T15:00:00.000Z", "In progress"  , 5             , 20                  , 15],  # Testing it starting at one state and switching later to another
        [2,          "2011-01-02T15:00:00.000Z", "2011-01-03T15:00:00.000Z", "Ready to pull", 3             , 5                   , 5],
        [3,          "2011-01-02T15:00:00.000Z", "2011-01-03T15:00:00.000Z", "Ready to pull", 5             , 12                  , 12],

        [2,          "2011-01-03T15:00:00.000Z", "2011-01-04T15:00:00.000Z", "In progress"  , 3             , 5                   , 5],
        [3,          "2011-01-03T15:00:00.000Z", "2011-01-04T15:00:00.000Z", "Ready to pull", 5             , 12                  , 12],
        [4,          "2011-01-03T15:00:00.000Z", "2011-01-04T15:00:00.000Z", "Ready to pull", 5             , 15                  , 15],
        [1,          "2011-01-03T15:10:00.000Z", "2011-01-04T15:00:00.000Z", "In progress"  , 5             , 12                  , 15],  # Testing later change

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

      granularity = lumenize.Time.DAY
      tz = 'America/Chicago'
      holidays = [
        {year: 2011, month: 1, day: 5}  # Made up holiday to test knockout
      ]

      deriveFieldsOnInput = [
        {field: 'AcceptedStoryCount', f: (row) ->
          if row.ScheduleState in ['Accepted', 'Released']
            return 1
          else
            return 0
        },
        {field: 'AcceptedStoryPoints', f: (row) ->
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
          return max - index * incrementAmount
        },
        {as: 'Ideal2', f: (row, index, summaryMetrics, seriesData) ->
          if index < summaryMetrics.TaskUnitBurnDown_max_index
            return null
          else
            max = summaryMetrics.TaskUnitBurnDown_max
            increments = seriesData.length - 1 - summaryMetrics.TaskUnitBurnDown_max_index
            incrementAmount = max / increments
            return max - (index - summaryMetrics.TaskUnitBurnDown_max_index) * incrementAmount
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

      startOn = new Time('2011-01-03').getISOStringInTZ(tz)
      endBefore = new Time('2011-01-10').getISOStringInTZ(tz)

      calculator.addSnapshots(snapshots, startOn, endBefore)

      outArray =

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

    @cfg {Object[]} [metrics=[]] (required) Array which specifies the metrics to calculate for tick in time.

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
    @cfg {Object[]} deriveFieldsOnInput An Array of Maps in the form `{field:'myField', f:(fact)->...}`
    @cfg {Object[]} deriveFieldsOnOutput same format at deriveFieldsOnInput, except the callback is in the form `f(row)`
      This is only called for dirty rows that were effected by the latest round of additions in an incremental calculation.
    @cfg {Object[]} [summaryMetricsConfig] Allows you to specify a list of metrics to calculate on the results before returning.
      These can either be in the form of `{as: 'myMetric', field: 'field4`, f:'sum'}` which would extract all of the values
      for field `field4` and pass it as the values parameter to the `f` (`sum` in this example) function (from Lumenize.functions), or
      it can be in the form of `{as: 'myMetric', f:(@seriesData, @summaryMetrics) -> ...}`. Note, they are calculated
      in order, so you can use the result of an earlier summaryMetric to calculate a later one.
    @cfg {Object[]} deriveFieldsAfterSummary same format at deriveFieldsOnInput, except the callback is in the form `f(row, index, @summaryMetrics, @seriesData)`
      This is called on all rows every time you call getResults() so it's less efficient than deriveFieldsOnOutput. Only use it if you need
      the @summaryMetrics in your calculation.
    ###
    @config = utils.clone(config)
    # Assert that the configuration object is self-consistent and required parameters are present
    unless @config.validFromField?
      @config.validFromField = "_ValidFrom"
    unless @config.validToField?
      @config.validToField = "_ValidTo"
    unless @config.uniqueIDField?
      @config.uniqueIDField = "ObjectID"
    utils.assert(@config.tz?, "Must provide a timezone to this calculator.")
    utils.assert(@config.granularity?, "Must provide a granularity to this calculator.")

    inputCubeDimensions = [
      {field: @config.uniqueIDField},
      {field: 'ticks'}
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

    dimensions = [{field: 'ticks'}]

    cubeConfig =
      dimensions: dimensions
      metrics: @config.metrics
      deriveFieldsOnOutput: @config.deriveFieldsOnOutput

    @cube = new OLAPCube(cubeConfig)
    @upToDateISOString = null

    if @config.summaryMetricsConfig?
      for m in @config.summaryMetricsConfig
        functions.expandFandAs(m)

  addSnapshots: (snapshots, startOn, endBefore) ->
    ###
    @method addSnapshots
      Allows you to incrementally add snapshots to this calculator.
    @chainable
    @param {Object[]} snapshots An array of temporal data model snapshots.
    @param {String} startOn A ISOString (e.g. '2012-01-01T12:34:56.789Z') indicating the time start of the period of
      interest. On the second through nth call, this should equal the previous endBefore.
    @param {String} endBefore A ISOString (e.g. '2012-01-01T12:34:56.789Z') indicating the moment just past the time
      period of interest.
    @return {TimeInStateCalculator}
    ###
    if @upToDateISOString?
      utils.assert(@upToDateISOString == startOn, "startOn (#{startOn}) parameter should equal endBefore of previous call (#{@upToDateISOString}) to addSnapshots.")
    @upToDateISOString = endBefore
    timelineConfig = utils.clone(@config)
    timelineConfig.startOn = new Time(startOn, Time.MILLISECOND, @config.tz)
    timelineConfig.endBefore = new Time(endBefore, Time.MILLISECOND, @config.tz)
    timeline = new Timeline(timelineConfig)

    validSnapshots = []
    for s in snapshots
      ticks = timeline.ticksThatIntersect(s[@config.validFromField], s[@config.validToField], @config.tz)
      if ticks.length > 0
        s.ticks = ticks
        validSnapshots.push(s)

    inputCube = new OLAPCube(@inputCubeConfig, validSnapshots)

    @cube.addFacts(inputCube.getCells())

    return this

  getResults: () ->
    ###
    @method getResults
      Returns the current state of the calculator
    @return {Object[]} Returns an Array of Maps like `{<uniqueIDField>: <id>, ticks: <ticks>, lastValidTo: <lastValidTo>}`
    ###
    ticks = @cube.getDimensionValues('ticks')

    @seriesData = @cube.getCells()

    # derive summary metrics
    if @config.summaryMetricsConfig?
      @summaryMetrics = {}
      for summaryMetric in @config.summaryMetricsConfig
        if summaryMetric.field?
          # get all values of that field. Note, includes total rows (hierarchy and tags) so the callback might have to be careful about that. A sum might include more than you bargain for.
          values = []
          for row in @seriesData
            values.push(row[summaryMetric.field])
          @summaryMetrics[summaryMetric.as] = summaryMetric.f(values)
        else
          @summaryMetrics[summaryMetric.as] = summaryMetric.f(@seriesData, @summaryMetrics)

    # deriveFieldsAfterSummaryMetrics - This is more expensive than deriveFieldsOnOutput so only use it if you must.
    if @config.deriveFieldsAfterSummary?
      for row, index in @seriesData
        for d in @config.deriveFieldsAfterSummary
          row[d.as] = d.f(row, index, @summaryMetrics, @seriesData)

    return {@seriesData, @summaryMetrics}

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
    calculator = new TimeInStateCalculator(p.config)
    calculator.cube = OLAPCube.newFromSavedState(p.cubeSavedState)
    calculator.upToDateISOString = p.upToDateISOString
    if p.meta?
      calculator.meta = p.meta

    return calculator

exports.TimeSeriesCalculator = TimeSeriesCalculator
