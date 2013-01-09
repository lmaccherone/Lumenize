{functions} = require('../')

cleanUpMetrics = (metrics) ->
  confirmMetricAbove = (metric, fieldName, aboveThisIndex) =>
    if metric is 'count'
      lookingFor = '_' + metric
    else
      lookingFor = fieldName + '_' + metric
    i = 0
    while i < aboveThisIndex
      currentRow = metrics[i]
      if currentRow.as == lookingFor
        return true
      i++
    # OK, it's not above, let's now see if it's below. Then throw error.
    i = aboveThisIndex + 1
    metricsLength = metrics.length
    while i < metricsLength
      currentRow = metrics[i]
      if currentRow.as == lookingFor
        throw new Error("Depdencies must appear before the metric they are dependant upon. #{metric} appears after.")
      i++
    return false

  assureDependenciesAbove = (dependencies, fieldName, aboveThisIndex) =>
    for d in dependencies
      unless confirmMetricAbove(d, fieldName, aboveThisIndex)
        if d == 'count'
          newRow = {metric: 'count'}
        else
          newRow = {metric: d, field: fieldName}
        functions.expandFandAs(newRow)
        metrics.unshift(newRow)
        return false
    return true

  for m in metrics
    functions.expandFandAs(m)

  index = 0
  while index < metrics.length  # intentionally not caching length because the loop can add rows
    metricsRow = metrics[index]
    if metricsRow.f.dependencies?
      unless assureDependenciesAbove(metricsRow.f.dependencies, metricsRow.field, index)
        index = -1
    index++
    
  return metrics


metrics = [
  {metric: 'average', field: 'a'},
  {metric: 'variance', field: 'b'}
  {metric: 'standardDeviation', field: 'c'}
]

cleanUpMetrics(metrics)

console.log(JSON.stringify(metrics, undefined, 4))

#console.log(test.confirmDependenciesAbove(['count', 'sum'], 'a', 2))
#console.log(test.confirmDependenciesAbove(['count', 'sum', 'sumSquares'], 'b', 6))
#console.log(test.confirmDependenciesAbove(['count', 'sum', 'sumSquares'], 'c', 8))
