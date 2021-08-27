const { defineProperty:def, assign, setPrototypeOf:setProto } = Object
const methods = (obj, dict) => { for (const k in dict) def (obj, k, { value: dict[k], enumerable:false, configurable:true }) }
const getters = (obj, dict) => { for (const k in dict) def (obj, k, {   get: dict[k], enumerable:false, configurable:true }) }
const log = console.log.bind (console)


// Director
// ========

// Using the token types from the lexer, so far
// I may collect those somewhere else

const { Lexer, tokenTypes:T, tokenRoles:R, typeName, typeMask, roleMask }
  = require ('./lexer')

const { TokenBuilder }
  = require ('./tokens')

const { E, C, Any, None, kinds, otherKind, printKind }
  = require ('./categories')

const { documentRule, childRule, siblingRule, ruleInfo, SVGTagNameAdjustments }
  = require ('./schema')

const { TreeBuilder:TreeBuilderClass, Node, Leaf }
  = require ('./treebuilder')

const TreeBuilder = 
  TreeBuilderClass ({ childRule, siblingRule, ruleInfo })


const { Start:START, End:END, Leaf:LEAF } = R
const TAG = START | END | LEAF



// The Director!
// -------------

function Director ({ context: ctx = documentRule, verbose = false } = { }) {

  const lexer     = new Lexer ()
  const tokeniser = new TokenBuilder ()
  const builder   = new TreeBuilder ({ context:ctx, verbose, documentRule })

  // context is a ref-cache to the treebuilder's current context
  // html, head, body are element pointers

  let html, head, body, bodyIndex, context

  getters (this, { document: () => builder.document })
  methods (this, { reset, write, end })

  // Configure the tree builder

  const openHooks = E.html | E.head | E.body | E.frameset | E.table

  builder._onopen (openHooks, (name, kind, node, nodeParent, nodeIndex) => {
    switch (kind) {

      // Update element pointers (also in E.head and E.frameset below)

      case E.html: return html = node
      case E.body: return (bodyIndex = nodeIndex, body = node)
      
      // Redirection targets

      case E.head: {
        // When a head element is seen, set the redirection target of the html element to the head.
        // This is used by the afterHeadRule to redirect specific tags into the head.
        head = node
        const ctx = builder.tip
        builder.stack[1].redirectTo = new TreeBuilder ({ context:ctx, node:ctx.node, verbose })
        builder.stack[1].fosterParent = html
        return
      }

      case E.frameset: {
        // When a frameset is seen, set the redirection target of the #document to the html element.
        // This is used by the afterAfterFramesetRule
        let ctx = builder.stack [1]
        ctx = ctx.applyRule (siblingRule (ctx, name, kind, builder.allOpened | E.frameset))
        const target = new TreeBuilder ({ context:ctx, verbose })
        builder.stack[0].redirectTo = target
        target.tip.node = builder.stack[1].node
        return (body = node)
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
  return reset ()

  // Methods

  function reset () {
    lexer.reset ()
    tokeniser.reset ()
    builder.reset ()
    context = builder.tip
    html = head = body = null
    return self
  }

  function write (str) {
    for (const lexemes of lexer.write (str) .batchRead (32)) {
      tokeniser.batchWrite (lexemes)
      writeTokens (tokeniser.readAll ())
    }
  }

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

  // ### preFilter

  // TODO add a one-token delay, to mark leading space in tables as text

  function* preFilter (tokens) {
    const l = tokens.length

    for (let i=0; i<l; i++) {
      let [t, name, attrs] = tokens [i]
      // log ([typeName (t), name])

      context = builder.tip
      const { namespace, closable } = context
      if (t & (T.Comment|T.Bogus)) kind = C.COMMENT
      else if (t & (T.RcData|T.RawText|T.PlainText)) kind = C.DATA
      
      // ### Tag name adjustments

      if (t & roleMask) {
        name = name.toLowerCase ()
        if (namespace & E.svg)
          name = SVGTagNameAdjustments [name] || name
        kind = kinds [name] || otherKind
      }

      // #### Start tags
      // TODO merge attributes on html and body start tags

      if (t & START) {
        t = START
        
        switch (kind & C.startTagExceptions) {

        case E.select: if (closable & E.select)
          t = END; break

        // Workaround; <body> and <head> do not escalate in math/svg
        case E.head:
        case E.body: if (namespace)
          yield [END, null, namespace]; break

        case E.image:
          (name = 'img', kind = E.img); break

        case E.input:
          if (attrs && ('type' in attrs) && attrs.type.toLowerCase () === 'hidden')
            kind = C.hiddenInput; break

        case E.font: {
          const specialFontAttributes = {'color':1, 'face':1, 'size':1 }
          for (const k in attrs)
            if (k.toLowerCase () in specialFontAttributes)
              kind = C.htmlFont
          break
          }

        case E.a:
          if (closable & E.a) yield [END, name, kind];
          yield [START, name, kind, attrs]; continue

        case E.nobr:
          if (closable & E.nobr) yield [END, name, kind];
          yield [START, name, kind, attrs]; continue

        case C.annotationXml:
          if (attrs && ('encoding' in attrs) && namespace & E.math) {
            const v = attrs.encoding.toLowerCase ()
            if (v === 'text/html' || v === 'application/xhtml+xml')
              kind = C.annotationHtml }
        }

        if (tokens[i].selfclose && namespace & (E.svg|E.math)) {
          yield [START, name, kind, attrs]
          yield [END, name, kind]
        }
        else
          yield kind & C.void ? [LEAF, new Leaf (name, attrs), kind] : [t, name, kind, attrs]
          // REVIEW setting attrs on LEAF lke this?
      
        continue
      }


      // #### End tags

      if (t & END) {
        t = END

        if (kind & C.endTagExceptions) {

          if (kind & E.br) 
            yield [START, name, kind] // NB drop attrs

          else if (kind & E.body) {
            if (!(builder.allClosed & E.head))
              yield [START, name, kind, attrs]
            yield [END, name, kind] // uses the afterBody rule
          }

          else if ((kind & C.h1_h6 && closable & C.h1_h6) || kind & C.annotationXml) {
            yield [END, null, kind] // disregard the name; close by kind only.
          }

          else if ((kind & E.p && body && !(closable & E.p)) || (kind & E.head && !head)) {
            yield [START, name, kind] // NB inserts a token, without attrs
            yield [END, name, kind]
          }

          else yield [t, name, kind]
        }
        else yield [t, name, kind]
        continue
      }
      
      // #### Leafs

      // TODO clean up
      const _kind = t & (T.RawText | T.RcData | T.PlainText | T.Comment | T.Bogus) ? C.DATA
        : t & R.Space ? C.SPACE : C.TEXT
      // Hack for leading space in tables
      if (context.closable & E.table && i < l-1 && (tokens[i+1][0] & T.Data)) yield [LEAF, name, C.TEXT]
      else yield [LEAF, name, _kind]

    }
    return self
  }


  // ### Token Handler / Director
  // Direct to the appropriate target

  function writeTokens (tokens) {
    for (const [type, item, kind, attrs] of preFilter (tokens)) {
      // log ('\n---------------------\n\n', [typeName(type), item, printKind(kind)])
      
      let target = builder
      // builder.log ('should redirect ::', printKind(kind), Boolean (context.redirect & kind))
      // builder.log ('should reopen for ::', printKind(kind), Boolean (context._reopen & kind))

      if (context.redirect & kind) {
        target = builder.tip.redirectTo || target
        // log ('selected target ::', target.tip.info)
      }

      else if (context._reopen & kind) {
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

      if (type === START) {
        // Special case: body -> frameset switching
        // log ('special frameset case?', kind & E.frameset)

        if (kind & E.frameset && ((builder.allOpened &~ C.framesetOK) === E.body)) {
          target._open (item, kind, attrs)
          html.children [bodyIndex] = target.tip.node
          continue
        }

        if (kind & C.reformat) target._reformat ()
        target.tryOpen (item, kind, attrs, kind & C.breakout ? None : target.tip.namespace)
        lexer.setNamespace (target.tip.namespace)
      }

      else if (type === END) {
        const closes = target.tryClose (item, kind) // , kind & C.breakout ? C.None : target.namespace)
        lexer.setNamespace (target.tip.namespace)
      }

      else {
        if (kind & C.reformat) target._reformat ()
        target.tryAppend (item, kind, attrs, kind & C.breakout ? None : target.tip.namespace)
      }
    }
    return self
  }

}


// Exports
// -------

Object.assign (Director, { Node, Leaf, START, END, LEAF, Director, _private: { C, E } })
module.exports = Director