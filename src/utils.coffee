exports.MAX_INT = 2147483647  # using the signed 32 version because that's all we'll need and it enables bitwise ops
exports.MIN_INT = -2147483648

class ErrorBase extends Error
  constructor: (@message = 'Unknown error.') ->
    if Error.captureStackTrace?
      Error.captureStackTrace(this, @constructor)
    @name = @constructor.name

  toString: ->
    return "#{@name}: #{@message}"

class AssertException extends ErrorBase

assert = (exp, message) ->
  if (!exp)
    throw new exports.AssertException(message)

# Uses the properties of obj1, so will still match if obj2 has extra properties.
match = (obj1, obj2) ->
  for key, value of obj1
    if (value != obj2[key])
      return false
  return true

exactMatch = (a, b) ->
  return true if a is b
  atype = typeof(a); btype = typeof(b)
  return false if atype isnt btype
  return false if (!a and b) or (a and !b)
  return false if atype isnt 'object'
  return false if a.length and (a.length isnt b.length)
  return false for key, val of a when !(key of b) or not exactMatch(val, b[key])
  return true

# At the top level, it will match even if obj1 is missing some elements that are in obj2, but at the lower levels, it must be an exact match.
filterMatch = (obj1, obj2) ->
  unless type(obj1) is 'object' and type(obj2) is 'object'
    throw new Error('obj1 and obj2 must both be objects when calling filterMatch')
  for key, value of obj1
    if not exactMatch(value, obj2[key])
      return false
  return true

trim = (val) ->
  return if String::trim? then val.trim() else val.replace(/^\s+|\s+$/g, "")
  
startsWith = (bigString, potentialStartString) ->
  return bigString.substring(0, potentialStartString.length) == potentialStartString

isArray = (a) ->
  return Object.prototype.toString.apply(a) == '[object Array]'
  
type = do ->  # from http://arcturo.github.com/library/coffeescript/07_the_bad_parts.html
  classToType = {}
  for name in "Boolean Number String Function Array Date RegExp Undefined Null".split(" ")
    classToType["[object " + name + "]"] = name.toLowerCase()

  (obj) ->
    strType = Object::toString.call(obj)
    classToType[strType] or "object"
    
clone = (obj) ->
  if not obj? or typeof obj isnt 'object'
    return obj

  if obj instanceof Date
    return new Date(obj.getTime())

  if obj instanceof RegExp
    flags = ''
    flags += 'g' if obj.global?
    flags += 'i' if obj.ignoreCase?
    flags += 'm' if obj.multiline?
    flags += 'y' if obj.sticky?
    return new RegExp(obj.source, flags)

  newInstance = new obj.constructor()

  for key of obj
    newInstance[key] = clone(obj[key])

  return newInstance

keys = Object.keys or (obj) ->
  return (key for key, val of obj)

values = (obj) ->
  return (val for key, val of obj)

exports.AssertException = AssertException
exports.assert = assert
exports.match = match
exports.filterMatch = filterMatch
exports.trim = trim
exports.startsWith = startsWith
exports.isArray = isArray
exports.type = type
exports.clone = clone
exports.keys = keys
exports.values = values
