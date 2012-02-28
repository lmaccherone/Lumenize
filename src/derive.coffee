deriveFields = (list, derivedFields) ->
  ###  
  To use this, you must `require` it
  
      {deriveFields, deriveFieldsAt} = require('../')

  Takes a list like:

      list = [
        {a: 1, b: 2},
        {a: 3, b: 4}
      ]
      
  and a list of derivations like:
  
      derivations = [
        {name: 'sum', f: (row) -> row.a + row.b}
      ]
  
  and upgrades the list in place with the derived fields like:
  
      deriveFields(list, derivations)
      
      console.log(list)
      # [ { a: 1, b: 2, sum: 3 }, { a: 3, b: 4, sum: 7 } ]

  Note: the derivations are calculated in order so you can use the output of one derivation as the input to one
  that appears later in the derivations list.
  ###
  for row in list
    for d in derivedFields
      row[d.name] = d.f(row)
      
deriveFieldsAt = (atArray, derivedFields) ->
  ###
  Sends every sub-array in atArray to deriveFields upgrading the atArray in place.
  ###
  for a in atArray
    deriveFields(a, derivedFields)
  

exports.deriveFields = deriveFields
exports.deriveFieldsAt = deriveFieldsAt
