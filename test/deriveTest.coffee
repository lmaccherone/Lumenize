{deriveFields, deriveFieldsAt} = require('../')

exports.deriveTest =

  testDeriveFields: (test) ->
  
    list = [
      {a: 1, b: 2},
      {a: 3, b: 4}
    ]
      
    derivations = [
      {name: 'sum', f: (row) -> row.a + row.b}
    ]

    deriveFields(list, derivations)
    
    expected = [ 
      { a: 1, b: 2, 'sum': 3 },
      { a: 3, b: 4, 'sum': 7 } 
    ] 
    
    test.deepEqual(list, expected)
    
    test.done()
    
  testDeriveFieldsAt: (test) ->
  
    list1 = [
      {a: 1, b: 2},
      {a: 3, b: 4}
    ]
    
    list2 = [
      {a: 5, b: 6},
      {a: 7, b: 8}
    ]
    
    derivations = [
      {name: 'sum', f: (row) -> row.a + row.b}
    ]
    
    lists = [list1, list2]

    deriveFieldsAt(lists, derivations)
    
    expected = [
      [ 
        { a: 1, b: 2, 'sum': 3 },
        { a: 3, b: 4, 'sum': 7 } 
      ],
      [ 
        { a: 5, b: 6, 'sum': 11 },
        { a: 7, b: 8, 'sum': 15 } 
      ]
    ]

    test.deepEqual(lists, expected)
    
    test.done()
    
    