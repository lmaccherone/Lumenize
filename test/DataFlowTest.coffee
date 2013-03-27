{DataFlow} = require('../')

functionWithoutParameters0 = () ->
  return [
    {a: 1, b: 6}
    {a: 10, b: 20}
  ]

functionPlain1 = (data) ->  # derives a c field and return result
  for row in data
    row.c = row.a + row.b
  return data

functionWithCallback2 = (data, callback) ->  # sums the c field
  sum = 0
  for row in data
    sum += row.c
  callback(null, sum)

class normalCalculator3a  # results is an array containing the portion this c makes up (in parallel with below)
  constructor: (@config, @data, @sum) ->
    @results = []
    @addData(@data)

  addData: (data) ->
    for row in data
      @results.push(row.c / @sum)

  getResults: () ->
    return @results

functionThatReturnsResult3b = (data) ->  # subtracts a from b (in parallel with above)
  for row in data
    row.d = row.b - row.a
  return data

class calculatorWithCallback4
  constructor: (@config, @data, @data2, @callback) ->

  go: () ->  # note, the callback could have been passed in here. My calling code will pass it into either
    for row, index in @data
      row.e = row.d + @data2[index]
    @callback(null, @data)

result0 = functionWithoutParameters0()
result1 = functionPlain1(result0)
#result1 = result0
callback2 = (error, result) ->
  result2 = result
  calculator3a = new normalCalculator3a({}, result1, result2)
  result3a = calculator3a.getResults()
  result3b = functionThatReturnsResult3b(result1)
  callback4 = (error, result) ->
    result4 = result
    console.log(result4)
  calculator4 = new calculatorWithCallback4({}, result3b, result3a, callback4)
  calculator4.go()
functionWithCallback2(result1, callback2)

config = [
  {result: 'result0', f: functionWithoutParameters0}
  {result: 'result1', f: functionPlain1, parameters: ['@result0']}
  {result: 'result2', fc: functionWithCallback2, parameters: ['@result1']}
  {result: 'result3a', c: normalCalculator3a, parameters: [{}, '@result1', '@result2'], getResults: 'getResults', addData: null, addDataParameters: []}  # also support calling addData directly
  {result: 'result3b', f: functionThatReturnsResult3b, parameters: ['@result1']}
  {result: 'result4', cc: calculatorWithCallback4, parameters: [{}, '@result3b', '@result3a'], trigger: 'go', triggerParameters: []}
]

# !TODO: Support parameters: ['@result2b.fieldName']

callback = (error, result) ->
  if error
    console.log(error)
  else
    console.log(result)


exports.DataFlowTest =

  testBasic: (test) ->

#    df = new DataFlow(config, callback)

    DataFlow._addDependencies([], ['@dependency.fieldName'])

    test.done()

