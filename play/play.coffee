someFunction = (parameter, otherParameter) ->
  someVariable = 1 + 2
  return someVariable

console.log(someFunction())


trapArea = (pointA,pointB) ->
  height = (pointB.y + pointA.y) / 2
  width = pointB.x - pointA.x
  area = height * width
  return area

pointA = {x: 1, y: 2}
pointB = {x: 3, y: 3}
console.log(trapArea(pointA, pointB))

