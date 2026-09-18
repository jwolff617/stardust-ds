-- Core Dictionary seed: the permanent, always-on dictionary. Defines the
-- broad, generic verbs/nouns (real-dictionary style) plus the concrete
-- Domain+Verb executable functions Sage AI can call.
--
-- Convention: a plain word ("Add") is the broad, generic meaning -- the kind
-- you'd find in any dictionary. A "Domain Verb" phrase ("Dictionary Add") is
-- the specific executable function for that domain, and is what gets
-- registered in kind_verbs/dictionary_verbs for Sage AI tool-use.

insert into dictionaries (address, name, kind, is_permanent, is_default_on, status)
values
  ('core', 'Core', 'core', true, true, 'approved'),
  ('stardust', 'Stardust', 'stardust', false, true, 'approved');

-- Broad generic verbs (Core's real-dictionary-style definitions).
-- Dual-sense words (noun+verb, e.g. "a label" / "to label") get one entry
-- covering both senses, same as any standard dictionary would.
insert into terms (name, part_of_speech) values
  ('Add', 'verb'),
  ('Edit', 'verb'),
  ('Delete', 'verb'),
  ('Search', null),
  ('Define', 'verb'),
  ('Turn On', 'verb'),
  ('Turn Off', 'verb'),
  ('Label', null),
  ('Vote', null),
  ('Score', null),
  ('Choose', 'verb'),
  ('Share', null),
  ('Filter', null),
  ('View', null),
  ('Upload', 'verb'),
  ('Approve', 'verb'),
  ('Call', null),
  ('Message', null),
  ('Connect', 'verb');

insert into definitions (term_id, dictionary_id, body)
select t.id, d.id, body
from (values
  ('Add', 'To bring something new into a collection; to increase what exists by one more.'),
  ('Edit', 'To modify something that already exists, changing its content without replacing it.'),
  ('Delete', 'To permanently remove something from where it exists.'),
  ('Search', 'v. To look through a collection for something matching given criteria. n. The act of doing so, or its results.'),
  ('Define', 'To state the meaning of a term; to create or attach a definition to it.'),
  ('Turn On', 'To activate something so it becomes part of active use.'),
  ('Turn Off', 'To deactivate something, removing it from active use without destroying it.'),
  ('Label', 'n. A short tag attached to something to make it findable by that word. v. To attach such a tag.'),
  ('Vote', 'n. An expressed opinion counted toward a collective result. v. To cast one.'),
  ('Score', 'n. A numeric measure of something along some scale. v. To assign or update such a measure.'),
  ('Choose', 'To select one option among several, resolving which one will be used.'),
  ('Share', 'n. Access granted to someone else. v. To grant that access, at a chosen level of visibility.'),
  ('Filter', 'n. A criterion that narrows a set of results. v. To narrow results by such a criterion.'),
  ('View', 'n. A way of looking at something. v. To look at something in a given way.'),
  ('Upload', 'To submit something from outside into a collection, pending it being accepted.'),
  ('Approve', 'To formally accept something as valid, allowing it to take effect.'),
  ('Call', 'n. A live voice connection to someone. v. To initiate one, using their Phone Number.'),
  ('Message', 'n. A piece of communication sent to someone. v. To send it.'),
  ('Connect', 'To form a link between two things or people that did not exist before.')
) as v(name, body)
join terms t on t.name = v.name
join dictionaries d on d.address = 'core';

-- Core nouns.
insert into terms (name, part_of_speech) values
  ('Dictionary', 'noun'),
  ('Term', 'noun'),
  ('Definition', 'noun'),
  ('XYZ Score', 'noun'),
  ('Thumb', 'noun'),
  ('Address', 'noun'),
  ('User Dictionary', 'noun'),
  ('Business Dictionary', 'noun'),
  ('Connection', 'noun'),
  ('Collection', 'noun'),
  ('Console', 'noun'),
  ('Conflict', 'noun'),
  ('Creator', 'noun'),
  ('Admin', 'noun'),
  ('Result', 'noun'),
  ('Phone Number', 'noun'),
  ('Email Address', 'noun');

insert into definitions (term_id, dictionary_id, body)
select t.id, d.id, body
from (values
  ('Dictionary', 'A named collection of terms and their definitions, addressable by a unique name.'),
  ('Term', 'A word or phrase that can be given one or more definitions.'),
  ('Definition', 'One dictionary''s stated meaning for a term.'),
  ('XYZ Score', 'An optional position for a definition on three scales -- Reality, Digital, Spiritual -- each 0 to 100, with (0,0,0) at the center. Most dictionaries never set one; a dictionary that wants terms browsable as points in a meaning-space fills it in for its own definitions.'),
  ('Thumb', 'An up or down vote on a definition, contributing to its net ranking.'),
  ('Address', 'The unique name a dictionary is found and referenced by.'),
  ('User Dictionary', 'The one dictionary automatically created for each person, holding their personal contact information.'),
  ('Business Dictionary', 'A dictionary created for an organization, holding its contact information and owned by a User Dictionary.'),
  ('Connection', 'A formed link between two User Dictionaries.'),
  ('Collection', 'The set of dictionaries a user currently has turned on.'),
  ('Console', 'One of the three panels of the Stardust DS interface: Dictionary Control, View, or Command Bar.'),
  ('Conflict', 'The state of a term having more than one active definition in a user''s collection, requiring Choose.'),
  ('Creator', 'The person or entity who first defined a term or dictionary.'),
  ('Admin', 'A role with authority to approve dictionaries and definitions submitted for public use.'),
  ('Result', 'A single match returned by a search.'),
  ('Phone Number', 'A noun-shape recognized as a sequence of digits reachable for a voice Call.'),
  ('Email Address', 'A noun-shape recognized as a name-at-domain string reachable for a Message.')
) as v(name, body)
join terms t on t.name = v.name
join dictionaries d on d.address = 'core';

-- Domain+Verb executable functions: the Dictionary domain (available on any
-- dictionary, since every dictionary is one).
insert into terms (name, part_of_speech) values
  ('Dictionary Add', 'verb'),
  ('Dictionary Edit', 'verb'),
  ('Dictionary Delete', 'verb'),
  ('Dictionary Search', 'verb'),
  ('Dictionary Define', 'verb'),
  ('Dictionary Turn On', 'verb'),
  ('Dictionary Turn Off', 'verb'),
  ('Dictionary Label', 'verb'),
  ('Dictionary Vote', 'verb'),
  ('Dictionary Score', 'verb'),
  ('Dictionary Choose', 'verb'),
  ('Dictionary Share', 'verb'),
  ('Dictionary Filter', 'verb'),
  ('Dictionary View', 'verb'),
  ('Dictionary Upload', 'verb'),
  ('Dictionary Approve', 'verb'),
  ('Dictionary Call', 'verb');

insert into definitions (term_id, dictionary_id, body)
select t.id, d.id, body
from (values
  ('Dictionary Add', 'Create a new term and definition inside a dictionary.'),
  ('Dictionary Edit', 'Modify an existing definition inside a dictionary.'),
  ('Dictionary Delete', 'Remove a term''s definition from a dictionary.'),
  ('Dictionary Search', 'Find terms or dictionaries matching given criteria, ranked by label match, net Thumbs, text relevance, and XYZ Score match where the dictionary sets one.'),
  ('Dictionary Define', 'Look up and display a term''s active Definition.'),
  ('Dictionary Turn On', 'Add a dictionary to a user''s Collection.'),
  ('Dictionary Turn Off', 'Remove a dictionary from a user''s Collection.'),
  ('Dictionary Label', 'Attach a Label to a definition to make it findable by that word.'),
  ('Dictionary Vote', 'Cast a Thumb up or down on a definition.'),
  ('Dictionary Score', 'Set or update a term''s XYZ Score.'),
  ('Dictionary Choose', 'Resolve a Conflict by selecting which definition of a term stays active.'),
  ('Dictionary Share', 'Grant another user visibility into a dictionary or definition.'),
  ('Dictionary Filter', 'Narrow a set of search Results by a criterion such as label or, where set, XYZ Score range.'),
  ('Dictionary View', 'Display a dictionary or term set in the default Dictionary view, or in that dictionary''s own registered custom View if it has one.'),
  ('Dictionary Upload', 'Submit a new dictionary for Admin approval.'),
  ('Dictionary Approve', 'Formally accept an uploaded dictionary or definition, making it public.'),
  ('Dictionary Call', 'Initiate a Call using the Phone Number found in a dictionary''s definitions.')
) as v(name, body)
join terms t on t.name = v.name
join dictionaries d on d.address = 'core';

-- Domain+Verb executable functions: the User Dictionary domain.
insert into terms (name, part_of_speech) values
  ('User Dictionary Connect', 'verb'),
  ('User Dictionary Message', 'verb'),
  ('User Dictionary Share', 'verb'),
  ('User Dictionary Edit', 'verb'),
  ('User Dictionary Search', 'verb'),
  ('User Dictionary Call', 'verb');

insert into definitions (term_id, dictionary_id, body)
select t.id, d.id, body
from (values
  ('User Dictionary Connect', 'Form a Connection between two people''s User Dictionaries.'),
  ('User Dictionary Message', 'Send a Message to a connected User Dictionary.'),
  ('User Dictionary Share', 'Set a User Dictionary''s visibility: public, connections only, or private.'),
  ('User Dictionary Edit', 'Modify the personal information held in a User Dictionary.'),
  ('User Dictionary Search', 'Find a person by their User Dictionary''s address or labels.'),
  ('User Dictionary Call', 'Initiate a Call using the Phone Number found in a User Dictionary.')
) as v(name, body)
join terms t on t.name = v.name
join dictionaries d on d.address = 'core';

-- Data-driven verb -> required noun-shape mapping.
insert into verb_requirements (verb_term_id, required_noun_term_id)
select verbs.id, nouns.id
from (values
  ('Dictionary Call', 'Phone Number'),
  ('User Dictionary Call', 'Phone Number'),
  ('User Dictionary Message', 'Email Address')
) as v(verb_name, noun_name)
join terms verbs on verbs.name = v.verb_name
join terms nouns on nouns.name = v.noun_name;

-- Which kinds of dictionary expose which executable verbs by default.
insert into kind_verbs (kind, verb_term_id)
select 'core', id from terms where name like 'Dictionary %';

insert into kind_verbs (kind, verb_term_id)
select 'user', id from terms where name like 'User Dictionary %';
