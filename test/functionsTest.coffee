{functions} = require('../')

exports.deriveTest =

  testStandardDeviation: (test) ->
    console.log(functions.standardDeviation.dependencies.toString())

    test.done()
    
    