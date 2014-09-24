
{utils, Time} = require('tztime')
functions = require('./functions').functions  # !TODO: Do we need this here?
{arrayOfMaps_To_CSVStyleArray, csvStyleArray_To_ArrayOfMaps} = require('./dataTransform')  # !TODO: Do we need this here?
JSON = require('JSON2')

class Store
  ###
  @class Store

  __An efficient, in-memory, datastore for snapshot data.__

  Note, this store takes advantage of JavaScript's prototype inheritance to store snapshots in memory. Since the next snapshot might
  only have one field different from the prior one, this saves a ton of space. There is some concern that this will
  slow down certain operations because the interpreter has to search all fields in the current level before bumping up
  to the next. However, there is some evidence that modern javascript implementations handle this very efficiently.

  However, this choice means that each row in the snapshots array doesn't have all of the fields.

  Store keeps track of all of the fields it has seen so you can flatten a row(s) if necessary.

  ###

  constructor: (@userConfig, snapshots) ->
    ###
    @constructor
    @param {Object} config See Config options for details.
    @param {Object[]} [snapshots] Optional parameter allowing the population of the Store at instantiation.
    @cfg {String} [uniqueIDField = "ObjectID"] Specifies the field that identifies unique entities (Default: "ObjectID").
    @cfg {String} [validFromField = "_ValidFrom"]
    @cfg {String} [validToField = "_ValidTo"]
    @cfg {String} [idField = "_id"]
    @cfg {Object} [defaultValues = {}] In some datastores, null numeric fields may be assumed to be zero and null
      boolean fields may be assumed to be false. Lumenize makes no such assumption and will crash if a field value
      is missing. the defaultValues becomes the root of prototype inheritance hierarchy.

    ###
    @config = utils.clone(@userConfig)
    unless @config.uniqueIDField?
      @config.uniqueIDField = 'ObjectID'
    unless @config.validFromField?
      @config.validFromField = '_ValidFrom'
    unless @config.validToField?
      @config.validToField = '_ValidTo'
    unless @config.defaultValues?
      @config.defaultValues = {}
    @config.defaultValues[@config.validFromField] = new Time(1, Time.MILLISECOND).toString()
    unless @config.idField?
      @config.idField = '_id'


    @snapshots = []
    @lastValidFrom = new Time(1, Time.MILLISECOND).toString()

    @byUniqueID = {}
      # In the form:
      # {
      #   '1234': {
      #     snapshots: [...],
      #     lastSnapshot: <points to last snapshot for this uniqueID>
      #   },
      #   '7890': {
      #     ...
      #   },
      #   ...
      # }

    @addSnapshots(snapshots)


  addSnapshots: (snapshots) ->
    ###
    @method addSnapshots
      Adds the snapshots to the Store
    @param {Object} snapshots
    @chainable
    @return {Store} Returns this

    ###
    snapshots = utils._.sortBy(snapshots, @config.validFromField)
    for s in snapshots
      uniqueID = s[@config.uniqueIDField]
      utils.assert(uniqueID?, "Missing #{@config.uniqueIDField} field in submitted snapshot: \n" + JSON.stringify(s, null, 2))

      dataForUniqueID = @byUniqueID[uniqueID]
      unless dataForUniqueID?
        # First time we've seen this uniqueID
        dataForUniqueID =
          snapshots: []
          lastSnapshot: @config.defaultValues
        @byUniqueID[uniqueID] = dataForUniqueID

      validFrom = s[@config.validFromField]
      utils.assert(new Time(validFrom).toString() == validFrom, 'Invalid format for validFromField')  # !TODO: Soften this to allow for ending 'Z' and other types
      utils.assert(validFrom >= dataForUniqueID.lastSnapshot[@config.validFromField], 'validFromField must be >= lastValidFrom for this entity' ) # !TODO: Deal with out of order snapshots
      utils.assert(validFrom >= @lastValidFrom, 'validFromField must be >= lastValidFrom for the Store')

      validTo = s[@config.validTo]
      unless validTo?
        validTo = '9999-01-01T00:00:00.000Z'

      priorSnapshot = dataForUniqueID.lastSnapshot

      # Build new Snapshot
      newSnapshot = {}
      newSnapshot._previousValues = {}
      for key, value of s
        unless key in [@config.validFromField, @config.validToField, '_previousValues', @config.uniqueIDField]
          unless value == priorSnapshot[key]
            newSnapshot[key] = value
            unless key in [@config.idField]

              if priorSnapshot[key]?
                newSnapshot._previousValues[key] = priorSnapshot[key]
              else
                newSnapshot._previousValues[key] = null

      newSnapshot[@config.uniqueIDField] = uniqueID
      newSnapshot[@config.validFromField] = validFrom
      newSnapshot[@config.validToField] = validTo
      newSnapshot.__proto__ = priorSnapshot

      # Update priorSnapshot
      priorSnapshot[@config.validToField] = validFrom
      # priorSnapshot._nextSnapshot = newSnapshot  # Adding link to next snapshot in case we want to do smart insertion later

      # Update metadata
      dataForUniqueID.lastSnapshot = newSnapshot
      @lastValidFrom = validFrom

      # Add the newSnapshot to the arrays
      @byUniqueID[uniqueID].snapshots.push(newSnapshot)
      @snapshots.push(newSnapshot)

    return this

  filtered: (filter) ->
    ###
    @method filtered
      Returns the subset of the snapshots that match the filter
    @param {Function} filter
    @return {Object[]} An array or snapshots. Note, they will not be flattened so they have references to their prototypes
    ###
    result = []
    for s in @snapshots
      if filter(s)
        result.push(s)

    return result

  stateBoundaryCrossedFiltered: (field, values, valueToTheRightOfBoundary, forward = true, assumeNullIsLowest = true) ->
    ###
    @method stateBoundaryCrossedFiltered
      Returns the subset of the snapshots where the field transitions from the left of valueToTheRightOfBoundary to
      the right (inclusive)
    @param {String} field
    @param {String[]} values
    @param {String} valueToTheRightOfBoundary
    @param {Boolean} [forward = true] When true (the default), this will return the transitions from left to right
      However, if you set this to false, it will return the transitions right to left.
    @param {Boolean} [assumeNullIsLowest = true] Set to false if you don't want to consider transitions out of null
    @return {Object[]} An array or snapshots. Note, they will not be flattened so they have references to their prototypes
    ###
    index = values.indexOf(valueToTheRightOfBoundary)
    utils.assert(index >= 0, "stateToTheRightOfBoundary must be in stateList")
    left = values.slice(0, index)
    if assumeNullIsLowest
      left.unshift(null)
    right = values.slice(index)
    if forward
      filter = (s) -> s._previousValues.hasOwnProperty(field) and s._previousValues[field] in left and s[field] in right
    else
      filter = (s) -> s._previousValues.hasOwnProperty(field) and s._previousValues[field] in right and s[field] in left

    return @filtered(filter)

  stateBoundaryCrossedFilteredBothWays: (field, values, valueToTheRightOfBoundary, assumeNullIsLowest = true) ->
    ###
    @method stateBoundaryCrossedFilteredBothWays
      Shortcut to stateBoundaryCrossedFiltered for when you need both directions
    @param {String} field
    @param {String[]} values
    @param {String} valueToTheRightOfBoundary
    @param {Boolean} [assumeNullIsLowest = true] Set to false if you don't want to consider transitions out of null
    @return {Object} An object with two root keys: 1) forward, 2) backward. The values are the arrays that are returned
      from stateBoundaryCrossedFiltered
    ###
    forward = @stateBoundaryCrossedFiltered(field, values, valueToTheRightOfBoundary, true, assumeNullIsLowest)
    backward = @stateBoundaryCrossedFiltered(field, values, valueToTheRightOfBoundary, false, assumeNullIsLowest)
    return {forward, backward}



exports.Store = Store