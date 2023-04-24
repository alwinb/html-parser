const { defineProperty:def, assign, setPrototypeOf:setProto } = Object
const configurable = true
const methods = (o,d) => { for (const k in d) def (o,k, { value: d[k], configurable }) }
const getters = (o,d) => { for (const k in d) def (o,k, {   get: d[k], configurable }) }
const log = console.log.bind (console)


// Parser
// ======

import { E, C, elemIds as e, classIds as c, Any, None, _kinds, Kind, EqClass, printKind, states as S }
  from './categories.js'

import { documentRule, childRule, siblingRule, Rules as R }
  from './schema.js'

import { Document, Element, EndTag }
  from './dom.js'

import { TreeBuilderClass }
  from './treebuilder.js'

const TreeBuilder = 
  TreeBuilderClass ({ childRule, siblingRule })


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


// Parser / Tree builder wrapper
// -----------------------------

// NB. assumes that tagNames are already lowercased
// by (eg.) the Tokeniser.


// ### Lateral state (modes)

// NB modes should not be used when parsing fragments

const afterBody = 1<<0
  , afterAfterBody = 1<<1
  , afterFrameset = 1<<2
  , afterAfterFrameset = 1<<3
  , clearMode = 0b1000 // There's no way to escape afterAfterFrameset


