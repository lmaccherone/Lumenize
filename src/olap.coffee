utils = require('../src/utils')
{functions} = require('../')

possibilities = (key, type, keepTotals) ->
  switch utils.type(key)
    when 'array'
      if keepTotals
        a = [null]
      else
        a = []
      if type == 'hierarchy'
        len = key.length
        while len > 0
          a.push(key.slice(0, len))
          len--
      else  # assume it's a tag array
        if keepTotals
          a = [null].concat(key)
        else
          a = key
      return a
    when 'string', 'number'
      if keepTotals
        return [null, key]
      else
        return [key]


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

expandRow = (row, config) ->
  possibilitiesArray = []
  countdownArray = []
  rolloverArray = []
  for d in config.dimensions
    p = possibilities(row[d.field], d.type, config.keepTotals)
    possibilitiesArray.push(p)
    countdownArray.push(p.length - 1)
    rolloverArray.push(p.length - 1)  # !TODO: If I need some speed, we could calculate the rolloverArray once and make a copy to the countdownArray for each run

  out = []
  more = true
  while more
    outRow = {}
    for d, index in config.dimensions
      outRow[d.field] = possibilitiesArray[index][countdownArray[index]]
    if config.keepRows
      outRow.__rows = [row]
    metricsOut = {}
    for m in config.metrics
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

mergeIntoOLAPArray = (olapArray, olapIndex, expandedRowArray, config) ->
  for er in expandedRowArray
    filterString = JSON.stringify(extractFilter(er, config.dimensions))
    olapRow = olapIndex[filterString]
    if olapRow?
      if config.keepRows
        olapRow.__rows = olapRow.__rows.concat(er.__rows)
      currentMetrics = olapRow.__metrics
      for key, value of er.__metrics
        currentMetrics[key] = currentMetrics[key].concat(value)
    else
      olapRow = er
      olapIndex[filterString] = olapRow
      olapArray.push(olapRow)

olapCalculator = (rows, config) ->
  unless config.trackRows?
    config.trackRows = true
  olapArray = []
  olapIndex = {}
  for row in rows
    expandedRowArray = expandRow(row, config)
    mergeIntoOLAPArray(olapArray, olapIndex, expandedRowArray, config)

  # calculate metrics for olapArray
  for row in olapArray
    currentMetrics = row.__metrics
    for m in config.metrics
      currentField = m.field
      currentValues = currentMetrics[currentField + '_values']
      unless m.metrics?
        m.metrics = [
          {f: 'count'},
          {f: 'sum'},
          {f: 'sumSquares'}
        ]
      for m2 in m.metrics
        {f, as} = functions.extractFandAs(m2, currentField)
        currentMetrics[as] = f(currentValues)
      unless config.keepValues
        delete currentMetrics[currentField + "_values"]

  return olapArray

exports.expandRow = expandRow
exports.possibilities = possibilities
exports.olapCalculator = olapCalculator

