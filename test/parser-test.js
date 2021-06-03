const assert = require ('assert') .strict
const { equal:equals, deepEqual:deepEquals } = assert
const util = require ('util')

const html = require ('../lib/')
const { Leaf, Document, Node, TreeBuilder, Parser } = html
const log = console.log.bind (console)

const fs = require ('fs')


// Serialise Test Result
// ---------------------

function print (node) {
  return [... _print (node)] .join ('')
}

function* _print (node, depth=0) {
  let indent = ''
  for (let i=0; i<depth; i++) indent += '  '
  if (typeof node === 'string')
    yield `| ${indent}"${node}"\n`

  else if (node instanceof Node) {
    yield `| ${indent}<${node.name}>\n`
    // TODO also print attrs, and coalesce text nodes
    for (let child of node.children) yield* _print (child, depth+1)
  }

  else if (node instanceof Leaf) {
    yield `| ${indent}<${node.name}>\n`
    // TODO also print attrs, and add quotes around text
  }

  else if (node instanceof Document)
    for (let child of node.children) yield* _print (child, depth)
}


// Parse Test Case
// ---------------

function parseTests (input) {
  const tests = []
  // TODO
}


// Test runner
// -----------

function run (sample) {
  if (sample.length < 100) {
    log ('#data')
    log (sample)
    log ('#console')
  }
  const doc = new Parser ()
    .parse (sample)
  //log (doc)
  // const p = new TreeBuilder
  // for (let t of html.tags (sample)) p.write (t)
  // log (util.inspect (doc, { depth:200 }))
  log ('#document')
  log (print (doc))
}


// Samples
// -------

var samples = [
  '<select><li>foo',
  '<head><li>foo',
  '</head> one two theee',
  '<body> </head>',
  '</body>',
  '<b><li>test</b> nonbold',
  '  </html> foo',
  ' eh',
  ' <a>',
  '<base>foo',
  '<table><td>foo<col>',
  '<table><td>foo<tfoot>',
  '<table><td>foo<tr>',
  '<table><caption>foo<td>',
  '<table><colgroup><td>foo<tr><br>',
  '<table><td>foo<td><col>',
  '<select>Foo<option>boo<select>Bar',
  '<main><table>text<td>foo<tr>',
  '<main><table><div>text<td>foo<tr>',
  '<main><table><ul><li>a<li>text<p>foo<td>foo<tr></table>γαμμα',
  '<button><table>aa<button>one<td>two<tr>three',
  '<main><table><caption><ul><li>a<li>text<table><p>foo<td>foo<tr></table>γαμμα',
  '<br>',
]

// var sample = '<html><head></head><body><h1>Foo</h1><p>Lorem<p>Ipsum'
// var sample = '<script src=foo>'
// var sample = '<h1> One Two </h1> bar'
// var sample = '<select><optgroup><option>one<option>two<optgroup>three<table><td>foo'
// var sample = '<h1><!-- comment -->some data</h6> <p>Hello <strong>World!</strong>'
// var sample = fs.readFileSync ('../test/test.html', 'utf8')
// var sample = '<script></script><foo>'
// var sample = '<td>foo'
// var sample = '<table><tr><td>1<td>2</table>'
// var sample = '<table>orphan<tr><td>1<td>2</table>'
// log ([...html.tags(sample)])

for (const sample of samples)
  run (sample)

