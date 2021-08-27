(() => {
const { defineProperty:def, assign, setPrototypeOf:setProto } = Object
const methods = (obj, dict) => { for (const k in dict) def (obj, k, { value: dict[k], enumerable:false, configurable:true }) }
const getters = (obj, dict) => { for (const k in dict) def (obj, k, {   get: dict[k], enumerable:false, configurable:true }) }
const log = console.log.bind (console)


// Parser
// ======

const { E, C, Any, None, kinds, otherKind, printKind }
  = window.modules.html.categories // require ('./categories')

const { documentRule, childRule, siblingRule, ruleInfo, SVGTagNameAdjustments }
  = window.modules.html.schema // require ('./schema')

const { TreeBuilder:TreeBuilderClass, Node, Leaf }
  = window.modules.html.TreeBuilder // require ('./treebuilder')

const TreeBuilder = 
  TreeBuilderClass ({ childRule, siblingRule, ruleInfo })


// Token-Stream Preprocessor
// -------------------------

// WIP

// This adjusts token names, and does a bit of context-dependent
// preprocessing to handle exceptional cases that cannot be described
// by the TreeBuilder / Schema systme. 

function Preprocessor (delegate) {

  // TODO buffer space in tables to distinguish leading space
  
  let buffer = []
  let context = { closable:0n, namespace:0n }
  return { writeTag, writeEndTag, writeSpace, writeText, writeData }

  // Start Tags
  
  function writeTag (item) {
    item = adjustTag (item)
    kind = kinds [item.name] || otherKind
    const { closable, namespace } = context
    switch (kind & C.startTagExceptions) {

      case E.select: if (closable & E.select)
        return context = delegate.writeEndTag ({ name:'select' })

      // Workaround; <body> and <head> do not escalate in math/svg
      case E.head:
      case E.body: if (namespace)
        return context = delegate.writeEndTag ({ name:null, namespace })
        else return delegate.writeTag (item)

      case E.frameset:
        if (!(builder.allOpened &~ C.framesetOK))
          return context = delegate.writeTag (item); break

      case E.image:
        return context = delegate.writeTag ({ name:'img' })

      case E.input:
        if (attrs && ('type' in attrs) && attrs.type.toLowerCase () === 'hidden')
          kind = C.hiddenInput // FIXME
        return context = delegate.writeTag (item)

      case E.font: {
        const specialFontAttributes = {'color':1, 'face':1, 'size':1 }
        for (const k in attrs)
          if (k.toLowerCase () in specialFontAttributes)
            kind = C.htmlFont
        break
      }

      case E.a:
        if (closable & E.a) 
          delegate.writeEndTag (item)
        return delegate.writeTag (item)

      case E.nobr:
        if (closable & E.nobr)
          delegate.writeEndTag (item)
        return delegate.writeTag (item)

      case C.annotationXml:
        if (attrs && ('encoding' in attrs) && namespace & E.math) {
          const v = attrs.encoding.toLowerCase ()
          if (v === 'text/html' || v === 'application/xhtml+xml')
            kind = C.annotationHtml }
      // TODO
    }

    if (item.selfclose && namespace & (E.svg|E.math)) {
      delegate.writeTag (item)
      return context = delegate.writeEndTag (item)
    }

    return context = delegate.writeTag (item)
  }

  // End Tags

  function writeEndTag (item) {
    item = adjustTag (item)
    kind = kinds [item.name] || otherKind

    if (kind & C.endTagExceptions) {

      if (kind & E.br) 
        return context = delegate.writeTag ({ name:'br' }) // convert to start tag

      if (kind & E.body) {
        if (!(builder.allClosed & E.head)) // convert to start + end tag
          delegate.writeTag ({ name:'body' })
        return context = delegate.writeEndTag (item) // uses the afterBody rule
      }

      if ((kind & C.h1_h6 && closable & C.h1_h6) || kind & C.annotationXml) {
        return context = delegate.writeEndTag ({ name:null, kind }) // disregard the name; close by kind only.
      }

      if ((kind & E.p && body && !(closable & E.p)) || (kind & E.head && !head)) {
        delegate.writeTag ({ name:item.name }) // TODO and pass kindss...
        return context = delegate.writeEndTag ({ type:'EndTag', name:item.name })  // NB inserts a token, without attrs
      }

    }
    return context = delegate.writeEndTag (item)
  }

  function writeText (buf)  { return context = delegate.writeText (buf) }
  function writeSpace (buf) { return context = delegate.writeSpace (buf) }
  function writeData (buf)  { return context = delegate.writeData (buf) }

  // Tag name adjustments

  function adjustTag (item) {
    let name = item.name.toLowerCase ()
    if (context.namespace & E.svg)
      name = SVGTagNameAdjustments [name] || name
    const r = Object.assign ({}, item)
      r.name = name
    return r
  }

}


// Parser / Tree builder wrapper
// -----------------------------

function Parser ({ context: ctx = documentRule, verbose = false } = { }) {

  const builder = new TreeBuilder ({ context:ctx, verbose, documentRule })

  // context is a ref-cache to the treebuilder's current context
  // html, head, body are element pointers

  let html, head, body, bodyIndex, context

  getters (this, { document: () => builder.document, stack: () => builder.stack })
  methods (this, { write, parse, end, writeTag, writeEndTag, writeData, writeSpace, writeNulls })

  // Configure the tree builder

  const openHooks = E.html | E.head | E.body | E.frameset | E.table

  builder._onopen (openHooks, (name, kind, node, nodeParent, nodeIndex) => {
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
        const parent = new Node ('#reparented', None)
        builder.tip.fosterParent = parent
        const siblings = nodeParent.children
        const table = siblings.pop ()
        return siblings.push (parent, table)
      }
    }
  })

  // Init :)

  const self = this
  return this

  // ### API
  // "Top-level interface"

  function write () {
    // TODO (multi-buffer parser are not implemented in the new lexer yet)
  }

  function parse (str) {
    lexer.parse (str)
    // lexer.end ()
    end ()
    return builder.document
  }

  // function write (str) {
  //   for (const lexemes of lexer.write (str) .batchRead (32)) {
  //     tokeniser.batchWrite (lexemes)
  //     writeTokens (tokeniser.readAll ())
  //   }
  // }

  function end () {
    for (const lexemes of lexer.end () .batchRead (32)) {
      tokeniser.batchWrite (lexemes)
      writeTokens (tokeniser.readAll ())
    }
    builder.tryClose (null, C.COMMENT)
    if (ctx === documentRule) {
      if (!html) builder.tryOpen ('html', E.html)
      if (!head) builder.tryOpen ('head', E.head) || html.children.push (new Node ('head'))
      if (!body) builder.tryOpen ('body', E.body) || html.children.push (new Node ('body'))
    }
    return self
  }

  // ### Redirection
  // (foster parenting and then some)

  function prepareRedirect (kind) {
    const context = builder.tip
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
    const target = prepareRedirect (kind)

    if (kind & C.reformat)
      target._reformat ()

    if (kind & C.void)
      target.tryAppend (item, kind, null, kind & C.breakout ? None : target.tip.namespace)
    else
      target.tryOpen (item.name, kind, item.attributes, kind & C.breakout ? None : target.tip.namespace)

    // The quick- added feedback to the lexer TODO, make proper
    if (item.name === 'script' && target.tip.namespace)
      return 1 // "signal rawtext state"

    return builder.tip
  }

  function writeEndTag (item, kind = kinds [item.name] || otherKind) {
    const target = prepareRedirect (kind)
    const closes = target.tryClose (item.name, kind) // , kind & C.breakout ? C.None : target.namespace)
    return builder.tip
  }

  function writeData (buff) {
    const target = prepareRedirect (C.TEXT)
    if (C.TEXT & C.reformat) target._reformat ()
    target.tryAppend (buff, C.TEXT, null, None)
    return builder.tip
  }

  function writeSpace (buff) {
    const target = prepareRedirect (C.SPACE)
    if (C.SPACE & C.reformat) target._reformat ()
    target.tryAppend (buff, C.SPACE, null, None)
    return builder.tip
  }

  function writeNulls (buff) { // TODO handle not as space
    const target = prepareRedirect (C.SPACE)
    if (C.SPACE & C.reformat) target._reformat ()
    target.tryAppend (buff, C.SPACE, null, None)
    return builder.tip
  }

}


// Exports
// -------

Object.assign (Parser, { Node, Leaf, Parser, _private: { C, E } })
window.Parser = Parser // module.exports = Parser
window.Preprocessor = Preprocessor // module.exports = Parser
})(globalThis)