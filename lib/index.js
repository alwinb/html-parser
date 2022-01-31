const { assign, defineProperty:define } = Object
const log = console.log.bind (console)

import * as categories from './categories.js'
import * as schema     from './schema.js'
import * as dom        from './dom.js'
import { Lexer } from './lexer.js'
import { Preprocessor, Parser } from './parser.js'
import { TreeBuilderClass } from './treebuilder.js'

const version =
  '0.11.0'

function parse (input, options = { }) {
  const parser = new Parser (options)
  const pp = new Preprocessor (parser)
  const lexer = new Lexer (pp)
  lexer.parse (input)
  lexer.end ()
  return parser.document
}

export {
  version,
  dom, categories, schema,
  Lexer, Preprocessor, Parser,
  TreeBuilderClass,
  parse
}