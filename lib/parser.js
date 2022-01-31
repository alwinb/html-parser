const { defineProperty:def, assign, setPrototypeOf:setProto } = Object
const configurable = true
const methods = (o,d) => { for (const k in d) def (o,k, { value: d[k], configurable }) }
const getters = (o,d) => { for (const k in d) def (o,k, {   get: d[k], configurable }) }


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

// other

const svgOrMath = 
  E.svg | E.math

const leadingSpaceAdjust =
  C.tableIsh &~ E.colgroup


// Token-Stream Preprocessor
// -------------------------
// The preprocessor adjusts token names and does some context-dependent processing
// to handle exceptions that cannot be described with a TreeBuilder schema.

function Preprocessor (delegate) {

  // Space tokens are buffered in tables because they are not
  // foster parented if they are followed with non-space characters

  let inTableSpace = C.SPACE
  let bufferedSpaces = []
  let context = { namespace:0n, kind:0n, closable:0n, allOpened:0n, allClosed:0n }
  methods (this, { writeTag, writeEndTag, writeSpace, writeData, writeMDecl, writeNulls, writeEOF })


  // Start Tags
  
  function writeTag (item) {
    _flushSpaces ()
    inTableSpace = C.SPACE
    
    item = _adjustTag (item)
    let kind = kinds [item.name] || otherKind
    const { namespace, allOpened, closable } = context
    const attrs = item.attributes // REVIEW attrs currently is an array of { name, value } pairs

    switch (kind & C.startTagExceptions) {

      // Workaround to make <body> and <head> escalate in math/svg
      // (this cannot currently be expressed in the TreeBuilder schema)
      case E.body:
      case E.head:
        return context = namespace & svgOrMath ?
          delegate.writeEndTag (new EndTag (namespace & E.svg ? 'svg' : 'math'))
          : delegate.writeTag (item)

      // <select> within a <select> is converted to </select>
      case E.select:
        return context = closable & E.select && namespace & E.html ?
          delegate.writeEndTag (new EndTag ('select')) :
          delegate.writeTag (item)

      // <frameset> tags are ignored if particular open tags have been accepted
      case E.frameset:
        if (!(allOpened &~ C.framesetOK))
          return context = delegate.writeTag (item)
        else return context

      // <image> is converted to <img>
      case E.image:
        return context = delegate.writeTag (
          namespace & E.html ? new Element ('img') : item)

      // <a> within an <a> is converted to </a><a>
      case E.a:
        if (closable & E.a && namespace & E.html)
          context = delegate.writeEndTag (item)
        return context = delegate.writeTag (item)

      // Likewise for <nobr>
      case E.nobr:
        if (closable & E.nobr && namespace & E.html)
          context = delegate.writeEndTag (item)
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
        if (attrs && namespace & E.math) for (const { name, value } of attrs)
          if (name === 'encoding') {
            const v = value.toLowerCase ()
            if (v === 'text/html' || v === 'application/xhtml+xml')
              return context = delegate.writeTag (item, C.annotationHtml)
        }
        return context = delegate.writeTag (item, C.annotationXml)
    }

    // self-closing start tags within math and svg are converted
    // to a start tag immediately followed by an end tag

    if (item.selfclose && namespace & svgOrMath) {
      context = delegate.writeTag (item)
      return context = delegate.writeEndTag (new EndTag (item.name))
    }

    return context = delegate.writeTag (item)
  }


  // End Tags

  function writeEndTag (item) {
    _flushSpaces ()
    inTableSpace = C.SPACE
    item = _adjustTag (item)
    let kind = kinds [item.name] || otherKind
    const { closable, allOpened } = context

    if (kind & C.endTagExceptions) {

      // Convert all </br> tags to <br> (without attributes)
      if (kind & E.br)
        return context = delegate.writeTag (new Element ('br'))

      // Convert </body> after head to <body></body>
      // TODO inHead convert it to </head></body>?
      if (kind & E.body) {
        if (!(context.allClosed & E.head) || closable & E.head) delegate.writeTag (new Element ('body'))
        return context = delegate.writeEndTag (item)
      }

      // </h1> … </h6> tags may close any open element <h1> … <h6>
      if (kind & closable & C.h1_h6 || kind & C.annotationXml) {
        return context = delegate.writeEndTag ({ name:null, kind }, kind)
      }

      if (kind & E.p && !(closable & E.p) && allOpened & E.body
        || kind & E.head && !(allOpened & E.head)) {
        delegate.writeTag (new Element (item.name))
        return context = delegate.writeEndTag (new EndTag (item.name))  // NB inserts a token, without attrs
      }
    }
    return context = delegate.writeEndTag (item)
  }


   function writeNulls (buf) { 
    // convert U+00 to U+FFFD in SVG and MathML
    // or ignore them otherwise
    if (context.namespace & svgOrMath) {
      const buf_ = new Uint8Array (buf.length * 3)
      for (let i=0, l=buf_.length; i<l; i+=3)
        (buf_[i] = 0xEF, buf_[i+1] = 0xBF, buf_[i+2] = 0xBD)
        // REVIEW this encodes them as UTF8 for now
      _flushSpaces ()
      return context = delegate.writeData (buf_)
    }
    else return context
  }

  function writeSpace (item)  {
    if (context.kind & leadingSpaceAdjust) {
      bufferedSpaces .push (item)
      return context
    }
    else return delegate.writeSpace (item)
  }
  
  function writeData (item)  {
    inTableSpace = context.kind & leadingSpaceAdjust ? C.TEXT : C.SPACE
    _flushSpaces ()
    return context = delegate.writeData (item)
  }
  
  function writeMDecl (item) {
    _flushSpaces ()
    return context = delegate.writeMDecl (item)
  }
  
  function writeEOF () {
    _flushSpaces ()
    return context = delegate.writeEOF ()
  }

  // ### Private

  // Flush whitespace buffer
  function _flushSpaces (kind = inTableSpace) {
    for (const x of bufferedSpaces)
      delegate.writeSpace (x, kind)
    bufferedSpaces = []
  }
  
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
  // command-state for after* rules
  let mode = null // | 'afterBody' | 'afterAfterBody' | 'afterFrameset' ...

  // Init
  const self = this
  getters (this, { document: () => builder.document, stack: () => builder.stack, builder: () => builder })
  methods (this, { writeTag, writeEndTag, writeData, writeSpace, writeNulls, writeMDecl, writeEOF })
  return this

  // The Parser => Preprocessor feedback

  function feedback (raw = false, _mode = null) {
    mode = _mode
    // REVIEW document the exact data needed
    const { allClosed, allOpened } = builder
    const { namespace, kind, closable } = builder.tip
    const r = { namespace, kind, closable, allOpened, allClosed, raw }
    // log ('Parser feedback', r, 'content', printKind(content))
    return r
  }

  // ### Configure the tree builder

  function onopen (name, kind, node, nodeParent, nodeIndex) {
    switch (kind) {

      // Update element pointers

      case E.html:
        return html = node

      case E.head: {
        builder.document.head = head = node
        builder.stack[1].fosterParent = head // NB
        return html
      }

      case E.body: {
        bodyIndex = nodeIndex // NB careful!
        return builder.document.body = body = node
      }

      case E.frameset: {
        html.children [bodyIndex] = node
        if (body && body.name === 'body') nodeParent.children.pop ()
        return (builder.document.body = body = node)
      }

      // Set up the foster parent
      case E.table: {
        const parent = new Element ('#reparented', None)
        builder.tip.fosterParent = parent
        const siblings = nodeParent.children
        const table = siblings.pop ()
        return siblings.push (parent, table)
      }
    }
  }

  // ### TokenStream Reducer
  // Direct to the appropriate target

  function writeTag (item, kind = kinds [item.name] || otherKind) {
    // log ('parser writeTag', arguments, item, printKind (kind))

    if (kind & C.reformat)
      builder._reformat ()

    if (kind & C.void)
      builder.tryAppend (item, kind)

    else if (kind & C.RawText && builder.tip.namespace & E.html) {
      const success = builder.tryOpen (item.name, kind, item.attributes)
      return feedback (true)
    } 
    else
      builder.tryOpen (item.name, kind, item.attributes)

    // log ('Parser context after writeTag', builder.tip, self)
    return feedback ()
  }

  function writeEndTag (item, kind = kinds [item.name] || otherKind) {
    // </body> and </head> are ignored in most cases and never close anything,
    // however they set a bit of state to append comments to the end
    // of the <html> element or to the document. 
    // The afterBody state is reset on anything other than a comment,

    const { closable, namespace } = builder.tip
    if (namespace & E.html
      && kind & (E.body | E.frameset | E.html)
      && !(closable & (E.table | E.select | E.caption | C.cell))) {

      if (kind & E.body && body && body.name === 'body')
        return feedback (false, 'afterBody')

      if (kind & E.frameset && body && body.name === 'frameset') {
        const closes = builder.tryClose ('frameset', kind, namespace)
        return feedback (false, 'afterFrameset')
      }
      if (kind & E.html && html)
        return feedback (false, 'afterAfterBody')
    }
    const closes = builder.tryClose (item.name, kind, namespace)
    return feedback ()
  }

  function writeData (buff) { // REVIEW should Data and Text be differentiated in the API?
    const kind = builder.tip.content & C.RAW || C.TEXT
    if (kind & C.reformat) builder._reformat ()
    builder.tryAppend (buff, kind)
    return feedback ()
  }

  function writeSpace (buff, _kind = C.SPACE) {
    // REVIEW / This renaming to C.TEXT for leading-space,
    if (_kind & C.reformat) builder._reformat ()
    builder.tryAppend (buff, _kind)
    return feedback ()
  }

  function writeNulls (buff) {
    // Ignored or converted by the Preprocessor
    return feedback ()
  }

  function writeMDecl (item) {
    if (mode === 'afterBody' || mode === 'afterFrameset') {
      html.children.push (item)
      return feedback (false, mode)
    }
    else if (mode === 'afterAfterBody') {
      builder.document.children.push (item)
      return feedback (false, mode)
    }
    builder.tryAppend (item, C.COMMENT)
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
  
  // Idea to handle the afterBody state
  // in the preprocessor, using an additional method here
  /*
  function _appendItem (item) {
    if (html)
      html.children.push (item)
  }*/

}


// Exports
// -------

const _private = { C, E }
export { Parser, Preprocessor, _private }