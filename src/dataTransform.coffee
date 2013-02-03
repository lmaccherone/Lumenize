{utils, Time} = require('tztime')

csvStyleArray_To_ArrayOfMaps = (csvStyleArray, rowKeys) ->
  ###
  @method csvStyleArray_To_ArrayOfMaps
  @param {Array[]} csvStyleArray The first row is usually the list of column headers but if not, you can
    provide your own such list in the second parameter
  @param {String[]} [rowKeys] specify the column headers like `['column1', 'column2']`. If not provided, it will use
    the first row of the csvStyleArray
  @return {Object[]}

  `csvStyleArry_To_ArryOfMaps` is a convenience function that will convert a csvStyleArray like:
  
      {csvStyleArray_To_ArrayOfMaps} = require('../')

      csvStyleArray = [
        ['column1', 'column2'],
        [1         , 2       ],
        [3         , 4       ],
        [5         , 6       ]
      ]
  
  to an Array of Maps like this:
  
      console.log(csvStyleArray_To_ArrayOfMaps(csvStyleArray))
  
      # [ { column1: 1, column2: 2 },
      #   { column1: 3, column2: 4 },
      #   { column1: 5, column2: 6 } ]
  `
  ###
  arrayOfMaps = []
  if rowKeys?
    i = 0
  else
    rowKeys = csvStyleArray[0]
    i = 1
  tableLength = csvStyleArray.length
  while i < tableLength
    inputRow = csvStyleArray[i]
    outputRow = {}
    for key, index in rowKeys
      outputRow[key] = inputRow[index]
    arrayOfMaps.push(outputRow)
    i++
  return arrayOfMaps

arrayOfMaps_To_CSVStyleArray = (arrayOfMaps, keys) ->
  ###
  @method arrayOfMaps_To_CSVStyleArray
  @param {Object[]} arrayOfMaps
  @param {Object} [keys] If not provided, it will use the first row and get all fields
  @return {Array[]} The first row will be the column headers

  `arrayOfMaps_To_CSVStyleArray` is a convenience function that will convert an array of maps like:

      {arrayOfMaps_To_CSVStyleArray} = require('../')

      arrayOfMaps = [
        {column1: 10000, column2: 20000},
        {column1: 30000, column2: 40000},
        {column1: 50000, column2: 60000}
      ]

  to a CSV-style array like this:

      console.log(arrayOfMaps_To_CSVStyleArray(arrayOfMaps))

      # [ [ 'column1', 'column2' ],
      #   [ 10000, 20000 ],
      #   [ 30000, 40000 ],
      #   [ 50000, 60000 ] ]
  `
  ###
  if arrayOfMaps.length == 0
    return []
  csvStyleArray = []
  outRow = []
  unless keys?
    keys = []
    for key, value of arrayOfMaps[0]
      keys.push(key)
  csvStyleArray.push(keys)

  for inRow in arrayOfMaps
    outRow = []
    for key in keys
      outRow.push(inRow[key])
    csvStyleArray.push(outRow)
  return csvStyleArray

arrayOfMaps_To_HighChartsSeries = (arrayOfMaps, config) ->
  ###
  @method arrayOfMaps_To_HighChartsSeries
  @param {Array[]} arrayOfMaps
  @param {Object} config You can use the same config you used to call aggregateAt() as long as it includes
    your yAxis specifications
  @return {Object[]} in HighCharts form

  Takes an array of arrays that came from a call to aggregateAt() and looks like this:

      {arrayOfMaps_To_HighChartsSeries} = require('../')

      arrayOfMaps = [
        {"Series 1": 8, "Series 2": 5, "Series3": 10},
        {"Series 1": 2, "Series 2": 3, "Series3": 20}
      ]
  
  and a list of series configurations
  
      config = [
        {name: "Series 1", yAxis: 1},
        {name: "Series 2"}
      ]
      
  and extracts the data into seperate series
  
      console.log(arrayOfMaps_To_HighChartsSeries(arrayOfMaps, config))
      # [ { name: 'Series 1', data: [ 8, 2 ], yAxis: 1 },
      #   { name: 'Series 2', data: [ 5, 3 ] } ]
      
  Notice how the extra fields from the series array are included in the output.
  ###
  
  preOutput = {}
  
  seriesNames = []
  for a in config
    seriesNames.push(a.name)

  for s in seriesNames
    preOutput[s] = []
    for aggregationRow in arrayOfMaps
      preOutput[s].push(aggregationRow[s])

  # Squash the nameField into each sub row
  output = []
  for s, idx in seriesNames
    outputRow = {name: s, data: preOutput[s]}
    seriesRow = config[idx]
    for key, value of seriesRow
      unless key in ['name', 'data']
        outputRow[key] = value
    output.push(outputRow)
  return output

exports.arrayOfMaps_To_CSVStyleArray = arrayOfMaps_To_CSVStyleArray
exports.csvStyleArray_To_ArrayOfMaps = csvStyleArray_To_ArrayOfMaps
exports.arrayOfMaps_To_HighChartsSeries = arrayOfMaps_To_HighChartsSeries
