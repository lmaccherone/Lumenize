{BayesianClassifier, Classifier} = require('../')

approximatelyEqual = (a, b, error = 0.001) ->
  return Math.abs(a - b) < error

config =
  outputField: "RealTeam"
  features: [
    {field: 'TeamSize', type: 'continuous'},
    {field: 'HasChildProject', type: 'discrete'}
  ]

exports.Test =

  testBucketers: (test) ->
    values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 100]

    classifier = new BayesianClassifier(config)

    buckets = Classifier.generateConstantQuantityBucketer(values)
    expected = [
      { value: 'B0', startOn: null, endBelow: 3.25 },
      { value: 'B1', startOn: 3.25, endBelow: 6.5 },
      { value: 'B2', startOn: 6.5, endBelow: 9.75 },
      { value: 'B3', startOn: 9.75, endBelow: null }
    ]
    test.deepEqual(buckets, expected)

    buckets = Classifier.generateConstantWidthBucketer(values)
    expected = [
      { value: 'B0', startOn: null, endBelow: 25 },
      { value: 'B1', startOn: 25, endBelow: 50 },
      { value: 'B2', startOn: 50, endBelow: 75 },
      { value: 'B3', startOn: 75, endBelow: null }
    ]
    test.deepEqual(buckets, expected)

    test.done()

  testSplitAt: (test) ->
    results = Classifier.splitAt([1, 2, 3], 1)
    expected = { left: [ 1 ], right: [ 2, 3 ] }
    test.deepEqual(results, expected)

    test.done()

  testOptimalSplit: (test) ->
    values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 100]
    {splitAt, left, right} = Classifier.optimalSplitFor2Buckets(values)
    test.equal(splitAt, 56)  # Between 12 and 100

    values = [10, 20, 40, 50]
    {splitAt, left, right} = Classifier.optimalSplitFor2Buckets(values)
    test.equal(splitAt, 30)  # Between 20 and 40

    test.done()

  testVOptimalBucketer: (test) ->
    values = [10, 12, 7, 5, 4, 76, 3, 5, 8, 23, 45, 12, 13, 14, 22, 23, 27]

    buckets = Classifier.generateVOptimalBucketer(values)
    expected = [
      { value: 'B0', startOn: null, endBelow: 9 },
      { value: 'B1', startOn: 9, endBelow: 18 },
      { value: 'B2', startOn: 18, endBelow: 36 },
      { value: 'B3', startOn: 36, endBelow: 60.5 },
      { value: 'B4', startOn: 60.5, endBelow: null }
    ]

    test.deepEqual(buckets, expected)

    test.done()

  testVOptimalBucketerWithMoreThan5SameValues: (test) ->
    values = [ 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 3, 4, 5, 6 ]

    buckets = Classifier.generateVOptimalBucketer(values)
    expected = [
      { value: 'B0', startOn: null, endBelow: 0.5 },
      { value: 'B1', startOn: 0.5, endBelow: 2 },
      { value: 'B2', startOn: 2, endBelow: 3.5 },
      { value: 'B3', startOn: 3.5, endBelow: 4.5 },
      { value: 'B4', startOn: 4.5, endBelow: null }
    ]

    test.deepEqual(buckets, expected)

    test.done()

  testDescreteizeRow: (test) ->
    classifier = new Classifier(config)
    classifier.features = [
      {
      field: "TeamSize",
      type: "continuous",
      bins: [
        {value: 'B0', startOn: null, endBelow: 5.5, probabilities: {"0": 0.77, "1": 0.23}},
        {value: 'B1', startOn: 5.5, endBelow: 20.5, probabilities: {"0": 0.5, "1": 0.5}},
        {value: 'B2', startOn: 20.5, endBelow: null, probabilities: {"0": 0.8, "1": 0.2}}
      ]
      },
      {
      field: "HasChildProject",
      type: "discrete",
      bins: [
        {value: true, probabilities: {"0": 0.95, "1": 0.05}},
        {value: false, probabilities: {"0": 0.18, "1": 0.82}}
      ]
      }
    ]

    row = {TeamSize: 10, HasChildProject: false}
    newRow = classifier.discreteizeRow(row)
    test.equal(newRow.TeamSize, 'B1')

    row = {TeamSize: -10, HasChildProject: false}
    newRow = classifier.discreteizeRow(row)
    test.equal(newRow.TeamSize, 'B0')

    row = {TeamSize: 0, HasChildProject: false}
    newRow = classifier.discreteizeRow(row)
    test.equal(newRow.TeamSize, 'B0')

    row = {TeamSize: 5.5, HasChildProject: false}
    newRow = classifier.discreteizeRow(row)
    test.equal(newRow.TeamSize, 'B1')

    row = {TeamSize: 20.5, HasChildProject: false}
    newRow = classifier.discreteizeRow(row)
    test.equal(newRow.TeamSize, 'B2')

    row = {TeamSize: 50}
    newRow = classifier.discreteizeRow(row)
    test.equal(newRow.TeamSize, 'B2')

    f = () ->
      row = {junk: 99}
      newRow = classifier.discreteizeRow(row)

    test.throws(f)

    test.done()

