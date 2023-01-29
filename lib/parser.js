const { defineProperty:def, assign, setPrototypeOf:setProto } = Object
const configurable = true
const methods = (o,d) => { for (const k in d) def (o,k, { value: d[k], configurable }) }
const getters = (o,d) => { for (const k in d) def (o,k, {   get: d[k], configurable }) }
const log = console.log.bind (console)


// Parser
// ======

import { E, C, Any, None, kinds, otherKind, printKind }
  from './categories.js'

import { documentRule, childRule, siblingRule, ruleInfo, states as S }
  from './schema.js'

import { Document, Element, EndTag }
  from './dom.js'

import { TreeBuilderClass }
  from './treebuilder.js'

const TreeBuilder = 
  TreeBuilderClass ({ childRule, siblingRule, ruleInfo })

// Extras: TagName Adjustments

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
  S.inSvg | S.inMath

const leadingSpaceAdjust =
  E.table | E.caption | C.tbody | E.tr

// Try, temporarily

C.endTagExceptions = C.endTagExceptions | E.body | E.html | E.frameset
const dontSetMode = (E.table | E.select | E.caption | C.cell)


// Kinds
// -----

// A 'kind' is the smallest category to which a given element belongs.
// By and large this depends on the tagName only, however there are
// three cases where attributes are taken into account:

// * <input type=hidden> is distinguished from other <input> tags
// * <font> tags are distinguished by their attributes
// * <annotation-xml> tags are distinguished by their encoding attribute

const _specialFontAttributes =
  { color:1, face:1, size:1 }

function Kind ({ name, attrs }) {
  const kind = kinds [name] || otherKind

  if (kind === E.input && attrs && attrs.type && attrs.type.toLowerCase () === 'hidden')
    return C.hiddenInput

  if (kind === E.font) for (const name in attrs)
    if (name in _specialFontAttributes) // NB the tokenier normalises A-Z to a-z in attribute names
      return C.htmlFont

  if (kind === C.annotationXml && attrs && attrs.encoding) {
    const v = attrs.encoding.toLowerCase ()
    if (v === 'text/html' || v === 'application/xhtml+xml')
      return C.annotationHtml
  }

  return kind
}


// Token-Stream Preprocessor
// -------------------------

// The preprocessor adjusts token names and does some context-dependent
// processing to handle exceptions that cannot be described with a
// TreeBuilder schema. NB. The preprocessor assumes that tagNames
// are already lowercased by (eg.) the Tokeniser.


