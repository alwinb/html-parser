const html = require ('../lib/')
const { TokenBuilder, Lexer } = html
const log = console.log.bind (console)

function tokenize (str) {
  
  const l = new Lexer ()
  const t = new TokenBuilder ()
  
  l.write (str) .end ()
  for (let x of l.read ()) {
    t.write (x)
  }

  return t.readAll ()

}

var sample = '<!Doctype html><span att = a att2= "10 &amp 20">Foo bar <!-- bee baz buz --> <span>'
//var sample = '<h1>Test</h1><! foo bar bax ><li> and data'

log (...tokenize (sample))
