const { defineProperty:def, assign, setPrototypeOf:setProto } = Object
const hidden  = (obj, dict) => { for (const k in dict) def (obj, k, { value: dict[k], enumerable:false, configurable:true }) }
const getters = (obj, dict) => { for (const k in dict) def (obj, k, {   get: dict[k], enumerable:false, configurable:true }) }
const log = console.log.bind (console)


// Director
// ========

// Using the token types from the lexer, so far
// I may collect those somewhere else

const { tokenTypes:T, tokenRoles:R, typeName, typeMask, roleMask } = require ('./lexer')
// const { StartTag:START, EndTag:END, Leaf:LEAF } = T
const { Start:START, End:END } = R
const LEAF = R.Leaf
const TAG = START | END | LEAF

const { E, C, Any, None, kinds, otherKind, printKind }
  = require ('./categories')

const { html, head, body } = E
const { getRule, SVGTagNameAdjustments } = require ('./schema')

const { TreeBuilder, Node, Leaf, Comment } = require ('./treebuilder')


// Context / Stack-frame
// ---------------------

const documentContext = {
  name:'#document',
  content: E.html | C.COMMENT,
  openFor:Any,
  paths: { '#default':'html' },
  siblingRules: true,
}

const bodyContext = {
  name: '#body',
  openable: C.bodyContent,
  content: C.bodyContent,
}


// The Director!
// -------------

