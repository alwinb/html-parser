Html Parser
===========

This is a new HTML5 parser that I am working on.
The focus is on code size, speed and simplicity. 

Standard complience _is_ a goal in the sense that I do intend to produce, for all possible input, a parse tree that is equivalent to the one produced by the algorithm in the HTML5 Standard. 
However, I do not use the same algorithm, nor the same data structures. 

The Lexer
---------
There is a preliminary attempt at a lexical grammar for HTML5 in `notes/`. 

I have painstakingly charted a transition table based on the standard and then used a technique outlined in this [gist][1] to encode the state machine in very few lines. 

The lexer is almost complete, bt a few things still need to be added. Most importantly, character references are not yet tokenised as such. 

[1]: https://gist.github.com/alwinb/d2787f4cde1f7aadd197f40806cb08ef#file-statemachine-js


The Parser
----------

I'm trying to come up with a declarative description, or at least a more elegant algorithm than the one that is descrbed in the standard. This is work in progress; Tree construction is not quite compatible with the standard yet. 
