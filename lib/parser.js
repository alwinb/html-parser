const { defineProperty:def, assign, setPrototypeOf:setProto } = Object
const configurable = true
const methods = (obj, dict) => { for (const k in dict) def (obj, k, { value: dict[k], configurable }) }
const getters = (obj, dict) => { for (const k in dict) def (obj, k, {   get: dict[k], configurable }) }


// Parser
// ======

import { E, C, Any, None, kinds, otherKind, printKind }
  from './categories.js'

import { documentRule, childRule, siblingRule, ruleInfo }
  from './schema.js'

import { Document, Element, EndTag }
  from './dom.js'

import { TreeBuilderClass }
  from './treebuilder.js'

const TreeBuilder = 
  TreeBuilderClass ({ childRule, siblingRule, ruleInfo })

// Extras: TagName Adjustments

const specialFontAttributes =
  { color:1, face:1, size:1 }

const SVGTagNameAdjustments = {
  altglyph:            'altGlyph',
  altglyphdef:         'altGlyphDef',
  altglyphitem:        'altGlyphItem',
  animatecolor:        'animateColor',
  animatemotion:       'animateMotion',
  animatetransform:    'animateTransform',
  clippath:            'clipPath',
  feblend:             'feBlend',
  fecolormatrix:       'feColorMatrix',
  fecomponenttransfer: 'feComponentTransfer',
  fecomposite:         'feComposite',
  feconvolvematrix:    'feConvolveMatrix',
  fediffuselighting:   'feDiffuseLighting',
  fedisplacementmap:   'feDisplacementMap',
  fedistantlight:      'feDistantLight',
  fedropshadow:        'feDropShadow',
  feflood:             'feFlood',
  fefunca:             'feFuncA',
  fefuncb:             'feFuncB',
  fefuncg:             'feFuncG',
  fefuncr:             'feFuncR',
  fegaussianblur:      'feGaussianBlur',
  feimage:             'feImage',
  femerge:             'feMerge',
  femergenode:         'feMergeNode',
  femorphology:        'feMorphology',
  feoffset:            'feOffset',
  fepointlight:        'fePointLight',
  fespecularlighting:  'feSpecularLighting',
  fespotlight:         'feSpotLight',
  fetile:              'feTile',
  feturbulence:        'feTurbulence',
  foreignobject:       'foreignObject',
  glyphref:            'glyphRef',
  lineargradient:      'linearGradient',
  radialgradient:      'radialGradient',
  textpath:            'textPath',
}



// Token-Stream Preprocessor
// -------------------------
// The preprocessor adjusts token names and does some context-dependent processing
// to handle exceptions that cannot be described with a TreeBuilder schema.

