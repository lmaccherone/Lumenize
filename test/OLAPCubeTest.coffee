OLAPCube = require('../src/OLAPCube').OLAPCube
{csvStyleArray_To_ArrayOfMaps} = require('../')
utils = require('../src/utils')

###
Test to-do
  save State
  restore State
  extract 2D slice
  extract 1D slice
  documentation with examples
###
exports.olapTest =

  testPossibilities: (test) ->
    test.deepEqual([null, 'a'], OLAPCube._possibilities('a', undefined, true))

    test.deepEqual([null, 7], OLAPCube._possibilities(7, undefined, true))

    test.deepEqual([null, '1', '2', '3'], OLAPCube._possibilities(['1', '2', '3'], undefined, true))  # Tags

    expected = [
      null,
      ['1', '2', '3'],
      ['1', '2'],
      ['1']
    ]
    test.deepEqual(expected, OLAPCube._possibilities(['1', '2', '3'], 'hierarchy', true))  # Hierarchy
    test.done()

  testExpandFact: (test) ->
    singleFact =
      singleValueField: 'a'
      hierarchicalField: ['1','2','3']
      field3: 7
      field4: 3

    dimensions = [
      {field: 'singleValueField'},
      {field: 'hierarchicalField', type: 'hierarchy'}
    ]

    metrics = [
      {field: 'field3'},
      {field: 'field4', metrics: [
        {as: 'median4', f: 'p50'},
        {f: 'sum'},
        {as: 'myCount', f: (values) -> return values.length}
      ]}
    ]

    expectedMetrics =
      'field3_values': [7]
      'field4_values': [3]

    expected = [
      {singleValueField: 'a', hierarchicalField: ['1'], __facts:[singleFact], __metrics: expectedMetrics},
      {singleValueField: 'a', hierarchicalField: ['1','2'], __facts:[singleFact], __metrics: expectedMetrics},
      {singleValueField: 'a', hierarchicalField: ['1','2','3'], __facts:[singleFact], __metrics: expectedMetrics},
      {singleValueField: 'a', hierarchicalField: null, __facts:[singleFact], __metrics: expectedMetrics},
      {singleValueField: null, hierarchicalField: ['1'], __facts:[singleFact], __metrics: expectedMetrics}
      {singleValueField: null, hierarchicalField: ['1','2'], __facts:[singleFact], __metrics: expectedMetrics},
      {singleValueField: null, hierarchicalField: ['1','2','3'], __facts:[singleFact], __metrics: expectedMetrics},
      {singleValueField: null, hierarchicalField: null, __facts:[singleFact], __metrics: expectedMetrics}
    ]

    config = {dimensions, metrics}
    config.keepTotals = true
    config.keepFacts = true

    cube = new OLAPCube(config, singleFact)
    actual = cube._expandFact(singleFact, config)
    test.deepEqual(expected, actual)

    expected = [
      {singleValueField: 'a', hierarchicalField: ['1','2']},
      {singleValueField: null, hierarchicalField: ['1','2']}
    ]
    cells = cube.getCells({hierarchicalField: ['1', '2']})
    test.equal(cells.length, 2)
    test.ok(utils.filterMatch(expected[0], cells[0]))
    test.ok(utils.filterMatch(expected[1], cells[1]))

    test.done()

  testOLAPCube: (test) ->
    aCSVStyle = [
      ['field1', 'field2'     , 'field3', 'field4'],
      ['a'     , ['1','2','3'], 7       , 3       ],
      ['b'     , ['1','2']    , 70      , 30      ]
    ]

    facts = csvStyleArray_To_ArrayOfMaps(aCSVStyle)

    dimensions = [
      {field: 'field1'},
      {field: 'field2', type:'hierarchy'}
    ]

    metrics = [
      {field: 'field3'},  # Default metrics of count, sum, sumSquares
      {field: 'field4', metrics: [
        {as: 'median4', f: 'p50'},
        {f: 'sum'},
        {as: 'myCount', f: (values) -> return values.length}
      ]}
    ]

    config = {dimensions, metrics}
    config.keepTotals = true
    config.keepValues = true

    expected = [
      {"field1": "a", "field2": ["1"], "__metrics": {
          "field3_values": [7],
          "field4_values": [3],
          "field3_count": 1,
          "field3_sum": 7,
          "field3_sumSquares": 49,
          "median4": 3,
          "field4_sum": 3,
          "myCount": 1
        }
      },
      {"field1": "a", "field2": ["1", "2"], "__metrics": {
          "field3_values": [7],
          "field4_values": [3],
          "field3_count": 1,
          "field3_sum": 7,
          "field3_sumSquares": 49,
          "median4": 3,
          "field4_sum": 3,
          "myCount": 1
        }
      },
      {"field1": "a", "field2": ["1", "2", "3"], "__metrics": {
          "field3_values": [7],
          "field4_values": [3],
          "field3_count": 1,
          "field3_sum": 7,
          "field3_sumSquares": 49,
          "median4": 3,
          "field4_sum": 3,
          "myCount": 1
        }
      },
      {"field1": "a", "field2": null, "__metrics": {
          "field3_values": [7],
          "field4_values": [3],
          "field3_count": 1,
          "field3_sum": 7,
          "field3_sumSquares": 49,
          "median4": 3,
          "field4_sum": 3,
          "myCount": 1
        }
      },
      {"field1": null, "field2": ["1"], "__metrics": {
          "field3_values": [7, 70],
          "field4_values": [3, 30],
          "field3_count": 2,
          "field3_sum": 77,
          "field3_sumSquares": 4949,
          "median4": 16.5,
          "field4_sum": 33,
          "myCount": 2
          }
      },
      {"field1": null, "field2": ["1", "2"], "__metrics": {
          "field3_values": [7, 70],
          "field4_values": [3, 30],
          "field3_count": 2,
          "field3_sum": 77,
          "field3_sumSquares": 4949,
          "median4": 16.5,
          "field4_sum": 33,
          "myCount": 2
        }
      },
      {"field1": null, "field2": ["1", "2", "3"], "__metrics": {
          "field3_values": [7],
          "field4_values": [3],
          "field3_count": 1,
          "field3_sum": 7,
          "field3_sumSquares": 49,
          "median4": 3,
          "field4_sum": 3,
          "myCount": 1
        }
      },
      {"field1": null, "field2": null, "__metrics": {
          "field3_values": [7, 70],
          "field4_values": [3, 30],
          "field3_count": 2,
          "field3_sum": 77,
          "field3_sumSquares": 4949,
          "median4": 16.5,
          "field4_sum": 33,
          "myCount": 2
        }
      },
      {"field1": "b", "field2": ["1"], "__metrics": {
          "field3_values": [70],
          "field4_values": [30],
          "field3_count": 1,
          "field3_sum": 70,
          "field3_sumSquares": 4900,
          "median4": 30,
          "field4_sum": 30,
          "myCount": 1
        }
      },
      {"field1": "b", "field2": ["1", "2"], "__metrics": {
          "field3_values": [70],
          "field4_values": [30],
          "field3_count": 1,
          "field3_sum": 70,
          "field3_sumSquares": 4900,
          "median4": 30,
          "field4_sum": 30,
          "myCount": 1
        }
      },
      {"field1": "b", "field2": null, "__metrics": {
          "field3_values": [70],
          "field4_values": [30],
          "field3_count": 1,
          "field3_sum": 70,
          "field3_sumSquares": 4900,
          "median4": 30,
          "field4_sum": 30,
          "myCount": 1
        }
      }
    ]

    cube = new OLAPCube(config, facts)

    test.deepEqual(expected, cube.cells)

    expected = undefined
    test.deepEqual(expected, cube.getCell({field1: "z"}))

    expected = {
      "field1": "b", "field2": null, "__metrics": {
        "field3_values": [70],
        "field4_values": [30],
        "field3_count": 1,
        "field3_sum": 70,
        "field3_sumSquares": 4900,
        "median4": 30,
        "field4_sum": 30,
        "myCount": 1
      }
    }
    test.deepEqual(expected, cube.getCell({field1: "b"}))

    expected = {
      "field1": "b", "field2": ["1"], "__metrics": {
        "field3_values": [70],
        "field4_values": [30],
        "field3_count": 1,
        "field3_sum": 70,
        "field3_sumSquares": 4900,
        "median4": 30,
        "field4_sum": 30,
        "myCount": 1
      }
    }
    test.deepEqual(expected, cube.getCell({field1: "b", field2: ["1"]}))

    test.done()

  testGroupBy: (test) ->
    aCSVStyle = [
      ['field1', 'field3',],
      ['a'     , 3        ],
      ['b'     , 30       ],
      ['c'     , 40       ],
      ['b'     , 4        ],
      ['b'     , 7        ],
      ['b'     , 13       ],
      ['b'     , 15       ],
      ['c'     , 17       ],
      ['b'     , 22       ],
      ['b'     , 2        ]
    ]

    facts = csvStyleArray_To_ArrayOfMaps(aCSVStyle)

    dimensions = [
      {field: 'field1'}
    ]

    metrics = [
      {field: 'field3', metrics:[
        {f: 'sum'},
        {f: 'count'}
      ]}
    ]

    config = {dimensions, metrics}

    cube = new OLAPCube(config, facts)

    expected = [
      {"field1": "a", "__metrics": {"field3_sum": 3 , "field3_count": 1}},
      {"field1": "b", "__metrics": {"field3_sum": 93, "field3_count": 7}},
      {"field1": "c", "__metrics": {"field3_sum": 57, "field3_count": 2}}
    ]

    test.deepEqual(expected, cube.cells)

    config.keepTotals = true

    cube = new OLAPCube(config, facts)

    expected = [
      {"field1": "a", "__metrics": {"field3_sum": 3 , "field3_count": 1}},
      {"field1": null, "__metrics": {"field3_sum": 153 , "field3_count": 10}},
      {"field1": "b", "__metrics": {"field3_sum": 93, "field3_count": 7}},
      {"field1": "c", "__metrics": {"field3_sum": 57, "field3_count": 2}}
    ]

    test.deepEqual(expected, cube.cells)

    cube.addFacts({field1:'c', field3:10})

    expected = [
      {"field1": "a", "__metrics": {"field3_sum": 3 , "field3_count": 1}},
      {"field1": null, "__metrics": {"field3_sum": 163 , "field3_count": 11}},
      {"field1": "b", "__metrics": {"field3_sum": 93, "field3_count": 7}},
      {"field1": "c", "__metrics": {"field3_sum": 67, "field3_count": 3}}
    ]

    test.deepEqual(expected, cube.cells)

    cube.addFacts([
      {field1:'b', field3:100},
      {field1:'b', field3:200},
      {field1:'a', field3:500}
    ])

    expected = [
      {"field1": "a", "__metrics": {"field3_sum": 503 , "field3_count": 2}},
      {"field1": null, "__metrics": {"field3_sum": 963 , "field3_count": 14}},
      {"field1": "b", "__metrics": {"field3_sum": 393, "field3_count": 9}},
      {"field1": "c", "__metrics": {"field3_sum": 67, "field3_count": 3}}
    ]

    test.deepEqual(expected, cube.cells)

    test.done()

  testVirginVsNonVirginBehaviorWhenMustKeepValues: (test) ->
    facts = csvStyleArray_To_ArrayOfMaps([
      ['field1', 'field3',],
      ['a'     , 3        ],
      ['a'     , 3        ]
    ])

    dimensions = [
      {field: 'field1'}
    ]

    metrics = [
      {field: 'field3', metrics:[
        {f: 'p75'},
        {f: 'count'}
      ]}
    ]

    config = {dimensions, metrics}

    config.keepValues = false

    expected = [
      {"field1": "a", "__metrics": {"field3_p75": 3 , "field3_count": 2}},
    ]

    cube = new OLAPCube(config, facts)

    test.deepEqual(expected, cube.cells)

    f = () ->
      cube.addFacts({field1: 'a', field3: 3})

    test.throws(f, Error)

    test.done()

  testVirginVsNonVirginBehaviorWhenKeepValuesIsTrue: (test) ->
    facts = csvStyleArray_To_ArrayOfMaps([
      ['field1', 'field3',],
      ['a'     , 3        ],
      ['a'     , 3        ]
    ])

    dimensions = [
      {field: 'field1'}
    ]

    metrics = [
      {field: 'field3', metrics:[
        {f: 'p75'},
        {f: 'count'}
      ]}
    ]

    config = {dimensions, metrics}

    config.keepValues = true

    expected = [
      {"field1": "a", "__metrics": {"field3_values": [3, 3], "field3_p75": 3 , "field3_count": 2}},
    ]

    cube = new OLAPCube(config, facts)

    test.deepEqual(expected, cube.cells)

    cube.addFacts({field1: 'a', field3: 3})

    expected = [
      {"field1": "a", "__metrics": {"field3_values": [3, 3, 3], "field3_p75": 3 , "field3_count": 3}},
    ]

    test.deepEqual(expected, cube.cells)

    test.done()

  testAverageButNoSum: (test) ->

    facts = csvStyleArray_To_ArrayOfMaps([
      ['field1', 'field3',],
      ['a'     , 3        ],
      ['a'     , 3        ]
    ])

    dimensions = [
      {field: 'field1'}
    ]

    metrics = [
      {field: 'field3', metrics:[
        {f: 'average'},
        {f: 'count'}
      ]}
    ]

    config = {dimensions, metrics}

    config.keepValues = false

    expected = [
      {"field1": "a", "__metrics": {"field3_count": 2, "field3_average": 3}}
    ]

    cube = new OLAPCube(config, facts)

    test.deepEqual(expected, cube.cells)

    f = () ->
      cube.addFacts({field1: 'a', field3: 3})

    test.throws(f, Error)

    test.done()

  testAddFactsLaterWithAverageAndSumAndCountButNotKeepValues: (test) ->

    facts = csvStyleArray_To_ArrayOfMaps([
      ['field1', 'field3',],
      ['a'     , 3        ],
      ['a'     , 3        ]
    ])

    dimensions = [
      {field: 'field1'}
    ]

    metrics = [
      {field: 'field3', metrics:[
        {f: 'average'},
        {f: 'count'},
        {f: 'sum'}
      ]}
    ]

    config = {dimensions, metrics}

    config.keepValues = false

    expected = [
      {"field1": "a", "__metrics": {"field3_count": 2, "field3_sum": 6, "field3_average": 3}}
    ]

    cube = new OLAPCube(config, facts)

    test.deepEqual(expected, cube.cells)

    cube.addFacts({field1: 'a', field3: 3})

    expected = [
      {"field1": "a", "__metrics": {"field3_count": 3, "field3_sum": 9, "field3_average": 3}}
    ]

    test.deepEqual(expected, cube.cells)

    test.done()

  testStandardDeviationButNoSumSquares: (test) ->

    facts = csvStyleArray_To_ArrayOfMaps([
      ['field1', 'field3',],
      ['a'     , 3        ],
      ['a'     , 3        ]
    ])

    dimensions = [
      {field: 'field1'}
    ]

    metrics = [
      {field: 'field3', metrics:[
        {f: 'count'},
        {f: 'sum'},
        {f: 'standardDeviation'}
      ]}
    ]

    config = {dimensions, metrics}

    config.keepValues = false

    expected = [
      {"field1": "a", "__metrics": {"field3_count": 2, "field3_sum": 6, "field3_standardDeviation": 0}}
    ]

    cube = new OLAPCube(config, facts)

    test.deepEqual(expected, cube.cells)

    f = () ->
      cube.addFacts({field1: 'a', field3: 3})

    test.throws(f, Error)

    test.done()

  testVarianceWithCountSumAndSumSquares: (test) ->

    facts = csvStyleArray_To_ArrayOfMaps([
      ['field1', 'field3',],
      ['a'     , 3        ],
      ['a'     , 3        ]
    ])

    dimensions = [
      {field: 'field1'}
    ]

    metrics = [
      {field: 'field3', metrics:[
        {f: 'count'},
        {f: 'sum'},
        {f: 'sumSquares'}
        {f: 'variance'}
      ]}
    ]

    config = {dimensions, metrics}

    config.keepValues = false

    expected = [
      {"field1": "a", "__metrics": {"field3_count": 2, "field3_sum": 6, "field3_sumSquares": 18, "field3_variance": 0}}
    ]

    cube = new OLAPCube(config, facts)

    test.deepEqual(expected, cube.cells)

    cube.addFacts({field1: 'a', field3: 3})

    expected = [
      {"field1": "a", "__metrics": {"field3_count": 3, "field3_sum": 9, "field3_sumSquares": 27, "field3_variance": 0}}
    ]

    test.deepEqual(expected, cube.cells)

    test.done()