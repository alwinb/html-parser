import { htmlns, Document as Document_, Node, MDecl, EndTag } from './dom.js'
import { Lexer } from './lexer.js'
const log = console.log.bind (console)


// Tree Traversal
// --------------

const DOCTYPE = Symbol ('DOCTYPE')
const START   = Symbol ('START')
const END     = Symbol ('END')
const DATA    = Symbol ('DATA')
const MDECL   = Symbol ('MDECL')

// ### Traverse Browser DOM

const w = globalThis.window ?? {}

function* traverseDOM (node) {

  if (node instanceof w.DocumentType)
    yield [DOCTYPE, node.name] // TODO support publicId / systemId

  else if (node instanceof w.Comment)
    yield [MDECL, node]

  else if (node instanceof w.Document)
    for (let child of node.childNodes)
      yield* traverseDOM (child)

  else if (node instanceof w.HTMLTemplateElement) {
    const tagName = 'template'
    yield [START, tagName] // TODO also yield attrs
    for (let child of node.content.childNodes)
      yield* traverseDOM (child)
    yield [END, tagName]
  }

  else if (node instanceof w.Element) {
    let tagName = node.tagName
    if (node.namespaceURI && node.namespaceURI === htmlns)
      tagName = tagName.toLowerCase ()
    yield [START, tagName] // TODO also yield attrs
    for (let child of node.childNodes)
      yield* traverseDOM (child)
    yield [END, tagName]
  }

  else if (node instanceof w.Text) {
    yield [DATA, node.data]
  }

  else log ('traverseDOM: Unknown node type', node)
}


// ### Traverse html-parser DOM

let decode = new TextDecoder ()
decode = decode.decode.bind (decode)

function* traverse (node) {

  if (typeof node === 'string')
    yield [DATA, node]

  else if (node instanceof Uint8Array)
    yield [DATA, decode (node)]

  else if (node instanceof Document_)
    for (let child of node.children)
      yield* traverse (child)

  else if (node instanceof Node && node.name[0] === '#')
    for (let child of node.children)
      yield* traverse (child)

  else if (node instanceof Node) {
    yield [START, node.name] // TODO also yield attrs
    for (let child of node.children)
      yield* traverse (child)
    yield [END, node.name]
  }

  else if (node instanceof MDecl && node.name.toLowerCase () === 'doctype') {
    yield [DOCTYPE, node] // TODO also yield doctype name, ...
  }

  else if (node instanceof MDecl) {
    yield [MDECL, node] // TODO also yield data
  }

  else log ('traverse: unknown node type', node)
}





// ### normalise html-parser DOM
// (coalesce adjacent text-nodes)

function* _coalesce (stream) {
  let last
  for (const x of stream) {
    if (x[0] === DATA)
      last = last != null ? last + x[1] : x[1]
    else {
      if (last) { yield [DATA, last]; last = null }
      yield x
    }
  }
  if (last) yield [DATA, last]
}


// Printing
// --------

// printTree - as in the html5lib tests

function printTree (node) {
  const stream = w.Node && node instanceof w.Node
    ? traverseDOM (node)
    : _coalesce (traverse (node))
  return [..._print (stream)] .join ('')
}

function* _print (stream, depth = 0) {
  for (const token of stream) {
    let indent = ''
    for (let i=0; i<depth; i++) indent += '  '

    if (token[0] === START) {
      yield `| ${indent}<${token[1]}>\n`
      depth++
    }

    else if (token[0] === END)
      depth--

    else if (token[0] === DATA)
      yield `| ${indent}"${token[1]}"\n`

    // TODO check with the html5lib tests

    else if (token[0] === MDECL)
      yield `| ${indent}<!-->\n`

    else if (token[0] === DOCTYPE)
      yield `| ${indent}<!doctype>\n`
  }
}


// Exports
// -------

export { traverse, traverseDOM, printTree }