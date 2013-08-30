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

class NormalCalculator3a  # results is an array containing the portion this c makes up (in parallel with below)
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

class CalculatorWithCallback4
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
  calculator3a = new NormalCalculator3a({}, result1, result2)
  result3a = calculator3a.getResults()
  result3b = functionThatReturnsResult3b(result1)
  callback4 = (error, result) ->
    result4 = result
    console.log(result4)
  calculator4 = new CalculatorWithCallback4({}, result3b, result3a, callback4)
  calculator4.go()
functionWithCallback2(result1, callback2)

#config = [
#  {result: 'result0', f: functionWithoutParameters0}
#  {result: 'result1', f: functionPlain1, parameters: ['@result0']}
#  {result: 'result2', fc: functionWithCallback2, parameters: ['@result1']}
#  {result: 'result3a', c: NormalCalculator3a, parameters: [{}, '@result1', '@result2'], getResults: 'getResults', addData: null, addDataParameters: []}  # also support calling addData directly
#  {result: 'result3b', f: functionThatReturnsResult3b, parameters: ['@result1']}
#  {result: 'result4', cc: CalculatorWithCallback4, parameters: [{}, '@result3b', '@result3a'], trigger: 'go', triggerParameters: []}
#]

config = [
  {result0: functionWithoutParameters0, wrap: true}
  {result1: functionPlain1, parameters: ['@result0'], wrap: true}
  {result2: functionWithCallback2, parameters: ['@result1']}
  {result3a: 'getResults', wrap: true, scopeClass: NormalCalculator3a, constructorParameters: [{}, '@result1', '@result2']} # also supports preCalls: [{"addData": ["@result0"]}]
  {result3b: functionThatReturnsResult3b, parameters: ['@result1'], wrap: true}
  {result4: 'go', scopeClass: CalculatorWithCallback4, constructorParameters: [{}, '@result3b', '@result3a']}
  # also but not shown {result99: someFunctionThatUsesThis, scope: someBigObjectToHoldThisScope} it will call the function with setting someBigObjectToHoldThisScope as the "this" for the function. This can hold scope from prior calls as well as store new data for later stages.
  # Also not show is the ability to add parameters to the trigger function (like 'go'). We'd just use `parameters`
]

###
Rather than make the user create the config and write their code, I'm looking to make Lumenize be a new reactive programming language.

So, the user would type something like this:

_@result0 = functionWithoutParameters0()
_@result1 = functionPlain1(_@result0)
_@result2 = functionWithCallback2(_@result1, _@)  # If you do this, the assumed callback pattern is cb(error, result)
_@calculator3a = new NormalCalculator3a({}, _@result1, _@result2)
_@result3a = _@calculator3a.getResults()
_@result3b = functionThatReturnsResult3b(_@result1)
_@calculator4 = new CalculatorWithCallback4({}, _@result3b, _@result3a, _@)
_@result4 = _@calculator4.go()

console.log(_@result4)

-------

We'd build the DAG from above.

We'd rewrite a few things.

First, any time it sees the _@ all by itself, that means that it's a callback. Everything below this point in the program is wrapped
into a function and the function name is place in the position of the _@. Note the function gets moved above the call.

Any line with a _@ to the left of an equals sign gets wrapped into it's own function along with every line of code that follows
up to the next one. Question: how do we deal with scope? Will we have to declare those variables modified in the function outside
the function so they are available to the next function? I think so. The functions all get called by the dispatcher based
upon if the dependencies change.

###

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

