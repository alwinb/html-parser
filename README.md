Html Parser
===========

**[ Version 0.13.0 ] [ [Test Page][0] ]**

This is a new HTML5 parser that I am working on.  
The focus is on code size, speed and simplicity. 

This is part of a larger project that aims to eventually create an alternative specification of the HTML language 'as parsed'; One that is easier to understand, but equivalent with the existing HTML Standard.

[0]: https://alwinb.github.io/html-parser/test/tree.html


Theory and API
--------------

The information here is in flux. 
I will work on the documentation more dilligently at a later stage.

### Architecture

The architecture is that of a modular push parser. The parsing pipleline is set up as follows, with input flowing from right-to-left:

TreeBuilder  ⥦  Parser  ⥦  Tokeniser  ⟵  input

The Parser has a TokenHandler interface for handling a stream of input tokens.
It has distinct write* methods for each token-type. The return value of the write* methods is used as a feedback mechanism to to pass a small amount of contextual information from the TreeBuilder back through the Parser to the Tokeniser. 

The TreeBuilder is derived from a declarative schema. It implements a well-behaved formalism that specifies invariants on the resulting DOM-tree. _In addition_, it specifies how misplaced and mismatched tokens in the token stream must be handled.

The Parser wraps around a TreeBuilder and takes care of some irregular parsing behaviour that cannot currently be expressed by the TreeBuilder schema alone. Examples are 'foster parenting', body to frameset switching and element tagName adjustments.


### class Tokeniser

- constructor (delegate: tokenHandler)
- write (buffer)
- end  ()
- parse (buffer)

### class Parser

- constructor ()

implements _TokenHandler_:

- writeTag (node)
- writeEndTag (endTag)
- writeDoctype (doctype)
- writeComment (mDecl)
- writeData (buffer)
- writeSpace (buffer)
- writeEOF ()

### class TreeBuilder

The TreeBuilder class is derived from a declarative schema that specifies invariants on the resuting DOM tree. It _also_ specifies how to handle misplaced and mismatched tokens.

- constructor ()
- init ()
- tryOpen (name, kind)
- tryAppend (name, kind)
- tryClose (name, kind)
- tryCloseByKind (kind)
- findClosableAncestor (name, kind)
- findClosableAncestorByKind (name)
- reconstructFormatting ()
- prepare (name, kind)
- _open ()
- _onopen (mask, hander)


### TreeBuilder Schema

In essence the TreeBuilder Schema is a top-down tree automaton with child- and sibling-transitions, with additional annotations for handling misplaced and mismatched tokens. 


Notes
-----

**Note**: These are older notes, they are not always in sync with the latest version.

### Element classes

I refer to finite and/ or cofinite sets of element-names that
trigger specific parsing behaviour as an _element category_. Element categories are boolean combinations based on a collection of (as of yet) 64 element-classes.

In the implementation, element categories are encoded as bitvectors,
The encoding is such that it allows one to use the bitwise operators
for computing complements, unions and intersections of categories.

Some of the bits correspond to singleton sets, and thus identify
a particular single element name.

#### Categories

* Any
* None
* elementClass (node, ns_context) – returns the element-equivalence-class id as an integer.
* Kind (node, ns_context)  —  returns the element-equivalence-class as a bitvector.
* printKind (kind)  —  maybe rename this?

The built-in bitwise operations can be used as boolean algebra operations on element categories:

* `~a`  —  complement
* `a | b`  —  union
* `a & b`  —  intersection
* `a &~ b` –  difference ('and not').


### The Algorithm

parsing HTML documents is straightforward if the input has correctly matched start- and end-tags. The complicated part is handling _mismatched end tags_ and _misplaced tags_ in a way that agrees with the standard. 

### Mismatched end tags

Mismatched end tags are end-tags that do not match up with the last 'accepted' open tag.

Examples:

1. `<ul><applet>foo</ul>bar`
2. `<table><tbody><tr><td>item</table>`
3. `<p>foo</div>`. 

This is always resolved in essentially one way:

* For each element-class it is specified which end-tags may implicitly close it.
* **Note**: When a mismatched end-tag results in an implicit closing of _formatting elements_, then these formatting elements are 'remembered for reopening': A subsequent open tag may then result in a sequnce of implicit formatting elements being opened whilst the tag is handled. 

Back to the examples:

1. `<applet>` may not be implicitly closed by `</ul>`, thus the `</ul>` tag does not 'see' a start-tag that it can close, and it will be ignored.
2. However `<tbody>`, `<tr>` and `<td>` may be implicitly closed by `</table>`, so the `</table>` tag does 'see' a matching start-tag, and the table element will be closed.

### Misplaced tags

Misplaced tags are start-tags and/or text-nodes that are not allowed in the current context. Examples are `<table><td>`, `<table>text` and `<p><ul>`.

There are four ways to resolve such a situation:

1. Insert implicit start-tags until the context allows the misplaced tag.
2. Insert implicit end-tags until the context allows the misplaced tag.
3. Ignore the misplaced tag.
4. Redirect the misplaced tag to another parent node ('foster parenting').

These options are run in a loop, until the tag is either inserted or ignored.

### A schema, using element categories

Rather than pointing out the behaviours mentioned above for each combination of tag-names in code, I am working on a declarative system, a kind of schema. This 'schema' determines which of the above rules are to be applied in the case of mismatched and misplaced tags. 

### The parser state

The parser state consists of:

- A stack of 'open elements', each of them annotated with additional context.
- A list of implicitly closed formatting elements, rememberd for reopening. 

Each stack frame stores:

(…)

### Forthcoming...

So far that's it. I will write more of it down later. 


Changelog
---------

* Version 0.13.0-a – Intermediate release; Major changes.

  * Uses integers as element-class–ids. They are converted to bitvectors where needed.
  * Element-class–ids are now assigned in a namespace dependent mannar.
  * The successor functions of the schema / the tree automaton now use lookup tables indexed by element-class–ids. 
  * The DFA has gained a few states to track more information about tokens, reducing the need for branching in the outer loop of the Tokeniser.
  * The schema now uses \*InPhrasing \*inFlow, PhrasingContainer and FlowContainer rules with an additional property to express 'nesting restrictions'. This makes the schema much cleaner, finally.
 * I've finally done the little bit of work to properly add the attributes to elements.  
 * Leading space in tables is now detected on the Tokeniser level.
 * The rather arbitrarily named 'Preprocessor' component is gone.
 * I've added many more examples to verify that tree construction matches the standard.
 * Amongst other things!


License
--------

Mozilla Public License Version 2.0
