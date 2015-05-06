lumenize = require('../')
RandomPicker = lumenize.RandomPicker
histogram = lumenize.histogram

exports.randomPickerTest =

  testDistribution: (test) ->
    config =
      distribution: [
        { value: -1.0, p: 0.25 }
        { value:  2.0, p: 0.50 },
        { value:  8.0, p: 0.25 }
      ]

    picker = new RandomPicker(config)

    matrix = {}
    for r in config.distribution
      matrix[r.value] = 0

    iterations = 10000
    for i in [1..iterations]
      matrix[picker.get()]++

    # Note, there is a slim chance that the tests below will fail even if the code is correct
    test.ok(.225 * iterations < matrix['-1'] < .275 * iterations)
    test.ok(.225 * iterations < matrix['8'] < .275 * iterations)
    test.ok(.475 * iterations < matrix['2'] < .525 * iterations)

    console.log('\nRandomPicker output:', matrix, '\n\n')  # Leaving this in so that it will show up as uncompleted work in my test output

    test.done()