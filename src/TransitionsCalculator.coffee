# !TODO: Add deriveFieldsOnSnapshots with @config.deriveFieldsOnSnapshotsConfig calling deriveFieldsOnFacts in OLAPCube
# !TODO: Add deriveFieldsOnResults with @config.deriveFieldsOnResultsConfig calling deriveFieldsOnResultsConfig
# !TODO: Add drill-down support with uniqueIDField or maybe keepFacts = true
# !TODO: Add series by type support

OLAPCube = require('./OLAPCube').OLAPCube
{utils, Time, Timeline} = require('tztime')
JSON = require('JSON2')

class TransitionsCalculator # implements iCalculator
  ###
  @class TransitionsCalculator

  Used to accumlate counts and sums about transitions.

  Let's say that you want to create a throughput or velocity chart where each column on the chart represents the
  number of work items that cross over from one state into another state in a given month/week/quarter/etc. You would
  send a transitions to a temporal data store like Rally's Lookback API specifying both the current values and the
  previous values. For instance, the work items crossing from "In Progress" to "Completed" could be found
  with this query clause `"_PreviousValues.ScheduleState": {"$lte": "In Progress"}, "ScheduleState": {"$gt": "In Progress"}`

      {TransitionsCalculator, Time} = require('../')

      snapshots = [
        { id: 1, from: '2011-01-03T00:00:00.000Z', PlanEstimate: 10 },
        { id: 1, from: '2011-01-05T00:00:00.000Z', PlanEstimate: 10 },
        { id: 2, from: '2011-01-04T00:00:00.000Z', PlanEstimate: 20 },
        { id: 3, from: '2011-01-10T00:00:00.000Z', PlanEstimate: 30 },
        { id: 4, from: '2011-01-11T00:00:00.000Z', PlanEstimate: 40 },
        { id: 5, from: '2011-01-17T00:00:00.000Z', PlanEstimate: 50 },
        { id: 6, from: '2011-02-07T00:00:00.000Z', PlanEstimate: 60 },
        { id: 7, from: '2011-02-08T00:00:00.000Z', PlanEstimate: 70 },
      ]

  But that's not the entire story. What if something crosses over into "Completed" and beyond but crosses back. It could
  do this several times and get counted multiple times. That would be bad. The way we deal with this is to also
  look for the list of snapshots that pass backwards across the boundary and subract thier impact on the final calculations.

  One can think of alternative aproaches for avoiding this double counting. You could, for instance, only count the last
  transition for each unique work item. The problem with this approach is that the backward moving transition might
  occur in a different time period from the forward moving one. A later snapshot could invalidate an earlier calculation
  which is bad for incremental calculation and caching. To complicate matters, the field values being summed by the
  calculator might have changed between subsequent forward/backward transitions. The chosen algorithm is the only way I know to
  preserve the idempotency and cachable incremental calculation properties.

      snapshotsToSubtract = [
        { id: 1, from: '2011-01-04T00:00:00.000Z', PlanEstimate: 10 },
        { id: 7, from: '2011-02-09T00:00:00.000Z', PlanEstimate: 70 },
      ]

  The calculator will keep track of the count of items automatically (think throughput), but if you want to sum up a
  particular field (think velocity), you can specify that with the 'fieldsToSum' config property.

      fieldsToSum = ['PlanEstimate']

  Now let's build our config object.

      config =
        asOf: '2011-02-10'  # Leave this off if you want it to continuously update to today
        granularity: Time.MONTH
        tz: 'America/Chicago'
        validFromField: 'from'
        validToField: 'to'
        uniqueIDField: 'id'
        fieldsToSum: fieldsToSum
        asterixToDateTimePeriod: true  # Set to false or leave off if you are going to reformat the timePeriod

  In most cases, you'll want to leave off the `asOf` configuration property so the data can be continuously updated
  with new snapshots as they come in. We include it in this example so the output stays stable. If we hadn't, then
  the rows would continue to grow to encompass today.

      startOn = '2011-01-02T00:00:00.000Z'
      endBefore = '2011-02-27T00:00:00.000Z'

      calculator = new TransitionsCalculator(config)
      calculator.addSnapshots(snapshots, startOn, endBefore, snapshotsToSubtract)

      console.log(calculator.getResults())
      # [ { timePeriod: '2011-01', count: 5, PlanEstimate: 150 },
      #   { timePeriod: '2011-02*', count: 1, PlanEstimate: 60 } ]

  The asterix on the last row in the results is to indicate that it is a to-date value. As more snapshots come in, this
  last row will change. The caching and incremental calcuation capability of this Calculator are designed to take
  this into account.

  Now, let's use the same data but aggregate in granularity of weeks.

      config.granularity = Time.WEEK
      calculator = new TransitionsCalculator(config)
      calculator.addSnapshots(snapshots, startOn, endBefore, snapshotsToSubtract)

      console.log(calculator.getResults())
      # [ { timePeriod: '2010W52', count: 1, PlanEstimate: 10 },
      #   { timePeriod: '2011W01', count: 2, PlanEstimate: 50 },
      #   { timePeriod: '2011W02', count: 2, PlanEstimate: 90 },
      #   { timePeriod: '2011W03', count: 0, PlanEstimate: 0 },
      #   { timePeriod: '2011W04', count: 0, PlanEstimate: 0 },
      #   { timePeriod: '2011W05', count: 1, PlanEstimate: 60 },
      #   { timePeriod: '2011W06*', count: 0, PlanEstimate: 0 } ]

  Remember, you can easily convert weeks to other granularities for display.

      weekStartingLabel = 'week starting ' + new Time('2010W52').inGranularity(Time.DAY).toString()
      console.log(weekStartingLabel)
      # week starting 2010-12-27

  If you want to display spinners while the chart is rendering, you can read this calculator's upToDateISOString property and
  compare it directly to the getResults() row's timePeriod property using code like this. Yes, this works eventhough
  upToDateISOString is an ISOString.

      row = {timePeriod: '2011W07'}
      if calculator.upToDateISOString < row.timePeriod
        console.log("#{row.timePeriod} not yet calculated.")
      # 2011W07 not yet calculated.
  ###

  constructor: (config) ->
    ###
    @constructor
    @param {Object} config
    @cfg {String} tz The timezone for analysis in the form like `America/New_York`
    @cfg {String} [validFromField = "_ValidFrom"]
    @cfg {String} [validToField = "_ValidTo"]
    @cfg {String} [uniqueIDField = "ObjectID"] Not used right now but when drill-down is added it will be
    @cfg {String} granularity 'month', 'week', 'quarter', etc. Use Time.MONTH, Time.WEEK, etc.
    @cfg {String[]} [fieldsToSum=[]] It will track the count automatically but it can keep a running sum of other fields also
    @cfg {Boolean} [asterixToDateTimePeriod=false] If set to true, then the still-in-progress last time period will be asterixed
    ###
    @config = utils.clone(config)
    # Assert that the configuration object is self-consistent and required parameters are present
    unless @config.validFromField?
      @config.validFromField = "_ValidFrom"
    unless @config.validToField?
      @config.validToField = "_ValidTo"
    unless @config.uniqueIDField?
      @config.uniqueIDField = "ObjectID"
    unless @config.fieldsToSum?
      @config.fieldsToSum = []
    unless @config.asterixToDateTimePeriod?
      @config.asterixToDateTimePeriod = false
    utils.assert(@config.tz?, "Must provide a timezone to this calculator.")
    utils.assert(@config.granularity?, "Must provide a granularity to this calculator.")
    if @config.granularity in [Time.HOUR, Time.MINUTE, Time.SECOND, Time.MILLISECOND]
      throw new Error("Transitions calculator is not designed to work on granularities finer than 'day'")

    dimensions = [
      {field: 'timePeriod'}
    ]

    metrics = [
      {field: 'count', f: 'sum'}  # We add a count field to each snapshot and use sum so we can also subtract
    ]
    for f in @config.fieldsToSum
      metrics.push({field: f, f: 'sum'})

    cubeConfig = {dimensions, metrics}
    @cube = new OLAPCube(cubeConfig)

    @upToDateISOString = null
    @lowestTimePeriod = null

    if @config.asOf?
      @maxTimeString = new Time(@config.asOf, Time.MILLISECOND).getISOStringInTZ(@config.tz)
    else
      @maxTimeString = Time.getISOStringFromJSDate()

    @virgin = true

  addSnapshots: (snapshots, startOn, endBefore, snapshotsToSubtract=[]) ->
    ###
    @method addSnapshots
      Allows you to incrementally add snapshots to this calculator.
    @chainable
    @param {Object[]} snapshots An array of temporal data model snapshots.
    @param {String} startOn A ISOString (e.g. '2012-01-01T12:34:56.789Z') indicating the time start of the period of
      interest. On the second through nth call, this should equal the previous endBefore.
    @param {String} endBefore A ISOString (e.g. '2012-01-01T12:34:56.789Z') indicating the moment just past the time
      period of interest.
    @return {TransitionsCalculator}
    ###
    if @upToDateISOString?
      utils.assert(@upToDateISOString == startOn, "startOn (#{startOn}) parameter should equal endBefore of previous call (#{@upToDateISOString}) to addSnapshots.")
    @upToDateISOString = endBefore

    startOnString = new Time(startOn, @config.granularity, @config.tz).toString()
    if @lowestTimePeriod?
      if startOnString < @lowestTimePeriod
        @lowestTimePeriod = startOnString
    else
      @lowestTimePeriod = startOnString

    filteredSnapshots = @_filterSnapshots(snapshots)
    @cube.addFacts(filteredSnapshots)

    filteredSnapshotsToSubstract = @_filterSnapshots(snapshotsToSubtract, -1)
    @cube.addFacts(filteredSnapshotsToSubstract)

    @virgin = false

    return this

  _filterSnapshots: (snapshots, sign = 1) ->
    filteredSnapshots = []
    for s in snapshots
      if s[@config.validFromField] <= @maxTimeString
        if s.count?
          throw new Error('Snapshots passed into a TransitionsCalculator cannot have a `count` field.')
        if s.timePeriod?
          throw new Error('Snapshots passed into a TransitionsCalculator cannot have a `timePeriod` field.')
        fs = utils.clone(s)
        fs.count = sign * 1
        fs.timePeriod = new Time(s[@config.validFromField], @config.granularity, @config.tz).toString()
        for f in @config.fieldsToSum
          fs[f] = sign * s[f]
        filteredSnapshots.push(fs)
    return filteredSnapshots

  getResults: () ->
    ###
    @method getResults
      Returns the current state of the calculator
    @return {Object[]} Returns an Array of Maps like `{timePeriod: '2012-12', count: 10, otherField: 34}`
    ###
    if @virgin
      return []

    out = []
    @highestTimePeriod = new Time(@maxTimeString, @config.granularity, @config.tz).toString()
    config =
      startOn: @lowestTimePeriod
      endBefore: @highestTimePeriod
      granularity: @config.granularity

    timeLine = new Timeline(config)
    timePeriods = (t.toString() for t in timeLine.getAllRaw())
    timePeriods.push(@highestTimePeriod)

    for tp in timePeriods
      filter = {}
      filter['timePeriod'] = tp
      cell = @cube.getCell(filter)
      outRow = {}
      outRow.timePeriod = tp
      if cell?
        outRow.count = cell.count_sum
        for f in @config.fieldsToSum
          outRow[f] = cell[f + '_sum']
      else
        outRow.count = 0
        for f in @config.fieldsToSum
          outRow[f] = 0

      out.push(outRow)

    if @config.asterixToDateTimePeriod
      out[out.length - 1].timePeriod += '*'

    return out

  getStateForSaving: (meta) ->
    ###
    @method getStateForSaving
      Enables saving the state of this calculator. See TimeInStateCalculator documentation for a detailed example.
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
      maxTimeString: @maxTimeString
      lowestTimePeriod: @lowestTimePeriod
      virgin: @virgin
    if meta?
      out.meta = meta
    return out

  @newFromSavedState: (p) ->
    ###
    @method newFromSavedState
      Deserializes a previously saved calculator and returns a new calculator. See TimeInStateCalculator for a detailed example.
    @static
    @param {String/Object} p A String or Object from a previously saved state
    @return {TransitionsCalculator}
    ###
    if utils.type(p) is 'string'
      p = JSON.parse(p)
    calculator = new TransitionsCalculator(p.config)
    calculator.cube = OLAPCube.newFromSavedState(p.cubeSavedState)
    calculator.upToDateISOString = p.upToDateISOString
    calculator.maxTimeString = p.maxTimeString
    calculator.lowestTimePeriod = p.lowestTimePeriod
    calculator.virgin = p.virgin
    if p.meta?
      calculator.meta = p.meta

    return calculator

exports.TransitionsCalculator = TransitionsCalculator
