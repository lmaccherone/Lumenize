{Time, TimelineIterator, Timeline} = require('../')
utils = require('../src/utils')

# !TODO: Need more testing of step functionality

exports.TimelineIteratorTest =
  setUp: (callback) ->
    @i = new TimelineIterator({
      startOn:new Time({granularity: 'day', year: 2011, month:1, day: 1}),
      endBefore:new Time({granularity: 'day', year: 2011, month:1, day: 7})
    })
    
    callback()
    
  testNextAndHasNext: (test) ->
    f = () ->
      i2 = new TimelineIterator({
        startOn:new Time({granularity: 'day', year: 2011, month:1, day: 1}),
        endBefore:new Time({granularity: 'day', year: 2011, month:1, day: 1})
      })
      i2.next()

    StopIteration = if typeof(StopIteration) is 'undefined' then utils.StopIteration else StopIteration
    test.throws(f, StopIteration, 'should throw on calling next() when hasNext() is false')

    i2 = new TimelineIterator({
      startOn:new Time({granularity: 'day', year: 2011, month:1, day: 1}),
      endBefore:new Time({granularity: 'day', year: 2011, month:1, day: 10}),
      workDays: 'Monday ,   Wednesday, Thursday ,Saturday',
      holidays: [
        {month: 12, day: 25},
        {month: 1, day: 1},
        {month: 7, day: 4},
        {year: 2011, month: 11, day: 24}  # Thanksgiving 2011
      ]
    })

    temp = i2.next()
    test.equal(temp.dowString(), 'Monday', 'Should be Monday because 01-01 is a holiday and Sunday is not a workday')

    temp = i2.next()
    test.equal(temp.dowString(), 'Wednesday', 'Should be Wednesday')

    temp = i2.next()
    test.equal(temp.dowString(), 'Thursday', 'Should be Thursday')

    temp = i2.next()
    test.equal(temp.dowString(), 'Saturday', 'Should be Saturday again')

    test.equal(i2.hasNext(), false, 'Should be no more because the 2011-01-09 is Sunday which is not a workDay')

    test.done()

  testThrows: (test) ->
    spec = {
      startOn:new Time({granularity: 'day', year: 2011, month:1, day: 1}),
      endBefore:new Time({granularity: 'day', year: 2011, month:1, day: 10}),
      workDays: 'Monday ,   Wednesday, Thursday ,Saturday',
      holidays: [
        {month: 12, day: 25},
        {month: 1, day: 1},
        {month: 7, day: 4},
        {year: 2011, month: 11, day: 24}  # Thanksgiving 2011
      ]
    }

    f = () ->
      i3 = new TimelineIterator(spec)

    endBefore = spec.endBefore
    delete spec.endBefore
    test.throws(f, utils.AssertException, 'should throw with only startOn')

    spec.limit = 10
    spec.step = -1
    test.throws(f, utils.AssertException, 'should throw when no endBefore and step is negative')

    startOn = spec.startOn
    delete spec.startOn
    delete spec.limit
    test.throws(f, Error, 'should throw with no startOn, endBefore, limit')

    spec.endBefore = endBefore
    spec.limit = 10
    spec.step = 1
    test.throws(f, utils.AssertException, 'should throw when no startOn and step is positive')

    test.done()