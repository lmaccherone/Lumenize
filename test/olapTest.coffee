{olapCalculator, expandRow, possibilities} = require('../src/olap')
{csvStyleArray_To_ArrayOfMaps} = require('../')

exports.olapTest =

  testPossibilities: (test) ->
    test.deepEqual([null, 'a'], possibilities('a'))

    test.deepEqual([null, 7], possibilities(7))

    test.deepEqual([null, '1', '2', '3'], possibilities(['1', '2', '3']))  # Tags

    expected = [
      null,
      ['1', '2', '3'],
      ['1', '2'],
      ['1']
    ]
    test.deepEqual(expected, possibilities(['1', '2', '3'], 'hierarchy'))  # Hierarchy
    test.done()

  testExpandRow: (test) ->
    singleRow =
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
      {singleValueField: 'a', hierarchicalField: ['1'], __rows:[singleRow], __metrics: expectedMetrics},
      {singleValueField: 'a', hierarchicalField: ['1','2'], __rows:[singleRow], __metrics: expectedMetrics},
      {singleValueField: 'a', hierarchicalField: ['1','2','3'], __rows:[singleRow], __metrics: expectedMetrics},
      {singleValueField: 'a', hierarchicalField: null, __rows:[singleRow], __metrics: expectedMetrics},
      {singleValueField: null, hierarchicalField: ['1'], __rows:[singleRow], __metrics: expectedMetrics}
      {singleValueField: null, hierarchicalField: ['1','2'], __rows:[singleRow], __metrics: expectedMetrics},
      {singleValueField: null, hierarchicalField: ['1','2','3'], __rows:[singleRow], __metrics: expectedMetrics},
      {singleValueField: null, hierarchicalField: null, __rows:[singleRow], __metrics: expectedMetrics}
    ]

    actual = expandRow(singleRow, dimensions, metrics)
    test.deepEqual(expected, actual)

    test.done()

  testOLAP: (test) ->
    aCSVStyle = [
      ['field1', 'field2'     , 'field3', 'field4'],
      ['a'     , ['1','2','3'], 7       , 3       ],
      ['b'     , ['1','2']    , 70      , 30      ]
    ]

    rows = csvStyleArray_To_ArrayOfMaps(aCSVStyle)

    dimensions = [
      {field: 'field1'},
      {field: 'field2', type:'hierarchy'}
    ]

    metrics = [
      {field: 'field3'},
      {field: 'field4', metrics: [
        {as: 'median4', f: 'p50'},
        {f: 'sum'},
        {as: 'myCount', f: (values) -> return values.length}
      ]}
    ]

    config = {dimensions, metrics}

    olapCalc = olapCalculator(rows, config)

    console.log(JSON.stringify(olapCalc, undefined, 4))

    test.done()