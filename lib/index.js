const { assign, defineProperty:define } = Object
const log = console.log.bind (console)

import * as dom from './dom.js'
import * as categories from './categories.js'
import * as schema from './schema.js'
import { DFA, Tokeniser } from './tokeniser.js'
import { Preprocessor, Parser } from './parser.js'
import { TreeBuilderClass } from './treebuilder.js'
import { printTree } from './traversal.js'

const version =
  '0.12.1'

function parse (input, options = { }) {
  const parser = new Parser (options)
  const pp = new Preprocessor (parser)
  const lexer = new Tokeniser (pp)
  lexer.parse (input)
  lexer.end ()
  return parser.document
}

export {
  version,
  dom, categories, schema,
  DFA, Tokeniser, Preprocessor, Parser,
  TreeBuilderClass,
  parse
}