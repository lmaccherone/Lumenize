
async = require('async')
#MongoDBStore = require('../lib/MongoDBStore').MongoDBStore
{MongoClient, ObjectID} = require('mongodb')
lumenize = require('Lumenize')
fs = require('fs')
path = require('path')

mergeObjects = (o1, o2) ->
  out = {}
  for key, value of o1
    out[key] = value
  for key, value of o2
    out[key] = value
  return out

class BigDump
  constructor: (@independentVariable, @dependentVariable) ->
    @db = null
    @globalOptions = {}
    @globalOptions = {limit: 1000}
    @globalQuery = {}
    #    @globalQuery = {workspaceOid:"41529001", runID: new ObjectID('511508288a78ab0000000001')}
    #    @globalQuery = {runId: {$in: [
    #      new ObjectID('5124e0d3255a58d587000001'),
    #      new ObjectID('511a4c69ca72330000000001'),
    #      new ObjectID('5127ba700279130000000001'),  # TIP Trend
    #      new ObjectID('5127926ecd69537495000001'),  # latest coefficient of variation
    #      new ObjectID('5127a084bae16ffc9a000001')  # Throughput Trend
    #    ]}}
    @metricsToGet =
#      "RealTeam": {metricDefinitionName:'RealTeam', granularity:'month'}
#      "DedicatedTeamSize": {metricDefinitionName:'DedicatedTeamSize', granularity:'quarter'}
#      "FullTimeEquivalent": {metricDefinitionName:'FullTimeEquivalent', granularity:'quarter'}
#      "PercentDedicatedWork": {metricDefinitionName:'PercentDedicatedWork', granularity:'quarter'}
      "TeamStability": {metricDefintionName: 'PercentDedicatedWork', granularity: 'quarter'}
#      "Defects": {metricDefinitionName:'Defects', granularity:'month'}
#      "ReleasedDefects": {metricDefinitionName:'ReleasedDefects', granularity:'month'}
#      "DefectDensity": {metricDefinitionName:'DefectDensity', granularity:'month'}
#      "ReleasedDefectDensity": {metricDefinitionName:'ReleasedDefectDensity', granularity:'month'}
#      "DefectDensity3Month": {metricDefinitionName:'DefectDensity', granularity:'quarter'}
#      "DefectDensity6Month": {metricDefinitionName:'DefectDensity', granularity:'half-year'}
#      "DefectDensity12Month": {metricDefinitionName:'DefectDensity', granularity:'year'}
#      "ReleasedDefectDensity3Month": {metricDefinitionName:'ReleasedDefectDensity', granularity:'quarter'}
#      "ReleasedDefectDensity6Month": {metricDefinitionName:'ReleasedDefectDensity', granularity:'half-year'}
#      "ReleasedDefectDensity12Month": {metricDefinitionName:'ReleasedDefectDensity', granularity:'year'}

#      "MeanThroughputDefectPoints": {metricDefinitionName:'MeanThroughputDefectPoints', granularity:'month'}
#      "StdDevThroughputDefectPoints": {metricDefinitionName:'StdDevThroughputDefectPoints', granularity:'month'}
#      "p50ThroughputDefectPoints": {metricDefinitionName:'p50ThroughputDefectPoints', granularity:'month'}
#      "CoefficientOfVarianceOnThroughputDefectPoints": {metricDefinitionName:'CoefficientOfVarianceOnThroughputDefectPoints', granularity:'month'}
#      "PredictabilityScoreDefectPoints": {metricDefinitionName:'PredictabilityScoreDefectPoints', granularity:'month'}
#      "MeanThroughputDefectTransactions": {metricDefinitionName:'MeanThroughputDefectTransactions', granularity:'month'}
#      "StdDevThroughputDefectTransactions": {metricDefinitionName:'StdDevThroughputDefectTransactions', granularity:'month'}
#      "p50ThroughputDefectTransactions": {metricDefinitionName:'p50ThroughputDefectTransactions', granularity:'month'}
#      "CoefficientOfVarianceOnThroughputDefectTransactions": {metricDefinitionName:'CoefficientOfVarianceOnThroughputDefectTransactions', granularity:'month'}
#      "CoefficientOfVarianceOnThroughputDefectTransactions": {metricDefinitionName:'CoefficientOfVarianceOnThroughputDefectTransactions', granularity:'month'}
#      "PredictabilityScoreDefectTransactions": {metricDefinitionName:'PredictabilityScoreDefectTransactions', granularity:'month'}

