-- Core dictionary content. Ported from the abandoned prototype's seed
-- (git show ec7d56e:supabase/seed/0001_core.sql) where the words already
-- had good real-dictionary-style definitions -- the schema underneath is
-- new (part_of_speech now lives on definitions, not terms; dual-sense
-- words like "Search"/"Label"/"Share" go to the More tab since a
-- definition can't be both verb and noun in one row).
--
-- A few words are new here, not in the old prototype: Info, Remove, Buy,
-- Sell, Give, Receive -- added because the plan's v1 action scope names
-- them explicitly, even though Buy/Sell/Give/Receive aren't wired to a
-- payment processor yet and Info is the only one bound to a Sage AI tool
-- (info_search) at this stage.

insert into terms (name) values
  ('Add'), ('Edit'), ('Delete'), ('Remove'), ('Search'), ('Define'),
  ('Turn On'), ('Turn Off'), ('Label'), ('Vote'), ('Score'), ('Choose'),
  ('Share'), ('Filter'), ('View'), ('Upload'), ('Approve'), ('Call'),
  ('Message'), ('Connect'), ('Info'), ('Buy'), ('Sell'), ('Give'), ('Receive'),
  ('Dictionary'), ('Term'), ('Definition'), ('Position Score'), ('Address'),
  ('User Dictionary'), ('Business Dictionary'), ('Connection'), ('Collection'),
  ('Console'), ('Conflict'), ('Creator'), ('Admin'), ('Result'),
  ('Phone Number'), ('Email Address'),
  ('Dictionary Add'), ('Dictionary Remove'), ('Dictionary Edit'),
  ('Dictionary Delete'), ('Dictionary Search'), ('Dictionary Define'),
  ('Dictionary Label'), ('Dictionary Vote'), ('Dictionary Score'),
  ('Dictionary Choose'), ('Dictionary Share'), ('Dictionary Filter'),
  ('Dictionary View'), ('Dictionary Upload'), ('Dictionary Approve'),
  ('Dictionary Call'),
  ('User Dictionary Connect'), ('User Dictionary Message'),
  ('User Dictionary Share'), ('User Dictionary Edit'),
  ('User Dictionary Search'), ('User Dictionary Call');

insert into definitions (term_id, dictionary_id, body, part_of_speech)
select t.id, d.id, v.body, v.pos
from (values
  -- Broad, generic, real-dictionary-style verbs.
  ('Add', 'To bring something new into a collection; to increase what exists by one more.', 'verb'),
  ('Edit', 'To modify something that already exists, changing its content without replacing it.', 'verb'),
  ('Delete', 'To permanently remove something from where it exists.', 'verb'),
  ('Remove', 'To take something out of a collection, opting it back off -- the inverse of Add.', 'verb'),
  ('Define', 'To state the meaning of a term; to create or attach a definition to it.', 'verb'),
  ('Turn On', 'To activate something so it becomes part of active use.', 'verb'),
  ('Turn Off', 'To deactivate something, removing it from active use without destroying it.', 'verb'),
  ('Choose', 'To select one option among several, resolving which one will be used.', 'verb'),
  ('Upload', 'To submit something from outside into a collection, pending it being accepted.', 'verb'),
  ('Approve', 'To formally accept something as valid, allowing it to take effect.', 'verb'),
  ('Connect', 'To form a link between two things or people that did not exist before.', 'verb'),
  ('Info', 'To look up and retrieve factual information about a term, dictionary, or topic.', 'verb'),
  ('Buy', 'To acquire something in exchange for payment.', 'verb'),
  ('Sell', 'To offer something in exchange for payment.', 'verb'),
  ('Give', 'To transfer something to someone else at no cost.', 'verb'),
  ('Receive', 'To accept something transferred to you.', 'verb'),

  -- Dual noun/verb senses -- one row, "more" tab.
  ('Search', 'To look through a collection for something matching given criteria; the act of doing so, or its results.', 'more'),
  ('Label', 'A short tag attached to something to make it findable by that word; to attach such a tag.', 'more'),
  ('Vote', 'An expressed opinion counted toward a collective result; to cast one.', 'more'),
  ('Score', 'A numeric measure of something along some scale; to assign or update such a measure.', 'more'),
  ('Share', 'Access granted to someone else; to grant that access, at a chosen level of visibility.', 'more'),
  ('Filter', 'A criterion that narrows a set of results; to narrow results by such a criterion.', 'more'),
  ('View', 'A way of looking at something; to look at something in a given way.', 'more'),
  ('Call', 'A live voice connection to someone; to initiate one, using their Phone Number.', 'more'),
  ('Message', 'A piece of communication sent to someone; to send it.', 'more'),

  -- Nouns.
  ('Dictionary', 'A named collection of terms and their definitions, addressable by a unique name.', 'noun'),
  ('Term', 'A word or phrase that can be given one or more definitions.', 'noun'),
  ('Definition', 'One dictionary''s stated meaning for a term.', 'noun'),
  ('Position Score', 'An optional position for a definition on three scales -- Reality, Digital, Spiritual -- each 0 to 100. Most dictionaries never set one; Stardust is the first to use it, hand-authored per term.', 'noun'),
  ('Address', 'The unique name a dictionary is found and referenced by.', 'noun'),
  ('User Dictionary', 'The personal dictionary automatically available to each person, holding their own private terms.', 'noun'),
  ('Business Dictionary', 'A dictionary created for an organization, holding its vocabulary and contact information.', 'noun'),
  ('Connection', 'A formed link between two people.', 'noun'),
  ('Collection', 'The set of dictionaries a user currently has opted into.', 'noun'),
  ('Console', 'One of Stardust DS''s three interface modules: Dictionary Selection, Word Definition, or Sage AI Command.', 'noun'),
  ('Conflict', 'The state of a term having more than one meaning worth distinguishing across a user''s opted-in dictionaries.', 'noun'),
  ('Creator', 'The person or entity who first defined a term or dictionary.', 'noun'),
  ('Admin', 'A role with authority to approve dictionaries submitted for public use.', 'noun'),
  ('Result', 'A single match returned by a search.', 'noun'),
  ('Phone Number', 'A noun-shape recognized as a sequence of digits reachable for a Call.', 'noun'),
  ('Email Address', 'A noun-shape recognized as a name-at-domain string reachable for a Message.', 'noun'),

  -- Dictionary-domain executable verbs.
  ('Dictionary Add', 'Add a dictionary to your collection, opting into its vocabulary.', 'verb'),
  ('Dictionary Remove', 'Remove a dictionary from your collection, opting out of its vocabulary.', 'verb'),
  ('Dictionary Edit', 'Modify an existing definition inside a dictionary you own.', 'verb'),
  ('Dictionary Delete', 'Remove a term''s definition from a dictionary you own.', 'verb'),
  ('Dictionary Search', 'Find dictionaries or terms matching given criteria.', 'verb'),
  ('Dictionary Define', 'Look up and display a term''s active definition.', 'verb'),
  ('Dictionary Label', 'Attach a label to a definition to make it findable by that word.', 'verb'),
  ('Dictionary Vote', 'Cast a vote up or down on a definition.', 'verb'),
  ('Dictionary Score', 'Set or update a term''s Position Score within a dictionary.', 'verb'),
  ('Dictionary Choose', 'Resolve a conflict by selecting which meaning of a term to use.', 'verb'),
  ('Dictionary Share', 'Grant another user visibility into a dictionary you own.', 'verb'),
  ('Dictionary Filter', 'Narrow a set of search results by a criterion such as label or, where set, Position Score range.', 'verb'),
  ('Dictionary View', 'Display a dictionary or term set in a chosen view.', 'verb'),
  ('Dictionary Upload', 'Submit a new dictionary for admin approval.', 'verb'),
  ('Dictionary Approve', 'Formally accept an uploaded dictionary, making it public.', 'verb'),
  ('Dictionary Call', 'Initiate a Call using a Phone Number found in a dictionary''s definitions.', 'verb'),

  -- User Dictionary-domain executable verbs.
  ('User Dictionary Connect', 'Form a Connection between two people.', 'verb'),
  ('User Dictionary Message', 'Send a Message to a connected person.', 'verb'),
  ('User Dictionary Share', 'Set visibility on your own personal terms: public, connections only, or private.', 'verb'),
  ('User Dictionary Edit', 'Modify your own personal terms.', 'verb'),
  ('User Dictionary Search', 'Find a person by their public terms or labels.', 'verb'),
  ('User Dictionary Call', 'Initiate a Call using a Phone Number found in your own personal terms.', 'verb')
) as v(name, body, pos)
join terms t on t.name = v.name
join dictionaries d on d.address = 'core';
