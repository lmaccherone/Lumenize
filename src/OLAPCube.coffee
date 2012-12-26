utils = require('../src/utils')
{functions} = require('../')


class OLAPCube
  ###
  @class OLAPCube

  __An efficient, in-memory, incrementally-updateable, hierarchy-capable OLAP Cube implementation.__

  OLAP Cubes are a powerful abstraction that makes it easier to do everything from simple group-by operations to more
  complex multi-dimensional and hierarchical analysis. This implementation has the same conceptual ancestry as implementations found
  in business intelligence and OLAP database solutions. However, it is meant as a light weight alternative primarily
  targeting the goal of making it easier for developers to implement desired analysis. It has also been
  implemented to support serialization and incremental updating so it's ideally suited for visualizations and analysis
  that are updated on a periodic or continuous basis.

  It will take "facts" in the form of an Array of Maps (JavaScript Objects) and aggregate them according to your
  specifications.

  Let's say you have a fact like this

      fact = {
        dimensionField: 'a',
        hierarchicalDimensionField: ['1','2','3'],
        tagDimensionField: ['x', 'y', 'z'],
        valueField1: 10,
        valueField2: 3
      }

  You could specify that the first three fields in this fact should define the dimensions of your cube as follows:

      dimensions = [
        {field: 'dimensionField'},
        {field: 'hierarchicalDimensionField', type: 'hierarchy'},
        {field: 'tagDimensionField'}
      ]

  This will create a 3-dimensional cube where each unique value for dimensionField, hierarchicalDimensionField, and
  tagDimensionField defines a different cell in the cube. Note, this happens to be 3-dimension cube, but you can have
  a 1-dimension cube (a simple group-by), 2-dimension (pivot table), or n-dimension even where n is greater than 3.

  Next, we need to tell the OLAPCube what fields to base our metrics upon and what metrics to calculate for each cell
  in the cube.

      metrics = [
        {field: 'valueField1'},                                 # defaults to metrics of (count, sum, sumSquares)
        {field: 'valueField2', metrics: [
          {f: 'sum'},                                           # will add a metric named field4_sum
          {as: 'median4', f: 'p50'},                            # renamed p50 to median4 from default of field4_p50
          {as: 'myCount', f: (values) -> return values.length}  # user-supplied function
        ]}
      ]

  Notice how the default metrics for each field is

  ###

  ###
  @constructor
  @param {Object} config See Config options for details. DO NOT change the config settings after the OLAP class is instantiated.
  @param {Object[]} [facts] Optional parameter allowing the population of the OLAPCube with an intitial set of facts
    upon instantiation. Use addFacts() to add facts after instantiation.
  @cfg {Object[]} metrics (required) Array which specifies the metrics to calculate for each cell in the cube.

    Example:

      config = {}
      config.metrics = [
        {field: 'field3'},                                      # defaults to metrics of (count, sum, sumSquares)
        {field: 'field4', metrics: [
          {f: 'sum'},                                           # will add a metric named field4_sum
          {as: 'median4', f: 'p50'},                            # renamed p50 to median4 from default of field4_p50
          {as: 'myCount', f: (values) -> return values.length}  # user-supplied function
        ]}
      ]

    See OLAPCube documentation for more examples.

  @cfg {Object[]} dimensions (required) Array which specifies the fields to use as dimension fields. If the field contains a
    hierarchy array, say so in the row, (e.g. `{field: 'SomeFieldName', type: 'hierarchy'}`). Any array values that it
    finds in the supplied facts will be assumed to be tags rather than a hierarchy specification unless `type: 'hierarchy'`
    is specified.

    For example, let's say you have a set of facts that look like this:

      fact = {dimensionField: 'a', hierarchicalDimensionField: ['1','2','3'], tagDimensionField: ['x', 'y', 'z'], valueField: 10}

    Then a set of dimensions like this makes sense.

      config.dimensions = [
        {field: 'dimensionField'},
        {field: 'hierarchicalDimensionField', type: 'hierarchy'},
        {field: 'tagDimensionField'}
      ]

  @cfg {Boolean} [keepValues=false] Setting this will have a similar effect as including `f: "values"` for all metrics fields.
    If you are going to incrementally update the OLAPCube, then you are required to set this to true if you are using
    any functions other than count, sum, sumSquares, variance, or standardDeviation.
  @cfg {Boolean} [keepTotals=false] Setting this will add an additional total row (indicated with field: null) along
    all dimensions. This setting can have a significant impact on the memory usage and performance of the OLAPCube so
    if things are tight, only use it if you really need it.
  @cfg {Boolean} [keepFacts=false] Setting this will cause the OLAPCube to keep track of the facts that contributed to
    the metrics for each cell by adding a __facts field to each cell.
  ###
  constructor: (@config, facts) ->
    @cells = []
    @cellIndex = {}
    @virgin = true
    @_dirtyCells = []
    @_dirtyCellIndex = {}
    @_dimensionUniqueValues = {}

    unless @config.keepValues
      @config.keepValues = false
    unless @config.keepTotals
      @config.keepTotals = false
    unless @config.keepFacts
      @config.keepFacts = false

    # add default metrics if not specified
    for m in @config.metrics
      unless m.metrics?
        m.metrics = [
          {f: 'count'},
          {f: 'sum'},
          {f: 'sumSquares'}
        ]

    # determine if values must be kept
    @mustKeepValuesToAdd = false
    for m in @config.metrics
      hasCount = false
      hasSum = false
      hasSumSquares = false
      for m2 in m.metrics
        switch m2.f
          when 'count'
            hasCount = true
          when 'sum'
            hasSum = true
          when 'sumSquares'
            hasSumSquares = true
      for m2 in m.metrics
        if m2.f in ['count', 'sum', 'sumSquares']
          # do nothing
        else if m2.f == 'average'
          unless hasCount and hasSum
            @mustKeepValuesToAdd = true
        else if m2.f in ['variance', 'standardDeviation']
          unless hasCount and hasSum and hasSumSquares
            @mustKeepValuesToAdd = true
        else
          @mustKeepValuesToAdd = true

    @addFacts(facts)
  
  @_possibilities: (key, type, keepTotals) ->
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
  
  
  @_decrement: (a, rollover) ->
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
  
  _expandFact: (fact) ->
    possibilitiesArray = []
    countdownArray = []
    rolloverArray = []
    for d in @config.dimensions
      p = OLAPCube._possibilities(fact[d.field], d.type, @config.keepTotals)
      possibilitiesArray.push(p)
      countdownArray.push(p.length - 1)
      rolloverArray.push(p.length - 1)  # !TODO: If I need some speed, we could calculate the rolloverArray once and make a copy to the countdownArray for each run
  
    out = []
    more = true
    while more
      outRow = {}
      for d, index in @config.dimensions
        outRow[d.field] = possibilitiesArray[index][countdownArray[index]]
      if @config.keepFacts
        outRow.__facts = [fact]
      metricsOut = {}
      for m in @config.metrics
        metricsOut[m.field + '_values'] = [fact[m.field]]
      outRow.__metrics = metricsOut
      out.push(outRow)
      more = OLAPCube._decrement(countdownArray, rolloverArray)
  
    return out
  
  @_extractFilter: (row, dimensions) ->
    out = {}
    for d in dimensions
      out[d.field] = row[d.field]
    return out
  
  _mergeIntoData: (expandedFactArray) ->
    for er in expandedFactArray
      filterString = JSON.stringify(OLAPCube._extractFilter(er, @config.dimensions))
      olapRow = @cellIndex[filterString]
      if olapRow?
        if @config.keepFacts
          olapRow.__facts = olapRow.__facts.concat(er.__facts)
        currentMetrics = olapRow.__metrics
        for key, value of er.__metrics
          unless currentMetrics[key]?
            currentMetrics[key] = []
          currentMetrics[key] = currentMetrics[key].concat(value)
      else
        olapRow = er
        @cellIndex[filterString] = olapRow
        @cells.push(olapRow)

      unless @_dirtyCellIndex[filterString]?
        @_dirtyCellIndex[filterString] = olapRow
        @_dirtyCells.push(olapRow)

  @_variance: (count, sum, sumSquares) ->
    return (count * sumSquares - sum * sum) / (count * (count - 1))

  @_standardDeviation: (count, sum, sumSquares) ->
    return Math.sqrt(count, sum, sumSquares)

  ###
  @method addFacts
    Adds facts to the OLAPCube.

  @chainable
  @param {Object[]} facts An Array of facts to be aggregated into OLAPCube. Each fact is a Map where the keys are the field names
    and the values are the field values (e.g. `{field1: 'a', field2: 5}`).
  ###
  addFacts: (facts) ->

    if utils.type(facts) == 'array'
      if facts.length <= 0
        return
    else
      if facts?
        facts = [facts]
      else
        return

    if not @virgin and @mustKeepValuesToAdd and not @config.keepValues
      throw new Error('Must specify config.keepValues to add facts with this set of metrics.')

    for fact in facts
      expandedFactArray = @_expandFact(fact)
      @_mergeIntoData(expandedFactArray)
  
    # calculate metrics for @cells
    if @config.keepValues or @virgin
      for olapRow in @_dirtyCells
        currentMetrics = olapRow.__metrics
        for m in @config.metrics
          currentField = m.field
          currentValues = currentMetrics[currentField + '_values']
          currentCount = null
          currentSum = null
          currentSumSquares = null

          if @mustKeepValuesToAdd
            for m2 in m.metrics
              {f, as} = functions.extractFandAs(m2, currentField)
              currentMetrics[as] = f(currentValues)
          else
            for m2 in m.metrics
              {f, as} = functions.extractFandAs(m2, currentField)
              if m2.f == 'count'
                currentCount = f(currentValues)
                currentMetrics[as] = currentCount
              else if m2.f == 'sum'
                currentSum = f(currentValues)
                currentMetrics[as] = currentSum
              else if m2.f == 'sumSquares'
                currentSumSquares = f(currentValues)
                currentMetrics[as] = currentSumSquares
            for m2 in m.metrics
              {f, as} = functions.extractFandAs(m2, currentField)
              if m2.f == 'average'
                currentMetrics[as] = currentSum / currentCount
              else if m2.f == 'variance'
                currentMetrics[as] = OLAPCube._variance(currentCount, currentSum, currentSumSquares)
              else if m2.f == 'standardDeviation'
                currentMetrics[as] = OLAPCube._standardDeviation(currentCount, currentSum, currentSumSquares)
              else
                unless m2.f in ['count', 'sum', 'sumSquares']
                  currentMetrics[as] = f(currentValues)

          unless @config.keepValues
            delete currentMetrics[currentField + "_values"]

    else  # not @virgin and not @config.keepValues
      for olapRow in @_dirtyCells
        currentMetrics = olapRow.__metrics
        for m in @config.metrics
          currentField = m.field
          currentValues = currentMetrics[currentField + '_values']
          currentCount = null
          currentSum = null
          currentSumSquares = null
          for m2 in m.metrics
            {f, as} = functions.extractFandAs(m2, currentField)
            if m2.f == 'count'
              currentCount = currentMetrics[as] + currentValues.length
              currentMetrics[as] = currentCount
            else if m2.f == 'sum'
              currentSum = currentMetrics[as] + functions.sum(currentValues)
              currentMetrics[as] = currentSum
            else if m2.f == 'sumSquares'
              currentSumSquares = currentMetrics[as] + functions.sumSquares(currentValues)
              currentMetrics[as] = currentSumSquares
          for m2 in m.metrics
            {f, as} = functions.extractFandAs(m2, currentField)
            if m2.f == 'average'
              currentMetrics[as] = currentSum / currentCount
            else if m2.f == 'variance'
              currentMetrics[as] = OLAPCube._variance(currentCount, currentSum, currentSumSquares)
            else if m2.f == 'standardDeviation'
              currentMetrics[as] = OLAPCube._standardDeviation(currentCount, currentSum, currentSumSquares)
            else
              unless m2.f in ['count', 'sum', 'sumSquares']
                throw new Error('If we have this error, then we have a bug with sensing the need for @mustKeepValuesToAdd.')

          unless @config.keepValues
            delete currentMetrics[currentField + "_values"]

    @virgin = false
    @_dirtyCells = []
    @_dirtyCellIndex = {}
    @_dimensionUniqueValues = {}
    return this

