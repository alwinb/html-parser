import * as dom from './dom.js'
import * as categories from './categories.js'
import * as schema from './schema.js'
import { DFA, Tokeniser } from './tokeniser.js'
import { Parser } from './parser.js'
import { TreeBuilderClass } from './treebuilder.js'
import { printTree } from './traversal.js'
const log = console.log.bind (console)

const version =
  '0.13.0-a'

function parse (input, options = { }) {
  const parser = new Parser (options)
  const lexer = new Tokeniser (parser)
  lexer.parse (input)
  lexer.end ()
  return parser.document
}

export {
  version,
  dom, categories, schema,
  DFA, Tokeniser, Parser,
  TreeBuilderClass,
  parse
}