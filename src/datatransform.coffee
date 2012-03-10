ChartTime = require('./ChartTime').ChartTime
utils = require('./utils')
    
csvStyleArray_To_ArrayOfMaps = (csvStyleArray, rowKeys) ->
  ###
  To use this module, you must `require` it:
  
      charttime = require('../')
      {csvStyleArray_To_ArrayOfMaps, snapshotArray_To_AtArray, ChartTime} = charttime
      {groupByAtArray_To_HighChartsSeries, aggregationAtArray_To_HighChartsSeries} = charttime
      ChartTime.setTZPath("../vendor/tz")
  
  `csvStyleArry_To_ArryOfMaps` will convert a csvStyleArray like:
  
      csvStyleArray = [
        ['column1', 'column2'],
        [1         , 2         ],
        [3         , 4         ],
        [5         , 6         ]
      ]
  
  to an Array of Maps like this:
  
      console.log(csvStyleArray_To_ArrayOfMaps(csvStyleArray))
  
      # [ { column1: 1, column2: 2 },
      #   { column1: 3, column2: 4 },
      #   { column1: 5, column2: 6 } ]
  
  Parameters
  
  * **CSVStyleArray** An Array of Arrays. The first row is usually the list of column headers but if not, you can
      provide your own such list in the second parameter.
  * **rowKeys** Optional second parameter specifying the column headers like `['column1', 'column2']`
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
  
snapshotArray_To_AtArray = (snapshotArray, listOfAtCTs, dateField, keyField, tz) -> 
  ###
  If you have a list of snapshots representing the changes in a set of work items over time (MVCC-style), this function will return the state of
  each item at each moment of interest. It's useful for time-series charts where you have snapshot or change records but you need to know
  the values at particular moments in time (the times in listOfAtCTs).
  
  It will convert an snapshotArray like:
  
      snapshotArray = [
        {_ValidFrom: '2011-01-01T12:00:00.000Z', ObjectID: 1, someColumn: 'some value', someOtherColumn: 'some other value'},
        {_ValidFrom: '2011-01-02T12:00:00.000Z', ObjectID: 2, someColumn: 'some value 2', someOtherColumn: 'some other value 2'},      
      ]
      
  And a listOfAtCTs like:
  
      listOfAtCTs = [new ChartTime('2011-01-02'), new ChartTime('2011-01-03')]
      
  To an atArray with the value of each ObjectID at each of the points in the listOfAtCTs like:
  
      a = snapshotArray_To_AtArray(snapshotArray, listOfAtCTs, '_ValidFrom', 'ObjectID', 'America/New_York')
      
      console.log(a)
  
      # [ [ { ObjectID: '1', 
      #         someColumn: 'some value', 
      #         someOtherColumn: 'some other value' } ],
      #   [ { ObjectID: '1', 
      #         someColumn: 'some value', 
      #         someOtherColumn: 'some other value' }, 
      #     { ObjectID: '2', 
      #         someColumn: 'some value 2', 
      #         someOtherColumn: 'some other value 2' } ] ]
      
  Parameters
  
  * **snapshotArray** Array of snapshots or change events. Sorted by dateField.
  * **atArray** Array of ChartTime objects representing the moments we want the snapshots at
  * **dateField** String containing the name of the field that holds a date string in ISO-8601 canonical format (eg `2011-01-01T12:34:56.789Z`)
     Note, it should also work if there are ChartTime's in this position.
  * **keyField** String containing the name of the field that holds the unique ID. Note, no matter the input type, they will come
     out the other side as Strings. I could fix this if it ever became a problem.
  * **tz** String indicating the timezone, like 'America/New_York'
  ###
  atLength = listOfAtCTs.length
  snapshotLength = snapshotArray.length
  preOutput = []
  if (atLength <= 0 or snapshotLength <= 0)
    return preOutput
  atPointer = 0
  currentAtCT = listOfAtCTs[atPointer]
  granularity = currentAtCT.granularity
  snapshotPointer = 0
  currentSnapshot = snapshotArray[snapshotPointer]
  currentSnapshotCT = new ChartTime(currentSnapshot[dateField], granularity, tz)
  currentRow = {}
  while snapshotPointer < snapshotLength
    if currentSnapshotCT.$gte(currentAtCT)
      preOutput.push(currentRow)
      currentRow = utils.clone(currentRow)
      atPointer++
      if atPointer < atLength 
        currentAtCT = listOfAtCTs[atPointer]
      else
        break
    else
      unless currentRow[keyField]?
        currentRow[currentSnapshot[keyField]] = {}
      for key, value of currentSnapshot
        unless key == dateField
          currentRow[currentSnapshot[keyField]][key] = value
      snapshotPointer++
      if snapshotPointer < snapshotLength
        currentSnapshot = snapshotArray[snapshotPointer]
        currentSnapshotCT = new ChartTime(currentSnapshot[dateField], granularity, tz)
      else
        while atPointer < atLength
          preOutput.push(currentRow)
          atPointer++
  # Squash the keyField into each sub row       
  output = []
  for atRow in preOutput
    outputRow = []
    for key, value of atRow
      value[keyField] = key
      outputRow.push(value)
    output.push(outputRow)
  return output
  
