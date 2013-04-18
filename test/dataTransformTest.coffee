{Time, csvStyleArray_To_ArrayOfMaps, snapshotArray_To_AtArray} = require('../')

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
    

    
    