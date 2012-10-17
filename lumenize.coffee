# !TODO: Clean up dependencies in package.json to only allow for patch updates so say, 0.3.x rather than >=0.3.0


exports.timezoneJS = require('timezone-js').timezoneJS

exports.utils = require('./src/utils')

exports.ChartTime = require('./src/ChartTime').ChartTime

chartTimeIteratorAndRange = require('./src/ChartTimeIteratorAndRange')
exports.ChartTimeIterator = chartTimeIteratorAndRange.ChartTimeIterator
exports.ChartTimeRange = chartTimeIteratorAndRange.ChartTimeRange

exports.ChartTimeInStateCalculator = require('./src/ChartTimeInStateCalculator').ChartTimeInStateCalculator

datatransform = require('./src/dataTransform')
exports.csvStyleArray_To_ArrayOfMaps = datatransform.csvStyleArray_To_ArrayOfMaps
exports.snapshotArray_To_AtArray = datatransform.snapshotArray_To_AtArray
exports.groupByAtArray_To_HighChartsSeries = datatransform.groupByAtArray_To_HighChartsSeries
exports.aggregationAtArray_To_HighChartsSeries = datatransform.aggregationAtArray_To_HighChartsSeries

aggregate = require('./src/aggregate')
exports.aggregate = aggregate.aggregate
exports.aggregateAt = aggregate.aggregateAt
exports.groupBy = aggregate.groupBy
exports.groupByAt = aggregate.groupByAt
exports.functions = aggregate.functions
exports.percentileCreator = aggregate.percentileCreator
exports.timeSeriesCalculator = aggregate.timeSeriesCalculator
exports.timeSeriesGroupByCalculator = aggregate.timeSeriesGroupByCalculator

derive = require('./src/derive')
exports.deriveFields = derive.deriveFields
exports.deriveFieldsAt = derive.deriveFieldsAt

exports.histogram = require('./src/histogram').histogram