#  ###
#  @method slice
#  @param {Object[]} dimensions
#  @return {OLAPCube}
#
#  returns a new OLAPCube that is a subset of this OLAPCube with one or more dimensions of only a set value or completely
#  removed.
#  ###
#  slice: (dimensions) ->
  
#  ###
#  @method getDimensionUniqueValues

  ###
  @method getCells
    Returns a subset of the cells that match the supplied filter. You can perform slice and dice operations using
    this. If you have criteria for all of the dimensions, you are better off using `getCell()`. Most times, it's
    better to iterate over the unique values for the dimensions of interest using `getCell()` in place of slice or
    dice operations.
  @param {Object} [filter] Specifies the constraints that the returned cells must match in the form of
    `{field1: value1, field2: value2}. If this parameter is missing, the internal @cells array is returned.
  @return {Object[]} Returns the cells that match the supplied filter
  ###
  getCells: (filter) ->
    unless filter?
      return cells

    output = []
    for c in @cells
      if utils.filterMatch(filter, c)
        output.push(c)
    return output

  ###
  @method getCell
    Returns the single cell matching the supplied filter. Iterating over the unique values for the dimensions of
    interest, you can incrementally retrieve a slice or dice using this method. Since `getCell()` always uses an index,
    in most cases, this is better than using `getCells()` to prefetch a slice or dice.
  @param {Object} Specifies the constraints for the returned cell in the form of `{field1: value1, field2: value2}.
    Any fields that are specified in config.dimensions that are missing from the filter are automatically filled in
    with null.
  @return {Object[]} Returns the cell that match the supplied filter
  ###
  getCell: (filter) ->
    normalizedFilter = {}
    for d in @config.dimensions
      if filter.hasOwnProperty(d.field)
        normalizedFilter[d.field] = filter[d.field]
      else
        normalizedFilter[d.field] = null
    return @cellIndex[JSON.stringify(normalizedFilter)]

exports.OLAPCube = OLAPCube

