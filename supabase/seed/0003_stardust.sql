-- Stardust dictionary content. Ported wholesale from the abandoned
-- prototype's seed (git show ec7d56e:supabase/seed/0002_stardust.sql),
-- itself sourced from STARDUST_Dictionary_First_Edition.md -- all 50 terms,
-- bodies, and Reality/Digital/Spiritual position scores carried over
-- as-is. Only the schema changed: part_of_speech now lives on the
-- definition, and "xyz_x/y/z" is renamed to "position_x/y/z" to match the
-- new opt-in-per-definition column.

insert into terms (name) values
  ('Earth'), ('Stardust'), ('Spark'), ('Drift'), ('Soul'), ('Innocence'),
  ('Experience'), ('Confidence'), ('Passion'), ('Body'), ('Thinking'),
  ('Arousal'), ('Fear of Death'), ('Fear of Pain'), ('Loss'), ('Society'),
  ('Shame'), ('The Matrix'), ('Repulsion'), ('Tension'), ('War'),
  ('Attraction'), ('Forgiveness'), ('Collision'), ('Love'), ('Relax'),
  ('Peace'), ('Longing'), ('Cosmos'), ('Permission'), ('Witness'),
  ('Dream'), ('The Star'), ('Orgasm'), ('Feelings'), ('Emotions'),
  ('Energy'), ('Yes'), ('Identity'), ('Stories'), ('Memory'), ('Zombie'),
  ('Inevitable'), ('Evolution'), ('Fear of Insignificance'), ('Cool'),
  ('Forgiveness Family'), ('River'), ('Trans'), ('Spirit Rest'),
  ('Spirit Hunger');

