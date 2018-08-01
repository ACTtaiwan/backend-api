export let logger = require('tracer').console({
  format: '{{title}} {{file}}:{{line}} {{message}}',
});