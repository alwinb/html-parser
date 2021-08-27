const { assign, defineProperty:define } = Object
const log = console.log.bind (console)

module.exports = { 
  version: '0.10.0-dev-1',
  TreeBuilder: require ('./treebuilder'),
  Parser: require ('./parser'),
  Lexer: require ('./lexer'),
  TokenBuilder: require ('./tokens'),
  schema: require ('./schema'),
  parse: input => new html.Parser () .parse (input)
}

// log (module.exports)