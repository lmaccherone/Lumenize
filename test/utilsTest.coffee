{Time} = require('../')
utils = require('../src/utils')

exports.utilsTest =

  testMatch: (test) ->
    xmas = {'month': 12, 'day': 25}
    xmas2011 = new Time({granularity: 'day', year: 2011, month:12, day: 25})
    someday = new Time({granularity: 'day', year: 2011, month:12, day: 26})
    test.ok(utils.match(xmas, xmas2011), 'xmas should match xmas2011')
    test.equal(utils.match(xmas, someday), false, 'xmas should not match xmas')
    test.done()