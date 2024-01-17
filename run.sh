# verify existence of necessary env vars
if [ -z "$DB_URL" ]; then
  echo "Missing environment variable 'DB_URL'. It should contain a valid mongodb database url with proper auth."
  exit 1
fi

if [ -z "$DB_NAME" ]; then
  echo "Missing environment variable 'DB_NAME'. It should contain a valid mongodb database name."
  exit 1
fi

if [ -z "$PORT" ]; then
  echo "Missing environment variable 'PORT'. It should contain a valid port number to run the server on."
  exit 1
fi

if [ -z "$JWT_SECRET" ]; then
  echo "Missing environment variable 'JWT_SECRET'. It should contain a valid secret string that'll act as JSONWebToken secret."
  exit 1
fi

COMBINED="TRUE"

# run the server
cd exco-backend
npm run start
