utils = require('../src/utils')

possibilities = (key, type) ->
  switch utils.type(key)
    when 'array'
      a = [null]
      if type == 'hierarchy'
        len = key.length
        while len > 0
          a.push(key.slice(0, len))
          len--
      else  # assume it's a tag array
        a = [null].concat(key)
      return a
    when 'string', 'number'
      return [null, key]


decrement = (a, rollover) ->
  i = a.length - 1
  a[i]--
  while a[i] < 0
    a[i] = rollover[i]
    i--
    if i < 0
      return false
    else
      a[i]--
  return true

expandRow = (row, dimensions, metrics) ->
  possibilitiesArray = []
  countdownArray = []
  rolloverArray = []
  for d in dimensions
    p = possibilities(row[d.field], d.type)
    possibilitiesArray.push(p)
    countdownArray.push(p.length - 1)
    rolloverArray.push(p.length - 1)  # !TODO: If I need some speed, we could calculate the rolloverArray once and make a copy to the countdownArray for each run

  out = []
  more = true
  while more
    outRow = {}
    for d, index in dimensions
      outRow[d.field] = possibilitiesArray[index][countdownArray[index]]
    outRow.__rows = [row]
    metricsOut = {}
    for m in metrics
      metricsOut[m.field + '_values'] = [row[m.field]]
    outRow.__metrics = metricsOut
    out.push(outRow)
    more = decrement(countdownArray, rolloverArray)

  return out

extractFilter = (row, dimensions) ->
  out = {}
  for d in dimensions
    out[d.field] = row[d.field]
  return out

mergeIntoOLAPArray = (olapArray, olapIndex, expandedRowArray, dimensions) ->
  for er in expandedRowArray
    filterString = JSON.stringify(extractFilter(er, dimensions))
    olapRow = olapIndex[filterString]
    if olapRow?
      console.log('found a match on ' + filterString)
      olapRow.__rows = olapRow.__rows.concat(er.__rows)
      currentMetrics = olapRow.__metrics
      for key, value of er.__metrics
        currentMetrics[key] = currentMetrics[key].concat(value)
    else
      olapRow = er
      olapIndex[filterString] = olapRow
      olapArray.push(olapRow)

olapCalculator = (rows, config) ->
  olapArray = []
  olapIndex = {}
  for row in rows
    expandedRowArray = expandRow(row, config.dimensions, config.metrics)
    mergeIntoOLAPArray(olapArray, olapIndex, expandedRowArray, config.dimensions)

  # calculate metrics for olapArray

  return olapArray

exports.expandRow = expandRow
exports.possibilities = possibilities
exports.olapCalculator = olapCalculator