#      "MeanThroughputDefectPoints3Month": {metricDefinitionName:'MeanThroughputDefectPoints', granularity:'quarter'}
#      "StdDevThroughputDefectPoints3Month": {metricDefinitionName:'StdDevThroughputDefectPoints', granularity:'quarter'}
#      "p50ThroughputDefectPoints3Month": {metricDefinitionName:'p50ThroughputDefectPoints', granularity:'quarter'}
#      "CoefficientOfVarianceOnThroughputDefectPoints3Month": {metricDefinitionName:'CoefficientOfVarianceOnThroughputDefectPoints', granularity:'quarter'}
#      "PredictabilityScoreDefectPoints3Month": {metricDefinitionName:'PredictabilityScoreDefectPoints', granularity:'quarter'}
#      "MeanThroughputDefectTransactions3Month": {metricDefinitionName:'MeanThroughputDefectTransactions', granularity:'quarter'}
#      "StdDevThroughputDefectTransactions3Month": {metricDefinitionName:'StdDevThroughputDefectTransactions', granularity:'quarter'}
#      "p50ThroughputDefectTransactions3Month": {metricDefinitionName:'p50ThroughputDefectTransactions', granularity:'quarter'}
#      "CoefficientOfVarianceOnThroughputDefectTransactions3Month": {metricDefinitionName:'CoefficientOfVarianceOnThroughputDefectTransactions', granularity:'quarter'}
#      "CoefficientOfVarianceOnThroughputDefectTransactions3Month": {metricDefinitionName:'CoefficientOfVarianceOnThroughputDefectTransactions', granularity:'quarter'}
#      "PredictabilityScoreDefectTransactions3Month": {metricDefinitionName:'PredictabilityScoreDefectTransactions', granularity:'quarter'}

#      "MeanThroughputStoryPoints3Month": {metricDefinitionName:'MeanThroughputStoryPoints', granularity:'quarter'}
#      "StdDevThroughputStoryPoints3Month": {metricDefinitionName:'StdDevThroughputStoryPoints', granularity:'quarter'}
#      "p50ThroughputStoryPoints3Month": {metricDefinitionName:'p50ThroughputStoryPoints', granularity:'quarter'}
#      "CoefficientOfVarianceOnThroughputStoryPoints3Month": {metricDefinitionName:'CoefficientOfVarianceOnThroughputStoryPoints', granularity:'quarter'}
#      "PredictabilityScoreStoryPoints3Month": {metricDefinitionName:'PredictabilityScoreStoryPoints', granularity:'quarter'}

#      "MeanThroughputStoryTransactions3Month": {metricDefinitionName:'MeanThroughputStoryTransactions', granularity:'quarter'}
#      "StdDevThroughputStoryTransactions3Month": {metricDefinitionName:'StdDevThroughputStoryTransactions', granularity:'quarter'}
#      "p50ThroughputStoryTransactions3Month": {metricDefinitionName:'p50ThroughputStoryTransactions', granularity:'quarter'}
#      "CoefficientOfVarianceOnThroughputStoryTransactions3Month": {metricDefinitionName:'CoefficientOfVarianceOnThroughputStoryTransactions', granularity:'quarter'}
#      "PredictabilityScoreStoryTransactions3Month": {metricDefinitionName:'PredictabilityScoreStoryTransactions', granularity:'quarter'}
#
#      "TimeInProcessStoryP50": {metricDefinitionName:'TimeInProcessStoryP50', granularity:'month'}
#      "TimeInProcessStoryP50Score": {metricDefinitionName:'TimeInProcessStoryP50Score', granularity:'month'}
#      "TimeInProcessStoryP75": {metricDefinitionName:'TimeInProcessStoryP75', granularity:'month'}
#      "TimeInProcessStoryP75Score": {metricDefinitionName:'TimeInProcessStoryP75Score', granularity:'month'}
#      "TimeInProcessStoryP95": {metricDefinitionName:'TimeInProcessStoryP95', granularity:'month'}
#      "TimeInProcessStoryP95Score": {metricDefinitionName:'TimeInProcessStoryP95Score', granularity:'month'}

#      "TimeInProcessStoryP503Month": {metricDefinitionName:'TimeInProcessStoryP50', granularity:'quarter'}
#      "TimeInProcessStoryP50Score3Month": {metricDefinitionName:'TimeInProcessStoryP50Score', granularity:'quarter'}
#      "TimeInProcessStoryP753Month": {metricDefinitionName:'TimeInProcessStoryP75', granularity:'quarter'}
#      "TimeInProcessStoryP75Score3Month": {metricDefinitionName:'TimeInProcessStoryP75Score', granularity:'quarter'}
#      "TimeInProcessStoryP953Month": {metricDefinitionName:'TimeInProcessStoryP95', granularity:'quarter'}
#      "TimeInProcessStoryP95Score3Month": {metricDefinitionName:'TimeInProcessStoryP95Score', granularity:'quarter'}

