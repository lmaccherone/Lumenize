{ChartTime, ChartTimeRange, utils} = require('../')


# !TODO: Needs testing of skip functionality

exports.RangeLimitAndSkipTest =

  testLimitWithDays: (test) ->
    fiji = new ChartTime('this day in Pacific/Fiji')
    console.log(JSON.stringify(fiji, undefined, 2))
  
  
    spec = {
      pastEnd:'next day in America/New_York',
      limit: 7,
      workDays: 'Monday ,   Wednesday, Thursday ,Saturday',
      holidays: [
        {month: 12, day: 25},
        {month: 1, day: 1},
        '2013-01-05'
      ]
    }
    timeline = new ChartTimeRange(spec).getTimeline()
#     console.log(JSON.stringify(timeline, undefined, 2))
    

#     i2 = new ChartTimeIterator(spec)
#     while (i2.hasNext())
#       i2.next()
#     test.equal(i2.count, 4, 'i2.count expected to be 4, got: ' + i2.count)
# 
#     all = i2.getAll()
# 
#     spec.skip = -1
#     i2 = new ChartTimeIterator(spec)
#     test.deepEqual(i2.getAll(), all.reverse(), 'should be the same in reverse')
# 
#     all.reverse()
#     delete spec.skip
#     pastEnd = spec.pastEnd
#     delete spec.pastEnd
#     spec.limit = 4
#     i2 = new ChartTimeIterator(spec)
#     test.deepEqual(i2.getAll(), all, 'should be the same with limit')
# 
#     spec.pastEnd = pastEnd
#     start = spec.start
#     delete spec.start
#     spec.limit = 4
#     spec.skip = -1
#     i2 = new ChartTimeIterator(spec)
#     test.deepEqual(i2.getAll(), all.reverse(), 'should be the same in reverse')

    test.done()
