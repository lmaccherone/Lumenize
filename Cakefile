fs = require('fs')
path = require('path')
{spawn, exec} = require('child_process')
wrench = require('wrench')
marked = require('marked')
uglify = require("uglify-js")
browserify = require('browserify')
fileify = require('fileify-lm')
execSync = require('exec-sync')

runSync = (command, options, next) ->
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

runAsync = (command, options, next) ->
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

task('docs', 'Generate docs with CoffeeDoc and place in ./docs', () ->
  process.chdir(__dirname)
  runSync('coffeedoctest', ['--readme', 'src', 'lumenize.coffee'])
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
  runSync('node_modules/jsduckify/bin/jsduckify', ['-d', outputDirectory, __dirname])
)

task('pub-docs', 'Push master to gh-pages on github', () ->
  pubDocsRaw()
)

pubDocsRaw = () ->
  process.chdir(__dirname)
  runAsync('git push -f origin master:gh-pages')

task('publish', 'Publish to npm', () ->
  process.chdir(__dirname)
  runSync('cake test')  # Doing this exernally to make it synchrous
  invoke('docs')
  invoke('build')
  runSync('git status --porcelain', [], (stdout) ->
    if stdout.length == 0
      {stdout, stderr} = execSync('git rev-parse origin/master', true)
      stdoutOrigin = stdout
      {stdout, stderr} = execSync('git rev-parse master', true)
      stdoutMaster = stdout
      if stdoutOrigin == stdoutMaster
        console.log('running npm publish')
        {stdout, stderr} = execSync('npm publish .', true)
        if fs.existsSync('npm-debug.log')
          console.error('`npm publish` failed. See npm-debug.log for details.')
        else
          console.log('running pubDocsRaw()')
          pubDocsRaw()
          console.log('running git tag')
          runSync("git tag v#{require('./package.json').version}")
          runAsync("git push --tags")
      else
        console.error('Origin and master out of sync. Not publishing.')
    else
      console.error('`git status --porcelain` was not clean. Not publishing.')
  )
)

task('build', 'Build with browserify and place in ./deploy', () -> 
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
  {reporters} = require('nodeunit')
  process.chdir(__dirname)
  reporters.default.run(['test'], undefined, (failure) ->
    if failure?
      console.error(failure)
      process.exit(1)
  )
)