function Preprocessor (delegate) {

  // Space tokens are buffered in tables because they should not be
  // foster parented if they are followed with non-space characters

  let inTableSpace = C.SPACE
  let bufferedSpaces = []
  // command-state for after* rules
  let mode = null // | 'afterBody' | 'afterAfterBody' | 'afterFrameset' | 'afterAfterFrameset
  
  let context = { state:S.main, kind:0n, closable:0n, allOpened:0n, allClosed:0n }
  methods (this, { writeTag, writeEndTag, writeSpace, writeData, writeComment, writeDoctype, writeEOF })


  // Start Tags
  
  function writeTag (item) {
    _flushSpaces ()
    inTableSpace = C.SPACE

    const { state, closable, allOpened } = context
    const kind = Kind (item)

    switch (kind & C.startTagExceptions) {

      // Workaround to make <body> and <head> escalate in math/svg
      // (this cannot currently be expressed in the TreeBuilder schema)
      case E.body:
      case E.head:
        return context = state & svgOrMath ?
          delegate.writeEndTag (new EndTag (state & S.inSvg ? 'svg' : 'math'))
          : delegate.writeTag (item)

      // <select> within a <select> is converted to </select>
      case E.select:
        return context = state & S.inSelect ?
          delegate.writeEndTag (new EndTag ('select')) :
          delegate.writeTag (item)

      // <frameset> tags are ignored if particular open tags have been accepted
      case E.frameset:
        if (state & svgOrMath || !(allOpened &~ C.framesetOK))
          return context = delegate.writeTag (item)
        else return context

      // <image> is converted to <img>
      case E.image:
        return context = delegate.writeTag (
          state & S.main ? new Element ('img', item.attrs) : item)

      // <a> within an <a> is converted to </a><a>
      case E.a:
        if (closable & E.a && state & S.main)
          context = delegate.writeEndTag (item)
        return context = delegate.writeTag (item)

      // Likewise for <nobr>
      case E.nobr:
        if (closable & E.nobr && state & S.main)
          context = delegate.writeEndTag (item)
        return context = delegate.writeTag (item)
    }

    // Self-closing start tags within math and svg are converted
    // to a start tag immediately followed by an end tag.

    if (item.selfclose && state & svgOrMath) {
      context = delegate.writeTag (item)
      return context = delegate.writeEndTag (new EndTag (item.name))
    }

    // Svg tagNames are mapped to a default casing
    // e.g. foreignObject, radialGradient, ...
    
    if (state & S.inSvg)
      item = _adjustSvgTag (item)

    return context = delegate.writeTag (item, kind)
  }


  // End Tags

  function writeEndTag (item) {
    // console.log (mode)
    _flushSpaces ()
    inTableSpace = C.SPACE
    let kind = kinds [item.name] || otherKind // no need to consider attributes
    const { state, closable, allOpened } = context

    if (kind & C.endTagExceptions) {

      if (kind & E.body) {
        // Convert </body> after head to <body></body>
        if (!(context.allClosed & E.head) || closable & E.head)
          context = delegate.writeTag (new Element ('body'))

        if (context.allOpened & E.body && !(context.closable & dontSetMode)) {
          mode = 'afterBody'
          return context
        }
        return context = delegate.writeEndTag (item)
      }

      // Ignore </html> but save state to redirect comments
      if (kind & E.html && state & S.main) {
        if (!(closable & dontSetMode))
          mode = allOpened & E.frameset ? 'afterAfterFrameset' : 'afterAfterBody'
        return context
      }

      // Do close </frameset> but also save state to redirect comments
      if (kind & E.frameset) {
        if (allOpened & kind && !(closable & dontSetMode))
          mode = 'afterFrameset'
        return context = delegate.writeEndTag (item)
      }

      // Convert all </br> tags to <br> (without attributes)
      if (kind & E.br)
        return context = delegate.writeTag (new Element ('br'))

      // </h1> … </h6> tags may close any open element <h1> … <h6>
      if (kind & closable & C.h1_h6)
        return context = delegate.writeEndTag ({ name:null, kind }, kind)

      if (kind & E.p && !(closable & E.p) && allOpened & E.body
        || kind & E.head && !(allOpened & E.head)) {
        delegate.writeTag (new Element (item.name))
        return context = delegate.writeEndTag (new EndTag (item.name))  // NB inserts a token, without attrs
      }
    }
    return context = delegate.writeEndTag (item)
  }

  function writeSpace (item) {
    let _mode = mode
    if (context.kind & leadingSpaceAdjust || mode === 'afterAfterBody') {
      bufferedSpaces .push (item)
      return context
    }
    if (mode === 'afterAfterFrameset') {
      return delegate.writeSpace (item)
    }
    else {
      mode = null
      return delegate.writeSpace (item)
    }
  }
  
  function writeData (item)  {
    inTableSpace = (context.kind & leadingSpaceAdjust || mode === 'afterAfterBody') ? C.TEXT : C.SPACE
    _flushSpaces (null)
    return context = delegate.writeData (item)
  }
  
  function writeDoctype (item) {
    _flushSpaces ()
    return context = delegate.writeDoctype (item)
  }

  function writeComment (item) {
    const mode_ = mode
    switch (mode) {
      case 'afterBody':
      case 'afterFrameset':
        _flushSpaces (mode)
        delegate.appendToHtml (item)
        return context
      break;

      case 'afterAfterFrameset':
        _flushSpaces (mode)
        delegate.appendToDocument (item)
        return context

      case 'afterAfterBody':
        _flushSpaces (mode)
        delegate.appendToDocument (item)
        return context
      break;
      
      default:
        _flushSpaces ()
        return context = delegate.writeComment (item)
    }
  }

  function writeEOF () {
    _flushSpaces ()
    return context = delegate.writeEOF ()
  }

  // ### Private

  // Flush whitespace buffer
  function _flushSpaces (mode_ = null, kind = inTableSpace) {
    for (const x of bufferedSpaces) delegate.writeSpace (x, kind)
    bufferedSpaces = []
    mode = mode_
  }
  
  // Tagname adjustments
  // Convert some tagnames in svg to a specific casing.
  // FIXME The tagname adjustment should not prevent proper
  // closing of e.g. <foreignObject> elements.

  function _adjustSvgTag (item) {
    let name = item.name
    name = SVGTagNameAdjustments [name] || name
    if (item.name === name) return item
    const r = new Element (name, item.attributes)
    // if (item.selfclose) r.selfclose = true
    return r
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
  methods (this, { writeTag, writeEndTag, writeData, writeSpace, writeComment, writeDoctype, writeEOF, appendToHtml, appendToDocument })
  return this

  // The Parser => Preprocessor feedback

  function feedback (raw = false, _mode = null) {
    // TODO cleanup and check if xmlIsh is always correct
    const { allClosed, allOpened } = builder
    const { state, kind, closable } = builder.tip
    const r = { state, kind, closable, allOpened, allClosed, xmlIsh:!!(closable & (E.svg|E.math)) }
    // log ('Parser feedback', r, 'state', printKind(state))
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
        if (builder.tip.state & svgOrMath) return
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

    else if (kind & C.RawText && builder.tip.state & S.main) {
      const success = builder.tryOpen (item.name, kind, item.attributes)
      return feedback (true)
    } 
    else
      builder.tryOpen (item.name, kind, item.attributes)

    // log ('Parser context after writeTag', builder.tip, self)
    return feedback ()
  }

  function writeEndTag (item, kind = kinds [item.name] || otherKind) {
    const closes = builder.tryClose (item.name, kind)
    return feedback ()
  }

  function writeData (buff) {
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

  function writeDoctype (item) {
    builder.tryAppend (item, C.DOCTYPE)
    return feedback ()
  }

  function writeComment (item) {
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

  function appendToDocument (item) {
    builder.document.children.push (item)
  }

  function appendToHtml (item) {
    if (html) html.children.push (item)
  }
  
  function appendToHead (item) {
    if (head) head.children.push (item)
  }

}


// Exports
// -------

const _private = { C, E }
export { Parser, Preprocessor, _private }