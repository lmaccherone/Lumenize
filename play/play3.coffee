{ChartTime} = require('../')

thisDay = new ChartTime('this day')
nextDay = new ChartTime('next day')

console.log(thisDay.lessThanOrEqual(nextDay))