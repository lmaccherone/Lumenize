Time = require('./Time').Time
timezoneJS = require('./timezone-js.js').timezoneJS
utils = require('./utils')

class Timeline
  ###
  @class Timeline

  Allows you to specify a timeline with weekend, holiday and non-work hours knocked out and timezone precision.
  
  ## Usage ##
 
  Let's create a Timeline
  
      {TimelineIterator, Timeline, Time} = require('../')
      
      tl = new Timeline({
        startOn: '2011-01-02',
        endBefore: '2011-01-07',
        holidays: [
          {month: 1, day: 1},  # Notice the lack of a year specification
          '2011-01-02'  # Got January 2 off also in 2011. Allows ISO strings.
        ]
      })
      
  `workDays` is already defaulted but you could have overridden it.
  
      console.log(tl.workDays)
      # [ 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday' ]
      
  Now let's get an TimelineIterator over this Timeline.
      
      tli = tl.getIterator('Time')
      
      while tli.hasNext()
        console.log(tli.next().toString())
             
      # 2011-01-03
      # 2011-01-04
      # 2011-01-05
      # 2011-01-06
  
  Notice how 2011-01-02 was skipped because it was a holiday. Also notice how the endBefore is not included.
  Timelines are inclusive of the startOn and exclusive of the endBefore. This allows the endBefore to be
  the startOn of the next with no overlap or gap. This focus on precision pervades the design of the Time library.
  
  Now, let's create a Timeline with `hour` granularity to elaborate on this inclusive/exclusive behavior.
      
      tl2 = new Timeline({
        startOn: '2011-01-02T00',
        endBefore: '2011-01-07T00',
      })
      
  `startOn` is inclusive.
  
      console.log(tl2.contains('2011-01-02T00'))
      # true
      
  But `endBefore` is exclusive
  
      console.log(tl2.contains('2011-01-07T00'))
      # false
  
  But just before `endBefore` is OK
  
      console.log(tl2.contains('2011-01-06T23'))
      # true
  
  All of the above comparisons assume that the `startOn`/`endBefore` boundaries are in the same timezone as the contains date.
  
  ## Timezone sensitive comparisions ##
  
  Now, let's look at how you do timezone sensitive comparisions.
  
  If you pass in a timezone, then it will shift the Timeline boundaries to that timezone to compare to the 
  date/timestamp that you pass in. This system is optimized to the pattern where you first define your boundaries without regard 
  to timezone. Christmas day is a holiday in any timezone. Saturday and Sunday are non work days in any timezone. The iteration
  starts on July 10th; etc. THEN you have a bunch of data that you have stored in a database in GMT. Maybe you've pulled
  it down from an API but the data is represented with a GMT date/timestamp. You then want to decide if the GMT date/timestamp 
  is contained within the iteration as defined by a particular timezone, or is a Saturday, or is during workhours, etc. 
  The key concept to remember is that the timebox boundaries are shifted NOT the other way around. It says at what moment
  in time July 10th starts on in a particular timezone and internally represents that in a way that can be compared to a GMT
  date/timestamp.
  
  So, when it's 3am in GMT on 2011-01-02, it's still 2011-01-01 in New York. Using the above `tl2` timeline, we say:
  
      console.log(tl2.contains('2011-01-02T03:00:00.000Z', 'America/New_York'))
      # false
      
  But it's still 2011-01-06 in New York, when it's 3am in GMT on 2011-01-07
      
      console.log(tl2.contains('2011-01-07T03:00:00.000Z', 'America/New_York'))
      # true
      
  Now, let's explore how Timelines and TimelineIterators are used together.

      tl3 = new Timeline({
        startOn:new Time('2011-01-06'),
        endBefore:new Time('2011-01-11'),
        workDayStartOn: {hour: 9, minute: 0},
        workDayEndBefore: {hour: 11, minute: 0}  # Very short work day for demo purposes
      })
          
  You can ask for an iterator to emit Timelines rather than Time values. On each call to `next()`, the
  iterator will give you a new Timeline with the `startOn` value set to what you would have gotten had you
  requested that it emit Times. The `endBefore' of the emitted Timeline will be set to the following value.
  This is how you drill-down from one granularity into a lower granularity.
  
  By default, the granularity of the iterator will equal the `startOn`/`endBefore` of the original Timeline.
  However, you can provide a different granularity (`hour` in the example below) for the iterator if you want 
  to drill-down at a lower granularity.
  
      tli3 = tl3.getIterator('Timeline', undefined, 'hour')
      
      while tli3.hasNext()
        subTimeline = tli3.next()
        console.log("Sub Timeline goes from #{subTimeline.startOn.toString()} to #{subTimeline.endBefore.toString()}")
        subIterator = subTimeline.getIterator('Time')
        while subIterator.hasNext()
          console.log('    Hour: ' + subIterator.next().hour)
          
      # Sub Timeline goes from 2011-01-06T00 to 2011-01-07T00
      #     Hour: 9
      #     Hour: 10
      # Sub Timeline goes from 2011-01-07T00 to 2011-01-10T00
      #     Hour: 9
      #     Hour: 10
      # Sub Timeline goes from 2011-01-10T00 to 2011-01-11T00
      #     Hour: 9
      #     Hour: 10
          
  There is a lot going on here, so let's poke at it a bit. First, notice how the second sub-Timeline goes from the 7th to the
  10th. That's because there was a weekend in there. We didn't get hours for the Saturday and Sunday.
      
  The above approach (`tl3`/`tli3`) is useful for some forms of hand generated analysis, but if you are using Time with
  Lumenize, it's overkill because Lumenize is smart enough to do rollups based upon the segments that are emitted from the
  lowest granularity Time. So you can just iterate over the lower granularity and Lumenize will automatically manage
  the drill up/down to day/month/year levels automatically.
  
      tl4 = new Timeline({
        startOn:'2011-01-06T00',  # Notice how we include the hour now
        endBefore:'2011-01-11T00',
        workDayStartOn: {hour: 9, minute: 0},
        workDayEndBefore: {hour: 11, minute: 0}  # Very short work day for demo purposes
      })

      tli4 = tl4.getIterator('ISOString', 'GMT')
      
      while tli4.hasNext()
        console.log(tli4.next())
        
      # 2011-01-06T09:00:00.000Z
      # 2011-01-06T10:00:00.000Z
      # 2011-01-07T09:00:00.000Z
      # 2011-01-07T10:00:00.000Z
      # 2011-01-10T09:00:00.000Z
      # 2011-01-10T10:00:00.000Z
      
  `tl4`/`tli4` covers the same ground as `tl3`/`tli3` but without the explicit nesting.

  ###
  
  constructor: (config) ->
    ###
    @constructor
    @param {Object} config

    config can have the following properties:

    * **startOn** is a Time object or a string. The first value that next() returns. Must specify 2 out of
       3 of startOn, endBefore, and limit.
    * **endBefore** is a Time object or string. Must match granularity. hasNext() returns false when current is here or
       later. Must specify 2 out of 3 of startOn, endBefore, and limit.
    * **limit** you can specify limit and either startOn or endBefore and only get back this many. Must specify 2 out of
       3 of startOn, endBefore, and limit.
    * **step** is an optional parameter. Defaults to 1 or -1. Use -1 to march backwards from endBefore - 1. Currently any
       values other than 1 and -1 may give unexpected behavior. It should be able to step by more but there are not
       good tests around it now.
    * **granularity** is used to determine the granularity that you will iterate over. Note, this is independent of the
       granularity you have used to specify startOn and endBefore. For example:

           {startOn: '2012-01', # Month Granularity
            endBefore: '2012-02', # Month Granularity
            granularity: Time.DAY} # Day granularity}

    * **workDays** list of days of the week that you work on. You can specify this as an Array of Strings
       (['Monday', 'Tuesday', ...]) or a single comma seperated String ("Monday,Tuesday,...").
       Defaults to ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].
    * **holidays** is an optional Array of either ISOStrings or JavaScript Objects (and you can mix and match). Example:

          [{month: 12, day: 25}, {year: 2011, month: 11, day: 24}, "2012-12-24"]

       Notice how you can leave off the year if the holiday falls on the same day every year.
    * **workDayStartOn** is an optional object in the form {hour: 8, minute: 15}. If minute is zero it can be omitted.
       If workDayStartOn is later than workDayEndBefore, then it assumes that you work the night shift and your work
       hours span midnight.
    * **workDayEndBefore** is an optional object in the form {hour: 17, minute: 0}. If minute is zero it can be omitted.
       The use of workDayStartOn and workDayEndBefore only make sense when the granularity is "hour" or finer.
       Note: If the business closes at 5:00pm, you'll want to leave workDayEndBefore to 17:00, rather
       than 17:01. Think about it, you'll be open 4:59:59.999pm, but you'll be closed at 5:00pm. This also makes all of
       the math work. 9am to 5pm means 17 - 9 = an 8 hour work day.
    ###
    @memoizedTicks = {}  # key: stringified parameters to getAll
    if config.endBefore?
      @endBefore = config.endBefore
      if @endBefore != 'PAST_LAST'
        if utils.type(@endBefore) == 'string'
          @endBefore = new Time(@endBefore)
        @granularity = @endBefore.granularity
    if config.startOn?
      @startOn = config.startOn
      if @startOn != 'BEFORE_FIRST'
        if utils.type(@startOn) == 'string'
          @startOn = new Time(@startOn)
        @granularity = @startOn.granularity
    if config.granularity?
      @granularity = config.granularity
      if @startOn?
        @startOn = @startOn.inGranularity(@granularity)
      if @endBefore?
        @endBefore = @endBefore.inGranularity(@granularity)
    unless @granularity
      throw new Error('Cannot determine granularity for Timeline.')
    if @startOn == 'BEFORE_FIRST'
      @startOn = new Time(@startOn, @granularity)
    if @endBefore == 'PAST_LAST'
      @endBefore == new Time(@endBefore, @granularity)
    if !@endBefore
      @endBefore = new Time('PAST_LAST', @granularity)
    if !@startOn
      @startOn = new Time('BEFORE_FIRST', @granularity)

    @limit = if config.limit? then config.limit else utils.MAX_INT
    
    if config.workDays?
      @workDays = config.workDays
    else if config.workdays?
      @workDays = config.workdays
    else
      @workDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    if utils.type(@workDays) == 'string'
      @workDays = (utils.trim(s) for s in @workDays.split(','))
    @holidays = if config.holidays? then config.holidays else []
    for holiday, idx in @holidays
      if utils.type(holiday) == 'string'
        @holidays[idx] = new Time(holiday).getSegmentsAsObject()
    
    @workDayStartOn = if config.workDayStartOn? then config.workDayStartOn
    if @workDayStartOn?
      h = if @workDayStartOn.hour? then @workDayStartOn.hour else 0
      m = if @workDayStartOn.minute? then @workDayStartOn.minute else 0
      @startOnWorkMinutes = h * 60 + m
      if @startOnWorkMinutes < 0
        @startOnWorkMinutes = 0
    else
      @startOnWorkMinutes = 0

    @workDayEndBefore = if config.workDayEndBefore? then config.workDayEndBefore
    if @workDayEndBefore?
      h = if @workDayEndBefore.hour? then @workDayEndBefore.hour else 24
      m = if @workDayEndBefore.minute? then @workDayEndBefore.minute else 0
      @endBeforeWorkMinutes = h * 60 + m
      if @endBeforeWorkMinutes > 24 * 60
        @endBeforeWorkMinutes = 24 * 60
    else
      @endBeforeWorkMinutes = 24 * 60
    
    if config.step?
      @step = config.step
    else if config.endBefore? and @startOn?.greaterThan(@endBefore)
      @step = -1
    else if config.endBefore? and not config.startOn? and config.limit?
      @step = -1
    else
      @step = 1
    utils.assert(
      (config.startOn? and config.endBefore?) or
      (config.startOn? and config.limit? and @step > 0) or
      (config.endBefore? and config.limit? and @step < 0),
      'Must provide two out of "startOn", "endBefore", or "limit" and the sign of step must match.'
    )
    
  getIterator: (emit = 'Time', tz, childGranularity) ->
    ###
    @method getIterator
    @param {String} [emit] An optional String that specifies what should be emitted. Possible values are 'Time' (default),
       'Timeline', 'Date' (javascript Date Object), and 'ISOString'.
    @param {String} [tz] A Sting specifying the timezone in the standard form,`America/New_York` for example. This is
       required if `emit` is 'Date' or 'ISOString'.
    @param {String} [childGranularity] When emit is 'Timeline', this is the granularity for the startOn and endBefore of the
       Timeline that is emitted.
    @return {TimelineIterator}

    Returns a new TimelineIterator using this Timeline as the boundaries.
    ###
    return new TimelineIterator(this, emit, tz, childGranularity)
    
  getAllRaw: (emit = 'Time', tz, childGranularity) ->
    ###
    @method getAllRaw
    @param {String} [emit] An optional String that specifies what should be emitted. Possible values are 'Time' (default),
       'Timeline', 'Date' (javascript Date Object), and 'ISOString'.
    @param {String} [tz] A Sting specifying the timezone in the standard form,`America/New_York` for example. This is
       required if `emit` is 'Date' or 'ISOString'.
    @param {String} [childGranularity] When emit is 'Timeline', this is the granularity for the startOn and endBefore of the
       Timeline that is emitted.
    @return {Time[]/Date[]/Timeline[]/String[]}

    Returns all of the points in the timeline. Note, this will come back in the order specified
    by step so they could be out of chronological order. Use getAll() if they must be in chronological order.
    ###
    tli = @getIterator(emit, tz, childGranularity)
    temp = []
    while tli.hasNext()
      temp.push(tli.next())
    return temp
    
  getAll: (emit = 'Time', tz, childGranularity) ->
    ###
    @method getAll
    @param {String} [emit] An optional String that specifies what should be emitted. Possible values are 'Time' (default),
       'Timeline', 'Date' (javascript Date Object), and 'ISOString'.
    @param {String} [tz] A Sting specifying the timezone in the standard form,`America/New_York` for example. This is
       required if `emit` is 'Date' or 'ISOString'.
    @param {String} [childGranularity] When emit is 'Timeline', this is the granularity for the startOn and endBefore of the
       Timeline object that is emitted.
    @return {Time[]/Date[]/Timeline[]/String[]}

    Returns all of the points in the timeline in chronological order. If you want them in the order specified by `step`
    then use getAllRaw(). Note, the output of this function is memoized so that subsequent calls to getAll() for the
    same Timeline instance with the same parameters will return the previously calculated values. This makes it safe
    to call it repeatedly within loops and means you don't need to worry about holding onto the result on the client
    side.
    ###
    parameterKeyObject = {emit}
    if tz?
      parameterKeyObject.tz = tz
    if childGranularity?
      parameterKeyObject.childGranularity = childGranularity
    parameterKey = JSON.stringify(parameterKeyObject)
    ticks = @memoizedTicks[parameterKey]
    unless ticks?
      ticks = @getAllRaw(emit, tz, childGranularity)
      if ticks.length > 1
        if (ticks[0] instanceof Time and ticks[0].greaterThan(ticks[1])) or (utils.type(ticks[0]) is 'string' and ticks[0] > ticks[1] )
          ticks.reverse()
      @memoizedTicks[parameterKey] = ticks
    return ticks

  ticksThatIntersect: (startOn, endBefore, tz, returnEnd = false) ->
    ###
    @method ticksThatIntersect
    @param {Time/ISOString} startOn The start of the time period of interest
    @param {Time/ISOString} endBefore The moment just past the end of the time period of interest
    @return {Array}

    Returns the list of ticks from this Timeline that intersect with the time period specified by the parameters
    startOn and endBefore.
    ###
    utils.assert(@limit == utils.MAX_INT, 'Cannot call `ticksThatIntersect()` on Timelines specified with `limit`.')
    out = []
    if utils.type(startOn) is 'string'
      utils.assert(utils.type(endBefore) is 'string', 'The type for startOn and endBefore must match.')
      isoDateRegExp = /\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d.\d\d\dZ/
      utils.assert(isoDateRegExp.test(startOn), 'startOn must be in form ####-##-##T##:##:##.###Z')
      utils.assert(isoDateRegExp.test(endBefore), 'endBefore must be in form ####-##-##T##:##:##.###Z')
      utils.assert(tz?, "Must specify parameter tz when submitting ISO string boundaries.")

#      ticksUnshifted = @getAll()
#      ticks = (tick.add(1, @granularity).toString() for tick in ticksUnshifted)
#      if ticks[0] >= endBefore or ticks[ticks.length - 1] < startOn
#        out = []
#      else
#        i = 0
#        ticksLength = ticks.length
#        while i < ticksLength and ticks[i] < startOn
#          i++
#        while i < ticksLength and ticks[i] < endBefore
#          out.push(ticksUnshifted[i].toString())
#          i++


      ticks = @getAll('ISOString', tz)
      if ticks[0] >= endBefore or ticks[ticks.length - 1] < startOn
        out = []
      else
        i = 0
        ticksLength = ticks.length
        while i < ticksLength and ticks[i] < startOn
          i++
        while i < ticksLength and ticks[i] < endBefore
          out.push(ticks[i])
          i++


    else if startOn instanceof Time
      utils.assert(endBefore instanceof Time, 'The type for startOn and endBefore must match.')
      startOn = startOn.inGranularity(@granularity)
      endBefore = endBefore.inGranularity(@granularity)
      if @endBefore.lessThan(@startOn)
        st = @endBefore
        en = @startOn
      else
        st = @startOn
        en = @endBefore
      if st.greaterThanOrEqual(endBefore) or en.lessThan(startOn)
        out = []
      else
        ticks = @getAll()
        i = 0
        ticksLength = ticks.length
        while i < ticksLength and ticks[i].lessThan(startOn)
          i++
        while i < ticksLength and ticks[i].lessThan(endBefore)
          out.push(ticks[i])
          i++
    else
      throw new Error("startOn must be a String or a Time object.")
    return out

  contains: (date, tz) ->
    ###
    @method contains
    @param {Time/Date/String} date can be either a JavaScript date object or an ISO-8601 formatted string
    @param {String} [tz]
    @return {Boolean} true if the date provided is within this Timeline.

    ## Usage: ##

    We can create a Timeline from May to just before July.

        tl = new Timeline({
          startOn: '2011-05',
          endBefore: '2011-07'
        })

        console.log(tl.contains('2011-06-15T12:00:00.000Z', 'America/New_York'))
        # true

    ###
    utils.assert(@limit == utils.MAX_INT, 'Cannot call `contains()` on Timelines specified with `limit`.')
    if date instanceof Time
      return date.lessThan(@endBefore) and date.greaterThanOrEqual(@startOn)
    utils.assert(tz? or utils.type(date) != 'date', 'Timeline.contains() requires a second parameter (timezone) when the first parameter is a Date()')
    switch utils.type(date)
      when 'string'
        if tz?
          target = timezoneJS.parseISO(date)
        else
          target = new Time(date)
          return target.lessThan(@endBefore) and target.greaterThanOrEqual(@startOn)
      when 'date'
        target = date.getTime()  # !TODO: A - Need to use my getJSDate to be sure this behaves as expected... or test the hell out of this
      else
        throw new Error('Timeline.contains() requires that the first parameter be of type Time, String, or Date')
    startOn = @startOn.getJSDate(tz)
    endBefore = @endBefore.getJSDate(tz)
    return target < endBefore and target >= startOn

class TimelineIterator
  ###
  @class TimelineIterator

  In most cases you'll want to call getAll() on Timeline. TimelineIterator is for use cases where you want to get the
  values in the Timeline one at a time.

  You usually get a TimelineIterator by calling getIterator() on a Timeline object.

  Iterate through days, months, years, etc. skipping weekends and holidays that you
  specify. It will also iterate over hours, minutes, seconds, etc. and skip times that are not
  between the specified work hours.

  ## Usage ##

      {TimelineIterator, Timeline, Time} = require('../')

      tl = new Timeline({
        startOn:new Time({granularity: 'day', year: 2009, month:1, day: 1}),
        endBefore:new Time({granularity: 'day', year: 2009, month:1, day: 8}),
        workDays: 'Monday, Tuesday, Wednesday, Thursday, Friday',
        holidays: [
          {month: 1, day: 1},  # New Years day was a Thursday in 2009
          {year: 2009, month: 1, day: 2}  # Also got Friday off in 2009
        ]
      })

      tli = tl.getIterator()

      while (tli.hasNext())
        console.log(tli.next().toString())

      # 2009-01-05
      # 2009-01-06
      # 2009-01-07
  ###
  constructor: (timeline, @emit = 'Time', tz, @childGranularity = 'day') ->
    ###
    @constructor
    @param {Timeline} timeline A Timeline object
    @param {String} [emit] An optional String that specifies what should be emitted. Possible values are 'Time' (default),
       'Timeline', 'Date' (javascript Date Object), and 'ISOString'.
    @param {String} [childGranularity] When emit is 'Timeline', this is the granularity for the startOn and endBefore of the
       Timeline that is emitted.
    @param {String} [tz] A Sting specifying the timezone in the standard form,`America/New_York` for example. This is
       required if `emit` is 'Date' or 'ISOString'.
    ###
    utils.assert(@emit in ['Time', 'Timeline', 'Date', 'ISOString'], "emit must be 'Time', 'Timeline', 'Date', or 'ISOString'. You provided #{@emit}.")
    utils.assert(@emit != 'Date' or tz?, 'Must provide a tz (timezone) parameter when emitting Dates.')
    utils.assert(@emit != 'ISOString' or tz?, 'Must provide a tz (timezone) parameter when emitting ISOStrings.')
    # if timeline.granularity in ['Minute','Second', 'Millisecond']
      # console.error("Warning: iterating at granularity #{timeline.granularity} can be very slow.")
    @tz ?= tz  # !TODO: Need to test tz and emitting Dates
    if timeline instanceof Timeline
      @timeline = timeline
    else
      @timeline = new Timeline(timeline)
    @reset()

  StopIteration = if typeof(StopIteration) == 'undefined' then utils.StopIteration else StopIteration

  reset: () ->
    ###
    @method reset

    Will go back to the where the iterator started.
    ###
    if @timeline.step > 0
      @current = new Time(@timeline.startOn)
    else
      @current = new Time(@timeline.endBefore)
      @current.decrement()
    @count = 0
    @_proceedToNextValid()

  _contains = (t, startOn, endBefore) ->
    return t.lessThan(endBefore) and t.greaterThanOrEqual(startOn)

  hasNext: () ->
    ###
    @method hasNext
    @return {Boolean} Returns true if there are still things left to iterator over. Note that if there are holidays,
       weekends or non-workhours to skip, then hasNext() will take that into account. For example if the endBefore is a
       Sunday, hasNext() will return true the next time it is called after the Friday is emitted.
    ###
    return _contains(@current, @timeline.startOn, @timeline.endBefore) and (@count < @timeline.limit)

  _shouldBeExcluded: () ->
    if @current._isGranularityCoarserThanDay()
      return false

    # Do everything below for granularies day and lower
    currentInDay = @current.inGranularity('day')
    unless @current.dowString() in @timeline.workDays
      return true
    for holiday in @timeline.holidays
      if (utils.match(holiday, currentInDay))
        return true
    if @timeline.granularity in ['hour', 'minute',' second', 'millisecond']
      currentMinutes = @current.hour * 60
      if @current.minute?
        currentMinutes += @current.minute
      if @timeline.startOnWorkMinutes <= @timeline.endBeforeWorkMinutes
        if (currentMinutes < @timeline.startOnWorkMinutes) or (currentMinutes >= @timeline.endBeforeWorkMinutes)
          return true
      else
        if @timeline.startOnWorkMinutes >= currentMinutes > @timeline.endBeforeWorkMinutes
          return true
    return false

  _proceedToNextValid: () ->
    while @hasNext() and @_shouldBeExcluded()
      if @timeline.step > 0
        @current.increment()
      else
        @current.decrement()

  next: () ->
    ###
    @method next
    @return {Time/Timeline/Date/String} Returns the next value of the iterator. The start will be the first value emitted unless it should
       be skipped due to holiday, weekend, or workhour knockouts.
    ###
    if !@hasNext()
      throw new StopIteration('Cannot call next() past end.')
    currentCopy = new Time(@current)
    @count++
    for i in [Math.abs(@timeline.step)..1]
      if @timeline.step > 0
        @current.increment()
      else
        @current.decrement()
      @_proceedToNextValid()
    switch @emit
      when 'Time'
        return currentCopy
      when 'Date'
        return currentCopy.getJSDate(@tz)
      when 'ISOString'
        return currentCopy.getISOStringInTZ(@tz)
      when 'Timeline'
        config = {
          startOn: currentCopy.inGranularity(@childGranularity),
          endBefore: @current.inGranularity(@childGranularity),
          workDays: @timeline.workDays,
          holidays: @timeline.holidays,
          workDayStartOn: @timeline.workDayStartOn,
          workDayEndBefore: @timeline.workDayEndBefore
        }
        childtimeline = new Timeline(config)
        return childtimeline
      else
        throw new Error("You asked for type #{@emit}. Only 'Time', 'Date', 'ISOString', and 'Timeline' are allowed.")

exports.Timeline = Timeline
exports.TimelineIterator = TimelineIterator
    
