{ChartTime, ChartTimeIterator, ChartTimeRange} = require('../')
utils = require('../src/utils')

exports.ChartTimeRangeTest =
  testConstructor: (test) ->
  
    r = new ChartTimeRange({
      start:new ChartTime({granularity: 'day', year: 2011, month:1, day: 1}),
      pastEnd:new ChartTime({granularity: 'day', year: 2011, month:1, day: 7})
    })
    
    test.equal(r.start.year, 2011, 'start.year should be 2011')
    test.equal(r.pastEnd.day, 7, 'pastEnd.day should be 7')
    i2 = new ChartTimeRange({
      start:new ChartTime({granularity: 'day', year: 2011, month:1, day: 1}),
      pastEnd:new ChartTime({granularity: 'day', year: 2011, month:1, day: 3}),
      workDays: 'Monday ,Tuesday,Wednesday, Thursday,Saturday'
    })
    test.deepEqual(i2.workDays, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday'], 'workdays should be [M, T, W, Th, S]')

    test.done()
      
  testDefaults: (test) ->
    r = new ChartTimeRange({
      start:new ChartTime({granularity: 'day', year: 2011, month:1, day: 1}),
      pastEnd:new ChartTime({granularity: 'day', year: 2011, month:1, day: 7})
    })
    
    test.equal(r.skip, 1, 'Default skip should be 1')
    test.deepEqual(r.workDays, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], 'Default workdays should be [M, T, W, Th, F]')
    test.equal(r.holidays.length, 0, 'Default holidays should be length 0')
    test.ok(utils.isArray(r.holidays), 'Default holidays should be an array')
        
    test.done()
    
  testExample: (test) ->

    r = new ChartTimeRange({
      start:new ChartTime('2011-01-02'),
      pastEnd:new ChartTime('2011-01-07')
      holidays: [
        {month: 1, day: 1},  # Notice the lack of a year specification
        {year: 2011, month: 1, day: 5}  # Got January 5 off also in 2011
      ]
    })
    
    test.deepEqual(r.workDays, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])  # workDays already defaulted but you can override by r.workDays = ...
        
    i = r.getIterator('ChartTime')

    test.equal('2011-01-03', i.next())
    test.equal('2011-01-04', i.next())
    test.equal('2011-01-06', i.next())
    test.equal(i.hasNext(), false)
    
    r2 = new ChartTimeRange({
      start:new ChartTime('2011-01-02T00'),
      pastEnd:new ChartTime('2011-01-07T00'),
      startWorkTime: {hour: 9, minute: 0},
      pastEndWorkTime: {hour: 17, minute: 0}
    })
    
    test.equal(r2.contains(new ChartTime('2011-01-02T00')), true)  # start is inclusive
    test.equal(r2.contains(new ChartTime('2011-01-07T00')), false)  # pastEnd is exclusive
    
    
    # If you pass in a string without a timezone, it will assume that you are using the same timezone as the start/pastEnd
    test.equal(r2.contains('2011-01-06T23'), true) # but just before pastEnd is OK
    # But if you pass in a timezone, then it will shift the boundaries to that time zone and assume the 1st parameter is GMT
    # When it's 3am in GMT on 2011-01-02, it's still 2011-01-01 in New York
    test.equal(r2.contains('2011-01-02T03:00:00.000', 'America/New_York'), false)  # requires a tz if you pass in a string
    # But it's still 2011-01-06 in New York, when it's 3am in GMT on 2011-01-07
    test.equal(r2.contains('2011-01-07T03:00:00.000', 'America/New_York'), true)
    
    test.done()
    
  testSubRange: (test) ->
    r3 = new ChartTimeRange({
      start:new ChartTime('2011-01-06'),
      pastEnd:new ChartTime('2011-01-11'),
      startWorkTime: {hour: 9, minute: 0},
      pastEndWorkTime: {hour: 11, minute: 0}  # Very short work day for demo purposes
    })
        
    i3 = r3.getIterator('ChartTimeRange', 'hour')
    
    test.equal(r3.start, '2011-01-06')
    test.equal(r3.pastEnd, '2011-01-11')
    subRange = i3.next()
    test.equal(subRange.start, '2011-01-06T00')
    test.equal(subRange.pastEnd, '2011-01-07T00')
    subIterator = subRange.getIterator('ChartTime')
    test.equal(subIterator.next().hour, 9)
    test.equal(subIterator.next().hour, 10)
    test.equal(subIterator.hasNext(), false)
    subRange = i3.next()
    test.equal(subRange.start, '2011-01-07T00')
    test.equal(subRange.pastEnd, '2011-01-10T00')
    subIterator = subRange.getIterator('ChartTime')
    test.equal(subIterator.next().hour, 9)
    test.equal(subIterator.next().hour, 10)
    test.equal(subIterator.hasNext(), false)
    subRange = i3.next()
    test.equal(subRange.start, '2011-01-10T00')
    test.equal(subRange.pastEnd, '2011-01-11T00')
    subIterator = subRange.getIterator('ChartTime')
    test.equal(subIterator.next().hour, 9)
    test.equal(subIterator.next().hour, 10)
    test.equal(subIterator.hasNext(), false)
    test.equal(i3.hasNext(), false)
    
    test.done()
  
  testHourGranularity: (test) ->
    r4 = new ChartTimeRange({
      start:'2011-01-06T00',  # Notice how we include the hour now
      pastEnd:'2011-01-11T00',
      startWorkTime: {hour: 9, minute: 0},
      pastEndWorkTime: {hour: 11, minute: 0}  # Very short work day for demo purposes
    })
        
    i4 = r4.getIterator('ChartTime')
    
    test.equal('2011-01-06T09', i4.next())
    test.equal('2011-01-06T10', i4.next())
    test.equal('2011-01-07T09', i4.next())
    test.equal('2011-01-07T10', i4.next())
    test.equal('2011-01-10T09', i4.next())
    test.equal('2011-01-10T10', i4.next())
    test.equal(i4.hasNext(), false)
  
    test.done()