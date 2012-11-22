utils = require('./utils')
{ChartTime} = require('./ChartTime')
{ChartTimeRange, ChartTimeIterator} = require('./ChartTimeIteratorAndRange')
{deriveFieldsAt} = require('./derive')
{snapshotArray_To_AtArray} = require('./dataTransform')
{functions} = require('./functions')

###
@method percentileCreator
@static
@param {Number} p The percentile for the resulting function (50 = median, 75, 99, etc.)
@return {Function} A funtion to calculate the percentile

When the user passes in `$p<n>` as an aggregation function, this `percentileCreator` is called to return the appropriate
percentile function. The returned function will find the `<n>`th percentile where `<n>` is some number in the form of
`##[.##]`. (e.g. `$p40`, `$p99`, `$p99.9`).

Note: `$median` is an alias for `$p50`.

There is no official definition of percentile. The most popular choices differ in the interpolation algorithm that they
use. The function returned by this `percentileCreator` uses the Excel interpolation algorithm which is close to the NIST
recommendation and makes the most sense to me.
###
percentileCreator = (p) ->
  return (values) ->
    sortfunc = (a, b) ->
      return a - b
    vLength = values.length
    values.sort(sortfunc)
    n = (p * (vLength - 1) / 100) + 1
    k = Math.floor(n)
    d = n - k
    if n == 1
      return values[1 - 1]
    if n == vLength
      return values[vLength - 1]
    return values[k - 1] + d * (values[k] - values[k - 1])

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
  else if a.f == '$median'
    f = percentileCreator(50)
  else if a.f.substr(0, 2) == '$p'
    p = /\$p(\d+(.\d+)?)/.exec(a.f)[1]
    f = percentileCreator(Number(p))
  else
    throw new Error("#{a.f} is not a recognized built-in function")
  return {f, as}
                     
aggregate = (list, aggregationSpec) ->  
  ###
  @method aggregate
  @param {Array} list An Array or arbitrary rows
  @param {Object} aggregationSpec
  @return {Object}

  Takes a list like this:
      
      {aggregate} = require('../')
  
      list = [
        { ObjectID: '1', KanbanState: 'In progress', PlanEstimate: 5, TaskRemainingTotal: 20 },
        { ObjectID: '2', KanbanState: 'Ready to pull', PlanEstimate: 3, TaskRemainingTotal: 5 },
        { ObjectID: '3', KanbanState: 'Ready to pull', PlanEstimate: 5, TaskRemainingTotal: 12 }
      ]
      
  and a list of aggregationSpec like this:

      aggregationSpec = [
        {field: 'ObjectID', f: '$count'}
        {as: 'Drill-down', field:'ObjectID', f:'$push'}
        {field: 'PlanEstimate', f: '$sum'}
        {as: 'mySum', field: 'PlanEstimate', f: (values) ->
          temp = 0
          for v in values
            temp += v
          return temp
        }
      ]
      
  and returns the aggregations like this:
    
      a = aggregate(list, aggregationSpec)
      console.log(a)
 
      #   { 'ObjectID_$count': 3, 
      #     'Drill-down': [ '1', '2', '3' ], 
      #     'PlanEstimate_$sum': 13, 
      #     mySum: 13 } 
      
  For each aggregation, you must provide a `field` and `f` (function) value. You can optionally 
  provide an alias for the aggregation with the 'as` field. There are a number of built in functions 
  documented above.
  
  Alternatively, you can provide your own function (it takes one parameter, which is an
  Array of values to aggregate) like the `mySum` example in our `aggregationSpec` list above.
  ###
    
  output = {}
  for a in aggregationSpec
    valuesArray = []
    for row in list
      valuesArray.push(row[a.field])
      
    {f, as} = _extractFandAs(a)

    output[as] = f(valuesArray)
    
  return output
  
aggregateAt = (atArray, aggregationSpec) ->  # !TODO: Change the name of all of these "At" functions. Mark suggests aggregateEach
  ###
  @method aggregateAt
  @param {Array of Arrays} atArray
  @param {Array of Objects} aggregationSpec

  Each sub-Array in atArray is passed to the `aggregate` function and the results are collected into a single array output.
  This is essentially a wrapper around the aggregate function so the spec parameter is the same. You can think of
  it as using a `map`.
  ###
  output = []
  for row, idx in atArray
    a = aggregate(row, aggregationSpec)
    output.push(a)
  return output

