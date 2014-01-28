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

task('doctest', 'Test examples in documenation.', () ->
  process.chdir(__dirname)
  runSync('coffeedoctest', ['--readme', 'src', 'lumenize.coffee'])
)

task('docs', 'Generate docs with CoffeeDoc and place in ./docs', () ->
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
  runSync('jsduckify', ['-d', outputDirectory, __dirname])
)

task('pub-docs', 'Push master to gh-pages on github', () ->
  invoke('docs')
  invoke('pubDocsRaw')
)

task('pubDocsRaw', 'Publish docs to Google Cloud Storage', () ->
  process.chdir(__dirname)
#  runAsync('git push -f origin master:gh-pages')
  console.log('pushing docs to Google Cloud Storage')
  runSync('gsutil cp -R docs gs://versions.lumenize.com')
)

task('publish', 'Publish to npm', () ->
  process.chdir(__dirname)
  runSync('cake test')  # Doing this exernally to make it synchrous
  invoke('docs')
  process.chdir(__dirname)
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
          console.log('running git tag')
          runSync("git tag v#{require('./package.json').version}")
          runSync("git push --tags")
          console.log('pushing to Google Cloud Storage')
          # !TODO: Fix this Cakefile so the next line doesn't crash. In the mean time, you can edit the version number and run the following three lines manually from the command line.
          # gsutil cp ./deploy/* gs://versions.lumenize.com/v0.7.2/
          # gsutil setmeta -h "Content-Type: application/javascript" -h "Cache-Control: public, max-age=31556926, no-transform" gs://versions.lumenize.com/v0.7.2/*
          # cake pubDocsRaw
          runSync("gsutil cp ./deploy/* gs://versions.lumenize.com/v#{require('./package.json').version}/")
          runSync('gsutil setmeta -h "Content-Type: application/javascript" -h "Cache-Control: public, max-age=31556926, no-transform" gs://versions.lumenize.com/v' + require('./package.json').version + '/*')
          invoke('pubDocsRaw')
      else
        console.error('Origin and master out of sync. Not publishing.')
    else
      console.error('`git status --porcelain` was not clean. Not publishing.')
  )
)

task('build', 'Build with browserify and place in ./deploy', () ->
  console.log('building...')
  b = browserify()
  b.use(fileify('files', __dirname + '/node_modules/tztime/files'))
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
  unless fs.existsSync('deploy')
    fs.mkdirSync('deploy')
  fs.writeFileSync(deployFileName, fileString)

  minFileString = uglify.minify(deployFileName).code
  fs.writeFileSync("deploy/#{name}-min.js", minFileString)
  console.log('done')
  # !TODO: Need to run tests on the built version
)

task('build-and-docs', 'Build and docs combined for LiveReload.', () ->
  invoke('build')
  invoke('docs')
)

task('test', 'Run the CoffeeScript test suite with nodeunit', () ->
  {reporters} = require('nodeunit')
  process.chdir(__dirname)
  reporters.default.run(['test'], undefined, (failure) ->
    if failure?
      console.error(failure)
      process.exit(1)
  )
)

task('testall', 'Run tests and doctests', () ->
  runSync('cake doctest')
  invoke('test')
)
