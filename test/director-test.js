const { Director, START, END, LEAF } = require ('../lib/director')
const html = require ('../lib')
const util = require ('util')
const log = console.log.bind (console)


function Parser (options) {
  const p = new Director (options)

  this.parse = function parse (str) {
    p.reset ()
    p.write (str)
    p.end ()
    return p.document
  }
}

// Samples
// -------

var samples = [
  '<div>foo',
  '<table><caption><select>foo<table><select>bar',
  '<table><caption><select>foo<select>bar',
  '<!doctype html><p>Test<h1>Head1<table>foo<div></h2>Text',
  '<head></head>After head</head>Foo',
  '<html><head> <link> </head> <link>',
  '<html><frameset>',
  '</head> <p>',
  '<math><annotation-xml encoding=TeXt/Html><p><p>',
  '<svg><desc>test<div>',
  '<font face>foo',
  '<!doctype>foo',
  '<table> g',
  '</body><title>X</title>',
  '<param><frameset>',
  '<svg><foo/><bar>',
  '<head></head><title>X</title>',
  '<head></head><title>X&amp;y</title>',
  '<div><s><s><i><b><tt><s><s><s>foo</i><tt><tt><tt><tt></div>X',
  '<applet test foo=a><b>bar</applet>foo',
  'foo</body><!---->',
  '<html></html>',
  '<html><frameset></frameset></html>',
  '<!doctype html><title>',
  '<html><body><noframes>foo',
  '<!doctype html><input type="hidden"><frameset>',
  '<title><!-- foo --></title><svg><title><!-- bar --></title>',
  'foo</body><!--> bar<!--> bee',
  '<html><frameset></frameset></html> ',
  '<html><frameset></frameset></html>\n<!-->\n<!-->\n<!-->',
  '<html><frameset></frameset></html><noframes>foo</noframes>',
  'foo</html><!-->',
  '<html></head><script> bar </script>',
]

var sample =
  samples[samples.length-1]


// Test
// ====

const verbose = true
var p = new Parser ({ verbose })
var doc = p.parse (sample) 
log (util.inspect (doc, {depth:Infinity}))
