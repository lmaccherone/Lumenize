###
@class functions
###
functions = {}

###
@method sum
@static
@param {Number[]} values
@return {Number} The sum of the values
###
functions.sum = (values) ->
  temp = 0
  for v in values
    temp += v
  return temp

###
@method sumSquares
@static
@param {Number[]} values
@return {Number} The sum of the squares of the values
###
functions.sumSquares = (values) ->
  temp = 0
  for v in values
    temp += v * v
  return temp

###
@method count
@static
@param {Number[]} values
@return {Number} The length of the values Array
###
functions.count = (values) ->
  return values.length

###
@method min
@static
@param {Number[]} values
@return {Number} The minimum value or null if no values
###
functions.min = (values) ->
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
@return {Number} The maximum value or null if no values
###
functions.max = (values) ->
  if values.length == 0
    return null
  temp = values[0]
  for v in values
    if v > temp
      temp = v
  return temp

###
@method push
@static
@param {Number[]} values
@return {Array} All values (allows duplicates). Can be used for drill down when you know they will be unique.
###
functions.push = (values) ->
  temp = []
  for v in values
    temp.push(v)
  return temp

###
@method addToSet
@static
@param {Number[]} values
@return {Array} Unique values. This is good for generating an OLAP dimension or drill down.
###
functions.addToSet = (values) ->
  temp = {}
  temp2 = []
  for v in values
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
functions.average = (values) ->
  count = values.length
  sum = 0
  for v in values
    sum += v
  return sum / count

###
@method variance
@static
@param {Number[]} values
@return {Number} The variance
###
functions.variance = (values) ->
  n = values.length
  sum = 0
  sumSquares = 0
  for v in values
    sum += v
    sumSquares += v * v
  return (n * sumSquares - sum * sum) / (n * (n - 1))

###
@method standardDeviation
@static
@param {Number[]} values
@return {Number} The standard deviation
###
functions.standardDeviation = (values) ->
  return Math.sqrt(functions.variance(values))

exports.functions = functions