function Parser ({ context: ctx = documentRule, verbose = false } = { }) {

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
  
  // html, head, body are element pointers

  let html, head, body, bodyIndex
  const builder = new TreeBuilder ({ node:new Document (), context:ctx, verbose, documentRule })
  const openHooks = E.html | E.head | E.body | E.frameset | E.table
  builder._onopen (openHooks, onopen)

  // Getters and Methods

  const self = this
  getters (this, { document: () => builder.document })
  methods (this, { writeTag, writeEndTag, writeSpace, writeData, writeComment, writeDoctype, writeEOF })
  return this

  // The Parser => Lexer feedback

  function feedback () {
    return { xmlIsh:!!(builder.tip.nesting & (E.svg|E.math)) } // FIXME xmlish
  }

  // ### Configure the tree builder

  function onopen (name, id, node, nodeParent, nodeIndex) {
    switch (id) {

      // Update element pointers

      case e.html:
        return html = node

      case e.head: {
        builder.document.head = head = node
        builder.stack[1].fosterParent = head // NB
        return html
      }

      case e.body: {
        bodyIndex = nodeIndex // NB careful!
        return builder.document.body = body = node
      }

      case e.frameset: { // REVIEW
        if (!body) bodyIndex = nodeIndex // NB careful!
        else if (body.name === 'body') {
          nodeParent.children.pop ()
          html.children [bodyIndex] = node
        }
        return (builder.document.body = body = node)
      }

      // Set up the foster parent
      case e.table: {
        const parent = new Element ('#reparented', None)
        builder.tip.fosterParent = parent
        const siblings = nodeParent.children
        const table = siblings.pop ()
        return siblings.push (parent, table)
      }
    }
  }

  // ### TokenStream Reducer

  // Start Tags
  
  function writeTag (item) {

    const { allOpened } = builder
    const { state, nesting } = builder.tip

    const id = EqClass (item, state)
    const kind = 1n << BigInt (id)

    // console.log ({bufferedSpacesKind:printKind(bufferedSpacesKind), mode}, item, printKind(kind))
    _flushSpaces ()
    mode &= clearMode
    bufferedSpacesKind = C.SPACE

    switch (id) {

      // Workaround to make <body> and <head> escalate in math/svg
      // (this cannot currently be expressed in the TreeBuilder schema, 
      // because svg cannot occur in a context that allows opening them)

      case e.body:
      case e.head: {
        if (state & (S.inSvg | S.inMath)) {
          const [name, id_] = state & S.inSvg ? ['svg', e.svg] : ['math', e.math]
          return _writeEndTag (new EndTag (name), 1n << BigInt (id_))
        }
        else return _writeTag (item, id, kind)
      }

      // html <frameset> tags are ignored if particular open tags have been accepted
      case e.frameset:
        return allOpened &~ C.framesetOK ? feedback ()
          : _writeTag (item, id, E.frameset) // Hmm maybe call a switch method instead

      // html <select> within a <select> is converted to </select>
      case e.select:
        return nesting & E.select ?
          _writeEndTag (new EndTag ('select'), E.select) :
          _writeTag (item, id, E.select)

      // html <image> is converted to <img>
      case e.image:
        return _writeTag (new Element ('img', item.attrs), e.img, E.img)

      // Nesting restrictions -> Ignore
      
      case e.form:
        if ((nesting & E.form) === None)
            _writeTag (item, e.form, kind)
        return feedback ()

      // Nesting restrictions -> Close implicit

      case e.a:
      case e.nobr:
      case e.p:
      case e.li:
      case c.dddt:
      case c.h1_h6:
      case e.option:
      case e.button:
      case e.table:
        if (nesting & kind) // close by kind
          _writeEndTag ({ name:null, kind }, kind)
        return _writeTag (item, id, kind)

    }

    // Self-closing start tags within math and svg are converted
    // to a start tag immediately followed by an end tag.

    if (item.selfclose && kind & C.Foreign) {
      _writeTag (item, id, kind)
      return _writeEndTag (new EndTag (item.name), kind)
    }

    return _writeTag (item, id, kind)
  }


  function _writeTag (item, id, kind) {
    // log ('parser writeTag', arguments, item, printKind (kind))
    if (kind & C.reformat) builder._reformat ()
    if (kind & C.void) builder.tryAppend (item, kind) // could be handled by the schema

    else { // REVIEW tagname adjustment, clean this up.
      const inSvg = builder.tip.state & S.inSvg
      const result = builder.tryOpen (item.name, id, kind, item.attrs) ?. tip
      if (result && inSvg) 
        result.node.name = SVGTagNameAdjustments [result.node.name] || result.node.name      
    }
    // log ('Parser context after writeTag', builder.tip, self)
    return feedback ()
  }


  function writeEndTag (item) {
    // console.log ({bufferedSpacesKind:printKind(bufferedSpacesKind), mode}, item)
    bufferedSpacesKind = C.SPACE

    const { state, nesting, closable } = builder.tip
    let kind = (_kinds [item.name] || C.otherHtml) // REVIEW

    if (_flushSpaces ())
      mode &= clearMode

    if (kind & endTagExceptions) {

      // Ignore </html> but save state to redirect comments
      if (kind & E.html && state & S.main) {
        if (!(closable & dontSetMode))
          mode = builder.allOpened & E.frameset ? afterAfterFrameset : afterAfterBody
        return feedback ()
      }

      // Do close </frameset> but also save state to redirect comments
      if (kind & E.frameset) {
        if (nesting & E.frameset && !(closable & dontSetMode))
          mode = afterFrameset
        return _writeEndTag (item, E.frameset)
      }

      if (kind & E.body) {
        // Convert </body> after head to <body></body>
        if (!head || nesting & E.head)
          _writeTag (new Element ('body'), e.body, kind)

        if (builder.allOpened & E.body && !(builder.tip.closable & dontSetMode))
          return (mode = afterBody, feedback ())
        return _writeEndTag (item, E.body)
      }

      // Convert all </br> tags to <br> (without attributes)
      if (kind & E.br)
        return _writeTag (new Element ('br'), e.br, kind)

      // </p> not within a <p> is converted to <p></p> -- REVIEW mess
      if (kind & E.p && !(closable & E.p) && nesting & E.body) {
        _writeTag (new Element ('p'), e.p, kind) // inserts a token, without attrs
        return _writeEndTag (new EndTag (item.name), kind)
      }

      // </head> not within <head> is converted to <head></head>
      if (kind & E.head && !head) {
        _writeTag (new Element ('head'), e.head, kind)
        return _writeEndTag (new EndTag ('head'), kind)
      }

      // </h1> … </h6> tags may close any open element <h1> … <h6>
      if (kind & closable & C.h1_h6)
        return _writeEndTag ({ name:null, kind }, C.h1_h6)
    }
    if (kind &~ (E.svg | E.math | C.breakout)) kind |= C.otherForeign
    // REVIEW this is unclear; how should the kind be assigned to end-tags?
    return _writeEndTag (item, kind)
  }


  function _writeEndTag (item, kind) {
    builder.tryClose (item.name, kind)
    return feedback ()
  }


  function writeData (item)  {
    // log ('writeData', printKind(context.kind))
    // console.log ({bufferedSpacesKind:printKind(bufferedSpacesKind), mode}, item)
    if (builder.tip.kind & leadingSpaceAdjust)
      bufferedSpacesKind = C.TEXT
    _flushSpaces ()
    mode &= clearMode
    builder._reformat ()
    builder.tryAppend (item, C.TEXT)
    return feedback ()
  }


  function writeSpace (item) {
    // console.log ({bufferedSpacesKind:printKind(bufferedSpacesKind), mode})
    if (builder.tip.kind & leadingSpaceAdjust) {
      bufferedSpaces .push (item)
      return feedback ()
    }
    else {
      mode &= clearMode
      bufferedSpacesKind = C.SPACE
      return _writeSpace (item)
    }
  }

  function _writeSpace (buff, _kind = C.SPACE) {
    // REVIEW / This renaming to C.TEXT for leading-space,
    if (_kind & C.reformat) builder._reformat ()
    builder.tryAppend (buff, _kind)
    return feedback ()
  }

  function writeDoctype (buff) {
    // console.log ({bufferedSpacesKind:printKind(bufferedSpacesKind), mode}, item)
    _flushSpaces ()
    mode &= clearMode
    builder.tryAppend (buff, C.DOCTYPE)
    return feedback ()
  }

  function writeComment (item) {
    // console.log ({bufferedSpacesKind:printKind(bufferedSpacesKind), mode}, item)
    switch (mode) {
      case afterBody:
      case afterFrameset:
        _flushSpaces ()
        appendToHtml (item)
        return feedback () // NB no context change

      case afterAfterFrameset:
        _flushSpaces ()
        appendToDocument (item)
        return feedback () // NB no context change

      case afterAfterBody:
        _flushSpaces ()
        appendToDocument (item)
        return feedback () // NB no context change

      default:
        _flushSpaces ()
        builder.tryAppend (item, C.COMMENT)
        return feedback ()
    }
  }

  // end -- EOF

  function writeEOF () {
    // builder.tryClose (null, C.COMMENT)
    // console.log (mode, '<EOF>')
    _flushSpaces ()
    if (ctx === documentRule) {
      if (!html) builder.tryOpen ('html', e.html, E.html)
      if (!head) builder.tryOpen ('head', e.head, E.head) || html.children.push (new Element ('head'))
      if (!body) builder.tryOpen ('body', e.body, E.body) || html.children.push (new Element ('body'))
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

  // ### Private

  // Flush whitespace buffer
  function _flushSpaces () {
    if (bufferedSpaces.length) {
      for (const x of bufferedSpaces) _writeSpace (x, bufferedSpacesKind)
      bufferedSpaces = []
      return this
    }
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
export { Parser, _private }