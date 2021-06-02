Html Parser
===========

This is a new HTML5 parser that I am working on.
The focus is on code size, _speed_ and simplicity. 

Standard compliance _is_ a goal in the sense that I do intend to produce, for all possible input, a parse tree that is equivalent to the one produced by the algorithm in the HTML5 Standard. 
However, I do not use the same algorithm. 

The Lexer
---------
There is a preliminary attempt at a lexical grammar for HTML5 in `notes/`. 

I have painstakingly charted a transition table based on the standard and then used a technique outlined in this [gist][1] to encode the state machine in very few lines. The lexer is almost complete.

[1]: https://gist.github.com/alwinb/d2787f4cde1f7aadd197f40806cb08ef#file-statemachine-js


The Parser
----------

I'm trying to come up with a declarative description, or at least a more elegant algorithm than the one that is described in the standard. Tree construction is not quite compatible with the standard yet, but I am making good progress. 

One significant difference is that currently, I am not creating elements in the DOM for formatting elelements, but instead I leave them as formatting on and formatting off marks within the tree in tree order. I think that this is a better representation for some of the applications that I have in mind, but I might change that eventually.  


The Algorithm
-------------

I'm working on a declarative system for specifying the parser. Parsing HTML documents with correctly matched– and none omitted start– and end-tags is a very simple task. The difficulty part is handling _mismatched_- and _misplaced_ tags in a way that agrees with the standard. 

### Mismatched tags

Mismatched tags are end-tags that do not match up with the last 'accepted' open tag. Examples are `<ul><applet>foo</ul>bar` and `<table><tbody><tr><td>item</table>`, but also `<p>foo</div>`. 

This is always resolved in essentially one way:

1. For each start-tag, (possibly considering a bit of its context), it is specified by which end-tags it may be implicitly closed/ to which end-tags it is 'transparent'. For example, `<applet>` is not transparant to `</ul>`, thus the `</ul>` tag does not 'see' a matching start-tag and it will be ignored. However `<tbody>`, `<tr>` and `<td>` are transparent to `</table>`, so the `</table>` tag does 'see' a matching start-tag, and as the corresponding table element will be closed. 

### Misplaced tags

Misplaced tags are start-tags and/or text-nodes that are not allowed in the current context. Examples are `<table><td>` and `<p><ul>`.

There are four ways to resolve such a situation:

1. Ignore the misplaced start-tag.
2. Insert implicit start-tags until the context allows the misplaced start-tag. 
3. Insert implicit end-tags until the context allows the misplaced start-tag
4. Redirect the misplaced start-tag to another place in the document. 

These four methods are run in a loop, until the start-tag or text-node is either inserted, or dropped. 

**Note** There is a third category of mis-nested tags that is resolved in a different way: mis-nested formatting tags such as `<b>`, `<i>`, `<em>` and alike. This seems to be not too complicated to characterise, but so far I'm leaving them as unmatched on– and off markers in the tree. 


### Element categories

Rather than pointing out the behaviours mentioned above for each combination of tag-names in code, I am working on a declarative system, a schema of sorts, and I am studying the structure of that schema. 

First of all, the set of all possible tag-names is divided into subsets (I call them element-categories). Each of these subsets is either a finite set, or it has a finite complement. I am using integer bitfields as identifiers for these subsets. This allows _very fast_ computations with element categories. 

I precompute a single dictionary that maps tag-names to such an integer, thus representing the union of the categories to which the tag belongs. 

### The parser state

Whenever the parser creates a new element for a start-tag, it stores with it a small amount of information. It stores:

- a 'scope'. This encodes in a single integer the union of the categories of all open elements that may be visible to potential end-tags. 
- a 'allowEnd' aka. 'transparantTo' property that encodes the collection of end-tags to which the element is transparent. 
- a 'closeFor' property, which encodes again in a single integer which potential start-tags would trigger behaviour 3. above (i.e. inserting an implicit ent-tag before it). 
- a 'paths' property that specifies per start-tag-name the elements that should be inserted; this is behaviour 2. above. 
- A 'contents' property which specifies (via its complement) which start-tags should be ignored. 
- The fourth behaviour I've not yet implemented!

### Forthcoming...

So far that's it. I will write more of it down later. 
I'd like to eventually turn this into a concise description of the HTML5 language 'as parsed'. 


License
--------
Mozilla Public License Version 2.0