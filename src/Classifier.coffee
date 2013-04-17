functions = require('./functions').functions
utils = require('tztime').utils
OLAPCube = require('./OLAPCube').OLAPCube

class Classifier

  constructor: (@config) ->
    @outputField = @config.outputField
    @features = @config.features

  @getBucketCountMinMax: (values) ->
    bucketCount = Math.floor(Math.sqrt(values.length)) + 1
    if bucketCount < 3
      throw new Error("Need more training data")
    min = functions.min(values)  # !TODO: Optimize this for a single loop
    max = functions.max(values)
    return {bucketCount, min, max}

  @generateConstantWidthBucketer: (values) ->
    {bucketCount, min, max} = Classifier.getBucketCountMinMax(values)
    bucketSize = (max - min) / bucketCount
    bucketer = []  # each row is {startOn, endBelow} meaning bucket  startOn <= x < endBelow
    bucketer.push({startOn: null, endBelow: min + bucketSize})
    for i in [1..bucketCount - 2]
      bucketer.push({startOn: min + bucketSize * i, endBelow: min + bucketSize * (i + 1)})
    bucketer.push({startOn: min + bucketSize * (bucketCount - 1), endBelow: null})
    return bucketer

  @generateConstantQuantityBucketer: (values) ->
    {bucketCount, min, max} = Classifier.getBucketCountMinMax(values)
    bucketSize = 100 / bucketCount
    bucketer = []  # each row is {startOn, endBelow} meaning bucket  startOn <= x < endBelow
    currentBoundary = functions.percentileCreator(bucketSize)(values)
    bucketer.push({startOn: null, endBelow: currentBoundary})
    for i in [1..bucketCount - 2]
      lastBoundary = currentBoundary
      currentBoundary = functions.percentileCreator(bucketSize * (i + 1))(values)
      bucketer.push({startOn: lastBoundary, endBelow: currentBoundary})
    bucketer.push({startOn: currentBoundary, endBelow: null})
    return bucketer

  @splitAt: (values, index) ->
    left = values.slice(0, index)
    right = values.slice(index)
    return {left, right}

  @optimalSplitFor2Buckets: (values) ->
    bestIndex = 1  # splitting at index 1 means that the split occurs just before the second element in the array. Interpolate for the numeric boundary.
    bestTotalErrorSquared = Number.MAX_VALUE
    for i in [1..values.length - 1]
      {left, right} = Classifier.splitAt(values, i)
      totalErrorSquared = functions.errorSquared(left) + functions.errorSquared(right)
      if totalErrorSquared < bestTotalErrorSquared
        bestTotalErrorSquared = totalErrorSquared
        bestIndex = i
        bestLeft = left
        bestRight = right
    splitAt = (values[bestIndex - 1] + values[bestIndex]) / 2
    return {splitAt, left: bestLeft, right: bestRight}

  @findBucketSplits: (currentSplits, values, bucketCount) ->
    if values.length < 5
      return null
    {splitAt, left, right} = Classifier.optimalSplitFor2Buckets(values)
    currentSplits.push(splitAt)
    if currentSplits.length < bucketCount
      Classifier.findBucketSplits(currentSplits, left, bucketCount)
      Classifier.findBucketSplits(currentSplits, right, bucketCount)  # Note, it's possible to have more than bucketCount this way
    return currentSplits

  @generateVOptimalBucketer: (values) ->
    {bucketCount, min, max} = Classifier.getBucketCountMinMax(values)
    values.sort((a, b) -> return a - b)
    splits = []
    Classifier.findBucketSplits(splits, values, bucketCount)
    splits.sort((a, b) -> return a - b)

    bucketer = []  # each row is {startOn, endBelow} meaning bucket  startOn <= x < endBelow
    currentBoundary = splits[0]
    bucketer.push({value: 'B' + 0, startOn: null, endBelow: currentBoundary})
    for i in [1..splits.length - 1]
      lastBoundary = currentBoundary
      currentBoundary = splits[i]
      bucketer.push({value: 'B' + i, startOn: lastBoundary, endBelow: currentBoundary})
    bucketer.push({value: 'B' + splits.length, startOn: currentBoundary, endBelow: null})

    return bucketer

  discreteizeRow: (row) ->  # This will replace the value with the index of the bin that matches that value
    for feature in @features
      if feature.type is 'continuous'
        value = row[feature.field]
        unless value?
          throw new Error("Could not find field #{feature.field} in #{JSON.stringify(row)}.")
        for bin, index in feature.bins
          if bin.startOn?
            if bin.endBelow?
              if bin.startOn <= value < bin.endBelow
                row[feature.field] = bin.value
                break
            else if bin.startOn <= value
              row[feature.field] = bin.value
              break
          else if value < bin.endBelow
            row[feature.field] = bin.value
            break

    return row


