const assert = require ('assert') .strict
const { equal:equals, deepEqual:deepEquals } = assert
const util = require ('util')

const html = require ('../lib/')
const { TreeBuilder, Parser } = html
const log = console.log.bind (console)

const fs = require ('fs')

function run (sample) {
  if (sample.length < 100) {
    log (sample)
    log ('=====') }
  const doc = new Parser ()
    .parse (sample)
  //log (doc)
  // const p = new TreeBuilder
  // for (let t of html.tags (sample)) p.write (t)
  log (util.inspect (doc, { depth:200 }))
}

var sample = '<select><li>foo'
var sample = '<head><li>foo'
var sample = '</head> one two theee'
var sample = '<body> </head>'
var sample = '</body>'
var sample = '<b><li>test</b> nonbold'
var sample = '  </html> foo'
var sample = ' eh'
var sample = ' <a>'
var sample = '<base>foo'
var sample = '<table><td>foo<col>'
var sample = '<table><td>foo<tfoot>'
var sample = '<table><td>foo<tr>'
var sample = '<table><caption>foo<td>'
var sample = '<table><colgroup><td>foo<tr><br>' // FIXME
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

run (sample)