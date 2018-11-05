import { runCommand, getMongoToolFlags } from './utils';

async function main () {
  let argv = process.argv;
  if (argv.length <= 2) {
    console.log(`Usage: restoreMongo.ts <gz_archive_file>`);
    return;
  }
  let archiveName = argv[2];
  await runCommand(
    'mongorestore',
    await getMongoToolFlags(archiveName),
  );
}

main();