function Preprocessor (delegate) {

  let buffer = []
  let context = { closable:0n, namespace:0n, allOpened:0n, allClosed:0n }
  methods (this, { writeTag, writeEndTag, writeSpace, writeData, writeMDecl, writeNulls, writeEOF })


  // Start Tags
  
  function writeTag (item) {
    item = _adjustTag (item)
    let kind = kinds [item.name] || otherKind
    const { head, body, closable, namespace } = context
    const attrs = item.attributes // REVIEW attrs currently is an array of { name, value } pairs

    switch (kind & C.startTagExceptions) {

      // Workaround to make <body> and <head> escalate in math/svg
      // (this cannot currently be expressed in the TreeBuilder schema)
      case E.body:
      case E.head:
        return context = namespace ?
          delegate.writeEndTag (new EndTag (namespace & E.svg ? 'svg' : 'math')) : // REVIEW
          delegate.writeTag (item)

      // <select> within a <select> is converted to </select>
      case E.select:
        return context = closable & E.select ?
          delegate.writeEndTag (new EndTag ('select')) :
          delegate.writeTag (item)

      // <frameset> tags are ignored if particular open tags have been accepted
      case E.frameset:
        if (!(context.allOpened &~ C.framesetOK))
          return context = delegate.writeTag (item)
        else return context

      // <image> is converted to <img>
      case E.image:
        return context = delegate.writeTag (new Element ('img'))

      // <a> within an <a> is converted to </a><a>
      case E.a:
        if (closable & E.a) context = delegate.writeEndTag (item)
        return context = delegate.writeTag (item)

      // Likewise for <nobr>
      case E.nobr:
        if (closable & E.nobr) context = delegate.writeEndTag (item)
        return context = delegate.writeTag (item)

      // <input type=hidden> is distinguished from other <input> tags
      case E.input:
        for (const { name, value } of attrs||[])
          if (name === 'type' && value.toLowerCase () === 'hidden')
            return context = delegate.writeTag (item, C.hiddenInput)
        return context = delegate.writeTag (item)

      // <font> tags in svg are distinguished by their attributes
      case E.font:
        for (const {name, value} of attrs||[]) {
          if (name.toLowerCase () in specialFontAttributes)
            return context = delegate.writeTag (item, C.htmlFont)
        }
        return context = delegate.writeTag (item, E.font)

      // <annotation-xml> tags in math are distinguished by their encoding attribute
      case C.annotationXml:
        if (namespace & E.math && attrs) for (const { name, value } of attrs)
          if (name === 'encoding') {
            const v = value.toLowerCase ()
            if (v === 'text/html' || v === 'application/xhtml+xml')
              return context = delegate.writeTag (item, C.annotationHtml)
        }
        return context = delegate.writeTag (item, C.annotationXml)
    }

    // self-closing start tags within math and svg are converted
    // to a start tag immediately followed by an end tag
    if (item.selfclose && namespace & (E.svg|E.math)) {
      context = delegate.writeTag (item)
      return context = delegate.writeEndTag (new EndTag (item.name))
    }

    return context = delegate.writeTag (item)
  }


  // End Tags

  function writeEndTag (item) {
    item = _adjustTag (item)
    let kind = kinds [item.name] || otherKind
    const { closable } = context

    if (kind & C.endTagExceptions) {

      // Convert all </br> tags to <br> (without attributes)
      if (kind & E.br)
        return context = delegate.writeTag (new Element ('br'))

      // Convert </body> after head to <body></body>
      if (kind & E.body) {
        if (!(context.allClosed & E.head)) delegate.writeTag (new Element ('body'))
        return context = delegate.writeEndTag (item) // uses the afterBody rule
      }

      // </h1> … </h6> tags may close any open element <h1> … <h6>
      if ((kind & C.h1_h6 && closable & C.h1_h6) || kind & C.annotationXml) {
        return context = delegate.writeEndTag ({ name:null, kind })
      }

      if (kind & E.p && context.body && !(closable & E.p) || kind & E.head && !context.head) {
        delegate.writeTag (new Element (item.name))
        return context = delegate.writeEndTag (new EndTag (item.name))  // NB inserts a token, without attrs
      }
    }
    return context = delegate.writeEndTag (item)
  }


  // NULL codepoints - are converted to U+FFFD in math and in svg.
  // REVIEW assuming UTF8 for now, but needs cleanup
 
   function writeNulls (buf) { 
    if (context.namespace) {
      const buf_ = new Uint8Array (buf.length * 3)
      for (let i=0, l=buf_.length; i<l; i+=3)
        (buf_[i] = 0xEF, buf_[i+1] = 0xBF, buf_[i+2] = 0xBD)
      return context = delegate.writeData (buf_)
    }
    else
      return context = delegate.writeNulls (buf)
  }

  function writeSpace (buf)  { return context = delegate.writeSpace (buf)  }
  function writeData  (buf)  { return context = delegate.writeData  (buf)  }
  function writeMDecl (item) { return context = delegate.writeMDecl (item) }
  function writeEOF () { return context = delegate.writeEOF () }


  // Tagname adjustments
  // Convert some tagnames in svg to a specific casing,
  // or convert to lowercase otherwise.

  function _adjustTag (item) {
    let name = item.name.toLowerCase ()

    if (context.namespace & E.svg)// || name === 'foreignobject') // REVIEW how to adjust foreignObject endTag?
      name = SVGTagNameAdjustments [name] || name

    if (item.name === name)
      return item

    else if (item instanceof Element) {
      const r = new Element (name, item.attributes)
      r.children = []
      r.selfclose = item.selfclose
      return r
    }

    else
      return new EndTag (name)
  }

}


// Parser / Tree builder wrapper
// -----------------------------

