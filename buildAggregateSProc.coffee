{OLAPCube, functions} = require('./')
{utils} = require('tztime')
{arrayOfMaps_To_CSVStyleArray, csvStyleArray_To_ArrayOfMaps} = require('./')


before = """
function cube() {
"""
after = """
  var theCube = new OLAPCube();
  console.log(theCube);
}
"""

aggregateSProc = before + utils.toString() + functions.toString() + arrayOfMaps_To_CSVStyleArray.toString() + csvStyleArray_To_ArrayOfMaps.toString() + after
#console.log(aggregateSProc)

browserify = require('browserify')
b = browserify()
b.ignore(['files'])
b.require('./src/OLAPCube.coffee')
#console.log(b.bundle())

coffee = require('coffee-script')
output = coffee.compile('hello world')
console.log(output)