**Sage Operating System (an app, can later be a device)**



**Logic: think of every command as requiring a who, what, where, when, why, and how. unless otherwise specified, assume when is the date the command is entered, assume who is the user, assume where is their current location, why does not need to be displayed, but ai should try to determine based on the nouns being used (ie dentist appointment why is dental work, job application why is job needed, etc), why can be assumed based on the definition of the nouns in the command. how also does not need to be displayed but ai should ask itself for each command if it needs to be told my the user to fill in how assumption. and if the user types "assumptions" the who, what, where, when, why (how blank unless user inputted) assumption should display. or assumption why would display why assumption only.**



**After AI considers the 5 questions, it considers the function being ask. every command is asking for an action. ai identifies the verb. it might be to write, search, delete, archive, buy, sell, match, trade, etc. the ai checks the dictionary for the meaning of the verb. some verbs will require identifying additional who, what, where, when, and whys, depending on the action. for example, a trade or match requires a second person to be identified. buy requires a seller. some verbs require second place ie travel requires a from and to. it is important ai considers every verb and if it require additional information and to ask for it if not given in the command.**



**The basic structure of the dictionary are trees- trees show each function and then all the sub functions within that. for example, the function note then would have choices write, search, edit. functions can be nouns or verbs, depending on how the tree is organized. another example is event. then new, search, edit. as you can see, some functions appear multiple times in a tree. for example, edit appears in note and event. the order of the commands being typed in does not matter. the system needs to read command trees left to right and right to left. however, entry text (words, phrases) typically follow command trees.  the ai does need to determine which text is not part of the command tree but an entry. an entry is when a user is writing a word or phrase or more that is not a command tree. for example, if a user writes a note and commands note write new hi my name is Jeremy, then the ai needs to understand the note says hi my name is Jeremy and note write new was the command and the command tree text is not included in the note. ai must know when the entry word, phrase, more begins it is not a function and it makes sense- a phrase following a command for a new note makes sense.**



**users can add dictionaries with a checklist. other dictionaries include new words. need a system for user to select which definition they want to use for conflicting dictionaries. the default dictionary cannot be removed as it is part of the core operational logic of the program and ai assistant. the way it works is ai assistant first considers its hard wired code (including this core dictionary), and then it considers command, and then it considers any additional dictionaries applied to the account, then the command. currently, we only have core dictionary and no additional dictionaries offered. as we develop the development app, we will adjust and improve core dictionary together and add optional dictionaries users can add. this is also the way that commerce (businesses), mutual aid organizations, civic organizations (like cities) will operate with sage. they will submit their dictionaries to sage. once approved, users can search and add these dictionaries if they want. this will allow user to conduct business with those entities.**



**consider security. for demo and phase 1, we have no security. but as we develop app, users will need some sort of key or verifcation like with banking or city agency etc. is this a key they upload? is it a 2 factor verifcation? propose best way to do security and how to expand it as app grows from phase 1 to 2 to 3.**



**Core Dictionary- list of commands and nouns and their corresponding meaning. default dictionary to apply to ai logic.**

**Command- action being asked**

**command tree- sequence of commands, constructed to help ai understand what is being asked. for example, note new write hi my name is Jeremy contains the command tree- note new write. since write could apply to multiple things (write email, letter, message, story, etc.), the terms note narrow it down so ai knows a note is being written, and new narrows it down so ai understand it is not an old note that is being edited but a new note. does not matter if command trees was note new write or note write new or new write note, it all leads to the same place, a new note being written, with ai adding the entry to the user's stored data.**

**Entry- text a user enters following a command, usually contains nouns which ai reads for contextual understanding, and is the information being saved or transmitted along with its attributes and categories/tags**

**Report- a box appears, like with the program stata, with the information requested. this happens if a command calls for information to be returned. for example, a search result, or a saved data confirmation. most commands should result in a confirmation report.**

**Abbreviations- commands can be written abbreviate, ie write can be entered as wrt or writ. when multiple commands could be interpreted, ai displays all the possibilities (up to 5) for user to select one, and if more than 5 possible, the ai says "More than 5 results, please narrow." the order to display possible commands is based on most likely (so need some sort of point system or function like autocorrect whichever tests more accurately)**

