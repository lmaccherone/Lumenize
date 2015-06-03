
{utils, Time} = require('tztime')
functions = require('./functions').functions  # !TODO: Do we need this here?
{arrayOfMaps_To_CSVStyleArray, csvStyleArray_To_ArrayOfMaps} = require('./dataTransform')  # !TODO: Do we need this here?

INFINITY = '9999-01-01T00:00:00.000Z'

class Store
  ###
  @class Store

  __An efficient, in-memory, datastore for snapshot data.__

  Note, this store takes advantage of JavaScript's prototype inheritance to store snapshots in memory. Since the next snapshot might
  only have one field different from the prior one, this saves a ton of space. There is some concern that this will
  slow down certain operations because the JavaScript engine has to search all fields in the current level before bumping up
  to the next. However, there is some evidence that modern JavaScript implementations handle this very efficiently.

  However, this choice means that each row in the snapshots array doesn't have all of the fields.

  Store keeps track of all of the fields it has seen so you can flatten a row(s) if necessary.

  Example:

      {Store} = require('../')

      snapshotCSVStyleArray = [
        ['RecordID', 'DefectID', 'Created_Date', 'Severity', 'Modified_Date', 'Status'],
        [         1,          1,   '2014-06-16',          5,    '2014-06-16',    'New'],
        [       100,          1,   '2014-06-16',          5,    '2014-07-17',    'In Progress'],
        [      1000,          1,   '2014-06-16',          5,    '2014-08-18',    'Done'],
      ]

      defects = require('../').csvStyleArray_To_ArrayOfMaps(snapshotCSVStyleArray)

      config =
        uniqueIDField: 'DefectID'
        validFromField: 'Modified_Date'
        idField: 'RecordID'
        defaultValues:
          Severity: 4

      store = new Store(config, defects)

      console.log(require('../').table.toString(store.snapshots, store.fields))
      # | Modified_Date            | _ValidTo                 | _PreviousValues | DefectID | RecordID | Created_Date | Severity | Status      |
      # | ------------------------ | ------------------------ | --------------- | -------- | -------- | ------------ | -------- | ----------- |
      # | 2014-06-16T00:00:00.000Z | 2014-07-17T00:00:00.000Z | [object Object] | 1        | 1        | 2014-06-16   | 5        | New         |
      # | 2014-07-17T00:00:00.000Z | 2014-08-18T00:00:00.000Z | [object Object] | 1        | 100      | 2014-06-16   | 5        | In Progress |
      # | 2014-08-18T00:00:00.000Z | 9999-01-01T00:00:00.000Z | [object Object] | 1        | 1000     | 2014-06-16   | 5        | Done        |

  That's pretty boring. We pretty much got out what we put in. There are a few things to notice though. First,
  Notice how the _ValidTo field is automatically set. Also, notice that it added the _PreviousValues field. This is
  a record of the immediately proceeding values for the fields that changed. In this way, the records not only
  represent the current snapshot; they also represent the state transition that occured to get into this snapshot
  state. That's what stateBoundaryCrossedFilter and other methods key off of.

  Also, under the covers, the prototype of each snapshot is the prior snapshot and only the fields that changed
  are actually stored in the next snapshot. So:

      console.log(store.snapshots[1] is store.snapshots[2].__proto__)
      # true

  The Store also keeps the equivalent of a database index on uniqueIDField and keeps a pointer to the last snapshot
  for each particular uniqueIDField. This provides a convenient way to do per entity analysis.

      console.log(store.byUniqueID['1'].snapshots[0].RecordID)
      # 1

      console.log(store.byUniqueID['1'].lastSnapshot.RecordID)
      # 1000
  ###

  ###
  @property snapshots
  An Array of Objects

  The snapshots in compressed (via JavaScript inheritance) format
  ###
  ###
  @property fields
  An Array of Strings

  The list of all fields that this Store has ever seen. Use to expand each row.
  ###
  ###
  @property byUniqueID
  This is the database equivalent of an index by uniqueIDField.

  An Object in the form:

      {
        '1234': {
          snapshots: [...],
          lastSnapshot: <points to last snapshot for this uniqueID>
        },
        '7890': {
          ...
        },
        ...
      }
  ###

  constructor: (@userConfig, snapshots) ->
    ###
    @constructor

    @param {Object} config See Config options for details.
    @param {Object[]} [snapshots] Optional parameter allowing the population of the Store at instantiation.

    @cfg {String} [uniqueIDField = "ObjectID"] Specifies the field that identifies unique entities.
    @cfg {String} [validFromField = "_ValidFrom"]
    @cfg {String} [validToField = "_ValidTo"]
    @cfg {String} [idField = "_id"]
    @cfg {String} [tz = "GMT"]
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
    unless @config.tz?
      @config.tz = 'GMT'
    unless @config.defaultValues?
      @config.defaultValues = {}
    @config.defaultValues[@config.validFromField] = new Time(1, Time.MILLISECOND).toString()
    unless @config.idField?
      @config.idField = '_id'

    @snapshots = []

    @fields = [@config.validFromField, @config.validToField, '_PreviousValues', @config.uniqueIDField]
    @lastValidFrom = new Time(1, Time.MILLISECOND).toString()
    @byUniqueID = {}

    @addSnapshots(snapshots)


  addSnapshots: (snapshots) ->
    ###
    @method addSnapshots
      Adds the snapshots to the Store
    @param {Object[]} snapshots
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

      if s[@config.validFromField] < dataForUniqueID.lastSnapshot[@config.validFromField]
        throw new Error("Got a new snapshot for a time earlier than the prior last snapshot for #{@config.uniqueIDField} #{uniqueID}.")
        # Eventually, we may have to handle this case. I should be able to enable _nextSnapshot and stitch a snapshot in between two existing ones
      else if s[@config.validFromField] is dataForUniqueID.lastSnapshot[@config.validFromField]
        for key, value of s
          dataForUniqueID.lastSnapshot[key] = value
      else
        validFrom = s[@config.validFromField]
        validFrom = new Time(validFrom, null, @config.tz).getISOStringInTZ(@config.tz)
        utils.assert(validFrom >= dataForUniqueID.lastSnapshot[@config.validFromField], "validFromField (#{validFrom}) must be >= lastValidFrom (#{dataForUniqueID.lastSnapshot[@config.validFromField]}) for this entity" ) # !TODO: Deal with out of order snapshots
        utils.assert(validFrom >= @lastValidFrom, "validFromField (#{validFrom}) must be >= lastValidFrom (#{@lastValidFrom}) for the Store")

        validTo = s[@config.validTo]
        if validTo?
          validTo = new Time(validTo, null, @config.tz).getISOStringInTZ(@config.tz)
        else
          validTo = INFINITY

        priorSnapshot = dataForUniqueID.lastSnapshot

        # Build new Snapshot for adding
        newSnapshot = {}
        newSnapshot._PreviousValues = {}
        for key, value of s
          unless key in [@config.validFromField, @config.validToField, '_PreviousValues', @config.uniqueIDField]
            unless key in @fields
              @fields.push(key)
            unless value == priorSnapshot[key]
              newSnapshot[key] = value
              unless key in [@config.idField]

                if priorSnapshot[key]?
                  newSnapshot._PreviousValues[key] = priorSnapshot[key]
                else
                  newSnapshot._PreviousValues[key] = null

        newSnapshot[@config.uniqueIDField] = uniqueID
        newSnapshot[@config.validFromField] = validFrom
        newSnapshot[@config.validToField] = validTo
        if s._PreviousValues?
          newSnapshot._PreviousValues = s._PreviousValues
        newSnapshot.__proto__ = priorSnapshot

        # Update priorSnapshot
        if priorSnapshot[@config.validToField] is INFINITY
          priorSnapshot[@config.validToField] = validFrom
        # priorSnapshot._NextSnapshot = newSnapshot  # Adding link to next snapshot in case we want to do smart insertion later

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
    @return {Object[]} An array of snapshots. Note, they will not be flattened so they have references to their prototypes
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
      filter = (s) -> s._PreviousValues.hasOwnProperty(field) and s._PreviousValues[field] in left and s[field] in right
    else
      filter = (s) -> s._PreviousValues.hasOwnProperty(field) and s._PreviousValues[field] in right and s[field] in left

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