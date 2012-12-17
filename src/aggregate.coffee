utils = require('./utils')
{Time} = require('./Time')
{Timeline, TimelineIterator} = require('./Timeline')
{deriveFieldsAt} = require('./derive')
{snapshotArray_To_AtArray} = require('./dataTransform')
{functions} = require('./functions')

_extractFandAs = (a) ->
  if a.as?
    as = a.as
  else
    utils.assert(utils.type(a.f) != 'function', 'Must provide "as" field with your aggregation when providing a user defined function')
    as = "#{a.field}_#{a.f}"
  if utils.type(a.f) == 'function'
    f = a.f
  else if functions[a.f]?
    f = functions[a.f]
  else if a.f == 'median'
    f = functions.percentileCreator(50)
  else if a.f.substr(0, 2) == 'p'
    p = /\p(\d+(.\d+)?)/.exec(a.f)[1]
    f = functions.percentileCreator(Number(p))
  else
    throw new Error("#{a.f} is not a recognized built-in function")
  return {f, as}
                     
aggregate = (list, config) ->  
  ###
  @method aggregate
  @param {Object[]} list An Array or arbitrary rows
  @param {Object} config
  @return {Object}

  Takes a list like this:
      
      {aggregate} = require('../')
  
      list = [
        { ObjectID: '1', KanbanState: 'In progress', PlanEstimate: 5, TaskRemainingTotal: 20 },
        { ObjectID: '2', KanbanState: 'Ready to pull', PlanEstimate: 3, TaskRemainingTotal: 5 },
        { ObjectID: '3', KanbanState: 'Ready to pull', PlanEstimate: 5, TaskRemainingTotal: 12 }
      ]
      
  and a list of config like this:

      config = [
        {field: 'ObjectID', f: 'count'}
        {as: 'Drill-down', field:'ObjectID', f:'push'}
        {field: 'PlanEstimate', f: 'sum'}
        {as: 'mySum', field: 'PlanEstimate', f: (values) ->
          temp = 0
          for v in values
            temp += v
          return temp
        }
      ]
      
  and returns the aggregations like this:
    
      a = aggregate(list, config)
      console.log(a)
 
      #   { ObjectID_count: 3,
      #     'Drill-down': [ '1', '2', '3' ], 
      #     PlanEstimate_sum: 13,
      #     mySum: 13 } 
      
  For each aggregation, you must provide a `field` and `f` (function) value. You can optionally 
  provide an alias for the aggregation with the 'as` field. There are a number of built in functions.
  
  Alternatively, you can provide your own function (it takes one parameter, which is an
  Array of values to aggregate) like the `mySum` example in our `config` list above.
  ###
    
  output = {}
  for a in config
    valuesArray = []
    for row in list
      valuesArray.push(row[a.field])
      
    {f, as} = _extractFandAs(a)

    output[as] = f(valuesArray)
    
  return output
  
aggregateAt = (atArray, config) ->  # !TODO: Change the name of all of these "At" functions. Mark suggests aggregateEach
  ###
  @method aggregateAt
  @param {Array[]} atArray
  @param {Object[]} config
  @return {Object[]}

  Each sub-Array in atArray is passed to the `aggregate` function and the results are collected into a single array output.
  This is essentially a wrapper around the aggregate function so the config parameter is the same. You can think of
  it as using a `map`.
  ###
  output = []
  for row, idx in atArray
    a = aggregate(row, config)
    output.push(a)
  return output

