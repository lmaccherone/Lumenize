{Store, csvStyleArray_To_ArrayOfMaps, Time} = require('../')

exports.StoreTest =

  singleUniqueID: (test) ->

    snapshotCSVStyleArray = [
      ['RecordID', 'DefectID', 'Created_Date', 'Severity', 'Modified_Date', 'Status'],
      [         1,          1,   '2014-06-16',          5,    '2014-06-16',    'New'],
      [       100,          1,   '2014-06-16',          5,    '2014-07-17',    'In Progress'],
      [      1000,          1,   '2014-06-16',          5,    '2014-08-18',    'Done'],
    ]

    defects = csvStyleArray_To_ArrayOfMaps(snapshotCSVStyleArray)

    config =
      uniqueIDField: 'DefectID'
      validFromField: 'Modified_Date'
      idField: 'RecordID'
      defaultValues:
        Severity: 4

    store = new Store(config, defects)

    expected = [
      {
        "_previousValues": {
          "Created_Date": null,
          "Severity": 4,
          "Status": null
        },
        "RecordID": 1,
        "Created_Date": "2014-06-16",
        "Severity": 5,
        "Status": "New",
        "DefectID": 1,
        "Modified_Date": "2014-06-16",
        "_ValidTo": "2014-07-17"
      },
      {
        "_previousValues": {
          "Status": "New"
        },
        "RecordID": 100,
        "Status": "In Progress",
        "DefectID": 1,
        "Modified_Date": "2014-07-17",
        "_ValidTo": "2014-08-18"
      },
      {
        "_previousValues": {
          "Status": "In Progress"
        },
        "RecordID": 1000,
        "Status": "Done",
        "DefectID": 1,
        "Modified_Date": "2014-08-18",
        "_ValidTo": "9999-01-01T00:00:00.000Z"
      }
    ]

    test.deepEqual(store.snapshots, expected)
    test.deepEqual(store.byUniqueID[1].snapshots, expected)
    test.deepEqual(store.byUniqueID[1].lastSnapshot, expected[2])
    test.equal(store.lastValidFrom, '2014-08-18')
    test.equal(store.snapshots[2].Severity, 5, 'Tests defaults and inheritance')
    test.equal(store.snapshots[1].Created_Date, '2014-06-16', 'Tests inheritance')

    values = ['New', 'In Progress', 'Done']
    filtered = store.stateBoundaryCrossedFiltered('Status', values, 'In Progress')
    expected = [
      { _previousValues: { Status: 'New' },
      RecordID: 100,
      Status: 'In Progress',
      DefectID: 1,
      Modified_Date: '2014-07-17',
      _ValidTo: '2014-08-18' }
    ]
    test.deepEqual(filtered, expected)
    test.done()

  accumulatingFields: (test) ->
    config =
      uniqueIDField: 'ID'
      validFromField: 'vf'

    store = new Store(config)
    expected = [ 'vf', '_ValidTo', '_previousValues', 'ID' ]
    test.deepEqual(store.fields, expected)

    store.addSnapshots([{ID: 0, field1: 1, field2: 2, vf: '2014'}])
    expected = [ 'vf', '_ValidTo', '_previousValues', 'ID', 'field1', 'field2' ]
    test.deepEqual(store.fields, expected)

    store.addSnapshots([{ID: 0, field1: 10, field20: 20, vf: '2014'}])
    expected = [ 'vf', '_ValidTo', '_previousValues', 'ID', 'field1', 'field2', 'field20' ]
    test.deepEqual(store.fields, expected)

    store.addSnapshots([{ID: 2, field1: 10, field20: 20, vf: '2014'}])
    test.deepEqual(store.fields, expected)

    test.done()
