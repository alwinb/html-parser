
// Imports
const { html, domex: { domex, DomEx, Domex } } = modules
const log = console.log.bind (console)
const T = modules.html.Lexer.tokenTypes

// DOM tools
const htmlns = 'http://www.w3.org/1999/xhtml'
const byId = document.getElementById.bind (document)
const $ = name => document.createElement (name)
const setProps = (el, props) => {
  for (let k in props) el.setAttribute (k, props[k])
}

// native HTML parser
function nativeParse (input) {
  return new DOMParser () .parseFromString (input, 'text/html')
}


// Test UI
// -------

const objectKey = Symbol ()

class TestUI {

  static get domex () {

    return domex `
      li@tab.-button [data-key=$]
        > "Sample " + $;

      ul@tabs
        > @tab*;

      ul@suites
        > li.-button [data-suite=$]* %title;

      main@main
        > h1 "HTML Parser"
        + p "This is a test page for the HTML parser, version " %version
        + @suites#suites ~suites
        + @tabs#tabs ~samples
        + textarea#input + button#submit "Run"
        + div#view1 "Browser"
        + div#view2 "Html Parser";
  
      @main
    `
  }

  // Init

  constructor () {
    const suites = window ['html-suites']
    const samples = suites[0].samples

    this.elem = TestUI.domex.render ({ suites, samples, version:html.version }) .elem
    document.body.append (this.elem)

    const [input, tabs, view1, view2] = 
      ['input', 'tabs', 'view1', 'view2'] .map (byId)
    this.dom = { tabs, input, view1, view2 }

    this.suite = {}
    this.sampleIndex = 0
  }
  
  showSuite (index) {
    this.suite = window ['html-suites'] [index]
    log ('suite', this.suite.title)
    const el = domex `
      li@tab.-button [data-key=$] > "Sample " + $;
      ul#tabs > @tab*`
      .render (this.suite.samples) .elem
    this.dom.tabs.replaceWith (el)
    this.dom.tabs = el
    this.showSample (0)
    return this
  }
  
  showSampleValue (sample) {
    window.console.clear ()
    this.dom.input.value = sample
    this.dom.view1.innerHTML = view2.innerHTML = ''
  
    const nativeResult = nativeParse (sample)
    const result = html.parse (sample)

    this.dom.view1.append ('native', showTree (nativeResult))
    this.dom.view2.append ('parser', showTree (result))
  
    const p1 = printTree (nativeResult)
    const p2 = printTree (result)
    if (p1 !== p2) {
      console.error ('test failed', sample)
      console.log (p1, p2)
    }
    return this
  }

  showSample (index) {
    return this.showSampleValue (this.suite.samples [index])
    
  }
  
  focus () {
    this.dom.input.focus ()
    return this
  }

}


// Tree View / Browser
// -------------------

// MDN: Every kind of DOM node is represented by an interface based on Node. 
// These include Attr, CharacterData (which Text, Comment, and CDATASection are all based on),
// ProcessingInstruction, DocumentType, Notation, Entity, and EntityReference.

// domNode may either be a browser DOM node or a light-weight html-parser 'DOM' node. 

function showTree (domNode) {
  let elem, label, clss

  if (domNode instanceof Text) {
    clss = (/^\s*$/.test (domNode.data)) ? 'space' : 'text'
    elem = $('span')
    elem.append (domNode.data)
    elem.className = clss
    elem[objectKey] = domNode
    return elem
  }
  if (typeof domNode === 'string' || domNode instanceof String) {
    clss = (/^\s*$/.test (domNode)) ? 'space' : 'text'
    elem = $('span')
    elem.append (domNode)
    elem.className = clss
    elem[objectKey] = domNode
    return elem
  }

  elem = $('div')
  if (domNode instanceof Document || domNode instanceof html.TreeBuilder.Document)
    label = '#document'

  else if (domNode instanceof Comment || domNode[0] === T.Comment)
    label = '<!-->'

  else if (domNode instanceof Element || domNode instanceof html.TreeBuilder.Node || domNode instanceof html.TreeBuilder.Leaf) {
    label = (domNode.tagName||domNode.name)
    if (domNode.namespaceURI && domNode.namespaceURI !== htmlns)
      label = domNode.namespaceURI.split('/').pop () + ':' + label
    else label = label.toLowerCase ()
  }

  // log (domNode.__proto__)
  elem.append (label)
  elem[objectKey] = domNode.frame ? html.TreeBuilder.frameInfo (domNode.frame) : domNode
  
  if (clss) elem.classList.add(clss)
  let ul; elem.append ((ul = $('div')))
  ul.className = 'children'

  const children = domNode instanceof HTMLTemplateElement ?
    domNode.content.childNodes : domNode.childNodes || domNode.children || []
  for (let x of children) {
    ul.append (showTree (x))
  }
  return elem
}


// Tree Serialisation
// ------------------

function printTree (node) {
  const toks = _coalesce (_traverse (node))
  return [..._print (toks)] .join ('')
}

function* _coalesce (stream) {
  let last
  for (const x of stream) {
    
    if (typeof x === 'string' || x instanceof String) {
      if (last != null) last += x
      else last = x
    }
    else {
      if (last) { yield last; last = null }
      yield x
    }
  }
  if (last) yield last
}


function* _traverse (node) {
  const T = modules.html.Lexer.tokenTypes

  if (typeof node === 'string' || node instanceof String)
    yield node

  else if (node instanceof Text)
    yield node.data

  else if (node instanceof html.TreeBuilder.Node) {
    yield [T.StartTag, node.name] // TODO also yield attrs
    for (let child of node.children) yield* _traverse (child)
    yield [T.EndTag, node.name]
  }

  else if (node instanceof HTMLTemplateElement) {
    const tagName = 'template'
    yield [T.StartTag, tagName] // TODO also yield attrs
    for (let child of node.content.childNodes) yield* _traverse (child)
    yield [T.EndTag, tagName]
  }

  else if (node instanceof Element) {
    let tagName = node.tagName
    if (node.namespaceURI && node.namespaceURI === htmlns)
      tagName = tagName.toLowerCase ()
    yield [T.StartTag, tagName] // TODO also yield attrs
    for (let child of node.childNodes) yield* _traverse (child)
    yield [T.EndTag, tagName]
  }

  else if (node instanceof html.TreeBuilder.Leaf) {
    yield [T.StartTag, node.name] // TODO also print attrs
    yield [T.EndTag, node.name]
  }

  else if (node instanceof html.TreeBuilder.Document)
    for (let child of node.children) yield* _traverse (child)

  else if (node instanceof Document)
    for (let child of node.childNodes) yield* _traverse (child)
}


function* _print (stream, depth = 0) {
  for (const token of stream) {
    let indent = ''
    for (let i=0; i<depth; i++) indent += '  '

    if (typeof token === 'string' || token instanceof String)
      yield `| ${indent}"${token}"\n`

    else if (token[0] === T.StartTag) {
      yield `| ${indent}<${token[1]}>\n`
      depth++
    }

    else if (token[0] === T.EndTag) {
      depth--
    }
  }
}