#      "ThroughputTrendStoryTransactions": {metricDefinitionName:'ThroughputTrendStoryTransactions', granularity:'month'}
#      "ProductivityScoreStoryTransactions": {metricDefinitionName:'ProductivityScoreStoryTransactions', granularity:'month'}
#      "ThroughputTrendStoryPoints": {metricDefinitionName:'ThroughputTrendStoryPoints', granularity:'month'}
#      "ProductivityScoreStoryPoints": {metricDefinitionName:'ProductivityScoreStoryPoints', granularity:'month'}

#      "ThroughputTrendStoryTransactions3Month": {metricDefinitionName:'ThroughputTrendStoryTransactions', granularity:'quarter'}
#      "ProductivityScoreStoryTransactions3Month": {metricDefinitionName:'ProductivityScoreStoryTransactions', granularity:'quarter'}
    #      "ThroughputTrendStoryPoints3Month": {metricDefinitionName:'ThroughputTrendStoryPoints', granularity:'quarter'}
    #      "ProductivityScoreStoryPoints3Month": {metricDefinitionName:'ProductivityScoreStoryPoints', granularity:'quarter'}

    # Set up OLAP cube
    nonNullValue = (values) ->
      for v in values
        if v?
          return v

    metrics = [
      {as: 'projectOid', field: 'projectOid', f: nonNullValue},
      {as: 'startOn', field: 'startOn', f: nonNullValue},
      {as: 'granularity', field: 'granularity', f: nonNullValue},
    ]

    for as, queryClauses of @metricsToGet
      metricsRow = {as: as, field: as, f: nonNullValue}
      metrics.push(metricsRow)

    dimensions = [
      {field: 'rowGrouper'}
    ]

    deriveFieldsOnOutput = [
      {as: 'DRE', f: (row) ->
        if row.Defects? and row.ReleasedDefects? and row.Defects isnt 0
          return (row.Defects - row.ReleasedDefects) / row.Defects
        else
          return undefined
      }
    ]

    config = {metrics, dimensions, deriveFieldsOnOutput}
    @cube = new lumenize.OLAPCube(config)

    async.waterfall([
      @openDB,
      @getTheData,
#      @processResults,
      @exit
    ], (err) ->  # !TODO: is this real?
      console.log(err)
    )

  openDB: (callback) =>
    console.log('in openDB')
    MongoClient.connect(process.env.MONGO_URL, {strict: true}, (err, @db) =>
      if err then throw err
      console.log('connected')
      callback(err, @db)
    )

  metricGetterCreator = (cube, as, globalQuery, globalOptions, db, queryClauses) ->
    getter = (callback) =>
      queryObject = mergeObjects(globalQuery, queryClauses)
      db.collection('Metric').find(queryObject, globalOptions).toArray((err, results) ->
        console.log("Query returned #{results.length} for #{as}-#{queryObject.granularity}")
        for r in results
          r.rowGrouper = r.projectOid + "|-|" + r.startOn + "|-|"
          r[as] = r.value
        cube.addFacts(results)
        callback(err, results)
      )
    return getter

  getTheData: (db, callback) =>
    console.log('in getTheData')

    getters = {}
    for as, queryClauses of @metricsToGet
      this['get' + as] = metricGetterCreator(@cube, as, @globalQuery, @globalOptions, @db, queryClauses)
      getters[as] = this['get' + as]

    async.parallel(getters, (err, results) ->
      callback(null, results)
    )

  @arrayOfMaps_To_CSVString = (arrayOfMaps, keys, nullValue = '*') ->
    csvArray = lumenize.arrayOfMaps_To_CSVStyleArray(arrayOfMaps, keys)
    outRows = []
    for row in csvArray
      s = ''
      #      (JSON.stringify(value) for value in row).join(', ')
      for value, index in row
        if index isnt 0
          s += ','
        if value?
          s += JSON.stringify(value)
        else
          s +='*'
      outRows.push(s)
    return outRows.join('\n')

  processResults: (results, callback) =>
    console.log('in processResults')
    ###
    Line them up into correlated Team/TimeFrame
    may mean that the granularity as well as startOn of the dependentVariable could be different from the independentVariable
    ###
    console.log('in processResults')
    for key, value of results
      console.log(key, value.length)

    #    console.log(@cube.getCells()[0])

    # remove non-RealTeams
    out = []
    count = 0
    for cell in @cube.getCells()
      if cell.RealTeam is 1
        delete cell._count
        delete cell.RealTeam
        delete cell.rowGrouper
        for key, value of cell
          if key.slice(key.length - 7) is '_values'
            delete cell[key]
        out.push(cell)
        count++

    s = BigDump.arrayOfMaps_To_CSVString(out)

    console.log("Rows in output: ", count)

    fs.writeFileSync(path.join(__dirname, 'bigDump.csv'), s)

    callback(null, 'goodbye')

  exit: (message, callback) ->
    console.log(message)
    process.exit(0)

console.log('hello')

c = new BigDump()


