charttime = require('../')
{histogram} = charttime
utils = require('../src/utils')


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

    {buckets, chartMax} = histogram(rows, 'age')
    
    expected = [ 
      { label: '0-13',  count: 2 },
      { label: '13-26', count: 7 },
      { label: '26-39', count: 6 },
      { label: '39-52', count: 1 },
      { label: '52-65', count: 1 } 
    ]

    for b, idx in buckets
      test.ok(utils.match(expected[idx], b))
      for row in b.rows
        test.equal(row.age, row.clippedChartValue)
      
    test.equal(buckets[0].rows[0].age, 7)
    
    # Adding an outlier
    rows.push({age: 85})

    {buckets, chartMax} = histogram(rows, 'age')

    expected = [ 
      { label: '0-17',  count: 4 },
      { label: '17-34', count: 10 },
      { label: '34-51', count: 2 },
      { label: '51-68', count: 1 },
      { label: '68-86*', count: 1 } 
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