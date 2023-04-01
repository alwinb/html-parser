const { defineProperty:def, assign, setPrototypeOf:setProto } = Object
const configurable = true
const methods = (o,d) => { for (const k in d) def (o,k, { value: d[k], configurable }) }
const getters = (o,d) => { for (const k in d) def (o,k, {   get: d[k], configurable }) }
const log = console.log.bind (console)


// Parser
// ======

import { E, C, Any, None, _kinds, Kind, printKind, states as S }
  from './categories.js'

import { documentRule, childRule, siblingRule, Rules as R }
  from './schema.js'

import { Document, Element, EndTag }
  from './dom.js'

import { TreeBuilderClass }
  from './treebuilder.js'

const TreeBuilder = 
  TreeBuilderClass ({ childRule, siblingRule })


// other

const svgOrMath = 
  S.inSvg | S.inMath


// Exceptional behaviour
// ---------------------

// Start tag exceptions

const escalateNested = 
  E.a | E.nobr | E.table | E.button | E.li | C.dddt | C.h1_h6 | E.option | E.optgroup | E.p
  C.tbody | E.tr | C.cell

const ignoreNested = 
  E.form

const startTagExceptions =
  E.body | E.head | E.frameset | E.select | E.image | E.input | E.font 
  | escalateNested | ignoreNested

// End tag exceptions

const endTagExceptions =
  E.br | E.p | E.body | E.head | C.h1_h6 
  | E.body | E.html | E.frameset

// Try, temporarily

const leadingSpaceAdjust =
  E.table | E.caption | C.tbody | E.tr

const dontSetMode =
  E.table | E.select | E.caption | C.cell | E.svg | E.math // REVIEW


// Token-Stream Preprocessor
// -------------------------

// The preprocessor adjusts token names and does some context-dependent
// processing to handle exceptions that cannot be described with a
// TreeBuilder schema. NB. The preprocessor assumes that tagNames
// are already lowercased by (eg.) the Tokeniser.


// ### Modes

// NB should not be used when parsing fragments

const afterBody = 1<<0
  , afterAfterBody = 1<<1
  , afterFrameset = 1<<2
  , afterAfterFrameset = 1<<3
  , clearMode = 0b1000 // There's no way to escape afterAfterFrameset


