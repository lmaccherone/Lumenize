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


  testArrayToHighCharts: (test) ->
    {arrayOfMaps_To_HighChartsSeries} = require('../')

    arrayOfMaps = [
      {"Series 1": 8, "Series 2": 5, "Series3": 10},
      {"Series 1": 2, "Series 2": 3},
      {"Series 1": 1, "Series 2": 2, "Series3": 40},
    ]

    config = [
      {name: "Series 1", yAxis: 1},
      {name: "Series 2"},
      {name: "Series3"}
    ]

    result = arrayOfMaps_To_HighChartsSeries(arrayOfMaps, config)

    expected = [
      { name: 'Series 1', data: [ 8, 2, 1 ], yAxis: 1 },
      { name: 'Series 2', data: [ 5, 3, 2 ] },
      { name: 'Series3', data: [ 10, null, 40 ] }
    ]

    test.deepEqual(result, expected)

    test.done()
    

    
    