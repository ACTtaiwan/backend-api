## Prerequisites
- npm6
- nodejs10
- (optional) mongo-tools: if you want to dump/restore entire db
- (optional) mongodb: if you want to run a local db service

## Set Up
`npm install`

## Set Up Debug Mode
Create file `config/debug.json`. Example:

    {
        "debug": {
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
