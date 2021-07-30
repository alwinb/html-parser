const { Parser, START, END, LEAF } = require ('../lib/treebuilder.new')
const log = console.log.bind (console)
const util = require ('util')


// Test
// ====
//*

setTimeout (() => {
  var d = new Parser ()
  d.batchWrite (sample)
  var builder = d.builder
  log (util.inspect (builder.document, {depth:Infinity}))
})


// Samples
// -------

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

// More good ones:
// <table><caption><select>foo<table><select>bar 
// vs
// <table><caption><select>foo<select>bar

// Result
