## Prerequisites
- npm6
- nodejs10
- (optional) mongo-tools: if you want to dump/restore entire db
- (optional) mongodb: if you want to run a local db service

## Set Up
`npm install`

## Set Up Secret Values
For credentials and other secret values you don't want to commit to
the source repository, create a file `config/secret.json`. Example:

    {
        "secret": {
            "mongodb": {
                "host": "localhost",
                "port": 27017,
                "username": "",
                "password": ""
            },
            "remoteMongodb": {
                "host": "<host>",
                "port": <port>,
                "username": "<username>",
                "password": "<password>"
            },
            "airtable": {
                "apiKey": "<key>"
            }
        }
    }

(`.gitignore` is set up to not commit this file.)

## Maintenance
- Backup remote databases:

    `npm run ts-node scripts/dumpDb/dumpMongo.ts`

- Restore databases from archive:

    `npm run ts-node scripts/dumpDb/restoreMongo.ts <ARCHIVE_NAME>`

## Test lambda endpoints
See files in `testLambda/`. Must be run under root directory.

Example: `testLambda/testV2Bills.sh testLambda/bills.json`

## Database connection
Database connection information, including passwords, should be stored in
`secret.json`. When the code is run locally, db connections are made
according to values under `mongodb`, unless environment variable
`LOCAL_DB_CONFIG` is set to something else. Similarly, when the code is run
remotely (e.g., deployed on AWS), values under `mongodb` are used unless
environement variable `DB_CONFIG` is set (see also `serverless.yml`).