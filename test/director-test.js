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

// Test
// ====
//*

setTimeout (() => {
  const verbose = true
  // var d = new Director ()
  // d.batchWrite (sample)
  // var builder = d.builder
  var p = new Parser ({ verbose })
  var doc = p.parse (sample1) 
  log (util.inspect (doc, {depth:Infinity}))
})


// Samples
// -------


var sample1 = '<div>foo'
var sample1 = '<table><caption><select>foo<table><select>bar'
// var sample1 = '<table><caption><select>foo<select>bar'
 // var sample1 = '<!doctype html><p>Test<h1>Head1<table>foo<div></h2>Text'
var sample1 = '<head></head>After head</head>Foo'
var sample1 = '<html><head> <link> </head> <link>'
var sample1 = '<html><frameset>'
var sample1 = '</head> <p>'
var sample1 = '<math><annotation-xml encoding=TeXt/Html><p><p>'
var sample1 = '<svg><desc>test<div>'
var sample1 = '<font face>foo'
var sample1 = '<!doctype>foo'
var sample1 = '<table> g'
var sample1 = '</body><title>X</title>'
var sample1 = '<param><frameset>'
var sample1 = '<svg><foo/><bar>'


/* Compute the frameset OK flags **/