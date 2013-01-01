utils = require('./utils')
OLAPCube = require('./OLAPCube').OLAPCube
Timeline = require('./Timeline').Timeline
Time = require('./Time').Time

class TimeInStateCalculator
  ###
  @class TimeInStateCalculator

  Used to calculate how much time each uniqueID spent "in-state". You use this by querying a temporal data
  model (like Rally's Lookback API) with a predicate indicating the "state" of interest. You'll then have a list of
  snapshots where that predicate was true. You pass this in to the addSnapshots method of this previously instantiated
  TimeInStateCalculator class.
  
  Usage:
  
      {TimeInStateCalculator} = require('../')

      snapshots = [ 
        { id: 1, from: '2011-01-06T15:10:00.000Z', to: '2011-01-06T15:30:00.000Z' }, # 20 minutes all within an hour
        { id: 2, from: '2011-01-06T15:50:00.000Z', to: '2011-01-06T16:10:00.000Z' }, # 20 minutes spanning an hour
        { id: 3, from: '2011-01-07T13:00:00.000Z', to: '2011-01-07T15:20:00.000Z' }, # start 2 hours before but overlap by 20 minutes of start
        { id: 4, from: '2011-01-06T16:40:00.000Z', to: '2011-01-06T19:00:00.000Z' }, # 20 minutes before end of day
        { id: 5, from: '2011-01-06T16:50:00.000Z', to: '2011-01-07T15:10:00.000Z' }, # 10 minutes before end of one day and 10 before the start of next
        { id: 6, from: '2011-01-06T16:55:00.000Z', to: '2011-01-07T15:05:00.000Z' }, # multiple cycles over several days for a total of 20 minutes of work time
        { id: 6, from: '2011-01-07T16:55:00.000Z', to: '2011-01-10T15:05:00.000Z' }, 
        { id: 7, from: '2011-01-06T16:40:00.000Z', to: '9999-01-01T00:00:00.000Z' }  # extends beyond scope of initial analysis
      ]
      
      granularity = 'minute'
      tz = 'America/Chicago'

      config =  # default work days and holidays
        granularity: granularity
        tz: tz
        endBefore: '2011-01-11T00:00:00.000'
        workDayStartOn: {hour: 9, minute: 0}  # 15:00 GMT in Chicago
        workDayEndBefore: {hour: 11, minute: 0}  # 17:00 GMT in Chicago.
        validFromField: 'from'
        validToField: 'to'
        uniqueIDField: 'id'

      startOn = '2011-01-05T00:00:00.000Z'
      endBefore = '2011-01-11T00:00:00.000Z'

      tisc = new TimeInStateCalculator(config)
      tisc.addSnapshots(snapshots, startOn, endBefore)

      console.log(tisc.getResults())
      # [ { id: 1, ticks: 20, lastValidTo: '2011-01-06T15:30:00.000Z' },
      #   { id: 2, ticks: 20, lastValidTo: '2011-01-06T16:10:00.000Z' },
      #   { id: 3, ticks: 20, lastValidTo: '2011-01-07T15:20:00.000Z' },
      #   { id: 4, ticks: 20, lastValidTo: '2011-01-06T19:00:00.000Z' },
      #   { id: 5, ticks: 20, lastValidTo: '2011-01-07T15:10:00.000Z' },
      #   { id: 6, ticks: 20, lastValidTo: '2011-01-10T15:05:00.000Z' },
      #   { id: 7, ticks: 260, lastValidTo: '9999-01-01T00:00:00.000Z' } ]

  But we are not done yet. We can serialize the state of this calculator and later restore it.

      savedState = tisc.getStateForSaving({somekey: 'some value'})

  Let's incrementally update the original.

      snapshots = [
        { id: 7, from: '2011-01-06T16:40:00.000Z', to: '9999-01-01T00:00:00.000Z' },  # same snapshot as before still going
        { id: 3, from: '2011-01-11T15:00:00.000Z', to: '2011-01-11T15:20:00.000Z' },  # 20 more minutes for id 3
        { id: 8, from: '2011-01-11T15:00:00.000Z', to: '9999-01-01T00:00:00.000Z' }   # 20 minutes in scope for new id 8
      ]

      startOn = '2011-01-11T00:00:00.000Z'  # must match endBefore of prior call
      endBefore = '2011-01-11T15:20:00.000Z'

      tisc.addSnapshots(snapshots, startOn, endBefore)

  Now, let's restore from saved state into tisc2.

      tisc2 = TimeInStateCalculator.newFromSavedState(savedState)
      tisc2.addSnapshots(snapshots, startOn, endBefore)

      console.log(tisc2.meta.somekey)
      # some value

      console.log(JSON.stringify(tisc.getResults()) == JSON.stringify(tisc2.getResults()))
      # true

  ###

  constructor: (@config) ->
    ###
    @constructor
    @param {Object} config
    @cfg {String} tz The timezone for analysis
    @cfg {String} validFromField
    @cfg {String} validToField
    @cfg {String} uniqueIDField
    @cfg {String} granularity This calculator will tell you how many ticks fall within the snapshots you feed in.
       This configuration value indicates the granularity of the ticks (i.e. Time.MINUTE, Time.HOUR, Time.DAY, etc.)
    @cfg {String[]/String} [workDays] List of days of the week that you work on. You can specify this as an Array of Strings
       (['Monday', 'Tuesday', ...]) or a single comma seperated String ("Monday,Tuesday,...").
       Defaults to ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].
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
    ###
    # Assert that the configuration object is self-consistent and required parameters are present
    dimensions = [
      {field: @config.uniqueIDField}
    ]
    metrics = [
      {field: 'ticks', metrics:[{as: 'ticks', f:'sum'}]},
      {field: @config.validToField, metrics:[{as: 'lastValidTo', f: 'lastValue'}]}
    ]
    cubeConfig = {dimensions, metrics}
    @cube = new OLAPCube(cubeConfig)
    @upToDate = null

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
    if @upToDate?
      utils.assert(@upToDate == startOn, "startOn (#{startOn}) parameter should equal endBefore of previous call (#{@upToDate}) to addSnapshots.")
    @upToDate = endBefore
    timelineConfig = utils.clone(@config)
    timelineConfig.startOn = new Time(startOn, Time.MILLISECOND, @config.tz)
    timelineConfig.endBefore = new Time(endBefore, Time.MILLISECOND, @config.tz)
    timeline = new Timeline(timelineConfig)
    for s in snapshots
      ticks = timeline.ticksThatIntersect(s[@config.validFromField], s[@config.validToField], @config.tz)
      s.ticks = ticks.length
    @cube.addFacts(snapshots)
    return this

  getResults: () ->
    ###
    @method getResults
      Returns the current state of the calculator
    @return {Object[]} Returns an Array of Maps like `{<uniqueIDField>: <id>, ticks: <ticks>, lastValidTo: <lastValidTo>}`
    ###
    out = []
    uniqueIDs = @cube.getDimensionValues(@config.uniqueIDField)
    for id in uniqueIDs
      filter = {}
      filter[@config.uniqueIDField] = id
      cell = @cube.getCell(filter)
      outRow = {}
      outRow[@config.uniqueIDField] = id
      outRow.ticks = cell.__metrics.ticks
      outRow.lastValidTo = cell.__metrics.lastValidTo
      out.push(outRow)
    return out

  getStateForSaving: (meta) ->
    ###
    @method getState
      Enables saving the state of this calculator.
    @param {Object} [meta] An optional parameter that will be added to the serialized output and added to the meta field
      within the deserialized calculator.
    @return {Object} Returns an Ojbect representing the state of the calculator. This Object is suitable for saving to
      to an object store. Use the static method `newFromSavedState()` with this Object as the parameter to reconstitute
      the calculator.
    ###
    out =
      config: @config
      cubeSavedState: @cube.getStateForSaving()
      upToDate: @upToDate
    if meta?
      out.meta = meta
    return out

  @newFromSavedState: (p) ->
    ###
    @method newFromSavedState
      Deserializes a previously saved calculator and returns a new calculator.

      See `getStateForSaving()` documentation for a detailed example.
    @static
    @param {String/Object} p A String or Object from a previously saved OLAPCube state
    @return {TimeInStateCalculator}
    ###
    if utils.type(p) is 'string'
      p = JSON.parse(p)
    calculator = new TimeInStateCalculator(p.config)
    calculator.cube = OLAPCube.newFromSavedState(p.cubeSavedState)
    calculator.upToDate = p.upToDate
    if p.meta?
      calculator.meta = p.meta

    return calculator

exports.TimeInStateCalculator = TimeInStateCalculator
