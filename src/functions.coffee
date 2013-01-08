utils = require('./utils')

###
@class functions

Rules about dependencies
  * If a function can be calculated incrementally from an oldResult and newValues, then you do not need to specify dependencies
  * If a funciton can be calculated from other incrementally calculable results, then you need only specify those dependencies
  * If a function a full list of values to be calculated (like percentile coverage), then you must specify 'values'
  * To support the direct passing in of OLAP cube cells, you can provide a prefix (field name) so the key in dependentValues can be generated
  * 'count' is special and does not use a prefix because it is not dependent up a particular field
  * You should calculate the dependencies before you calculate the thing that is depedent. The OLAP cube does some checking to confirm you've done this.
###
functions = {}

functions.INCREMENTAL = ['sum', 'sumSquares', 'lastValue', 'count', 'min', 'max', 'values', 'uniqueValues']  # !TODO: remove this once dependencies is implemented

_populateDependentValues = (values, dependencies, dependentValues = {}, prefix = '') ->
  for d in dependencies
    if d is 'count'
      key = d
    else
      key = prefix + d
    unless dependentValues[key]?
      dependentValues[key] = functions[d](values, undefined, undefined, dependentValues, prefix)
  return dependentValues

###
@method sum
@static
@param {Number[]} values
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
@method sumSquares
@static
@param {Number[]} values
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
@method lastValue
@static
@param {Number[]} values
@param {Number} [oldResult] Not used. It is included to make the interface consistent.
@param {Number[]} [newValues] for incremental calculation
@return {Number} The last value
###
functions.lastValue = (values, oldResult, newValues) ->
  if newValues?
    return newValues[newValues.length - 1]
  return values[values.length - 1]

###
@method count
@static
@param {Number[]} values
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
@param {Number[]} values
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
@param {Number[]} values
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
@param {Object[]} values
@param {Number} [oldResult] for incremental calculation
@param {Number[]} [newValues] for incremental calculation
@return {Array} All values (allows duplicates). Can be used for drill down when you know they will be unique.
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
@param {Object[]} values
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
@param {Number[]} values
@return {Number} The arithmetic mean
###
functions.average = (values, oldResult, newValues, dependentValues, prefix) ->
  {count, sum} = _populateDependentValues(values, functions.average.dependencies, dependentValues, prefix)
  return sum / count

functions.average.dependencies = ['count', 'sum']

###
@method variance
@static
@param {Number[]} values
@return {Number} The variance
###
functions.variance = (values, oldResult, newValues, dependentValues, prefix) ->
  {count, sum, sumSquares} = _populateDependentValues(values, functions.variance.dependencies, dependentValues, prefix)
  return (count * sumSquares - sum * sum) / (count * (count - 1))

functions.variance.dependencies = ['count', 'sum', 'sumSquares']

###
@method standardDeviation
@static
@param {Number[]} values
@return {Number} The standard deviation
###
functions.standardDeviation = (values, oldResult, newValues, dependentValues, prefix) ->
  return Math.sqrt(functions.variance(values, oldResult, newValues, dependentValues, prefix))

functions.standardDeviation.dependencies = functions.variance.dependencies

###
@method percentileCreator
@static
@param {Number} p The percentile for the resulting function (50 = median, 75, 99, etc.)
@return {Function} A funtion to calculate the percentile

When the user passes in `p<n>` as an aggregation function, this `percentileCreator` is called to return the appropriate
percentile function. The returned function will find the `<n>`th percentile where `<n>` is some number in the form of
`##[.##]`. (e.g. `p40`, `p99`, `p99.9`).

Note: `median` is an alias for `p50`.

There is no official definition of percentile. The most popular choices differ in the interpolation algorithm that they
use. The function returned by this `percentileCreator` uses the Excel interpolation algorithm which is close to the NIST
recommendation and makes the most sense to me.
###
functions.percentileCreator = (p) ->
  f = (values) ->
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

functions.extractFandAs = (a, field) ->
  ###
  @method extractFandAs Takes specifications for functions and returns executable Functions
  @static
  @param {Object} a Will look like this `{as: 'mySum', f: 'sum'}`
  @param {String} field The name of the field this function operates on
  @return {Object} {f: <executable Function>, as: <String name for calculation>}
  ###
  if a.as?
    as = a.as
  else
    utils.assert(utils.type(a.f) != 'function', 'Must provide "as" field with your aggregation when providing a user defined function')
    if a.field?
      field = a.field
    as = "#{field}_#{a.f}"
  if utils.type(a.f) == 'function'
    f = a.f
    f.dependencies = ['values']
  else if functions[a.f]?
    f = functions[a.f]
  else if a.f == 'median'
    f = functions.percentileCreator(50)
  else if a.f.substr(0, 1) == 'p'
    p = /\p(\d+(.\d+)?)/.exec(a.f)[1]
    f = functions.percentileCreator(Number(p))
  else
    throw new Error("#{a.f} is not a recognized built-in function")
  return {f, as}

exports.functions = functions