{utils} = require('tztime')

table = {}
###
@class table
###

table.padToWidth = (s, width, padCharacter = ' ', rightPad = false) ->
  if s.length > width
    return s.substr(0, width)
  padding = new Array(width - s.length + 1).join(padCharacter)
  if rightPad
    return s + padding
  else
    return padding + s

table.toString = (rows, fields, sortBy, descending = false) ->
  ###
  @method toString
  @param {Object[]} rows
  @param {Object} [fields] If not provided, it will use the fields found in the first row
  @param {String} [sortBy] If provided, it will sort the table by this field before returning
  @param {Boolean} [descending = false] By default, the sort will be ascending, setting this to true will sort descending
  @return {String} Returns a string for the table in Markdown format

      t = [
        {col1: 'hello', col2: 12, col3: true},
        {col1: 'goodbye', col2: 120, col3: false},
        {col1: 'yep', col2: -23, col3: true},
      ]

      console.log(require('../').table.toString(t, null, 'col2', true))
      # | col1    | col2 | col3  |
      # | ------- | ---- | ----- |
      # | goodbye | 120  | false |
      # | hello   | 12   | true  |
      # | yep     | -23  | true  |

  ###
  unless fields?
    fields = []
    for key, value of rows[0]
      fields.push(key)
  maxWidths = []
  for field, index in fields
    maxWidths.push(field.length)  # !TODO: Support for Markdown style justification |:---:| or |---:| and number formatting
    for row in rows
      maxWidths[index] = Math.max(maxWidths[index], row[field].toString().length)

  if sortBy?
    sortedRows = utils._.sortBy(rows, sortBy)
    if descending
      sortedRows = sortedRows.reverse()
  else
    sortedRows = rows

  s = '|'
  for field, index in fields
    s += ' '
    s += table.padToWidth(field, maxWidths[index], undefined, true) + ' |'  # !TODO: Change undefined for justification

  s += '\n|'
  for field, index in fields
    s += ' '
    s += table.padToWidth('', maxWidths[index], '-', true) + ' |'  # !TODO: Add colons for justification

  for row in sortedRows
    s += '\n|'
    for field, index in fields
      s += ' '
      s += table.padToWidth(row[field].toString(), maxWidths[index], undefined, true) + ' |'  # !TODO: Change undefined for justification

  return s

exports.table = table