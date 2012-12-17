{Time} = require("../")
utils = require('../src/utils')

exports.TimeTest =
  testConstruction: (test) ->
    test.expect(4)
    temp = new Time({granularity: Time.DAY, year:2011, month:10, day:27})
    test.equal(temp.year, 2011, 'year should be 2011')
    test.equal(temp.month, 10, 'month should be 10')
    test.equal(temp.day, 27, 'day should be 27')
    test.equal(temp.toString(), '2011-10-27')
    test.done()

  testConstructionString: (test) ->
    test.expect(4)
    temp = new Time('2011-10-27')
    test.equal(temp.year, 2011, 'year should be 2011')
    test.equal(temp.month, 10, 'month should be 10')
    test.equal(temp.day, 27, 'day should be 27')
    test.equal(temp.toString(), '2011-10-27')
    test.done()
    
  testConstructionDate: (test) ->
    jsDate = new Date('2011-01-01T12:34:56.789Z')
    temp = new Time(jsDate, Time.MILLISECOND, 'America/Denver')
    temp2 = new Time(jsDate, Time.MILLISECOND, 'America/New_York')
    temp.addInPlace(2, Time.HOUR)
    test.equal(temp.toString(), temp2.toString())
    test.done()
 
  testHour: (test) ->
    d = new Time(granularity: Time.HOUR, year: 2011, month:11, day:20, hour:9).hour
    test.equal(d, '9')
    d = new Time(granularity: Time.HOUR, year: 2012, month: 6, day: 15, hour: 23).hour
    test.equal(d, '23')
    
    f = () ->
      d = new Time(granularity: Time.HOUR, year: 2013, month: 5, day: 1, hour: 27) #this hour is greater than 24, but no error is thrown
      console.log('inside testHour')
      console.log(d)
    test.throws(f, Error)
    test.done()  
    
  testDOW: (test) ->
    d = new Time({granularity: Time.DAY, year:2011, month:11, day:20}).dowString()
    test.equal(d, 'Sunday', '2011-11-20 is a Sunday')

    d = new Time({granularity: Time.DAY, year:1783, month:9, day:18}).dowString()
    test.equal(d, 'Thursday', '1783-09-18 is a Thursday')

    d = new Time({granularity: Time.DAY, year:1676, month:2, day:23}).dowString()
    d2 = new Date(1676, 2-1, 23)
    test.equal(d, Time.DOW_N_TO_S_MAP[d2.getDay()], '1676-02-23 is a ' + d2)

    d = new Time({granularity: Time.DAY, year:2012, month:2, day:29}).dowString()
    test.equal(d, 'Wednesday', '2012-02-29 is a Wednesday')

    d = new Time({granularity: Time.DAY, year:2011, month:12, day:31}).dowString()
    test.equal(d, 'Saturday', '2011-12-31 is a Saturday')

    d = new Time({granularity: Time.DAY, year:2012, month:1, day:1}).dowString()
    test.equal(d, 'Sunday', '2012-01-01 is a Sunday')

    test.done()
    
  testDOWString: (test) ->
    d = new Time('2012-01-01')
    test.equal(d.dowString(), 'Sunday', '2012-01-01 is a Sunday')
    d = new Time('2011-11-20')
    test.equal(d.dowString(), 'Sunday', '2012-11-20 is a Sunday')
    
    test.done()
 
  testOverflow: (test) -> 
    d = new Time('0001-01-01')
    d.decrement()
    test.equal(d, 'BEFORE_FIRST')
    
    d = new Time('9999-12-31')
    d.increment()
    test.equal(d, 'PAST_LAST')
    
    test.done()
    
  testBadString: (test) ->
    f = () ->
      d = new Time('99999-01-01') #this should throw a parsing error
    test.throws(f, Error, 'should throw parsing error')    
    
    test.done() 
  
  testDaysInMonth: (test) ->
    d = new Time({granularity: Time.DAY, year: 2011, month: 1, day: 1})
    test.equal(d.daysInMonth(), 31, 'January has 31 days')
    
    d = new Time({granularity: Time.DAY, year: 2000, month: 2, day: 1})
    test.equal(d.daysInMonth(), 29, 'Feb-2000 has 29 days')
    
    d = new Time({granularity: Time.DAY, year: 1900, month: 2, day: 1})
    test.equal(d.daysInMonth(), 28, 'Feb-1900 has 28 days')
    
    d = new Time({granularity: Time.DAY, year: 2012, month: 2, day: 1})
    test.equal(d.daysInMonth(), 29, 'Feb-2012 has 29 days')
    
    d = new Time({granularity: Time.DAY, year: 2011, month: 2, day: 1})
    test.equal(d.daysInMonth(), 28, 'Feb-2011 has 28 days')

    test.done()
    
  testDaysInMonthString: (test) ->
    d = new Time('2012-02-15')
    test.equal(d.daysInMonth(), 29, 'February 2012 has 29 days')
    
    test.done() 
    
  test53WeekYear: (test) ->
    d = new Time('2014-01-01')
    test.equal(d.is53WeekYear(), false)  # Jen, you were missing the parens at the end of d.is53WeekYear(). I make that mistake all the time.
    d = new Time('2015-01-01')
    test.equal(d.is53WeekYear(), true)
    test.done()

  testInequalities: (test) ->
    d1 = new Time({granularity: Time.DAY, year: 2011, month: 2, day: 1})
    d2 = new Time({granularity: Time.DAY, year: 2011, month: 2, day: 1})
    d3 = new Time({granularity: Time.DAY, year: 2011, month: 12, day: 31})
    d4 = new Time({granularity: Time.HOUR, year: 2011, month: 12, day: 31, hour: 22})
    test.ok(d1.equal(d2), '' + d1 + ' equals ' + d2)
    test.ok(d1.lessThanOrEqual(d2), '' + d1 + ' lte ' + d2)
    test.ok(d1.greaterThanOrEqual(d2), '' + d1 + ' gte ' + d2)
    test.ok(d1.lessThanOrEqual(d3), '' + d1 + ' lte ' + d3)
    test.ok(d3.greaterThanOrEqual(d1), '' + d3 + ' gte ' + d1)
    test.equal(d1.lessThan(d2), false, '' + d1 + ' is not lt ' + d2)
    test.equal(d1.greaterThan(d2), false, '' + d1 + ' is not gt ' + d2)
    test.ok(d1.lessThan(d3), '' + d1 + ' lt ' + d3)

    f = () ->
      d3.equal(d4)
    test.throws(f, utils.AssertException, '' + d3 + ' does not have the same granularity as ' + d4)

    test.done()

  testIncrement: (test) ->
    d1 = new Time({granularity: Time.DAY, year: 2004, month: 2, day: 28})
    d2 = new Time({granularity: Time.DAY, year: 2004, month: 2, day: 29})
    d1.increment()
    test.ok(d1.equal(d2), '' + d1 + ' should equal ' + d2)

    d1 = new Time({granularity: Time.DAY, year: 2100, month: 2, day: 28})
    d2 = new Time({granularity: Time.DAY, year: 2100, month: 3, day: 1})
    d1.increment()
    test.ok(d1.equal(d2), '' + d1 + ' should equal ' + d2)

    d1 = new Time({granularity: Time.DAY, year: 2011, month: 2, day: 28})
    d2 = new Time({granularity: Time.DAY, year: 2011, month: 3, day: 1})
    d1.increment()
    test.ok(d1.equal(d2), '' + d1 + ' should equal ' + d2)

    d1 = new Time({granularity: Time.MILLISECOND, year: 999, month: 12, day: 31, hour: 23, minute: 59, second: 59, millisecond: 999})
    test.equal(d1.toString(), '0999-12-31T23:59:59.999')
    d2 = new Time({granularity: Time.MILLISECOND, year: 1000, month: 1, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0})
    d1.increment()
    test.ok(d1.equal(d2), '' + d1 + ' should equal ' + d2)
    test.equal(d2.toString(), '1000-01-01T00:00:00.000')

    test.done()

  testDecrement: (test) ->
    d2 = new Time({granularity: Time.DAY, year: 2004, month: 2, day: 28})
    d1 = new Time({granularity: Time.DAY, year: 2004, month: 2, day: 29})
    d1.decrement()
    test.ok(d1.equal(d2), '' + d1 + ' should equal ' + d2)

    d2 = new Time({granularity: Time.DAY, year: 2100, month: 2, day: 28})
    d1 = new Time({granularity: Time.DAY, year: 2100, month: 3, day: 1})
    d1.decrement()
    test.ok(d1.equal(d2), '' + d1 + ' should equal ' + d2)

    d2 = new Time({granularity: Time.DAY, year: 2011, month: 2, day: 28})
    d1 = new Time({granularity: Time.DAY, year: 2011, month: 3, day: 1})
    d1.decrement()
    test.ok(d1.equal(d2), '' + d1 + ' should equal ' + d2)

    d2 = new Time({granularity: Time.MILLISECOND, year: 999, month: 12, day: 31, hour: 23, minute: 59, second: 59, millisecond: 999})
    d1 = new Time({granularity: Time.MILLISECOND, year: 1000, month: 1, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0})
    d1.decrement()
    test.ok(d1.equal(d2), '' + d1 + ' should equal ' + d2)

    test.done()

  testAdd: (test) ->
    d1 = new Time({granularity: Time.DAY, year: 2004, month: 2, day: 27})
    d2 = new Time({granularity: Time.DAY, year: 2004, month: 2, day: 29})
    d3 = d1.add(2)
    test.ok(d3.equal(d2), '' + d3 + ' should equal ' + d2)

    d1 = new Time({granularity: Time.DAY, year: 2004, month: 2, day: 27})
    d2 = new Time({granularity: Time.DAY, year: 2004, month: 3, day: 1})
    d3 = d1.add(3)
    test.ok(d3.equal(d2), '' + d3 + ' should equal ' + d2)

    d1 = new Time({granularity: Time.DAY, year: 2011, month: 12, day: 10})
    d2 = new Time({granularity: Time.DAY, year: 2012, month: 1, day: 10})
    d3 = d1.add(31)
    test.ok(d3.equal(d2), '' + d3 + ' should equal ' + d2)

    d1 = new Time({granularity: Time.DAY, year: 2004, month: 2, day: 29})
    d2 = new Time({granularity: Time.DAY, year: 2004, month: 3, day: 31})
    d3 = d1.add(1, Time.MONTH)
    test.ok(d3.equal(d2), '' + d3 + ' should equal ' + d2)

    d1 = new Time({granularity: Time.DAY, year: 2004, month: 2, day: 29})
    d2 = new Time({granularity: Time.DAY, year: 2005, month: 2, day: 28})
    d3 = d1.add(1, Time.YEAR)
    test.ok(d3.equal(d2), '' + d3 + ' should equal ' + d2)

    d1 = new Time({granularity: Time.DAY, year: 2003, month: 12, day: 31})
    d2 = new Time({granularity: Time.DAY, year: 2004, month: 3, day: 31})
    d3 = d1.add(3, Time.MONTH)
    test.ok(d3.equal(d2), '' + d3 + ' should equal ' + d2)

    test.done()
    
  testWeek: (test) ->
    testObj = {
      '2005-01-01': '2004W53-6',
      '2005-01-02': '2004W53-7',
      '2005-12-31': '2005W52-6',
      '2007-01-01': '2007W01-1', # (both years 2007 start with the same day)
      '2007-12-30': '2007W52-7',
      '2007-12-31': '2008W01-1',
      '2008-01-01': '2008W01-2', # (Gregorian year 2008 is a leap year, ISO year 2008 is 2 days shorter: 1 day longer at the start, 3 days shorter at the end)
      '2008-12-29': '2009W01-1',
      '2008-12-31': '2009W01-3',
      '2009-01-01': '2009W01-4',
      '2009-12-31': '2009W53-4', # (ISO year 2009 has 53 weeks, extending the Gregorian year 2009, which starts and ends with Thursday, at both ends with three days)
      '2010-01-03': '2009W53-7'
    }
    for day, week_day of testObj
      test.equal(new Time(day).inGranularity('week_day'), week_day, "#{day} should be #{week_day}")
      test.equal(new Time(week_day).inGranularity(Time.DAY), day, "#{week_day} should be #{day}")

    test.done()

  testQuarter: (test) ->
    testObj = {
      '2005-01-01': '2005Q1',
      '2005-01-02': '2005Q1',
      '2005-12-31': '2005Q4',
      '2007-02-28': '2007Q1',
      '2008-02-29': '2008Q1',
      '2009-02-28': '2009Q1',
      '2010-02-28': '2010Q1', 
      '2008-06-30': '2008Q2',
      '2008-09-30': '2008Q3',
      '2007-12-31': '2007Q4',
      '2008-12-31': '2008Q4', 
      '2010-12-31': '2010Q4'
    }
    for day, quarter of testObj
      test.equal(new Time(day).inGranularity(Time.QUARTER), quarter, "#{day} should be #{quarter}")
   
    testObj = {
      '2009Q1': '2009-01-01',
      '2010Q2': '2010-04-01',
      '2011Q3': '2011-07-01',
      '2012Q4': '2012-10-01'
    } 
    for quarter, day of testObj
      test.equal(new Time(quarter).inGranularity(Time.DAY), day, "#{quarter} should be #{day}")
      
    test.done()
    
  testBeforePast: (test) ->
    pastLast = new Time('PAST_LAST', Time.DAY)
    beforeFirst = new Time('BEFORE_FIRST', Time.DAY)
    someday = new Time('2011-01-01')
    test.ok(pastLast.equal(pastLast))
    test.ok(beforeFirst.equal(beforeFirst))
    test.ok(pastLast.greaterThan(beforeFirst))
    test.ok(beforeFirst.lessThan(pastLast))
    test.ok(pastLast.greaterThanOrEqual(beforeFirst))
    test.ok(beforeFirst.lessThanOrEqual(pastLast))
    test.ok(pastLast.greaterThan(someday))
    test.ok(beforeFirst.lessThanOrEqual(someday))
    test.equal(pastLast.lessThan(someday), false)
    test.equal(pastLast.greaterThan(pastLast), false)
    test.equal(pastLast.lessThan(pastLast), false)
    
    test.done()
    
  testMathOnPastLast: (test) ->
    d = new Time('PAST_LAST', Time.DAY)
    d.addInPlace(-1)
    test.equal(d, '9999-12-31')
    
    d = new Time('PAST_LAST', Time.DAY)
    d.addInPlace(-3)
    test.equal(d, '9999-12-29')
    
    d = new Time('PAST_LAST', Time.DAY)
    d.decrement()
    test.equal(d, '9999-12-31')
    
    d = new Time('PAST_LAST', Time.DAY)
    d2 = d.add(-1)
    test.equal(d2, '9999-12-31')
    
    d = new Time('PAST_LAST', Time.MONTH)
    d.decrement()
    test.equal(d, '9999-12')
    
    d = new Time('PAST_LAST', Time.YEAR)
    d.decrement()
    test.equal(d, '9999')
    
    d = new Time('PAST_LAST', Time.YEAR)
    d.increment()
    test.equal(d, 'PAST_LAST')
        
    d = new Time('PAST_LAST', Time.MONTH)
    d.increment()
    test.equal(d, 'PAST_LAST')
        
    d = new Time('PAST_LAST', Time.DAY)
    d.increment()
    test.equal(d, 'PAST_LAST')
        
    test.done()
    
  testMathOnBeforeFirst: (test) ->
    d = new Time('BEFORE_FIRST', Time.DAY)
    d.addInPlace(1)
    test.equal(d, '0001-01-01')
    
    d = new Time('BEFORE_FIRST', Time.DAY)
    d.addInPlace(3)
    test.equal(d, '0001-01-03')
    
    d = new Time('BEFORE_FIRST', Time.DAY)
    d.increment()
    test.equal(d, '0001-01-01')
    
    d = new Time('BEFORE_FIRST', Time.DAY)
    d2 = d.add(1)
    test.equal(d2, '0001-01-01')
    
    d = new Time('BEFORE_FIRST', Time.MONTH)
    d.increment()
    test.equal(d, '0001-01')
    
    d = new Time('BEFORE_FIRST', Time.YEAR)
    d.increment()
    test.equal(d, '0001')
    
    d = new Time('BEFORE_FIRST', Time.YEAR)
    d.decrement()
    test.equal(d, 'BEFORE_FIRST')
        
    d = new Time('BEFORE_FIRST', Time.MONTH)
    d.decrement()
    test.equal(d, 'BEFORE_FIRST')
        
    d = new Time('BEFORE_FIRST', Time.DAY)
    d.decrement()
    test.equal(d, 'BEFORE_FIRST')
        
    test.done()
    
  testWrapping: (test) ->
    d = new Time('2010-01-01T24:00:00.000')  # This is valid according to ISO-6801 so it must wrap
    test.equal(d, '2010-01-02T00:00:00.000')
    
    d = new Time('2010-01-32')  # Because of the above requirement Time supports overflows of 1 for any granularity
    test.equal(d, '2010-02-01')
    
    d = new Time('2010-01-00')  # Supports underflows of 1 also
    test.equal(d, '2009-12-31')
    
    f = () ->  # But fails if you over/underflow by more than 1
      d = new Time('2010-01-45')
    test.throws(f, Error)

    d = new Time('2010-01-01')
    d.addInPlace(-1)
    test.equal(d, '2009-12-31')

    d = new Time('2010-01-01')
    d.addInPlace(-31)
    test.equal(d, '2009-12-01')
    
    d = new Time('2010-01-01')
    d.addInPlace(-32)
    test.equal(d, '2009-11-30')
    
    test.done()
    
  testGetSegmentsAsObject: (test) ->
    ct = new Time('2011-01-10')
    test.deepEqual(ct.getSegmentsAsObject(), {year: 2011, month:1, day: 10})

    ct = new Time('2011-01-10T03:06:45.789')
    expected =
      year: 2011
      month: 1
      day: 10
      hour: 3
      minute: 6
      second: 45
      millisecond: 789
    test.deepEqual(ct.getSegmentsAsObject(), expected)
    
    test.done()
    
  testSetThisNextPrevious: (test) ->
    ct = new Time('this day')
    test.equal(ct.granularity, Time.DAY)
    ctNext = new Time('next day')
    test.deepEqual(ct.increment(), ctNext)
    ctPrevious = new Time('previous day')
    test.deepEqual(ct.decrement().decrement(), ctPrevious)

    ct = new Time('this minute')
    test.equal(ct.granularity, Time.MINUTE)
    ct = new Time('this quarter')
    test.equal(ct.granularity, Time.QUARTER)
    
    ct = new Time('this day in America/Denver')
    test.equal(ct.granularity, Time.DAY)
    
    # I really don't know how to test this other than to assure that the above don't fail
    test.done()

  testRDN: (test) ->
    dateString = '1970-01-01'
    rdn = new Time(dateString).rataDieNumber()
    fromRDN = new Time(rdn, Time.DAY)
    test.equal(dateString, fromRDN)

    test.done()
    