books = [
  {title: "The Three Musketeers", author: "Alexandre Dumas", century: 19, pages: 500},
  {title: "The Count of Monte Cristo", author: "Alexandre Dumas", century: 19, pages: 600},
  {title: "Pride and Prejudice", author: "Jane Austen", century: 19, pages: 500},
  {title: "Emma", author: "Jane Austen", century: 19, pages: 400},
  {title: "Mansfield Park", author: "Jane Austen", century: 19, pages: 650},
  {title: "Ulysses", author: "James Joyce", century: 20, pages: 400},
  {title: "The Great Gatsby", author: "F. Scott Fitzgerald", century: 20, pages: 350},
  {title: "A Portrait of the Artist", author: "James Joyce", century: 20, pages: 325},
  {title: "The Shining", author: "Stephen King", century: 20, pages: 1000},
  {title: "The Dark Tower", author: "Stephen King", century: 21, pages: 900}
]

{OLAPCube} = require("../lumenize")

dimensions = [{field:  "century"}]
metrics = [{f: "count"}]
config = {dimensions}

cube = new OLAPCube(config, books)

console.log(cube.toString())



