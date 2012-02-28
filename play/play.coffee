# {ChartTimeRange, ChartTime, ChartTimeIterator} = require('../src/ChartTime')
# utils = require('../src/utils')

https = require('https')
querystring = require('querystring')
fs = require('fs')

query =
  query: '(Project.Name = "Shopping Team")'
  start: 1
  pagesize: 200
  fetch: "Name,ReleaseDate,ReleaseStartDate"
  
endpoint = 'release.js'
version = '1.29'

options =
  host: 'demo.rallydev.com'
  auth: 'pat@acme.com:AcmeUser'
  path: '/slm/webservice/' + version + '/' + endpoint + '?' + querystring.stringify(query)
  headers: 
    'X-RallyIntegrationName'     : 'Rally REST Toolkit for CoffeeScript'
    'X-RallyIntegrationVendor'   : 'Rally Software Development'
    'X-RallyIntegrationVersion'  : '0.1.0'
    'X-RallyIntegrationLibrary'  : 'rally-coffee-0.1.0'
    'X-RallyIntegrationPlatform' : "Node.js version: #{process.version}"  # !TODO: Sense if in browser
    'X-RallyIntegrationOS'       : process.platform
    'User-Agent'                 : 'CoffeeScript Rally WebServices Agent'

https.get(options, (res) ->
  console.log("statusCode: ", res.statusCode)
  console.log("headers: ", res.headers)

  res.on('data', (d) ->
#     doit = fs.writeFileSync
    doit = console.log
    doit('play/AcmeReleases.json', JSON.stringify(JSON.parse(d), null, 2))
  )
).on('error', -> 
  console.error(e)
)