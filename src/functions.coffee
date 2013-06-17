{utils} = require('tztime')
JSON = require('JSON2')

###
@class functions

Rules about dependencies:

  * If a function can be calculated incrementally from an oldResult and newValues, then you do not need to specify dependencies
  * If a funciton can be calculated from other incrementally calculable results, then you need only specify those dependencies
  * If a function needs the full list of values to be calculated (like percentile coverage), then you must specify 'values'
  * To support the direct passing in of OLAP cube cells, you can provide a prefix (field name) so the key in dependentValues
    can be generated
  * 'count' is special and does not use a prefix because it is not dependent up a particular field
  * You should calculate the dependencies before you calculate the thing that is depedent. The OLAP cube does some
    checking to confirm you've done this.
###
functions = {}

_populateDependentValues = (values, dependencies, dependentValues = {}, prefix = '') ->
  out = {}
  for d in dependencies
    if d == 'count'
      if prefix == ''
        key = 'count'
      else
        key = '_count'
    else
      key = prefix + d
    unless dependentValues[key]?
      dependentValues[key] = functions[d](values, undefined, undefined, dependentValues, prefix)
    out[d] = dependentValues[key]
  return out

###
@method sum
@static
@param {Number[]} [values] Must either provide values or oldResult and newValues
@param {Number} [oldResult] for incremental calculation
@param {Number[]} [newValues] for incremental calculation
@return {Number} The sum of the values
###
functions.sum = (values, oldResult, newValues) ->
  if oldResult?
    temp = oldResult
    tempValues = newValues
  else
    temp = 0
    tempValues = values
  for v in tempValues
    temp += v
  return temp

###
@method product
@static
@param {Number[]} [values] Must either provide values or oldResult and newValues
@param {Number} [oldResult] for incremental calculation
@param {Number[]} [newValues] for incremental calculation
@return {Number} The product of the values
###
functions.product = (values, oldResult, newValues) ->
  if oldResult?
    temp = oldResult
    tempValues = newValues
  else
    temp = 1
    tempValues = values
  for v in tempValues
    temp = temp * v
  return temp

###
@method sumSquares
@static
@param {Number[]} [values] Must either provide values or oldResult and newValues
@param {Number} [oldResult] for incremental calculation
@param {Number[]} [newValues] for incremental calculation
@return {Number} The sum of the squares of the values
###
functions.sumSquares = (values, oldResult, newValues) ->
  if oldResult?
    temp = oldResult
    tempValues = newValues
  else
    temp = 0
    tempValues = values
  for v in tempValues
    temp += v * v
  return temp

###
@method sumCubes
@static
@param {Number[]} [values] Must either provide values or oldResult and newValues
@param {Number} [oldResult] for incremental calculation
@param {Number[]} [newValues] for incremental calculation
@return {Number} The sum of the cubes of the values
###
functions.sumCubes = (values, oldResult, newValues) ->
  if oldResult?
    temp = oldResult
    tempValues = newValues
  else
    temp = 0
    tempValues = values
  for v in tempValues
    temp += v * v * v
  return temp


###
@method lastValue
@static
@param {Number[]} [values] Must either provide values or newValues
@param {Number} [oldResult] Not used. It is included to make the interface consistent.
@param {Number[]} [newValues] for incremental calculation
@return {Number} The last value
###
functions.lastValue = (values, oldResult, newValues) ->
  if newValues?
    return newValues[newValues.length - 1]
  return values[values.length - 1]

###
@method firstValue
@static
@param {Number[]} [values] Must either provide values or oldResult
@param {Number} [oldResult] for incremental calculation
@param {Number[]} [newValues] Not used. It is included to make the interface consistent.
@return {Number} The first value
###
functions.firstValue = (values, oldResult, newValues) ->
  if oldResult?
    return oldResult
  return values[0]

###
@method count
@static
@param {Number[]} [values] Must either provide values or oldResult and newValues
@param {Number} [oldResult] for incremental calculation
@param {Number[]} [newValues] for incremental calculation
@return {Number} The length of the values Array
###
functions.count = (values, oldResult, newValues) ->
  if oldResult?
    return oldResult + newValues.length
  return values.length

###
@method min
@static
@param {Number[]} [values] Must either provide values or oldResult and newValues
@param {Number} [oldResult] for incremental calculation
@param {Number[]} [newValues] for incremental calculation
@return {Number} The minimum value or null if no values
###
functions.min = (values, oldResult, newValues) ->
  if oldResult?
    return functions.min(newValues.concat([oldResult]))
  if values.length == 0
    return null
  temp = values[0]
  for v in values
    if v < temp
      temp = v
  return temp