function Director ({ context: ctx = documentContext, verbose = false } = { }) {

  const self = this
  let builder = new TreeBuilder ({ context:ctx, verbose, getRule })
  let context = builder.tip
  hidden (this, { reset, write, end, batchWrite })
  getters (this, { document: () => builder.document })
  return reset ()

  function reset () {
    builder.reset ()
    context = builder.tip
    return self
  }

  function write (token) {
    return batchWrite ([token])
  }

  function end () {
    builder.tryClose (null, C.COMMENT)
    const ctx = builder.stack [0]
    const b = new TreeBuilder ({ context:ctx, node:ctx.node, minHeigth:1, getRule, verbose })

    // REVIEW, this is merely a quick solution for now
    if (!b._select ('html', E.html))
      b.tryOpen ('html', E.html)
    if (!b._select ('body', E.body) && !b._select ('frameset', E.frameset))
      b.tryOpen ('body', E.body)
    return self
  }

  // ### preFilter

  // TODO add a one-token delay, to mark leading space in tables as text

  function* transform (tokens) {
    const l = tokens.length

    for (let i=0; i<l; i++) {
      let [t, name, attrs] = tokens [i]
      // log ([typeName (t), name])

      context = builder.tip
      const { closable } = context

      if (t & (T.Comment|T.Bogus))
        kind = C.COMMENT
      if (t & (T.RcData|T.RawText|T.PlainText))
        kind = C.DATA
      

      if (t & roleMask) {

        // ### Tag name adjustments

        name = name.toLowerCase ()
        if (context.namespace & E.svg)
          name = SVGTagNameAdjustments [name] || name
        kind = kinds [name] || otherKind

        // #### Start tags
        // TODO merge attributes on html and body start tags

        if (t & START) {
          t = START
          
          switch (kind & C.startTagExceptions) {

          case E.select: if (closable & E.select)
            t = END; break

          // Workaround; <body> does not escalate in math/svg
          case E.body: if (context.namespace)
            yield [END, null, context.namespace]; continue

          case E.image:
            (name = 'img', kind = E.img); break

          case E.input:
            if (attrs && 'type' in attrs && attrs.type.toLowerCase () === 'hidden')
              kind = C.hiddenInput; break

          case E.font:
            if (attrs && 'color' in attrs || 'face' in attrs || 'size' in attrs)
              kind = C.htmlFont; break // TODO also fix up ends then

          case E.a:
            if (closable & E.a) yield [END, name, kind];
            yield [START, name, kind, attrs]; continue

          case E.nobr:
            if (closable & E.nobr) yield [END, name, kind];
            yield [START, name, kind, attrs]; continue

          case C.annotationXml:
            if (attrs && ('encoding' in attrs) && context.namespace & E.math) {
              const v = attrs.encoding.toLowerCase ()
              if (v === 'text/html' || v === 'application/xhtml+xml')
                kind = C.annotationHtml }
          }

          if (tokens[i].selfclose && context.namespace & (E.svg|E.math)) {
            yield [START, name, kind, attrs]
            yield [END, name, kind]
          }
          else
            yield kind & C.void ? [LEAF, new Leaf (name, attrs), kind] : [t, name, kind, attrs]
            // REVIEW setting attrs on LEAF lke this?
        }


        // #### End tags
        // TODO remaining cases: h1/h6 mismatched start/end tags

        else if (t & END) {
          t = END

          if (kind & C.endTagExceptions) {

            if (kind & E.br) 
              yield [START, name, kind] // NB drop attrs

            else if (kind & E.body) {
              if (!(builder.allClosed & E.head))
                yield [START, name, kind, attrs]
              else continue
              // yield [END, name, kind] -- Or use an afterBody rule
            }

            else if (kind & C.h1_h6 && closable & C.h1_h6) {
              yield [END, null, kind] // disregard the name; close by kind only.
            } // TODO add for annotationHtml as well

            else if ((kind & E.p && !(closable & E.p) && closable & E.body) || (kind & E.head && !(closable & E.head))) {
              yield [START, name, kind] // NB inserts a token, without attrs
              yield [END, name, kind]
            }

            else yield [t, name, kind]
          }
          else yield [t, name, kind]
        }
        
        else {
          // log ('??', [typeName (t), name])
          // TODO review this, 
          const kind = t & R.Space ? C.SPACE : t & T.Data ? C.TEXT : C.DATA
          yield [LEAF, name, kind]
        }
      }
      
      // #### Leafs

      else {
        const kind = t & R.Space ? C.SPACE : t & T.Data ? C.TEXT : C.DATA
        // Hack for leading space in tables
        if (context.closable & E.table && i < l-1 && !(tokens[i+1][0] & R.Space))
          yield [LEAF, name, C.TEXT]
        else
          yield [LEAF, name, kind]
      }
    }
    return self
  }


  // ### Token Handler / Director
  // Direct to the appropriate target

  function batchWrite (tokens) {
    for (const [type, item, kind, attrs] of transform (tokens)) {
      // log ('\n---------------------\n\n', [typeName(type), item, printKind(kind)])
      
      let target = builder
      // log ('should redirect ?', printKind(kind), Boolean (context.redirect & kind))

      if (context.redirect & kind) {
        target = builder.tip.target || target
        // log ('selected target ::', target.tip.info)
      }

      if (type === START) {

        if (kind & E.head && builder.prepare (item, kind)) {
          const frame = builder.stack[1] //.lookup ('html', E.html) .frame
          builder._open (item, kind, attrs)
          const ctx = builder.tip
          frame.target = new TreeBuilder ({ context:ctx, node:ctx.node, minHeigth:1, getRule, verbose })
        }

        else if (kind & E.table && builder.prepare (item, kind)) {
          // Hmm This is yet more complicated
          const collector = new TreeBuilder ({ context:bodyContext, minHeigth:1, getRule, verbose })
          builder.tip.target = collector
          builder.tip.node.children.push (collector.document)
          builder._open (item, kind, attrs)
        }
        
        // Special case: body -> frameset switching
        // TODO - this is rather hacky / brittle, so
        // clean it up
        else if (kind & E.frameset) {
          if ((builder.allOpened &~ C.framesetOK) === E.body) {
            target._open (item, kind, attrs)
            const htmlEl = builder.document.children[0]
            const last = htmlEl.children.length-1
            htmlEl.children [last] = target.tip.node
          }
          else target.tryOpen (item, kind, attrs)
        }

        // Default branch
        else  {
          if (kind & C.reformat) target._reformat ()
          target.tryOpen (item, kind, attrs)
        }
        
      }

      else if (type === END) {
        const closes = target.tryClose (item, kind)
      }

      else {
        if (kind & C.reformat) target._reformat ()
        target.tryAppend (item, kind, attrs)
      }
    }
    return self
  }


}


// Exports
// -------

Object.assign (Director, { Node, Leaf, Comment, START, END, LEAF, Director, _private: { C, E } })
module.exports = Director