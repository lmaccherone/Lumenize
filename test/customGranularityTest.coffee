{Time, TimelineIterator, Timeline, utils} = require('../')

exports.CustomGranularityTest =

  setUp: (callback) ->    
    granularitySpec = {
      release: {
        segments: ['release'],
        mask: 'R##',
        lowest: 1,
        endBeforeDay: new Time('2011-07-01')
        rolloverValue: (ct) ->
          return Time._granularitySpecs.iteration.timeBoxes.length + 1  # Yes, it's correct to use the length of iteration.timeBoxes
        rataDieNumber: (ct) ->
          return Time._granularitySpecs.iteration.timeBoxes[ct.release-1][1-1].startOn.rataDieNumber()
      },
      iteration: {
        segments: ['release', 'iteration'],
        mask: 'R##I##',
        lowest: 1,
        endBeforeDay: new Time('2011-07-01')
        timeBoxes: [
          [
            {startOn: new Time('2011-01-01'), label: 'R1 Iteration 1'},
            {startOn: new Time('2011-02-01'), label: 'R1 Iteration 2'},
            {startOn: new Time('2011-03-01'), label: 'R1 Iteration 3'},
          ],
          [
            {startOn: new Time('2011-04-01'), label: 'R2 Iteration 1'},
            {startOn: new Time('2011-05-01'), label: 'R2 Iteration 2'},
            {startOn: new Time('2011-06-01'), label: 'R2 Iteration 3'},
          ]
        ]
        rolloverValue: (ct) ->
          temp = Time._granularitySpecs.iteration.timeBoxes[ct.release-1]?.length + 1
          if temp? and not isNaN(temp) and ct.beforePastFlag != 'PAST_LAST'
            return temp
          else
            numberOfReleases = Time._granularitySpecs.iteration.timeBoxes.length
            return Time._granularitySpecs.iteration.timeBoxes[numberOfReleases-1].length + 1

        rataDieNumber: (ct) ->
          return Time._granularitySpecs.iteration.timeBoxes[ct.release-1][ct.iteration-1].startOn.rataDieNumber()
      },
      iteration_day: {  # By convention, it knows to use day functions on it. This is the lowest allowed custom granularity
        segments: ['release', 'iteration', 'iteration_day'],
        mask: 'R##I##-##',
        lowest: 1,
        endBeforeDay: new Time('2011-07-01'),
        rolloverValue: (ct) ->
          iterationTimeBox = Time._granularitySpecs.iteration.timeBoxes[ct.release-1]?[ct.iteration-1]
          if !iterationTimeBox? or ct.beforePastFlag == 'PAST_LAST'
            numberOfReleases = Time._granularitySpecs.iteration.timeBoxes.length
            numberOfIterationsInLastRelease = Time._granularitySpecs.iteration.timeBoxes[numberOfReleases-1].length
            iterationTimeBox = Time._granularitySpecs.iteration.timeBoxes[numberOfReleases-1][numberOfIterationsInLastRelease-1]
            
          thisIteration = iterationTimeBox.startOn.inGranularity('iteration')
          nextIteration = thisIteration.add(1)
          if nextIteration.beforePastFlag == 'PAST_LAST'
            return Time._granularitySpecs.iteration_day.endBeforeDay.rataDieNumber() - iterationTimeBox.startOn.rataDieNumber() + 1
          else
            return nextIteration.rataDieNumber() - iterationTimeBox.startOn.rataDieNumber() + 1 
           
        rataDieNumber: (ct) ->
          return Time._granularitySpecs.iteration.timeBoxes[ct.release-1][ct.iteration-1].startOn.rataDieNumber() + ct.iteration_day - 1
      }
    }   
    Time.addGranularity(granularitySpec)
    callback()

  testWithinIteration: (test) ->
    i = new TimelineIterator({
      startOn:new Time({granularity: 'iteration_day', release: 1, iteration: 1, iteration_day: 10}),
      endBefore:new Time({granularity: 'iteration_day', release: 1, iteration: 1, iteration_day: 20}),
      holidays: [
        {year: 2011, month: 1, day: 17}
      ]
      workDays: 'Monday, Tuesday, Wednesday, Thursday'
    })
   
    temp = i.next()
    test.equal(temp.inGranularity('day'), '2011-01-10')
    temp = i.next()
    test.equal(temp.inGranularity('day'), '2011-01-11')
    temp = i.next()
    test.equal(temp.inGranularity('day'), '2011-01-12')
    temp = i.next()
    test.equal(temp.inGranularity('day'), '2011-01-13')
    temp = i.next()
    test.equal(temp.inGranularity('day'), '2011-01-18')
    temp = i.next()
    test.equal(temp.inGranularity('day'), '2011-01-19')
    test.equal(i.hasNext(), false)
    
    test.done()

  testSpanIteration: (test) ->
    i = new TimelineIterator({
      startOn:new Time({granularity: 'iteration_day', release: 1, iteration: 1, iteration_day: 27}),
      endBefore:new Time({granularity: 'iteration_day', release: 1, iteration: 2, iteration_day: 6}),
      holidays: [
        {year: 2011, month: 1, day: 17}
      ]
      workDays: 'Monday, Tuesday, Wednesday, Thursday'
    })
   
    temp = i.next()
    test.equal(temp.inGranularity('day'), '2011-01-27')
    temp = i.next()
    test.equal(temp.inGranularity('day'), '2011-01-31')
    temp = i.next()
    test.equal(temp.inGranularity('day'), '2011-02-01')
    temp = i.next()
    test.equal(temp.inGranularity('day'), '2011-02-02')
    temp = i.next()
    test.equal(temp.inGranularity('day'), '2011-02-03')
    test.equal(i.hasNext(), false)
 
   	test.done()
   
  testSpanRelease: (test) ->
    i = new TimelineIterator({
      startOn:new Time({granularity: 'iteration_day', release: 1, iteration: 3, iteration_day: 27}),
      endBefore:new Time({granularity: 'iteration_day', release: 2, iteration: 1, iteration_day: 6}),
      holidays: [
        {year: 2011, month: 1, day: 17}
      ]
      workDays: 'Monday, Tuesday, Wednesday, Thursday'
    })
   
    temp = i.next()
    test.equal(temp.inGranularity('day'), '2011-03-28')
    temp = i.next()
    test.equal(temp.inGranularity('day'), '2011-03-29')
    temp = i.next()
    test.equal(temp.inGranularity('day'), '2011-03-30')
    temp = i.next()
    test.equal(temp.inGranularity('day'), '2011-03-31')
    temp = i.next()
    test.equal(temp.inGranularity('day'), '2011-04-04')
    temp = i.next()
    test.equal(temp.inGranularity('day'), '2011-04-05')
    test.equal(i.hasNext(), false)
    
    test.done()
    
  testBackwardFromPastLast: (test) ->
    i = new TimelineIterator({
      endBefore:new Time('PAST_LAST', 'iteration_day'),
      limit: 3,
      step: -1,
      holidays: [
        {year: 2011, month: 1, day: 17}
      ]
      workDays: 'Monday, Tuesday, Wednesday, Thursday'
    })
   
    temp = i.next()
    test.equal(temp, 'R02I03-30')
    temp = i.next()
    test.equal(temp, 'R02I03-29')
    temp = i.next()
    test.equal(temp, 'R02I03-28')
    test.equal(i.hasNext(), false)
    
    test.done()
   
  testBackwardFromPastLastIteration: (test) ->
    i = new TimelineIterator({
      endBefore:new Time('PAST_LAST', 'iteration'),
      limit: 4,
      step: -1,
      holidays: [
        {year: 2011, month: 1, day: 17}
      ]
      workDays: 'Monday, Tuesday, Wednesday, Thursday'
    })
   
    temp = i.next()
    test.equal(temp, 'R02I03')
    temp = i.next()
    test.equal(temp, 'R02I02')
    temp = i.next()
    test.equal(temp, 'R02I01')
    temp = i.next()
    test.equal(temp, 'R01I03')
    test.equal(i.hasNext(), false)
    
    test.done()
    
  testInGranularity: (test) ->
    d = new Time('2011-05-05')
    test.equal(d.inGranularity('release'), 'R02')
    test.equal(d.inGranularity('iteration'), 'R02I02')
    test.equal(d.inGranularity('iteration_day'), 'R02I02-05')
    
    d = new Time('2010-05-05').inGranularity('release')
    test.equal(d, 'BEFORE_FIRST')  # 2010 is before any releases start

    d = new Time('2014-05-05').inGranularity('release')
    test.equal(d, 'PAST_LAST')
    
    d = new Time('2014-05-05').inGranularity('iteration_day')
    test.equal(d, 'PAST_LAST')

    d = new Time('2011-07-01').inGranularity('release')
    test.equal(d, 'PAST_LAST')

    d = new Time('2011-06-30').inGranularity('release')
    test.equal(d, 'R02')

    d = new Time('2012-07-01').inGranularity('iteration')
    test.equal(d, 'PAST_LAST')

    d = new Time('2011-06-30').inGranularity('iteration')
    test.equal(d, 'R02I03')
    
    d = new Time('2011-03-15').inGranularity('iteration')
    test.equal(d, 'R01I03')    

    test.done()
    
  testAfterRelease: (test) -> 
    i = new TimelineIterator({
      startOn:new Time({granularity: 'iteration_day', release: 2, iteration: 3, iteration_day: 27}),
      endBefore:new Time({granularity: 'iteration_day', release: 3, iteration: 1, iteration_day: 1}),  # Works now that it wraps to 'PAST_LAST'
      holidays: [
        {year: 2011, month: 1, day: 17}
      ]
      workDays: 'Monday, Tuesday, Wednesday, Thursday'
    })
   
    test.equal(i.timeline.endBefore, 'PAST_LAST')
    temp = i.next()
    test.equal(temp.inGranularity('day'), '2011-06-27')
    temp = i.next()
    test.equal(temp.inGranularity('day'), '2011-06-28')
    temp = i.next()
    test.equal(temp.inGranularity('day'), '2011-06-29')
    temp = i.next()
    test.equal(temp.inGranularity('day'), '2011-06-30')
    test.equal(i.hasNext(), false)
    
    test.done()
    
  testMathOnPastLast: (test) ->
    d = new Time('PAST_LAST', 'iteration_day')
    d.addInPlace(-1)
    test.equal(d, 'R02I03-30')
    
    d = new Time('PAST_LAST', 'iteration_day')
    d.addInPlace(-3)
    test.equal(d, 'R02I03-28')
    
    d = new Time('PAST_LAST', 'iteration_day')
    d.decrement()
    test.equal(d, 'R02I03-30')
    
    d = new Time('PAST_LAST', 'iteration_day')
    d2 = d.add(-1)
    test.equal(d2, 'R02I03-30')
    
    d = new Time('PAST_LAST', 'iteration')
    d.decrement()
    test.equal(d, 'R02I03')
    
    d = new Time('PAST_LAST', 'release')
    d.decrement()
    test.equal(d, 'R02')
    
    d = new Time('PAST_LAST', 'release')
    d.increment()
    test.equal(d, 'PAST_LAST')
        
    d = new Time('PAST_LAST', 'iteration')
    d.increment()
    test.equal(d, 'PAST_LAST')
        
    d = new Time('PAST_LAST', 'iteration_day')
    d.increment()
    test.equal(d, 'PAST_LAST')
        
    test.done()
    
  testMathOnBeforeFirst: (test) ->
    d = new Time('BEFORE_FIRST', 'iteration_day')
    d.addInPlace(1)
    test.equal(d, 'R01I01-01')
    
    d = new Time('BEFORE_FIRST', 'iteration_day')
    d.addInPlace(3)
    test.equal(d, 'R01I01-03')
    
    d = new Time('BEFORE_FIRST', 'iteration_day')
    d.increment()
    test.equal(d, 'R01I01-01')
    
    d = new Time('BEFORE_FIRST', 'iteration_day')
    d2 = d.add(1)
    test.equal(d2, 'R01I01-01')
    
    d = new Time('BEFORE_FIRST', 'iteration')
    d.increment()
    test.equal(d, 'R01I01')
    
    d = new Time('BEFORE_FIRST', 'release')
    d.increment()
    test.equal(d, 'R01')
    
    d = new Time('BEFORE_FIRST', 'release')
    d.decrement()
    test.equal(d, 'BEFORE_FIRST')
        
    d = new Time('BEFORE_FIRST', 'iteration')
    d.decrement()
    test.equal(d, 'BEFORE_FIRST')
        
    d = new Time('BEFORE_FIRST', 'iteration_day')
    d.decrement()
    test.equal(d, 'BEFORE_FIRST')
        
    test.done()