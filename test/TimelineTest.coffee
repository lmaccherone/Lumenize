{Time, TimelineIterator, Timeline} = require('../')
utils = require('../src/utils')

exports.TimelineTest =

  testConstructor: (test) ->
    r = new Timeline({
      startOn:new Time({granularity: 'day', year: 2011, month:1, day: 1}),
      endBefore:new Time({granularity: 'day', year: 2011, month:1, day: 7})
    })
    
    test.equal(r.startOn.year, 2011, 'startOn.year should be 2011')
    test.equal(r.endBefore.day, 7, 'endBefore.day should be 7')
    i2 = new Timeline({
      startOn:new Time({granularity: 'day', year: 2011, month:1, day: 1}),
      endBefore:new Time({granularity: 'day', year: 2011, month:1, day: 3}),
      workDays: 'Monday ,Tuesday,Wednesday, Thursday,Saturday'
    })
    test.deepEqual(i2.workDays, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday'], 'workdays should be [M, T, W, Th, S]')

    test.done()
      
  testDefaults: (test) ->
    r = new Timeline({
      startOn:new Time({granularity: 'day', year: 2011, month:1, day: 1}),
      endBefore:new Time({granularity: 'day', year: 2011, month:1, day: 7})
    })
    
    test.equal(r.step, 1, 'Default step should be 1')
    test.deepEqual(r.workDays, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], 'Default workdays should be [M, T, W, Th, F]')
    test.equal(r.holidays.length, 0, 'Default holidays should be length 0')
    test.ok(utils.isArray(r.holidays), 'Default holidays should be an array')
        
    test.done()
    
  testExample: (test) ->
    r = new Timeline({
      startOn:new Time('2011-01-02'),
      endBefore:new Time('2011-01-07')
      holidays: [
        {month: 1, day: 1},  # Notice the lack of a year specification
        {year: 2011, month: 1, day: 5}  # Got January 5 off also in 2011
      ]
    })
    
    test.deepEqual(r.workDays, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])  # workDays already defaulted but you can override by r.workDays = ...
        
    i = r.getIterator('Time')

    test.equal('2011-01-03', i.next())
    test.equal('2011-01-04', i.next())
    test.equal('2011-01-06', i.next())
    test.equal(i.hasNext(), false)
    
    r2 = new Timeline({
      startOn:new Time('2011-01-02T00'),
      endBefore:new Time('2011-01-07T00'),
      workDayStartOn: {hour: 9, minute: 0},
      workDayEndBefore: {hour: 17, minute: 0}
    })
    
    test.equal(r2.contains(new Time('2011-01-02T00')), true)  # startOn is inclusive
    test.equal(r2.contains(new Time('2011-01-07T00')), false)  # endBefore is exclusive
    
    
    # If you pass in a string without a timezone, it will assume that you are using the same timezone as the startOn/endBefore
    test.equal(r2.contains('2011-01-06T23'), true) # but just before endBefore is OK
    # But if you pass in a timezone, then it will shift the boundaries to that time zone and assume the 1st parameter is GMT
    # When it's 3am in GMT on 2011-01-02, it's still 2011-01-01 in New York
    test.equal(r2.contains('2011-01-02T03:00:00.000', 'America/New_York'), false)
    # But it's still 2011-01-06 in New York, when it's 3am in GMT on 2011-01-07
    test.equal(r2.contains('2011-01-07T03:00:00.000', 'America/New_York'), true)
    
    test.done()

  testTimeline: (test) ->
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

    tl2 = new Timeline(spec)

    all = tl2.getAllRaw()

    spec.step = -1
    tl2 = new Timeline(spec)
    test.deepEqual(tl2.getAllRaw(), all.reverse(), 'should be the same in reverse')

    all.reverse()
    delete spec.step
    endBefore = spec.endBefore
    delete spec.endBefore
    spec.limit = 4
    tl2 = new Timeline(spec)
    test.deepEqual(tl2.getAllRaw(), all, 'should be the same with limit')

    spec.endBefore = endBefore
    startOn = spec.startOn
    delete spec.startOn
    spec.limit = 4
    spec.step = -1
    tl2 = new Timeline(spec)
    test.deepEqual(tl2.getAllRaw(), all.reverse(), 'should be the same in reverse')

    test.done()

  testSubTimeline: (test) ->
    r3 = new Timeline({
      startOn:new Time('2011-01-06'),
      endBefore:new Time('2011-01-11'),
      workDayStartOn: {hour: 9, minute: 0},
      workDayEndBefore: {hour: 11, minute: 0}  # Very short work day for demo purposes
    })
        
    i3 = r3.getIterator('Timeline', undefined, 'hour')
    
    test.equal(r3.startOn, '2011-01-06')
    test.equal(r3.endBefore, '2011-01-11')
    subTimeline = i3.next()
    test.equal(subTimeline.startOn, '2011-01-06T00')
    test.equal(subTimeline.endBefore, '2011-01-07T00')
    subIterator = subTimeline.getIterator('Time')
    test.equal(subIterator.next().hour, 9)
    test.equal(subIterator.next().hour, 10)
    test.equal(subIterator.hasNext(), false)
    subTimeline = i3.next()
    test.equal(subTimeline.startOn, '2011-01-07T00')
    test.equal(subTimeline.endBefore, '2011-01-10T00')
    subIterator = subTimeline.getIterator('Time')
    test.equal(subIterator.next().hour, 9)
    test.equal(subIterator.next().hour, 10)
    test.equal(subIterator.hasNext(), false)
    subTimeline = i3.next()
    test.equal(subTimeline.startOn, '2011-01-10T00')
    test.equal(subTimeline.endBefore, '2011-01-11T00')
    subIterator = subTimeline.getIterator('Time')
    test.equal(subIterator.next().hour, 9)
    test.equal(subIterator.next().hour, 10)
    test.equal(subIterator.hasNext(), false)
    test.equal(i3.hasNext(), false)
    
    test.done()

  testTicksThatIntersect: (test) ->
    tl = new Timeline({
      startOn:'2011-01-06T00',
      endBefore:'2011-01-11T00',
      workDayStartOn: {hour: 9, minute: 0},
      workDayEndBefore: {hour: 11, minute: 0}  # Very short work day for test purposes
    })

    ticks = tl.ticksThatIntersect('2010-01-01T00:00:00.000Z', '2010-01-10T00:00:00.000Z', 'America/New_York')
    test.equal(0, ticks.length)

    ticks = tl.ticksThatIntersect('2012-01-01T00:00:00.000Z', '2012-01-10T00:00:00.000Z', 'America/New_York')
    test.equal(0, ticks.length)

    ticks = tl.ticksThatIntersect('2011-01-01T00:00:00.000Z', '2012-01-01T00:00:00.000Z', 'America/New_York')
    test.equal(6, ticks.length)

    ticks = tl.ticksThatIntersect('2011-01-07T00:00:00.000Z', '2012-01-01T00:00:00.000Z', 'America/New_York')
    test.equal(4, ticks.length)

    ticks = tl.ticksThatIntersect('2011-01-07T00:00:00.000Z', '2011-01-08T00:00:00.000Z', 'America/New_York')
    test.equal(2, ticks.length)

    ticks = tl.ticksThatIntersect(new Time('2010-01-01'), new Time('2010-01-10'))
    test.equal(0, ticks.length)

    ticks = tl.ticksThatIntersect(new Time('2012-01-01'), new Time('2012-01-10'))
    test.equal(0, ticks.length)

    ticks = tl.ticksThatIntersect(new Time('2011-01-01'), new Time('2012-01-01'))
    test.equal(6, ticks.length)

    ticks = tl.ticksThatIntersect(new Time('2011-01-07'), new Time('2012-01-01'))
    test.equal(4, ticks.length)

    ticks = tl.ticksThatIntersect(new Time('2011-01-07'), new Time('2011-01-08'))
    test.equal(2, ticks.length)

    test.done()

  testHourGranularity: (test) ->
    r4 = new Timeline({
      startOn:'2011-01-06T00',
      endBefore:'2011-01-11T00',
      workDayStartOn: {hour: 9, minute: 0},
      workDayEndBefore: {hour: 11, minute: 0}  # Very short work day for demo purposes
    })
        
    i4 = r4.getIterator('Time')
    
    test.equal('2011-01-06T09', i4.next())
    test.equal('2011-01-06T10', i4.next())
    test.equal('2011-01-07T09', i4.next())
    test.equal('2011-01-07T10', i4.next())
    test.equal('2011-01-10T09', i4.next())
    test.equal('2011-01-10T10', i4.next())
    test.equal(i4.hasNext(), false)
  
    test.done()

  testHours: (test) ->
    spec = {
      startOn: new Time({granularity: 'hour', year: 2011, month:1, day: 3, hour: 14}),
      endBefore: new Time('2011-01-04T22'),
      workDayStartOn: {hour: 9, minute: 0},
      workDayEndBefore: {hour: 17, minute: 0}
    }
    tl2 = new Timeline(spec)

    test.equal(tl2.getAllRaw().length, 11, 'should be 11 work hours between these two Times')

    test.done()

  testHoursNightShift: (test) ->
    spec = {
      startOn: new Time({granularity: 'hour', year: 2011, month:1, day: 3, hour: 20}),
      endBefore: new Time(granularity: 'hour', hour: 8, year:2011, month:1, day:4)
      workDayStartOn: {hour: 23, minute: 0},
      workDayEndBefore: {hour: 8, minute:0}
    }
    tl2 = new Timeline(spec)
    test.equal(tl2.getAllRaw().length, 8, 'should be 8 work hours from 11pm til 7am')

    test.done()

  testHoursSpanDays: (test) ->
    spec = {
      startOn: new Time({granularity: 'hour', year: 2011, month:1, day: 3, hour: 7}),
      endBefore: new Time(granularity: 'hour', year:2011, month:1, day:4, hour: 23)
      workDayStartOn: {hour: 8, minute: 0},
      workDayEndBefore: {hour: 18, minute:0}
    }
    tl2 = new Timeline(spec)
    test.equal(tl2.getAllRaw().length, 20, 'should be 20 work hours')

    test.done()

  testHoursSpanWeeks: (test) ->
    spec = {
      startOn: new Time(granularity:'hour', year: 2011, month: 12, day: 30, hour: 1),
      endBefore: new Time(granularity: 'hour', year: 2012, month: 1, day: 3, hour: 1)
    }
    tl2 = new Timeline(spec)
    test.equal(tl2.getAllRaw().length, 48)
    test.done()

  testWorkHours: (test) ->
    spec = {
      startOn: new Time(granularity: 'hour', year: 2012, month: 2, day: 1, hour: 5),
      endBefore: new Time(granularity: 'hour', year: 2012, month: 2, day: 5, hour: 23)
      workDayStartOn: {hour: 10, minute: 30}
      workDayEndBefore: {hour: 12, minute: 30}
    }
    tl2 = new Timeline(spec)
    test.equal(tl2.getAllRaw().length, 6)
    test.done()

  testMinutes: (test) ->
    spec = {
      startOn: new Time({granularity: 'minute', year: 2011, month:1, day: 3, hour: 14, minute: 23}),
      endBefore: new Time('2011-01-04T22:23'),
      workDayStartOn: {hour: 9, minute: 30},
      workDayEndBefore: {hour: 17, minute: 15}
    }
    tl2 = new Timeline(spec)

    test.equal(tl2.getAllRaw().length, 11*60 + 2*15 - 30 - 23, "should be #{11*60 + 2*15 - 30 - 23} work minutes between these two Times")

    test.done()

  testMinutesSpanDays: (test) ->
    spec = {
    	startOn: new Time(granularity: 'minute', year: 2012, month:1, day: 17, hour: 12, minute: 0)
    	endBefore: new Time(granularity: 'minute', year: 2012, month: 1, day: 18, hour: 12, minute: 0)
    }
    tl2 = new Timeline(spec)
    test.equal(tl2.getAllRaw().length, 1440)
    test.done()

  testMinutesSpanWeeks: (test) ->
    spec = {
    	startOn: new Time(granularity: 'minute', year: 2012, month:1, day: 20, hour: 12, minute: 0)
    	endBefore: new Time(granularity: 'minute', year: 2012, month: 1, day: 23, hour: 12, minute: 0)
    }
    tl2 = new Timeline(spec)
    test.equal(tl2.getAllRaw().length, 1440)
    test.done()

  testMilliseconds: (test) ->
    spec = {
      startOn: new Time(granularity: 'millisecond', year: 2011, month:1, day: 3, hour: 14, minute: 23, second: 45, millisecond: 900),
      endBefore: new Time(granularity: 'millisecond', year: 2011, month:1, day:3, hour: 14, minute: 23, second: 46, millisecond: 5),
    }
    tl2 = new Timeline(spec)

    test.equal(tl2.getAllRaw().length, 105)
    test.done()

  testQuarter: (test) ->
    spec = {
      startOn: new Time({granularity: 'quarter', year: 2011, quarter:1}),
      endBefore: new Time('2013Q3'),
    }
    tl2 = new Timeline(spec)

    test.equal(tl2.getAllRaw().length, 10, 'should be 10 quarters between these two Times')

    test.done()

  testDow: (test) ->
    spec = {
      startOn: new Time('2008W52-3'),
      endBefore: new Time(granularity: 'week_day', year: 2011, week: 3, week_day: 3),
      holidays: [
        {month: 12, day: 25},
        {month: 1, day: 1},
        {month: 7, day: 4},
        {year: 2011, month: 11, day: 24}  # Thanksgiving 2011
      ]
    }
    tl2 = new Timeline(spec)

    test.equal(tl2.getAllRaw().length, 107 * 5 + 3 + 2 - 4, "should be #{107*5 + 3 + 2 - 4} days between these two Times")

    test.done()

  testWeeks: (test) ->
    spec = {
      startOn: new Time('2008W52'),
      endBefore: new Time(granularity: 'week', year: 2011, week: 3),
    }
    tl2 = new Timeline(spec)

    test.equal(tl2.getAllRaw().length, 108, 'should be #{108} days between these two Times')

    test.done()

  testDaysSpanYears: (test) ->
    spec = {
       startOn: new Time('2010-12-30'),
       endBefore: new Time('2011-01-15')
    }
    tl2 = new Timeline(spec)
    test.equal(tl2.getAllRaw().length, 12)
    test.done()

  testWeeksSpanYears: (test) ->
    spec = {
       startOn: new Time('2010-11-30').inGranularity('week'),  # Could just do new Time('2010W48')
       endBefore: new Time('2011-01-15').inGranularity('week') # '2011W02'
    }
    tl2 = new Timeline(spec)
    test.equal(tl2.getAllRaw().length, 6) # I think 6 is correct. Remember weeks start on Monday.
    test.done()

  testDaysSpanMonths: (test) ->
    spec = {
     	startOn: new Time('2011-01-15')
     	endBefore: new Time('2011-02-15')
    }
    tl2 = new Timeline(spec)
    test.equal(tl2.getAllRaw().length, 21)
    test.done()

  testDaysSpanWeeks: (test) ->
    spec = {
    	startOn: new Time('2011-05-05')
    	endBefore: new Time('2011-05-25')
    }
    tl2 = new Timeline(spec)
    test.equal(tl2.getAllRaw().length, 14)
    test.done()

#    testMonthsSpanQuarters: (test) ->  # Commented out because month is not yet a sub-granularity to quarter. It stops at quarter right now. Maybe will upgrade later.
#      spec = {
#      	startOn: new Time('2011-02-01'),
#      	endBefore: new Time('2011-07-01')
#      }
#    	 tl2 = new Timeline(spec)
#    	 test.equal(tl2.getAllRaw().length, 6)
#    	 test.done()

  testQuartersSpanYears: (test) ->
   spec = {
    startOn: new Time('2011-10-01').inGranularity('quarter'),  # Could just do new Time('2011Q3')
    endBefore: new Time('2012-04-01').inGranularity('quarter')
   }
   tl2 = new Timeline(spec)
   test.equal(tl2.getAllRaw().length, 2)
   test.done()