function Preprocessor (delegate) {

  // </body>, </frameset> and </html> are not passed to the tree builder,
  // but they do set a 'mode' to redirect subsequent comments.

  let mode = 0

  // Space tokens are buffered in tables because they should be
  // foster parented if they are followed by non-space characters
  // TODO I think I can do that in the lexer... Need lookahead states,
  // then, in the outer loop, check the last non-null match; alternatively,
  // just do a manual lookahead for <? <! </ <a though, its a bit more nasty,
  // since &#x20 is also considered as space, an thus also &#x00020 (and &#32 etc)

  let bufferedSpacesKind = C.SPACE
  let bufferedSpaces = []
  
  let context = { state:S.main, kind:0n, nesting:0n, closable:0n, allOpened:0n, allClosed:0n }
  methods (this, { writeTag, writeEndTag, writeSpace, writeData, writeComment, writeDoctype, writeEOF })


  // Start Tags
  
  function writeTag (item) {
    const { state, closable, nesting, allOpened } = context

    // NB using context- (state-) dependent kinds
    const kind = Kind (item, state)
    // console.log ({bufferedSpacesKind:printKind(bufferedSpacesKind), mode}, item, printKind(kind))

    _flushSpaces ()
    mode &= clearMode
    bufferedSpacesKind = C.SPACE

    switch (kind & startTagExceptions) {

      // Workaround to make <body> and <head> escalate in math/svg
      // (this cannot currently be expressed in the TreeBuilder schema, because svg cannot occur in a context that allows opening them)
      case E.body:
      case E.head:
        return context = state & svgOrMath ?
          delegate.writeEndTag (new EndTag (state & S.inSvg ? 'svg' : 'math'), state & S.inSvg ? E.svg : E.math)
          : delegate.writeTag (item, kind)

      // html <frameset> tags are ignored if particular open tags have been accepted
      case E.frameset:
        return allOpened &~ C.framesetOK ? context
          : context = delegate.writeTag (item, E.frameset) // Hmm maybe call a switch method instead

      // html <select> within a <select> is converted to </select>
      case E.select:
        return context = closable & E.select ?
          delegate.writeEndTag (new EndTag ('select'), E.select) :
          delegate.writeTag (item, E.select)

      // html <image> is converted to <img>
      case E.image:
        return context = delegate.writeTag (new Element ('img', item.attrs), E.img)

      // Nesting restrictions -> Ignore
      
      case E.form:
        if ((nesting & E.form) === None)
          context = delegate.writeTag (item, kind)
        return

      // Nesting restrictions -> Close implicit

      case E.a:
      case E.nobr:
      case E.p:
      case E.li:
      case C.dddt:
      case C.h1_h6:
      case E.option:
      case E.button:
      case E.table:
        if (nesting & kind) // close by kind
          context = delegate.writeEndTag ({ name:null, kind }, kind)
        return context = delegate.writeTag (item, kind)

    }

    // Self-closing start tags within math and svg are converted
    // to a start tag immediately followed by an end tag.

    if (item.selfclose && state & svgOrMath && kind &~ C.breakout) { // REVIEW
      context = delegate.writeTag (item, kind)
      return context = delegate.writeEndTag (new EndTag (item.name), kind)
    }

    return context = delegate.writeTag (item, kind)
  }


  // End Tags

  function writeEndTag (item) {
    // console.log ({bufferedSpacesKind:printKind(bufferedSpacesKind), mode}, item)
    bufferedSpacesKind = C.SPACE

    const { state, closable, allOpened } = context
    let kind = (_kinds [item.name] || C.otherHtml) // REVIEW

    if (_flushSpaces ()) mode &= clearMode

    if (kind & endTagExceptions) {

      if (kind & E.body) {
        // Convert </body> after head to <body></body>
        if (!(context.allClosed & E.head) || closable & E.head)
          context = delegate.writeTag (new Element ('body'), kind)

        if (context.allOpened & E.body && !(context.closable & dontSetMode))
          return (mode = afterBody, context)
        return context = delegate.writeEndTag (item, E.body)
      }

      // Ignore </html> but save state to redirect comments
      if (kind & E.html && state & S.main) {
        if (!(closable & dontSetMode))
          mode = allOpened & E.frameset ? afterAfterFrameset : afterAfterBody
        return context
      }

      // Do close </frameset> but also save state to redirect comments
      if (kind & E.frameset) {
        if (allOpened & E.frameset && !(closable & dontSetMode))
          mode = afterFrameset
        return context = delegate.writeEndTag (item, E.frameset)
      }

      // Convert all </br> tags to <br> (without attributes)
      if (kind & E.br)
        return context = delegate.writeTag (new Element ('br'), kind)

      // </h1> … </h6> tags may close any open element <h1> … <h6>
      if (kind & closable & C.h1_h6)
        return context = delegate.writeEndTag ({ name:null, kind }, C.h1_h6)

      // </p> not within a <p> is converted to <p></p> -- REVIEW mess
      // </head> not within <head> is converted to <head></head>
      if (kind & E.p && !(closable & E.p) && allOpened & E.body
        || kind & E.head && !(allOpened & E.head)) {
        delegate.writeTag (new Element (item.name), kind)
        return context = delegate.writeEndTag (new EndTag (item.name), kind)  // NB inserts a token, without attrs
      }
    }
    if (kind &~ (E.svg | E.math | C.breakout)) kind |= C.otherForeign
    // REVIEW this is unclear; how should the kind be assigned to end-tags?
    return context = delegate.writeEndTag (item, kind) // NB otherForeign
  }

  function writeSpace (item) {
    // console.log ({bufferedSpacesKind:printKind(bufferedSpacesKind), mode})
    if (context.kind & leadingSpaceAdjust) {
      bufferedSpaces .push (item)
      return context
    }
    else {
      mode &= clearMode
      bufferedSpacesKind = C.SPACE
      return delegate.writeSpace (item)
    }
  }
  
  function writeData (item)  {
    // log ('writeData', printKind(context.kind))
    // console.log ({bufferedSpacesKind:printKind(bufferedSpacesKind), mode}, item)
    if (context.kind & leadingSpaceAdjust) bufferedSpacesKind = C.TEXT
    _flushSpaces ()
    mode &= clearMode
    return context = delegate.writeData (item)
  }
  
  function writeDoctype (item) {
    // console.log ({bufferedSpacesKind:printKind(bufferedSpacesKind), mode}, item)
    _flushSpaces ()
    mode &= clearMode
    return context = delegate.writeDoctype (item)
  }

  function writeComment (item) {
    // console.log ({bufferedSpacesKind:printKind(bufferedSpacesKind), mode}, item)
    switch (mode) {
      case afterBody:
      case afterFrameset:
        _flushSpaces ()
        delegate.appendToHtml (item)
        return context

      case afterAfterFrameset:
        _flushSpaces ()
        delegate.appendToDocument (item)
        return context

      case afterAfterBody:
        _flushSpaces ()
        delegate.appendToDocument (item)
        return context

      default:
        _flushSpaces ()
        return context = delegate.writeComment (item)
    }
  }

  function writeEOF () {
    // console.log (mode, '<EOF>')
    _flushSpaces ()
    return context = delegate.writeEOF ()
  }

  // ### Private

  // Flush whitespace buffer
  function _flushSpaces () {
    if (bufferedSpaces.length) {
      for (const x of bufferedSpaces) delegate.writeSpace (x, bufferedSpacesKind)
      bufferedSpaces = []
      return this
    }
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

  function feedback () {
    // TODO cleanup and check if xmlIsh is always correct
    const { allClosed, allOpened } = builder
    const { state, kind, nesting, closable } = builder.tip
    const r = { state, kind, nesting, closable, allOpened, allClosed, xmlIsh:!!(closable & (E.svg|E.math)) } // FIXME
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

      case E.frameset: { // REVIEW
        if (!body) bodyIndex = nodeIndex // NB careful!
        else if (body.name === 'body') {
          nodeParent.children.pop ()
          html.children [bodyIndex] = node
        }
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

  function writeTag (item, kind) {
    // log ('parser writeTag', arguments, item, printKind (kind))
    if (kind & C.reformat) builder._reformat ()
    if (kind & C.void) builder.tryAppend (item, kind) // could be handled by the schema

    else { // REVIEW tagname adjustment, clean this up.
      const inSvg = builder.tip.state & S.inSvg
      const result = builder.tryOpen (item.name, kind, item.attrs) ?. tip
      if (result && inSvg) 
        result.node.name = SVGTagNameAdjustments [result.node.name] || result.node.name      
    }
    // log ('Parser context after writeTag', builder.tip, self)
    return feedback ()
  }

  function writeEndTag (item, kind) {
    builder.tryClose (item.name, kind)
    return feedback ()
  }

  function writeData (buff) {
    builder._reformat ()
    builder.tryAppend (buff, C.TEXT)
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


// Exports
// -------

const _private = { C, E }
export { Parser, Preprocessor, _private }