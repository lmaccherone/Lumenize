{Time} = require('tztime')
{TransitionsCalculator} = require('../')

exports.TransitionsCalculatorTest =

  testBasic: (test) ->

    snapshots = [
      { id: 1, from: '2011-01-03T00:00:00.000Z', PlanEstimate: 10 },
      { id: 1, from: '2011-01-05T00:00:00.000Z', PlanEstimate: 10 },
      { id: 2, from: '2011-01-04T00:00:00.000Z', PlanEstimate: 20 },
      { id: 3, from: '2011-01-10T00:00:00.000Z', PlanEstimate: 30 },
      { id: 4, from: '2011-01-11T00:00:00.000Z', PlanEstimate: 40 },
      { id: 5, from: '2011-01-17T00:00:00.000Z', PlanEstimate: 50 },
      { id: 6, from: '2011-01-24T00:00:00.000Z', PlanEstimate: 60 },
      { id: 7, from: '2011-01-25T00:00:00.000Z', PlanEstimate: 70 },
      { id: 8, from: '2011-03-02T00:00:00.000Z', PlanEstimate: 80 },
      { id: 9, from: '2011-03-03T00:00:00.000Z', PlanEstimate: 90 },
    ]

    snapshotsToSubtract = [
      { id: 1, from: '2011-01-04T00:00:00.000Z', PlanEstimate: 10 },
      { id: 9, from: '2011-03-04T00:00:00.000Z', PlanEstimate: 90 },
    ]

    granularity = Time.MONTH
    tz = 'America/Chicago'

    config =
      asOf: '2011-05-01'
      granularity: granularity
      tz: tz
      validFromField: 'from'
      validToField: 'to'
      uniqueIDField: 'id'
      fieldsToSum: ['PlanEstimate']
      asterixToDateTimePeriod: true

    startOn = '2011-01-01T00:00:00.000Z'
    endBefore = '2011-03-14T00:00:00.000Z'

    calculator = new TransitionsCalculator(config)
    calculator.addSnapshots(snapshots, startOn, endBefore, snapshotsToSubtract)

    expected = [
      { timePeriod: '2010-12', count: 0, PlanEstimate: 0 },
      { timePeriod: '2011-01', count: 7, PlanEstimate: 280 },
      { timePeriod: '2011-02', count: 0, PlanEstimate: 0 },
      { timePeriod: '2011-03', count: 1, PlanEstimate: 80 },
      { timePeriod: '2011-04', count: 0, PlanEstimate: 0 },
      { timePeriod: '2011-05*', count: 0, PlanEstimate: 0 }
    ]
    test.deepEqual(expected, calculator.getResults())

    config.asOf = '2011-07'

    calculator = new TransitionsCalculator(config)
    calculator.addSnapshots(snapshots, startOn, endBefore, snapshotsToSubtract)

    test.equal(8, calculator.getResults().length)

    test.done()

  testSaveRestorAndIncrementalUpdate: (test) ->

    snapshots = [
      { id: 1, from: '2011-01-03T00:00:00.000Z', PlanEstimate: 10 },
      { id: 1, from: '2011-01-05T00:00:00.000Z', PlanEstimate: 10 },
      { id: 2, from: '2011-01-04T00:00:00.000Z', PlanEstimate: 20 },
      { id: 3, from: '2011-01-10T00:00:00.000Z', PlanEstimate: 30 },
      { id: 4, from: '2011-01-11T00:00:00.000Z', PlanEstimate: 40 },
      { id: 5, from: '2011-01-17T00:00:00.000Z', PlanEstimate: 50 },
      { id: 6, from: '2011-01-24T00:00:00.000Z', PlanEstimate: 60 },
      { id: 7, from: '2011-01-25T00:00:00.000Z', PlanEstimate: 70 },
      { id: 8, from: '2011-03-02T00:00:00.000Z', PlanEstimate: 80 },
      { id: 9, from: '2011-03-03T00:00:00.000Z', PlanEstimate: 90 },
    ]

    snapshotsToSubtract = [
      { id: 1, from: '2011-01-04T00:00:00.000Z', PlanEstimate: 10 },
      { id: 9, from: '2011-03-04T00:00:00.000Z', PlanEstimate: 90 },
    ]

    granularity = Time.MONTH
    tz = 'America/Chicago'

    config =
      asOf: '2011-05-01'
      granularity: granularity
      tz: tz
      validFromField: 'from'
      validToField: 'to'
      uniqueIDField: 'id'
      fieldsToSum: ['PlanEstimate']
      asterixToDateTimePeriod: true

    startOn = '2011-01-01T00:00:00.000Z'
    endBefore = '2011-03-14T00:00:00.000Z'

    calculator = new TransitionsCalculator(config)
    calculator.addSnapshots(snapshots, startOn, endBefore, snapshotsToSubtract)

    savedState = calculator.getStateForSaving({a: 1})

    moreSnapshots = [
      { id: 10, from: '2011-04-15T00:00:00.000Z', PlanEstimate: 100 },
      { id: 11, from: '2011-04-16T00:00:00.000Z', PlanEstimate: 110 },
    ]

    moreSnapshotsToSubtract = [
      { id: 11, from: '2011-04-17T00:00:00.000Z', PlanEstimate: 110 },
    ]

    startOn = '2011-03-14T00:00:00.000Z'
    endBefore = '2011-05-01T00:00:00.000Z'

    calculator.addSnapshots(moreSnapshots, startOn, endBefore, moreSnapshotsToSubtract)

    expected = [
      { timePeriod: '2010-12', count: 0, PlanEstimate: 0 },
      { timePeriod: '2011-01', count: 7, PlanEstimate: 280 },
      { timePeriod: '2011-02', count: 0, PlanEstimate: 0 },
      { timePeriod: '2011-03', count: 1, PlanEstimate: 80 },
      { timePeriod: '2011-04', count: 1, PlanEstimate: 100 },
      { timePeriod: '2011-05*', count: 0, PlanEstimate: 0 }
    ]

    test.deepEqual(expected, calculator.getResults())

    calculator2 = TransitionsCalculator.newFromSavedState(savedState)
    calculator2.addSnapshots(moreSnapshots, startOn, endBefore, moreSnapshotsToSubtract)

    test.deepEqual(calculator2.getResults(), calculator.getResults())
    test.deepEqual(calculator2.meta, {a: 1})
    test.equal(calculator2.lowestTimePeriod, calculator.lowestTimePeriod)
    test.equal(calculator2.maxTimeString, calculator.maxTimeString)
    test.equal(calculator2.upToDate, calculator.upToDate)
    test.equal(calculator2.virgin, calculator.virgin)

    test.done()

  testMonthsAndWeeks: (test) ->

    snapshots = [
      { id: 1, from: '2011-01-03T00:00:00.000Z', PlanEstimate: 10 },
      { id: 1, from: '2011-01-05T00:00:00.000Z', PlanEstimate: 10 },
      { id: 2, from: '2011-01-04T00:00:00.000Z', PlanEstimate: 20 },
      { id: 3, from: '2011-01-10T00:00:00.000Z', PlanEstimate: 30 },
      { id: 4, from: '2011-01-11T00:00:00.000Z', PlanEstimate: 40 },
      { id: 5, from: '2011-01-17T00:00:00.000Z', PlanEstimate: 50 },
      { id: 6, from: '2011-02-07T00:00:00.000Z', PlanEstimate: 60 },
      { id: 7, from: '2011-02-08T00:00:00.000Z', PlanEstimate: 70 },
    ]

    snapshotsToSubtract = [
      { id: 1, from: '2011-01-04T00:00:00.000Z', PlanEstimate: 10 },
      { id: 7, from: '2011-02-09T00:00:00.000Z', PlanEstimate: 70 },
    ]

    granularity = Time.MONTH
    tz = 'America/Chicago'

    config =
      asOf: '2011-02-10'
      granularity: granularity
      tz: tz
      validFromField: 'from'
      validToField: 'to'
      uniqueIDField: 'id'
      fieldsToSum: ['PlanEstimate']
      asterixToDateTimePeriod: true

    startOn = '2011-01-02T00:00:00.000Z'
    endBefore = '2011-02-27T00:00:00.000Z'

    calculator = new TransitionsCalculator(config)
    calculator.addSnapshots(snapshots, startOn, endBefore, snapshotsToSubtract)

    expected = [
      { timePeriod: '2011-01', count: 5, PlanEstimate: 150 },
      { timePeriod: '2011-02*', count: 1, PlanEstimate: 60 }
    ]
    test.deepEqual(expected, calculator.getResults())

    config.granularity = Time.WEEK
    calculator = new TransitionsCalculator(config)
    calculator.addSnapshots(snapshots, startOn, endBefore, snapshotsToSubtract)

    expected = [
      { timePeriod: '2010W52', count: 1, PlanEstimate: 10 },
      { timePeriod: '2011W01', count: 2, PlanEstimate: 50 },
      { timePeriod: '2011W02', count: 2, PlanEstimate: 90 },
      { timePeriod: '2011W03', count: 0, PlanEstimate: 0 },
      { timePeriod: '2011W04', count: 0, PlanEstimate: 0 },
      { timePeriod: '2011W05', count: 1, PlanEstimate: 60 },
      { timePeriod: '2011W06*', count: 0, PlanEstimate: 0 }
    ]
    test.deepEqual(expected, calculator.getResults())

    weekStartingLabel = 'week starting ' + new Time('2010W52').inGranularity(Time.DAY).toString()
    test.equal(weekStartingLabel, 'week starting 2010-12-27')

    test.done()