const { assign, defineProperty:define } = Object
const log = console.log.bind (console)

import * as categories  from './categories.js'
import * as schema      from './schema.js'
import * as treebuilder from './treebuilder.js'
import Parser           from './parser.js'
import TokenBuilder     from './tokens.js'
import Lexer            from './lexer.js'

const version =
  '0.9.5'

const parse = input =>
  new Parser () .parse (input)

export {
  version,
  categories, schema, treebuilder,
  Lexer, TokenBuilder, Parser, parse
}
