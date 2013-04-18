o1 = {a:1, b:2, c:3}
o2 = {}
o2.__proto__ = o1

o2.c = 30

console.log(o2.a, o2.b, o2.c)

if o2.c?
  console.log('has c')

if o2.a?
  console.log('has a')
