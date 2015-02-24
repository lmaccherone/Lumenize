{table} = require('../')

exports.tableTest =

  testTable: (test) ->
    t = [
      {col1: 'hello', col2: 12, col3: true},
      {col1: 'goodbye', col2: 120, col3: false},
      {col1: 'yep', col2: -23, col3: true},
    ]

    actual = table.toString(t, null, 'col2', true)

    expected = '''
      | col1    | col2 | col3  |
      | ------- | ---- | ----- |
      | goodbye | 120  | false |
      | hello   | 12   | true  |
      | yep     | -23  | true  |
    '''

    test.deepEqual(actual, expected)

    test.done()

  testNullAndMissing: (test) ->
    t = [
      {col1: 'hello', col2: 12, col3: null},
      {col1: 'goodbye', col3: false},
      {col2: -23, col3: true},
    ]

    actual = table.toString(t, null, 'col2', false)

    expected = '''
      | col1    | col2 | col3  |
      | ------- | ---- | ----- |
      |         | -23  | true  |
      | hello   | 12   |       |
      | goodbye |      | false |
    '''

    test.deepEqual(actual, expected)

    test.done()