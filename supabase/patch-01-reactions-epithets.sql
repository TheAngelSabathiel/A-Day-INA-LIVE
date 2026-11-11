-- =====================================================================
-- A Day INA: LIVE  |  Patch 01
-- Run this ONCE if you already ran schema.sql before this update.
-- (New projects: just run schema.sql, it already includes this.)
--
-- 1. Audience reactions (love, haha, wow, sad + flowers)
-- 2. Script epithets on cast and name strips
-- 3. Removes the Basilio text message cue and the cue after it
-- =====================================================================

-- 1. Reactions --------------------------------------------------------
alter table cues add column if not exists reactions boolean not null default false;

alter table reactions drop constraint if exists reactions_kind_check;
alter table reactions add constraint reactions_kind_check
  check (kind in ('flower','heart','haha','wow','sad'));

drop policy if exists "react while open" on reactions;
create policy "react while open" on reactions for insert to anon, authenticated
with check (
  exists (
    select 1
    from show_state s
    join cues c on c.id = s.current_cue_id
    where s.id = 1
      and s.performance_id is not distinct from reactions.performance_id
      and (c.flowers or c.reactions)
  )
);

update cues set reactions = true
where label in ('Opening theme', 'Intro: Juicy', 'Intro: Andy', 'Intro: Tonton',
                'Intro: Georgie + flowers', 'Intro: Direk Jona', 'Show logo', 'Round 1 result: WALA!');

update cues set phone_body = 'Mag-react habang pinapakilala ang mga INA.'
where label in ('Intro: Juicy', 'Intro: Andy', 'Intro: Tonton', 'Intro: Direk Jona');

-- 2. Script epithets ----------------------------------------------------
update cues set subtitle = 'Mother-tucking host, artisTANG INA'                     where label = 'Intro: Juicy';
update cues set subtitle = 'INAatupag ang beautiful makeup · Mom of two dogs'        where label = 'Intro: Andy';
update cues set subtitle = 'Mother INAnother universe · Macho gwapito borTANG INA'   where label = 'Intro: Tonton';
update cues set subtitle = 'PA probinsyana · Mother of two and a proud single mom'   where label = 'Intro: Georgie + flowers';
update cues set subtitle = 'Ang INA nating lahat'                                    where label = 'Intro: Direk Jona';

update cast_members set role_label = 'Mother-tucking host, artisTANG INA',
  bio = 'Good mornight, mga Mother Tuckers! Ito ang paborito ninyong INA-abangan tuwing madaling araw.'
where character_name = 'Juicy';
update cast_members set role_label = 'INAatupag ang beautiful makeup · Mom of two dogs',
  bio = 'Mom of two dogs, pero mahilig din sa hotdogs. Flavor today: Strawberry ice cream.'
where character_name = 'Andy';
update cast_members set role_label = 'Mother INAnother universe · Macho gwapito borTANG INA',
  bio = 'Welcome to me. Your favorite cameraman. Flavor today: Matcha.'
where character_name = 'Tonton';
update cast_members set role_label = 'PA probinsyana · Mother of two and a proud single mom',
  bio = 'Isa sa pinakamasipag na nakilala ni Juicy. Literal na INA.'
where character_name = 'Georgie';
update cast_members set role_label = 'Ang INA nating lahat',
  bio = 'Ang INA ng A Day INA: LIVE. Mula sa mga ina, para sa mga ina.'
where character_name = 'Jona';

-- 3. Remove the text message cue ----------------------------------------
delete from cues where label in ('Basilio text', 'Back to the game');
