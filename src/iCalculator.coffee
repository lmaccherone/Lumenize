JSON = require('JSON2')

class iCalculator
  ###
  @class iCalculator

  This serves as documentation for the interface expected of all Lumenize Calculators. You can extend from it but it's
  not technically necessary. You are more likely to copy this as the starting point for a new calculator.
  ###

  constructor: (@config) ->
    ###
    @constructor
    @param {Object} config
      The config properties are up to you.
    ###
    throw new Error('iCalculator is an interface not a base class. You must override this constructor.')

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
    @return {iCalculator}
    ###
    throw new Error('iCalculator is an interface not a base class. You must override this addSnapshots method.')

    # example code follows
    if @upToDateISOString?
      utils.assert(@upToDateISOString == startOn, "startOn (#{startOn}) parameter should equal endBefore of previous call (#{@upToDateISOString}) to addSnapshots.")
    @upToDateISOString = endBefore
    # Do what you need to do
    return this

  getResults: () ->
    ###
    @method getResults
      Returns the current state of the calculator
    @return {Object} The type and format of what it returns is up to you.
    ###
    throw new Error('iCalculator is an interface not a base class. You must override this getResults method.')

  getStateForSaving: (meta) ->
    ###
    @method getStateForSaving
      Enables saving the state of this calculator. See TimeInStateCalculator for a detailed example.
    @param {Object} [meta] An optional parameter that will be added to the serialized output and added to the meta field
      within the deserialized calculator.
    @return {Object} Returns an Ojbect representing the state of the calculator. This Object is suitable for saving to
      to an object store or LocalCache. Use the static method `newFromSavedState()` with this Object as the parameter to reconstitute
      the calculator.
    ###
    throw new Error('iCalculator is an interface not a base class. You must override this getStateForSaving method.')

    # example code follows
    out = {}
    out.upToDateISOString = @upToDateISOString
    if meta?
      out.meta = meta
    # Add whatever you need to fully serialize the state of the calculator
    return out

  @newFromSavedState: (p) ->
    ###
    @method newFromSavedState
      Deserializes a previously saved calculator and returns a new calculator. See TimeInStateCalculator for a detailed example.
    @static
    @param {String/Object} p A String or Object from a previously saved calculator state
    @return {iCalculator}
    ###
    throw new Error('iCalculator is an interface not a base class. You must override this @newFromSavedState method.')

    # example code follows
    if utils.type(p) is 'string'
      p = JSON.parse(p)
    # calculator = new <your_class_here>(p.config)
    if p.meta?
      calculator.meta = p.meta
    # Other stuff to restore the calculator state
    calculator.upToDateISOString = p.upToDateISOString
    return calculator

exports.iCalculator = iCalculator
