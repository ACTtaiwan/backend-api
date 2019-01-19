import { MongoDbConfig } from '../../config/mongodb';
import { spawn } from 'child_process';
import { StringDecoder } from 'string_decoder';
import * as inquirer from 'inquirer';
import * as _ from 'lodash';

export async function getMongoToolFlags (archiveName: string)
: Promise<string[]> {
  let uriComponent = await MongoDbConfig.getUriComponents();
  let flags = [
    `--username=${uriComponent.username}`,
    `--password=${uriComponent.password}`,
    `--host=${uriComponent.host}`,
    `--port=${uriComponent.port}`,
    `--archive=${archiveName}`,
    '--gzip',
  ];
  if (uriComponent.host !== 'localhost' && uriComponent.host.toLowerCase().includes('azure')) {
    flags.push('--ssl');
    flags.push('--sslAllowInvalidCertificates');
  }
  return flags;
}

export async function runCommand (cmd, flags): Promise<void> {
  let confirm = await inquirer.prompt({
    name: 'proceed',
    type: 'confirm',
    message: `About to run command \`${cmd} ${_.join(flags, ' ')}\`. Proceed?`,
    default: true,
  });
  if (!confirm) {
    console.log('Abort');
    return;
  }

  let decoder = new StringDecoder();
  let childProcess = spawn(cmd, flags);

  let decodeAndLog = (data, prefix = '') => {
    let msg = data;
    if (msg instanceof Buffer) {
      msg = decoder.write(msg);
    }
    console.log(prefix, msg);
  };

  childProcess.stdout.on('data', data => {
    decodeAndLog(data);
  });

  childProcess.stderr.on('data', data => {
    decodeAndLog(data);
  });

  childProcess.on('close', code => {
    console.error(`child process exited with code ${code}`);
  });
}