insert into definitions (term_id, dictionary_id, body, part_of_speech, position_x, position_y, position_z)
select t.id, d.id, v.body, v.pos, v.x, v.y, v.z
from (values
  ('Earth', 'Our mother. A beating heart and heavenly body. We evolved from microbes to plants to animals to humans. We adapt. We are one with Earth. Humans age in Earth Time, not Life Time -- the difference in age between any two humans is miniscule.', 'noun', 95, 20, 70),
  ('Stardust', 'The material everything is made from. Every atom in your body was forged inside a star. Before your name. Before your parents. Before Earth. Before the first story ever told. The calcium in your bones, the iron in your blood, the oxygen in your lungs -- all of it was born inside stars. You are stardust. Not metaphorically. Literally.', 'noun', 60, 15, 90),
  ('Spark', 'The life energy inside you -- brightness emitting from a cluster of stardust, brighter the closer that stardust gathers. Felt as warmth or pressure, especially in the lower back and chest. It hums. It glows. It waits. The same current that moves through every living thing.', 'noun', 70, 10, 85),
  ('Drift', 'The pieces scattering. Attention, body, desire, mind, and soul pulling away from center. Every human drifts -- toward screens, toward routines, toward what society says should matter. The healthiest moments occur when body and soul meet in the same place.', 'more', 40, 60, 20),
  ('Soul', 'The part of you that gives the body''s experiences meaning -- a spark''s unique vibration frequency, Earth experiencing itself through its extended life forms. The soul is where grief lives after the body has stopped crying. Where love lives after the person has left the room. What makes your spark different from every other spark that has ever existed.', 'noun', 20, 5, 98),
  ('Innocence', 'Being yourself. Not naivety -- courage. Innocence is lost when someone else takes control of you. You can take it back.', 'noun', 55, 10, 80),
  ('Experience', 'A soul interacting with the stardust around it. A feeling begins in the body. The mind notices it. The soul gives it meaning. That is how a feeling becomes an experience.', 'noun', 75, 20, 70),
  ('Confidence', 'Moving toward life without fear of death, pain, or shame. You have it in you. It is in there. The spark.', 'noun', 80, 15, 65),
  ('Passion', 'The feeling of electricity moving freely through you. No block. No resistance. No pretending. Passion doesn''t care if it makes money. It is your spark telling you: This is real. This is me.', 'noun', 85, 10, 80),
  ('Body', 'The physical instrument of your spark. You don''t "have" a body -- you''re wearing one. Sight, touch, sound, smell, taste -- how the spark experiences the physical world.', 'noun', 100, 15, 40),
  ('Thinking', 'The mind''s work. The translator between body and soul. Narrates instinct. Turns energy into language. The body knows before the mind catches up.', 'noun', 30, 85, 25),
  ('Arousal', 'The body''s signal that it is ready to connect. Not just sexual -- arousal is any state where the body leans toward something. Cannot be forced. Can only be invited.', 'noun', 90, 10, 55),
  ('Fear of Death', 'The body forgetting it is wearing a rental. The spark doesn''t end when the body does. Accept this and you can finally inhabit the body fully. Stop bracing. Arrive.', 'noun', 60, 10, 75),
  ('Fear of Pain', 'The body''s alarm. A signal, not a punishment. Go into the pain, not away from it. At the extreme, pain flips.', 'noun', 70, 10, 50),
  ('Loss', 'Love we can''t give. The spark flickering when connection is blocked or broken. The gap that couldn''t close. The ache in your chest when someone is gone is love with nowhere to go.', 'noun', 40, 10, 80),
  ('Society', 'A cluster of sparks organized by rules. Social organization in pursuit of How Management. A tool for connection that too often becomes a machine for drift.', 'noun', 50, 80, 30),
  ('Shame', 'Society telling you your body is wrong. Starts with toilet training. Never stops. Ten thousand small lessons: Your body is gross. Your urges are wrong. Control is moral. Release is sin. Noise, not truth.', 'noun', 45, 70, 20),
  ('The Matrix', 'Society''s agreed-upon fiction. The rules and taboos that suppress what you really are. It keeps people asleep. Seeing it is the first step to finding yourself.', 'noun', 25, 90, 15),
  ('Repulsion', 'The force that holds sparks apart. Disgust, shame, and fear. Disgust and attraction run on the same current. The repulsion was always pointing at the pull.', 'noun', 60, 15, 45),
  ('Tension', 'The unresolved space between two sparks. Stored energy. The bigger the gap, the more fuel for the resolution. Cold is sparks too far apart. Fire is sparks close enough to ignite.', 'noun', 65, 20, 55),
  ('War', 'What happens when the gap between two sparks gets filled with weapons instead of forgiveness. Every war starts the same: fear, shame, and a gap too wide to close any other way.', 'noun', 70, 60, 5),
  ('Attraction', 'Biology working through you. Your body scans everyone, all the time. The body reads genes. The soul reads light. Attraction is memory plus prediction.', 'noun', 85, 20, 65),
  ('Forgiveness', 'The most powerful magnetic force. Lives inside the gap and pulls both sparks in simultaneously. Forgiveness does not balance the score. It cancels the game.', 'noun', 40, 10, 95),
  ('Collision', 'Two sparks making contact. When two orbits overlap, the center doesn''t add -- it multiplies. Something ignites that neither person could generate alone.', 'noun', 75, 15, 70),
  ('Love', 'Two sparks moving toward each other. Not a feeling that arrives. A direction. A movement toward. It does not require the destination to be reached. It only requires the turning.', 'noun', 60, 10, 100),
  ('Relax', 'Releasing tension from the body. Muscles loosening. The Star is not a place you understand. It is a place you arrive.', 'verb', 65, 10, 60),
  ('Peace', 'The golden glow of total harmony. Body and soul fully alive at the same moment. Not absence of motion -- the right balance of it.', 'noun', 50, 10, 95),
  ('Longing', 'The spirit''s version of desire. The ache toward something you cannot name. A piece of music that almost remembers something for you. A light on water at the exact wrong time of day. The feeling of almost. The feeling of not quite.', 'noun', 35, 10, 85),
  ('Cosmos', 'Frequencies approaching near perfect alignment. At the Star, the whole spectrum disappears. Bodies strip away. Thinking strips away. Left with pure beautiful energy. That is the orgasm -- not just physical release, but the full arrival.', 'noun', 30, 15, 100),
  ('Permission', 'The mental acceptance needed to unlock safe, real connection. You cannot steal the cosmos. You can only be invited in.', 'noun', 45, 40, 60),
  ('Witness', 'Someone holding space for you without judgment. Validates that you did nothing wrong. Can be yourself.', 'noun', 55, 15, 75),
  ('Dream', 'Where sparks play when the body rests. The spark goes to finish its thinking. Unblocked by society, by shame, by logic. There is no morality in dream-space. Sparks either fit, or they don''t. Both are holy.', 'noun', 20, 15, 90),
  ('The Star', 'The middle. Body and soul fully alive simultaneously. Bright because nothing is missing. Not the midpoint -- the maximum of both at once.', 'noun', 50, 10, 100),
  ('Orgasm', 'The full arrival. Not just physical release -- the moment when body and soul align completely. You glow. You love everyone. You feel lighter. Physically, you are.', 'noun', 95, 10, 85),
  ('Feelings', 'What the body reports before the mind touches it. Feelings are pre-language. They exist before you name them. Slow down. Feel the feeling before you decide what it means.', 'noun', 70, 5, 70),
  ('Emotions', 'Feelings that the mind has named. Fear, joy, grief, longing, rage, tenderness. The mind''s name for a feeling can be wrong. Check the feeling first.', 'noun', 55, 40, 60),
  ('Energy', 'The fundamental force flowing through your body, expressed in movement, emotion, and connection. The invisible current powering all life.', 'noun', 75, 20, 75),
  ('Yes', 'The whole body unlocking at once. Not a word -- a state. The nervous system giving full permission. You feel yes before you say it.', 'more', 80, 10, 70),
  ('Identity', 'Who you are when no one is watching.', 'noun', 50, 30, 70),
  ('Stories', 'The technology humans invented to pass truth between sparks. Biology is stories. Your DNA is a story. Your heartbeat is a story. Your hunger is a story.', 'noun', 40, 70, 55),
  ('Memory', 'Where the spark stores everything it has ever felt. The body forgets. The spark doesn''t. Attraction is memory plus prediction.', 'noun', 45, 50, 70),
  ('Zombie', 'Someone who forgot their spark. Routine, screen, transaction, repeat. Not evil. Just asleep. You can wake up any time.', 'noun', 60, 70, 5),
  ('Inevitable', 'You. You are inevitable. Build on it.', 'more', 55, 25, 70),
  ('Evolution', 'The spark''s long game. Good genes feel. Good genes close gaps. The spark and evolution want the same thing -- more life, brighter, longer, closer to center.', 'noun', 65, 45, 55),
  ('Fear of Insignificance', 'The terror that you were here and it meant nothing. That no one felt your presence. The gap between you and the world was never crossed. Its correction is connection -- others, love, giving back.', 'noun', 45, 25, 55),
  ('Cool', 'The desire to get closer. The animal signal that says: this person has something worth moving toward. Being comfortable with yourself is what cool looks like from the outside.', 'more', 60, 35, 45),
  ('Forgiveness Family', 'A family that chooses to accept all, forgive all, so they can love all. Easy to recognize -- they smile, life is easy and peaceful, their relationships glow.', 'noun', 55, 15, 90),
  ('River', 'If our lives are rivers, the water force is out of our control. We can still control the shape of the path. The Star is where the river runs clearest.', 'noun', 70, 15, 65),
  ('Trans', 'Complete empathy. The ability to feel what another person''s body wants and give it to them. Understanding empathy in the body at its fullest.', 'noun', 50, 10, 95),
  ('Spirit Rest', 'The spirit needs silence the way the body needs sleep. Not emptiness -- presence without agenda. A walk with no destination. A room with no screen. The spirit consolidates in silence the way the body consolidates in sleep.', 'noun', 35, 5, 95),
  ('Spirit Hunger', 'The body gets hungry and tells you with discomfort. The spirit gets hungry and tells you with restlessness. Not anxiety -- anxiety circles. Restlessness scans. Ask what it is actually hungry for. It usually knows.', 'noun', 45, 10, 80)
) as v(name, body, pos, x, y, z)
join terms t on t.name = v.name
join dictionaries d on d.address = 'stardust';
