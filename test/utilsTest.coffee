{Time} = require('../')
utils = require('../src/utils')

exports.utilsTest =

  testMatch: (test) ->
    xmas = {'month': 12, 'day': 25}
    xmas2011 = new Time({granularity: 'day', year: 2011, month:12, day: 25})
    someday = new Time({granularity: 'day', year: 2011, month:12, day: 26})
    test.ok(utils.match(xmas, xmas2011), 'xmas should match xmas2011')
    test.equal(utils.match(xmas, someday), false, 'xmas2011 should not match some day')
    test.done()

  testFilterMatch: (test) ->
    o1 = {a: 1, b: [1, 2, 3], c: {x: 1, y: [10, 20], z: [{a: 100}, {b: 200}]}}
    o2 = {b: [1, 2, 3], c: {y: [10, 20], z: [{a: 100}, {b: 200}], x: 1}, a: 1}
    o3 = {b: [1, 2, 3]}
    test.ok(utils.filterMatch(o1, o2))
    test.ok(utils.filterMatch(o3, o1))
    test.equal(false, utils.filterMatch(o1, o3))
    test.done()