# verify existence of necessary env vars
if ($null -eq $env:DB_URL)       { throw "Missing environment variable 'DB_URL'. It should contain a valid mongodb database url with proper auth." }
if ($null -eq $env:DB_NAME)      { throw "Missing environment variable 'DB_NAME'. It should contain a valid mongodb database name." }
if ($null -eq $env:PORT)         { throw "Missing environment variable 'PORT'. It should contain a valid port number to run the server on." }
if ($null -eq $env:JWT_SECRET)   { throw "Missing environment variable 'JWT_SECRET'. It should contain a valid secret string that'll act as JSONWebToken secret." }

$env:COMBINED = "TRUE"

# run the server
cd exco-backend
npm run start