class BayesianClassifier extends Classifier

  train: (trainingSet) ->
    # find unique values for all outputField
    outputDimension = [{field: @outputField}]
    outputValuesCube = new OLAPCube({dimensions: outputDimension}, trainingSet)
    @outputValues = outputValuesCube.getDimensionValues(@outputField)

    # calculate base probabilities for each of the @outputValues
    n = trainingSet.length
    filter = {}
    @baseProbabilities = {}
    for outputValue in @outputValues
      filter[@outputField] = outputValue
      countForThisValue = outputValuesCube.getCell(filter)._count
      @baseProbabilities[outputValue] = countForThisValue / n

    # calculate probabilities for each of the feature fields
    for feature in @features
      if feature.type is 'continuous'
        # create v-optimal buckets
        values = (row[feature.field] for row in trainingSet)
        bucketer = Classifier.generateVOptimalBucketer(values)
        feature.bins = bucketer
        # convert the continuous data into discrete data using the just-created buckets
        @discreteizeRow(row) for row in trainingSet
        # Now the data looks like this:
        #  bins: [
        #    {value: 'B0', startOn: null, endBelow: 5.5, probabilities: {"0": 0.77, "1": 0.23}},  # use the index as the value
        #    {value: 'B1', startOn: 5.5, endBelow: 20.25, probabilities: {"0": 0.5, "1": 0.5}},
        #    {value: 'B2', startOn: 20.25, endBelow: null, probabilities: {"0": 0.8, "1": 0.2}}
        #  ]
      else if feature.type is 'discrete'
        # Right now, I don't think we need to do anything here. The continuous data has bins and the discrete data does not, but I think we
        # can efficiently add them when we create the OLAP cube for the feature to create the probabilities
      else
        throw new Error("Unrecognized feature type: #{feature.type}.")

    # create probabilities for every bin/outputFieldValue combination
    for feature in @features
      dimensions = [{field: @outputField, keepTotals: true}]
      dimensions.push({field: feature.field})
      featureCube = new OLAPCube({dimensions}, trainingSet)
      featureValues = featureCube.getDimensionValues(feature.field)
      if feature.type is 'discrete'
        feature.bins = ({value: value} for value in featureValues)
      for bin in feature.bins
        bin.probabilities = {}
        for outputValue in @outputValues
          filter = {}
          filter[feature.field] = bin.value
          denominatorCell = featureCube.getCell(filter)
          if denominatorCell?
            denominator = denominatorCell._count
          else
            denominator = 0
            throw new Error("No values for #{feature.field}=#{bin.value} and #{@outputField}=#{outputValue}.")
          filter[@outputField] = outputValue
          numeratorCell = featureCube.getCell(filter)
          numerator = numeratorCell?._count | 0
          bin.probabilities[outputValue] = numerator / denominator

  predict: (row, returnProbabilities = false) ->
    row = @discreteizeRow(row)
    probabilities = {}
    for outputValue, probability of @baseProbabilities
      probabilities[outputValue] = probability
    for feature in @features
      matchingBin = null
      for bin in feature.bins
        if row[feature.field] == bin.value
          matchingBin = bin
          break
      unless matchingBin?
        throw new Error("No matching bin for #{feature.field}=#{row[feature.field]} in the training set.")
      for outputValue, probability of probabilities
        probabilities[outputValue] = probability * matchingBin.probabilities[outputValue] / (probability * matchingBin.probabilities[outputValue] + (1 - probability) * (1 - matchingBin.probabilities[outputValue]))

    max = 0
    outputValueForMax = null
    for outputValue, probability of probabilities
      if probability > max
        max = probability
        outputValueForMax = outputValue

    if returnProbabilities
      return probabilities
    else
      return outputValueForMax


  getStateForSaving: (meta) ->
    ###
    @method getStateForSaving
      Enables saving the state of a Classifier.
    @param {Object} [meta] An optional parameter that will be added to the serialized output and added to the meta field
      within the deserialized Classifier
    @return {Object} Returns an Ojbect representing the state of the Classifier. This Object is suitable for saving to
      to an object store. Use the static method `newFromSavedState()` with this Object as the parameter to reconstitute the Classifier.

        example TBD
    ###
    out =
      outputField: @outputField
      outputValues: @outputValues
      baseProbabilities: @baseProbabilities
      features: @features

    if meta?
      out.meta = meta
    return out

  @newFromSavedState: (p) ->
    ###
    @method newFromSavedState
      Deserializes a previously stringified Classifier and returns a new Classifier.

      See `getStateForSaving()` documentation for a detailed example.

    @static
    @param {String/Object} p A String or Object from a previously saved Classifier state
    @return {Classifier}
    ###
    if utils.type(p) is 'string'
      p = JSON.parse(p)

    classifier = new BayesianClassifier(p.config)
    classifier.outputField = p.outputField
    classifier.outputValues = p.outputValues
    classifier.baseProbabilities = p.baseProbabilities
    classifier.features = p.features

    if p.meta?
      classifier.meta = p.meta

    return classifier


exports.Classifier = Classifier
exports.BayesianClassifier = BayesianClassifier