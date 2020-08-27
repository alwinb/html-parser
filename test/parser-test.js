const assert = require ('assert') .strict
const { equal:equals, deepEqual:deepEquals } = assert
const util = require ('util')

const html = require ('../lib/')
const { Parser } = html
const log = console.log.bind (console)

// var p = new Parser ()
// log (p.info)
// p
//   //.startTag ('html')
//   .startTag ('head')
//   .startTag ('div')
//   .endTag ('html')

//log (util.inspect (p.document, { depth:200 }) )


var q = new Parser

const fs = require ('fs')
var sample = fs.readFileSync ('../test/test.html', 'utf8')
for (let t of html.tags (sample))
  q.write (t)
  //log (t)
  // process.stdout.write (String (t)) }

log (util.inspect (q.document, { depth:200 }) )
//log (...html.tags (sample))

/*// Test

var p = new Parser ()

p.stack = ['blockquote', 'p', 'div', 'li', 'ul']
p.stack = ['s', 'p', 'div', 'dt', 'ul', 'pp']
p.stack = ['p', 'h4', 'div', 'dt', 'ul', 'pp']
p.stack = [  'option', 'optgroup', 'dt', 'ul', 'pp']
p.stack = [ 'option', 'optgroup', 'select']

//log (p.beforeOpen ('dd'), p)
//log (p.beforeOpen ('h3'), p)
log (p.beforeOpen ('optgroup'), p)

//*/