function Parser ({ context: ctx = documentRule, verbose = false } = { }) {

  const builder = new TreeBuilder ({ node:new Document (), context:ctx, verbose, documentRule })
  const openHooks = E.html | E.head | E.body | E.frameset | E.table
  builder._onopen (openHooks, onopen)

  // html, head, body are element pointers
  let html, head, body, bodyIndex

  // Init
  const self = this
  getters (this, { document: () => builder.document, stack: () => builder.stack, builder: () => builder })
  methods (this, { writeTag, writeEndTag, writeData, writeSpace, writeNulls, writeMDecl, writeEOF })
  return this

  // The Parser => Preprocessor feedback

  function feedback () {
    // REVIEW document the exact data needed
    const { allClosed, allOpened } = builder
    const { closable, namespace, content } = builder.tip
    const r = { namespace, head, body, closable, allOpened, allClosed, raw:content & C.DATA }
    // log ('Parser feedback', r, 'content', printKind(content))
    return r
  }

  // ### Configure the tree builder

  function onopen (name, kind, node, nodeParent, nodeIndex) {
    switch (kind) {

      // Update element pointers (also in E.head and E.frameset below)

      case E.html: return html = node
      case E.body: {
        bodyIndex = nodeIndex
        builder.tip.fosterParent = nodeParent
        builder.document.body = body = node
        return body
      }
      
      // Redirection targets

      case E.head: {
        // When a head element is seen, set the redirection target of the html element to the head.
        // This is used by the afterHeadRule to redirect specific tags into the head.
        builder.document.head = head = node
        const ctx = builder.tip
        builder.stack[1].redirectTo = new TreeBuilder ({ context:ctx, node:ctx.node, verbose })
        builder.stack[1].fosterParent = html
        return html
      }

      case E.frameset: {
        // When a frameset is seen, set the redirection target of the #document to the html element.
        // This is used by the afterAfterFramesetRule
        let ctx = builder.stack [1]
        ctx = ctx.applyRule (siblingRule (ctx, name, kind, builder.allOpened | E.frameset))
        const target = new TreeBuilder ({ context:ctx, verbose })
        builder.stack[0].redirectTo = target
        target.tip.node = builder.stack[1].node
        html.children [bodyIndex] = node
        if (body && body.name === 'body') nodeParent.children.pop ()
        return (builder.document.body = body = node)
      }

      case E.table: {
        // Set up the foster parent
        const parent = new Element ('#reparented', None)
        builder.tip.fosterParent = parent
        const siblings = nodeParent.children
        const table = siblings.pop ()
        return siblings.push (parent, table)
      }
    }
  }


  // ### Redirection
  // (foster parenting and then some)

  function _prepareRedirect (kind) {
    let context = builder.tip
    let target = builder

    if (context.redirect & kind) {
      // builder.log ('should redirect ::', printKind(kind))
      target = builder.tip.redirectTo || target
    }

    else if (context._reopen & kind) {
      // builder.log ('should reopen, for ::', printKind(kind))
      if (context.kind === None && !(builder.allOpened & E.frameset)) {
        builder._select ('html', E.html)
        builder._select ('body', E.body)
        context = builder.tip
      }
      else if (context.kind & E.html) {
        builder._select ('body', E.body)
        context = builder.tip
      }
    }
    return target
  }

  // ### TokenStream Reducer
  // Direct to the appropriate target

  function writeTag (item, kind = kinds [item.name] || otherKind) {
    // log ('parser writeTag', arguments, item, printKind (kind))
    const target = _prepareRedirect (kind)

    if (kind & C.reformat)
      target._reformat ()

    if (kind & C.void)
      target.tryAppend (item, kind, null, kind & C.breakout ? None : target.tip.namespace)
    else
      target.tryOpen (item.name, kind, item.attributes, kind & C.breakout ? None : target.tip.namespace)

    // log ('Parser context after writeTag', builder.tip, self)
    return feedback ()
  }

  function writeEndTag (item, kind = kinds [item.name] || otherKind) {
    const target = _prepareRedirect (kind)
    const closes = target.tryClose (item.name, kind)
    return feedback ()
  }

  function writeData (buff) { // REVIEW should Data and Text be differentiated in the API?
    const kind = builder.tip.content & C.DATA ? C.DATA : C.TEXT
    const target = _prepareRedirect (kind)
    if (kind & C.reformat) target._reformat ()
    target.tryAppend (buff, kind, null, None)
    return feedback ()
  }

  function writeSpace (buff) {
    const target = _prepareRedirect (C.SPACE)
    if (C.SPACE & C.reformat) target._reformat ()
    target.tryAppend (buff, C.SPACE, null, None)
    return feedback ()
  }

  function writeNulls (buff) {
    // TODO handle not as space
    const target = _prepareRedirect (C.SPACE)
    if (C.SPACE & C.reformat) target._reformat ()
    target.tryAppend (buff, C.SPACE, null, None)
    return feedback ()
  }

  function writeMDecl (item) {
    const target = _prepareRedirect (C.COMMENT)
    target.tryAppend (item, C.COMMENT, null, None)
    return feedback ()
  }

  // end -- EOF

  function writeEOF () {
    // builder.tryClose (null, C.COMMENT)
    if (ctx === documentRule) {
      if (!html) builder.tryOpen ('html', E.html)
      if (!head) builder.tryOpen ('head', E.head) || html.children.push (new Element ('head'))
      if (!body) builder.tryOpen ('body', E.body) || html.children.push (new Element ('body'))
    }
    return feedback ()
  }

}


// Exports
// -------

const _private = { C, E }
export { Parser, Preprocessor, _private }