{ChartTime, ChartTimeIterator, ChartTimeRange} = require('../')
utils = require('../src/utils')

# !TODO: Need more testing of step functionality

exports.ChartTimeIteratorTest =
  setUp: (callback) ->
    @i = new ChartTimeIterator({
      startOn:new ChartTime({granularity: 'day', year: 2011, month:1, day: 1}),
      endBefore:new ChartTime({granularity: 'day', year: 2011, month:1, day: 7})
    })
    
    callback()
    
  testNextAndHasNext: (test) ->
    f = () ->
      i2 = new ChartTimeIterator({
        startOn:new ChartTime({granularity: 'day', year: 2011, month:1, day: 1}),
        endBefore:new ChartTime({granularity: 'day', year: 2011, month:1, day: 1})
      })
      i2.next()

    StopIteration = if typeof(StopIteration) is 'undefined' then utils.StopIteration else StopIteration
    test.throws(f, StopIteration, 'should throw on calling next() when hasNext() is false')

    i2 = new ChartTimeIterator({
      startOn:new ChartTime({granularity: 'day', year: 2011, month:1, day: 1}),
      endBefore:new ChartTime({granularity: 'day', year: 2011, month:1, day: 10}),
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

  testIterator: (test) ->
    spec = {
      startOn:new ChartTime({granularity: 'day', year: 2011, month:1, day: 1}),
      endBefore:new ChartTime({granularity: 'day', year: 2011, month:1, day: 10}),
      workDays: 'Monday ,   Wednesday, Thursday ,Saturday',
      holidays: [
        {month: 12, day: 25},
        {month: 1, day: 1},
        {month: 7, day: 4},
        {year: 2011, month: 11, day: 24}  # Thanksgiving 2011
      ]
    }

    i2 = new ChartTimeIterator(spec)
    while (i2.hasNext())
      i2.next()
    test.equal(i2.count, 4, 'i2.count expected to be 4, got: ' + i2.count)

    all = i2.getAll()

    spec.step = -1
    i2 = new ChartTimeIterator(spec)
    test.deepEqual(i2.getAll(), all.reverse(), 'should be the same in reverse')

    all.reverse()
    delete spec.step
    endBefore = spec.endBefore
    delete spec.endBefore
    spec.limit = 4
    i2 = new ChartTimeIterator(spec)
    test.deepEqual(i2.getAll(), all, 'should be the same with limit')

    spec.endBefore = endBefore
    startOn = spec.startOn
    delete spec.startOn
    spec.limit = 4
    spec.step = -1
    i2 = new ChartTimeIterator(spec)
    test.deepEqual(i2.getAll(), all.reverse(), 'should be the same in reverse')

    test.done()

  testHours: (test) ->
    spec = {
      startOn: new ChartTime({granularity: 'hour', year: 2011, month:1, day: 3, hour: 14}),
      endBefore: new ChartTime('2011-01-04T22'),
      workDayStartOn: {hour: 9, minute: 0},
      workDayEndBefore: {hour: 17, minute: 0}
    }
    i2 = new ChartTimeIterator(spec)

    test.equal(i2.getAll().length, 11, 'should be 11 work hours between these two ChartTimes')

    test.done()
    
  testHoursNightShift: (test) ->
    spec = {
      startOn: new ChartTime({granularity: 'hour', year: 2011, month:1, day: 3, hour: 20}),
      endBefore: new ChartTime(granularity: 'hour', hour: 8, year:2011, month:1, day:4)
      workDayStartOn: {hour: 23, minute: 0},
      workDayEndBefore: {hour: 8, minute:0}
    }
    i2 = new ChartTimeIterator(spec)
    test.equal(i2.getAll().length, 8, 'should be 8 work hours from 11pm til 7am')
    
    test.done()
    
   testHoursSpanDays: (test) ->
    spec = {
      startOn: new ChartTime({granularity: 'hour', year: 2011, month:1, day: 3, hour: 7}),
      endBefore: new ChartTime(granularity: 'hour', year:2011, month:1, day:4, hour: 23)
      workDayStartOn: {hour: 8, minute: 0},
      workDayEndBefore: {hour: 18, minute:0}
    }
    i2 = new ChartTimeIterator(spec)
    test.equal(i2.getAll().length, 20, 'should be 20 work hours')
    
    test.done()    
    
  testHoursSpanWeeks: (test) ->
    spec = {
      startOn: new ChartTime(granularity:'hour', year: 2011, month: 12, day: 30, hour: 1),
      endBefore: new ChartTime(granularity: 'hour', year: 2012, month: 1, day: 3, hour: 1)
    }
    i2 = new ChartTimeIterator(spec)
    test.equal(i2.getAll().length, 48)  
    test.done()
  
  testWorkHours: (test) ->
    spec = {
      startOn: new ChartTime(granularity: 'hour', year: 2012, month: 2, day: 1, hour: 5),
      endBefore: new ChartTime(granularity: 'hour', year: 2012, month: 2, day: 5, hour: 23)
      workDayStartOn: {hour: 10, minute: 30}
      workDayEndBefore: {hour: 12, minute: 30}
    }
    i2 = new ChartTimeIterator(spec)
    test.equal(i2.getAll().length, 6)
    test.done()
  
  testMinutes: (test) ->
    spec = {
      startOn: new ChartTime({granularity: 'minute', year: 2011, month:1, day: 3, hour: 14, minute: 23}),
      endBefore: new ChartTime('2011-01-04T22:23'),
      workDayStartOn: {hour: 9, minute: 30},
      workDayEndBefore: {hour: 17, minute: 15}
    }
    i2 = new ChartTimeIterator(spec)

    test.equal(i2.getAll().length, 11*60 + 2*15 - 30 - 23, "should be #{11*60 + 2*15 - 30 - 23} work minutes between these two ChartTimes")

    test.done()
    
  testMinutesSpanDays: (test) ->
    spec = {
    	startOn: new ChartTime(granularity: 'minute', year: 2012, month:1, day: 17, hour: 12, minute: 0)
    	endBefore: new ChartTime(granularity: 'minute', year: 2012, month: 1, day: 18, hour: 12, minute: 0)
    }
    i2 = new ChartTimeIterator(spec)
    test.equal(i2.getAll().length, 1440)
    test.done()
    
  testMinutesSpanWeeks: (test) ->
    spec = {
    	startOn: new ChartTime(granularity: 'minute', year: 2012, month:1, day: 20, hour: 12, minute: 0)
    	endBefore: new ChartTime(granularity: 'minute', year: 2012, month: 1, day: 23, hour: 12, minute: 0)
    }
    i2 = new ChartTimeIterator(spec)
    test.equal(i2.getAll().length, 1440)
    test.done()    
  
  testMilliseconds: (test) ->
    spec = {
      startOn: new ChartTime(granularity: 'millisecond', year: 2011, month:1, day: 3, hour: 14, minute: 23, second: 45, millisecond: 900),
      endBefore: new ChartTime(granularity: 'millisecond', year: 2011, month:1, day:3, hour: 14, minute: 23, second: 46, millisecond: 5),
    }
    i2 = new ChartTimeIterator(spec)

    test.equal(i2.getAll().length, 105)
    test.done()  
 
  testQuarter: (test) ->
    spec = {
      startOn: new ChartTime({granularity: 'quarter', year: 2011, quarter:1}),
      endBefore: new ChartTime('2013Q3'),
    }
    i2 = new ChartTimeIterator(spec)

    test.equal(i2.getAll().length, 10, 'should be 10 quarters between these two ChartTimes')

    test.done()

  testDow: (test) ->
    spec = {
      startOn: new ChartTime('2008W52-3'),
      endBefore: new ChartTime(granularity: 'week_day', year: 2011, week: 3, week_day: 3),
      holidays: [
        {month: 12, day: 25},
        {month: 1, day: 1},
        {month: 7, day: 4},
        {year: 2011, month: 11, day: 24}  # Thanksgiving 2011
      ]
    }
    i2 = new ChartTimeIterator(spec)

    test.equal(i2.getAll().length, 107 * 5 + 3 + 2 - 4, "should be #{107*5 + 3 + 2 - 4} days between these two ChartTimes")

    test.done()
    
  testWeeks: (test) ->
    spec = {
      startOn: new ChartTime('2008W52'),
      endBefore: new ChartTime(granularity: 'week', year: 2011, week: 3),
    }
    i2 = new ChartTimeIterator(spec)

    test.equal(i2.getAll().length, 108, 'should be #{108} days between these two ChartTimes')

    test.done()
    
  testDaysSpanYears: (test) ->
    spec = {
       startOn: new ChartTime('2010-12-30'),
       endBefore: new ChartTime('2011-01-15')
    }
    i2 = new ChartTimeIterator(spec)
    test.equal(i2.getAll().length, 12)
    test.done()
    
  testWeeksSpanYears: (test) ->
    spec = {
       startOn: new ChartTime('2010-11-30').inGranularity('week'),  # Could just do new ChartTime('2010W48')
       endBefore: new ChartTime('2011-01-15').inGranularity('week') # '2011W02'
    }
    i2 = new ChartTimeIterator(spec)
    test.equal(i2.getAll().length, 6) # I think 6 is correct. Remember weeks start on Monday.
    test.done()   
   
  testDaysSpanMonths: (test) ->
    spec = {
     	startOn: new ChartTime('2011-01-15')
     	endBefore: new ChartTime('2011-02-15')
    }
    i2 = new ChartTimeIterator(spec)
    test.equal(i2.getAll().length, 21)
    test.done()
    
  testDaysSpanWeeks: (test) ->
    spec = {
    	startOn: new ChartTime('2011-05-05')
    	endBefore: new ChartTime('2011-05-25')
    }
    i2 = new ChartTimeIterator(spec)
    test.equal(i2.getAll().length, 14)
    test.done()
   
#    testMonthsSpanQuarters: (test) ->  # Commented out because month is not yet a sub-granularity to quarter. It stops at quarter right now. Maybe will upgrade later.
#      spec = {
#      	startOn: new ChartTime('2011-02-01'),
#      	endBefore: new ChartTime('2011-07-01')
#      }
#    	 i2 = new ChartTimeIterator(spec)
#    	 test.equal(i2.getAll().length, 6)
#    	 test.done()
   
   
   testQuartersSpanYears: (test) ->
     spec = {
     	startOn: new ChartTime('2011-10-01').inGranularity('quarter'),  # Could just do new ChartTime('2011Q3')
     	endBefore: new ChartTime('2012-04-01').inGranularity('quarter')
     }
     i2 = new ChartTimeIterator(spec)
     test.equal(i2.getAll().length, 2)
     test.done()  
     
  testThrows: (test) ->
    spec = {
      startOn:new ChartTime({granularity: 'day', year: 2011, month:1, day: 1}),
      endBefore:new ChartTime({granularity: 'day', year: 2011, month:1, day: 10}),
      workDays: 'Monday ,   Wednesday, Thursday ,Saturday',
      holidays: [
        {month: 12, day: 25},
        {month: 1, day: 1},
        {month: 7, day: 4},
        {year: 2011, month: 11, day: 24}  # Thanksgiving 2011
      ]
    }

    f = () ->
      i3 = new ChartTimeIterator(spec)

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