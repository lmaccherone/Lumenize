class A
  @newFromStatic: () ->
    o = new @constructor()
    return o

  f1: () ->
    return 1

class B extends A
  f2: () ->
    return 2

b = B.newFromStatic()

console.log(b.f1())
console.log(b.f2())