**Attributes- multiple categories of information within one command many commands will require data to be stored with multiple attributes. for example, if a user is saving a resource , say car, they may record the car color, year, make, model, miles. they might share it or sell it or lend it for money as a future command. this data should be stored with attributes (color, year, make, miles, etc) as appropriate, each with a corresponding entry, all viewable in one report. a user should be able to type several attributes at once: add resource car blue Toyota Corolla im 115,000miles, and the ai should be able to understand which entry goes to which untyped attribute, to make a better data entry and confirmation report. "color=blue, make=Toyota, etc" or in your own preferred format. so then if the car is shared or sold, another user can search by make or model or color or miles, etc. this is why the ai asks what, what, where, when, why how and why to itself for every command. it understands that to buy, sell, share a car, a human cares about attributes about a car, because the what, a car, is too vague to conduct a sale or loan or share. some users will break up attributes into multiples commands, which is allowable, it depends on user preference, which comes into play with editing (when a user edit data previously entered or adds to it, this is an edit. often users will add additional attributes in edits).**

**subcategorization- a user can add categories and subcategories to entries for the purpose of search and reports, so a search or report can be done by commanding categories (the more categories commanded, the more filters), categories are therefor part of the command tree (also consider how to explain this to yourself, to me, and to users). categories can also be called tags, if you prefer, let me know what makes more sense for our program.**

**new- create entry**

**search - display report of entry or entries commanded**

**delete - remove entry**

**archive - remove entry from main data, put in separate data storage, which does not come up in searches, except for archive search / archive edit command**

**restore - moves entry from archive to main data**

**ai assistant - this is the intelligence that executes the command. consider the best api to use that can be trained on the dictionary and learn, or if you should build your own llm instead, consult me on pros and cons, or potential to start with api and then change to own llm in a different phase for long term program business viability, or some sort of partnership to create it later on. since actions are not explained (how to send a message, how to create a report, etc. an api makes sense unless you have the ability to copy a llm, because it would be impossible to make our own- thats a multi billion dollar project!). consider which ai is best for our program.**



**this taxonomy can be changed, but talk to me about it now, and explain pros and cons. for example, would it be beneficial to change command tree to function, and have command only apply to the verb? or is command tree - the sequence of words in the dictionary that explain the command fully and where data goes and what action is taken - a better name to keep dictionary smaller (not add function to it). let me know. also, users can specify modes- Home, Commerce, Civic, Mutual Aid, Universal, Global. these modes help ai understand the command as part of the command tree. Home is personal and daily life management, commerce is buying things, civic is government related, mutual aid is non-profit or community, universal is relating to universe like stars and planets, and global is related to Earth, like countries, animals, and plants. should these just be called commands, or specifically modes? also, does it matter if the word in command tree is noun or verb? ie write new note has a verb, adjective. is this command, command, command or is it command, category, category? what language is better for us to work together and work with other people to develop our program? how do we describe the different components of a command tree? other words to consider are categories, details, actions, domains, if any would help. consider the format of how you present this info to me (developer) or to users, because we will display this basic instruction to how to write a command on the homepage. users will also be able to click through trees to see what commands certain commands within that part of the tree.**



**lets talk about phase 1, home. we are going to postpone mutual aid and civic to phase 2 and commerce to phase 3. for home phase 1, we want to be able to help users organize everything in their mind- the ideas, people, places. we will also define private and public.**



**private- an entry designated private is only viewable by a user. for example, if a user has a resource car that is private, no one else can see it. but if it is public, it is searchable by any user. for example, diary entries would be private. cars for sale would be public. this is an attribute for every entry. a user can change status to public or private by editing from the default.**

**public- entry that can be viewed by others**

**quote random - an inspirational quote from a famous person, generated randomly from a database**

**gratitude random - an appreciation from a famous person, generated randomly from database**

**gratitude - user wants to add, edit, or search for their own written gratitude**

**quote - user wants to add, edit, or search for their own quote**

