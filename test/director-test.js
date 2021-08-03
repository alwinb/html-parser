const { Director, START, END, LEAF } = require ('../lib/director')
const html = require ('../lib')
const util = require ('util')
const log = console.log.bind (console)


function Parser (options) {
  const l = new html.Lexer ()
  const t = new html.TokenBuilder ()
  const p = new Director (options)

  this.parse = function parse (str) {
    l.reset (); t.reset (); p.reset (); 
    for (let x of l.write (str) .end () .batchRead (32)) {
      t.batchWrite (x)
      p.batchWrite (t.readAll ())
    }
    p.end ()
    return p.document
  }
}

// Samples
// -------


var sample = '<div>foo'
var sample = '<table><caption><select>foo<table><select>bar'
// var sample = '<table><caption><select>foo<select>bar'
// var sample = '<!doctype html><p>Test<h1>Head1<table>foo<div></h2>Text'
var sample = '<head></head>After head</head>Foo'
var sample = '<html><head> <link> </head> <link>'
var sample = '<html><frameset>'
var sample = '</head> <p>'
var sample = '<math><annotation-xml encoding=TeXt/Html><p><p>'
var sample = '<svg><desc>test<div>'
var sample = '<font face>foo'
var sample = '<!doctype>foo'
var sample = '<table> g'
var sample = '</body><title>X</title>'
var sample = '<param><frameset>'
var sample = '<svg><foo/><bar>'
var sample = '<head></head><title>X</title>'
var sample =  '   <track><frameset></frameset>'
var sample = '<head></head> <source><frameset>'

// Test
// ====

const verbose = false
// var d = new Director ()
// d.batchWrite (sample)
// var builder = d.builder
var p = new Parser ({ verbose })
var doc = p.parse (sample) 
log (util.inspect (doc, {depth:Infinity}))
