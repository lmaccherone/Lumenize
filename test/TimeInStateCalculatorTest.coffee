lumenize = require('../')
{TimeInStateCalculator} = lumenize

exports.TimeInStateCalculatorTest =

  testBasic: (test) ->
    
    snapshots = [ 
      { id: 1, from: '2011-01-06T15:10:00.000Z', to: '2011-01-06T15:30:00.000Z' }, # 20 minutes all within an hour
      { id: 2, from: '2011-01-06T15:50:00.000Z', to: '2011-01-06T16:10:00.000Z' }, # 20 minutes spanning an hour
      { id: 3, from: '2011-01-07T13:00:00.000Z', to: '2011-01-07T15:20:00.000Z' }, # start 2 hours before but overlap by 20 minutes of start
      { id: 4, from: '2011-01-06T16:40:00.000Z', to: '2011-01-06T19:00:00.000Z' }, # 20 minutes before end of day
      { id: 5, from: '2011-01-06T16:50:00.000Z', to: '2011-01-07T15:10:00.000Z' }, # 10 minutes before end of one day and 10 before the start of next
      { id: 6, from: '2011-01-06T16:55:00.000Z', to: '2011-01-07T15:05:00.000Z' }, # multiple cycles over several days for a total of 20 minutes of work time
      { id: 6, from: '2011-01-07T16:55:00.000Z', to: '2011-01-10T15:05:00.000Z' }, 
      { id: 7, from: '2011-01-06T16:40:00.000Z', to: '9999-01-01T00:00:00.000Z' }  # continues past the range of consideration in this test
    ]
    
    granularity = 'minute'
    tz = 'America/Chicago'
    
    config =    # default work days and holidays
      granularity: granularity
      tz: tz
      endBefore: '2011-01-11T00:00:00.000'
      workDayStartOn: {hour: 9, minute: 0}  # 15:00 GMT in Chicago
      workDayEndBefore: {hour: 11, minute: 0}  # 17:00 GMT in Chicago.
      validFromField: 'from'
      validToField: 'to'
      uniqueIDField: 'id'

    startOn = '2011-01-05T00:00:00.000Z'
    endBefore = '2011-01-11T00:00:00.000Z'

    tisc = new TimeInStateCalculator(config)
    tisc.addSnapshots(snapshots, startOn, endBefore)

    expected = [
      { id: 1, ticks: 20, lastValidTo: '2011-01-06T15:30:00.000Z' },
      { id: 2, ticks: 20, lastValidTo: '2011-01-06T16:10:00.000Z' },
      { id: 3, ticks: 20, lastValidTo: '2011-01-07T15:20:00.000Z' },
      { id: 4, ticks: 20, lastValidTo: '2011-01-06T19:00:00.000Z' },
      { id: 5, ticks: 20, lastValidTo: '2011-01-07T15:10:00.000Z' },
      { id: 6, ticks: 20, lastValidTo: '2011-01-10T15:05:00.000Z' }
      { id: 7, ticks: 260, lastValidTo: '9999-01-01T00:00:00.000Z' }
    ]

    test.deepEqual(expected, tisc.getResults())

    # save state for later testing
    savedState = tisc.getStateForSaving({somekey: 'some value'})

    # start test for incrementally adding snapshots
    snapshots = [
      { id: 7, from: '2011-01-06T16:40:00.000Z', to: '9999-01-01T00:00:00.000Z' },  # same snapshot as before still going
      { id: 3, from: '2011-01-11T15:00:00.000Z', to: '2011-01-11T15:20:00.000Z' },  # 20 more minutes for id 3
      { id: 8, from: '2011-01-11T15:00:00.000Z', to: '9999-01-01T00:00:00.000Z' }   # 20 minutes in scope for new id 8
    ]

    startOn = '2011-01-11T00:00:00.000Z'  # must match endBefore of prior call
    endBefore = '2011-01-11T15:20:00.000Z'

    tisc.addSnapshots(snapshots, startOn, endBefore)

    expected = [
      { id: 1, ticks: 20, lastValidTo: '2011-01-06T15:30:00.000Z' },
      { id: 2, ticks: 20, lastValidTo: '2011-01-06T16:10:00.000Z' },
      { id: 3, ticks: 40, lastValidTo: '2011-01-11T15:20:00.000Z' },
      { id: 4, ticks: 20, lastValidTo: '2011-01-06T19:00:00.000Z' },
      { id: 5, ticks: 20, lastValidTo: '2011-01-07T15:10:00.000Z' },
      { id: 6, ticks: 20, lastValidTo: '2011-01-10T15:05:00.000Z' }
      { id: 7, ticks: 280, lastValidTo: '9999-01-01T00:00:00.000Z' }
      { id: 8, ticks: 20, lastValidTo: '9999-01-01T00:00:00.000Z' }
    ]

    test.deepEqual(expected, tisc.getResults())

    # Now test restore
    tisc2 = TimeInStateCalculator.newFromSavedState(savedState)

    test.deepEqual(tisc2.meta.somekey, 'some value')

    tisc2.addSnapshots(snapshots, startOn, endBefore)

    test.deepEqual(tisc.getResults(), tisc2.getResults())

    test.done()