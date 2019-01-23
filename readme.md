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

## Date / Time policy
- All datetime should be stored as UTC epoch (long integer).
- For the date WITHOUT time, set `12:00am-0500` (DC time) as its time.
- For the date WITH time but timezone is unknown, set `-0500` (DC time) as its timezone.
- Note that `-0500` is UTC offset (Email timezone), where it could be EST or EDT.
- Recommend to use `Utility.parseDateTimeStringAtEST()` to parse datetime stamp in DC timezone.

## Test lambda endpoints
See files in `testLambda/`. Must be run under root directory.

Example: `testLambda/testV2Bills.sh testLambda/bills.json`

## Database connection
Database connection information, including host, port, username, and passwords,
should be stored in `secret.json`. Different set of connection information
(e.g., `mongodb`, `remoteMongodb`, etc.) may be used in different environment:
1. Deployed on AWS: defined by the environment variable `DB_CONFIG` in
    `serverless.yml`.
2. Lambda local testing: `mongodb` by default. Can be overridden by
    an environment variable such as:
    ```
    env npm_config_db_config=remoteMongodb testLambda/testV2Ids.sh testLambda/ids.json
    ```
3. Running script locally: `mongodb` by default. Can be overridden by
    an environment variable such as:
    ```
    env npm_config_db_config=remoteMongodb npm run ts-node scripts/run.ts
    ```
    Alternatively, define the following in `package.json`:
    ```
    {
        ...
        "config": {
            "db_config": "remoteMongodb"
        },
        ...
    }
    ```
