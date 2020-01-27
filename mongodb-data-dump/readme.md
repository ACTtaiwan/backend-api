- restore command:
  - `mongorestore --gzip --archive=congress.20180701.gz --db congress`

- dump (backup) command:
  - `mongodump --archive=test.20180701.gz --gzip --db congress`

- dump remote:  
  - `mongodump --host digiOcean.uswatch.tw --db data --port 10255 --username uswatch --password PASS --authenticationDatabase admin --archive=data.20180701.gz --gzip`
