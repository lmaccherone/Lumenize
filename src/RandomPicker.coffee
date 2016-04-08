class RandomPicker  # !TODO: Need to document config and methods!!!
  ###
  @class RandomPicker

  Takes a config object like the one shown below, with the same format as is output by Lumenize.histogram()

      config =
        histogram: [
          { label: '< 10', count: 1 },  # histogram fields index, startOn, and endBelow are ignored, but returned by getRow() if provided
          { label: '10-20', count: 10 },
          { label: '20-30', count: 102 },
          { label: '30-40', count: 45},
          { label: '>= 40', count: 7}
        ]

  So that it will make more sense when used with hand generated distributions, it will also take the following

      config =
        distribution: [
          { value: -1.0, p: 0.25 }
          { value:  2.0, p: 0.50 },
          { value:  8.0, p: 0.25 }
        ]

  Note, that it runs the same exact code, just replacing what fields are used for the frequencyField and returnValueField
  Similarly, you can override these by explicitly including them in your config.

  Also, note that you need not worry about making your 'p' values add up to 1.0. It figures out the portion of the total

  ###
  constructor: (@config) ->
    if @config.histogram?
      @table = @config.histogram
    else if @config.distribution?
      @table = @config.distribution
    else
      throw new Error('Must provide either a histogram or distribution in your config.')

    unless @config.frequencyField?
      if @config.histogram?
        @config.frequencyField = 'count'
      else if @config.distribution?
        @config.frequencyField = 'p'

    unless @config.returnValueField?
      if @config.histogram?
        @config.returnValueField = 'label'
      else if @config.distribution?
        @config.returnValueField = 'value'

    total = 0
    total += r[@config.frequencyField] for r in @table
    r._p = r[@config.frequencyField] / total for r in @table
    cumulative = 0
    for r in @table
      cumulative += r._p
      r._pCumulative = cumulative

  getRow: () ->
    n = Math.random()
    for r in @table
      if n < r._pCumulative
        return r
    return @table[@table.length - 1]  # Needed in rare cases due to real number math approximations

  get: () ->
    return @getRow()[@config.returnValueField]


exports.RandomPicker = RandomPicker