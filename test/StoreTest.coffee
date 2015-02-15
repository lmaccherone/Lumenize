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
        "_PreviousValues": {
          "Created_Date": null,
          "Severity": 4,
          "Status": null
        },
        "RecordID": 1,
        "Created_Date": "2014-06-16",
        "Severity": 5,
        "Status": "New",
        "DefectID": 1,
        "Modified_Date": "2014-06-16T00:00:00.000Z",
        "_ValidTo": "2014-07-17T00:00:00.000Z"
      },
      {
        "_PreviousValues": {
          "Status": "New"
        },
        "RecordID": 100,
        "Status": "In Progress",
        "DefectID": 1,
        "Modified_Date": "2014-07-17T00:00:00.000Z",
        "_ValidTo": "2014-08-18T00:00:00.000Z"
      },
      {
        "_PreviousValues": {
          "Status": "In Progress"
        },
        "RecordID": 1000,
        "Status": "Done",
        "DefectID": 1,
        "Modified_Date": "2014-08-18T00:00:00.000Z",
        "_ValidTo": "9999-01-01T00:00:00.000Z"
      }
    ]

    test.deepEqual(store.snapshots, expected)
    test.deepEqual(store.byUniqueID[1].snapshots, expected)
    test.deepEqual(store.byUniqueID[1].lastSnapshot, expected[2])
    test.equal(store.lastValidFrom, '2014-08-18T00:00:00.000Z')
    test.equal(store.snapshots[2].Severity, 5, 'Tests defaults and inheritance')
    test.equal(store.snapshots[1].Created_Date, '2014-06-16', 'Tests inheritance')

    values = ['New', 'In Progress', 'Done']
    filtered = store.stateBoundaryCrossedFiltered('Status', values, 'In Progress')
    expected = [
      { _PreviousValues: { Status: 'New' },
      RecordID: 100,
      Status: 'In Progress',
      DefectID: 1,
      Modified_Date: '2014-07-17T00:00:00.000Z',
      _ValidTo: '2014-08-18T00:00:00.000Z' }
    ]
    test.deepEqual(filtered, expected)
    test.done()

  accumulatingFields: (test) ->
    config =
      uniqueIDField: 'ID'
      validFromField: 'vf'

    store = new Store(config)
    expected = [ 'vf', '_ValidTo', '_PreviousValues', 'ID' ]
    test.deepEqual(store.fields, expected)

    store.addSnapshots([{ID: 0, field1: 1, field2: 2, vf: '2014-01'}])
    expected = [ 'vf', '_ValidTo', '_PreviousValues', 'ID', 'field1', 'field2' ]
    test.deepEqual(store.fields, expected)

    store.addSnapshots([{ID: 0, field1: 10, field20: 20, vf: '2014-02'}])
    expected = [ 'vf', '_ValidTo', '_PreviousValues', 'ID', 'field1', 'field2', 'field20' ]
    test.deepEqual(store.fields, expected)

    store.addSnapshots([{ID: 2, field1: 10, field20: 20, vf: '2014-03'}])
    test.deepEqual(store.fields, expected)

    test.done()

  idempotentcy: (test) ->
    config =
      uniqueIDField: 'ObjectID'
      validFromField: '_ValidFrom'
    s1 = JSON.parse('{"_id":"54dfbcbee4b06cfa9172e24c","_SnapshotNumber":2,"_ValidFrom":"2015-02-14T21:23:02.393Z","_ValidTo":"9999-01-01T00:00:00.000Z","ObjectID":30267081661,"_Revision":30439223009,"_RevisionNumber":2,"_UnformattedID":56643,"_TypeHierarchy":[-51001,-51002,-51003,-51004,-51005,-51038,23021657561],"_User":23021672170,"_ItemHierarchy":[23023920521,23023569364,23674057111,30267081661],"TestCaseStatus":"NONE","Release":{"ObjectID":23381233231,"Name":"February 2015 Release","StartDate":"2014-11-24T00:00:00.000Z","ReleaseDate":"2015-02-24T23:59:59.000Z"},"Project":{"ObjectID":23022496179,"Name":"Tech Wizards"},"_ProjectHierarchy":[23022492300,23022495412,23022496179],"PortfolioItem":23674057111,"PlanEstimate":3,"DragAndDropRank":"P!8^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~","TaskStatus":"NONE","_ObjectUUID":"46598b88-6a03-483d-b2cf-c870190cca40","TaskEstimateTotal":0,"CreationDate":"2015-02-12T16:37:30.476Z","DefectStatus":"NONE","Name":"Feb Post Prod Warranty I","Expedite":false,"TaskActualTotal":0,"Ready":false,"Blocked":false,"Feature":23674057111,"Iteration":{"ObjectID":24889935364,"Name":"Sprint 15.4","StartDate":"2015-02-18T00:00:00.000Z","EndDate":"2015-03-03T23:59:59.000Z"},"Owner":23021674236,"ScheduleState":23021656838,"TaskRemainingTotal":0,"DirectChildrenCount":0,"_ItemHierarchyUUID":["ae767478-cafe-492b-be64-6f4dfd0f7961","0775fd89-8360-4bbb-a368-d460574dfcb7","c852aa13-4ad0-401b-b1d9-01b63d09ef99","46598b88-6a03-483d-b2cf-c870190cca40"],"_SnapshotDate":"2015-02-14T21:23:10.593Z","c_StoryType":"Enabling","_PreviousValues":{"_User":23021674236,"DragAndDropRank":"P!6]8O~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"}}')
    s2 = JSON.parse('{"_id":"54dfbcbee4b06cfa9172e24c","_SnapshotNumber":2,"_ValidFrom":"2015-02-14T21:23:02.393Z","_ValidTo":"9999-01-01T00:00:00.000Z","ObjectID":30267081661,"_Revision":30439223009,"_RevisionNumber":2,"_UnformattedID":56643,"_TypeHierarchy":[-51001,-51002,-51003,-51004,-51005,-51038,23021657561],"_User":23021672170,"_ItemHierarchy":[23023920521,23023569364,23674057111,30267081661],"TestCaseStatus":"NONE","Release":{"ObjectID":23381233231,"Name":"February 2015 Release","StartDate":"2014-11-24T00:00:00.000Z","ReleaseDate":"2015-02-24T23:59:59.000Z"},"Project":{"ObjectID":23022496179,"Name":"Tech Wizards"},"_ProjectHierarchy":[23022492300,23022495412,23022496179],"PortfolioItem":23674057111,"PlanEstimate":3,"DragAndDropRank":"P!8^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~","TaskStatus":"NONE","_ObjectUUID":"46598b88-6a03-483d-b2cf-c870190cca40","TaskEstimateTotal":0,"CreationDate":"2015-02-12T16:37:30.476Z","DefectStatus":"NONE","Name":"Feb Post Prod Warranty I","Expedite":false,"TaskActualTotal":0,"Ready":false,"Blocked":false,"Feature":23674057111,"Iteration":{"ObjectID":24889935364,"Name":"Sprint 15.4","StartDate":"2015-02-18T00:00:00.000Z","EndDate":"2015-03-03T23:59:59.000Z"},"Owner":23021674236,"ScheduleState":23021656838,"TaskRemainingTotal":0,"DirectChildrenCount":0,"_ItemHierarchyUUID":["ae767478-cafe-492b-be64-6f4dfd0f7961","0775fd89-8360-4bbb-a368-d460574dfcb7","c852aa13-4ad0-401b-b1d9-01b63d09ef99","46598b88-6a03-483d-b2cf-c870190cca40"],"_SnapshotDate":"2015-02-14T21:23:10.593Z","c_StoryType":"Enabling","_PreviousValues":{"_User":23021674236,"DragAndDropRank":"P!6]8O~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"}}')
    s3 = JSON.parse('{"_id":"54dfbcbee4b06cfa9172e24c","_SnapshotNumber":2,"_ValidFrom":"2015-02-14T21:23:02.393Z","_ValidTo":"9999-01-01T00:00:00.000Z","ObjectID":30267081661,"_Revision":30439223009,"_RevisionNumber":2,"_UnformattedID":56643,"_TypeHierarchy":[-51001,-51002,-51003,-51004,-51005,-51038,23021657561],"_User":23021672170,"_ItemHierarchy":[23023920521,23023569364,23674057111,30267081661],"TestCaseStatus":"NONE","Release":{"ObjectID":23381233231,"Name":"February 2015 Release","StartDate":"2014-11-24T00:00:00.000Z","ReleaseDate":"2015-02-24T23:59:59.000Z"},"Project":{"ObjectID":23022496179,"Name":"Tech Wizards"},"_ProjectHierarchy":[23022492300,23022495412,23022496179],"PortfolioItem":23674057111,"PlanEstimate":3,"DragAndDropRank":"P!8^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~","TaskStatus":"NONE","_ObjectUUID":"46598b88-6a03-483d-b2cf-c870190cca40","TaskEstimateTotal":0,"CreationDate":"2015-02-12T16:37:30.476Z","DefectStatus":"NONE","Name":"Feb Post Prod Warranty I","Expedite":false,"TaskActualTotal":0,"Ready":false,"Blocked":false,"Feature":23674057111,"Iteration":{"ObjectID":24889935364,"Name":"Sprint 15.4","StartDate":"2015-02-18T00:00:00.000Z","EndDate":"2015-03-03T23:59:59.000Z"},"Owner":23021674236,"ScheduleState":23021656838,"TaskRemainingTotal":0,"DirectChildrenCount":0,"_ItemHierarchyUUID":["ae767478-cafe-492b-be64-6f4dfd0f7961","0775fd89-8360-4bbb-a368-d460574dfcb7","c852aa13-4ad0-401b-b1d9-01b63d09ef99","46598b88-6a03-483d-b2cf-c870190cca40"],"_SnapshotDate":"2015-02-14T21:23:10.593Z","c_StoryType":"Enabling","_PreviousValues":{"_User":23021674236,"DragAndDropRank":"P!6]8O~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"}}')

    store = new Store(config)
    store.addSnapshots([s1])
    store.addSnapshots([s2])
    store.addSnapshots([s3])

    test.equal(store.snapshots.length, 1)

    test.done()
