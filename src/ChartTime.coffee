utils = require('./utils')
timezoneJS = require('timezone-js').timezoneJS

class ChartTime
  ###
  # ChartTime #
  
  _Time axis creation/manipulation for charts_
  
  ## Features ##
  
  * Generate the values for time series chart axis
  * Allows for custom granularities like release/iteration/iteration_day
  * Knockout weekends and holidays (ChartTimeIterator)
  * Knockout non-work hours (ChartTimeIterator)
  * Drill up and down granularity
  * Work with precision around timezone differences
  * Month is 1-indexed instead of 0-indexed like Javascript's Date object
  * Date/Time math (add 3 months, subtract 2 weeks, etc.)
  * Tested
  * Documented
  
  ## Granularity ##
  
  Each ChartTime object has a granularity. This means that you never have to
  worry about any bits lower than your specified granularity. A day has only
  year, month, and day segments. You are never tempted to specify 11:59pm
  to specify the end of a day-long timebox.
  
  ChartTime supports the following granularities:
  
  * `year`
      * `month`
          * `day`
              * `hour`
                 * `minute`
                     * `second`
                         * `millisecond`
      * `quarter` (but not quarter_month, day, etc.)
      * `week` (ISO-8601 style week numbering)
         * `week_day` (Monday = 1, Sunday = 7)
  
  Also, you can define your own custom hierarchical granularities, for example...
  
  * `release`
     * `iteration`
        * `iteration_day`
    
  ## Timezone precision ##
  
  It's very hard to do filtering and grouping of time-series data with timezone precision. 
  
  For instance, 11pm in California on December 25 (Christmas holiday) is 2am December 26 (not a holiday)
  in New York. This also happens to be 7am December 26 GMT. If you have an event that occurs at 
  2011-12-26T07:00:00.000Z, then you need to decide what timezone to use as your context before you 
  decide if that event occured on Christmas day or not. It's not just holidays where this can burn you.
  Deciding if a piece of work finished in one iteration versus another can make a difference for
  you iteration metrics. The iteration metrics for a distributed team should look the same regardless
  of whether those metrics were generated in New York versus Los Angeles... versus Bangalore.
  
  The javascript Date object lets you work in either the local time or Zulu (GMT/UTC) time but it doesn't let you
  control the timezone. Do you know the correct way to apply the timezone shift to a JavaScript Date Object? 
  Do you know when Daylight Savings Time kicks in and New York is 4 hours shifted from GMT instead of 5? Will
  you remember to do it perfectly every time it's needed in your code?
  
  If you need this precision, ChartTime helps by clearly delineating the moment when you need to do 
  timezone manipulation... the moment you need to compare two or more dates. You can do all of your
  holiday/weekend knockout manipulation without regard to timezone and only consider the timezone
  upon comparison. 
  
  ## Month is 1-indexed as you would expect ##
  
  Javascript's date object uses 0 for January and 11 for December. ChartTime uses 1 for January and 12 for December...
  which is what ISO-8601 uses and what humans expect. Everyone who works with the javascript Date Object at one
  point or another gets burned by this.
  
  ## Week support ##
  
  ChartTime follows ISO-8601 where ever it makes sense. Implications of using this ISO format (paraphrased info from wikipedia):
  
  * All weeks have 7 days (i.e. there are no fractional weeks).
  * Any given day falls into a single week which means that incrementing across the year boundary in week
    granularity is without gaps or repeats.
  * Weeks are contained within a single year. (i.e. weeks are never spit over two years).
  * The above two implications also mean that we have to warp the boundaries of the year to accomplish this. In week
    granularity dates may appear in a different year than you would expect and some years have 53 weeks.
  * The date directly tells the weekday.
  * All years start with a Monday and end with a Sunday.
  * Dates represented as yyyyWww-d can be sorted as strings.
  
  **In general, it just greatly simplifies the use of week granularity in a chart situation.**
  
  The only real downside to this approach is that USA folks expect the week to start on Sunday. However, the ISO-8601 spec starts
  each week on Monday. Following ISO-8601, ChartTime uses 1 for Monday and 7 for Sunday which aligns with
  the US standard for every day except Sunday. The US standard is to use 0 for Sunday.
  
  ## Basic usage ##
  
      {ChartTimeIterator, ChartTimeRange, ChartTime} = require('../')
      
      d1 = new ChartTime({granularity: 'day', year: 2011, month: 2, day: 28})
      console.log(d1.toString())
      # 2011-02-28
      
  You can use the string short-hand rather than spell out the segments seperately. The granularity
  is automatically inferred from how many segments you provide.
  
      d2 = new ChartTime('2011-03-01')
      console.log(d2.toString())
      # 2011-03-01
      
  Increment/decrement and compare ChartTimes without regard to timezone
  
      console.log(d1.$gte(d2)) 
      d1.increment()
      console.log(d1.$eq(d2))
      # false
      # true
  
  Do math on them.
      
      d3 = d1.add(5)
      console.log(d3.toString())
      # 2011-03-06
  
  Get the day of the week.
  
      console.log(d3.dowString())
      # Sunday
      
  Subtraction is just addition with negative numbers.
  
      d3.addInPlace(-6)
      console.log(d3.toString())
      # 2011-02-28
  
  If you start on the last day of a month, adding a month takes you to the last day of the next month, 
  even if the number of days are different.
      
      d3.addInPlace(1, 'month')  
      console.log(d3.toString())
      # 2011-03-31
      
  Deals well with year-granularity math and leap year complexity.
  
      d4 = new ChartTime('2004-02-29')  # leap day
      d4.addInPlace(1, 'year')  # adding a year takes us to a non-leap year
      console.log(d4.toString())
      # 2005-02-28
      
  Week granularity correctly wraps and deals with 53-week years.
  
      w1 = new ChartTime('2004W53-6')
      console.log(w1.inGranularity('day').toString())
      # 2005-01-01
      
  Convert between any of the standard granularities. Also converts custom granularities (not shown) to
  standard granularities if you provide a `rataDieNumber()` function with your custom granularities.
  
      d5 = new ChartTime('2005-01-01')  # goes the other direction also
      console.log(d5.inGranularity('week_day').toString())
      # 2004W53-6
      
      q1 = new ChartTime('2011Q3')
      console.log(q1.inGranularity('millisecond').toString())
      # 2011-07-01T00:00:00.000
      
  ## Timezones ##
  
  ChartTime does timezone sensitive conversions. You must set the path to the tz files before doing any timezone sensitive comparisons.
  
      ChartTime.setTZPath('../vendor/tz')
      
      console.log(new ChartTime('2011-01-01').getJSDate('America/New_York'))
      # Sat, 01 Jan 2011 05:00:00 GMT
  ###
  constructor: (spec_RDN_Date_Or_String, granularity, tz) ->
    ###
    The constructor for ChartTime supports the passing in of a String, a rata die number (RDN), or a spec Object
    
    ## String ##
    
    When you pass in a **String**, ChartTime uses the masks that are defined for each granularity to figure out the granularity...
    unless you explicitly provide a granularity. This parser does not work on all valid ISO-8601 forms. Ordinal dates are not 
    supported at all but week number form (`"2009W52-7"`) is supported. The canonical form (`"2009-01-01T12:34:56.789"`) will work
    as will any shortened subset of it (`"2009-01-01"`, `"2009-01-01T12:34"`, etc.). We've added a form for Quarter
    granularity (`"2009Q4"`). Plus it will even parse strings in whatever custom granularity you provide based
    upon the mask that you provide for that granularity.
    
    If the granularity is specified but not all of the segments are provided, ChartTime will fill in the missing value 
    with the `lowest` value from granularitySpecs.
    
    The Lumenize hierarchy tools rely upon the property that a single character is used between segments so the ISO forms that 
    omit the delimeters are not supported.
    
    If the string has a timezone indicator on the end (`...+05:00` or `...Z`), ChartTime will ignore it. Timezone information
    is intended to only be used for comparison (see examples for timezone comparison).
    
    There are two special Strings that are recognized: `BEFORE_FIRST` and `PAST_LAST`. You must provide a granularity if you
    are instantiating a ChartTime with these values. They are primarily used for custom granularities where your users
    may mistakenly request charts for iterations and releases that have not yet been defined. They are particularly useful when 
    you want to iterate to the last defined iteration/release.

    ## Rata Die Number ##
    
    The **rata die number (RDN)** for a date is the number of days since 0001-01-01. You will probably never work
    directly with this number but it's what ChartTime uses to convert between granularities. When you are instantiating
    a ChartTime from an RDN, you must provide a granularity. Using RDN will work even for the granularities finer than day.
    ChartTime will populate the finer grained segments (hour, minute, etc.) with the approriate `lowest` value.

    ## Date ##
    
    You can also pass in a JavaScript Date() Object. The passing in of a tz with this option doesn't make sense. You'll end
    up with the same ChartTime value no matter what because the JS Date() already sorta has a timezone. I'm not sure if this
    option is even really useful. In most cases, you are probably better off using ChartTime.getZuluString()
    
    ## Spec ##
    
    You can also explicitly spell out the segments in a **spec** Object in the form of 
    `{granularity: 'day', year: 2009, month: 1, day: 1}`. If the granularity is specified but not all of the segments are 
    provided, ChartTime will fill in the missing value with the appropriate `lowest` value from granularitySpecs.
    
    ## granularity ##
    
    If you provide a granularity it will take precedence over whatever fields you've provided in your spec or whatever segments
    you have provided in your string. ChartTime will leave off extra values and fill in missing ones with the appropriate `lowest`
    value.
    
    ## tz ##
    
    Most of the time, ChartTime assumes that any dates you pass in are timezone less. You'll specify Christmas as 12-25, then you'll
    shift the boundaries of Christmas for a specific timezone for boundary comparison.
    
    However, if you provide a tz parameter to this constructor, ChartTime will assume you are passing in a true GMT date/time and shift into 
    the provided timezone. So...
    
        d = new ChartTime('2011-01-01T02:00:00:00.000Z', 'day', 'America/New_York')
        console.log(d.toString())
        # 2010-12-31
        
    Rule of thumb on when you want to use timezones:
    
    1. If you have true GMT date/times and you want to create a ChartTime, provide the timezone to this constructor.
    2. If you have abstract days like Christmas or June 10th and you want to delay the timezone consideration, don't provide a timezone to this constructor.
    3. In either case, if the dates you want to compare to are in GMT, but you've got ChartTimes or ChartTimeRanges, you'll have to provide a timezone on
       the way back out of ChartTime/ChartTimeRange
    ###
    @beforePastFlag = ''
    switch utils.type(spec_RDN_Date_Or_String)
      when 'string'
        s = spec_RDN_Date_Or_String
        if tz?
          newCT = new ChartTime(s, 'millisecond')
          jsDate = newCT.getJSDateInTZfromGMT(tz)
        else
          @_setFromString(s, granularity)
      when 'number'
        rdn = spec_RDN_Date_Or_String
        if tz?
          newCT = new ChartTime(rdn, 'millisecond')
          jsDate = newCT.getJSDateInTZfromGMT(tz)
        else
          @_setFromRDN(rdn, granularity)
      when 'date' 
        jsDate = spec_RDN_Date_Or_String
        unless tz?
          tz = 'GMT'
      when 'object'
        spec = spec_RDN_Date_Or_String
        if tz?
          spec.granularity = 'millisecond'
          newCT = new ChartTime(spec)
          jsDate = newCT.getJSDateInTZfromGMT(tz)
        else
          @_setFromSpec(spec)

    if tz?
      if @beforePastFlag in ['BEFORE_FIRST', 'PAST_LAST']
        throw new Error("Cannot do timezone manipulation on #{@beforePastFlag}")
      if granularity?
        @granularity = granularity
      unless @granularity?
        @granularity = 'millisecond'
      newSpec =
        year: jsDate.getUTCFullYear()
        month: jsDate.getUTCMonth() + 1
        day: jsDate.getUTCDate()
        hour: jsDate.getUTCHours()
        minute: jsDate.getUTCMinutes()
        second: jsDate.getUTCSeconds()
        millisecond: jsDate.getUTCMilliseconds()
        granularity: @granularity
      @_setFromSpec(newSpec)

    @_inBoundsCheck()
    @_overUnderFlow()
  
  # `granularitySpecs` is a static object that is used to tell ChartTime what to do with particular granularties. You can think of
  # each entry in it as a sort of sub-class of ChartTime. In that sense ChartTime is really a factory generating ChartTime objects
  # of type granularity. When generic timebox granularities are added to ChartTime by `ChartTime.addGranularity()`, it adds to this
  # `granularitySpecs` object.
  @granularitySpecs = {}
  @granularitySpecs['millisecond'] = {
    segments: ['year', 'month', 'day', 'hour', 'minute', 'second', 'millisecond'],
    mask: '####-##-##T##:##:##.###',
    lowest: 0,
    pastHighest: () -> return 1000,
  }
  @granularitySpecs['second'] = {
    segments: ['year', 'month', 'day', 'hour', 'minute', 'second'], 
    mask: '####-##-##T##:##:##',
    lowest: 0,
    pastHighest: () -> return 60
  }
  @granularitySpecs['minute'] = {
    segments: ['year', 'month', 'day', 'hour', 'minute'], 
    mask: '####-##-##T##:##',
    lowest: 0,
    pastHighest: () -> return 60
  }
  @granularitySpecs['hour'] = {
    segments: ['year', 'month', 'day', 'hour'], 
    mask: '####-##-##T##',
    lowest: 0,
    pastHighest: () -> return 24
  }
  @granularitySpecs['day'] = {
    segments: ['year', 'month', 'day'], 
    mask: '####-##-##',
    lowest: 1,
    pastHighest: (ct) -> return ct.daysInMonth() + 1
  }
  @granularitySpecs['month'] = {
    segments: ['year', 'month'], 
    mask: '####-##',
    lowest: 1,
    pastHighest: () -> return 12 + 1
  }  
  @granularitySpecs['year'] = {
    segments: ['year'], 
    mask: '####',
    lowest: 1,
    pastHighest: () -> return 9999 + 1
  }
  @granularitySpecs['week'] = {
    segments: ['year', 'week'],
    mask: '####W##',
    lowest: 1,
    pastHighest: (ct) ->
      if ct.is53WeekYear()
        return 53 + 1
      else
        return 52 + 1
  }
  @granularitySpecs['week_day'] = {
    segments: ['year', 'week', 'week_day'],
    mask: '####W##-#'
    lowest: 1,
    pastHighest: (ct) -> return 7 + 1
  }
  @granularitySpecs['quarter'] = { # !TODO: Support quarter_month and quarter_month_day
    segments: ['year', 'quarter'],
    mask: '####Q#',
    lowest: 1,
    pastHighest: () -> return 4 + 1
  }
  
  @_expandMask: (granularitySpec) ->
    mask = granularitySpec.mask
    if mask?
      if mask.indexOf('#') >= 0  
        i = mask.length - 1
        while mask.charAt(i) != '#'
          i--
        segmentEnd = i
        while mask.charAt(i) == '#'
          i--
        granularitySpec.segmentStart = i + 1
        granularitySpec.segmentLength = segmentEnd - i
        granularitySpec.regex = new RegExp(((if character == '#' then '\\d' else character) for character in mask.split('')).join(''))
      else  # 'PAST_LAST' and other specials will have no mask
        granularitySpec.regex = new RegExp(mask)
    
  # The code below should run when ChartTime is loaded. It mutates the granularitySpecs object by converting 
  # the mask into segmentStart, segmentLength, and regex
  for g, spec of @granularitySpecs  # !TODO: Do consistency checks on granularitySpecs in the loop below
    ChartTime._expandMask(spec)
      
  _inBoundsCheck: () ->
    if @beforePastFlag == '' or !@beforePastFlag?
      segments = ChartTime.granularitySpecs[@granularity].segments
      for segment in segments
        gs = ChartTime.granularitySpecs[segment]
        temp = this[segment]
        lowest = gs.lowest
        pastHighest = gs.pastHighest(this)
        if temp < lowest or temp >= pastHighest
          if temp == lowest - 1  # Supports overflows of just 1 in one segment. If more than that, will fail
            this[segment]++
            this.decrement(segment)
          else if temp == pastHighest
            this[segment]--
            this.increment(segment)
          else  
            throw new Error("Tried to set #{segment} to #{temp}. It must be >= #{lowest} and < #{pastHighest}")
        
  _setFromSpec: (spec) ->
    utils.assert(spec.granularity?, 'A granularity property must be part of the supplied spec.')
    @granularity = spec.granularity
    @beforePastFlag = if spec.beforePastFlag? then spec.beforePastFlag else ''
    segments = ChartTime.granularitySpecs[@granularity].segments
    for segment in segments
      if spec[segment]?
        this[segment] = spec[segment]
      else
        this[segment] = ChartTime.granularitySpecs[segment].lowest
        
  _setFromString: (s, granularity) ->
    
    # Remove the timezone stuff from the end
    if s.slice(-3, -2) == ':' and s.slice(-6, -5) in '+-'
      console.log("WARNING: Ignoring the timeshift information at the end of #{s}.")
      s = s.slice(0, -6)
    if s.slice(-1) == 'Z'
      s = s.slice(0, -1)
      
    if s in ['PAST_LAST', 'BEFORE_FIRST']
      if granularity?
        @granularity = granularity
        @beforePastFlag = s
        return
      else
        throw new Error('PAST_LAST/BEFORE_FIRST must have a granularity')
      
    for g, spec of ChartTime.granularitySpecs
      if spec.segmentStart + spec.segmentLength == s.length or spec.mask.indexOf('#') < 0  # for special granularities like 'PAST_LAST'
        if spec.regex.test(s)
          granularity = g
          break
    if not granularity?
      throw new Error("Error parsing string '#{s}'. Couldn't identify granularity.")

          
    @granularity = granularity
    segments = ChartTime.granularitySpecs[@granularity].segments
    stillParsing = true
    for segment in segments
      if stillParsing
        gs = ChartTime.granularitySpecs[segment]
        l = gs.segmentLength
        sub = ChartTime._getStringPart(s, segment)
        if sub.length != l
          stillParsing = false
      
      if stillParsing
        this[segment] = Number(sub)
      else
        this[segment] = ChartTime.granularitySpecs[segment].lowest  
        
  @_getStringPart = (s, segment) ->
    spec = ChartTime.granularitySpecs[segment]
    l = spec.segmentLength
    st = spec.segmentStart
    sub = s.substr(st, l)
    return sub
      
  _setFromRDN: (rdn, granularity) ->
    spec = {granularity: granularity}
    switch granularity
      when 'week', 'week_day'  # algorithm from http://en.wikipedia.org/wiki/Talk:ISO_week_date
        w = Math.floor((rdn - 1) / 7)
        d = (rdn - 1) % 7
        n = Math.floor(w / 20871)
        w = w % 20871
        z = w + (if w >= 10435 then 1 else 0)
        c = Math.floor(z / 5218)
        w = z % 5218
        x = w * 28 + [15, 23, 3, 11][c]
        y = Math.floor(x / 1461)
        w = x % 1461
        spec['year'] = y + n*400 + c*100 + 1
        spec['week'] = Math.floor(w / 28) + 1
        spec['week_day'] = d + 1
        @_setFromSpec(spec)
      when 'year', 'month', 'day', 'hour', 'minute', 'second', 'millisecond', 'quarter'  # algorithm from http://en.wikipedia.org/wiki/Julian_day#Gregorian_calendar_from_Julian_day_number
