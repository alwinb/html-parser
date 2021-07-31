const { defineProperty:def, assign, setPrototypeOf:setProto } = Object
const hidden  = (obj, dict) => { for (const k in dict) def (obj, k, { value: dict[k], enumerable:false, configurable:true }) }
const getters = (obj, dict) => { for (const k in dict) def (obj, k, {   get: dict[k], enumerable:false, configurable:true }) }
const log = console.log.bind (console)

// Director
// ========

// Using the token types from the lexer, so far
// I may collect those somewhere else

const { TreeBuilder, Node, Leaf, Comment } = require ('./treebuilder.new')

const {
  E, C, Any, None, printInfo, 
  elementInfo: kinds, defaultInfo: otherKind,
} = require ('./categories')

const { html, head, body } = E
const { getRule, SVGTagNameAdjustments } = require ('./schema')
const { tokenTypes:T, tokenRoles:R, typeName, typeMask } = require ('./lexer')
const { StartTag:START, EndTag:END, Leaf:LEAF } = T
const TAG = START | END


// Context / Stack-frame
// ---------------------

const documentContext = {
  name:'#document',
  content: E.html | C.COMMENT,
  openFor:Any,
  paths: { '#default':'html' }
}

const bodyContext = {
  name: '#body',
  openable: C.bodyContent,
  content: C.bodyContent,
}

const headContext = {
  name: '#head',
  content: C.meta | C.SPACE,
}


// The Director!
// -------------

function Director ({ context: ctx = documentContext, verbose = false } = { }) {

  const self = this
  let builder, context
  hidden (this, { reset, write, end, batchWrite })
  getters (this, { document: () => builder.document })
  return reset ()

  function reset () {
    builder = new TreeBuilder ({ context:ctx, verbose, getRule })
    context = builder.tip
    return self
  }

  function write (token) {
    return batchWrite ([token])
  }

  function end () {
    builder.tryOpen ('body')
    return self
  }

  // ### preFilter

  // TODO add a one-token delay, to mark leading space in tables as text

  function* transform (tokens) {
    const l = tokens.length

    for (let i=0; i<l; i++) {
      let [t, name, attrs] = tokens [i]
      context = builder.tip
      const { closable } = context

      if (t & TAG) {

        // ### Tag name adjustments

        name = name.toLowerCase ()
        if (context.namespace & E.svg)
          name = SVGTagNameAdjustments [name] || name
        kind = kinds [name] || otherKind

        // #### Start tags
        // TODO handle self-closing tags as leafs, too

        if (t === START) {

          switch (kind & C.startTagExceptions) {

          case E.select: if (closable & E.select)
            t = END; break

          case E.image:
            (name = 'img', kind = E.img); break

          case E.input:
            if (attrs && 'type' in attrs && attrs.type.toLowerCase () === 'hidden')
              kind = C.hiddenInput; break

          case E.font:
            if (attrs && 'color' in attrs || 'face' in attrs || 'size' in attrs)
              kind = C.htmlFont; break // TODO also fix up ends then

          case C.annotationXml:
            if (attrs && ('encoding' in attrs) && context.namespace & E.math) {
              const v = attrs.encoding.toLowerCase ()
              if (v === 'text/html' || v === 'application/xhtml+xml')
                kind = C.annotationHtml }
          }

          yield kind & C.void ? [LEAF, new Leaf (name), kind] : [t, name, kind]
        }


        // #### End tags
        // TODO remaining cases: h1/h6 mismatched start/end tags

        else if (t === END && kind & C.endTagExceptions) {

          if (kind & E.br) 
            yield [START, name, kind] // NB drop attrs

          else if (kind & E.body) {
            if (!(builder.closeCount & E.head))
              yield [START, name, kind]
            else continue
          }

          else if ((kind & E.p && !(closable & E.p)) || (kind & E.head && !(closable & E.head))) {
            yield [START, name, kind] // NB inserts a token
            yield [END, name, kind]
          }

          else yield [t, name, kind]
        }
        else yield [t, name, kind]
      }
      
      else if (t & (T.Bogus|T.Comment))
        yield [t, new Comment (name), C.COMMENT]

      // #### Leafs

      else {
        // Hack for leading space in tables
        if (context.closable & E.table && (tokens[i+1]||[])[0] & T.Data) {
          yield [LEAF, name, C.TEXT]
        }
        else {
          const kind = t & R.Space ? C.SPACE : C.TEXT
          yield [LEAF, name, kind]
        }
      }
    }
    return self
  }


  // ### Token Handler / Director
  // Direct to the appropriate target

  function batchWrite (tokens) {
    for (const [type, item, kind] of transform (tokens)) {
      let target = builder
      // log ('should redirect ?', printInfo(kind), Boolean (context.redirect & kind))

      if (context.redirect & kind) {

        if (context.closable & E.table) {
          const frame = builder.lookup ('table', E.table) .frame
          target = frame.target || target
        }

        else
          target = builder.tip.target || target
        // log ('selected target ::', target.tip.info)
      }

      if (type === START) {

        if (kind & E.head && builder.prepare (item, kind)) {
          const frame = builder.stack[1] //.lookup ('html', E.html) .frame
          builder._open (item, kind)
          const ctx = builder.tip
          frame.target = new TreeBuilder ({ context:ctx, node:ctx.node, minHeigth:1, getRule })
        }

        else if (kind & E.table && builder.prepare (item, kind)) {
          // Hmm This is yet more complicated
          const collector = new TreeBuilder ({ context:bodyContext, minHeigth:1, getRule })
          builder.tip.target = collector
          builder.tip.node.children.push (collector.document)
          builder._open (item, kind)
        }
        
        else if (kind & E.frameset) {
          // TODO, body -> frameset switching
          if ((builder.allSeen &~ C.framesetOK) === E.body) {
            // TODO now actually replace the body then instead
            target._open (item, kind)
            
          }
          else 
            target.tryOpen (item, kind)
        }

        else target.tryOpen (item, kind)
      }

      else if (type === END)
        target.tryClose (item, kind)

      else
        target.tryAppend (item, kind)
    }
    return self
  }


}


// Exports
// -------

Object.assign (Director, { Node, Leaf, Comment, START, END, LEAF, Director, _private: { C, E } })
module.exports = Director