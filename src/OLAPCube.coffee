# !TODO: Add summary metrics
# !TODO: Be smart enough to move dependent metrics to the deriveFieldsOnOutput

{utils} = require('tztime')
functions = require('./functions').functions
{arrayOfMaps_To_CSVStyleArray, csvStyleArray_To_ArrayOfMaps} = require('./dataTransform')
JSON = require('JSON2')

class OLAPCube
  ###
  @class OLAPCube

  __An efficient, in-memory, incrementally-updateable, hierarchy-capable OLAP Cube implementation.__

  [OLAP Cubes](http://en.wikipedia.org/wiki/OLAP_cube) are a powerful abstraction that makes it easier to do everything
  from simple group-by operations to more complex multi-dimensional and hierarchical analysis. This implementation has
  the same conceptual ancestry as implementations found in business intelligence and OLAP database solutions. However,
  it is meant as a light weight alternative primarily targeting the goal of making it easier for developers to implement
  desired analysis. It also supports serialization and incremental updating so it's ideally
  suited for visualizations and analysis that are updated on a periodic or even continuous basis.

  ## Features ##

  * In-memory
  * Incrementally-updateable
  * Serialize (`getStateForSaving()`) and deserialize (`newFromSavedState()`) to preserve aggregations between sessions
  * Accepts simple JavaScript Objects as facts
  * Storage and output as simple JavaScript Arrays of Objects
  * Hierarchy (trees) derived from fact data assuming [materialized path](http://en.wikipedia.org/wiki/Materialized_path)
    array model commonly used with NoSQL databases

  ## 2D Example ##

  Let's walk through a simple 2D example from facts to output. Let's say you have this set of facts:

      facts = [
        {ProjectHierarchy: [1, 2, 3], Priority: 1, Points: 10},
        {ProjectHierarchy: [1, 2, 4], Priority: 2, Points: 5 },
        {ProjectHierarchy: [5]      , Priority: 1, Points: 17},
        {ProjectHierarchy: [1, 2]   , Priority: 1, Points: 3 },
      ]

  The ProjectHierarchy field models its hierarchy (tree) as an array containing a
  [materialized path](http://en.wikipedia.org/wiki/Materialized_path). The first fact is "in" Project 3 whose parent is
  Project 2, whose parent is Project 1. The second fact is "in" Project 4 whose parent is Project 2 which still has
  Project 1 as its parent. Project 5 is another root Project like Project 1; and the fourth fact is "in" Project 2.
  So the first fact will roll-up the tree and be aggregated against [1], and [1, 2] as well as [1, 2, 3]. Root Project 1
  will get the data from all but the third fact which will get aggregated against root Project 5.

  We specify the ProjectHierarchy field as a dimension of type 'hierarchy' and the Priorty field as a simple value dimension.

      dimensions = [
        {field: "ProjectHierarchy", type: 'hierarchy'},
        {field: "Priority"}
      ]

  This will create a 2D "cube" where each unique value for ProjectHierarchy and Priority defines a different cell.
  Note, this happens to be a 2D "cube" (more commonly referred to as a [pivot table](http://en.wikipedia.org/wiki/Pivot_Table)),
  but you can also have a 1D cube (a simple group-by), a 3D cube, or even an n-dimensional hypercube where n is greater than 3.

  You can specify any number of metrics to be calculated for each cell in the cube.

      metrics = [
        {field: "Points", f: "sum", as: "Scope"}
      ]

  You can use any of the aggregation functions found in Lumenize.functions except `count`. The count metric is
  automatically tracked for each cell. The `as` specification is optional unless you provide a custom function. If missing,
  it will build the name of the resulting metric from the field name and the function. So without the `as: "Scope"` the
  second metric in the example above would have been named "Points_sum".

  You can also use custom functions in the form of `f(values) -> return <some function of values>`.

  Next, we build the config parameter from our dimension and metrics specifications.

      config = {dimensions, metrics}

  Hierarchy dimensions automatically roll up but you can also tell it to keep all totals by setting config.keepTotals to
  true. The totals are then kept in the cells where one or more of the dimension values are set to `null`. Note, you
  can also set keepTotals for individual dimension and should probably use that if you have more than a few dimensions
  but we're going to set it globally here:

      config.keepTotals = true

  Now, let's create the cube.

      {OLAPCube} = require('../')
      cube = new OLAPCube(config, facts)

  `getCell()` allows you to extract a single cell. The "total" cell for all facts where Priority = 1 can be found as follows:

      console.log(cube.getCell({Priority: 1}))
      # { ProjectHierarchy: null, Priority: 1, _count: 3, Scope: 30 }

  Notice how the ProjectHierarchy field value is `null`. This is because it is a total cell for Priority dimension
  for all ProjectHierarchy values. Think of `null` values in this context as wildcards.

  Similarly, we can get the total for all descendants of ProjectHierarchy = [1] regarless of Priority as follows:

      console.log(cube.getCell({ProjectHierarchy: [1]}))
      # { ProjectHierarchy: [ 1 ], Priority: null, _count: 3, Scope: 18 }

  `getCell()` uses the cellIndex so it's very efficient. Using `getCell()` and `getDimensionValues()`, you can iterate
  over a slice of the OLAPCube. It is usually preferable to access the cells in place like this rather than the
  traditional OLAP approach of extracting a slice for processing.

      rowValues = cube.getDimensionValues('ProjectHierarchy')
      columnValues = cube.getDimensionValues('Priority')
      s = OLAPCube._padToWidth('', 7) + ' | '
      s += ((OLAPCube._padToWidth(JSON.stringify(c), 7) for c in columnValues).join(' | '))
      s += ' | '
      console.log(s)
      for r in rowValues
        s = OLAPCube._padToWidth(JSON.stringify(r), 7) + ' | '
        for c in columnValues
          cell = cube.getCell({ProjectHierarchy: r, Priority: c})
          if cell?
            cellString = JSON.stringify(cell._count)
          else
            cellString = ''
          s += OLAPCube._padToWidth(cellString, 7) + ' | '
        console.log(s)
      #         |    null |       1 |       2 |
      #    null |       4 |       3 |       1 |
      #     [1] |       3 |       2 |       1 |
      #   [1,2] |       3 |       2 |       1 |
      # [1,2,3] |       1 |       1 |         |
      # [1,2,4] |       1 |         |       1 |
      #     [5] |       1 |       1 |         |

  Or you can just call `toString()` method which extracts a 2D slice for tabular display. Both approachs will work on
  cubes of any number of dimensions two or greater. The manual example above extracted the `count` metric. We'll tell
  the example below to extract the `Scope` metric.

      console.log(cube.toString('ProjectHierarchy', 'Priority', 'Scope'))
      # |        || Total |     1     2|
      # |==============================|
      # |Total   ||    35 |    30     5|
      # |------------------------------|
      # |[1]     ||    18 |    13     5|
      # |[1,2]   ||    18 |    13     5|
      # |[1,2,3] ||    10 |    10      |
      # |[1,2,4] ||     5 |           5|
      # |[5]     ||    17 |    17      |

  ## Dimension types ##

  The following dimension types are supported:

  1. Single value
     * Number
     * String
     * Does not work:
       * Boolean - known to fail
       * Object - may sorta work but sort-order at least is not obvious
       * Date - not tested but may actually work
  2. Arrays as materialized path for hierarchical (tree) data
  3. Non-hierarchical Arrays ("tags")

  There is no need to tell the OLAPCube what type to use with the exception of #2. In that case, add `type: 'hierarchy'`
  to the dimensions row like this:

      dimensions = [
        {field: 'hierarchicalDimensionField', type: 'hierarchy'} #, ...
      ]

  ## Hierarchical (tree) data ##

  This OLAP Cube implementation assumes your hierarchies (trees) are modeled as a
  [materialized path](http://en.wikipedia.org/wiki/Materialized_path) array. This approach is commonly used with NoSQL databases like
  [CouchDB](http://probablyprogramming.com/2008/07/04/storing-hierarchical-data-in-couchdb) and
  [MongoDB (combining materialized path and array of ancestors)](http://docs.mongodb.org/manual/tutorial/model-tree-structures/)
  and even SQL databases supporting array types like [Postgres](http://justcramer.com/2012/04/08/using-arrays-as-materialized-paths-in-postgres/).

  This approach differs from the traditional OLAP/MDX fixed/named level hierarchy approach. In that approach, you assume
  that the number of levels in the hierarchy are fixed. Also, each level in the hierarchy is either represented by a different
  column (clothing example --> level 0: SEX column - mens vs womens; level 1: TYPE column - pants vs shorts vs shirts; etc.) or
  predetermined ranges of values in a single field (date example --> level 0: year; level 1: quarter; level 2: month; etc.)

  However, the approach used by this OLAPCube implementaion is the more general case, because it can easily simulate
  fixed/named level hierachies whereas the reverse is not true. In the clothing example above, you would simply key
  your dimension off of a derived field that was a combination of the SEX and TYPE columns (e.g. ['mens', 'pants'])

  ## Date/Time hierarchies ##

  Lumenize is designed to work well with the tzTime library. Here is an example of taking a bunch of ISOString data
  and doing timezone precise hierarchical roll up based upon the date segments (year, month).

      data = [
        {date: '2011-12-31T12:34:56.789Z', value: 10},
        {date: '2012-01-05T12:34:56.789Z', value: 20},
        {date: '2012-01-15T12:34:56.789Z', value: 30},
        {date: '2012-02-01T00:00:01.000Z', value: 40},
        {date: '2012-02-15T12:34:56.789Z', value: 50},
      ]

      {Time} = require('../')

      config =
        deriveFieldsOnInput: [{
          field: 'dateSegments',
          f: (row) ->
            return new Time(row.date, Time.MONTH, 'America/New_York').getSegmentsAsArray()
        }]
        metrics: [{field: 'value', f: 'sum'}]
        dimensions: [{field: 'dateSegments', type: 'hierarchy'}]

      cube = new OLAPCube(config, data)
      console.log(cube.toString(undefined, undefined, 'value_sum'))
      # | dateSegments | value_sum |
      # |==========================|
      # | [2011]       |        10 |
      # | [2011,12]    |        10 |
      # | [2012]       |       140 |
      # | [2012,1]     |        90 |
      # | [2012,2]     |        50 |

  Notice how '2012-02-01T00:00:01.000Z' got bucketed in January because the calculation was done in timezone
  'America/New_York'.

  ## Non-hierarchical Array fields ##

  If you don't specify type: 'hierarchy' and the OLAPCube sees a field whose value is an Array in a dimension field, the
  data in that fact would get aggregated against each element in the Array. So a non-hierarchical Array field like
  ['x', 'y', 'z'] would get aggregated against 'x', 'y', and 'z' rather than ['x'], ['x', 'y'], and ['x','y','z]. This
  functionality is useful for  accomplishing analytics on tags, but it can be used in other powerful ways. For instance
  let's say you have a list of events:

      events = [
        {name: 'Renaissance Festival', activeMonths: ['September', 'October']},
        {name: 'Concert Series', activeMonths: ['July', 'August', 'September']},
        {name: 'Fall Festival', activeMonths: ['September']}
      ]

  You could figure out the number of events active in each month by specifying "activeMonths" as a dimension.
  Lumenize.TimeInStateCalculator (and other calculators in Lumenize) use this technique.
  ###

  constructor: (@userConfig, facts) ->
    ###
    @constructor
    @param {Object} config See Config options for details. DO NOT change the config settings after the OLAP class is instantiated.
    @param {Object[]} [facts] Optional parameter allowing the population of the OLAPCube with an intitial set of facts
      upon instantiation. Use addFacts() to add facts after instantiation.
    @cfg {Object[]} dimensions Array which specifies the fields to use as dimension fields. If the field contains a
      hierarchy array, say so in the row, (e.g. `{field: 'SomeFieldName', type: 'hierarchy'}`). Any array values that it
      finds in the supplied facts will be assumed to be tags rather than a hierarchy specification unless `type: 'hierarchy'`
      is specified.

      For example, let's say you have a set of facts that look like this:

        fact = {
          dimensionField: 'a',
          hierarchicalDimensionField: ['1','2','3'],
          tagDimensionField: ['x', 'y', 'z'],
          valueField: 10
        }

      Then a set of dimensions like this makes sense.

        config.dimensions = [
          {field: 'dimensionField'},
          {field: 'hierarchicalDimensionField', type: 'hierarchy'},
          {field: 'tagDimensionField', keepTotals: true}
        ]

      Notice how a keepTotals can be set for an individual dimension. This is preferable to setting it for the entire
      cube in cases where you don't want totals in all dimensions.

    @cfg {Object[]} [metrics=[]] Array which specifies the metrics to calculate for each cell in the cube.

      Example:

        config = {}
        config.metrics = [
          {field: 'field3'},                                      # defaults to metrics: ['sum']
          {field: 'field4', metrics: [
            {f: 'sum'},                                           # will add a metric named field4_sum
            {as: 'median4', f: 'p50'},                            # renamed p50 to median4 from default of field4_p50
            {as: 'myCount', f: (values) -> return values.length}  # user-supplied function
          ]}
        ]

      If you specify a field without any metrics, it will assume you want the sum but it will not automatically
      add the sum metric to fields with a metrics specification. User-supplied aggregation functions are also supported as
      shown in the 'myCount' metric above.

      Note, if the metric has dependencies (e.g. average depends upon count and sum) it will automatically add those to
      your metric definition. If you've already added a dependency but put it under a different "as", it's not smart
      enough to sense that and it will add it again. Either live with the slight inefficiency and duplication or leave
      dependency metrics named their default by not providing an "as" field.

    @cfg {Boolean} [keepTotals=false] Setting this will add an additional total row (indicated with field: null) along
      all dimensions. This setting can have an impact on the memory usage and performance of the OLAPCube so
      if things are tight, only use it if you really need it. If you don't need it for all dimension, you can specify
      keepTotals for individual dimensions.
    @cfg {Boolean} [keepFacts=false] Setting this will cause the OLAPCube to keep track of the facts that contributed to
      the metrics for each cell by adding an automatic 'facts' metric. Note, facts are restored after deserialization
      as you would expect, but they are no longer tied to the original facts. This feature, especially after a restore
      can eat up memory.
    @cfg {Object[]} [deriveFieldsOnInput] An Array of Maps in the form `{field:'myField', f:(fact)->...}`
    @cfg {Object[]} [deriveFieldsOnOutput] same format as deriveFieldsOnInput, except the callback is in the form `f(row)`
      This is only called for dirty rows that were effected by the latest round of addFacts. It's more efficient to calculate things
      like standard deviation and percentile coverage here than in config.metrics. You just have to remember to include the dependencies
      in config.metrics. Standard deviation depends upon `sum` and `sumSquares`. Percentile coverage depends upon `values`.
      In fact, if you are going to capture values anyway, all of the functions are most efficiently calculated here.
      Maybe some day, I'll write the code to analyze your metrics and move them out to here if it improves efficiency.
    ###
    @config = utils.clone(@userConfig)
    utils.assert(@config.dimensions?, 'Must provide config.dimensions.')
    unless @config.metrics?
      @config.metrics = []
    @cells = []
    @cellIndex = {}
    @currentValues = {}
    @_dimensionValues = {}  # key: fieldName, value: {} where key: uniqueValue, value: the real key (not stringified)
    for d in @config.dimensions
      @_dimensionValues[d.field] = {}

    unless @config.keepTotals
      @config.keepTotals = false
    unless @config.keepFacts
      @config.keepFacts = false

    for d in @config.dimensions
      if @config.keepTotals or d.keepTotals
        d.keepTotals = true
      else
        d.keepTotals = false

    functions.expandMetrics(@config.metrics, true, true)

    @summaryMetrics = {}

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
      p = OLAPCube._possibilities(fact[d.field], d.type, d.keepTotals)
      possibilitiesArray.push(p)
      countdownArray.push(p.length - 1)
      rolloverArray.push(p.length - 1)  # !TODO: If I need some speed, we could calculate the rolloverArray once and make a copy to the countdownArray for each run

    for m in @config.metrics
      @currentValues[m.field] = [fact[m.field]]  # !TODO: Add default values here. I think this is the only place it is needed. write tests with incremental update to confirm.
    out = []
    more = true
    while more
      outRow = {}
      for d, index in @config.dimensions
        outRow[d.field] = possibilitiesArray[index][countdownArray[index]]
      outRow._count = 1
      if @config.keepFacts
        outRow._facts = [fact]
      for m in @config.metrics
        outRow[m.as] = m.f([fact[m.field]], undefined, undefined, outRow, m.field + '_')
      out.push(outRow)
      more = OLAPCube._decrement(countdownArray, rolloverArray)
  
    return out
  
  @_extractFilter: (row, dimensions) ->
    out = {}
    for d in dimensions
      out[d.field] = row[d.field]
    return out
  
  _mergeExpandedFactArray: (expandedFactArray) ->
    for er in expandedFactArray
      # set _dimensionValues
      for d in @config.dimensions
        fieldValue = er[d.field]
        @_dimensionValues[d.field][JSON.stringify(fieldValue)] = fieldValue

      # start merge
      filterString = JSON.stringify(OLAPCube._extractFilter(er, @config.dimensions))
      olapRow = @cellIndex[filterString]
      if olapRow?
        for m in @config.metrics
          olapRow[m.as] = m.f(olapRow[m.field + '_values'], olapRow[m.as], @currentValues[m.field], olapRow, m.field + '_')
      else
        olapRow = er
        @cellIndex[filterString] = olapRow
        @cells.push(olapRow)
      @dirtyRows[filterString] = olapRow

  addFacts: (facts) ->
    ###
    @method addFacts
      Adds facts to the OLAPCube.

    @chainable
    @param {Object[]} facts An Array of facts to be aggregated into OLAPCube. Each fact is a Map where the keys are the field names
      and the values are the field values (e.g. `{field1: 'a', field2: 5}`).
    ###
    @dirtyRows = {}

    if utils.type(facts) == 'array'
      if facts.length <= 0
        return
    else
      if facts?
        facts = [facts]
      else
        return

    if @config.deriveFieldsOnInput
      for fact in facts
        for d in @config.deriveFieldsOnInput
          if d.as?
            fieldName = d.as
          else
            fieldName = d.field
          fact[fieldName] = d.f(fact)

    for fact in facts
      @currentValues = {}
      expandedFactArray = @_expandFact(fact)
      @_mergeExpandedFactArray(expandedFactArray)

    # deriveFieldsOnOutput for @dirtyRows
    if @config.deriveFieldsOnOutput?
      for filterString, dirtyRow of @dirtyRows
        for d in @config.deriveFieldsOnOutput
          if d.as?
            fieldName = d.as
          else
            fieldName = d.field
          dirtyRow[fieldName] = d.f(dirtyRow)
    @dirtyRows = {}

    return this

  getCells: (filterObject) ->
    ###
    @method getCells
      Returns a subset of the cells that match the supplied filter. You can perform slice and dice operations using
      this. If you have criteria for all of the dimensions, you are better off using `getCell()`. Most times, it's
      better to iterate over the unique values for the dimensions of interest using `getCell()` in place of slice or
      dice operations.
    @param {Object} [filterObject] Specifies the constraints that the returned cells must match in the form of
      `{field1: value1, field2: value2}`. If this parameter is missing, the internal cells array is returned.
    @return {Object[]} Returns the cells that match the supplied filter
    ###
    unless filterObject?
      return @cells

    output = []
    for c in @cells
      if utils.filterMatch(filterObject, c)
        output.push(c)
    return output

  getCell: (filter, defaultValue) ->
    ###
    @method getCell
      Returns the single cell matching the supplied filter. Iterating over the unique values for the dimensions of
      interest, you can incrementally retrieve a slice or dice using this method. Since `getCell()` always uses an index,
      in most cases, this is better than using `getCells()` to prefetch a slice or dice.
    @param {Object} [filter={}] Specifies the constraints for the returned cell in the form of `{field1: value1, field2: value2}.
      Any fields that are specified in config.dimensions that are missing from the filter are automatically filled in
      with null. Calling `getCell()` with no parameter or `{}` will return the total of all dimensions (if @config.keepTotals=true).
    @return {Object[]} Returns the cell that match the supplied filter
    ###
    unless filter?
      filter = {}

    for key, value of filter
      foundIt = false
      for d in @config.dimensions
        if d.field == key
          foundIt = true
      unless foundIt
        throw new Error("#{key} is not a dimension for this cube.")

    normalizedFilter = {}
    for d in @config.dimensions
      if filter.hasOwnProperty(d.field)
        normalizedFilter[d.field] = filter[d.field]
      else
        if d.keepTotals
          normalizedFilter[d.field] = null
        else
          throw new Error('Must set keepTotals to use getCell with a partial filter.')
    cell = @cellIndex[JSON.stringify(normalizedFilter)]
    if cell?
      return cell
    else
      return defaultValue

  getDimensionValues: (field, descending = false) ->
    ###
    @method getDimensionValues
      Returns the unique values for the specified dimension in sort order.
    @param {String} field The field whose values you want
    @param {Boolean} [descending=false] Set to true if you want them in reverse order
    ###
    values = utils.values(@_dimensionValues[field])
    values.sort(OLAPCube._compare)
    unless descending
      values.reverse()
    return values

  @_compare: (a, b) ->
    if a is null
      return 1
    if b is null
      return -1
    switch utils.type(a)
      when 'number', 'boolean', 'date'
        return b - a
      when 'array'
        for value, index in a
          if b.length - 1 >= index and value < b[index]
            return 1
          if b.length - 1 >= index and value > b[index]
            return -1
        if a.length < b.length
          return 1
        else if a.length > b.length
          return -1
        else
          return 0
      when 'object', 'string'
        aString = JSON.stringify(a)
        bString = JSON.stringify(b)
        if aString < bString
          return 1
        else if aString > bString
          return -1
        else
          return 0
      else
        throw new Error("Do not know how to sort objects of type #{utils.type(a)}.")


  @roundToSignificance: (value, significance) ->
    unless significance?
      return value
    multiple = 1 / significance
    return Math.round(value * multiple) / multiple

  toString: (rows, columns, metric, significance) ->
    ###
    @method toString
      Produces a printable table with the first dimension as the rows, the second dimension as the columns, and the count
      as the values in the table.
    @return {String} A string which will render as a table when written to the console.
    @param {String} [rows=<first dimension>]
    @param {String} [columns=<second dimension>]
    @param {String} [metric='count']
    @param {Number} [significance] The multiple to which you want to round the bucket edges. 1 means whole numbers.
     0.1 means to round to tenths. 0.01 to hundreds. Etc.
    ###
    unless metric?
      metric = '_count'
    if @config.dimensions.length == 1
      return @toStringOneDimension(@config.dimensions[0].field, metric, significance)
    else
      return @toStringTwoDimensions(rows, columns, metric, significance)

  toStringOneDimension: (field, metric, significance) ->
    rowValues = @getDimensionValues(field)
    rowValueStrings = (JSON.stringify(r) for r in rowValues)
    rowLabelWidth = Math.max.apply({}, (s.length for s in rowValueStrings))
    rowLabelWidth = Math.max(rowLabelWidth, 'Total'.length, field.length)
    maxColumnWidth = metric.length
    valueStrings = []
    for r, indexRow in rowValues
      filter = {}
      filter[field] = r
      cell = @getCell(filter)
      if cell?
        cellString = JSON.stringify(OLAPCube.roundToSignificance(cell[metric], significance))
      else
        cellString = ''
      maxColumnWidth = Math.max(maxColumnWidth, cellString.length)
      valueStrings.push(cellString)

    maxColumnWidth += 1
    fullWidth = rowLabelWidth + maxColumnWidth + 4

    s = '| ' + (OLAPCube._padToWidth(field, rowLabelWidth, ' ', true)) + ' |'
    s += OLAPCube._padToWidth(metric, maxColumnWidth) + ' |'
    s += '\n|' + OLAPCube._padToWidth('', fullWidth, '=') + '|'
    for r, indexRow in rowValueStrings
      s += '\n| '
      if r == 'null'
        s += OLAPCube._padToWidth('Total', rowLabelWidth, ' ', true)
      else
        s += OLAPCube._padToWidth(r, rowLabelWidth, ' ', true)
      s += ' |' + OLAPCube._padToWidth(valueStrings[indexRow], maxColumnWidth) + ' |'

      if r == 'null'
        s += '\n|' + OLAPCube._padToWidth('', fullWidth, '-') + '|'
    return s

  toStringTwoDimensions: (rows, columns, metric, significance) ->
    unless rows?
      rows = @config.dimensions[0].field
    unless columns?
      columns = @config.dimensions[1].field
    rowValues = @getDimensionValues(rows)
    columnValues = @getDimensionValues(columns)
    rowValueStrings = (JSON.stringify(r) for r in rowValues)
    columnValueStrings = (JSON.stringify(c) for c in columnValues)
    rowLabelWidth = Math.max.apply({}, (s.length for s in rowValueStrings))
    rowLabelWidth = Math.max(rowLabelWidth, 'Total'.length)
    valueStrings = []
    maxColumnWidth = Math.max.apply({}, (s.length for s in columnValueStrings))
    maxColumnWidth = Math.max(maxColumnWidth, 'Total'.length)
    for r, indexRow in rowValues
      valueStringsRow = []
      for c, indexColumn in columnValues
        filter = {}
        filter[rows] = r
        filter[columns] = c
        cell = @getCell(filter)
        if cell?
          cellString = JSON.stringify(OLAPCube.roundToSignificance(cell[metric], significance))
        else
          cellString = ''
        maxColumnWidth = Math.max(maxColumnWidth, cellString.length)
        valueStringsRow.push(cellString)
      valueStrings.push(valueStringsRow)
    maxColumnWidth += 1
    s = '|' + (OLAPCube._padToWidth('', rowLabelWidth)) + ' ||'

    for c, indexColumn in columnValueStrings
      if c == 'null'
        s += OLAPCube._padToWidth('Total', maxColumnWidth) + ' |'
      else
        s += OLAPCube._padToWidth(c, maxColumnWidth)
    fullWidth = rowLabelWidth + maxColumnWidth * columnValueStrings.length + 3
    if columnValueStrings[0] == 'null'
      fullWidth += 2
    s += '|\n|' + OLAPCube._padToWidth('', fullWidth, '=')
    for r, indexRow in rowValueStrings
      s += '|\n|'
      if r == 'null'
        s += OLAPCube._padToWidth('Total', rowLabelWidth, ' ', true)
      else
        s += OLAPCube._padToWidth(r, rowLabelWidth, ' ', true)
      s += ' ||'
      for c, indexColumn in columnValueStrings
        s += OLAPCube._padToWidth(valueStrings[indexRow][indexColumn], maxColumnWidth)
        if c == 'null'
          s += ' |'
      if r == 'null'
        s += '|\n|' + OLAPCube._padToWidth('', fullWidth, '-')
    s += '|'
    return s

  @_padToWidth: (s, width, padCharacter = ' ', rightPad = false) ->
    if s.length > width
      return s.substr(0, width)
    padding = new Array(width - s.length + 1).join(padCharacter)
    if rightPad
      return s + padding
    else
      return padding + s

  getStateForSaving: (meta) ->
    ###
    @method getStateForSaving
      Enables saving the state of an OLAPCube.
    @param {Object} [meta] An optional parameter that will be added to the serialized output and added to the meta field
      within the deserialized OLAPCube
    @return {Object} Returns an Ojbect representing the state of the OLAPCube. This Object is suitable for saving to
      to an object store. Use the static method `newFromSavedState()` with this Object as the parameter to reconstitute the OLAPCube.

        facts = [
          {ProjectHierarchy: [1, 2, 3], Priority: 1},
          {ProjectHierarchy: [1, 2, 4], Priority: 2},
          {ProjectHierarchy: [5]      , Priority: 1},
          {ProjectHierarchy: [1, 2]   , Priority: 1},
        ]

        dimensions = [
          {field: "ProjectHierarchy", type: 'hierarchy'},
          {field: "Priority"}
        ]

        config = {dimensions, metrics: []}
        config.keepTotals = true

        originalCube = new OLAPCube(config, facts)

        dateString = '2012-12-27T12:34:56.789Z'
        savedState = originalCube.getStateForSaving({upToDate: dateString})
        restoredCube = OLAPCube.newFromSavedState(savedState)

        newFacts = [
          {ProjectHierarchy: [5], Priority: 3},
          {ProjectHierarchy: [1, 2, 4], Priority: 1}
        ]
        originalCube.addFacts(newFacts)
        restoredCube.addFacts(newFacts)

        console.log(restoredCube.toString() == originalCube.toString())
        # true

        console.log(restoredCube.meta.upToDate)
        # 2012-12-27T12:34:56.789Z
    ###
    out =
      config: @userConfig
#      cells: arrayOfMaps_To_CSVStyleArray(@cells)
      cells: @cells
      summaryMetrics: @summaryMetrics
    if meta?
      out.meta = meta
    return out

  @newFromSavedState: (p) ->
    ###
    @method newFromSavedState
      Deserializes a previously stringified OLAPCube and returns a new OLAPCube.

      See `getStateForSaving()` documentation for a detailed example.

      Note, if you have specified config.keepFacts = true, the values for the facts will be restored, however, they
      will no longer be references to the original facts. For this reason, it's usually better to include a `values` or
      `uniqueValues` metric on some ID field if you want fact drill-down support to survive a save and restore.
    @static
    @param {String/Object} p A String or Object from a previously saved OLAPCube state
    @return {OLAPCube}
    ###
    if utils.type(p) is 'string'
      p = JSON.parse(p)
    cube = new OLAPCube(p.config)
    cube.summaryMetrics = p.summaryMetrics
    if p.meta?
      cube.meta = p.meta
#    cube.cells = csvStyleArray_To_ArrayOfMaps(p.cells)
    cube.cells = p.cells
    cube.cellIndex = {}
    cube._dimensionValues = {}
    for d in cube.config.dimensions
      cube._dimensionValues[d.field] = {}
    for c in cube.cells
      filterString = JSON.stringify(OLAPCube._extractFilter(c, cube.config.dimensions))
      # rebuild cellIndex
      cube.cellIndex[filterString] = c
      # rebuild _dimensionValues
      for d in cube.config.dimensions
        fieldValue = c[d.field]
        cube._dimensionValues[d.field][JSON.stringify(fieldValue)] = fieldValue

    return cube

exports.OLAPCube = OLAPCube