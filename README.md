Html Parser
===========

**[ Version 0.9.5 ] [ [Test Page][0] ] [ [WIP][1] ]**

This is a new HTML5 parser that I am working on.  
The focus is on code size, speed and simplicity. 

This is part of a larger project.  
The goal is to create a concise, accurate and elegant description of the HTML5 language 'as parsed'. 

Standard compliance is a goal.  
I intend to produce, for all possible input, a parse tree that is equivalent to the one that is produced by the algorithm in the HTML5 Standard.

There is a test page that I use for testing and debugging online [here][0].

[0]: https://alwinb.github.io/html-parser/test/tree.html
[1]: https://alwinb.github.io/html-parser/test/tree.new.html
[2]: ./notes/lexical-grammar.txt


API
---

As of version 0.10.0 the general architecture is that of a modular push parser. The parsing pipleline is set up as follows, with input flowing from right-to-left:


<center>
TreeBuilder  ⥦  Parser  ⥦  Preprocessor  ⥦  Lexer  ⟵  input
</center>

The Parser and the Preprocessor share a common _TokenHandler_ interface
for handling a stream of input tokens, with one method for each token-type:

<center>
{ writeTag, writeEndTag, writeMDecl, writeData, writeSpace, writeNulls, writeEOF }
</center>

The return value of each of the write* methods is used as feedback to the caller. This is used to pass a small amount of contextual information from the TreeBuilder back into the Preprocessor and the Lexer. 


### interface TokenHandler

- writeTag (node)
- writeEndTag (endTag)
- writeMDecl (mDecl)
- writeData (buffer)
- writeSpace (buffer)
- writeNulls (buffer)
- writeEOF ()

### class Lexer

- constructor (delegate: tokenHandler)
- write (buffer)
- end  ()
- parse (buffer)

### class Preprocessor

implements _TokenHandler_

The Preprocessor makes slight adjustments to the token stream. Inconsistent behaviour that cannot be expressed by the Parser or the TreeBuilder is taken care of at this level. 

- construtor (delegate: TokenHandler)

### class Parser

implements _TokenHandler_

The Parser wraps around a TreeBuilder and takes care of more complex parsing behaviour such as 'foster parenting" and body to frameset switching. 

- constructor ()

### class TreeBuilder

- constructor (…)
- reset ()
- canClose (name, kind, namespace)
- canEscalate (name, kind, namespace)
- canExtend (name, kind)
- prepare (name, kind, namespace)
- tryOpen (name, kind, namespace)
- tryAppend (name, kind, namespace)
- tryClose (name, kind)
- _onopen (mask, hander)
- _onclose (mask, hander)
- _open ()
- _reformat ()
- _select ()


Notes
-----

**Note**: These are older notes, they are not always in sync with the latest version.

(There is a preliminary attempt at a lexical grammar for HTML5 in [notes][2]). 

As for the parser, I'm trying to come up with a declarative description and a more elegant algorithm than the one that is described in the standard. The algorithm is not quite compatible with the standard yet but the progress is good!

### The Algorithm

Parsing HTML documents is straightforward if the input has correctly matched start- and end-tags. The complicated part is handling _mismatched end tags_ and _misplaced tags_ in a way that agrees with the standard. 

### Mismatched end tags

Mismatched end tags are end-tags that do not match up with the last 'accepted' open tag.

Examples:

1. `<ul><applet>foo</ul>bar`
2. `<table><tbody><tr><td>item</table>`
3. `<p>foo</div>`. 

This is always resolved in essentially one way:

* For each element's name, (possibly considering some context), it is specified which end-tags may implicitly close it.
* **Note**: When a mismatched end-tag results in an implicit closing of _formatting elements_, then these formatting elements are 'remembered for reopening': A subsequent open tag may then result in a sequnce of implicit formatting elements being opened whilst the tag is handled. 

Back to the examples:

1. `<applet>` may not be implicitly closed by `</ul>`, thus the `</ul>` tag does not'see' a matching start-tag and it will be ignored. 
2. However `<tbody>`, `<tr>` and `<td>` may be implicitly closed by `</table>`, so the `</table>` tag does'see' a matching start-tag, and the table element will be closed.

### Misplaced tags

Misplaced tags are start-tags and/or text-nodes that are not allowed in the current context. Examples are `<table><td>`, `<table>text` and `<p><ul>`.

There are four ways to resolve such a situation:

1. Insert implicit start-tags until the context allows the misplaced tag.
2. Insert implicit end-tags until the context allows the misplaced tag.
3. Ignore the misplaced tag.
4. Redirect the misplaced tag to another parent node ('foster parenting').

These options are run in a loop, until the tag is either inserted or ignored.

### The parser state

The parser state consists of:

- A stack of 'open elements', each of them annotated with additional context.
- A list of implicitly closed formatting elements, rememberd for reopening. 

Each stack frame stores:

- a 'scope'. This encodes in a single integer the set of 'visible' open elements' names. 
- an 'allowEnd' property that encodes the set of end-tag names to which the element is transparent. 
- an 'openFor' property that specifies per start-tag-name the elements that should be inserted; this is behaviour 1. above. 
- a 'closeFor' property, which encodes the set of potential start-tags' names that would trigger behaviour 2. above (i.e. inserting an implicit ent-tag before it). 
- A 'contents' property that encodes start-tags to be ignored (via its complement). This is behaviour 3. above.
- An optional 'foster' property. This is only used with table elements, and it stores a copy of the stack (excluding the table element itself) that is used for foster parenting. This is behaviour 4 above.

### A schema, using element categories

Rather than pointing out the behaviours mentioned above for each combination of tag-names in code, I am working on a declarative system, a kind of schema. This 'schema' determines which of the above rules are to be applied in the case of mismatched and misplaced tags. 

The schema is specified using subsets of the set of all elements. Each of these subsets is either a finite set, or it has a finite complement. I am using integer bitfields as identifiers for these subsets. This allows very fast computations on sets of elements.

I precompute a single dictionary that maps tag-names to such an integer, thus representing the union of the categories to which the tag belongs. 

### Forthcoming...

So far that's it. I will write more of it down later. 


Remaining work
--------------

* Lexer:
  - Doctype and CDATA tags are as of yet lexed as bogus comments.
  - The end tags of comments are lexed slightly differently.
  - Lexing of rawtext/ rcdata/ plaintext may be incorret in svg and mathml.
* Parser:
  - The tree construction rules for template tags.
  - Include attributes check in the implementation of 'Noah's Ark'.
  - There may be a few remaining exceptions that are not covered yet. 
  - I've not reimplemented the 'Adoption Agency' yet in the rewrite for 0.9.0.


License
--------

Mozilla Public License Version 2.0