groupBy = (list, spec) ->
  ###
  @method groupBy
  @param {Array} list An Array of rows
  @param {Object} spec
  @return {Array}

  Takes a list like this:
      
      {groupBy} = require('../')
  
      list = [
        { ObjectID: '1', KanbanState: 'In progress', PlanEstimate: 5, TaskRemainingTotal: 20 },
        { ObjectID: '2', KanbanState: 'Ready to pull', PlanEstimate: 3, TaskRemainingTotal: 5 },
        { ObjectID: '3', KanbanState: 'Ready to pull', PlanEstimate: 5, TaskRemainingTotal: 12 }
      ]
      
  and a spec like this:

      spec = {
        groupBy: 'KanbanState',
        aggregationSpec: [
          {field: 'ObjectID', f: '$count'}
          {as: 'Drill-down', field:'ObjectID', f:'$push'}
          {field: 'PlanEstimate', f: '$sum'}
          {as: 'mySum', field: 'PlanEstimate', f: (values) ->
            temp = 0
            for v in values
              temp += v
            return temp
          }
        ]
      }
        
  Returns the aggregations like this:
    
      a = groupBy(list, spec)
      console.log(a)

      #   [ { KanbanState: 'In progress',
      #       'ObjectID_$count': 1,
      #       'Drill-down': [ '1' ], 
      #       'PlanEstimate_$sum': 5, 
      #       mySum: 5 },
      #     { KanbanState: 'Ready to pull',
      #       'ObjectID_$count': 2, 
      #       'Drill-down': [ '2', '3' ], 
      #       'PlanEstimate_$sum': 8, 
      #       mySum: 8 } ]
      
  The first element of this specification is the `groupBy` field. This is analagous to
  the `GROUP BY` column in an SQL expression.
  
  Uses the same aggregation functions as the `aggregate` function.
  ###
  # Group by spec.groupBy
  grouped = {}
  for row in list
    unless grouped[row[spec.groupBy]]?
      grouped[row[spec.groupBy]] = []
    grouped[row[spec.groupBy]].push(row)
    
  # Start to calculate output
  output = []
  for groupByValue, valuesForThisGroup of grouped
    outputRow = {}
    outputRow[spec.groupBy] = groupByValue
    for a in spec.aggregationSpec
      # Pull out the correct field from valuesForThisGroup
      valuesArray = []
      for row in valuesForThisGroup
        valuesArray.push(row[a.field])
        
      {f, as} = _extractFandAs(a)

      outputRow[as] = f(valuesArray)
    
    output.push(outputRow)
  return output
  
groupByAt = (atArray, spec) ->
  ###
  @method groupByAt
  @param {Array of Arrays} atArray
  @param {Object} spec
  @return {Array of Arrays}

  Each row in atArray is passed to the `groupBy` function and the results are collected into a single output.
  
  This function also finds all the unique groupBy values in all rows of the output and pads the output with blank/zero rows to cover
  each unique groupBy value.
  
  This is essentially a wrapper around the groupBy function so the spec parameter is the same with the addition of the `uniqueValues` field.
  The ordering specified in `spec.uniqueValues` (optional) will be honored. Any additional unique values that aggregateAt finds will be added to
  the uniqueValues list at the end. This gives you the best of both worlds. The ability to specify the order without the risk of the
  data containing more values than you originally thought when you created spec.uniqueValues.
  
  Note: `groupByAt` has the side-effect that `spec.uniqueValues` are upgraded with the missing values.
  You can use this if you want to do more calculations at the calling site.
  ###
  temp = []
  for row, idx in atArray
    tempGroupBy = groupBy(row, spec)
    tempRow = {}
    for tgb in tempGroupBy
      tempKey = tgb[spec.groupBy]
      delete tgb[spec.groupBy]
      tempRow[tempKey] = tgb    
    temp.push(tempRow)
    
  if spec.uniqueValues?
    uniqueValues = spec.uniqueValues
  else
    uniqueValues = []
  for t in temp
    for key, value of t
      unless key in uniqueValues
        uniqueValues.push(key)

  blank = {}
  for a in spec.aggregationSpec
    {f, as} = _extractFandAs(a)
    blank[as] = f([])
        
  output = []
  for t in temp
    row = []
    for u in uniqueValues
      if t[u]?   
        t[u][spec.groupBy] = u
        row.push(t[u])
      else
        newRow = utils.clone(blank)
        newRow[spec.groupBy] = u
        row.push(newRow)
    output.push(row)
  return output


