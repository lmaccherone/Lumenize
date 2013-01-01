OLAPCube = require('../src/OLAPCube').OLAPCube
{csvStyleArray_To_ArrayOfMaps} = require('../')
utils = require('../src/utils')

###
Test to-do
  min and max without values
  push the field down into the metrics field like derived fields
  flatten the metrics into the rows
###
exports.olapTest =

  testSimple: (test) ->
    facts = [
      {_ProjectHierarchy: [1, 2, 3], Priority: 1, Points: 10},
      {_ProjectHierarchy: [1, 2, 4], Priority: 2, Points: 5 },
      {_ProjectHierarchy: [5]      , Priority: 1, Points: 17},
      {_ProjectHierarchy: [1, 2]   , Priority: 1, Points: 3 },
    ]

    dimensions = [
      {field: "_ProjectHierarchy", type: 'hierarchy'},
      {field: "Priority"}
    ]

    metrics = [
      {field: "Points", metrics: [
        {as: "Scope", f: "sum"},
        {f: "standardDeviation"}
      ]}
    ]

    config = {dimensions, metrics}
    config.keepTotals = true

    cube = new OLAPCube(config, facts)

    expected = {
      _ProjectHierarchy: null,
      Priority: 1,
      __metrics: {count: 3, Scope: 30, Points_standardDeviation: 7}
    }

    test.deepEqual(expected, cube.getCell({Priority: 1}))

    expected = {
      _ProjectHierarchy: [ 1 ],
      Priority: null,
      __metrics: {count: 3, Scope: 18, Points_standardDeviation: 3.605551275463989}
    }
    test.deepEqual(expected, cube.getCell({_ProjectHierarchy: [1]}))

    expected = [null, [1], [1, 2], [1, 2, 3], [1, 2, 4], [5]]
    test.deepEqual(expected, cube.getDimensionValues('_ProjectHierarchy'))

    expected = [null, 1, 2]
    test.deepEqual(expected, cube.getDimensionValues('Priority'))

    expected = '''
      |        || Total |     1     2|
      |==============================|
      |Total   ||    35 |    30     5|
      |------------------------------|
      |[1]     ||    18 |    13     5|
      |[1,2]   ||    18 |    13     5|
      |[1,2,3] ||    10 |    10      |
      |[1,2,4] ||     5 |           5|
      |[5]     ||    17 |    17      |
    '''

    outString = cube.toString('_ProjectHierarchy', 'Priority', 'Scope')
    test.equal(expected, outString)

    test.done()

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
      'count': 1
      'facts': [singleFact]
      'field3_values': [7]
      'field4_values': [3]

    expected = [
      {singleValueField: 'a', hierarchicalField: ['1'], __metrics: expectedMetrics},
      {singleValueField: 'a', hierarchicalField: ['1','2'], __metrics: expectedMetrics},
      {singleValueField: 'a', hierarchicalField: ['1','2','3'], __metrics: expectedMetrics},
      {singleValueField: 'a', hierarchicalField: null, __metrics: expectedMetrics},
      {singleValueField: null, hierarchicalField: ['1'], __metrics: expectedMetrics}
      {singleValueField: null, hierarchicalField: ['1','2'], __metrics: expectedMetrics},
      {singleValueField: null, hierarchicalField: ['1','2','3'], __metrics: expectedMetrics},
      {singleValueField: null, hierarchicalField: null, __metrics: expectedMetrics}
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
          "count": 1,
          "field3_values": [7],
          "field4_values": [3],
          "field3_sum": 7,
          "median4": 3,
          "field4_sum": 3,
          "myCount": 1
        }
      },
      {"field1": "a", "field2": ["1", "2"], "__metrics": {
          "count": 1,
          "field3_values": [7],
          "field4_values": [3],
          "field3_sum": 7,
          "median4": 3,
          "field4_sum": 3,
          "myCount": 1
        }
      },
      {"field1": "a", "field2": ["1", "2", "3"], "__metrics": {
          "count": 1,
          "field3_values": [7],
          "field4_values": [3],
          "field3_sum": 7,
          "median4": 3,
          "field4_sum": 3,
          "myCount": 1
        }
      },
      {"field1": "a", "field2": null, "__metrics": {
          "count": 1,
          "field3_values": [7],
          "field4_values": [3],
          "field3_sum": 7,
          "median4": 3,
          "field4_sum": 3,
          "myCount": 1
        }
      },
      {"field1": null, "field2": ["1"], "__metrics": {
          "count": 2,
          "field3_values": [7, 70],
          "field4_values": [3, 30],
          "field3_sum": 77,
          "median4": 16.5,
          "field4_sum": 33,
          "myCount": 2
          }
      },
      {"field1": null, "field2": ["1", "2"], "__metrics": {
          "count": 2,
          "field3_values": [7, 70],
          "field4_values": [3, 30],
          "field3_sum": 77,
          "median4": 16.5,
          "field4_sum": 33,
          "myCount": 2
        }
      },
      {"field1": null, "field2": ["1", "2", "3"], "__metrics": {
          "count": 1,
          "field3_values": [7],
          "field4_values": [3],
          "field3_sum": 7,
          "median4": 3,
          "field4_sum": 3,
          "myCount": 1
        }
      },
      {"field1": null, "field2": null, "__metrics": {
          "count": 2,
          "field3_values": [7, 70],
          "field4_values": [3, 30],
          "field3_sum": 77,
          "median4": 16.5,
          "field4_sum": 33,
          "myCount": 2
        }
      },
      {"field1": "b", "field2": ["1"], "__metrics": {
          "count": 1,
          "field3_values": [70],
          "field4_values": [30],
          "field3_sum": 70,
          "median4": 30,
          "field4_sum": 30,
          "myCount": 1
        }
      },
      {"field1": "b", "field2": ["1", "2"], "__metrics": {
          "count": 1,
          "field3_values": [70],
          "field4_values": [30],
          "field3_sum": 70,
          "median4": 30,
          "field4_sum": 30,
          "myCount": 1
        }
      },
      {"field1": "b", "field2": null, "__metrics": {
          "count": 1,
          "field3_values": [70],
          "field4_values": [30],
          "field3_sum": 70,
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
        "count": 1,
        "field3_values": [70],
        "field4_values": [30],
        "field3_sum": 70,
        "median4": 30,
        "field4_sum": 30,
        "myCount": 1
      }
    }
    test.deepEqual(expected, cube.getCell({field1: "b"}))

    expected = {
      "field1": "b", "field2": ["1"], "__metrics": {
        "count": 1,
        "field3_values": [70],
        "field4_values": [30],
        "field3_sum": 70,
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
        {f: 'sum'}
      ]}
    ]

    config = {dimensions, metrics}

    cube = new OLAPCube(config, facts)

    expected = [
      {"field1": "a", "__metrics": {"field3_sum": 3, "count": 1}},
      {"field1": "b", "__metrics": {"field3_sum": 93, "count": 7}},
      {"field1": "c", "__metrics": {"field3_sum": 57, "count": 2}}
    ]

    test.deepEqual(expected, cube.cells)

    config.keepTotals = true

    cube = new OLAPCube(config, facts)

    expected = [
      {"field1": "a", "__metrics": {"field3_sum": 3 , "count": 1}},
      {"field1": null, "__metrics": {"field3_sum": 153 , "count": 10}},
      {"field1": "b", "__metrics": {"field3_sum": 93, "count": 7}},
      {"field1": "c", "__metrics": {"field3_sum": 57, "count": 2}}
    ]

    test.deepEqual(expected, cube.cells)

    cube.addFacts({field1:'c', field3:10})

    expected = [
      {"field1": "a", "__metrics": {"field3_sum": 3 , "count": 1}},
      {"field1": null, "__metrics": {"field3_sum": 163 , "count": 11}},
      {"field1": "b", "__metrics": {"field3_sum": 93, "count": 7}},
      {"field1": "c", "__metrics": {"field3_sum": 67, "count": 3}}
    ]

    test.deepEqual(expected, cube.cells)

    cube.addFacts([
      {field1:'b', field3:100},
      {field1:'b', field3:200},
      {field1:'a', field3:500}
    ])

    expected = [
      {"field1": "a", "__metrics": {"field3_sum": 503 , "count": 2}},
      {"field1": null, "__metrics": {"field3_sum": 963 , "count": 14}},
      {"field1": "b", "__metrics": {"field3_sum": 393, "count": 9}},
      {"field1": "c", "__metrics": {"field3_sum": 67, "count": 3}}
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
        {f: 'p75'}
      ]}
    ]

    config = {dimensions, metrics}

    config.keepValues = false

    expected = [
      {"field1": "a", "__metrics": {"field3_p75": 3 , "count": 2}},
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
        {f: 'p75'}
      ]}
    ]

    config = {dimensions, metrics}

    config.keepValues = true

    expected = [
      {"field1": "a", "__metrics": {"field3_values": [3, 3], "field3_p75": 3 , "count": 2}},
    ]

    cube = new OLAPCube(config, facts)

    test.deepEqual(expected, cube.cells)

    cube.addFacts({field1: 'a', field3: 3})

    expected = [
      {"field1": "a", "__metrics": {"field3_values": [3, 3, 3], "field3_p75": 3 , "count": 3}},
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
        {f: 'average'}
      ]}
    ]

    config = {dimensions, metrics}

    config.keepValues = false

    expected = [
      {"field1": "a", "__metrics": {"count": 2, "field3_average": 3}}
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
        {f: 'sum'}
      ]}
    ]

    config = {dimensions, metrics}

    config.keepValues = false

    expected = [
      {"field1": "a", "__metrics": {"count": 2, "field3_sum": 6, "field3_average": 3}}
    ]

    cube = new OLAPCube(config, facts)

    test.deepEqual(expected, cube.cells)

    cube.addFacts({field1: 'a', field3: 3})

    expected = [
      {"field1": "a", "__metrics": {"count": 3, "field3_sum": 9, "field3_average": 3}}
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
        {f: 'sum'},
        {f: 'standardDeviation'}
      ]}
    ]

    config = {dimensions, metrics}

    config.keepValues = false

    expected = [
      {"field1": "a", "__metrics": {"count": 2, "field3_sum": 6, "field3_standardDeviation": 0}}
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
        {f: 'sum'},
        {f: 'sumSquares'}
        {f: 'variance'}
      ]}
    ]

    config = {dimensions, metrics}

    config.keepValues = false

    expected = [
      {"field1": "a", "__metrics": {"count": 2, "field3_sum": 6, "field3_sumSquares": 18, "field3_variance": 0}}
    ]

    cube = new OLAPCube(config, facts)

    test.deepEqual(expected, cube.cells)

    cube.addFacts({field1: 'a', field3: 3})

    expected = [
      {"field1": "a", "__metrics": {"count": 3, "field3_sum": 9, "field3_sumSquares": 27, "field3_variance": 0}}
    ]

    test.deepEqual(expected, cube.cells)

    test.done()

  testSaveAndRestore: (test) ->
    facts = [
      {ProjectHierarchy: [1, 2, 3], Priority: 1},
      {ProjectHierarchy: [1, 2, 4], Priority: 2},
      {ProjectHierarchy: [5]      , Priority: 1},
      {ProjectHierarchy: [1, 2]   , Priority: 1},
    ]

    dimensions = [
      {field: "ProjectHierarchy", type: 'hierarchy'},
      {field: "Priority"}
    ]

    config = {dimensions, metrics: []}
    config.keepTotals = true

    originalCube = new OLAPCube(config, facts)

    dateString = '2012-12-27T12:34:56.789Z'
    saveString = originalCube.stringify({upToDate: dateString})
    restoredCube = OLAPCube.newFromSavedState(saveString)

    newFacts = [
      {ProjectHierarchy: [5], Priority: 3},
      {ProjectHierarchy: [1, 2, 4], Priority: 1}
    ]
    originalCube.addFacts(newFacts)
    restoredCube.addFacts(newFacts)

    test.equal(restoredCube.toString(), originalCube.toString())

    test.equal(dateString, restoredCube.meta.upToDate)

    test.done()

  testLastValueMinMax: (test) ->
    facts = [
      {ProjectHierarchy: [1, 2, 3], Priority: 1},
      {ProjectHierarchy: [1, 2, 4], Priority: 2},
      {ProjectHierarchy: [5]      , Priority: 3},
      {ProjectHierarchy: [1, 2]   , Priority: 4},
    ]

    dimensions = [
      {field: "ProjectHierarchy", type: 'hierarchy'}
    ]

    metrics = [
      {field: 'Priority', metrics: [
        {f: 'lastValue'},
        {f: 'min'},
        {f: 'max'}
      ]}
    ]

    config = {dimensions, metrics}

    cube = new OLAPCube(config, facts)

    newFacts = [
      {ProjectHierarchy: [5], Priority: 7},
      {ProjectHierarchy: [1, 2, 4], Priority: 8}
    ]

    cube.addFacts(newFacts)

    test.equal(cube.getCell({ProjectHierarchy: [1]}).__metrics.Priority_lastValue, 8)
    test.equal(cube.getCell({ProjectHierarchy: [1, 2, 3]}).__metrics.Priority_lastValue, 1)
    test.equal(cube.getCell({ProjectHierarchy: [5]}).__metrics.Priority_lastValue, 7)

    cell = cube.getCell({ProjectHierarchy: [5]})
    test.equal(cell.__metrics.Priority_min, 3)
    test.equal(cell.__metrics.Priority_max, 7)

    test.done()