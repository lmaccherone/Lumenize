{olapCalculator, expandFact, possibilities} = require('../src/olap')
{csvStyleArray_To_ArrayOfMaps} = require('../')

exports.olapTest =

  testPossibilities: (test) ->
    test.deepEqual([null, 'a'], possibilities('a', undefined, true))

    test.deepEqual([null, 7], possibilities(7, undefined, true))

    test.deepEqual([null, '1', '2', '3'], possibilities(['1', '2', '3'], undefined, true))  # Tags

    expected = [
      null,
      ['1', '2', '3'],
      ['1', '2'],
      ['1']
    ]
    test.deepEqual(expected, possibilities(['1', '2', '3'], 'hierarchy', true))  # Hierarchy
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
    config.keepRows = true

    actual = expandFact(singleFact, config)
    test.deepEqual(expected, actual)

    test.done()

  testOLAP: (test) ->
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

    olapCalc = olapCalculator(facts, config)

    test.deepEqual(expected, olapCalc)

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

    olapCalc = olapCalculator(facts, config)

    expected = [
      {"field1": "a", "__metrics": {"field3_sum": 3 , "field3_count": 1}},
      {"field1": "b", "__metrics": {"field3_sum": 93, "field3_count": 7}},
      {"field1": "c", "__metrics": {"field3_sum": 57, "field3_count": 2}}
    ]

    test.deepEqual(expected, olapCalc)

    test.done()