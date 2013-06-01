functions = require('./functions').functions
utils = require('tztime').utils

###
@class histogram

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
histogram = {}

getBucketCountMinMax = (values) ->
  targetBucketCount = Math.floor(Math.sqrt(values.length)) + 1
  if targetBucketCount < 3
    targetBucketCount = 2
  min = functions.min(values)  # !TODO: Optimize this for a single loop
  max = functions.max(values)
  return {targetBucketCount, min, max}

roundUpToSignificance = (value, significance) ->
  unless significance?
    return value
  multiple = 1 / significance
  return Math.ceil(value * multiple) / multiple

roundDownToSignificance = (value, significance) ->
  unless significance?
    return value
  multiple = 1 / significance
  return Math.floor(value * multiple) / multiple

setParameters = (rows, valueField, firstStartOn, lastEndBelow, bucketCount, significance) ->
  if valueField?
    values = (row[valueField] for row in rows)
  else
    values = rows
  {targetBucketCount, min, max} = getBucketCountMinMax(values)
  unless bucketCount?
    bucketCount = targetBucketCount
  if bucketCount < 3
    throw new Error("bucketCount must be >= 3.")
  if firstStartOn?
    lowerBase = firstStartOn
  else
    lowerBase = roundDownToSignificance(min, significance)
    firstStartOn = -Infinity
  if lastEndBelow?
    upperBase = lastEndBelow
  else
    upperBase = roundUpToSignificance(max, significance)
    lastEndBelow = Infinity

  return {values, bucketCount, firstStartOn, lowerBase, lastEndBelow, upperBase}

histogram.bucketsConstantWidth = (rows, valueField, significance, firstStartOn, lastEndBelow, bucketCount) ->

  {values, bucketCount, firstStartOn, lowerBase, lastEndBelow, upperBase} = setParameters(rows, valueField, firstStartOn, lastEndBelow, bucketCount, significance)

  bucketSize = roundDownToSignificance((upperBase - lowerBase) / bucketCount, significance)
  if bucketSize <= 0
    throw new Error("Calculated bucketSizes <= 0 are not allowed. Try a smaller significance.")

  buckets = []  # each row is {index, startOn, endBelow, label} meaning bucket  startOn <= x < endBelow
  lastEdge = lowerBase + bucketSize

  # first bucket
  bucket = {index: 0, startOn: firstStartOn, endBelow: lastEdge}
  if firstStartOn is -Infinity
    bucket.label = "< #{bucket.endBelow}"
  else
    bucket.label = "#{bucket.startOn}-#{bucket.endBelow}"
  buckets.push(bucket)

  # all the buckets in the middle
  for i in [1..bucketCount - 2]
    edge = lastEdge + bucketSize
    buckets.push({index: i, startOn: lastEdge, endBelow: edge, label: "#{lastEdge}-#{edge}"})
    lastEdge = edge

  # last bucket
  if lastEdge >= lastEndBelow
    throw new Error("Somehow, the last bucket didn't work out. Try a smaller significance.")
  bucket = {index:bucketCount - 1, startOn: lastEdge, endBelow: lastEndBelow}
  if lastEndBelow is Infinity
    bucket.label = ">= #{bucket.startOn}"
  else
    bucket.label = "#{bucket.startOn}-#{bucket.endBelow}"
  buckets.push(bucket)

  return buckets

histogram.bucketsConstantDepth = (rows, valueField, significance, firstStartOn, lastEndBelow, bucketCount) ->
  {values, bucketCount, firstStartOn, lowerBase, lastEndBelow, upperBase} = setParameters(rows, valueField, firstStartOn, lastEndBelow, bucketCount, significance)

  bucketSize = 100 / bucketCount
  buckets = []  # each row is {index, startOn, endBelow, label} meaning bucket  startOn <= x < endBelow

  # first bucket
  currentBoundary = roundDownToSignificance(functions.percentileCreator(bucketSize)(values), significance)
  bucket = {index: 0, startOn: firstStartOn, endBelow: currentBoundary}
  if firstStartOn is -Infinity
    bucket.label = "< #{bucket.endBelow}"
  else
    bucket.label = "#{bucket.startOn}-#{bucket.endBelow}"
  buckets.push(bucket)

  # all the buckets in the middle
  for i in [1..bucketCount - 2]
    lastBoundary = currentBoundary
    currentBoundary = roundDownToSignificance(functions.percentileCreator(bucketSize * (i + 1))(values), significance)
    buckets.push({index: i, startOn: lastBoundary, endBelow: currentBoundary, label: "#{lastBoundary}-#{currentBoundary}"})

  # last bucket
  if lastBoundary >= lastEndBelow
    throw new Error("Somehow, the last bucket didn't work out. Try a different bucketCount.")
  bucket = {index:bucketCount - 1, startOn: currentBoundary, endBelow: lastEndBelow}
  if lastEndBelow is Infinity
    bucket.label = ">= #{bucket.startOn}"
  else
    bucket.label = "#{bucket.startOn}-#{bucket.endBelow}"
  buckets.push(bucket)

  return buckets

