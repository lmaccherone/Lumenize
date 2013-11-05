fs = require('fs')
{utils, csvString_To_CSVStyleArray, csvStyleArray_To_ArrayOfMaps, functions, histogram} = require('../')

filename = path.join(__dirname, 'dump-2013-05-28.csv')
bigDumpCSVString = fs.readFileSync(filename, 'utf8')

console.log('file read')

csvArray = csvString_To_CSVStyleArray(bigDumpCSVString)
rawData = csvStyleArray_To_ArrayOfMaps(csvArray)

console.log('now in array')

console.time('bucketsPercentile')
buckets = histogram.bucketsPercentile(rawData, 'FullTimeEquivalent')
console.timeEnd('bucketsPercentile')

allPercentiles = []
console.time('bucket')
countOfThrees = 0
for row in rawData
  p = histogram.bucket(row.FullTimeEquivalent, buckets).index
  if row.FullTimeEquivalent is 3
    countOfThrees++
  allPercentiles.push(p)

console.timeEnd('bucket')

console.log(buckets[15], countOfThrees)

histHist = histogram.histogram(allPercentiles, null, null, 1, 0, 100, 100)
counts = (row.index + ": " + row.count for row in histHist)

console.log(JSON.stringify(counts))