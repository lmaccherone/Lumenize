# TODO: Automate updating links to docs and cdn with version number change

fs = require('fs')
path = require('path')
{spawnSync} = require('child_process')
wrench = require('wrench')
findRemoveSync = require('find-remove')
marked = require('marked')
uglify = require("uglify-js")
browserify = require('browserify')
#fileify = require('fileify-lm')
_ = require('lodash')

runSync = (command, options, next) ->  # !TODO: Upgrade to runSync in node-localstorage
  {stderr, stdout} = runSyncRaw(command, options)
  if stderr?.length > 0
    console.error("Error running `#{command}`\n" + stderr)
    process.exit(1)
  if next?
    next(stdout)
  else
    if stdout?.length > 0
      console.log("Stdout running command '#{command}'...\n" + stdout)

runSyncNoExit = (command, options = []) ->
  {stderr, stdout} = runSyncRaw(command, options)
  console.log("Output of running '#{command + ' ' + options.join(' ')}'...\n#{stderr}\n#{stdout}\n")
  return {stderr, stdout}

runSyncRaw = (command, options) ->
  output = spawnSync(command, options)
  stdout = output.stdout?.toString()
  stderr = output.stderr?.toString()
  return {stderr, stdout}

task('doctest', 'Test examples in documenation.', () ->
  process.chdir(__dirname)
  runSync('coffeedoctest', ['--readme', 'src', 'lumenize.coffee'])
)

task('docs', 'Generate docs with JSDuckify/JSDuck and place in ./docs', () ->
  runSync('cake doctest')
  process.chdir(__dirname)
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
  process.chdir(__dirname)
  runSync('jsduckify', ['-d', outputDirectory, __dirname])
)

task('publish', 'Publish to npm and add git tags', () ->
  process.chdir(__dirname)
  console.log('Running tests')
  process.chdir(__dirname)
  runSync('cake', ['test'])  # Doing this externally to make it synchronous

  invoke('build')

  invoke('docs')

  console.log('Checking git status --porcelain')
  runSync('git', ['status', '--porcelain'], (stdout) ->
    if stdout.length == 0

      console.log('checking origin/master')
      {stderr, stdout} = runSyncNoExit('git', ['rev-parse', 'origin/master'])
      console.log('checking master')
      stdoutOrigin = stdout
      {stderr, stdout} = runSyncNoExit('git', ['rev-parse', 'master'])
      stdoutMaster = stdout

      if stdoutOrigin == stdoutMaster

        console.log('running npm publish')
        runSyncNoExit('npm', ['publish', '.'])

        if fs.existsSync('npm-debug.log')
          console.error('`npm publish` failed. See npm-debug.log for details.')
        else

          console.log('creating git tag')
          runSyncNoExit("git", ["tag", "v#{require('./package.json').version}"])
          runSyncNoExit("git", ["push", "--tags"])

          console.log('removing .js and .map files')
          invoke('clean')

      else
        console.error('Origin and master out of sync. Not publishing.')
    else
      console.error('`git status --porcelain` was not clean. Not publishing.')
  )
)

task('build', 'Build with browserify and place in ./deploy', () ->
  console.log('building...')
  invoke('update-bower-version')

  console.log('Compiling...')
  runSyncNoExit('coffee', ['--compile', 'lumenize.coffee', 'src'])

  b = browserify()
  b.require('./lumenize', {expose: 'lumenize'})
  b.transform('brfs')
  b.bundle((err, buf) ->
    fileString = buf.toString('utf8')

    {name, version} = require('./package.json')
    fileString = """
    /*
    #{name} version: #{version}
    */
    #{fileString}
    """
    deployFileName = "deploy/#{name}.js"
    unless fs.existsSync('deploy')
      fs.mkdirSync('deploy')
    fs.writeFileSync(deployFileName, fileString)

    minFileString = uglify.minify(deployFileName).code
    fs.writeFileSync("deploy/#{name}-min.js", minFileString)
    console.log('done')
# !TODO: Need to run tests on the built version
  )
)

task('update-bower-version', 'Update bower.json with the version number specified in package.json', () ->
  bowerJSON = require('./bower.json')
  bowerJSON.version = require('./package.json').version
  fs.writeFileSync("./bower.json", JSON.stringify(bowerJSON, null, 2))
)

task('test', 'Run the test suite with nodeunit and record coverage.', () ->
  process.chdir(__dirname)
  require('coffee-coverage/register-istanbul')
  findRemoveSync('src', {extensions: ['.js', '.map']})
  {reporters} = require('nodeunit')
  reporters.default.run(['test'], undefined, (failure) ->
    if failure?
      console.error(failure)
      process.exit(1)
    else
      console.log('To see coverage report, run `istanbul report` and `open coverage/lcov-report/Lumenize/src/index.html`')
  )
)

task('testall', 'Run tests and doctests', () ->
  runSync('cake', ['test'])
  runSync('cake', ['doctest'])
  runSync('istanbul', ['report', 'text-summary', 'lcov'])
)

task('clean', 'Deletes .js and .map files', () ->
  folders = ['.', 'test', 'src']
  for folder in folders
    pathToClean = path.join(__dirname, folder)
    contents = fs.readdirSync(pathToClean)
    for file in contents when (_.endsWith(file, '.js') or _.endsWith(file, '.map'))
      fs.unlinkSync(path.join(pathToClean, file))
)
