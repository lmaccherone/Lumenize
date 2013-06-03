functions = require('./functions').functions
utils = require('tztime').utils

histogram = {}

justHereForDocsAndDoctest = () ->
  ###
  @class histogram

  This module has functionality that will allow you to create histograms and do bucketing.

  Features:

    * Three bucketing strategies:
      1. constant width (default)
      2. constant depth - for an example of using this mode, look at the source code for the `bucketPercentile()` function
      3. [v-optimal](http://en.wikipedia.org/wiki/V-optimal_histograms)
    * Two operating modes modes:
      1. Automatic. Call histogram with data and all of your parameters and out pops a histogram.
      2. Piecemeal. Create buckets, put data into buckets, generate histograms from data and pre-calculated buckets.
         Sometimes you are less interested in the histogram than you are in the bucketing.

  Let's walk through some examples of both modes. But first a general discussion about how these functions accept raw data.

  ## Getting data into the histogram functions ##

  We have two ways to define data. We can pass in an Array of Objects and specify the field to use.

      grades = [
        {name: 'Joe', average: 105},
        {name: 'Jeff', average: 104.9}, # ...

      ]

      {histogram} = require('../')
      h = histogram.histogram(grades, 'average')

      console.log(h)
      # [ { index: 0, startOn: null, endBelow: null, label: 'all', count: 2 } ]

  Or, we can just pass in a list of values

      grades = [105, 104.9, 99, 98.7, 85, 78, 54, 98, 78, 20]
      h = histogram.histogram(grades)
      console.log((row.label + ': ' + row.count for row in h))
      # [ '< 41.25: 1', '41.25-62.5: 1', '62.5-83.75: 2', '>= 83.75: 6' ]

  ## Automatic histogram creation ##

  The above examples for the two ways of getting data into the histogram functions also demonstrates the use of
  automatic histogram creation. There are additional parameters to this function that allow you to control the
  type of bucketing (constantWidth, constantDepth, etc.), min and max values, significance of the bucket boundaries, etc.
  See the individual functions for details on these parameters.

  ## Piecemeal usage ##

  Sometimes you don't actually want a histogram. You want a way to create constantWidth or constantDepth or v-optimal buckets
  and you want a tool to know which bucket a particular value falls into. The cannonical example of this is for calculating
  percentiles for standardized testing... or for grading on a curve. The documentation for the `percentileBuckets()`
  function walks you through an example like this.
  ###

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
  if firstStartOn?
    lowerBase = firstStartOn
  else
    lowerBase = roundDownToSignificance(min, significance)
    firstStartOn = null
  if lastEndBelow?
    upperBase = lastEndBelow
  else
    upperBase = roundUpToSignificance(max, significance)
    lastEndBelow = null

  return {values, bucketCount, firstStartOn, lowerBase, lastEndBelow, upperBase}

histogram.bucketsConstantWidth = (rows, valueField, significance, firstStartOn, lastEndBelow, bucketCount) ->

  {values, bucketCount, firstStartOn, lowerBase, lastEndBelow, upperBase} = setParameters(rows, valueField, firstStartOn, lastEndBelow, bucketCount, significance)

  buckets = []  # each row is {index, startOn, endBelow, label} meaning bucket  startOn <= x < endBelow

  if bucketCount < 3
    bucket = {index: 0, startOn: firstStartOn, endBelow: lastEndBelow, label: 'all'}
    buckets.push(bucket)
    return buckets

  bucketSize = roundDownToSignificance((upperBase - lowerBase) / bucketCount, significance)
  if bucketSize <= 0
    throw new Error("Calculated bucketSizes <= 0 are not allowed. Try a smaller significance.")

  lastEdge = lowerBase + bucketSize

  # first bucket
  bucket = {index: 0, startOn: firstStartOn, endBelow: lastEdge}
  buckets.push(bucket)

  # all the buckets in the middle
  for i in [1..bucketCount - 2]
    edge = lastEdge + bucketSize
    buckets.push({index: i, startOn: lastEdge, endBelow: edge})
    lastEdge = edge

  # last bucket
  if lastEdge? and lastEndBelow? and lastEdge >= lastEndBelow
    throw new Error("Somehow, the last bucket didn't work out. Try a smaller significance. lastEdge: #{lastEdge}  lastEndBelow: #{lastEndBelow}")
  bucket = {index:bucketCount - 1, startOn: lastEdge, endBelow: lastEndBelow}
  buckets.push(bucket)

  return buckets

histogram.bucketsConstantDepth = (rows, valueField, significance, firstStartOn, lastEndBelow, bucketCount) ->
  {values, bucketCount, firstStartOn, lowerBase, lastEndBelow, upperBase} = setParameters(rows, valueField, firstStartOn, lastEndBelow, bucketCount, significance)

  if bucketCount < 3
    bucket = {index: 0, startOn: firstStartOn, endBelow: lastEndBelow}
    buckets.push(bucket)
    return buckets

  bucketSize = 100 / bucketCount
  buckets = []  # each row is {index, startOn, endBelow} meaning bucket  startOn <= x < endBelow

  # first bucket
  currentBoundary = roundDownToSignificance(functions.percentileCreator(bucketSize)(values), significance)
  bucket = {index: 0, startOn: firstStartOn, endBelow: currentBoundary}
  buckets.push(bucket)

  # all the buckets in the middle
  for i in [1..bucketCount - 2]
    lastBoundary = currentBoundary
    currentBoundary = roundDownToSignificance(functions.percentileCreator(bucketSize * (i + 1))(values), significance)
    buckets.push({index: i, startOn: lastBoundary, endBelow: currentBoundary})

  # last bucket
  if lastBoundary? and lastEndBelow? and lastBoundary >= lastEndBelow
    throw new Error("Somehow, the last bucket didn't work out. Try a different bucketCount.")
  bucket = {index:bucketCount - 1, startOn: currentBoundary, endBelow: lastEndBelow}
  buckets.push(bucket)

  return buckets

histogram.bucketsPercentile = (rows, valueField) ->
  ###
  @method bucketsPercentile

  This is a short cut to creating a set of buckets for "scoring" in percentiles (think standardized testing).

  Note: You can't score in the 100th percentile because you can't beat your own score.
  If you have a higher score than anybody else, you didn't beat your own score. So, you aren't better than 100%. If there are
  less than 100 total scores then you technically can't even be in the 99th percentile. This function is hard-coded
  to only create 100 buckets. However, if you wanted to calculate fractional percentiles. Say you want to know who
  is in the 99.9th percentile, then you could simulate that yourself by calling bucketsConstantDepth with 1000 as
  the bucketCount parameter.

  Let's say you are a teacher and you only give out A's, B's, C's, and F's. Let's say you
  want the top 10% to get an A. This should only be one student, no matter what he scores. The next 30% of students
  to get a B. The next 50% of students to get a C and the last 10% to get an F (again, only 1 student). So with 10 students,
  the final distribution of grades will be this:

    * A: 1
    * B: 3
    * C: 5
    * F: 1
    * Total: 10

  Let's say you have these grades:

      grades = [
        {name: 'Joe', average: 105},    # 1 A 90th percentile and above
        {name: 'Jeff', average: 104.9}, # 1 B 60th percentile and above
        {name: 'John', average: 92},    # 2
        {name: 'Jess', average: 90},    # 3
        {name: 'Joseph', average: 87},  # 1 C 10th percentile and above
        {name: 'Julie', average: 87},   # 2
        {name: 'Juan', average: 75},    # 3
        {name: 'Jill', average: 73},    # 4
        {name: 'Jon', average: 71},     # 5
        {name: 'Jorge', average: 32}    # 1 F rest
      ]

  Now, let's create the percentile buckets for this by calling bucketsPercentile.

      {histogram} = require('../')
      buckets = histogram.bucketsPercentile(grades, 'average')

  Let's create a little helper function to convert the percentiles to grades. It includes a call to `histogram.bucket`.

      getGrade = (average, buckets) ->
        percentile = histogram.bucket(average, buckets).percentileHigherIsBetter
        if percentile >= 90
          return 'A'
        else if percentile >= 60
          return 'B'
        else if percentile >= 10
          return 'C'
        else
          return 'F'

  Now, if we loop over this and call getGrade, we can print out the final grade for each student.

      for student in grades
        console.log(student.name, getGrade(student.average, buckets))

      # Joe A
      # Jeff B
      # John B
      # Jess B
      # Joseph C
      # Julie C
      # Juan C
      # Jill C
      # Jon C
      # Jorge F

  @static
  @param {Object[]/Number[]} rows If no valueField is provided or the valueField parameter is null, then the first parameter is
  assumed to be an Array of Numbers representing the values to bucket. Otherwise, it is assumed to be an Array of Objects
  with a bunch of fields.

  @return {Object[]}

  Returns an Array of Objects (buckets) in the form of {index, startOn, endBelow, label, percentileHigherIsBetter, percentileLowerIsBetter}

  To convert a value into a percentile call `histogram.bucket(value, bucketsFromCallToBucketsPercentile)` and
  then read the percentileHigherIsBetter or percentileLowerIsBetter of the bucket that is returned.
  ###
  buckets = histogram.buckets(rows, valueField, histogram.bucketsConstantDepth, null, null, null, 100)
  percentile = 0
  for b in buckets
    if b.matchingRangeIndexEnd?
      b.percentileHigherIsBetter = b.matchingRangeIndexStart
      b.percentileLowerIsBetter = 99 - b.matchingRangeIndexEnd
      percentile = b.matchingRangeIndexEnd
      delete b.matchingRangeIndexEnd
      delete b.matchingRangeIndexStart
    else
      b.percentileHigherIsBetter = percentile
      b.percentileLowerIsBetter = 99 - percentile
    percentile++

  return buckets

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
    You could inject your own but this function simply calls that so you may as well just create the buckets yourself.
  @param {Number} [significance] The multiple to which you want to round the bucket edges. 1 means whole numbers.
   0.1 means to round to tenths. 0.01 to hundreds. Etc. If you provide all of these last four parameters, ensure
   that (lastEndBelow - firstStartOn) / bucketCount will naturally come out in the significance specified. So,
   (100 - 0) / 100 = 1. This works well with a significance of 1, 0.1, 0.01, etc. But (13 - 0) / 10  = 1.3. This
   would not work with a significance of 1. However, a signficance of 0.1 would work fine.

  @param {Number} [firstStartOn] This will be the startOn of the first bucket. Think of it as the min value.
  @param {Number} [lastEndBelow] This will be the endBelow of the last bucket. Think of it as the max value.
  @param {Number} [bucketCount] If provided, the histogram will have this many buckets.
  @return {Object[]}

  Returns an Array of Objects (buckets) in the form of {index, startOn, endBelow, label}

  The buckets array that is returned will have these properties:

  * Each bucket (row) will have these fields {index, startOn, endBelow, label}.
  * Duplicate buckets are merged. When they are merged two fields are added to the resulting merged bucket:
    {matchingRangeIndexStart, matchingRangeIndexEnd} indicating the range that this bucket replaces.
  * If firstStartOn is not provided, it will be null indicating -Infinity
  * If lastEndBelow is not provided, it will be null indicating Infinity.
  ###
  tempBuckets = type(rows, valueField, significance, firstStartOn, lastEndBelow, bucketCount)

#  return tempBuckets

  if tempBuckets.length < 2
    buckets = tempBuckets
  else  # merge duplicate buckets
    buckets = []
    startOfMatching = tempBuckets[0]
    gotToEnd = false
    i = 1
    while i < tempBuckets.length
      currentBucket = tempBuckets[i]
      if startOfMatching.startOn == currentBucket.startOn
        i++
        currentBucket = tempBuckets[i]
        while currentBucket? and startOfMatching.startOn == currentBucket.startOn and startOfMatching.endBelow == currentBucket.endBelow
          i++
          currentBucket = tempBuckets[i]
        if i >= tempBuckets.length - 1
          currentBucket = tempBuckets[tempBuckets.length - 1]
          gotToEnd = true
        startOfMatching.matchingRangeIndexStart = startOfMatching.index
        startOfMatching.matchingRangeIndexEnd = currentBucket.index
        startOfMatching.endBelow = currentBucket.endBelow
        buckets.push(startOfMatching)
        i++
        currentBucket = tempBuckets[i]
      else
        buckets.push(startOfMatching)
      startOfMatching = currentBucket
      i++
    unless gotToEnd
      buckets.push(currentBucket)

  # reindex and add labels
  for bucket, index in buckets
    bucket.index = index
#    delete bucket.index
    if bucket.startOn? and bucket.endBelow?
      bucket.label = "#{bucket.startOn}-#{bucket.endBelow}"
    else if bucket.startOn?
      bucket.label = ">= #{bucket.startOn}"
    else if bucket.endBelow?
      bucket.label = "< #{bucket.endBelow}"
    else
      bucket.label = "all"

  return buckets

histogram.bucket = (value, buckets) ->
  ###
  @method bucket
  @static
  @param {Number} value The value to bucket
  @param {Object[]} buckets Array of objects where each row is in the form {index, startOn, endBelow, label}
  @return {Object}

  Returns the bucket that contains the given value unless the data fits in none of the buckets, in which case, it returns
  `null`.

  Note: With default parameters, the buckets generated by this module will cover -Infinity to Infinity, (i.e. all
  possible values). However, if you hand generate your own buckets or you use firstStartOn or lastEndBelow parameters,
  when calling histogram.buckets, then it's possible for values to fall into no buckets.
  You can effectively use this as a way to filter out outliers or unexpected
  negative values. Also note that the firstStartOn (min) is inclusive, but the lastEndBelow (max) is exclusive. If
  you set the lastEndBelow to 100, then no values of 100 will get bucketed. You can't score in the 100th percentile
  because you can't beat your own score. This is simlar logic.
  ###
  unless value?
    return null

  # middle buckets
  if buckets.length >= 3
    for i in [1..buckets.length - 2]
      b = buckets[i]
      if b.startOn <= value < b.endBelow
        return b

  # convoluted logic so it works for buckets of length 1, 2, and 3+
  b = buckets[0]
  if b.startOn? and b.endBelow?
    if b.startOn <= value < b.endBelow
      return b
  else if b.startOn?
    if b.startOn <= value
      return b
  else if b.endBelow?
    if value < b.endBelow
      return b
  else if !b.startOn? and !b.endBelow?
    return b

  # the only situation where you get to this point is when startOn is non-null and it might be the last bucket
  b = buckets[buckets.length - 1]
  if b.endBelow?
    if b.startOn <= value < b.endBelow
      return b
  else
    if b.startOn <= value
      return b

  return null

histogram.histogramFromBuckets = (rows, valueField, buckets) ->
  ###
  @method histogramFromBuckets
  @static
  @param {Object[]/Number[]} rows If no valueField is provided or the valueField parameter is null, then the first parameter is
   assumed to be an Array of Numbers representing the values to bucket. Otherwise, it is assumed to be an Array of Objects
   with a bunch of fields.
  @param {String} valueField Specifies the field containing the values to calculate the histogram on
  @param {Object[]} buckets Array of Objects as output from a get...Buckets() function. Each row {index, startOn, endBelow, label}
  @return {Object[]}

  Returns a histogram from rows using the provided buckets. See histogram.histogram() for details on the returned Array.
  ###
  if valueField?
    values = (row[valueField] for row in rows)
  else
    values = rows

  h = utils.clone(buckets)
  histogramRow.count = 0 for histogramRow in h
  for v in values
    bucket = histogram.bucket(v, buckets)
    if bucket?
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
  @param {Number} [firstStartOn] This will be the startOn of the first bucket.
  @param {Number} [lastEndBelow] This will be the endBelow of the last bucket. Think of it as the max value.
  @param {Number} [bucketCount] If provided, the histogram will have this many buckets.
  @return {Object[]}

  Returns an Array of Objects (buckets) in the form of {index, startOn, endBelow, label, count} where count is the
  number of values in each bucket.

  Note: With default parameters, the buckets will cover -Infinity to Infinity, (i.e. all
  possible values). However, if firstStartOn or lastEndBelow are provided, then any values that you pass in that
  fall outside of this range will be ignored. You can effectively use this as a way to filter out outliers or unexpected
  negative values. Also note that the firstStartOn (min) is inclusive, but the lastEndBelow (max) is exclusive. If
  you set the lastEndBelow to 100, then no values of 100 will get counted. You can't score in the 100th percentile
  because you can't beat your own score. This is simlar logic.
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
  if valueField?
    chartValues = (row[valueField] for row in rows)
  else
    chartValues = rows
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