histogram.bucketsPercentile = (rows, valueField) ->
  ###
  @method bucketsPercentile

  This is a short cut to creating a set of exactly 100 buckets to be used for bucketing (or scoring) values in percentiles.
  The index of the bucket.

  Let's say you are a teacher and you only give out A's, B's, C's, and F's. You have 10 students in your class and you
  want the top 10% to get an A. This should only be one student, no matter what he scores. The next 30% of students
  to get a B. The next 50% of students to get a C and the last 10% to get an F (again, only 1 student). Let's say the
  final distribution of their grades is as follows:

     grades = [
       {name: 'Joe', average: 105}, # extra credit
       {name: 'Almost Joe', average: 104.9},  # missed it by that much
       {name: 'Jeff', average: 93},
       {name: 'John', average: 92}
     ]

  @static
  @param {Object[]/Number[]} rows If no valueField is provided or the valueField parameter is null, then the first parameter is
  assumed to be an Array of Numbers representing the values to bucket. Otherwise, it is assumed to be an Array of Objects
  with a bunch of fields.

  @return {Object[]}

  Returns an Array of Objects (buckets) in the form of {index, startOn, endBelow, label}

  To convert a value into a percentile call `histogram.bucket(value, bucketsFromCallToBucketsPercentile)`

  The buckets array that is returned will have these properties:

  * Each bucket (row) will have these fields {index, startOn, endBelow, label}.
  * There will be exactly 100 buckets.
  * The index of the first one will be 0.
  * The index of the last one will be 99.
  * The first startOn will be -Infinity
  * The last endBelow will be Infinity.
  ###
  return histogram.bucketsConstantDepth(rows, valueField, null, null, null, 100)

histogram.buckets = (rows, valueField, type = histogram.bucketsConstantWidth, significance, firstStartOn, lastEndBelow, bucketCount) ->
  ###
  @method buckets
  @static
  @param {Object[]/Number[]} rows If no valueField is provided or the valueField parameter is null, then the first parameter is
  assumed to be an Array of Numbers representing the values to bucket. Otherwise, it is assumed to be an Array of Objects
  with a bunch of fields.
  @param {String} [valueField] Specifies the field containing the values to calculate the histogram on
  @param {function} [type = histogram.constantWidth] Specifies how to pick the edges of the buckets. Three standard schemes
    are provided: histogram.bucketsConstantWidth, histogram.bucketsConstantDepth, and histogram.bucketsVOptimal.
    However, you can inject your own.
  @param {Number} [significance] The multiple to which you want to round the bucket edges. 1 means whole numbers.
   0.1 means to round to tenths. 0.01 to hundreds. Etc. If you provide all of these last four parameters, ensure
   that (lastEndBelow - firstStartOn) / bucketCount will naturally come out in the significance specified. So,
   (100 - 0) / 100 = 1. This works well with a significance of 1, 0.1, 0.01, etc. But (13 - 0) / 10  = 1.3. This
   would not work with a significance of 1. However, a signficance of 0.1 would work fine.

  @param {Number} [firstStartOn] This will be the endBefore of the first bucket. Think of it as the min value.
  @param {Number} [lastEndBelow] This will be the startOn of the last bucket. Think of it as the max value.
  @param {Number} [bucketCount] If provided, the histogram will have this many buckets.
  @return {Object[]}

  Returns an Array of Objects (buckets) in the form of {index, startOn, endBelow, label}

  The buckets array that is returned will have these properties:

  * Each bucket (row) will have these fields {index, startOn, endBelow, label}.
  * If firstStartOn is not provided, it will be -Infinity
  * If lastEndBelow is not provided, it will be Infinity.
  ###
  return type(rows, valueField, significance, firstStartOn, lastEndBelow, bucketCount)

