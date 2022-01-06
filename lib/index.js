const { assign, defineProperty:define } = Object
const log = console.log.bind (console)

import * as categories  from './categories.js'
import * as schema      from './schema.js'
import * as treebuilder from './treebuilder.js'
import { Node, MDecl, Lexer }  from './lexer.new.js'
import { Preprocessor, Parser } from './parser.new.js'

const version =
  '0.9.5'

function parse (input, options = { }) {
  const parser = new Parser (options)
  const pp = new Preprocessor (parser)
  const lexer = new Lexer (pp)
  lexer.parse (input) // this delegates to the parser
  parser.end ()
  return parser.document
}

export {
  version,
  Node, MDecl,
  categories, schema, treebuilder,
  Lexer, Preprocessor, Parser,
  parse
}
