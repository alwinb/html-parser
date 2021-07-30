const { Director, START, END, LEAF } = require ('../lib/treebuilder.new')
const html = require ('../lib')
const util = require ('util')
const log = console.log.bind (console)


function Parser () {
  const l = new html.Lexer ()
  const t = new html.TokenBuilder ()
  const p = new Director ()

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
  // var d = new Director ()
  // d.batchWrite (sample)
  // var builder = d.builder
  var p = new Parser ()
  var doc = p.parse (sample1) 
  log (util.inspect (doc, {depth:Infinity}))
})


// Samples
// -------


var sample1 = '<div>foo'
var sample1 = '<table><caption><select>foo<table><select>bar'
// var sample1 = '<table><caption><select>foo<select>bar'
var sample1 = '<head></head>After head</head>Foo'
var sample1 = '<select><option>foo<option>'

// Result


const S = START, X = END, L = LEAF

var sample = [
  [S, 'title'],
  // [S, 'script'], // FIXME should not allow elements
  // [S, 'div'],
  // [E, 'br'],
  // [S, 'br'],
  // [S, 'image'],
  // [X, 'p'],
  // [X, 'p'],
  // [S, 'select'],
  // [S, 'select'],
  // [S, 'foo'],
  [S, 'table'],
  [S, 'bar'],
  [S, 'td'],
  [L, 'foo'],
  [S, 'td'],
  [X, 'td'],
  [L, 'bar'],
  [L, ' '],
  [L, 'bee'],
  [X, 'br'],
  [L, 'buzz'],
]

// good example!
//*
var sample = [
  [S, 'table'],
  [S, 'p'],
  [S, 'td'],
  [L, 'foo'],
  [X, 'td'],
  [X, 'p'],
  [S, 'td'],
  [S, 'table'],
  [L, 'bar'],
  [X, 'p'],
]

var sample_ = [
  [S, 'table'],
  [L, 'foo'],
  [S, 'table'],
  [L, 'bar'],
]

var sample = [
  [S, 'p'],
  [L, 'foo'],
  [S, 'table'],
  [L, 'foo'],
  [S, 'input'],
  [S, 'input', { type:'HiDDen' }],
  [S, 'tr', { class:'test' }],
  [S, 'input', { type:'hiDDen' }],
  [S, 'input', { type:'hiDDen' }],
  [L, 'test'], // FIXME doesn't get added to the target?
  [S, 'p'],
  [X, 'body'],
  [L, 'foo'],
]
//*/