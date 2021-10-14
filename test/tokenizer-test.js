import { Lexer, TokenBuilder } from '../lib/index.js'
import * as util from 'util'
const log = console.log.bind (console)

function tokenize (str) {
  const l = new Lexer ()
  const b = new TokenBuilder ()
  for (let x of l.write (str) .end () .read ()) {
    b.write (x)
  }
  return b.end () .readAll ()
}

var sample = '<!Doctype html><h1>header</h1><span att= a att2= "10 &amp 20">Foo </b>bar <!-- bee baz buz --> </span>'
//var sample = '<h1>Test</h1><! foo bar bax ><li> and data'
var sample = `<!DOCTYPE html x>text`
var sample = `<!->`
var sample = `<h a='&COPY'b/d=c>`
var sample = `foo bar`
var sample = `<s o=& t>`
var sample = `</s o=& t>`
var sample = `<fo><br>bar</br><i foo=1>Italic</i>`
var sample = '<!doctype html>'

log (util.inspect(tokenize (sample), { depth:100 }))