groupByAtArray_To_HighChartsSeries = (groupByAtArray, nameField, valueField, nameFieldValues, returnPreOutput) ->  # !TODO: Needs tests
  ### 
  Takes an array of arrays that came from charttime.groupByAt and looks like this:
  
      groupByAtArray = [
        [
          { 'CFDField': 8, KanbanState: 'Ready to pull' },
          { 'CFDField': 5, KanbanState: 'In progress' },
          { 'CFDField': 9, KanbanState: 'Accepted' },
        ],
        [
          { 'CFDField': 2, KanbanState: 'Ready to pull' },
          { 'CFDField': 3, KanbanState: 'In progress' },
          { 'CFDField': 17, KanbanState: 'Accepted' },
        ]
      ]
  
  and optionally a list of nameFieldValues
  
      nameFieldValues = ['Ready to pull', 'In progress']  # Note, Accepted is missing
      
  and extracts the `valueField` under nameField to give us this
  
      console.log(groupByAtArray_To_HighChartsSeries(groupByAtArray, 'KanbanState', 'CFDField', nameFieldValues))
      # [ { name: 'Ready to pull', data: [ 8, 2 ] },
      #   { name: 'In progress', data: [ 5, 3 ] } ]
      
  ###
  preOutput = {}
  unless nameFieldValues?
    nameFieldValues = []
    for f in groupByAtArray[0]
      nameFieldValues.push(f[nameField])
  for groupByRow in groupByAtArray
    for perNameValueRow in groupByRow
      unless preOutput[perNameValueRow[nameField]]?
        preOutput[perNameValueRow[nameField]] = []
      preOutput[perNameValueRow[nameField]].push(perNameValueRow[valueField])
  if returnPreOutput? and returnPreOutput
    return preOutput
  # Squash the nameField into each sub row       
  output = []
  for name in nameFieldValues
    outputRow = {name: name, data: preOutput[name]}
    output.push(outputRow)
  return output


aggregationAtArray_To_HighChartsSeries = (aggregationAtArray, aggregations) ->  # !TODO: Needs tests
  ### 
  Takes an array of arrays that came from charttime.aggregateAt and looks like this:
  
      aggregationAtArray = [
        {"Series 1": 8, "Series 2": 5, "Series3": 10},
        {"Series 1": 2, "Series 2": 3, "Series3": 20}
      ]
  
  and a list of series configurations
  
      aggregations = [
        {name: "Series 1", yAxis: 1},
        {name: "Series 2"}
      ]
      
  and extracts the data into seperate series
  
      console.log(aggregationAtArray_To_HighChartsSeries(aggregationAtArray, aggregations))
      # [ { name: 'Series 1', data: [ 8, 2 ], yAxis: 1 },
      #   { name: 'Series 2', data: [ 5, 3 ] } ]
      
  Notice how the extra fields from the series array are included in the output.
  ###
  
  preOutput = {}
  
  seriesNames = []
  for a in aggregations
    seriesNames.push(a.name)

  for aggregationRow in aggregationAtArray
    for s in seriesNames
      unless preOutput[s]?
        preOutput[s] = []
      preOutput[s].push(aggregationRow[s])

  # Squash the nameField into each sub row       
  output = []
  for s, idx in seriesNames
    outputRow = {name: s, data: preOutput[s]}
    seriesRow = aggregations[idx]
    for key, value of seriesRow
      unless key in ['name', 'data']
        outputRow[key] = value
    output.push(outputRow)
  return output


exports.csvStyleArray_To_ArrayOfMaps = csvStyleArray_To_ArrayOfMaps
exports.snapshotArray_To_AtArray = snapshotArray_To_AtArray
exports.groupByAtArray_To_HighChartsSeries = groupByAtArray_To_HighChartsSeries
exports.aggregationAtArray_To_HighChartsSeries = aggregationAtArray_To_HighChartsSeries
