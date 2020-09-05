const assert = require ('assert') .strict
const { equal:equals, deepEqual:deepEquals } = assert
const util = require ('util')

const html = require ('../lib/')
const { TreeBuilder } = html
const log = console.log.bind (console)

const fs = require ('fs')

function run (sample) {
  if (sample.length < 100) {
    log (sample)
    log ('=====') }
  const p = new TreeBuilder
  for (let t of html.tags (sample)) p.write (t)
  log (util.inspect (p.document, { depth:200 }))
}

var sample = '<base>foo'
var sample = '<select><li>foo'
var sample = '<head><li>foo'
var sample = '</head> one two theee'
var sample = '<body> </head>'
var sample = '</body>'
var sample = '<b><li>test</b> nonbold'
var sample = '  </html> foo'
var sample = ' eh'
var sample = ' <a>'
var sample = '<select><optgroup><option>one<option>two<optgroup>three<table><td>foo'

//var sample = fs.readFileSync ('../test/test.html', 'utf8')

// var sample = '<script></script><foo>'
// var sample = '<td>foo'
// var sample = '<table><tr><td>1<td>2</table>'
// var sample = '<table>orphan<tr><td>1<td>2</table>'
// log ([...html.tags(sample)])

run (sample)