###
@method max
@static
@param {Number[]} [values] Must either provide values or oldResult and newValues
@param {Number} [oldResult] for incremental calculation
@param {Number[]} [newValues] for incremental calculation
@return {Number} The maximum value or null if no values
###
functions.max = (values, oldResult, newValues) ->
  if oldResult?
    return functions.max(newValues.concat([oldResult]))
  if values.length == 0
    return null
  temp = values[0]
  for v in values
    if v > temp
      temp = v
  return temp

###
@method values
@static
@param {Object[]} [values] Must either provide values or oldResult and newValues
@param {Number} [oldResult] for incremental calculation
@param {Number[]} [newValues] for incremental calculation
@return {Array} All values (allows duplicates). Can be used for drill down.
###
functions.values = (values, oldResult, newValues) ->
  if oldResult?
    return oldResult.concat(newValues)
  return values
#  temp = []
#  for v in values
#    temp.push(v)
#  return temp

###
@method uniqueValues
@static
@param {Object[]} [values] Must either provide values or oldResult and newValues
@param {Number} [oldResult] for incremental calculation
@param {Number[]} [newValues] for incremental calculation
@return {Array} Unique values. This is good for generating an OLAP dimension or drill down.
###
functions.uniqueValues = (values, oldResult, newValues) ->
  temp = {}
  if oldResult?
    for r in oldResult
      temp[r] = null
    tempValues = newValues
  else
    tempValues = values
  temp2 = []
  for v in tempValues
    temp[v] = null
  for key, value of temp
    temp2.push(key)
  return temp2

###
@method average
@static
@param {Number[]} [values] Must either provide values or oldResult and newValues
@param {Number} [oldResult] not used by this function but included so all functions have a consistent signature
@param {Number[]} [newValues] not used by this function but included so all functions have a consistent signature
@param {Object} [dependentValues] If the function can be calculated from the results of other functions, this allows
  you to provide those pre-calculated values.
@return {Number} The arithmetic mean
###
functions.average = (values, oldResult, newValues, dependentValues, prefix) ->
  {count, sum} = _populateDependentValues(values, functions.average.dependencies, dependentValues, prefix)
  return sum / count

functions.average.dependencies = ['count', 'sum']

###
@method errorSquared
@static
@param {Number[]} [values] Must either provide values or oldResult and newValues
@param {Number} [oldResult] not used by this function but included so all functions have a consistent signature
@param {Number[]} [newValues] not used by this function but included so all functions have a consistent signature
@param {Object} [dependentValues] If the function can be calculated from the results of other functions, this allows
  you to provide those pre-calculated values.
@return {Number} The error squared
###
functions.errorSquared = (values, oldResult, newValues, dependentValues, prefix) ->
  {count, sum} = _populateDependentValues(values, functions.errorSquared.dependencies, dependentValues, prefix)
  mean = sum / count
  errorSquared = 0
  for v in values
    difference = v - mean
    errorSquared += difference * difference
  return errorSquared

functions.errorSquared.dependencies = ['count', 'sum']

###
@method variance
@static
@param {Number[]} [values] Must either provide values or oldResult and newValues
@param {Number} [oldResult] not used by this function but included so all functions have a consistent signature
@param {Number[]} [newValues] not used by this function but included so all functions have a consistent signature
@param {Object} [dependentValues] If the function can be calculated from the results of other functions, this allows
  you to provide those pre-calculated values.
@return {Number} The variance
###
functions.variance = (values, oldResult, newValues, dependentValues, prefix) ->
  {count, sum, sumSquares} = _populateDependentValues(values, functions.variance.dependencies, dependentValues, prefix)
  return (count * sumSquares - sum * sum) / (count * (count - 1))

functions.variance.dependencies = ['count', 'sum', 'sumSquares']

###
@method standardDeviation
@static
@param {Number[]} [values] Must either provide values or oldResult and newValues
@param {Number} [oldResult] not used by this function but included so all functions have a consistent signature
@param {Number[]} [newValues] not used by this function but included so all functions have a consistent signature
@param {Object} [dependentValues] If the function can be calculated from the results of other functions, this allows
  you to provide those pre-calculated values.
@return {Number} The standard deviation
###
functions.standardDeviation = (values, oldResult, newValues, dependentValues, prefix) ->
  return Math.sqrt(functions.variance(values, oldResult, newValues, dependentValues, prefix))

functions.standardDeviation.dependencies = functions.variance.dependencies

###
@method percentileCreator
@static
@param {Number} p The percentile for the resulting function (50 = median, 75, 99, etc.)
@return {Function} A function to calculate the percentile

When the user passes in `p<n>` as an aggregation function, this `percentileCreator` is called to return the appropriate
percentile function. The returned function will find the `<n>`th percentile where `<n>` is some number in the form of
`##[.##]`. (e.g. `p40`, `p99`, `p99.9`).

There is no official definition of percentile. The most popular choices differ in the interpolation algorithm that they
use. The function returned by this `percentileCreator` uses the Excel interpolation algorithm which differs from the NIST
primary method. However, NIST lists something very similar to the Excel approach as an acceptible alternative. The only
difference seems to be for the edge case for when you have only two data points in your data set. Agreement with Excel,
NIST's acceptance of it as an alternative (almost), and the fact that it makes the most sense to me is why this approach
was chosen.

