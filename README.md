Html Parser
===========

This is a new HTML5 parser that I am working on.
The focus is on code size, _speed_ and simplicity. 

Standard compliance _is_ a goal in the sense that I do intend to produce, for all possible input, a parse tree that is equivalent to the one produced by the algorithm in the HTML5 Standard. 
However, I do not use the same algorithm, nor the same data structures. 

The Lexer
---------
There is a preliminary attempt at a lexical grammar for HTML5 in `notes/`. 

I have painstakingly charted a transition table based on the standard and then used a technique outlined in this [gist][1] to encode the state machine in very few lines. The lexer is almost complete.

[1]: https://gist.github.com/alwinb/d2787f4cde1f7aadd197f40806cb08ef#file-statemachine-js


The Parser
----------

I'm trying to come up with a declarative description, or at least a more elegant algorithm than the one that is described in the standard. Tree construction is not quite compatible with the standard yet, but I am making good progress. 

One significant difference is that currently, I am not creating elements in the DOM for formatting elelements, but instead I leave them as formatting on and formatting off marks within the tree in tree order. I think that this is a better representation for some of the applications that I have in mind, but I might reconsider. 


License
--------
Mozilla Public License Version 2.0