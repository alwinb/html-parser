const { defineProperty:def, assign, setPrototypeOf:setProto } = Object
const configurable = true
const methods = (o,d) => { for (const k in d) def (o,k, { value: d[k], configurable }) }
const getters = (o,d) => { for (const k in d) def (o,k, {   get: d[k], configurable }) }
const log = console.log.bind (console)


// Parser
// ======

import { C, classIds as eq, Any, None, Kind, elementClass, printKind, states as S }
  from './categories.js'

import { documentRule, childRule, siblingRule, Rules as R }
  from './schema.js'

import { Document, Element, EndTag }
  from './dom.js'

import { TreeBuilderClass }
  from './treebuilder.js'

const TreeBuilder = 
  TreeBuilderClass ({ childRule, siblingRule })

// End tag exceptions

const endTagExceptions =
  C.br | C.p | C.body | C.head | C.Heading 
  | C.body | C.html | C.frameset

// Try, temporarily

const leadingSpaceAdjust =
  C.table | C.caption | C.TBody | C.tr

const dontSetMode =
  C.table | C.select | C.caption | C.TCell | C.svg | C.math // REVIEW


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
  const openHooks = C.html | C.head | C.body | C.frameset | C.table
  builder._onopen (openHooks, onopen)

  // Getters and Methods

  const self = this
  getters (this, { document: () => builder.document })
  methods (this, { writeTag, writeEndTag, writeSpace, writeData, writeComment, writeDoctype, writeEOF })
  return this

  // ### Configure the tree builder

  function onopen (name, id, node, nodeParent, nodeIndex) {
    switch (id) {

      // Update element pointers

      case eq.html:
        return html = node

      case eq.head: {
        builder.document.head = head = node
        builder.stack[1].fosterParent = head // NB
        return html
      }

      case eq.body: {
        bodyIndex = nodeIndex // NB careful!
        return builder.document.body = body = node
      }

      case eq.frameset: { // REVIEW
        if (!body) bodyIndex = nodeIndex // NB careful!
        else if (body.name === 'body') {
          nodeParent.children.pop ()
          html.children [bodyIndex] = node
        }
        return (builder.document.body = body = node)
      }

      // Set up the foster parent
      case eq.table: {
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

    const id = elementClass (item, state)
    const kind = 1n << BigInt (id)

    // console.log ({bufferedSpacesKind:printKind(bufferedSpacesKind), mode}, item, printKind(kind))
    _flushSpaces ()
    mode &= clearMode
    bufferedSpacesKind = C.SPACE

    switch (id) {

      // Workaround to make <body> and <head> escalate in math/svg
      // (this cannot currently be expressed in the TreeBuilder schema, 
      // because svg cannot occur in a context that allows opening them)

      case eq.body:
      case eq.head: {
        if (state & (S.inSvg | S.inMath)) {
          const [name, id_] = state & S.inSvg ? ['svg', eq.svg] : ['math', eq.math]
          return _writeEndTag (new EndTag (name), 1n << BigInt (id_))
        }
        else return _writeTag (item, id, kind)
      }

      // html <frameset> tags are ignored if particular open tags have been accepted
      case eq.frameset:
        return (allOpened &~ C.FramesetOK
          ? builder.tip.kind
          : _writeTag (item, id, C.frameset)) // Hmm maybe call a switch method instead

      // html <select> within a <select> is converted to </select>
      case eq.select:
        return nesting & C.select ?
          _writeEndTag (new EndTag ('select'), C.select) :
          _writeTag (item, id, C.select)

      // html <image> is converted to <img>
      case eq.image:
        return _writeTag (new Element ('img', item.attrs), eq.img, C.img)

      // Nesting restrictions -> Ignore
      
      case eq.form:
        if ((nesting & C.form) === None)
            _writeTag (item, eq.form, kind)
        return builder.tip.kind

      // Nesting restrictions -> Close implicit

      case eq.a:
      case eq.nobr:
      case eq.p:
      case eq.li:
      case eq.DListItem:
      case eq.Heading:
      case eq.option:
      case eq.button:
      case eq.table:
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
    if (kind & C.Reformat) builder._reformat ()
    if (kind & C.Void) builder.tryAppend (item, kind) // could be handled by the schema

    else { // REVIEW tagname adjustment, clean this up.
      const inSvg = builder.tip.state & S.inSvg
      const result = builder.tryOpen (item.name, id, kind, item.attrs) ?. tip
      if (result && inSvg) 
        result.node.name = SVGTagNameAdjustments [result.node.name] || result.node.name      
    }
    // log ('Parser context after writeTag', builder.tip, self)
    return builder.tip.kind
  }


  function writeEndTag (item) {
    // console.log ({bufferedSpacesKind:printKind(bufferedSpacesKind), mode}, item)
    bufferedSpacesKind = C.SPACE

    const { state, nesting, closable } = builder.tip
    let kind = Kind (item) // REVIEW
    // let kind = _kinds [item.name] ?? C.OtherHtml // REVIEW

    if (_flushSpaces ())
      mode &= clearMode

    if (kind & endTagExceptions) {

      // Ignore </html> but save state to redirect comments
      if (kind & C.html && state & S.main) {
        if (!(closable & dontSetMode))
          mode = builder.allOpened & C.frameset ? afterAfterFrameset : afterAfterBody
        return builder.tip.kind
      }

      // Do close </frameset> but also save state to redirect comments
      if (kind & C.frameset) {
        if (nesting & C.frameset && !(closable & dontSetMode))
          mode = afterFrameset
        return _writeEndTag (item, C.frameset)
      }

      if (kind & C.body) {
        // Convert </body> after head to <body></body>
        if (!head || nesting & C.head)
          _writeTag (new Element ('body'), eq.body, kind)

        if (builder.allOpened & C.body && !(builder.tip.closable & dontSetMode))
          return (mode = afterBody, builder.tip.kind)
        return _writeEndTag (item, C.body)
      }

      // Convert all </br> tags to <br> (without attributes)
      if (kind & C.br)
        return _writeTag (new Element ('br'), eq.br, kind)

      // </p> not within a <p> is converted to <p></p> -- REVIEW mess
      if (kind & C.p && !(closable & C.p) && nesting & C.body) {
        _writeTag (new Element ('p'), eq.p, kind) // inserts a token, without attrs
        return _writeEndTag (new EndTag (item.name), kind)
      }

      // </head> not within <head> is converted to <head></head>
      if (kind & C.head && !head) {
        _writeTag (new Element ('head'), eq.head, kind)
        return _writeEndTag (new EndTag ('head'), kind)
      }

      // </h1> … </h6> tags may close any open element <h1> … <h6>
      if (kind & closable & C.Heading)
        return _writeEndTag ({ name:null, kind }, C.Heading)
    }
    if (kind &~ (C.svg | C.math | C.Breakout)) kind |= C.OtherForeign
    // REVIEW this is unclear; how should the kind be assigned to end-tags?
    return _writeEndTag (item, kind)
  }


  function _writeEndTag (item, kind) {
    builder.tryClose (item.name, kind)
    return builder.tip.kind
  }


  function writeData (item)  {
    // log ('writeData', printKind (builder.tip.kind))
    // console.log ({bufferedSpacesKind:printKind(bufferedSpacesKind), mode}, item)
    if (builder.tip.kind & leadingSpaceAdjust)
      bufferedSpacesKind = C.TEXT
    _flushSpaces ()
    mode &= clearMode
    builder._reformat ()
    builder.tryAppend (item, C.TEXT)
    return builder.tip.kind
  }


  function writeSpace (item) {
    // console.log ({bufferedSpacesKind:printKind(bufferedSpacesKind), mode})
    if (builder.tip.kind & leadingSpaceAdjust) {
      bufferedSpaces .push (item)
      return builder.tip.kind
    }
    else {
      mode &= clearMode
      bufferedSpacesKind = C.SPACE
      return _writeSpace (item)
    }
  }

  function _writeSpace (buff, _kind = C.SPACE) {
    // REVIEW / This renaming to C.TEXT for leading-space,
    if (_kind & C.Reformat) builder._reformat ()
    builder.tryAppend (buff, _kind)
    return builder.tip.kind
  }

  function writeDoctype (buff) {
    // console.log ({bufferedSpacesKind:printKind(bufferedSpacesKind), mode}, item)
    _flushSpaces ()
    mode &= clearMode
    builder.tryAppend (buff, C.DOCTYPE)
    return builder.tip.kind
  }

  function writeComment (item) {
    // console.log ({bufferedSpacesKind:printKind(bufferedSpacesKind), mode}, item)
    switch (mode) {
      case afterBody:
      case afterFrameset:
        _flushSpaces ()
        appendToHtml (item)
        return builder.tip.kind // NB no context change

      case afterAfterFrameset:
        _flushSpaces ()
        appendToDocument (item)
        return builder.tip.kind // NB no context change

      case afterAfterBody:
        _flushSpaces ()
        appendToDocument (item)
        return builder.tip.kind // NB no context change

      default:
        _flushSpaces ()
        builder.tryAppend (item, C.COMMENT)
        return builder.tip.kind
    }
  }

  // end -- EOF

  function writeEOF () {
    // builder.tryClose (null, C.COMMENT)
    // console.log (mode, '<EOF>')
    _flushSpaces ()
    if (ctx === documentRule) {
      if (!html) builder.tryOpen ('html', eq.html, C.html)
      if (!head) builder.tryOpen ('head', eq.head, C.head) || html.children.push (new Element ('head'))
      if (!body) builder.tryOpen ('body', eq.body, C.body) || html.children.push (new Element ('body'))
    }
    return builder.tip.kind
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

export { Parser }