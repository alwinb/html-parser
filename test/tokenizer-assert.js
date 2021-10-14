import * as html from '../lib/index.js'
const { TokenBuilder, Lexer, tokenTypes:T } = html
import Tests from './test-runner.js'
import * as util from 'util'
import * as fs from 'fs'
import * as assert from 'assert'
const { deepEqual } = assert.strict
const log = console.log.bind (console)

// Token Builder Tests
// ===================

// This implements an adapter for the raw tokens produced by the TokenBuilder
// to the format used in the html5lib-tests and implements a simple
// test runner. 

function tokenize (str) {
  const l = new Lexer ()
  const b = new TokenBuilder ()
  for (let x of l.write (str) .end () .read ()) b.write (x)
  const cst = Array.from (b.end () .read ())
  const result = Array.from (adapt (cst))
  return { cst, result }
}

// Token objects in the test files have the following format:
// ["DOCTYPE", name, public_id, system_id, correctness]
// ["StartTag", name, {attributes}*, true*]
// ["StartTag", name, {attributes}]
// ["EndTag", name]
// ["Comment", data]
// ["Character", data]

// Adapter
// -------

// The following, is a somewhat ad-hocadapter for evaluating the tokens
// beyond the CST tree that the tokenBuilder produces. 

function* adapt (tags) {
  let data = ''

  for (let tag of tags) switch (tag[0]) {
    case T.StartTag:
      if (data) yield ['Character', data]; data = ''
      yield ['StartTag', tag.name.toLowerCase(), evalAttributes (tag)]
      // TODO: interpret attrs
      break;
    
    case T.EndTag:
      if (data) yield ['Character', data]; data = ''
      yield ['EndTag', tag.name.toLowerCase ()]
      break;
    
    case T.Comment: case T.Bogus:
      if (data) yield ['Character', data]; data = ''
      yield ['Comment', tag.content.map (([_,x]) => x). join ('')]
      break;
    
    case T.FormatTag:
      if (data) yield ['Character', data]; data = ''
      yield ['StartTag', tag.name.toLowerCase(), evalAttributes (tag)]
      break;

    case T.FormatEndTag:
      if (data) yield ['Character', data]; data = ''
      yield ['EndTag', tag.name.toLowerCase()]
      break;
    
    case T.Space: case T.PlainText: case T.RawText: case T.RcData:
      data += tag[1]
      break;

    case T.HexRef:
      data += String.fromCodePoint (parseInt('0x' + tag[1].substr(3)))
      break;

    case T.NumRef:
      data += String.fromCodePoint (parseInt(tag[1].substr(2), 10))
      break;

    // TODO charRefs
    
    case T.Data: {
      data += tag[1]
    }
  }

  if (data) yield ['Character', data]
}

function evalAttributes (tag) {
  // log ({tag, content:tag.content})
  const r = { }
  let name = null, value = ''
  for (let token of tag.content) {
    // log (token)
    if (token[0] === T.AttName) {
      if (name != null && !(name in r)) r[name] = value; // First one wins
      [name, value] = [token[1], '']
    }
    else if (Array.isArray(token) && token[0] === T.Value || token[0] === T.Space) {
      value += token[1]
    }
    else if (token[0] === T.Value) {
      value = token.content.map(_ => _[1]).join ('')
    }
  }
  if (name != null && !(name in r)) r[name] = value;
  return r
}


// Test Runner
// -----------

const fpath = '../html5lib-tests/tokenizer/test1.test'
const testData = JSON.parse (fs.readFileSync (fpath))

const equals = (a, b) => {
  try { deepEqual (a, b); return true }
  catch (e) { return false }
}

function runTest (test) {
  return tokenize (test.input)
}

class TokenTests extends Tests {
  
  compactOutput (output) {
    return util.inspect (output.result)
  }
  
}

new TokenTests (testData.tests, runTest)
  .filter (_ => _.initialStates == null && !_.output.find(_ => _[0] === 'DOCTYPE'))
  .assert ('Must not throw', (testCase, output, error) => !error)
  .assert ('Must equal', (testCase, output, error) => equals (testCase.output, output.result))
  .run ()
