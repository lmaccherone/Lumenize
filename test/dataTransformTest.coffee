{ChartTime, csvStyleArray_To_ArrayOfMaps, snapshotArray_To_AtArray} = require('../')

ChartTime.setTZPath("../vendor/tz")

exports.dataTransformTest =

  testCSVtoMap: (test) ->

    csvStyleArray = [
      ['column1', 'column2'  ],
      [1         , 2         ],
      [3         , 4         ],
      [5         , 6         ]
    ]

    arrayOfMaps = [
      {column1: 1, column2: 2},
      {column1: 3, column2: 4},
      {column1: 5, column2: 6},
    ]
    
    a = csvStyleArray_To_ArrayOfMaps(csvStyleArray)
    
    test.deepEqual(a, arrayOfMaps)
    
    test.done()
    
    
  testSnapshotToAtArray: (test) ->
    snapshotArray = [
      {_ValidFrom: '1999-01-01T12:00:00.000Z', _ValidTo:'2010-01-02T12:00:00.000Z', ObjectID: 0, someColumn: 'some value'},
      {_ValidFrom: '2011-01-01T12:00:00.000Z', _ValidTo:'2011-01-02T12:00:00.000Z', ObjectID: 1, someColumn: 'some value'},
      {_ValidFrom: '2011-01-02T12:00:00.000Z', _ValidTo:'9999-01-01T12:00:00.000Z', ObjectID: 2, someColumn: 'some value 2'},      
      {_ValidFrom: '2011-01-02T12:00:00.000Z', _ValidTo:'2011-01-03T12:00:00.000Z', ObjectID: 3, someColumn: 'some value'},
      {_ValidFrom: '2011-01-05T12:00:00.000Z', _ValidTo:'9999-01-01T12:00:00.000Z', ObjectID: 1, someColumn: 'some value'},
      {_ValidFrom: '2222-01-05T12:00:00.000Z', _ValidTo:'9999-01-01T12:00:00.000Z', ObjectID: 99, someColumn: 'some value'},
    ]

    listOfAtCTs = [new ChartTime('2011-01-02'), new ChartTime('2011-01-03'), new ChartTime('2011-01-07')]
    
    output = [ 
      [ # 2011-01-02
        {
          _ValidFrom: '2011-01-01T12:00:00.000Z',
          _ValidTo: '2011-01-02T12:00:00.000Z',
          ObjectID: '1',
          someColumn: 'some value' 
        } 
      ],
      [ # 2011-01-03
        { 
          _ValidFrom: '2011-01-02T12:00:00.000Z',
          _ValidTo: '9999-01-01T12:00:00.000Z',
          ObjectID: '2',
          someColumn: 'some value 2' 
        },
        { 
          _ValidFrom: '2011-01-02T12:00:00.000Z',
          _ValidTo: '2011-01-03T12:00:00.000Z',
          ObjectID: '3',
          someColumn: 'some value' 
        } 
      ],
      [ # 2011-01-07
        { 
          _ValidFrom: '2011-01-05T12:00:00.000Z',
          _ValidTo: '9999-01-01T12:00:00.000Z',
          ObjectID: '1',
          someColumn: 'some value' 
        },
        { 
          _ValidFrom: '2011-01-02T12:00:00.000Z',
          _ValidTo: '9999-01-01T12:00:00.000Z',
          ObjectID: '2',
          someColumn: 'some value 2' 
        } 
      ] 
    ]
        
    a2 = snapshotArray_To_AtArray(snapshotArray, listOfAtCTs, '_ValidFrom', 'ObjectID', 'America/New_York', '_ValidTo')
    
    test.deepEqual(a2, output)
    
    test.done()
    
    