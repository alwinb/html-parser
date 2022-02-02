import { Tokeniser } from '../lib/tokeniser.js'
const log = console.log.bind (console)


// Set up a dummy delegate
// -----------------------

const log_ = (...args) => log (args)

const delegate = {
  write: log_,
  writeComment: log_,
  writeTag: log_,
  writeEndTag: log_,
  writeSpace: log_,
  writeData: log_,
  writeDoctype: log_,
  writeEOF: log_,
}

// Test
// ----

const tokeniser = new Tokeniser (delegate)
log (tokeniser.parse ('</ tttt>'))
log (tokeniser.write ('<table><input type=hidden type=still-hidden>foo'))
