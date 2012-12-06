execSync = require('exec-sync')

{stdout, stderr} = execSync('cake test', true)
if stderr.length > 0
  console.log('error')
