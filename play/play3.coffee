{Time} = require('../')

thisDay = new Time('this day')
nextDay = new Time('next day')

console.log(thisDay.lessThanOrEqual(nextDay))