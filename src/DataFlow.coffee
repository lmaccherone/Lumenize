{utils} = require('tztime')

class DataFlow
  constructor: (@userConfig, @callback) ->
    @config = utils.clone(@userConfig)
    for c in @config
      c.allDependencies = []
      if c.parameters?
        DataFlow._addDependencies(c.allDependencies, c.parameters)
      if c.triggerParameters?
        DataFlow._addDependencies(c.allDependencies, c.triggerParameters)
      if c.addDataParameters?
        DataFlow._addDependencies(c.allDependencies, c.c.addDataParameters)

  @_addDependencies: (dependencies, parameters) ->  # result is side-effect of adding to dependencies
    for p in parameters
      if utils.type(p) is 'string' and utils.startsWith(p, '@')
        # strip off leading '@' and trailing fields
        dependency = p.split('.')[0].substring(1)
        dependencies.push(dependency)


exports.DataFlow = DataFlow