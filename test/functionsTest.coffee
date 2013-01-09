{functions} = require('../')

exports.functionsTest =

  testExpandMetrics: (test) ->
    metrics = [
      {metric: 'average', field: 'a'},
      {metric: 'variance', field: 'b'}
      {metric: 'standardDeviation', field: 'c'}
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
      {metric: 'values', field: 'a'}
      {metric: 'p50', field: 'a'}
    ]

    functions.expandMetrics(metrics)

    test.equal(2, metrics.length)

    test.done()

  testExpandMetricsWithBadOrder: (test) ->
    metrics = [
      {metric: 'average', field: 'a'}
      {metric: 'sum', field: 'a'}
    ]

    f = () ->
      functions.expandMetrics(metrics)

    test.throws(f, Error)

    test.done()

  testMissingCount: (test) ->
    metrics = functions.expandMetrics(undefined, true)

    test.deepEqual(metrics, [{metric: 'count', field: '', f: functions.count, as: '_count'}])

    test.done()

  testAsProvided: (test) ->
    metrics = [
      {as: 'scope', field: 'a', metric: 'sum'}
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

    functions.expandMetrics(metrics)

    test.deepEqual(metrics[1].f.dependencies, ['values'])

    test.equal(metrics.length, 2)

    test.done()