import { htmlns, Document as Document_, Element, Doctype, Comment, EndTag } from './dom.js'
const log = console.log.bind (console)


// Tree Traversal
// --------------

const DOCTYPE = Symbol ('DOCTYPE')
const START   = Symbol ('START')
const END     = Symbol ('END')
const DATA    = Symbol ('DATA')
const MDECL   = Symbol ('MDECL')
const COMMENT = Symbol ('COMMENT')

// ### Traverse Browser DOM

const w = globalThis.window ?? {}

function* traverseDOM (node) {

  if (node instanceof w.DocumentType)
    yield [DOCTYPE, node.name] // TODO support publicId / systemId

  else if (node instanceof w.Comment)
    yield [COMMENT, node]

  else if (node instanceof w.Document)
    for (let child of node.childNodes)
      yield* traverseDOM (child)

  else if (node instanceof w.HTMLTemplateElement) {
    const tagName = 'template'
    yield [START, tagName, _domAttrList (node.attributes)]
    for (let child of node.content.childNodes)
      yield* traverseDOM (child)
    yield [END, tagName]
  }

  else if (node instanceof w.Element) {
    let tagName = node.tagName
    if (node.namespaceURI && node.namespaceURI === htmlns)
      tagName = tagName.toLowerCase ()
    yield [START, tagName, _domAttrList (node.attributes)]
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

  // 'special' element, still used to group e.g. foster-
  // parented table contents; may be removed. 
  else if (node instanceof Element && node.name[0] === '#')
    for (let child of node.children)
      yield* traverse (child)

  else if (node instanceof Element) {
    yield [START, node.name, _attrList (node.attrs || null)]
    for (let child of node.children)
      yield* traverse (child)
    yield [END, node.name]
  }

  else if (node instanceof Doctype) {
    yield [DOCTYPE, node] // TODO also yield data
  }

  else if (node instanceof Comment) {
    yield [COMMENT, node] // TODO also yield data
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

/// ### Convert attributes to array of {name value} pairs

function _domAttrList (attrs) {
  const list = []
  if (attrs && (attrs instanceof w.NamedNodeMap))
    for (const {name, value} of attrs) list.push ({name, value})
  list.sort (byKey)
  return list
}

function _attrList (attrs) {
  const list = []
  if (attrs && typeof attrs === 'object')
    for (const name in attrs) list.push ({name, value:attrs[name]})
  list.sort (byKey)
  return list
}

const byKey = ({name:n1}, {name:n2}) =>
  n1 < n2 ? -1 : n1 > n2 ? 1 : 0

// Compare
// -------

// Compare html-parser DOM against browser DOM
// Oeph; ok this is just annoying. Can I do this neatly, or what?
// WIP


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

    // TODO also include attribute checks and comment/doctype
    // data comparisons. However, all this is silly and inelegant
    // so maybe I'd rather just redo the stupid thing.

    else if (token[0] === END)
      depth--

    else if (token[0] === DATA)
      yield `| ${indent}"${token[1]}"\n`

    // TODO check with the html5lib tests

    else if (token[0] === MDECL)
      yield `| ${indent}<!-->\n`

    else if (token[0] === COMMENT)
      yield `| ${indent}<!-->\n`

    else if (token[0] === DOCTYPE)
      yield `| ${indent}<!doctype>\n`
  }
}


function printAttributes (list) {
  for (const {name, value} of list)
    txt += name 
}


// Exports
// -------

export { traverse, traverseDOM, printTree }