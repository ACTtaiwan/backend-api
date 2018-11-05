import * as moment from 'moment';
import { getMongoToolFlags, runCommand } from './utils';

async function main () {
  await runCommand(
    'mongodump',
    await getMongoToolFlags(`mongodump_${moment().format('YYYY-MM-DD')}.gz`),
  );
}

main();