Html Parser
===========

**Version 0.5.0**

This is a new HTML5 parser that I am working on.  
The focus is on code size, speed and simplicity. 

This is part of a larger project.  
The goal is to create a concise, accurate and elegant description of the HTML5 language 'as parsed'. 

Standard compliance is a goal.  
I intend to produce, for all possible input, a parse tree that is equivalent to the one that is produced by the algorithm in the HTML5 Standard.

The Lexer
---------

There is a preliminary attempt at a lexical grammar for HTML5 in [notes][2]. 

For the implementation, I have painstakingly charted a transition table based on the standard and then used a technique outlined in this [gist][1] to encode the state machine in very few lines. The lexer is almost complete.

[1]: https://gist.github.com/alwinb/d2787f4cde1f7aadd197f40806cb08ef#file-statemachine-js
[2]: ./notes/lexical-grammar.txt


The Parser
----------

I'm trying to come up with a declarative description and a more elegant algorithm than the one that is described in the standard. The algorithm is not quite compatible with the standard yet but the progress is good!

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

The schema is specified using subsets of the set of all elements. (I call them element-categories). Each of these subsets is either a finite set, or it has a finite complement. I am using integer bitfields as identifiers for these subsets. This allows _very fast_ computations with element categories. 

I precompute a single dictionary that maps tag-names to such an integer, thus representing the union of the categories to which the tag belongs. 


### Forthcoming...

So far that's it. I will write more of it down later. 


Remaining work
--------------

The progress so far is very good, but a few issues remain. 

* Lexer
	- Doctype and CDATA tags are as of yet lexed as bogus comments
	- The end tags of comments are lexed slightly differently
	- Lexing of rawtext/ rcdata/ plaintext may be incorret in svg and mathml

* Parser
	- The tree construction rules for svg and mathml are not properly covered
	- Neither are the tree construction rules for framesets and template tags
	- At most three formatting elements should be reopened per family (Noah's Ark)
	- The Adoption Agency Algorithm for formatting tags is not covered yet
	- There may be a few remaining exceptions that are not covered yet. 
  - Easy, but the attributes are not attached to the elements yet ...

License
--------

Mozilla Public License Version 2.0
