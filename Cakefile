fs            = require('fs')
path          = require('path')
{print}       = require('sys')
{spawn, exec} = require('child_process')
wrench        = require('wrench')

runProducedError = false
process.on('exit', () ->
  if runProducedError
    console.log('\nErrors found. Exiting CakeFile with code 1.')
    process.exit(1)
)

run = (command, options, next) ->
  if options? and options.length > 0
    command += ' ' + options.join(' ')
  exec(command, (error, stdout, stderr) ->
    if stderr.length > 0
      console.log("Stderr exec'ing command '#{command}'...\n" + stderr)
    if error?
      console.log('exec error: ' + error)
      runProducedError = true
    if next?
      next(stdout)
    else
      if stdout.length > 0
        console.log("Stdout exec'ing command '#{command}'...\n" + stdout)
  )
  return runProducedError

#compile = (watch, callback) ->
#  if typeof watch is 'function'
#    callback = watch
#    watch = false
#  options = ['-c', '-o', 'js', 'src']
#  options.unshift '-w' if watch
#  run('coffee', options)
#
#task('compile', 'Compile CoffeeScript source files to JavaScript and place in ./js', () ->
#    compile()
#)

#task('docs', 'Generate docs with CoffeeDoc and place in ./docs', () ->
#  fs.readdir('src', (err, contents) ->
#    projectCoffeeFile =  path.basename(__dirname) + '.coffee'
#    srcPlus = "#{projectCoffeeFile}"
#    files = ("#{file}" for file in contents when (file.indexOf('.coffee') > 0))
#
#    # Make sure the file with the same name as the project (directory) is at the beginning
#    position = files.indexOf(srcPlus)
#    if position > 0
#      files = [srcPlus].concat(files[0..position-1], files[position+1..files.length-1])
#
#    process.chdir(__dirname + '/src')
#    run('coffeedoc', ['-o', '../docs', '-p', '../package.json'].concat(files))
#
#    process.chdir(__dirname)
#    run('coffeedoctest', ['--readme', 'src', 'lumenize.coffee'])
#  )
#)

task('docs', 'Generate docs with CoffeeDoc and place in ./docs', () ->
  process.chdir(__dirname)
  run('coffeedoctest', ['--readme', 'src', 'lumenize.coffee'], (stout) ->
    unless runProducedError
      {name, version} = require('./package.json')
      outputDirectory = path.join(__dirname, 'docs', "#{name}-#{version}-docs")
      run('node_modules/.bin/jsduckify', ['--noduck', '-d', outputDirectory, __dirname], (stout) ->
        unless runProducedError
          commonOutputDirectory = path.join(__dirname, 'docs', "#{name}-docs")
          if fs.existsSync(commonOutputDirectory)
            wrench.rmdirSyncRecursive(commonOutputDirectory, false)
          wrench.copyDirSyncRecursive(outputDirectory, commonOutputDirectory)
      )
  )
)

#task('pub-docs', 'Push master to gh-pages on github', () ->
#  process.chdir(__dirname)
#  run('git push -f origin master:gh-pages')
#)

task('publish', 'Publish to npm', () ->
  process.chdir(__dirname)
  run('npm publish .')
)

task('build', 'Build with browserify and place in ./deploy', () -> 
  browserify = require('browserify')
  fileify = require('fileify')
  b = browserify()
  b.use(fileify('files', __dirname + '/files'))
  b.ignore(['files'])
  b.require("./lumenize")
  {name, version} = require('./package.json')
  fs.writeFileSync("deploy/#{name}-#{version}.js", b.bundle())
  run("uglifyjs deploy/#{name}-#{version}.js > deploy/#{name}-#{version}-min.js")
  # !TODO: Need to run tests on the built version
)

# task('prep-tz', 'NOT WORKING - Prepare the tz files found in vendor/tz for browserify/fileify and place in files/tz.', () ->
#   files = [
#     'africa',
#     'antarctica',
#     'asia',
#     'australasia',
#     'backward',
#     'etcetera',
#     'europe',
#     'northamerica',
#     'pacificnew',
#     'southamerica',
#   ]
#   for f in files
#     inputFile = 'vendor/tz/' + f
#     outputFile = 'files2/tz/' + f + '.lzw'
#     fs.readFile(inputFile, (err, contents) ->
#       lzw.compress({
#         input: contents,
#         output: (output) ->
#           fs.writeFile(outputFile, output)
#       })
#     ) 
# )

task('test', 'Run the CoffeeScript test suite with nodeunit', () ->
  {reporters} = require 'nodeunit'
  process.chdir __dirname
  reporters.default.run ['test']
)

