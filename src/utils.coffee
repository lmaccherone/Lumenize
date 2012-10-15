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

class StopIteration extends ErrorBase

assert = (exp, message) ->
  if (!exp)
    throw new exports.AssertException(message)

# Uses the properties of obj1, so will still match if obj2 has extra properties.
# Also, keep in mind that this is only looking at obj1's "own" objects. Inherited ones are ignored.
match = (obj1, obj2) ->
  for own key, value of obj1
    if (value != obj2[key])
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

  newInstance = new obj.constructor()

  for key of obj
    newInstance[key] = clone(obj[key])

  return newInstance

exports.AssertException = AssertException
exports.StopIteration = StopIteration
exports.assert = assert
exports.match = match
exports.trim = trim
exports.startsWith = startsWith
exports.isArray = isArray
exports.type = type
exports.clone = clone