histogram.bucket = (value, buckets) ->
  ###
  @method bucket
  @static
  @param {Number} value The value to bucket
  @param {Object[]} buckets Array of objects where each row is in the form {index, startOn, endBelow, label}
  @return {Object}

  Returns the bucket that contains the given value
  ###
  for b in buckets
    if b.startOn <= value < b.endBelow
      return b
  throw new Error("Could not find bucket for value: #{value}")

histogram.histogramFromBuckets = (rows, valueField, buckets) ->
  ###
  @method histogramFromBuckets
  @static
  @param {Object[]} rows
  @param {String} valueField Specifies the field containing the values to calculate the histogram on
  @param {Object[]} buckets Array of Objects as output from a get...Buckets() function. Each row {index, startOn, endBelow, label}
  @return {function}

  Returns a histogram from rows using the provided buckets. If a valueField is provided then it will extract the values from
  that field in the rows parameter. If not, it will assume that the rows parameter is an Array of Numbers containing
  the values to histogram. This function returns a <Histogram> which is an Array of Objects where each row is in this form
  {index, startOn, endBelow, label, count}.
  ###
  if valueField?
    values = (row[valueField] for row in rows)
  else
    values = rows

  h = utils.clone(buckets)
  histogramRow.count = 0 for histogramRow in h
  for v in values
    bucket = histogram.bucket(v, buckets)
    h[bucket.index].count++
  return h

histogram.histogram = (rows, valueField, type = histogram.constantWidth, significance, firstStartOn, lastEndBelow, bucketCount) ->
  ###
  @method histogram
  @static
  @param {Object[]/Number[]} rows If no valueField is provided or the valueField parameter is null, then the first parameter is
  assumed to be an Array of Numbers representing the values to bucket. Otherwise, it is assumed to be an Array of Objects
  with a bunch of fields.
  @param {String} [valueField] Specifies the field containing the values to calculate the histogram on
  @param {function} [type = histogram.constantWidth] Specifies how to pick the edges of the buckets. Three standard schemes
    are provided: histogram.bucketsConstantWidth, histogram.bucketsConstantDepth, and histogram.bucketsVOptimal.
    However, you can inject your own.
  @param {Number} [significance] The multiple to which you want to round the bucket edges. 1 means whole numbers.
   0.1 means to round to tenths. 0.01 to hundreds. Etc. If you provide all of these last four parameters, ensure
   that (lastEndBelow - firstStartOn) / bucketCount will naturally come out in the significance specified. So,
   (100 - 0) / 100 = 1. This works well with a significance of 1, 0.1, 0.01, etc. But (13 - 0) / 10  = 1.3. This
   would not work with a significance of 1. However, a signficance of 0.1 would work fine.
  @param {Number} [firstStartOn] This will be the endBefore of the first bucket. Think of it as the min value.
  @param {Number} [lastEndBelow] This will be the startOn of the last bucket. Think of it as the max value.
  @param {Number} [bucketCount] If provided, the histogram will have this many buckets.
  @return {Object[]}

  Returns an Array of Objects (buckets) in the form of {index, startOn, endBelow, label, count} where count is the
  number of values in each bucket.
  ###
  buckets = histogram.buckets(rows, valueField, type, significance, firstStartOn, lastEndBelow, bucketCount)
  return histogram.histogramFromBuckets(rows, valueField, buckets)


