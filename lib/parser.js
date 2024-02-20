const { defineProperty:def, assign, setPrototypeOf:setProto } = Object
const configurable = true
const methods = (o,d) => { for (const k in d) def (o,k, { value: d[k], configurable }) }
const getters = (o,d) => { for (const k in d) def (o,k, {   get: d[k], configurable }) }
const log = console.log.bind (console)


// Parser
// ======

import { C, classIds as eq, Any, None, childRule, printKind, namespaces as NS, documentRule, siblingRule,
  Rules, breakoutRules, htmlRules, svgRules, mathRules }
  from './schema.js'

import { Document, Element, EndTag }
  from './dom.js'

import { TreeBuilder }
  from './treebuilder.js'

// End tag exceptions

// const endTagExceptions
//   = C.Heading // breakout elements
//   | C.body
//   | C.br
//   | C.head
//   | C.p
//   | C.frameset // not a breakout element
//   | C.html // not a breakout element

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


function Parser ({ initialRule = documentRule } = { }) {

  // </body>, </frameset> and </html> are not passed to the tree builder,
  // but they do set a 'mode' to redirect subsequent comments.

  let mode = 0
  
  // html, head, body are element pointers

  let html, head, body, bodyIndex
  const builder = new TreeBuilder ({ node:new Document (), initialRule, documentRule })
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

    const { namespace, nestingContext } = builder.tip
    const [id, rule] = childRule (item, builder.tip)
    // log ('writeTag', item, id, rule)
    // TODO is this how to do this, with the rules here already?
    // I mean, now we also get childRules for things that ought not be there
    // which are then discareded based on the id -- which is part of the childRule return value
    const kind = 1n << BigInt (id)

    mode &= clearMode

    switch (id) {

      // Workaround to make <body> and <head> escalate in math/svg
      // (this cannot currently be expressed in the TreeBuilder schema, 
      // because svg cannot occur in a context that allows opening them,
      // and escalate only results in closes if a parent can handle the tag)

      case eq.body:
      case eq.head: {
        if (namespace & (NS.inSvg | NS.inMath)) {
          const [name, id] = namespace & NS.inSvg ? ['svg', eq.svg] : ['math', eq.math]
          builder.tryClose (name, 1n << BigInt (id))
          return builder.tip.kind
        }
        else return _writeTag (item, id, kind, rule)
      }

      // html <frameset> tags are ignored if particular open tags have been accepted

      case eq.frameset:
        return (builder.allOpened &~ C.FramesetOK
          ? builder.tip.kind
          : _writeTag (item, id, C.frameset, rule)) // Hmm maybe call a switch method instead

      // html <select> within a <select> is converted to </select>

      case eq.select:
        return nestingContext & C.select ?
          (builder.tryClose ('select', C.select),  builder.tip.kind) :
          _writeTag (item, id, C.select, rule)

      // html <image> is converted to <img>
      
      case eq.image:
        return _writeTag (new Element ('img', item.attrs), eq.img, C.img, rule)

      // Nesting restrictions handled via ignore

      case eq.form:
        if ((nestingContext & C.form) === None)
          _writeTag (item, eq.form, kind, rule)
        return builder.tip.kind

      // Nesting restrictions handled via implicit close

      case eq.DListItem:
      case eq.Heading:
      case eq.li:
      case eq.p:
      case eq.table:
      case eq.TBody:
      case eq.TCell:
      case eq.a:
      case eq.button:
      case eq.nobr:
      case eq.option:
      case eq.tr:
        if (nestingContext & kind) builder.tryCloseByKind (kind)
        return _writeTag (item, id, kind, rule)
    }

    return _writeTag (item, id, kind, rule)
  }


  function _writeTag (item, id, kind, rule) {
    // log ('parser writeTag', item, id, printKind (kind), rule)
    if (kind & C.Reformat)
      builder.reconstructFormatting ()

    const inSvg = builder.tip.namespace & NS.inSvg
    const node = kind & C.VoidElement || item.selfclose && rule.allowAutoClose ?
      (builder.tryAppend (item, kind) && item) :
      (builder.tryOpen (item.name, item.attrs, id, kind, rule) && builder.tip.node)
    if (node && inSvg)
      node.name = SvgTagNameAdjustments [node.name] ?? node.name

    // log ('Parser context after writeTag', builder.tip, self)
    return builder.tip.kind
  }


  function writeEndTag (item) {
    // console.log ({bufferedSpacesKind:printKind(bufferedSpacesKind), mode}, item)
    // bufferedSpacesKind = C.SPACE

    const name = item.name
    const { namespace, nestingContext, closableAncestors } = builder.tip

    // html, frameset, may not be html namespaced,
    // the rest will be, because they are breakout elements

    const id = (breakoutRules [name]??[])[0]

    switch (id) {

      // Convert all </br> tags to <br> (without attributes)
      case eq.br:
        const node = new Element (name)
        const [id, rule] = childRule (node, builder.tip)
        return _writeTag (node, eq.br, C.br, rule)

      // </p> not within a <p> is converted to <p></p> -- REVIEW mess
      case eq.p:
        if (!(closableAncestors & C.p) && body) {
          const node = new Element (name)
          const [id, rule] = htmlRules.p
          _writeTag (node, eq.p, C.p, rule) // inserts a token, without attrs
          builder.tryClose (item.name, C.p)
          return builder.tip.kind
        }
      break

      // </h1> … </h6> tags may close any open element <h1> … <h6>
      case eq.Heading:
        builder.tryCloseByKind (C.Heading)
        return builder.tip.kind

      ////

      case eq.body:
        // Convert </body> after head to <body></body>
        if (!head || nestingContext & C.head) {
          const [id, rule] = childRule (item, builder.tip)
          builder.tryOpen (item.name, {}, eq.body, C.body, rule)
        }
        if (body && !(builder.tip.nestingContext & dontSetMode))
          return (mode = afterBody, builder.tip.kind)
        return builder.tip.kind
      // </head> not within <head> is converted to <head></head>
      case eq.head:
        const r = builder.tip.rule
        const beforeHead = r === Rules.documentRule || r === Rules.beforeHead || r === Rules.beforeHtml
        if (beforeHead) {
          const [id, rule] = childRule (item, builder.tip)
          builder.tryOpen (item.name, {}, eq.head, C.head, rule)
          builder.tryClose (name, C.head)
          return builder.tip.kind
        }
      break

      default:
      // Ignore </html> but save state to redirect comments
      if (name === 'html' && namespace & NS.html) {
        if (html && !(nestingContext & dontSetMode))
          mode = builder.allOpened & C.frameset ? afterAfterFrameset : afterAfterBody
        return builder.tip.kind
      }

      // Do close </frameset> but also save state to redirect comments
      else if (name === 'frameset') {
        if (body && body.name === name && !(nestingContext & dontSetMode))
          mode = afterFrameset
        builder.tryClose (item.name, C.frameset)
        return builder.tip.kind
      }
    }

    // REVIEW especially in foreign context; 
    // the name--only should matter, not the context-dependent eq class
    let kind =
        1n << BigInt ((htmlRules [item.name] ?? htmlRules ['#default'])[0])
      | 1n << BigInt ((svgRules  [item.name] ?? svgRules  ['#default'])[0])
      | 1n << BigInt ((mathRules [item.name] ?? mathRules ['#default'])[0])

    builder.tryClose (item.name, kind)
    return builder.tip.kind
  }


  function writeData (item)  {
    mode &= clearMode
    builder.reconstructFormatting ()
    builder.tryAppend (item, C.TEXT)
    return builder.tip.kind
  }

  function writeSpace (buff, allowFosterParenting) {
    mode &= clearMode
    // REVIEW this renaming of space to text to trigger the foster parenting ... :(
    const _kind = allowFosterParenting && builder.tip.kind & leadingSpaceAdjust ? C.TEXT : C.SPACE
    if (_kind & C.Reformat)
      builder.reconstructFormatting ()
    builder.tryAppend (buff, _kind)
    return builder.tip.kind
  }

  function writeDoctype (buff) {
    mode &= clearMode
    builder.tryAppend (buff, C.DOCTYPE)
    return builder.tip.kind
  }

  function writeComment (item) {
    switch (mode) {
      case afterBody:
      case afterFrameset:
        if (html) html.children.push (item); break

      case afterAfterFrameset:
      case afterAfterBody:
        builder.document.children.push (item); break

      default:
        builder.tryAppend (item, C.COMMENT); break
    }
    return builder.tip.kind
  }

  // end -- EOF

  function writeEOF () {
    if (initialRule === documentRule) {
      if (!html) builder.tryOpen ('html', {}, eq.html, C.html, Rules.beforeHead)
      if (!head) builder.tryOpen ('head', {}, eq.head, C.head, Rules.inHead) || html.children.push (new Element ('head'))
      if (!body) builder.tryOpen ('body', {}, eq.body, C.body, Rules.inBody) || html.children.push (new Element ('body'))
    }
    return builder.tip.kind
  }

}


// Extras: TagName Adjustments

const correctedSvgTagNames = [
  'altGlyph',
  'altGlyphDef',
  'altGlyphItem',
  'animateColor',
  'animateMotion',
  'animateTransform',
  'clipPath',
  'feBlend',
  'feColorMatrix',
  'feComponentTransfer',
  'feComposite',
  'feConvolveMatrix',
  'feDiffuseLighting',
  'feDisplacementMap',
  'feDistantLight',
  'feDropShadow',
  'feFlood',
  'feFuncA',
  'feFuncB',
  'feFuncG',
  'feFuncR',
  'feGaussianBlur',
  'feImage',
  'feMerge',
  'feMergeNode',
  'feMorphology',
  'feOffset',
  'fePointLight',
  'feSpecularLighting',
  'feSpotLight',
  'feTile',
  'feTurbulence',
  'foreignObject',
  'glyphRef',
  'linearGradient',
  'radialGradient',
  'textPath',
]

const SvgTagNameAdjustments = {}
for (const n of correctedSvgTagNames)
  SvgTagNameAdjustments [n.toLowerCase ()] = n



// Exports
// -------

export { Parser }