http://en.wikipedia.org/wiki/Percentile#Alternative_methods

Note: `median` is an alias for `p50`. The approach chosen for calculating p50 gives you the
exact same result as the definition for median even for edge cases like sets with only one or two data points.

###
functions.percentileCreator = (p) ->
  f = (values, oldResult, newValues, dependentValues, prefix) ->
    unless values?
      {values} = _populateDependentValues(values, ['values'], dependentValues, prefix)
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
  f.dependencies = ['values']
  return f

functions.expandFandAs = (a) ->
  ###
  @method expandFandAs
  @static
  @param {Object} a Will look like this `{as: 'mySum', f: 'sum', field: 'Points'}`
  @return {Object} returns the expanded specification

  Takes specifications for functions and expands them to include the actual function and 'as'. If you do not provide
  an 'as' property, it will build it from the field name and function with an underscore between. Also, if the
  'f' provided is a string, it is copied over to the 'metric' property before the 'f' property is replaced with the
  actual function. `{field: 'a', f: 'sum'}` would expand to `{as: 'a_sum', field: 'a', metric: 'sum', f: [Function]}`.
  ###
  utils.assert(a.f?, "'f' missing from specification: \n#{JSON.stringify(a, undefined, 4)}")
  if utils.type(a.f) == 'function'
    utils.assert(a.as?, 'Must provide "as" field with your aggregation when providing a user defined function')
    a.metric = a.f.toString()
  else if functions[a.f]?
    a.metric = a.f
    a.f = functions[a.f]
  else if a.f == 'median'
    a.metric = 'median'
    a.f = functions.percentileCreator(50)
  else if a.f.substr(0, 1) == 'p'
    a.metric = a.f
    p = /\p(\d+(.\d+)?)/.exec(a.f)[1]
    a.f = functions.percentileCreator(Number(p))
  else
    throw new Error("#{a.f} is not a recognized built-in function")

  unless a.as?
    if a.metric == 'count'
      a.field = ''
      a.metric = 'count'
    a.as = "#{a.field}_#{a.metric}"
    utils.assert(a.field? or a.f == 'count', "'field' missing from specification: \n#{JSON.stringify(a, undefined, 4)}")
  return a

functions.expandMetrics = (metrics = [], addCountIfMissing = false, addValuesForCustomFunctions = false) ->
  ###
  @method expandMetrics
  @static
  @private

  This is called internally by several Lumenize Calculators. You should probably not call it.
  ###
  confirmMetricAbove = (m, fieldName, aboveThisIndex) ->
    if m is 'count'
      lookingFor = '_' + m
    else
      lookingFor = fieldName + '_' + m
    i = 0
    while i < aboveThisIndex
      currentRow = metrics[i]
      if currentRow.as == lookingFor
        return true
      i++
    # OK, it's not above, let's now see if it's below. Then throw error.
    i = aboveThisIndex + 1
    metricsLength = metrics.length
    while i < metricsLength
      currentRow = metrics[i]
      if currentRow.as == lookingFor
        throw new Error("Depdencies must appear before the metric they are dependant upon. #{m} appears after.")
      i++
    return false

  assureDependenciesAbove = (dependencies, fieldName, aboveThisIndex) ->
    for d in dependencies
      unless confirmMetricAbove(d, fieldName, aboveThisIndex)
        if d == 'count'
          newRow = {f: 'count'}
        else
          newRow = {f: d, field: fieldName}
        functions.expandFandAs(newRow)
        metrics.unshift(newRow)
        return false
    return true

  # add values for custom functions
  if addValuesForCustomFunctions
    for m, index in metrics
      if utils.type(m.f) is 'function'
        unless m.f.dependencies?
          m.f.dependencies = []
        unless m.f.dependencies[0] is 'values'
          m.f.dependencies.push('values')
        unless confirmMetricAbove('values', m.field, index)
          valuesRow = {f: 'values', field: m.field}
          functions.expandFandAs(valuesRow)
          metrics.unshift(valuesRow)

  hasCount = false
  for m in metrics
    functions.expandFandAs(m)
    if m.metric is 'count'
      hasCount = true

  if addCountIfMissing and not hasCount
    countRow = {f: 'count'}
    functions.expandFandAs(countRow)
    metrics.unshift(countRow)

  index = 0
  while index < metrics.length  # intentionally not caching length because the loop can add rows
    metricsRow = metrics[index]
    if utils.type(metricsRow.f) is 'function'
      dependencies = ['values']
    if metricsRow.f.dependencies?
      unless assureDependenciesAbove(metricsRow.f.dependencies, metricsRow.field, index)
        index = -1
    index++

  return metrics

exports.functions = functions