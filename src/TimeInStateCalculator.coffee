# !TODO: Add deriveFieldsOnSnapshots with @config.deriveFieldsOnSnapshotsConfig calling deriveFieldsOnFacts in OLAPCube
# !TODO: Add deriveFieldsOnResults with @config.deriveFieldsOnResultsConfig calling deriveFieldsOnResultsConfig
# !TODO: Add drill-down support with uniqueIDField or maybe keepFacts = true

OLAPCube = require('./OLAPCube').OLAPCube
{utils, Time, Timeline} = require('tztime')
JSON = require('JSON2')

class TimeInStateCalculator # implements iCalculator
  ###
  @class TimeInStateCalculator

  Used to calculate how much time each uniqueID spent "in-state". You use this by querying a temporal data
  model (like Rally's Lookback API) with a predicate indicating the "state" of interest. You'll then have a list of
  snapshots where that predicate was true. You pass this in to the addSnapshots method of this previously instantiated
  TimeInStateCalculator class.
  
  Usage:
  
      {TimeInStateCalculator} = require('../')

      snapshots = [ 
        { id: 1, from: '2011-01-06T15:10:00.000Z', to: '2011-01-06T15:30:00.000Z', Name: 'Item A' }, # 20 minutes all within an hour
        { id: 2, from: '2011-01-06T15:50:00.000Z', to: '2011-01-06T16:10:00.000Z', Name: 'Item B' }, # 20 minutes spanning an hour
        { id: 3, from: '2011-01-07T13:00:00.000Z', to: '2011-01-07T15:20:00.000Z', Name: 'Item C' }, # start 2 hours before but overlap by 20 minutes of start
        { id: 4, from: '2011-01-06T16:40:00.000Z', to: '2011-01-06T19:00:00.000Z', Name: 'Item D' }, # 20 minutes before end of day
        { id: 5, from: '2011-01-06T16:50:00.000Z', to: '2011-01-07T15:10:00.000Z', Name: 'Item E' }, # 10 minutes before end of one day and 10 before the start of next
        { id: 6, from: '2011-01-06T16:55:00.000Z', to: '2011-01-07T15:05:00.000Z', Name: 'Item F' }, # multiple cycles over several days for a total of 20 minutes of work time
        { id: 6, from: '2011-01-07T16:55:00.000Z', to: '2011-01-10T15:05:00.000Z', Name: 'Item F modified' },
        { id: 7, from: '2011-01-06T16:40:00.000Z', to: '9999-01-01T00:00:00.000Z', Name: 'Item G' }  # continues past the range of consideration in this test
      ]
      
      granularity = 'minute'
      tz = 'America/Chicago'

      config =  # default work days and holidays
        granularity: granularity
        tz: tz
        endBefore: '2011-01-11T00:00:00.000'
        workDayStartOn: {hour: 9, minute: 0}  # 09:00 in Chicago is 15:00 in GMT
        workDayEndBefore: {hour: 11, minute: 0}  # 11:00 in Chicago is 17:00 in GMT  # !TODO: Change this to 5pm when I change the samples above
        validFromField: 'from'
        validToField: 'to'
        uniqueIDField: 'id'
        trackLastValueForTheseFields: ['to', 'Name']

      startOn = '2011-01-05T00:00:00.000Z'
      endBefore = '2011-01-11T00:00:00.000Z'

      tisc = new TimeInStateCalculator(config)
      tisc.addSnapshots(snapshots, startOn, endBefore)

      console.log(tisc.getResults())
      # [ { id: 1,
      #     ticks: 20,
      #     to_lastValue: '2011-01-06T15:30:00.000Z',
      #     Name_lastValue: 'Item A' },
      #   { id: 2,
      #     ticks: 20,
      #     to_lastValue: '2011-01-06T16:10:00.000Z',
      #     Name_lastValue: 'Item B' },
      #   { id: 3,
      #     ticks: 20,
      #     to_lastValue: '2011-01-07T15:20:00.000Z',
      #     Name_lastValue: 'Item C' },
      #   { id: 4,
      #     ticks: 20,
      #     to_lastValue: '2011-01-06T19:00:00.000Z',
      #     Name_lastValue: 'Item D' },
      #   { id: 5,
      #     ticks: 20,
      #     to_lastValue: '2011-01-07T15:10:00.000Z',
      #     Name_lastValue: 'Item E' },
      #   { id: 6,
      #     ticks: 20,
      #     to_lastValue: '2011-01-10T15:05:00.000Z',
      #     Name_lastValue: 'Item F modified' },
      #   { id: 7,
      #     ticks: 260,
      #     to_lastValue: '9999-01-01T00:00:00.000Z',
      #     Name_lastValue: 'Item G' } ]

  But we are not done yet. We can serialize the state of this calculator and later restore it.

      savedState = tisc.getStateForSaving({somekey: 'some value'})

  Let's incrementally update the original.

      snapshots = [
        { id: 7, from: '2011-01-06T16:40:00.000Z', to: '9999-01-01T00:00:00.000Z', Name: 'Item G modified' },  # same snapshot as before still going
        { id: 3, from: '2011-01-11T15:00:00.000Z', to: '2011-01-11T15:20:00.000Z', Name: 'Item C modified' },  # 20 more minutes for id 3
        { id: 8, from: '2011-01-11T15:00:00.000Z', to: '9999-01-01T00:00:00.000Z', Name: 'Item H' }   # 20 minutes in scope for new id 8
      ]

      startOn = '2011-01-11T00:00:00.000Z'  # must match endBefore of prior call
      endBefore = '2011-01-11T15:20:00.000Z'

      tisc.addSnapshots(snapshots, startOn, endBefore)

  Now, let's restore from saved state into tisc2 and give it the same updates and confirm that they match.

      tisc2 = TimeInStateCalculator.newFromSavedState(savedState)
      tisc2.addSnapshots(snapshots, startOn, endBefore)

      console.log(tisc2.meta.somekey)
      # some value

      console.log(JSON.stringify(tisc.getResults()) == JSON.stringify(tisc2.getResults()))
      # true

  Note, it's common to calculate time in state at granularity of hour and convert it to fractional days. Since it knocks
  out non-work hours, this conversion is not as simple as dividing by 24. This code calculates the conversion factor
  (workHours) for whatever workDayStartOn and workDayEndBefore you have specified even if your "workday" spans midnight.

      startOnInMinutes = config.workDayStartOn.hour * 60
      if config.workDayStartOn?.minute
        startOnInMinutes += config.workDayStartOn.minute
      endBeforeInMinutes = config.workDayEndBefore.hour * 60
      if config.workDayEndBefore?.minute
        endBeforeInMinutes += config.workDayEndBefore.minute
      if startOnInMinutes < endBeforeInMinutes
        workMinutes = endBeforeInMinutes - startOnInMinutes
      else
        workMinutes = 24 * 60 - startOnInMinutes
        workMinutes += endBeforeInMinutes
      workHours = workMinutes / 60

      console.log(workHours)  # Should say 2 because our work day was from 9am to 11am
      # 2

  You would simply divide the ticks by this `workHours` value to convert from ticks (in hours) to fractional days.

  ###

  constructor: (config) ->
    ###
    @constructor
    @param {Object} config
    @cfg {String} tz The timezone for analysis
    @cfg {String} [validFromField = "_ValidFrom"]
    @cfg {String} [validToField = "_ValidTo"]
    @cfg {String} [uniqueIDField = "ObjectID"]
    @cfg {String} granularity This calculator will tell you how many ticks fall within the snapshots you feed in.
      This configuration value indicates the granularity of the ticks (i.e. Time.MINUTE, Time.HOUR, Time.DAY, etc.)
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
    @cfg {String[]} [trackLastValueForTheseFields] If provided, the last value of these fields will appear in the results.
       This is useful if you want to filter the result by where the ended or if you want information to fill in the tooltip
       for a chart.

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
    dimensions = [
      {field: @config.uniqueIDField}
    ]
    metrics = [
      {field: 'ticks', as: 'ticks', f:'sum'}
    ]
    if @config.trackLastValueForTheseFields?
      for fieldName in @config.trackLastValueForTheseFields
        metricObject = {f: 'lastValue', field: fieldName}
        metrics.push(metricObject)
    cubeConfig = {dimensions, metrics}
    @cube = new OLAPCube(cubeConfig)
    @upToDateISOString = null

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
      outRow.ticks = cell.ticks
      if @config.trackLastValueForTheseFields?
        for fieldName in @config.trackLastValueForTheseFields
          outRow[fieldName + '_lastValue'] = cell[fieldName + '_lastValue']
      out.push(outRow)
    return out

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

exports.TimeInStateCalculator = TimeInStateCalculator
