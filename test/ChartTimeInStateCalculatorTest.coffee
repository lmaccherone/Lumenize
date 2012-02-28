charttime = require('../')
{ChartTimeRange, ChartTime, ChartTimeIterator, ChartTimeInStateCalculator} = charttime
ChartTime.setTZPath('../vendor/tz')

exports.ChartTimeInStateCalculatorTest =

  testBasic: (test) ->
    
    snapshots = [ 
      { id: 1, from: '2011-01-06T15:10:00.000Z', to: '2011-01-06T15:30:00.000Z' }, # 20 minutes all within an hour
      { id: 2, from: '2011-01-06T15:50:00.000Z', to: '2011-01-06T16:10:00.000Z' }, # 20 minutes spanning an hour
      { id: 3, from: '2011-01-07T13:00:00.000Z', to: '2011-01-07T15:20:00.000Z' }, # start 2 hours before but overlap by 20 minutes of start
      { id: 4, from: '2011-01-06T16:40:00.000Z', to: '2011-01-06T19:00:00.000Z' }, # 20 minutes before end of day
      { id: 5, from: '2011-01-06T16:50:00.000Z', to: '2011-01-07T15:10:00.000Z' }, # 10 minutes before end of one day and 10 before the start of next
      { id: 6, from: '2011-01-06T16:55:00.000Z', to: '2011-01-07T15:05:00.000Z' }, # multiple cycles over several days for a total of 20 minutes of work time
      { id: 6, from: '2011-01-07T16:55:00.000Z', to: '2011-01-10T15:05:00.000Z' }, 
      { id: 7, from: '2011-01-06T16:40:00.000Z', to: '2011-01-20T19:00:00.000Z' }  # false beyond scope of iterator
    ]
    
    granularity = 'minute'
    timezone = 'America/Chicago'
    
    rangeSpec = 
      granularity: granularity
      start: new ChartTime(snapshots[0].from, granularity, timezone).decrement()
      pastEnd: '2011-01-11T00:00:00.000'
      startWorkTime: {hour: 9, minute: 0}  # 15:00 in Chicago
      pastEndWorkTime: {hour: 11, minute: 0}  # 17:00 in Chicago.
    
    r1 = new ChartTimeRange(rangeSpec)
    i1 = r1.getIterator('ChartTime')
    isc1 = i1.getChartTimeInStateCalculator(timezone)
    timeInState = isc1.timeInState(snapshots, 'from', 'to', 'id')
    
    expected = [
      { id: 1, ticks: 20, finalState: false, finalEventAt: '2011-01-06T15:30:00.000Z', finalTickAt: '2011-01-06T15:29:00.000Z' },
      { id: 2, ticks: 20, finalState: false, finalEventAt: '2011-01-06T16:10:00.000Z', finalTickAt: '2011-01-06T16:09:00.000Z' },
      { id: 3, ticks: 20, finalState: false, finalEventAt: '2011-01-07T15:20:00.000Z', finalTickAt: '2011-01-07T15:19:00.000Z' },
      { id: 4, ticks: 20, finalState: false, finalEventAt: '2011-01-06T19:00:00.000Z', finalTickAt: '2011-01-06T16:59:00.000Z' },
      { id: 5, ticks: 20, finalState: false, finalEventAt: '2011-01-07T15:10:00.000Z', finalTickAt: '2011-01-07T15:09:00.000Z' },
      { id: 6, ticks: 20, finalState: false, finalEventAt: '2011-01-10T15:05:00.000Z', finalTickAt: '2011-01-10T15:04:00.000Z' } 
    ]

    test.deepEqual(expected, timeInState)
        
    # The default supresses the ones that are still open at the end, but we can override that
    snapshots = [snapshots[7]]
    timeInState = isc1.timeInState(snapshots, 'from', 'to', 'id', false)
    test.equal(timeInState[0].ticks, 260)
    
    # We can adjust the granularity
    rangeSpec.granularity = 'hour'
    isc2 = new ChartTimeRange(rangeSpec).getIterator().getChartTimeInStateCalculator(timezone)
    timeInState = isc2.timeInState(snapshots, 'from', 'to', 'id', false)
    test.equal(timeInState[0].ticks, 4)
    
    test.done()