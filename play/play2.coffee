charttime = require('../')
{ChartTimeRange, ChartTime, ChartTimeIterator, ChartTimeInStateCalculator} = charttime
{functions, percentileCreator, histogram} = charttime
utils = charttime.utils

ChartTime.setTZPath('../vendor/tz')

granularity = 'hour'
timezone = 'America/Chicago'

rangeSpec = 
  granularity: granularity
  start: '2011-01-01'
  pastEnd: '2011-04-01'
  startWorkTime: {hour: 9, minute: 0}  # 9am. 15:00 in Chicago
  pastEndWorkTime: {hour: 17, minute: 0}  # 5pm

r1 = new ChartTimeRange(rangeSpec)
i1 = r1.getIterator('ChartTime')

# Calculate workHours
if r1.startWorkMinutes < r1.pastEndWorkMinutes
  workMinutes = r1.pastEndWorkMinutes - r1.startWorkMinutes
else
  workMinutes = 24 * 60 - r1.startWorkMinutes  # from start to midnight
  workMinutes += r1.pastEndWorkMinutes  # from midnight to end
workHours = workMinutes / 60

# isc1 = i1.getChartTimeInStateCalculator(timezone)
# timeInState = isc1.timeInState(snapshots, '_ValidFrom', '_ValidTo', 'ObjectID')

# Randomly generated timeInState calcuation
timeInState = []
while i1.hasNext()
  hourCT = i1.next()
  if Math.random() < 0.1
    row = {
      id: i1.count,
      ticks: Math.pow(4, ((Math.random() + 0.7) * 2.6)) + 4 * 8, 
      finalEventAt: hourCT.getJSDateString(timezone)
    }
    timeInState.push(row)
  if Math.random() < 0.005
    row = {
      id: i1.count,
      ticks: Math.pow(4, ((Math.random() + 0.9) * 2.6)), 
      finalEventAt: hourCT.getJSDateString(timezone)
    }
    timeInState.push(row)
  if Math.random() < 0.005
    row = {
      id: i1.count,
      ticks: 0, 
      finalEventAt: hourCT.getJSDateString(timezone)
    }
    timeInState.push(row)

# Convert ticks to days (fractional)
for row in timeInState
  row.days = row.ticks / workHours
  
{buckets, chartMax} = histogram(timeInState, 'days')
console.log("chartMax: #{chartMax}")

for b, idx in buckets
  console.log(b.label, b.count)

