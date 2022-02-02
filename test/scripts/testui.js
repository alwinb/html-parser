
// Imports

import { parse, dom, version } from '../../lib/index.js'
import { printTree } from '../../lib/traversal.js'
import { domex, Domex } from '../../dist/domex.min.js'
const log = console.log.bind (console)

// DOM tools

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

    const elem_ = TestUI.domex.render ({ suites, samples, version }) .elem
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
    // window.console.clear ()
    this.dom.input.value = sample
  
    const nativeResult = nativeParse (sample)
    const result = parse (sample)

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

// let decode = new TextDecoder ()
// decode = decode.decode.bind (decode)

function showTree (domNode) {
  let elem, label, className

  if (domNode instanceof Text) {
    className = (/^\s*$/.test (domNode.data)) ? 'space' : 'text'
    elem = $('span')
    elem.append (domNode.data)
    elem.className = className
    // elem[objectKey] = domNode
    return elem
  }

  if (typeof domNode === 'string') {
    elem = $('span')
    className = (domNode[0] === ' ' || domNode[0] === '\t') ? 'space' : 'text'
    elem.className = className
    elem.append (domNode)
    return elem
  }

  if (domNode instanceof Uint8Array) {
    elem = $('span')
    className = (domNode[0] === 0x20 || domNode[0] === 0x9) ? 'space' : 'text'
    elem.className = className
    elem.append ( decode (domNode))
    return elem
  }
  // if (typeof domNode === 'string') {
  //   className = (/^\s*$/.test (domNode)) ? 'space' : 'text'
  //   elem = $('span')
  //   elem.append (domNode)
  //   elem.className = className
  //   elem[objectKey] = domNode
  //   return elem
  // }

  elem = $('div')
  elem.className = 'node'

  if (domNode instanceof Document || domNode instanceof dom.Document)
    label = '#document'

  else if (domNode instanceof DocumentType || domNode instanceof dom.Doctype)
    label = '<!doctype>'

  else if (domNode instanceof Comment)
    label = `<!--${domNode.data}-->`

  else if (domNode instanceof dom.MDecl || domNode instanceof dom.Comment) // && domNode.name === '#comment')
    label = `<!--${(domNode.data) .map (_ =>  (_)) .join ('') }-->`

  else if (domNode instanceof Element) {
    if (domNode.namespaceURI && domNode.namespaceURI !== dom.htmlns)
      label = domNode.namespaceURI.split ('/') .pop () + ':' + domNode.tagName
    else label = domNode.tagName.toLowerCase ()
  }

  else if (domNode instanceof dom.Element) {
    label = domNode.name
  }

  // log (domNode.__proto__)
  var elel = $('span')
  elel.className = 'label'
  elel.append (label)
  elem.append (elel)
  elem[objectKey] = domNode.frame ? domNode.frame.info : domNode

  if (className) elem.classList.add (className)
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

// Exports
// -------

export { TestUI, nativeParse, objectKey, showTree }