timeSeriesCalculator = (snapshotArray, config) ->  
  ###
  @method timeSeriesCalculator
  @param {Array} snapshotArray
  @param {Object} config
  @return {Object} Returns an Object {listOfAtCTs, aggregationAtArray}

  Takes an MVCC style `snapshotArray` array and returns the time series calculations `At` each moment specified by
  the ChartTimeRange spec (`rangeSpec`) within the config object.
  
  This is really just a thin wrapper around various ChartTime calculations, so look at the documentation for each of
  those to get the detail picture of what this timeSeriesCalculator does. The general flow is:
  
  1. Use `ChartTimeRange.getTimeline()` against the `rangeSpec` to find the points for the x-axis.
     The output of this work is a `listOfAtCTs` array.
  2. Use `snapshotArray_To_AtArray` to figure out what state those objects were in at each point in the `listOfAtCTs` array.
     The output of this operation is called an `atArray`
  3. Use `deriveFieldsAt` to add fields in each object in the `atArray` whose values are derived from the other fields in the object.
  4. Use `aggregateAt` to calculate aggregations into an `aggregationAtArray` which contains chartable values.
  
  Note: We assume the snapshotArray is sorted by the config.snapshotValidFromField
  ###
  
  # 1. Figuring out the points for the x-axis (listOfAtCTs) 
  listOfAtCTs = new ChartTimeRange(config.rangeSpec).getTimeline()
  
  # 2. Finding the state of each object **AT** each point in the listOfAtCTs array.
  atArray = snapshotArray_To_AtArray(snapshotArray, listOfAtCTs, config.snapshotValidFromField, config.snapshotUniqueID, config.timezone, config.snapshotValidToField)
    
  # 3. Deriving fields from other fields
  deriveFieldsAt(atArray, config.derivedFields)
  
  # 4. Calculating aggregations
  aggregationAtArray = aggregateAt(atArray, config.aggregationSpec)
  
  return {listOfAtCTs, aggregationAtArray}
  

timeSeriesGroupByCalculator = (snapshotArray, config) -> 
  ###
  @method timeSeriesGroupByCalculator
  @param {Array} snapshotArray
  @param {Object} config
  @return {Object} Returns an Object {listOfAtCTs, groupByAtArray, uniqueValues}

  Takes an MVCC style `snapshotArray` array and returns the data groupedBy a particular field `At` each moment specified by
  the ChartTimeRange spec (`rangeSpec`) within the config object. 
  
  This is really just a thin wrapper around various ChartTime calculations, so look at the documentation for each of
  those to get the detail picture of what this timeSeriesGroupByCalculator does. The general flow is:
  
  1. Use `ChartTimeRange` and `ChartTimeIterator` against the `rangeSpec` to find the points for the x-axis.
     The output of this work is a `listOfAtCTs` array.
  2. Use `snapshotArray_To_AtArray` to figure out what state those objects were in at each point in the `listOfAtCTs` array.
     The output of this operation is called an `atArray`
  3. Use `groupByAt` to create a `groupByAtArray` of grouped aggregations to chart

  Note: We assume the snapshotArray is sorted by the config.snapshotValidFromField
  ###

  # 1. Figuring out the points for the x-axis (listOfAtCTs)
  listOfAtCTs = new ChartTimeRange(config.rangeSpec).getTimeline()
  
  # 2. Finding the state of each object **AT** each point in the listOfAtCTs array.
  atArray = snapshotArray_To_AtArray(snapshotArray, listOfAtCTs, config.snapshotValidFromField, config.snapshotUniqueID, config.timezone, config.snapshotValidToField)
  
  # 3. Creating chartable grouped aggregations
  aggregationSpec =
    groupBy: config.groupByField
    uniqueValues: utils.clone(config.groupByFieldValues)
    aggregationSpec: [
      {as: 'GroupBy', field: config.aggregationField, f: config.aggregationFunction}
      {as: 'Count', field:'ObjectID', f:'$count'}
      {as: 'DrillDown', field:'ObjectID', f:'$push'}
    ]
  groupByAtArray = groupByAt(atArray, aggregationSpec)  
  
  # Note: groupByAt has the side-effect that spec.uniqueValues are upgraded with the missing values.
  # Let's warn about any additional values
  # if config.groupByFieldValues? and config.groupByFieldValues.length < aggregationSpec.uniqueValues.length
    # console.error('WARNING: Data found for values that are not in config.groupByFieldValues. Data found for values:')
    # for v in aggregationSpec.uniqueValues
      # unless v in config.groupByFieldValues
        # console.error('    ' + v)
        
  return {listOfAtCTs, groupByAtArray, uniqueValues: utils.clone(aggregationSpec.uniqueValues)}

exports.percentileCreator = percentileCreator
exports.aggregate = aggregate
exports.aggregateAt = aggregateAt
exports.groupBy = groupBy
exports.groupByAt = groupByAt
exports.timeSeriesCalculator = timeSeriesCalculator 
exports.timeSeriesGroupByCalculator = timeSeriesGroupByCalculator 
