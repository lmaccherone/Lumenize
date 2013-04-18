{anova} = require('../')

data = [
  {group: 'A', value: 1},
  {group: 'A', value: 2},
  {group: 'A', value: 3},
  {group: 'A', value: 4},
  {group: 'B', value: 11},
  {group: 'B', value: 22},
  {group: 'B', value: 33},
  {group: 'C', value: 45},
  {group: 'C', value: 2}
]

groups = [
  {label: 'group 1', predicate: (row) -> row.group is 'A'},
  {label: 'group 2', predicate: (row) -> row.group is 'B'},
  {label: 'group 3', predicate: (row) -> row.group is 'C'}
]

approximatelyEqual = (a, b, error = 0.001) ->
  return Math.abs(a - b) < error

exports.anovaTest =

  basicTest: (test) ->

    results = anova(data, undefined, 'value', groups)

    {factorDF, factorSS, factorMS, factorF, factorP, errorDF, errorSS, errorMS, totalDF, totalSS, rSquared, rSquaredAdjusted, residualPlot, histogram, pooledStandardDeviation} = results

    console.log(results)

    test.equal(factorDF, 2)
    test.equal(factorSS, 900.5)
    test.equal(factorMS, 450.25)
    test.ok(approximatelyEqual(factorF, 2.31, 0.01))
    test.ok(approximatelyEqual(factorP, 0.180335))

    test.equal(errorDF, 6)
    test.equal(errorSS, 1171.5)
    test.equal(errorMS, 195.25)

    test.equal(totalDF, 8)
    test.equal(totalSS, 2072)

    test.ok(approximatelyEqual(rSquared, 0.4346))
    test.ok(approximatelyEqual(rSquaredAdjusted, 0.2461))

    test.done()

