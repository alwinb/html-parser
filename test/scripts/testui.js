
// Imports
import * as html from '../../lib/index.js'
import { domex, Domex } from '../../dist/domex.min.js'
const log = console.log.bind (console)
const T = html.Lexer.tokenTypes

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

      ul.scrolly @samples
        > @tab.nowrap.link*;

      li @tab [data-key=$]
        > "Sample " + $;

      ul.scrolly @suites
        > li.link.nowrap [data-suite=$]* %title;

      div.Input @input
        > textarea #input.m0
        + button #submit "Run";
        
      div.Output @output
        > (div.p1 #view2 > h3 "html-parser" + div)
        + (div.p1 #view1 > h3 "browser"     + div)
        + (div.p1 #view3 .Inspector [style="display:none"] > h3 "inspector"   + div);

      span @results #results
        > (a [href="javascript:void(runAllTests())"] "Run all tests")
        + ".";

      main@main
        > h1 "HTML Parser"
        + (p > "Version " + %version + ". " + @results)
        + div.hstack.nowrap
          > @suites.vstack.xx18 #suites ~suites
          + @samples.vstack.xx18 #tabs ~samples
          + (div > @input.layers + @output.scrolly.hstack.nowrap);
  
      @main
    `
  }
  
  static get inspectorDx () {
    return domex `
      div > (hgroup.br:name
        > h4 "<" %name ">"
        + i %kind)
      + @default.vstack.vsep.hlines
    `
  }

  // Init

  constructor (suites) {
    this.elem = $('div')
    document.body.append (this.elem)
    this.sample = suites[0].samples[0]
    this.update (suites) .showSuite (0)
  }

  update (suites) {
    this.suites = suites
    this.elem.innerHTML = ''
    // this.suite = suites[0]
    // this.sampleIndex = 0
    const samples = this.samples = this.suites[0].samples
    const sample = this.sample // = samples[0]

    const elem_ = TestUI.domex.render ({ suites, samples, version:html.version }) .elem
    this.elem.replaceWith (elem_)
    this.elem = elem_

    const [results, tabs, input, view1, view2, view3, submit] =
      ['results', 'tabs', 'input', 'view1', 'view2', 'view3', 'submit'] .map (byId)

    this.dom = { results, tabs, input, view1, view2, view3, submit }
    submit.addEventListener ('click', evt => this.showSampleValue (input.value))
    
    this.showSampleValue (this.sample)
    return this
  }

  showResults ({time, nativeTime}) {
    const ratio = Math.round (100*time / nativeTime)
    this.dom.results.innerHTML = ''
    this.dom.results.append (domex `
      span "Parsing took " %nativeTime "ms (native)"
        " vs " %time "ms (html-parser) – " %ratio "%."`
      .render ({time, nativeTime, ratio}).elems)
  }

  showSuite (index) {
    this.suite = this.suites [index]
    log ('suite', this.suite.title)
    const el = domex `
      li [data-key=$] @tab > "Sample " + $;
      ul #tabs .vstack.xx18.scrolly > @tab.link.nowrap*`
      .render (this.suite.samples) .elem
    this.dom.tabs.replaceWith (el)
    this.dom.tabs = el
    this.showSample (0)
    return this
  }
  
  showSampleValue (sample) {
    window.console.clear ()
    this.dom.input.value = sample
  
    const nativeResult = nativeParse (sample)
    const result = html.parse (sample)

    this.dom.view1.lastChild.replaceWith (showTree (nativeResult))
    this.dom.view2.lastChild.replaceWith (showTree (result))
  
    const p1 = printTree (nativeResult)
    const p2 = printTree (result)
    if (p1 !== p2) {
      console.error ('test failed', sample)
      console.log (p1, p2)
    }
    return this
  }

  showSample (index) {
    this.sample = this.suite.samples [index]
    return this.showSampleValue (this.sample)
  }
  
  inspect (obj) {
    if (obj != null) {
      this.dom.view3.lastChild.replaceWith (TestUI.inspectorDx.render (obj).elems)
      this.dom.view3.style.display = null
      this.dom.view1.style.display = 'none'
    }
    else {
      this.dom.view3.style.display = 'none'
      this.dom.view1.style.display = null
    }
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
    // elem[objectKey] = domNode
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
  elem.className = 'node'
  if (domNode instanceof Document || domNode instanceof html.treebuilder.Node && domNode.name === '#document')
    label = '#document'

  else if (domNode instanceof DocumentType)
    label = '<!doctype>'

  else if (domNode instanceof Comment || domNode instanceof html.treebuilder.Node && domNode.name === '#comment')
    label = '<!-->'

  else if (domNode instanceof Element) {
    if (domNode.namespaceURI && domNode.namespaceURI !== htmlns)
      label = domNode.namespaceURI.split ('/') .pop () + ':' + domNode.tagName
    else label = domNode.tagName.toLowerCase ()
  }

  else if (domNode instanceof html.treebuilder.Node || domNode instanceof html.treebuilder.Leaf) {
    label = domNode.name
  }

  // log (domNode.__proto__)
  var elel = $('span')
  elel.className = 'label'
  elel.append (label)
  elem.append (elel)
  elem[objectKey] = domNode.frame ? domNode.frame.info : domNode
  
  if (clss) elem.classList.add(clss)
  let ul; elem.append ((ul = $('div')))
  ul.className = 'children'

  const children = domNode instanceof HTMLTemplateElement
    ? domNode.content.childNodes
    : domNode.name === '#comment' ? []
    : domNode.childNodes || domNode.children || []

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


// Traversal,
// For both browser DOM and html-parser 'DOM'

function* _traverse (node) {
  const T = html.Lexer.tokenTypes

  if (typeof node === 'string' || node instanceof String)
    yield node

  else if (node instanceof Text)
    yield node.data

  else if (node instanceof html.treebuilder.Node && node.name === '#comment')
    null // TODO

  else if (node instanceof html.treebuilder.Node && node.name[0] === '#')
    for (let child of node.children) yield* _traverse (child)

  else if (node instanceof html.treebuilder.Node) {
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

  else if (node instanceof html.treebuilder.Leaf) {
    yield [T.StartTag, node.name] // TODO also print attrs
    yield [T.EndTag, node.name]
  }

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


// Exports
// -------

export { TestUI, nativeParse, printTree, objectKey }
