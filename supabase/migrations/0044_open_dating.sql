-- Open Dating in Person Match (2026-11-19). It was built closed in 0026,
-- waiting on a second steward. Sage opens it now. It keeps everything it
-- was built with: 18+ only, one per person, mutual (you see others only
-- while yours is up), age ranges both ways, Pause, Block, and Report
-- (three reports hide a post until a steward looks).

update post_kinds
set open = true,
    description = 'Find someone to date.'
where name = 'Dating'
  and dictionary_id = (select id from dictionaries where address = 'manifesto-match-ds');
