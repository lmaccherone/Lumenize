fs            = require('fs')
path          = require('path')
{print}       = require('sys')
{spawn, exec} = require('child_process')
wrench        = require('wrench')
marked        = require('marked')

uglify = require("uglify-js")
execSync = require('exec-sync')

run = (command, options, next) ->
  if options? and options.length > 0
    command += ' ' + options.join(' ')

  {stdout, stderr} = execSync(command, true)
  if stderr.length > 0
    console.error("Error running `#{command}`\n" + stderr)
    process.exit(1)
  if next?
    next(stdout)
  else
    if stdout.length > 0
      console.log("Stdout exec'ing command '#{command}'...\n" + stdout)

#run = (command, options, next) ->
#  if options? and options.length > 0
#    command += ' ' + options.join(' ')
#  exec(command, (error, stdout, stderr) ->
#    if stderr.length > 0
#      console.log("Stderr exec'ing command '#{command}'...\n" + stderr)
#    if error?
#      console.log('exec error: ' + error)
#      runProducedError = true
#    if next?
#      next(stdout)
#    else
#      if stdout.length > 0
#        console.log("Stdout exec'ing command '#{command}'...\n" + stdout)
#  )
#  return runProducedError

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
  run('coffeedoctest', ['--readme', 'src', 'lumenize.coffee'])
  # create README.html
  readmeDotCSSString = fs.readFileSync('read-me.css', 'utf8')
  readmeDotMDString = fs.readFileSync('README.md', 'utf8')
  readmeDotHTMLString = marked(readmeDotMDString)
  readmeDotHTMLString = """
    <style>
    #{readmeDotCSSString}
    </style>
    <body>
    <div class="readme">
    #{readmeDotHTMLString}
    </div>
    </body>
  """
  fs.writeFileSync(path.join(__dirname, 'docs', 'README.html'), readmeDotHTMLString)

  # jsduckify
  {name, version} = require('./package.json')
  outputDirectory = path.join(__dirname, 'docs', "#{name}-docs")
  if fs.existsSync(outputDirectory)
    wrench.rmdirSyncRecursive(outputDirectory, false)
  run('node_modules/jsduckify/bin/jsduckify', ['-d', outputDirectory, __dirname])
)

task('pub-docs', 'Push master to gh-pages on github', () ->
  invoke('docs')
  pubDocsRaw()
)

pubDocsRaw = () ->
  process.chdir(__dirname)
  run('git push -f origin master:gh-pages')

task('publish', 'Publish to npm', () ->
  process.chdir(__dirname)
  run('cake test')  # Doing this exernally to make it synchrous and cause the rest to not run unless it fails
  invoke('docs')
  invoke('build')
  # if git status --porcelain comes back blank, then everything is committed but might not be pushed
  run('git status --porcelain', [], (stdout) ->
    if stdout.length == 0
      # Need to confirm that everything is pushed
#      console.log('running git push origin master')
#      run('git push origin master')
      {stdoutOrigin, stderrOrigin} = execSync('git rev-parse origin', true)
      {stdoutMaster, stderrMaster} = execSync('git rev-parse master', true)
      console.log(stderrOrigin, stderrMaster)
#      console.log('running npm publish')
#      {stdout, stderr} = execSync('npm publish .', true)
#      if fs.existsSync('npm-debug.log')
#        console.error('`npm publish` failed. See npm-debug.log for details.')
#      else
#        console.log('running git tag')
#        run("git tag v#{require('./package.json').version}")
#        run("git push --tags")
#        console.log('running pubDocsRaw()')
#        pubDocsRaw()
    else
      console.error('`git status --porcelain` was not clean. Not publishing.')
  )
)

task('build', 'Build with browserify and place in ./deploy', () -> 
  browserify = require('browserify')
  fileify = require('fileify')
  b = browserify()
  b.use(fileify('files', __dirname + '/files'))
  b.ignore(['files'])
  b.require("./lumenize")
  {name, version} = require('./package.json')
  fileString = """
    /*
    #{name} version: #{version}
    */
    #{b.bundle()}
  """
  deployFileName = "deploy/#{name}.js"
  fs.writeFileSync(deployFileName, fileString)

  minFileString = uglify.minify(deployFileName).code
  fs.writeFileSync("deploy/#{name}-min.js", fileString)

#  run("uglifyjs deploy/#{name}.js > deploy/#{name}-min.js")
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

#task('test', 'Run the CoffeeScript test suite with nodeunit', () ->
#  {reporters} = require 'nodeunit'
#  process.chdir __dirname
#  reporters.default.run(['test'])
#)

task('test', 'Run the CoffeeScript test suite with nodeunit', () ->
  {reporters} = require('nodeunit')
  process.chdir(__dirname)
  reporters.default.run(['test'], undefined, (failure) ->
    if failure?
      console.error(failure)
      process.exit(1)
  )
)

