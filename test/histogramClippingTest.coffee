lumenize = require('../')
histogram = lumenize.histogram.clipping
{utils} = require('tztime')

exports.histogramTest =

  testHistogram: (test) ->
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

    histogramResults = histogram(rows, 'age')
    {buckets, chartMax, clipped, valueMax} = histogramResults

    expected = [
      { label: '0-12',  count: 2 },
      { label: '12-24', count: 5 },
      { label: '24-36', count: 8 },
      { label: '36-48', count: 1 },
      { label: '48-60', count: 1 }
    ]

    for b, idx in buckets
      test.ok(utils.match(expected[idx], b))
      for row in b.rows
        test.equal(row.age, row.clippedChartValue)

    test.equal(buckets[0].rows[0].age, 7)

    # Adding an outlier
    rows.push({age: 85})

    {buckets, chartMax, clipped} = histogram(rows, 'age')

    expected = [
      { label: '0-12',  count: 2 },
      { label: '12-24', count: 5 },
      { label: '24-36', count: 8 },
      { label: '36-48', count: 1 },
      { label: '48-86*', count: 2 }
    ]

    for b, idx in buckets
      test.ok(utils.match(expected[idx], b))
      for row in b.rows
        if b.label.indexOf('*') == -1
          test.equal(row.age, row.clippedChartValue)
        else
          test.equal(row.age == row.clippedChartValue, false)
          test.ok(row.clippedChartValue <= chartMax)

    # one more time but supress clipping
    {buckets, chartMax, clipped} = histogram(rows, 'age', true)

    expected = [
      { label: '0-22',  count: 4 },
      { label: '22-44', count: 12 },
      { label: '44-66', count: 1 },
      { label: '66-88', count: 1 },
      { label: '88-110', count: 0 }
    ]

    for b, idx in buckets
      test.ok(utils.match(expected[idx], b))
      for row in b.rows
        if b.label.indexOf('*') == -1
          test.equal(row.age, row.clippedChartValue)
        else
          test.equal(row.age == row.clippedChartValue, false)
          test.ok(row.clippedChartValue <= chartMax)

    test.done()

  testOneRow: (test) ->
    rows = [
      {age:  7},
    ]

    histogramResults = histogram(rows, 'age')

    test.equal(histogramResults.bucketSize, 4)

    test.done()

  testZeroRows: (test) ->
    rows = []

    histogramResults = histogram(rows, 'age')

    test.equal(histogramResults.bucketSize, 1)

    test.done()