groupBy = (list, config) ->
  ###
  @method groupBy
  @param {Object[]} list An Array of rows
  @param {Object} config
  @return {Object[]}

  Takes a list like this:
      
      {groupBy} = require('../')
  
      list = [
        { ObjectID: '1', KanbanState: 'In progress', PlanEstimate: 5, TaskRemainingTotal: 20 },
        { ObjectID: '2', KanbanState: 'Ready to pull', PlanEstimate: 3, TaskRemainingTotal: 5 },
        { ObjectID: '3', KanbanState: 'Ready to pull', PlanEstimate: 5, TaskRemainingTotal: 12 }
      ]
      
  and a config like this:

      config = {
        groupBy: 'KanbanState',
        aggregationConfig: [
          {field: 'ObjectID', f: 'count'}
          {as: 'Drill-down', field:'ObjectID', f:'push'}
          {field: 'PlanEstimate', f: 'sum'}
          {as: 'mySum', field: 'PlanEstimate', f: (values) ->
            temp = 0
            for v in values
              temp += v
            return temp
          }
        ]
      }
        
  Returns the aggregations like this:
    
      a = groupBy(list, config)
      console.log(a)

      #   [ { KanbanState: 'In progress',
      #       ObjectID_count: 1,
      #       'Drill-down': [ '1' ], 
      #       PlanEstimate_sum: 5,
      #       mySum: 5 },
      #     { KanbanState: 'Ready to pull',
      #       ObjectID_count: 2,
      #       'Drill-down': [ '2', '3' ], 
      #       PlanEstimate_sum: 8,
      #       mySum: 8 } ]
      
  The first element of this specification is the `groupBy` field. This is analagous to
  the `GROUP BY` column in an SQL expression.
  
  Uses the same aggregation functions as the `aggregate` function.
  ###
  # Group by config.groupBy
  grouped = {}
  for row in list
    unless grouped[row[config.groupBy]]?
      grouped[row[config.groupBy]] = []
    grouped[row[config.groupBy]].push(row)
    
  # Start to calculate output
  output = []
  for groupByValue, valuesForThisGroup of grouped
    outputRow = {}
    outputRow[config.groupBy] = groupByValue
    for a in config.aggregationConfig
      # Pull out the correct field from valuesForThisGroup
      valuesArray = []
      for row in valuesForThisGroup
        valuesArray.push(row[a.field])
        
      {f, as} = _extractFandAs(a)

      outputRow[as] = f(valuesArray)
    
    output.push(outputRow)
  return output
  
groupByAt = (atArray, config) ->
  ###
  @method groupByAt
  @param {Array[]} atArray
  @param {Object} config
  @return {Array[]}

  Each row in atArray is passed to the `groupBy` function and the results are collected into a single output.
  
  This function also finds all the unique groupBy values in all rows of the output and pads the output with blank/zero rows to cover
  each unique groupBy value.
  
  This is essentially a wrapper around the groupBy function so the config parameter is the same with the addition of the `uniqueValues` field.
  The ordering specified in `config.uniqueValues` (optional) will be honored. Any additional unique values that aggregateAt finds will be added to
  the uniqueValues list at the end. This gives you the best of both worlds. The ability to specify the order without the risk of the
  data containing more values than you originally thought when you created config.uniqueValues.
  
  Note: `groupByAt` has the side-effect that `config.uniqueValues` are upgraded with the missing values.
  You can use this if you want to do more calculations at the calling site.
  ###
  temp = []
  for row, idx in atArray
    tempGroupBy = groupBy(row, config)
    tempRow = {}
    for tgb in tempGroupBy
      tempKey = tgb[config.groupBy]
      delete tgb[config.groupBy]
      tempRow[tempKey] = tgb    
    temp.push(tempRow)
    
  if config.uniqueValues?
    uniqueValues = config.uniqueValues
  else
    uniqueValues = []
  for t in temp
    for key, value of t
      unless key in uniqueValues
        uniqueValues.push(key)

  blank = {}
  for a in config.aggregationConfig
    {f, as} = _extractFandAs(a)
    blank[as] = f([])
        
  output = []
  for t in temp
    row = []
    for u in uniqueValues
      if t[u]?   
        t[u][config.groupBy] = u
        row.push(t[u])
      else
        newRow = utils.clone(blank)
        newRow[config.groupBy] = u
        row.push(newRow)
    output.push(row)
  return output


