{functions} = require('../')

exports.functionsTest =

  testExpandMetrics: (test) ->

#    console.log('***')
#    console.log(functions.expandMetrics.toString())
#    functions.junk = 'junk'
#    console.log('***')

    metrics = [
      {f: 'average', field: 'a'},
      {f: 'variance', field: 'b'}
      {f: 'standardDeviation', field: 'c'}
    ]

    functions.expandMetrics(metrics)

    expected = [
      {
        "metric": "sumSquares",
        "field": "c",
        "as": "c_sumSquares",
        f: functions.sumSquares
      },
      {
        "metric": "sum",
        "field": "c",
        "as": "c_sum",
        f: functions.sum
      },
      {
        "metric": "sumSquares",
        "field": "b",
        "as": "b_sumSquares",
        f: functions.sumSquares
      },
      {
        "metric": "sum",
        "field": "b",
        "as": "b_sum",
        f: functions.sum
      },
      {
        "metric": "sum",
        "field": "a",
        "as": "a_sum",
        f: functions.sum
      },
      {
        "metric": "count",
        "field": "",
        "as": "_count",
        f: functions.count
      },
      {
        "metric": "average",
        "field": "a",
        "as": "a_average",
        f: functions.average
      },
      {
        "metric": "variance",
        "field": "b",
        "as": "b_variance",
        f: functions.variance
      },
      {
        "metric": "standardDeviation",
        "field": "c",
        "as": "c_standardDeviation",
        f: functions.standardDeviation
      }
    ]
    test.deepEqual(expected, metrics)

    test.done()

  testExpandMetricsWithSomeExisting: (test) ->
    metrics = [
      {f: 'values', field: 'a'}
      {f: 'p50', field: 'a'}
    ]

    functions.expandMetrics(metrics)

    test.equal(2, metrics.length)

    test.done()

  testExpandMetricsWithBadOrder: (test) ->
    metrics = [
      {f: 'average', field: 'a'}
      {f: 'sum', field: 'a'}
    ]

    f = () ->
      functions.expandMetrics(metrics)

    test.throws(f, Error)

    test.done()

  testMissingCount: (test) ->
    metrics = functions.expandMetrics(undefined, true)

    test.deepEqual(metrics, [{metric: 'count', field: '', f: functions.count, as: '_count', metric: 'count'}])

    test.done()

  testAsProvided: (test) ->
    metrics = [
      {as: 'scope', field: 'a', f: 'sum'}
    ]

    functions.expandMetrics(metrics)

    test.equal('scope', metrics[0].as)

    test.done()

  testFunction: (test) ->
    myFunc = () ->
      return 'hello'

    metrics = [
      {f: myFunc, field: 'hello'}
    ]

    f = () ->
      functions.expandMetrics(metrics)

    test.throws(f)

    metrics = [
      {f: myFunc, as: 'hello', field: 'hello'}
    ]

    functions.expandMetrics(metrics, undefined, true)

    test.deepEqual(metrics[1].f.dependencies, ['values'])

    test.equal(metrics.length, 2)

    test.done()

  testPercentile: (test) ->
    p50 = functions.percentileCreator(50)
    values = [1, 10, 11, 55]

    test.equal(p50(values), 10.5)

    test.equal(functions.percentileCreator(95)([14]), 14)
    test.equal(functions.percentileCreator(95)([14, 15, 16]), 15.9)
    test.equal(functions.percentileCreator(100)([14, 15, 16]), 16)
    test.equal(functions.percentileCreator(95)([14, 15]), 14.95)
    test.equal(functions.percentileCreator(95)([14, null, 15]), 14.9)

    test.done()

  testSum: (test) ->

    test.equal(functions.sum([0]),0) #array of 0
    test.equal(functions.sum([-1, 0, 1, -2]), -2) #array with negative sum
    test.equal(functions.sum([]), 0) #empty array
    test.equal(functions.sum([null]), 0) #empty array
    test.equal(functions.sum([1, null, 1]), 2) #empty array

    test.done()

  testSumSquares: (test) ->

    test.equal(functions.sumSquares([0]), 0) #array containing only 0
    test.equal(functions.sumSquares([0, 1, 2]),5)
    test.equal(functions.sumSquares([-2, -1, 0, 1, 2]),10) #array with negative numbers
    test.equal(functions.sumSquares([]), 0) #empty array
    test.equal(functions.sumSquares([null]), 0) # array with only null
    test.equal(functions.sumSquares([5, null, 5]), 50) # array with mixture of null and not null

    test.done()

  testSumCubes: (test) ->

    test.equal(functions.sumCubes([3]), 27)
    test.equal(functions.sumCubes([1, 2]), 9)
    test.equal(functions.sumCubes([0, 5]), 125)
    test.equal(functions.sumCubes([]), 0)
    test.equal(functions.sumCubes([null]), 0)
    test.equal(functions.sumCubes([1, null, 1]), 2)

    test.done()

  testProduct: (test) ->

    test.equal(functions.product([3, 7]), 21)
    test.equal(functions.product([1, 2]), 2) #any number multiplied by 1 is itself
    test.equal(functions.product([0, 5]), 0) #any number multiplied by 0 is 0
    test.equal(functions.product([]), 1)
    test.equal(functions.product([null]), 0)
    test.equal(functions.product([1, null, 1]), 0)

    test.done()

  testLastValue: (test) ->
    test.equal(functions.lastValue([0]), 0)
    test.equal(functions.lastValue([]), null) #last value of an empty array is null
    test.equal(functions.lastValue([-2, 0, 2]), 2)
    test.equal(functions.lastValue([null]), null)
    test.equal(functions.lastValue([1, null]), null)
    test.equal(functions.lastValue([null, 1]), 1)
    test.done()

  testFirstValue: (test) ->
    test.equal(functions.firstValue([0]), 0)
    test.equal(functions.firstValue([]), null) #first value of an empty array is null
    test.equal(functions.firstValue([-2,0,2]),-2)
    test.equal(functions.firstValue([null]), null)
    test.equal(functions.firstValue([1, null]), 1)
    test.equal(functions.firstValue([null, 1]), null)
    test.done()

  testCount: (test) ->
    test.equal(functions.count([0]),1)
    test.equal(functions.count([]), 0)
    test.equal(functions.count([-2,0,2]),3)
    test.equal(functions.count([null]), 1)
    test.equal(functions.count([1, null, 1]), 3)
    test.done()

  testMin: (test) ->
    test.equal(functions.min([0]),0)
    test.equal(functions.min([]),null) #min value in empty array is null
    test.equal(functions.min([-2,0,2]),-2)
    test.equal(functions.min([null]),null)
    test.equal(functions.min([-1, null, 1]), -1)
    test.equal(functions.min([null, 1]), null)
    test.equal(functions.min([null, -1]), -1)
    test.done()

  testMax: (test) ->
    test.equal(functions.max([0]), 0)
    test.equal(functions.max([]), null) #max value in an empty array is null
    test.equal(functions.max([-2,0,2]),2)
    test.equal(functions.max([null]), null)
    test.equal(functions.max([null, 1]), 1)
    test.equal(functions.max([-1, null, 1]), 1)
    test.equal(functions.max([-1, null]), null)
    test.done()


  testValues: (test) ->
    test.equal(functions.values([1,2,3,4,5]).length, [1,2,3,4,5].length)
     #how to test array equality in coffeescript? just testing if lengths are equal

    test.equal(functions.values([1,2,3,4,5], [15], [6,7,8,9,10]).length, [15,6,7,8,9,10].length)
    test.equal(functions.values([1,2,3,4,5], [15], [null]).length, [15, null].length)
    test.done()

  testAverage: (test) ->
    test.equal(functions.average([0]), 0)
    test.equal(functions.average([-2, -1, 0, 1, 2]), 0)
    test.equal(functions.average([]), null)
    test.equal(functions.average([10, null]), 5)
    test.equal(functions.average([null]), 0)
    test.done()

  testPercentileCreator50: (test) ->
    values =  [-2, -1, 0, 1, 2]

    test.equal(functions.percentileCreator(50)(values), 0) #median of array of integers
    test.done()

  testPercentileCreatorEven: (test) ->
    values = [-2, -1, 1, 2]
    test.equal(functions.percentileCreator(50)(values), 0)
    test.done()

  testPercentileCreatorNulls: (test) ->
    test.equal(functions.percentileCreator(50)([]), null)
    test.equal(functions.percentileCreator(50)([null]), null)
    test.equal(functions.percentileCreator(50)([0]), 0)
    test.equal(functions.percentileCreator(50)([0, 0]), 0)
    test.equal(functions.percentileCreator(50)([null, null]), 0)
    test.done()

  testPercentileCreator: (test) ->
    values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    test.equal(functions.percentileCreator(99.9)(values), 9.991)
    test.equal(functions.percentileCreator(50)(values), 5.5)
    test.done()

  testPercentileCreatorDecimals: (test) ->
    values = [1.5, 2.7, 3.4, 4.5, 5.0, 6.7, 7.8, 8.5, 9.1, 10.2] #median of an array of decimals
    test.equal(functions.percentileCreator(50)(values), 5.85)
    test.done()

  testMedian: (test) ->
    values = [1.5, 2.7, 3.4, 4.5, 5.0, 6.7, 7.8, 8.5, 9.1, 10.2] #median of an array of decimals
    test.equal(functions.median(values), functions.percentileCreator(50)(values))
    test.equal(functions.median([0]), 0)
    test.equal(functions.median([0, 0]), 0)
    test.equal(functions.median([null, null]), 0)
    test.done()

  testPercentileCreatorDecimalsOdd: (test) ->
    values = [1.5, 2.7, 3.4, 4.5, 5.0, 6.7, 7.8, 8.5, 9.1, 10.2, 11.7] #median of an array of decimals
    test.equal(functions.percentileCreator(50)(values), 6.7)
    test.done()

  testVariance: (test) ->
    test.equal(functions.variance([-2, -1.5, 0, 1, 2.5]), 3.375 )
    test.equal(functions.variance([]), null )
    test.equal(functions.variance([null, 2]), functions.variance([0, 2]) )
    test.equal(functions.variance([null, null]), functions.variance([0, 0]) )
    test.equal(functions.variance([null]), functions.variance([0]) )
    test.done()

  testStandardDeviation: (test) ->
    values = [9, 11, 10]
    test.equal(functions.standardDeviation(values), 1)
    test.equal(functions.standardDeviation([]), 0)
    test.equal(functions.standardDeviation([null]), 0)
    test.equal(functions.standardDeviation([0]), 0)
    test.equal(functions.standardDeviation([1]), 0)
    test.equal(functions.standardDeviation([null, null]), 0)
    test.equal(functions.standardDeviation([null, 4, 2]), 2)
    test.done()