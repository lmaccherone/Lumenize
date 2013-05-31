lumenize = require('../')
histogram = lumenize.histogram
{utils} = require('tztime')

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

exports.histogramTest =

  testControlledBucketing: (test) ->
    buckets = histogram.getBuckets([], null, 1, 0, 100, 100)

    test.equal(buckets.length, 100)
    for b, index in buckets
      test.equal(b.index, index)

    bucketer = histogram.getBucketer(buckets)

    test.equal(10, bucketer(10.234).index)

    f = () ->
      bucketer(100)

    test.throws(f)

    test.done()

  testCalculatedBucketing: (test) ->
    buckets = histogram.getBuckets(rows, 'age', 1)

    expected = [
      { index: 0, startOn: -Infinity, endBelow: 16, label: '< 16' },
      { index: 1, startOn: 16, endBelow: 25, label: '16-25' },
      { index: 2, startOn: 25, endBelow: 34, label: '25-34' },
      { index: 3, startOn: 34, endBelow: 43, label: '34-43' },
      { index: 4, startOn: 43, endBelow: Infinity, label: '>= 43' }
    ]

    test.deepEqual(expected, buckets)

    bucketer = histogram.getBucketer(buckets)

    test.equal(0, bucketer(10.234).index)
    test.equal(0, bucketer(-1234567).index)
    test.equal(2, bucketer(25).index)
    test.equal(2, bucketer(25.24).index)
    test.equal(4, bucketer(1234567).index)

    test.done()

  testBy10: (test) ->

    buckets = histogram.getBuckets(rows, 'age', 10)

    expected = [
      { index: 0, startOn: -Infinity, endBelow: 10, label: '< 10' },
      { index: 1, startOn: 10, endBelow: 20, label: '10-20' },
      { index: 2, startOn: 20, endBelow: 30, label: '20-30' },
      { index: 3, startOn: 30, endBelow: 40, label: '30-40' },
      { index: 4, startOn: 40, endBelow: Infinity, label: '>= 40' }
    ]

    test.deepEqual(expected, buckets)

    test.done()

#  testHistogram: (test) ->
#    rows = [
#      {age:  7},
#      {age: 25},
#      {age: 23},
#      {age: 27},
#      {age: 34},
#      {age: 55},
#      {age: 42},
#      {age: 13},
#      {age: 11},
#      {age: 23},
#      {age: 31},
#      {age: 32},
#      {age: 29},
#      {age: 16},
#      {age: 31},
#      {age: 22},
#      {age: 25},
#    ]
#
#    histogramResults = histogram(rows, 'age')
#    {buckets, chartMax, clipped, valueMax} = histogramResults
#
#    expected = [
#      { label: '0-12',  count: 2 },
#      { label: '12-24', count: 5 },
#      { label: '24-36', count: 8 },
#      { label: '36-48', count: 1 },
#      { label: '48-60', count: 1 }
#    ]
#
#    for b, idx in buckets
#      test.ok(utils.match(expected[idx], b))
#      for row in b.rows
#        test.equal(row.age, row.clippedChartValue)
#
#    test.equal(buckets[0].rows[0].age, 7)
#
#    # Adding an outlier
#    rows.push({age: 85})
#
#    {buckets, chartMax, clipped} = histogram(rows, 'age')
#
#    expected = [
#      { label: '0-12',  count: 2 },
#      { label: '12-24', count: 5 },
#      { label: '24-36', count: 8 },
#      { label: '36-48', count: 1 },
#      { label: '48-86*', count: 2 }
#    ]
#
#    for b, idx in buckets
#      test.ok(utils.match(expected[idx], b))
#      for row in b.rows
#        if b.label.indexOf('*') == -1
#          test.equal(row.age, row.clippedChartValue)
#        else
#          test.equal(row.age == row.clippedChartValue, false)
#          test.ok(row.clippedChartValue <= chartMax)
#
#    # one more time but supress clipping
#    {buckets, chartMax, clipped} = histogram(rows, 'age', true)
#
#    expected = [
#      { label: '0-22',  count: 4 },
#      { label: '22-44', count: 12 },
#      { label: '44-66', count: 1 },
#      { label: '66-88', count: 1 },
#      { label: '88-110', count: 0 }
#    ]
#
#    for b, idx in buckets
#      test.ok(utils.match(expected[idx], b))
#      for row in b.rows
#        if b.label.indexOf('*') == -1
#          test.equal(row.age, row.clippedChartValue)
#        else
#          test.equal(row.age == row.clippedChartValue, false)
#          test.ok(row.clippedChartValue <= chartMax)
#
#    test.done()
#
#  testOneRow: (test) ->
#    rows = [
#      {age:  7},
#    ]
#
#    histogramResults = histogram(rows, 'age')
#
#    test.equal(histogramResults.bucketSize, 4)
#
#    test.done()
#
#  testZeroRows: (test) ->
#    rows = []
#
#    histogramResults = histogram(rows, 'age')
#
#    test.equal(histogramResults.bucketSize, 1)
#
#    test.done()