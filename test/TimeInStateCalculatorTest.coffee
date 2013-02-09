lumenize = require('../')
{TimeInStateCalculator} = lumenize
{Time} = require('tztime')

exports.TimeInStateCalculatorTest =

  testBasic: (test) ->
    
    snapshots = [ 
      { id: 1, from: '2011-01-06T15:10:00.000Z', to: '2011-01-06T15:20:00.000Z', Name: '1.0' }, # 10 minutes all within an hour
      { id: 2, from: '2011-01-06T15:50:00.000Z', to: '2011-01-06T16:10:00.000Z', Name: '2.0' }, # 20 minutes spanning an hour
      { id: 3, from: '2011-01-07T13:00:00.000Z', to: '2011-01-07T15:30:00.000Z', Name: '3.0' }, # start 2 hours before but overlap by 30 minutes of start
      { id: 4, from: '2011-01-06T16:20:00.000Z', to: '2011-01-06T19:00:00.000Z', Name: '4.0' }, # 40 minutes before end of day
      { id: 5, from: '2011-01-06T16:35:00.000Z', to: '2011-01-07T15:25:00.000Z', Name: '5.0' }, # 25 minutes before end of one day and 25 before the start of next
      { id: 6, from: '2011-01-06T16:35:00.000Z', to: '2011-01-07T15:05:00.000Z', Name: '6.0' }, # multiple cycles over several days for a total of 60 minutes of work time
      { id: 6, from: '2011-01-07T16:35:00.000Z', to: '2011-01-10T15:05:00.000Z', Name: '6.1' },
      { id: 7, from: '2011-01-06T16:40:00.000Z', to: '9999-01-01T00:00:00.000Z', Name: '7.0' }  # continues past the range of consideration in this test
    ]
    
    granularity = Time.MINUTE
    tz = 'America/Chicago'
    
    config =    # default work days and holidays
      granularity: granularity
      tz: tz
      workDayStartOn: {hour: 9, minute: 0}  # 15:00 GMT in Chicago
      workDayEndBefore: {hour: 11, minute: 0}  # 17:00 GMT in Chicago.
      validFromField: 'from'
      validToField: 'to'
      uniqueIDField: 'id'
      trackLastValueForTheseFields: ['to', 'Name']

    startOn = '2011-01-05T00:00:00.000Z'
    endBefore = '2011-01-11T00:00:00.000Z'

    tisc = new TimeInStateCalculator(config)
    tisc.addSnapshots(snapshots, startOn, endBefore)

    expected = [
      { id: 1, ticks: 10, to_lastValue: '2011-01-06T15:20:00.000Z', Name_lastValue: '1.0' },
      { id: 2, ticks: 20, to_lastValue: '2011-01-06T16:10:00.000Z', Name_lastValue: '2.0' },
      { id: 3, ticks: 30, to_lastValue: '2011-01-07T15:30:00.000Z', Name_lastValue: '3.0' },
      { id: 4, ticks: 40, to_lastValue: '2011-01-06T19:00:00.000Z', Name_lastValue: '4.0' },
      { id: 5, ticks: 50, to_lastValue: '2011-01-07T15:25:00.000Z', Name_lastValue: '5.0' },
      { id: 6, ticks: 60, to_lastValue: '2011-01-10T15:05:00.000Z', Name_lastValue: '6.1' }
      { id: 7, ticks: 260, to_lastValue: '9999-01-01T00:00:00.000Z', Name_lastValue: '7.0' }
    ]

    test.deepEqual(tisc.getResults(), expected)

    # save state for later testing
    savedState = tisc.getStateForSaving({somekey: 'some value'})

    # start test for incrementally adding snapshots
    snapshots = [
      { id: 7, from: '2011-01-06T16:40:00.000Z', to: '9999-01-01T00:00:00.000Z', Name: '7.1' },  # same snapshot as before still going
      { id: 3, from: '2011-01-11T15:00:00.000Z', to: '2011-01-11T15:20:00.000Z', Name: '3.1' },  # 20 more minutes for id 3
      { id: 8, from: '2011-01-11T15:00:00.000Z', to: '9999-01-01T00:00:00.000Z', Name: '8.0' }   # 20 minutes in scope for new id 8
    ]

    startOn = '2011-01-11T00:00:00.000Z'  # must match endBefore of prior call
    endBefore = '2011-01-11T15:20:00.000Z'

    tisc.addSnapshots(snapshots, startOn, endBefore)

    expected = [
      { id: 1, ticks: 10, to_lastValue: '2011-01-06T15:20:00.000Z', Name_lastValue: '1.0' },
      { id: 2, ticks: 20, to_lastValue: '2011-01-06T16:10:00.000Z', Name_lastValue: '2.0' },
      { id: 3, ticks: 50, to_lastValue: '2011-01-11T15:20:00.000Z', Name_lastValue: '3.1' },
      { id: 4, ticks: 40, to_lastValue: '2011-01-06T19:00:00.000Z', Name_lastValue: '4.0' },
      { id: 5, ticks: 50, to_lastValue: '2011-01-07T15:25:00.000Z', Name_lastValue: '5.0' },
      { id: 6, ticks: 60, to_lastValue: '2011-01-10T15:05:00.000Z', Name_lastValue: '6.1' }
      { id: 7, ticks: 280, to_lastValue: '9999-01-01T00:00:00.000Z', Name_lastValue: '7.1' }
      { id: 8, ticks: 20, to_lastValue: '9999-01-01T00:00:00.000Z', Name_lastValue: '8.0' }
    ]

    test.deepEqual(tisc.getResults(), expected)

    # Now test restore
    tisc2 = TimeInStateCalculator.newFromSavedState(savedState)

    test.deepEqual(tisc2.meta.somekey, 'some value')

    tisc2.addSnapshots(snapshots, startOn, endBefore)

    test.deepEqual(tisc.getResults(), tisc2.getResults())

    test.done()