#         J = rdn + 1721425.5  # With it set like this dates like 2011-05-31 show up as 2011-06-00
        J = rdn + 1721425
        j = J + 32044
        g = Math.floor(j / 146097)
        dg = j % 146097
        c = Math.floor((Math.floor(dg / 36524) + 1) * 3 / 4)
        dc = dg - c * 36524
        b = Math.floor(dc / 1461)
        db = dc % 1461
        a = Math.floor((Math.floor(db / 365) + 1) * 3 / 4)
        da = db - a * 365
        y = g * 400 + c * 100 + b * 4 + a
        m = Math.floor((da * 5 + 308) / 153) - 2
        d = da - Math.floor((m + 4) * 153 / 5) + 122
        spec['year'] = y - 4800 + Math.floor((m + 2) / 12)
        spec['month'] = (m + 2) % 12 + 1
        spec['day'] = Math.floor(d) + 1
        spec['quarter'] = Math.floor((spec.month - 1) / 3) + 1
        @_setFromSpec(spec)
      else
        granularitySpec = ChartTime.granularitySpecs[granularity]
        # Build spec for lowest possible value
        specForLowest = {granularity: granularity}
        for segment in granularitySpec.segments
          specForLowest[segment] = ChartTime.granularitySpecs[segment].lowest
        beforeCT = new ChartTime(specForLowest)
        beforeRDN = beforeCT.rataDieNumber()
        afterCT = beforeCT.add(1) 
        afterRDN = afterCT.rataDieNumber()
        
        if rdn < beforeRDN
          @beforePastFlag = 'BEFORE_FIRST'
          return
          
        while true
          if rdn < afterRDN and rdn >= beforeRDN
            @_setFromSpec(beforeCT) 
            return
          beforeCT = afterCT
          beforeRDN = afterRDN
          afterCT = beforeCT.add(1)
          afterRDN = afterCT.rataDieNumber()
          if afterCT.beforePastFlag == 'PAST_LAST'
            if rdn >= ChartTime.granularitySpecs[beforeCT.granularity].dayPastEnd.rataDieNumber()
              @_setFromSpec(afterCT)
              @beforePastFlag == 'PAST_LAST'
              return
            else if rdn >= beforeRDN
              @_setFromSpec(beforeCT)
              return
            else
              throw new Error("RDN: #{rdn} seems to be out of range for #{granularity}")
        throw new Error("Something went badly wrong setting custom granularity #{granularity} for RDN: #{rdn}")
        
  granularityAboveDay: () ->
    ###
    Convenience function to tell if the ChartTime Object's granularity is above (courser than) "day" level.
    ###
    for segment in ChartTime.granularitySpecs[@granularity].segments
      if segment.indexOf('day') >= 0
        return false
    return true

  @setTZPath: (tzPath) ->
    ###
    Allows you to set the path (can be relative) to the tz files. Must be called prior to doing timezone sensitive comparisons. 
    ###
    timezoneJS.timezone.zoneFileBasePath = tzPath  # !TODO: Cleanup trailing '/'
    timezoneJS.timezone.init()  # !TODO: Get lazy loading working again. Now doing LOAD_ALL.
  
  getJSDate: (tz) ->
    ###
    Returns a JavaScript Date Object properly shifted. This Date Object can be compared to other Date Objects that you know
    are already in the desired timezone. If you have data that comes from an API in GMT. You can first create a ChartTime object from
    it and then (using this getJSDate() function) you can compare it to JavaScript Date Objects created in local time.
    
    The full name of this function should be getJSDateInGMTasummingThisCTDateIsInTimezone(tz). It converts **TO** GMT 
    (actually something that can be compared to GMT). It does **NOT** convert **FROM** GMT. Use getJSDateInTZfromGMT()
    if you want to go in the other direction.
    
    Note, you must set the path to the tz files with `ChartTime.setTZPath('path/to/tz/files')` before you do timezone 
    sensitive comparisions.
  
    ## Usage ##
    
        ct = new ChartTime('2011-01-01')
        d = new Date(Date.UTC(2011, 0, 1))
        
        console.log(ct.getJSDate('GMT').getTime() == d.getTime())
        # true
        
        console.log(ct.inGranularity('hour').add(-5).getJSDate('America/New_York').getTime() == d.getTime())
        # true
    
    ###
    if @beforePastFlag == 'PAST_LAST'
      return new Date(9999, 0, 1)
    if @beforePastFlag == 'BEFORE_FIRST'
      return new Date('0001-01-01')  # !TODO: This may not work on all browsers
    utils.assert(tz?, 'Must provide a timezone when calling getJSDate')
    utils.assert(timezoneJS.timezone.zoneFileBasePath?, 'Call ChartTime.setTZPath("path/to/tz/files") before calling getJSDate')
    ct = this.inGranularity('millisecond')
    utcMilliseconds = Date.UTC(ct.year, ct.month - 1, ct.day, ct.hour, ct.minute, ct.second, ct.millisecond)
    offset = timezoneJS.timezone.getTzInfo(new Date(utcMilliseconds), tz).tzOffset
    utcMilliseconds += offset * 1000 * 60
    newDate = new Date(utcMilliseconds)
    return newDate
    
  getJSDateString: (tz) ->
    ###
    Returns the canonical ISO-8601 date in zulu representation but shifted to the specified tz
    ###
    jsDate = @getJSDate(tz)
    return ChartTime.getZuluString(jsDate)
  
  @getZuluString: (jsDate) ->
    ###
    Given a JavaScript Date() Object, this will return the canonical ISO-8601 form.
    
    If you don't provide any parameters, it will return now, like `new Date()` except this is a zulu string.
    ###
    unless jsDate?
      jsDate = new Date()
    year = jsDate.getUTCFullYear()
    month = jsDate.getUTCMonth() + 1
    day = jsDate.getUTCDate()
    hour = jsDate.getUTCHours()
    minute = jsDate.getUTCMinutes()
    second = jsDate.getUTCSeconds()
    millisecond = jsDate.getUTCMilliseconds()
    s = ChartTime._pad(year, 4) + '-' + ChartTime._pad(month, 2) + '-' + ChartTime._pad(day, 2) + 'T' + 
        ChartTime._pad(hour, 2) + ':' + ChartTime._pad(minute, 2) + ':' + ChartTime._pad(second, 2) + '.' + 
        ChartTime._pad(millisecond, 3) + 'Z'
    return s
    
  getJSDateInTZfromGMT: (tz) ->
    ###
    This assumes that the ChartTime is an actual GMT date/time as opposed to some abstract day like Christmas and shifts
    it into the specified timezone.
    
    Note, this function will be off by an hour for the times near midnight on the days where there is a shift to/from daylight 
    savings time. The tz rules engine is designed to go in the other direction so we're mis-using it and will be using the wrong
    moment in rules-space for that hour. The cost of fixing this issue was deamed to high for chart applications.
    ###
    if @beforePastFlag == 'PAST_LAST'
      return new Date(9999, 0, 1)
    if @beforePastFlag == 'BEFORE_FIRST'
      return new Date('0001-01-01')  # !TODO: This may not work on all browsers
    utils.assert(tz?, 'Must provide a timezone when calling getJSDate')
    utils.assert(timezoneJS.timezone.zoneFileBasePath?, 'Call ChartTime.setTZPath("path/to/tz/files") before calling getJSDate')
    ct = this.inGranularity('millisecond')
    utcMilliseconds = Date.UTC(ct.year, ct.month - 1, ct.day, ct.hour, ct.minute, ct.second, ct.millisecond)
    offset = timezoneJS.timezone.getTzInfo(new Date(utcMilliseconds), tz).tzOffset
    utcMilliseconds -= offset * 1000 * 60
    newDate = new Date(utcMilliseconds)
    return newDate  
  
  toString: () ->
    ###
    Uses granularity `mask` to generate the string representation.
    ###
    if @beforePastFlag in ['BEFORE_FIRST', 'PAST_LAST']
      s = "#{@beforePastFlag}"
    else
      s = ChartTime.granularitySpecs[@granularity].mask
      segments = ChartTime.granularitySpecs[@granularity].segments
      for segment in segments
        granularitySpec = ChartTime.granularitySpecs[segment]
        l = granularitySpec.segmentLength
        start = granularitySpec.segmentStart
        before = s.slice(0, start)
        after = s.slice(start + l)
        s = before + ChartTime._pad(this[segment], l) + after
    return s

  @_pad = (n, l) ->
    result = n.toString()
    while result.length < l
      result = '0' + result
    return result

  @DOW_N_TO_S_MAP = {0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 7: 'Sunday'}
  @DOW_MONTH_TABLE = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
  dowNumber: () ->
    ###
    Returns the day of the week as a number. Monday = 1, Sunday = 7
    ###
    if @granularity == 'week_day'
      return @week_day
    if @granularity in ['day', 'hour', 'minute', 'second', 'millisecond']
      y = @year
      if (@month < 3) then y--
      dayNumber = (y + Math.floor(y/4) - Math.floor(y/100) + Math.floor(y/400) +
        ChartTime.DOW_MONTH_TABLE[@month-1] + @day) % 7
      if dayNumber == 0
        return 7
      else
        return dayNumber
    else
      return @inGranularity('day').dowNumber()

  dowString: () ->
    ###
    Returns the day of the week as a String.
    ###
    return ChartTime.DOW_N_TO_S_MAP[@dowNumber()]

  rataDieNumber: () ->  # Also called common era days
    ###
    Returns the number of days since 0001-01-01. Works for granularities finer than day (hour, minute, second, millisecond) but ignores the 
    segments of finer granularity than day.
    ###
    if @beforePastFlag == 'BEFORE_FIRST'
      return -1
    else if @beforePastFlag == 'PAST_LAST'
      return utils.MAX_INT
    else if ChartTime.granularitySpecs[@granularity].rataDieNumber?
      return ChartTime.granularitySpecs[@granularity].rataDieNumber(this)
    else
      y = @year - 1
      yearDays = y*365 + Math.floor(y/4) - Math.floor(y/100) + Math.floor(y/400)
      ew = Math.floor((yearDays + 3) / 7)  # algorithm for week/week_day from http://en.wikipedia.org/wiki/Talk:ISO_week_date
      if @month?
        monthDays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334][@month - 1]
        if @isLeapYear() and @month >= 3
          monthDays++
      else if @quarter?
        monthDays = [0, 90, 181, 273][@quarter - 1]
        if @isLeapYear() and @quarter >= 2
          monthDays++
      else
        monthDays = 0
      switch @granularity
        when 'year'
          return yearDays + 1
        when 'month', 'quarter'
          return yearDays + monthDays + 1
        when 'day', 'hour', 'minute', 'second', 'millisecond'
          return yearDays + monthDays + @day
        when 'week'
          return (ew + @week - 1) * 7 + 1
        when 'week_day'
          return (ew + @week - 1) * 7 + @week_day

  inGranularity: (granularity) ->
    ###
    Returns a new ChartTime object for the same date-time as this object but in the specified granularity.
    Fills in missing finer granularity bits with `lowest` values.
    ###
    if @granularity in ['year', 'month', 'day', 'hour', 'minute', 'second', 'millisecond']
      if granularity in ['year', 'month', 'day', 'hour', 'minute', 'second', 'millisecond']
        tempGranularity = @granularity
        @granularity = granularity
        newChartTime = new ChartTime(this)
        @granularity = tempGranularity
        return newChartTime
    return new ChartTime(this.rataDieNumber(), granularity)

  daysInMonth: () ->
    ###
    Returns the number of days in the current month for this ChartTime
    ###
    switch @month
      when 4, 6, 9, 11
        return 30
      when 1, 3, 5, 7, 8, 10, 12, 0 # Treating 0 like 12 for wrapping on decrement (bit of a hack but it works)
        return 31
      when 2
        if @isLeapYear()
          return 29
        else
          return 28

  isLeapYear: () ->
    ###
    True if this is a leap year.
    ###
    if (@year % 4 == 0)
      if (@year % 100 == 0)
        if (@year % 400 == 0)
          return true
        else
          return false
      else
        return true
    else
      return false
  
  @YEARS_WITH_53_WEEKS =  [4, 9, 15, 20, 26, 32, 37, 43, 48, 54, 60, 65, 71, 76, 82, 88, 93, 99, 105, 111, 116, 122, 128, 133, 139, 144, 150, 156, 161, 167, 172, 178, 184, 189, 195, 201, 207, 212, 218, 224, 229, 235, 240, 246, 252, 257, 263, 268, 274, 280, 285, 291, 296, 303, 308, 314, 320, 325, 331, 336, 342, 348, 353, 359, 364, 370, 376, 381, 387, 392, 398]
  is53WeekYear: () ->
    ###
    True if this is a 53-week year.
    ###
    lookup = @year % 400
    return lookup in ChartTime.YEARS_WITH_53_WEEKS

  $eq: (other) ->
    ###
    Returns true if this equals other. Throws an error if the granularities don't match.

        d3 = new ChartTime({granularity: 'day', year: 2011, month: 12, day: 31})
        d4 = new ChartTime('2012-01-01').add(-1)
        console.log(d3.$eq(d4))
        # true
    ###
    utils.assert(@granularity == other.granularity, "Granulary of #{this} does not match granularity of #{other} on equality/inequality test")

    if @beforePastFlag == 'PAST_LAST' and other.beforePastFlag == 'PAST_LAST'
      return true
    if @beforePastFlag == 'BEFORE_FIRST' and other.beforePastFlag == 'BEFORE_FIRST'
      return true
    if @beforePastFlag == 'PAST_LAST' and other.beforePastFlag != 'PAST_LAST'
      return false
    if @beforePastFlag == 'BEFORE_FIRST' and other.beforePastFlag != 'BEFORE_FIRST'
      return false    
    if other.beforePastFlag == 'PAST_LAST' and @beforePastFlag != 'PAST_LAST'
      return false
    if other.beforePastFlag == 'BEFORE_FIRST' and @beforePastFlag != 'BEFORE_FIRST'
      return false    
      
    segments = ChartTime.granularitySpecs[@granularity].segments
    for segment in segments
      if this[segment] != other[segment]
        return false
    return true

  $gt: (other) ->
    ###
    Returns true if this is greater than other. Throws an error if the granularities don't match

        d1 = new ChartTime({granularity: 'day', year: 2011, month: 2, day: 28})
        d2 = new ChartTime({granularity: 'day', year: 2011, month: 3, day: 1})
        console.log(d1.$gt(d2))
        # false
        console.log(d2.$gt(d1))
        # true
    ###
    utils.assert(@granularity == other.granularity, "Granulary of #{this} does not match granularity of #{other} on equality/inequality test")

    if @beforePastFlag == 'PAST_LAST' and other.beforePastFlag == 'PAST_LAST'
      return false
    if @beforePastFlag == 'BEFORE_FIRST' and other.beforePastFlag == 'BEFORE_FIRST'
      return false
    if @beforePastFlag == 'PAST_LAST' and other.beforePastFlag != 'PAST_LAST'
      return true
    if @beforePastFlag == 'BEFORE_FIRST' and other.beforePastFlag != 'BEFORE_FIRST'
      return false
    if other.beforePastFlag == 'PAST_LAST' and @beforePastFlag != 'PAST_LAST'
      return false
    if other.beforePastFlag == 'BEFORE_FIRST' and @beforePastFlag != 'BEFORE_FIRST'
      return true
    
    segments = ChartTime.granularitySpecs[@granularity].segments
    for segment in segments
      if this[segment] > other[segment]
        return true
      if this[segment] < other[segment]
        return false
    return false
     
  $gte: (other) ->
    ###
    True if this is greater than or equal to other.
    ###
    gt = this.$gt(other)
    if gt
      return true
    return this.$eq(other) 

  $lt: (other) ->
    ###
    True if this is less than other.
    ###
    return other.$gt(this)

  $lte: (other) ->
    ###
    True if this is less than or equal to other.
    ###
    return other.$gte(this)

  _overUnderFlow: () ->
    if @beforePastFlag in ['BEFORE_FIRST', 'PAST_LAST']
      return true
    else
      granularitySpec = ChartTime.granularitySpecs[@granularity]
      highestLevel = granularitySpec.segments[0]
      highestLevelSpec = ChartTime.granularitySpecs[highestLevel]
      value = this[highestLevel]
      pastHighest = highestLevelSpec.pastHighest(this)
      lowest = highestLevelSpec.lowest
      if value >= pastHighest
        @beforePastFlag = 'PAST_LAST'  # !TODO: This won't erase the other segments. Maybe that's OK.
        return true
      else if value < lowest
        @beforePastFlag = 'BEFORE_FIRST'
        return true
      else
        return false
        
  decrement: (granularity) ->
    ###
    Decrements by 1.
    ###

    if @beforePastFlag == 'PAST_LAST'
      @beforePastFlag = ''
      granularitySpec = ChartTime.granularitySpecs[@granularity]
      segments = granularitySpec.segments
      for segment in segments
        gs = ChartTime.granularitySpecs[segment]
        this[segment] = gs.pastHighest(this) - 1
    else
      lastDayInMonthFlag = (@day == @daysInMonth())
      granularity ?= @granularity
      granularitySpec = ChartTime.granularitySpecs[granularity]
      segments = granularitySpec.segments
      this[granularity]--
  
      if granularity is 'year'  # !TODO: Add support for week granularity and 53 week years. 
        # Fix it if you decrement from a leap year to a non-leap year
        if @day > @daysInMonth()
          @day = @daysInMonth()
      else
        i = segments.length - 1  # start just before the last one which should equal granularity
        segment = segments[i]
        granularitySpec = ChartTime.granularitySpecs[segment]
        while (i > 0) and (this[segment] < granularitySpec.lowest) # stop before going back to year
          this[segments[i - 1]]--
          this[segment] = granularitySpec.pastHighest(this) - 1
          i--
          segment = segments[i]
          granularitySpec = ChartTime.granularitySpecs[segment]
    
        if granularity == 'month' and (@granularity != 'month')
          if lastDayInMonthFlag or (@day > @daysInMonth())
            @day = @daysInMonth()
        
      @_overUnderFlow()
      return this
        
  increment: (granularity) ->
    ###
    Increments by 1.
    ###
    if @beforePastFlag == 'BEFORE_FIRST'
      @beforePastFlag = ''
      granularitySpec = ChartTime.granularitySpecs[@granularity]
      segments = granularitySpec.segments
      for segment in segments
        gs = ChartTime.granularitySpecs[segment]
        this[segment] = gs.lowest
    else 
      lastDayInMonthFlag = (@day == @daysInMonth())
      granularity ?= @granularity
      granularitySpec = ChartTime.granularitySpecs[granularity]
      segments = granularitySpec.segments
      this[granularity]++
  
      if granularity is 'year'  # !TODO: Add support for week granularity and 53 week years
        # Fix it if you increment from a leap year to a non-leap year
        if @day > @daysInMonth()
          @day = @daysInMonth()
      else
        i = segments.length - 1  # start just before the last one which should equal granularity
        segment = segments[i]
        granularitySpec = ChartTime.granularitySpecs[segment]
        while (i > 0) and (this[segment] >= granularitySpec.pastHighest(this)) # stop before going back to year
          this[segment] = granularitySpec.lowest
          this[segments[i - 1]]++
          i--
          segment = segments[i]
          granularitySpec = ChartTime.granularitySpecs[segment]
        if (granularity is 'month') and (@granularity isnt 'month')
          if lastDayInMonthFlag or (@day > @daysInMonth())
            @day = @daysInMonth()
            
      @_overUnderFlow()
      return this

  addInPlace: (qty, granularity) ->
    ###
    Adds qty to the ChartTime object. It uses increment and decrement so it's not going to be efficient for large values
    of qty, but it should be fine for charts where we'll increment/decrement small values of qty.

    qty can be negative for subtraction.
    ###
    granularity ?= @granularity

    if qty == 0
      return

    if qty == 1
      @increment(granularity)
    else if qty > 1
      @increment(granularity)
      @addInPlace(qty - 1, granularity)
    else if qty == -1
      @decrement(granularity)
    else # must be < -1
      @decrement(granularity)
      @addInPlace(qty + 1, granularity)
    return this

  add: (qty, granularity) ->
    ###
    Adds (or subtracts) quantity (negative quantity) and returns a new ChartTime.
    ###
    newChartTime = new ChartTime(this)
    newChartTime.addInPlace(qty, granularity)
    return newChartTime
    
  @addGranularity: (granularitySpec) -> 
    ###
    addGranularity allows you to add your own hierarchical granularities to ChartTime. Once you add a granularity to ChartTime
    you can then instantiate ChartTime objects in your newly specified granularity. You specify new granularities with 
    granularitySpec object like this:
        
        granularitySpec = {
          release: {
            segments: ['release'],
            mask: 'R##',
            lowest: 1,
            dayPastEnd: new ChartTime('2011-07-01')
            pastHighest: (ct) ->
              return ChartTime.granularitySpecs.iteration.timeBoxes.length + 1  # Yes, it's correct to use the length of iteration.timeBoxes
            rataDieNumber: (ct) ->
              return ChartTime.granularitySpecs.iteration.timeBoxes[ct.release-1][1-1].start.rataDieNumber()
          },
          iteration: {
            segments: ['release', 'iteration'],
            mask: 'R##I##',
            lowest: 1,
            dayPastEnd: new ChartTime('2011-07-01')        
            timeBoxes: [
              [
                {start: new ChartTime('2011-01-01'), label: 'R1 Iteration 1'},
                {start: new ChartTime('2011-02-01'), label: 'R1 Iteration 2'},
                {start: new ChartTime('2011-03-01'), label: 'R1 Iteration 3'},
              ],
              [
                {start: new ChartTime('2011-04-01'), label: 'R2 Iteration 1'},
                {start: new ChartTime('2011-05-01'), label: 'R2 Iteration 2'},
                {start: new ChartTime('2011-06-01'), label: 'R2 Iteration 3'},
              ]
            ]
            pastHighest: (ct) ->
              temp = ChartTime.granularitySpecs.iteration.timeBoxes[ct.release-1]?.length + 1
              if temp? and not isNaN(temp) and ct.beforePastFlag != 'PAST_LAST'
                return temp
              else
                numberOfReleases = ChartTime.granularitySpecs.iteration.timeBoxes.length
                return ChartTime.granularitySpecs.iteration.timeBoxes[numberOfReleases-1].length + 1
    
            rataDieNumber: (ct) ->
              return ChartTime.granularitySpecs.iteration.timeBoxes[ct.release-1][ct.iteration-1].start.rataDieNumber()
          },
          iteration_day: {  # By convention, it knows to use day functions on it. This is the lowest allowed custom granularity
            segments: ['release', 'iteration', 'iteration_day'],
            mask: 'R##I##-##',
            lowest: 1,
            dayPastEnd: new ChartTime('2011-07-01'),
            pastHighest: (ct) ->
              iterationTimeBox = ChartTime.granularitySpecs.iteration.timeBoxes[ct.release-1]?[ct.iteration-1]
              if !iterationTimeBox? or ct.beforePastFlag == 'PAST_LAST'
                numberOfReleases = ChartTime.granularitySpecs.iteration.timeBoxes.length
                numberOfIterationsInLastRelease = ChartTime.granularitySpecs.iteration.timeBoxes[numberOfReleases-1].length
                iterationTimeBox = ChartTime.granularitySpecs.iteration.timeBoxes[numberOfReleases-1][numberOfIterationsInLastRelease-1]
                
              thisIteration = iterationTimeBox.start.inGranularity('iteration')
              nextIteration = thisIteration.add(1)
              if nextIteration.beforePastFlag == 'PAST_LAST'
                return ChartTime.granularitySpecs.iteration_day.dayPastEnd.rataDieNumber() - iterationTimeBox.start.rataDieNumber() + 1
              else
                return nextIteration.rataDieNumber() - iterationTimeBox.start.rataDieNumber() + 1 
               
            rataDieNumber: (ct) ->
              return ChartTime.granularitySpecs.iteration.timeBoxes[ct.release-1][ct.iteration-1].start.rataDieNumber() + ct.iteration_day - 1
          }
        }    
        ChartTime.addGranularity(granularitySpec)

    
    The `mask` must cover all of the segments to get down to the granularity being specified. The digits of the granularity segments
    are represented with `#`. Any other characters can be used as a delimeter, but it should always be one character to comply with 
    the expectations of the Lumenize hierarchy visualizations. All of the standard granularities start with a 4-digit year to
    distinguish your custom granularity, your highest level must start with some number of digits other than 4 or a prefix letter 
    (`R` in the example above).
    
    In order for the ChartTimeIterator to work, you must provide `pastHighest` and `rataDieNumber` callback functions. You should
    be able to mimic (or use as-is) the example above for most use cases. Notice how the `rataDieNumber` function simply leverages
    `rataDieNumber` functions for the standard granularities.
    
    In order to convert into this granularity from some other granularity, you must provide an `inGranularity` callback [NOT YET IMPLEMENTED].
    But ChartTime will convert to any of the standard granularities from even custom granularities as long as a `rataDieNumber()` function
    is provided.
    
    **The `timeBoxes` propoerty in the `granularitySpec` Object above has no special meaning** to ChartTime or ChartTimeIterator. It's simply used
    by the `pastHighest` and `rataDieNumber` functions. The boundaries could come from where ever you want and even have been encoded as
    literals in the `pastHighest` and `rataDieNumber` callback functions.
    
    The convention of naming the lowest order granularity with `_day` at the end IS signficant. ChartTime knows to treat that as a day-level
    granularity. If there is a use-case for it, ChartTime could be upgraded to allow you to drill down into hours, minutes, etc. from any
    `_day` granularity but right now those lower order time granularities are only supported for the canonical ISO-6801 form.

    ###
    for g, spec of granularitySpec  # !TODO: Need a way for the user to provide a loose stream of timebox dates that are converted into this format. Would cleanup situations where the timeboxes overlapped and error out on impossible situations like nested timeboxes. Use the start.
      ChartTime._expandMask(spec)  # !TODO: Add @label() and @end() methods. The @start() method could also be an alias for @inGranularity()
      @granularitySpecs[g] = spec # !TODO: Assert that we don't have a conflict with existing granularities and that the granularity equals the last segment. Assert that the pastEnd date of one equals the start date of the next.


exports.ChartTime = ChartTime