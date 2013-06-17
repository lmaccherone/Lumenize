{utils} = require('tztime')

table = {}

table.padToWidth = (s, width, padCharacter = ' ', rightPad = false) ->
  if s.length > width
    return s.substr(0, width)
  padding = new Array(width - s.length + 1).join(padCharacter)
  if rightPad
    return s + padding
  else
    return padding + s

table.toString = (rows, fields, sortBy, descending = false) ->
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