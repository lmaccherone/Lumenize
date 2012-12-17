{Time, Timeline, utils} = require('../')


# !TODO: Needs more testing of step functionality

exports.timelineTest =

  testDay: (test) ->

    spec = {
      startOn:'2012-08-31',
      limit: 10,
      workDays: 'Monday, Tuesday, Wednesday, Thursday, Friday',
      holidays: [
        {month: 12, day: 25},
        {month: 1, day: 1},
        '2012-09-03'
      ]
    }
    timeline = new Timeline(spec).getAll()
    s = (t.toString() for t in timeline)
    expected = [ 
      '2012-08-31',
      '2012-09-04',
      '2012-09-05',
      '2012-09-06',
      '2012-09-07',
      '2012-09-10',
      '2012-09-11',
      '2012-09-12',
      '2012-09-13',
      '2012-09-14' 
    ]
    test.deepEqual(expected, s)    
    
    test.done()

  testQuarter: (test) ->

    spec = {
      startOn:'2012Q2',
      limit: 4,
    }
    timeline = new Timeline(spec).getAll()
    s = (t.toString() for t in timeline)
    expected = [ 
      '2012Q2'
      '2012Q3'
      '2012Q4'
      '2013Q1'
    ]
    test.deepEqual(expected, s)    
    
    test.done()
    
  testMonth: (test) ->

    spec = {
      startOn:'2012-11',
      endBefore: '2013-03',
    }
    timeline = new Timeline(spec).getAll()
    s = (t.toString() for t in timeline)
    expected = [ 
      '2012-11'
      '2012-12'
      '2013-01'
      '2013-02'
    ]
    test.deepEqual(expected, s)    
    
    test.done()
    
  testMixedGranularity: (test) ->
  
    spec = {
      endBefore:'2012W38',
      limit: 10,
      granularity: 'day',
      workDays: 'Monday, Tuesday, Wednesday, Thursday, Friday',
      holidays: [
        {month: 12, day: 25},
        {month: 1, day: 1},
        '2012-09-03'
      ]
    }
    timeline = new Timeline(spec).getAll()
    s = (t.toString() for t in timeline)
    expected = [ 
      '2012-08-31',
      '2012-09-04',
      '2012-09-05',
      '2012-09-06',
      '2012-09-07',
      '2012-09-10',
      '2012-09-11',
      '2012-09-12',
      '2012-09-13',
      '2012-09-14' 
    ]
    test.deepEqual(expected, s)
    
    spec.endBefore = '2012-09-15'
    timeline = new Timeline(spec).getAll()
    s = (t.toString() for t in timeline)
    test.deepEqual(expected, s)
    
    spec.startOn = '2012-08-31'
    delete spec.limit
    s = (t.toString() for t in timeline)
    test.deepEqual(expected, s)
    
    spec.limit = 10
    delete spec.endBefore
    s = (t.toString() for t in timeline)
    test.deepEqual(expected, s)
    
    test.done()

  testHours: (test) ->
  
    spec = {
      endBefore:'2012-09-05',
      limit: 10,
      granularity: 'hour',
      workDays: 'Monday, Tuesday, Wednesday, Thursday, Friday',
      workDayStartOn: {hour: 9, minute:0},
      workDayEndBefore: {hour:11, minute:0},
      holidays: [
        {month: 12, day: 25},
        {month: 1, day: 1},
        '2012-09-03'
      ]
    }
    timeline = new Timeline(spec).getAll()
    s = (t.toString() for t in timeline)
    
    expected = [ 
      '2012-08-28T09',
      '2012-08-28T10',
      '2012-08-29T09',
      '2012-08-29T10',
      '2012-08-30T09',
      '2012-08-30T10',
      '2012-08-31T09',
      '2012-08-31T10',
      '2012-09-04T09',
      '2012-09-04T10' 
    ]
    test.deepEqual(expected, s)

    test.done()

  testSinglePointTimeline: (test) ->
    r5 = new Timeline({
      startOn:'2011-01-06T00',
      endBefore:'2011-01-07T00',
      workDayStartOn: {hour: 9, minute: 0},
      workDayEndBefore: {hour: 10, minute: 0}
    })

    test.deepEqual([{
      beforePastFlag: '',
      granularity: 'hour',
      year: 2011,
      month: 1,
      day: 6,
      hour: 9
    }], r5.getAll())

    test.done()