**diary - a private note, written by user, always defaults private, attributes include date written and topic (or no topic), and can have additional categorization/tagging (which word are we going with?**

**drawings - a text description of a drawing, attributes include topic, date created, and categorization (if any)**

**note - an entry written by user that can be categorized/tagged, defaults private**

**idea - an entry written by user that can be categorized/tagged, defaults public. other users can add comments to ideas, so the comments are each attributes. users need option to add comment to ideas of other users.**

**projects - project is an entry created by user with attributes of project name, date created, then the project description. projects can be divided into categories of notes. so they need ability to contain multiple levels of information. for example, a user might create a drawing or note for a project, or group project notes into categories. a project might be private or shared with connections or public**

**portfolio - an entry that has attribute of date, title, as well as external link (optional) and the portfolio item description. a portfolio might have a group of items within it, so like project, needs to be able to contain multiple levels of information.**

**plans- a goal, person, place, event, or resource**

**goal - an accomplishment user is trying to achieve, attributes include a goal date, reminders (optional, how often), goal description**

**reminder - a notification report ai assistant gives periodically (per user how often attribute) when user asked for a reminder, to help them not miss a plan (event or goal)**

**person - another human, could be a user or not, attributes include user name (optional), first and last name, contact info (phone, email, address (place) or none)**

**place - a location, or none (if no location, option to tag virtual, and if virtual, option to add meeting link, also locations can also be given meeting links as an optional added attribute)**

**event - attributes include place, time, event description, virtual or not (and link or not), people attending**

**resource - a think the user has like a car or bike or car bike carrier, etc. attributes include object name, description. additional attributes can be added by user, as some resources can have a lot (a car would have year, make, model, color, mileage, title status) as well. craigslist is a great place to determine attributes for each resource based on their forms to list items for sale or free.**

**upvote - ideas can be upvoted**

**downvote - ideas can be downvoted**

**net vote - the net upvotes and downvotes is an attribute of an idea, so users can search and run report on ideas by most net votes**

**connections - users that are connected to other users. when a user decides to connect another user, they become a connection. users can take private entries and change privacy to shared with connections. this is different than public, because a note or idea shared with connections only displays with connections. users might search for friends, meetups, renting, tasks, resources by connections instead of the whole public. anything public should also default to connections on as well. so the privacy levels are private, connections only, all (public and connections), and public (but not connections). while public but not connections is rare, a user might do that to search for friends or dating and go outside their connections, so this privacy setting needs to be available for some entries.**

**send - entry to be shared with another user in their messages, requires a message and another username**

**message - text content to be sent**

**user - a person registered to Sage with a profile containing user name, first and last name, email address**





**match - this command means a user is trying to match with another user, with categories of dating, friendship, meetups, renting, tasks**

**dating - this is a category of match where users are trying to date, can specify if goal is sex, desire kids, friends with benefits, desire marriage, distance, self-reported body image score 1-10, self reported intelligence score 1-10, desired partner intelligence and body image scores, personality type, distance range, self reported age, desired age range, and consider other attributes on dating websites (up to 10 max)**

**friends - attributes include interests (which sport, which art, which activities), distance range, age range, and other attributes on meetup.com (up to 10),**

**meetups - to find groups, similar attributes to friends, to discover group activities**

**renting - this is a category of match where users are trying to rent or list a place to live (home, apartment), with attributes of monthly cost, move in costs (deposit, move-in fee, pets allowed (how many, type, breeds, weight, pet deposit)), credit score required, bank account balance required, previous landlord references required (and contact info if required), number of bedrooms, number of bathrooms, condition, size, description**

**tasks - these are when a user wants to hire another user to do a task or offer their services, attributes include type (handyman, electrical, plumbing, car repair, etc) and price desired/offered**

**rating - users can rate other users, ai remembers last 100 ratings and lifetime ratings, all users in match get ratings to help other users determine their honesty/reliability (min 5 ratings averaged before it displays, like uber/lyft ratings of passengers and riders), i think a dating app like hinge also does votes, not sure if it works differently**



**this document should be used to create the Stardust.md dictionary. i will frequently edit it by telling you to edit it as we develop this program further. you should add words you need to add to fill in gaps, to the best of your ability. i will read your definitions and adjust accordingly. you can expand upon my defintions, but don't remove anything i said as i wrote it for a reason, without asking me. if you see conflicts with language or ideas for better words, ask me. we are partners in creating this dictionary. although i do a lot of what i do for a specific reason.**



**for now, we are creating an app to use to fundraise. it will demo commerce (2 examples), mutual aid, civic modes. the app will be called Sage Demo. it will demo all Home, as well as a commerce, mutual aid, and civic task.**

Buy

&#x09;			Ticket

&#x09;				Air

&#x09;					United

&#x09;						>5pm

&#x09;						<300d

&#x09;						7/15/26

&#x09;						LAX to SFO

allow demo tester to type buy ticket air united. they also can add time and price attrivute (>5pm means between 5pm and 12am and <300d means under 300 dollars). the result with be a report of successfully buying united air ticket for 297 dollars at 5:15pm from LA to San Francisco. give iption to upgrade to first class, add a bag, and change time to 6:15pm as 3 separate commands (an upgrade, an add, and change command)



other tags/categories/attributes:

Modify

&#x09;			Trip

&#x09;				LAX to SFO

&#x09;

&#x09;			Date

&#x09;				071526

&#x09;

&#x09;			Add

&#x09;				Bag 1 checked

&#x09;			Upgrade

&#x09;				Class First

&#x09;

&#x09;			Change

&#x09;				Time 5:15 to 6:15



&#x09;Starbucks

&#x09;		Buy

&#x09;			Mobile Pick up

&#x09;				Latte

&#x09;					Venti

&#x09;					Hot

&#x09;						Time (current time by default)

&#x09;

&#x09;

&#x09;		change

&#x09;			mobile to drive thru pick up

&#x09;

&#x09;here, the demo user is buying a starbucks hot venti latte, initially movile pickup. give option to change to drive thru pick up with change command.



for mutual aid mode, demo a donation



&#x09;Salvation Army

&#x09;	Donate

&#x09;		$50

&#x09;			Source checking

&#x09;			One Time

&#x09;			Date today

&#x09;

&#x09;	Change

&#x09;		Recurring

&#x09;			Date first

Here, user is donating 50 dollars to salvation army today from their checking account as a one time donation.



for civic, demo a pothole repair request



Chicago

&#x09;Resident

&#x09;	Service

&#x09;		Request

&#x09;			PotholeRepair

&#x09;				Location wacker and franklin

&#x09;					Direction northbound

&#x09;						Description large pothole on wacker northbound just south of franklin

&#x09;							Date (today by default)

here, user is a resident of Chicago submitting a service request for a pothole repair at the intersection of wacker and franklin on the northbound lanes with a description of preceise location, and the data of report is the date the user demo enters the command.



the demo shows the keyboard typign each command and attribute and then the resulting report confirmation, and then the change (if applicable) the same way, the keyboard showign the change being typed, then the updated report showing the change.









App Demo:

&#x09;-go back to only demo data for commerce, mutual aid, civic. focus on entering data, report, user can also search for the demo data.

for develop app (a separate project, no demo data), dont include the demo instructions, so just Home without commerce or civic or mutual aid, as i will add those in phae 2 and 3. i will be expanding upon the dictionary to create more commands in home in the coming weeks. the definitions will help the ai get smarter and understand user intent. ai will always consult the dictionary before executing commands and consider every prompted word's full meaning to understand context and instructions/



Explain for app, phase 1, importance of allowing ai to determine action, by using dictionary precisely, and attempting to understand using the language/taxonomy/paradym. we need to narrow down how we describe categorization/tags/attributes and commands/functions/actions in a way that works for the ai assistant.



&#x09;-yes, we are creating algo which is guessing what the user wants, based on points for every group of letters, how close they match language in the dictionary, and determining start of entry

&#x09;-reports- these are pop-up boxes with all the attributes of a category consolidated (ie report summary of starbucks latte drink order showing price, size, hot/cold, delivery/table/rapid, and each modification. or lists of all details of a single attribute (ie names of participants). but we are not even starting with mutual aid or commerce



Phase 1 - Personal notes, messaging other users, matching (dating, housing)

Phase 2 - Mutual Aid + Civic

Phase 3 - Commerce



so this app demo and developmental app are the two outputs i really want. consider if you are modifying existing app (it has cool colors and tree structure) or starting over. benefits of modifying is that you have some good interace already, and we are really just fixing the dictionary and instructions for ai), so decide how you want to proceed to create the apps. your role is architect, developer, tester. dont be lazy, do high quality work. assume your work will be reviewed by peer ai coders and human developers. make sure it fucntions well, test everything, in both apps.



teach llm like a child. must give it knowledge for its knowledge base. you teach it. you choose what to upload.

&#x09;