timeSeriesCalculator = (snapshotArray, config) ->  
  ###
  @method timeSeriesCalculator
  @param {Object[]} snapshotArray
  @param {Object} config
  @return {Object} Returns an Object {listOfAtCTs, aggregationAtArray}

  Takes an MVCC style `snapshotArray` array and returns the time series calculations `At` each moment specified by
  the Timeline config (`timelineConfig`) within the config object.
  
  This is really just a thin wrapper around various other calculations, so look at the documentation for each of
  those to get the detail picture of what this timeSeriesCalculator does. The general flow is:
  
  1. Use `Timeline.getTimeline()` against `config.timelineConfig` to find the points for the x-axis.
     The output of this work is a `listOfAtCTs` array.
  2. Use `snapshotArray_To_AtArray` to figure out what state those objects were in at each point in the `listOfAtCTs` array.
     The output of this operation is called an `atArray`
  3. Use `deriveFieldsAt` to add fields in each object in the `atArray` whose values are derived from the other fields in the object.
  4. Use `aggregateAt` to calculate aggregations into an `aggregationAtArray` which contains chartable values.
  
  ###
  
  # 1. Figuring out the points for the x-axis (listOfAtCTs) 
  listOfAtCTs = new Timeline(config.timelineConfig).getAll()
  utils.assert(listOfAtCTs.length > 0, "Timeline has no data points.")

  # 2. Finding the state of each object **AT** each point in the listOfAtCTs array.
  atArray = snapshotArray_To_AtArray(snapshotArray, listOfAtCTs, config.snapshotValidFromField, config.snapshotUniqueID, config.timezone, config.snapshotValidToField)
    
  # 3. Deriving fields from other fields
  deriveFieldsAt(atArray, config.derivedFields)
  
  # 4. Calculating aggregations
  aggregationAtArray = aggregateAt(atArray, config.aggregationConfig)
  
  return {listOfAtCTs, aggregationAtArray}
  

timeSeriesGroupByCalculator = (snapshotArray, config) -> 
  ###
  @method timeSeriesGroupByCalculator
  @param {Object[]} snapshotArray
  @param {Object} config
  @return {Object} Returns an Object {listOfAtCTs, groupByAtArray, uniqueValues}

  Takes an MVCC style `snapshotArray` array and returns the data groupedBy a particular field `At` each moment specified by
  the Timeline config (`timelineConfig`) within the config object.
  
  This is really just a thin wrapper around various other calculations, so look at the documentation for each of
  those to get the detail picture of what this timeSeriesGroupByCalculator does. The general flow is:
  
  1. Use `Timeline` and `TimelineIterator` against `config.timelineConfig` to find the points for the x-axis.
     The output of this work is a `listOfAtCTs` array.
  2. Use `snapshotArray_To_AtArray` to figure out what state those objects were in at each point in the `listOfAtCTs` array.
     The output of this operation is called an `atArray`
  3. Use `groupByAt` to create a `groupByAtArray` of grouped aggregations to chart

  ###

  # 1. Figuring out the points for the x-axis (listOfAtCTs)
  listOfAtCTs = new Timeline(config.timelineConfig).getAll()
  utils.assert(listOfAtCTs.length > 0, "Timeline has no data points.")
  
  # 2. Finding the state of each object **AT** each point in the listOfAtCTs array.
  atArray = snapshotArray_To_AtArray(snapshotArray, listOfAtCTs, config.snapshotValidFromField, config.snapshotUniqueID, config.timezone, config.snapshotValidToField)
  
  # 3. Creating chartable grouped aggregations
  aggregationConfig =
    groupBy: config.groupByField
    uniqueValues: utils.clone(config.groupByFieldValues)
    aggregationConfig: [
      {as: 'GroupBy', field: config.aggregationField, f: config.aggregationFunction}
      {as: 'Count', field:'ObjectID', f:'count'}
      {as: 'DrillDown', field:'ObjectID', f:'push'}
    ]
  groupByAtArray = groupByAt(atArray, aggregationConfig)  
  
  # Note: groupByAt has the side-effect that config.uniqueValues are upgraded with the missing values.
  # Let's warn about any additional values
  # if config.groupByFieldValues? and config.groupByFieldValues.length < aggregationConfig.uniqueValues.length
    # console.error('WARNING: Data found for values that are not in config.groupByFieldValues. Data found for values:')
    # for v in aggregationConfig.uniqueValues
      # unless v in config.groupByFieldValues
        # console.error('    ' + v)
        
  return {listOfAtCTs, groupByAtArray, uniqueValues: utils.clone(aggregationConfig.uniqueValues)}

exports.aggregate = aggregate
exports.aggregateAt = aggregateAt
exports.groupBy = groupBy
exports.groupByAt = groupByAt
exports.timeSeriesCalculator = timeSeriesCalculator 
exports.timeSeriesGroupByCalculator = timeSeriesGroupByCalculator 
