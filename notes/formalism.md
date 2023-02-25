Formalism
=========

The formalism that I'm slowly converging on is similar to that of a DFA, where a set 
of 'valid' strings is specified via a transition function delta: State × Char → State, (together with a function accepts: State → Bool).


## Actions

- action: State × Token → Action

Note that a given State s then corresponds to a function 

- action<sub>s</sub>: Token → Action. 

In my implementation I am using a finite number of equivalene classes of tokens. By assigning each class a unique natural number as identifier, it becomes possible to represent the actions for a state action<sub>s</sub> a finite list of actions.

An Action may be any of the following:

### Start-Tags

- ✅ Accept: Insert an element for the start tag and move into it.

- 🈲 Ignore the start tag.

- ▶️ Extend: Create and move into a new child node (with different tagName) and
    let the child node handle the start tag. The schema is assumed to be such 
    that the start tag is eventually accepted.

- ⏫ Escalate: Try closing elements until a node is found that can handle it - and
    let it do so. If no such node can be found then ignore the tag _and don't close
    anything_.

- ⤴️ Trap: Insert an element for the tag, but insert it in some other place, where
    'the other place' is determied by another mechanism. This provides an escape
    hatch, a way to break out of the foralism and handle exceptional behaviour.

Here the phrase "A node can handle a start-tag" means that the node would itself 
explicitly accept the start-tag (✅), or it would trigger an extend (▶️) or a trap (⤴️).

### End-Tags

- 🈲 Ignore the end tag.

- ⏫ Escalate: Try closing «zero or more» elements until a node is found that 
    ignores, or matches it. If a matching node is found, close it and commit. 
    If no matching node is found found then ignore the end tag _and don't close
    anything_.

Here the phrase "a node matches an end-tag" means that its tag name is the same as the end-tag's tag-name.

### Text and Comments

Text nodes and other tokens alike; doctypes, comments, void elements, raw-text and rc-data nodes are handled just like start-tags; They can however not have child nodes, and thus, after being accepted 'and moved into it' you'd proceed by immediately moving out of them. 


## Modifiers

> No I'm only using modifiers for open tags,

I am using a child, and a sibling function, as is common in tree automata 
formalisms, but with a catch: they return a (state-) Modifier, rather than a State:

- child:   State × Token → Modifier
- sibling: State × Token → Modifier

A Modifier can be split up in two parts / two tables: One that declares and/or 
modifies the handling of end-tags, and that does so for the start-tags (and in my 
model, comments and text-nodes alike as well).

### Start-Tags

The other table specifies how to handle open tags; this is essentially a table: _OpenTag -> Behaviour_, where Behaviour is one of ... seven (phew) behaviours:

- ⬜️ Insert-or-Ignore: Insert an element for the tag here if it would also be 
    accepted in the parent-node, otherwise Ignore.

- ⇧ Insert-or-Escalate: Insert an  element for the tag here  if it would be
    accepted in the parent node. Otherwise Escalate-or-Ignore.
