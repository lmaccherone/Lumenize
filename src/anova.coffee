{utils} = require('tztime')
functions = require('./functions').functions
{fDist, normInverseUpper} = require('./distributions').distributions
correlate = require('./correlate').correlate

anova = (rawData, overallPredicate, field, groups, ci = 0.95) ->
  ###
  @param {Object} groups {label, predicate} This is modified as a side-effect of this function. Many properties are added.

  https://onlinecourses.science.psu.edu/stat414/node/218

  http://www.calvin.edu/~rpruim/courses/m243/F03/overheads/ANOVAf03.ppt

  ###

  utils.assert(0 < ci < 1.0, "ci must be between 0.0 and 1.0")

  if overallPredicate?
    data = (row for row in rawData when overallPredicate(row) and row[field]?)
  else
    data = rawData

  utils.assert(groups.length < data.length, 'After filtering with the overallPredicate, there were fewer rows in the dataset than there were groups')

  overallN = 0
  overallSum = 0
  overallSumSquares = 0
  pooledNumerator = 0
  for group in groups
    group.values = (row[field] for row in data when group.predicate(row))
    group.sum = functions.sum(group.values)
    group.n = group.values.length
    group.sumSquares = functions.sumSquares(group.values)
    group.variance = functions.variance(group.values)
    group.standardDeviation = Math.sqrt(group.variance)
    group.mean = group.sum / group.n
    overallN += group.n
    overallSum += group.sum
    overallSumSquares += group.sumSquares
    pooledNumerator += (group.n - 1) * group.variance
  overallMean = overallSum / overallN
  pooledStandardDeviation = Math.sqrt(pooledNumerator / (overallN - groups.length))

  multiplier = normInverseUpper((1.0 - ci) / 2)
  for group in groups
    group.ciDelta = multiplier * pooledStandardDeviation / Math.sqrt(group.n)

  residuals = []
  for group in groups
    for value in group.values
      residual = group.mean - value
      residuals.push(residual)
  residuals = residuals.sort((a, b) -> return a - b)

  residualPlot = []
  for r, index in residuals
    i = index + 1
    if i == 1
      y = 1 - Math.pow(0.5, 1 / residuals.length)
    else if i == residuals.length
      y = Math.pow(0.5, 1 / residuals.length)
    else
      y = (i - 0.3175) / (residuals.length + 0.365)
    y = (y - 0.5)
    if y is 0
      y = 0
    else
      y = Math.abs(y) * y  # I'm not sure if this squaring is needed/useful. It made the result match minitab.
    residualPlot.push({x: r, y: y})

  xValues = (r.x for r in residualPlot)
  yValues = (r.y for r in residualPlot)

  xStdDev = functions.standardDeviation(xValues)
  yStdDev = functions.standardDeviation(yValues)

  # This normalizes everything for the residual plot and histogram
  for r in residualPlot
    r.x = r.x / xStdDev
    r.y = r.y / yStdDev

  # I didn't use the Lumenize histogram function since this is normalized to -3 to +3 standard deviation
  buckets = {}
  for bucket in [-2.5..2.5]
    buckets[bucket] = 0
  for r in residualPlot
    bucket = Math.floor(r.y + 1.0) - 0.5
    buckets[bucket] += 1
  histogram = []
  for bucket in [-2.5..2.5]
    row = {label: "#{-0.5 + bucket} to #{0.5 + bucket}", center: bucket, count: buckets[bucket]}
    histogram.push(row)

  factorDF = groups.length - 1
  errorDF = overallN - groups.length
  totalDF = factorDF + errorDF

  factorSS = 0
  for group in groups
    factorSS += group.n * group.mean * group.mean
  nTimesMeanSquared = overallN * overallMean * overallMean
  factorSS -= nTimesMeanSquared

  totalSS = overallSumSquares - nTimesMeanSquared
  errorSS = totalSS - factorSS

  factorMS = factorSS / factorDF
  errorMS = errorSS / errorDF

  factorF = factorMS / errorMS

  factorP = fDist(factorDF, errorDF, factorF)

  rSquared = factorSS / totalSS
  rSquaredAdjusted = Math.abs(1 - (1 - rSquared) * (overallN - 1) / (overallN - groups.length))

  return {factorDF, factorSS, factorMS, factorF, factorP, errorDF, errorSS, errorMS, totalDF, totalSS, rSquared, rSquaredAdjusted, residualPlot, histogram, pooledStandardDeviation}


exports.anova = anova