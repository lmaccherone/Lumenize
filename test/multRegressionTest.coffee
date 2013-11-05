lumenize = require('../')
multiRegression = lumenize.multiRegression
{utils} = require('tztime')

data = [
  [1142, 1060, 325, 201],
  [863,  995,  98,  98],
  [1065, 3205, 23,  162],
  [554,  120,  0,   54],
  [983,  2896, 120, 138]
  [256,  485,  88,  61]
]

exports.multiRegressionTest =

  testCalculateA: (test) ->
    actual = multiRegression.calculateA(data)
    expected = [
      [ 6, 4863, 8761, 654, 714 ],
      [ 4863, 4521899, 8519938, 620707, 667832 ],
      [ 8761, 8519938, 21022091, 905925, 1265493 ],
      [ 654, 620707, 905925, 137902, 100583 ]
    ]

    test.deepEqual(actual, expected)

    test.done()

  testSwapRows: (test) ->
    a = [
      [1, 2, 3, 4],
      [10, 20, 30, 40],
      [100, 200, 300, 400]
    ]

    multiRegression.swapRows(a, 0, 2)
    expected = [
      [100, 200, 300, 400]
      [10, 20, 30, 40],
      [1, 2, 3, 4],
    ]
    test.deepEqual(a, expected)

    test.done()