histogram.clipping = (rows, valueField, noClipping = false) ->
  ###
  @method clipping
  @static

  Note: The calling pattern and functionality of this method is legacy and a bit different from the other members of
  this histogram module. I just haven't yet had the opportunity to upgrade it to the new pattern.

  This histogram function is designed to work with data that is zero bound on the low end and might have outliers
  on the high end. It's not very general purpose but it's ideal for distributions that have a long-fat-tail.

  @param {Object[]} rows
  @param {String} valueField Specifies the field containing the values to calculate the histogram on
  @param {Boolean} [noClipping = false] If set to true, then it will not create a non-linear band for the outliers. The
   default behavior (noClipping = false) is to lump together outliers into a single bucket at the top.
  @return {Object[]}

  Returns an object containing the following:

  * buckets - An Array containing {label, count, rows, clippedChartValue}
  * bucketSize - The size of each bucket (except the top one)
  * chartMax - The maximum to use for charting using clipped values
  * clipped - A Boolean indicating if the result is clipped
  * valueMax - The actual maximum value found. Will always be >= chartMax

  Given an array of rows like:

      {histogram} = require('../')

      rows = [
        {age:  7},
        {age: 25},
        {age: 23},
        {age: 27},
        {age: 34},
        {age: 55},
        {age: 42},
        {age: 13},
        {age: 11},
        {age: 23},
        {age: 31},
        {age: 32},
        {age: 29},
        {age: 16},
        {age: 31},
        {age: 22},
        {age: 25},
      ]

  histogram will calculate a histogram. There will be sqrt(n) + 1 buckets

      {buckets, chartMax} = histogram.clipping(rows, 'age')
      for b in buckets
        console.log(b.label, b.count)
      # 0-12 2
      # 12-24 5
      # 24-36 8
      # 36-48 1
      # 48-60 1

      console.log(chartMax)
      # 60

  This histogram calculator will also attempt to lump outliers into a single bucket at the top.

      rows.push({age: 85})

      {buckets, chartMax} = histogram.clipping(rows, 'age')

      lastBucket = buckets[buckets.length - 1]
      console.log(lastBucket.label, lastBucket.count)
      # 48-86* 2

  The asterix `*` is there to indicate that this bucket is not the same size as the others and non-linear.
  The histogram calculator will also "clip" the values for these outliers so that you can
  display them in a scatter chart on a linear scale with the last band compressed.
  The `clippedChartValue` will be guaranteed to be below the `chartMax` by interpolating it's position between
  the bounds of the top band where the actual max value is scaled down to the `chartMax`

      lastBucket = buckets[buckets.length - 1]
      console.log(lastBucket.rows[1].age, lastBucket.rows[1].clippedChartValue)
      # 85 59.68421052631579
            
  ###
  chartValues = (row[valueField] for row in rows)
  max = functions.max(chartValues)
  max = Math.max(max, 1)

  if noClipping
    upperBound = max
    chartValuesMinusOutliers = chartValues
  else
    q3 = functions.percentileCreator(75)(chartValues)
    q1 = functions.percentileCreator(25)(chartValues)
    iqr = q3 - q1
    upperBound = q3 + 1.5 * iqr  # This is the Tukey recommendation http://exploringdata.net/why_1_5.htm
    if isNaN(upperBound) or upperBound > max
      upperBound = max
    chartValuesMinusOutliers = (c for c in chartValues when c <= upperBound)
  
  bucketCount = Math.floor(Math.sqrt(chartValuesMinusOutliers.length))
  
  if bucketCount < 3
    bucketCount = 2

  bucketSize = Math.floor(upperBound / bucketCount) + 1
  
  upperBound = bucketSize * bucketCount
  
  chartMin = 0
  chartMax = upperBound + bucketSize  # This will be at the very top of the top bucket
  
  valueMax = Math.floor(functions.max(chartValues)) + 1
  valueMax = Math.max(chartMax, valueMax)
  
  # add clippedChartValues to timeInState
  # the clippedChartValue is interpolated between upperBound and valueMax to fit within one bucketSize
  for row in rows
    if row[valueField] >= upperBound
      row.clippedChartValue = upperBound + bucketSize * (row[valueField] - upperBound) / (valueMax - upperBound)
    else
      row.clippedChartValue = row[valueField]
    
  buckets = []
  for i in [0..bucketCount]
    bucket = {
      label: "#{Math.floor(i * bucketSize)}-#{Math.floor((i + 1) * bucketSize)}", 
      rows: []
      count: 0
    }
    buckets.push(bucket)
  
  clipped = not (valueMax == chartMax)
  if clipped
    buckets[bucketCount].label = "#{upperBound}-#{valueMax}*"
  else
    buckets[bucketCount].label = "#{upperBound}-#{valueMax}"
  
  total = 0
  for row in rows
    if row[valueField] >= upperBound
      bucket = buckets[buckets.length - 1]
    else
      bucket = buckets[Math.floor(row[valueField] / bucketSize)]
    bucket.rows.push(row)
    bucket.count++
    total++
  
  percentile = 0
  for b in buckets
    percentile += b.count / total
    if isNaN(percentile)
      b.percentile = 0
    else
      b.percentile = percentile
  buckets[buckets.length - 1].percentile = 1.0
    
  return {buckets, bucketSize, chartMax, clipped, valueMax}
    
exports.histogram = histogram