#  testBoolean: (test) ->
#    trainingSet = [
#      {TeamSize: 5, HasChildProject: false, RealTeam: 1},
#      {TeamSize: 3, HasChildProject: true, RealTeam: 0},
#      {TeamSize: 3, HasChildProject: true, RealTeam: 1},
#      {TeamSize: 1, HasChildProject: false, RealTeam: 0},
#      {TeamSize: 2, HasChildProject: true, RealTeam: 0},
#      {TeamSize: 2, HasChildProject: false, RealTeam: 0},
#      {TeamSize: 15, HasChildProject: true, RealTeam: 0},
#      {TeamSize: 27, HasChildProject: true, RealTeam: 0},
#      {TeamSize: 13, HasChildProject: true, RealTeam: 1},
#      {TeamSize: 7, HasChildProject: false, RealTeam: 1},
#      {TeamSize: 7, HasChildProject: false, RealTeam: 0},
#      {TeamSize: 9, HasChildProject: true, RealTeam: 1},
#      {TeamSize: 6, HasChildProject: false, RealTeam: 1},
#      {TeamSize: 5, HasChildProject: false, RealTeam: 1},
#      {TeamSize: 5, HasChildProject: false, RealTeam: 0},
#    ]
#
#    classifier = new BayesianClassifier(config)
#
#    percentWins = classifier.train(trainingSet)
#
#    test.ok(approximatelyEqual(percentWins, 0.733333))

  testBasic: (test) ->
    trainingSet = [
      {TeamSize: 5, HasChildProject: 0, RealTeam: 1},
      {TeamSize: 3, HasChildProject: 1, RealTeam: 0},
      {TeamSize: 3, HasChildProject: 1, RealTeam: 1},
      {TeamSize: 1, HasChildProject: 0, RealTeam: 0},
      {TeamSize: 2, HasChildProject: 1, RealTeam: 0},
      {TeamSize: 2, HasChildProject: 0, RealTeam: 0},
      {TeamSize: 15, HasChildProject: 1, RealTeam: 0},
      {TeamSize: 27, HasChildProject: 1, RealTeam: 0},
      {TeamSize: 13, HasChildProject: 1, RealTeam: 1},
      {TeamSize: 7, HasChildProject: 0, RealTeam: 1},
      {TeamSize: 7, HasChildProject: 0, RealTeam: 0},
      {TeamSize: 9, HasChildProject: 1, RealTeam: 1},
      {TeamSize: 6, HasChildProject: 0, RealTeam: 1},
      {TeamSize: 5, HasChildProject: 0, RealTeam: 1},
      {TeamSize: 5, HasChildProject: 0, RealTeam: 0},
    ]

    classifier = new BayesianClassifier(config)

    percentWins = classifier.train(trainingSet)

    test.ok(approximatelyEqual(percentWins, 0.733333))

    expected = [
      {
        field: 'TeamSize',
        type: 'continuous',
        bins: [
          { value: 'B0', startOn: null, endBelow: 4, probabilities: { '0': 0.8, '1': 0.2 } },
          { value: 'B1', startOn: 4, endBelow: 11, probabilities: { '0': 0.2857142857142857, '1': 0.7142857142857143 } },
          { value: 'B2', startOn: 11, endBelow: 21, probabilities: { '0': 0.5, '1': 0.5 } },
          { value: 'B3', startOn: 21, endBelow: null, probabilities: { '0': 1, '1': 0 } }
        ]
      },
      {
        field: 'HasChildProject',
        type: 'discrete', bins: [
          { value: 0, probabilities: { '0': 0.5, '1': 0.5 } },
          { value: 1, probabilities: { '0': 0.5714285714285714, '1': 0.42857142857142855 } }
        ]
      }
    ]
    test.deepEqual(classifier.features, expected)

    expected = {'0': 0.5333333333333333, '1': 0.4666666666666667}
    test.deepEqual(classifier.baseProbabilities, expected)

    test.equal(classifier.predict({TeamSize: 1, HasChildProject: 1}), 0)
    test.equal(classifier.predict({TeamSize: 7, HasChildProject: 0}), 1)
    test.equal(classifier.predict({TeamSize: 7, HasChildProject: 1}), 1)
    test.equal(classifier.predict({TeamSize: 29, HasChildProject: 1}), 0)
    test.equal(classifier.predict({TeamSize: 29, HasChildProject: 0}), 0)

    test.deepEqual(classifier.predict({TeamSize: 5, HasChildProject: 1}, true), { '0': 0.3786982248520709, '1': 0.6213017751479291 })

    savedState = classifier.getStateForSaving('some meta data')
    newClassifier = BayesianClassifier.newFromSavedState(savedState)
    test.equal(newClassifier.meta, 'some meta data')
    test.deepEqual(newClassifier.predict({TeamSize: 5, HasChildProject: 1}, true), { '0': 0.3786982248520709, '1': 0.6213017751479291 })

    test.done()

  testMultipleContinuousFields: (test) ->
    trainingSet = [
      {Depth: 0, TeamSize: 5, RealTeam: 1},
      {Depth: 1, TeamSize: 3, RealTeam: 0},
      {Depth: 1, TeamSize: 3, RealTeam: 1},
      {Depth: 0, TeamSize: 1, RealTeam: 0},
      {Depth: 4, TeamSize: 2, RealTeam: 0},
      {Depth: 0, TeamSize: 2, RealTeam: 0},
      {Depth: 5, TeamSize: 15, RealTeam: 0},
      {Depth: 6, TeamSize: 27, RealTeam: 0},
      {Depth: 5, TeamSize: 13, RealTeam: 1},
      {Depth: 0, TeamSize: 7, RealTeam: 1},
      {Depth: 0, TeamSize: 7, RealTeam: 0},
      {Depth: 1, TeamSize: 9, RealTeam: 1},
      {Depth: 0, TeamSize: 6, RealTeam: 1},
      {Depth: 0, TeamSize: 5, RealTeam: 1},
      {Depth: 0, TeamSize: 5, RealTeam: 0},
    ]

    classifier = new BayesianClassifier(
      outputField: "RealTeam"
      features: [
        {field: 'TeamSize', type: 'continuous'},
        {field: 'Depth', type: 'continuous'}
      ]
    )

    percentWins = classifier.train(trainingSet)

    test.ok(approximatelyEqual(percentWins, 0.733333))

    test.equal(classifier.predict({Depth:1, TeamSize: 1}), 0)
    test.equal(classifier.predict({Depth:0, TeamSize: 7}), 1)
    test.equal(classifier.predict({Depth:1, TeamSize: 7}), 1)
    test.equal(classifier.predict({Depth:7, TeamSize: 29}), 0)
    test.equal(classifier.predict({Depth:0, TeamSize: 29}), 0)

    test.done()
