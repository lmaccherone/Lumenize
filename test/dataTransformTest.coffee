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
      {_ValidFrom: '2011-01-01T12:00:00.000Z', ObjectID: 1, someColumn: 'some value', someOtherColumn: 'some other value'},
      {_ValidFrom: '2011-01-02T12:00:00.000Z', ObjectID: 2, someColumn: 'some value 2', someOtherColumn: 'some other value 2'},      
    ]
    
    atArray1 = [new ChartTime('2011-01-02').inGranularity('millisecond'), new ChartTime('2011-01-03').inGranularity('millisecond')]
    atArray2 = [new ChartTime('2011-01-02'), new ChartTime('2011-01-03')]
    
    output = [
      [{ObjectID: 1, someColumn: 'some value', someOtherColumn: 'some other value'}],
      [{ObjectID: 1, someColumn: 'some value', someOtherColumn: 'some other value'}, 
       {ObjectID: 2, someColumn: 'some value 2', someOtherColumn: 'some other value 2'}]
    ]
    
    a1 = snapshotArray_To_AtArray(snapshotArray, atArray1, '_ValidFrom', 'ObjectID')
    
    test.deepEqual(a1, output)
    
    a2 = snapshotArray_To_AtArray(snapshotArray, atArray2, '_ValidFrom', 'ObjectID', 'America/New_York')
    
    test.deepEqual(a2, output)
    
    test.done()
    
    