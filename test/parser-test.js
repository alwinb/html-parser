import { fragmentRule } from '../lib/schema.js'
import { parse } from '../lib/index.js'
import { traverse, printTree } from '../lib/traversal.js'
import * as util from 'util'
const log = console.log.bind (console)


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
  'foo</html><!-->',
  '<div><table>',
  '<table><td><svg><desc><td>',
  '<table><td>bar<col>',
  // '<html><head></head><body><svg><desc><tr>bee',
  '<head></head><title>X</title>',
  '<head>asdasd<frameset>',
  '<head> </head> <listing> <source> <frameset>',
]


var samples = [
  '<html><frameset></frameset></html> ',
  '<html><frameset></frameset></html>\n<!-->\n<!-->\n<!-->',
  '<html><frameset></frameset></html><noframes>foo</noframes>',
  '<frame></frame></frame><frameset>',//'<frame><frameset><frame></frameset><noframes></frameset><noframes>',
  '<head> </head> <pre> <source> <frameset>',
  '<!DOCTYPE html><frameset><svg><g></g><g></g><p><span>',
  '<i><b><i>1<p><s><u>2<p>bar</b>3',
  'Hello <!-- foo --> Bar',
]

// Test
// ====

const options = { verbose: true }

for (const sample of samples) {
  log ('\n', sample, '\n'+sample.replace (/[^\n]/g, '='))
  var doc = parse (sample, options) 

  log (util.inspect (doc, {depth:Infinity}))
  log ('---')
  for (const tok of traverse (doc)) log (tok)
  log ('---')
  log (printTree (doc))
}

