lumenize = require('../')
{distributions} = lumenize
{utils} = require('tztime')

exports.distributionsTest =

  testNorm: (test) ->

    console.log(distributions.normInverse(0.95))

    console.log(distributions.normDist(1.644))

    console.log(distributions.fDist(2, 6, 2.3060179257362354))

    test.done()