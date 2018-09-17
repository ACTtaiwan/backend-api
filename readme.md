## Prerequisites
- npm6
- nodejs10
- (optional) mongo-tools: if you want to dump/restore entire db
- (optional) mongodb: if you want to run a local db service

## Set Up
`npm install`

## Maintenance
- Backup remote databases:

    `npm run ts-node scripts/dumpDb/dumpMongo.ts`

- Restore databases from archive:

    `npm run ts-node scripts/dumpDb/restoreMongo.ts <ARCHIVE_NAME>`
