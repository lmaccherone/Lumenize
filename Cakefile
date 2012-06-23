fs            = require('fs')
path          = require('path')
{print}       = require('util')
{spawn, exec} = require('child_process')


run = (command, options, next) ->
  if options? and options.length > 0
    command += ' ' + options.join(' ')
  exec(command, (error, stdout, stderr) ->
    if stderr.length > 0
      console.log("Stderr exec'ing command '#{command}'...\n" + stderr)
    if error?
      console.log('exec error: ' + error)
    if next?
      next(stdout)
    else
      if stdout.length > 0
        console.log("Stdout exec'ing command '#{command}'...\n" + stdout)
  )

compile = (watch, callback) ->
  if typeof watch is 'function'
    callback = watch
    watch = false
  options = ['-c', '-o', 'js', 'src']
  options.unshift '-w' if watch
  run('coffee', options)

task('compile', 'Compile CoffeeScript source files to JavaScript and place in ./js', () ->
    compile()
)

task('watch', 'Recompile CoffeeScript source files when modified and place in ./js', () ->
    compile(true)
)

task('docs', 'Generate docs with CoffeeDoc and place in ./docs', () ->
  fs.readdir('src', (err, contents) ->
    projectCoffeeFile =  path.basename(__dirname) + '.coffee'
    srcPlus = "#{projectCoffeeFile}"
    files = ("#{file}" for file in contents when (file.indexOf('.coffee') > 0))

    # Make sure the file with the same name as the project (directory) is at the beginning
    position = files.indexOf(srcPlus)
    if position > 0
      files = [srcPlus].concat(files[0..position-1], files[position+1..files.length-1])

    process.chdir(__dirname + '/src')
    run('coffeedoc', ['-o', '../docs', '--readme', '-r', '../README.md', '-p', '../package.json'].concat(files))
    
    process.chdir(__dirname)
    run('coffeedoctest', ['--readme', 'src'])
  )
)

task('pub-docs', 'Push master to gh-pages on github', () ->
  process.chdir(__dirname)
  run('git push -f origin master:gh-pages')
)

task('install', 'Install globally but from this source using npm', () ->
  process.chdir(__dirname)
  run('npm install -g .')
)

task('publish', 'Publish to npm', () ->
  process.chdir(__dirname)
  run('npm publish .')
)

task('build', 'Build with browserify and place in ./deploy', () ->
  fs.readdir('src', (err, contents) ->
    browserify = require('browserify')
    fileify = require('fileify')
    files = ("./src/#{file}" for file in contents when (file.indexOf('.coffee') > 0))
    b = browserify()
    b.use(fileify('files', __dirname + '/files'))
    b.ignore(['files'])
    b.require(files)
    fs.writeFileSync("deploy/#{path.basename(__dirname)}.js", b.bundle())
    run("uglifyjs deploy/#{path.basename(__dirname)}.js > deploy/#{path.basename(__dirname)}-min.js")
  ) # !TODO: Need to run tests on the built version
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

option('-n', '--name [NAME]', 'name of project to create')

task('create', 'Creates a new directory with the recommended structure', (options) ->
  name = options.name
  fs.mkdir(name)
  fs.mkdir(name + '/src')
  fs.mkdir(name + '/test')
  fs.mkdir(name + '/node_modules')
  
  fs.readdir(name, (err, files) -> 
    if 'package.json' in files
      console.log('package.json already exists')
    else
      run('system_profiler SPSoftwareDataType', [], (stdout) ->
        matcher = /User Name: ([\w\s]+) \(/
        groups = matcher.exec(stdout)
        packageJSON = """{
          "name": "#{name}",
          "description": "",
          "version": "0.1.0",
          "author": "#{groups[1]}",
          "dependencies": {},
          "devDependencies": {}
        }"""
        fs.writeFileSync(name + '/package.json', packageJSON)
      )
    if 'Cakefile' in files
      console.log('Cakefile already exists')
    else
      fs.linkSync('Cakefile', name + '/Cakefile')
    if '.gitignore' in files
      console.log('.gitignore already exists')
    else
      gitignore = """
      coffeedoctest_temp
      .DS_Store
      """
      fs.writeFileSync(name + '/.gitignore', gitignore)
  )
)
