-- =====================================================================
-- A Day INA: LIVE  |  Patch 02  (new script, Nov 27)
-- Run this ONCE on your existing Supabase project (SQL Editor > Run).
-- New projects: run schema.sql instead, it already includes this.
--
-- 1. Audience comments (+ SM mute and hide)
-- 2. Manual votes from Control (vote_boosts); tally = real + manual
-- 3. 5 emojis (adds angry) + flowers, screen effects (flicker / heavy glitch)
-- 4. Replaces ALL cues with the new script's cue list
--    (votes, flowers and comments already saved are kept)
-- =====================================================================

-- ---------- v2: audience comments, manual votes, screen effects ----------
alter table cues add column if not exists reactions boolean not null default false;
alter table cues add column if not exists comments  boolean not null default false;
alter table cues add column if not exists chat_ramp boolean not null default false;
alter table cues add column if not exists fx        text    not null default 'none';
alter table show_state add column if not exists comments_muted boolean not null default false;

-- Five emojis + flowers
alter table reactions drop constraint if exists reactions_kind_check;
alter table reactions add constraint reactions_kind_check
  check (kind in ('flower','heart','haha','wow','sad','angry'));

drop policy if exists "react while open" on reactions;
create policy "react while open" on reactions for insert to anon, authenticated
with check (
  exists (
    select 1
    from show_state s
    join cues c on c.id = s.current_cue_id
    where s.id = 1
      and s.performance_id is not distinct from reactions.performance_id
      and coalesce(s.override, '') <> 'black'
      and ((c.flowers and reactions.kind = 'flower') or (c.reactions and reactions.kind <> 'flower'))
  )
);

-- Audience comments
create table if not exists comments (
  id             bigint generated always as identity primary key,
  performance_id uuid references performances(id) on delete cascade,
  handle         text not null check (char_length(handle) between 1 and 24),
  body           text not null check (char_length(body) between 1 and 140),
  device_id      text not null check (char_length(device_id) between 8 and 80),
  hidden         boolean not null default false,
  created_at     timestamptz default now()
);
create index if not exists comments_perf_idx on comments (performance_id, id);
create index if not exists comments_device_idx on comments (device_id, created_at);
alter table comments enable row level security;

drop policy if exists "public read" on comments;
create policy "public read" on comments for select using (true);

-- A comment is accepted only while the current cue allows comments and the SM has not muted them.
drop policy if exists "comment while open" on comments;
create policy "comment while open" on comments for insert to anon, authenticated
with check (
  exists (
    select 1
    from show_state s
    join cues c on c.id = s.current_cue_id
    where s.id = 1
      and s.performance_id is not distinct from comments.performance_id
      and coalesce(s.override, '') <> 'black'
      and c.comments
      and not s.comments_muted
  )
);

-- One comment per phone every 3 seconds; new comments always start visible.
create or replace function comments_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from comments
    where device_id = new.device_id and created_at > now() - interval '3 seconds'
  ) then
    raise exception 'Dahan-dahan lang' using errcode = 'P0001';
  end if;
  new.hidden := false;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists comments_guard on comments;
create trigger comments_guard before insert on comments for each row execute function comments_guard();

-- Manual votes added from Control (service role only, no public access)
create table if not exists vote_boosts (
  id             bigint generated always as identity primary key,
  performance_id uuid not null references performances(id) on delete cascade,
  round_key      text not null,
  choice         text not null,
  amount         int  not null check (amount between 1 and 100),
  created_at     timestamptz default now()
);
create index if not exists vote_boosts_round_idx on vote_boosts (performance_id, round_key);
alter table vote_boosts enable row level security;

-- Tally = real votes + manual votes
create or replace function get_tally(p_performance uuid, p_round text)
returns table (choice text, votes bigint)
language sql
security definer
set search_path = public
stable
as $$
  select t.choice, sum(t.n)::bigint
  from (
    select v.choice, count(*) as n
    from votes v
    where v.performance_id = p_performance and v.round_key = p_round
    group by v.choice
    union all
    select b.choice, sum(b.amount) as n
    from vote_boosts b
    where b.performance_id = p_performance and b.round_key = p_round
    group by b.choice
  ) t
  group by t.choice;
$$;

grant select, insert on comments to anon, authenticated;
grant execute on function get_tally(uuid, text) to anon, authenticated;
grant all on comments, vote_boosts to service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

do $$
begin
  begin
    alter publication supabase_realtime add table public.comments;
  exception when duplicate_object then null;
  end;
end $$;

-- ---------- New script cue list ----------
delete from cues;

insert into cues (sort, label, note, screen_mode, phone_mode, title, subtitle, body, caption, phone_title, phone_body, options, round_key, vote_open, show_bars, show_qr, show_live, counter_target, flowers, reactions, comments, chat_lines, chat_interval_ms, chat_loop, chat_ramp, fx)
values
(10, 'House open', 'Pinapapasok ang audience. Program sa phones.', 'idle', 'program', null, null, null, null, null, null, '{}', null, false, false, true, false, 12480, false, false, false, '{}', 2500, false, false, 'none'),
(20, 'Places (blackout)', 'Bago ang opening theme.', 'black', 'dark', null, null, null, null, 'Magsisimula na. Paki-silent ang phone.', null, '{}', null, false, false, false, false, null, false, false, false, '{}', 2500, false, false, 'none'),
(30, 'Opening theme', 'Opening Theme: A Day INA: LIVE', 'title', 'react', null, 'Good mornight, mga Mother Tuckers!', null, null, 'Naka-LIVE na tayo!', 'Mag-react, mag-comment, magpadala ng flowers.', '{}', null, false, false, false, true, 12480, false, true, true, '{}', 2500, false, false, 'none'),
(40, 'Intro: Juicy', 'VO: And our Mother-tucking host, artisTANG INA, Juicy Pinay!', 'live', 'react', 'JUICY PINAY', 'Mother-tucking host, artisTANG INA', null, null, null, 'Mag-react para kay Juicy!', '{}', null, false, false, false, true, null, true, true, true, '{}', 2500, false, false, 'none'),
(50, 'Intro: Andy', 'Juicy: Una sa ating SpeaKING INAs, INAatupag niya ang aking beautiful makeup, Andrea C.!', 'live', 'react', 'ANDREA C.', 'INAatupag ang beautiful makeup · Mom of two dogs', null, null, null, 'Mag-react para kay Andy!', '{}', null, false, false, false, true, null, true, true, true, '{}', 2500, false, false, 'none'),
(60, 'Intro: Tonton', 'Juicy: ...ang macho gwapito borTANG INA, Tonton G.!', 'live', 'react', 'TONTON G.', 'Mother INAnother universe · Macho gwapito borTANG INA', null, null, null, 'Mag-react para kay Tonton!', '{}', null, false, false, false, true, null, true, true, true, '{}', 2500, false, false, 'none'),
(70, 'Intro: Georgie', 'Juicy: Send flowers naman para kay Georgie!', 'live', 'react', 'GEORGIE', 'PA probinsyana · Mother of two and a proud single mom', null, null, null, 'Send flowers para kay Georgie!', '{}', null, false, false, false, true, null, true, true, true, '{}', 2500, false, false, 'none'),
(80, 'Intro: Direk Jona', 'Juicy: INA niyo, INA mo, INA nating lahat, Direk Jona Reyes!', 'live', 'react', 'DIREK JONA REYES', 'INA niyo, INA mo, INA nating lahat', null, null, null, 'Mag-react para kay Direk Jona!', '{}', null, false, false, false, true, null, true, true, true, '{}', 2500, false, false, 'none'),
(90, 'Show logo', 'Juicy: ...scan our QR codes para makavote. May the best mother win!', 'title', 'react', 'MAY THE BEST MOTHER WIN!', 'SINO ANG IE-ELIMINATE?', 'Grace · Overflowing Love · Authenticity · Talent', null, 'May the best mother win!', 'Kayo ang judges ngayong gabi.', '{}', null, false, false, true, true, null, false, true, true, '{}', 2500, false, false, 'none'),
(100, 'Round 1 card', 'Juicy: Round 1, INA GOT TALENT!', 'title', 'react', 'ROUND 1', 'INA GOT TALENT', null, null, 'Round 1: INA Got Talent', 'Malapit na ang botohan.', '{}', null, false, false, false, true, null, false, true, true, '{}', 2500, false, false, 'none'),
(110, 'Round 1 voting OPEN', 'Juicy: Scan the QR code at iboto kung sino ang ie-eliminate!', 'vote', 'vote', 'SINO ANG IE-ELIMINATE?', 'Round 1 · INA Got Talent', null, null, 'Sino ang ie-eliminate?', 'Round 1: INA Got Talent. Isang boto lang bawat phone.', array['Andy', 'Georgie', 'Tonton', 'Jona'], 'round1', true, true, true, true, null, false, true, true, '{}', 2500, false, false, 'none'),
(120, 'Drumroll: winner', 'Juicy: Nasa akin na ang resulta. And the winner of this round is…', 'drumroll', 'standby', 'And the winner of this round is', 'Round 1 · Resulta', null, null, 'Sarado na ang botohan.', 'Abangan ang resulta sa screen.', '{}', 'round1', false, false, false, true, null, false, false, false, '{}', 2500, false, false, 'none'),
(130, 'Round 1 WINNER (auto: highest votes)', 'Juicy: Bigyan ng MAMA Medal yan.', 'winner', 'react', '{winner}', 'Winner of Round 1', 'Bigyan ng MAMA Medal yan!', null, '{winner}', 'Bigyan ng MAMA Medal yan!', '{}', 'round1', false, false, false, true, null, true, true, true, '{}', 2500, false, false, 'none'),
(140, 'Drumroll: eliminated', 'Juicy: At ang eliminated sa first round ay si…', 'drumroll', 'standby', 'Ang eliminated sa first round ay si', 'Round 1 · Resulta', null, null, 'Ang eliminated ay si…', 'Abangan sa screen.', '{}', 'round1', false, false, false, true, null, false, false, false, '{}', 2500, false, false, 'none'),
(150, 'Round 1 result: WALA!', 'Juicy: Wala!', 'result', 'react', 'WALA!', 'Round 1 · Resulta', 'Sa sobrang talented ng ating SpeaKING INAs, kailangan pa ng isang round.', null, 'WALA!', 'Walang na-eliminate. Next round na!', '{}', null, false, false, false, true, null, false, true, true, '{}', 2500, false, false, 'none'),
(160, 'Round 2 card', 'Juicy: Round 2. NANAY Trending.', 'title', 'react', 'ROUND 2', 'NANAY TRENDING', null, null, 'Round 2: Nanay Trending', 'Authenticity ang labanan.', '{}', null, false, false, false, true, null, false, true, true, '{}', 2500, false, false, 'none'),
(170, 'Breaking news', 'Tonton (breaking news) [BREAKING NEWS MUSIC]', 'news', 'react', 'Pagba-ban sa Discord sa Pilipinas, isinusulong na', 'Kaugnay ng pamamaril sa Makabuhay National High School', 'Suspek: Grade 10 student na kinilalang si E. Dizon, natagpuang patay din matapos ang insidente  •  Ayon sa gobyerno, ang chatbox ang naghikayat sa krimen  •  I-ban ang mga plataporma kasama na rin ang larong Rolbucks  •  CASE CLOSED', null, 'Breaking news', 'Ano sa tingin mo? Mag-comment.', '{}', null, false, false, false, true, null, false, true, true, '{}', 2500, false, false, 'none'),
(180, 'Viewer comments', 'Juicy: Mga viewers, ano''ng comments n''yo?', 'chat', 'react', 'Comments', null, null, null, 'Mag-comment!', 'Babasahin ni Juicy ang comments.', '{}', null, false, false, false, true, null, false, true, true, array['mommy_lyn|Sana imbestigahan kung sino ang nakaimpluwensya sa kanya.', 'tita_bebs|Pabili pong hollow blocks', 'marites.ph|Kasalanan ''to ng magulang.', 'anon_ina|Sino ba yung nanay niyan? Halimaw din siguro.'], 3200, false, false, 'none'),
(190, 'Flickering lights', '[FLICKERING LIGHTS] Tonton: Direk Jona…', 'live', 'dark', null, null, null, null, null, null, '{}', null, false, false, false, true, null, false, false, false, '{}', 2500, false, false, 'flicker'),
(200, 'HACK', 'Jona: Teka, wala sa script ''to. … [SFX: ZZT] Magfa-flash sa screen', 'glitch', 'glitch', 'SINO ANG IE-ELIMINATE?', null, null, null, 'SINO ANG IE-ELIMINATE?', null, '{}', null, false, false, false, true, null, false, false, false, '{}', 2500, false, false, 'heavy'),
(210, 'Brownout + gunshot', '[BROWNOUT] lights off, on, off, [GUNSHOT], lights on', 'black', 'dark', null, null, null, null, null, null, '{}', null, false, false, false, false, null, false, false, false, '{}', 2500, false, false, 'none'),
(220, 'THE GAME', 'VO: Leave this room and the rest will be killed.', 'message', 'message', null, null, 'One person in the room did this. Find the killer before another one gets eliminated.', null, null, 'One person in the room did this.', '{}', null, false, false, false, false, null, false, false, false, '{}', 2500, false, false, 'none'),
(230, 'Game vote: SINO ANG IE-ELIMINATE?', 'VO: Sino ang ieeliminate? Use ghost votes to push JUICY. Stays up until the reveal.', 'vote', 'vote', 'SINO ANG IE-ELIMINATE?', null, null, null, 'Sino ang ie-eliminate?', 'Gumagalaw ang botohan. Ikaw ang judge.', array['JUICY', 'ANDY', 'TONTON', 'GEORGIE', 'JONA'], 'game', true, true, true, true, null, false, true, true, '{}', 2500, false, false, 'none'),
(240, 'Reveal: Still on LIVE', 'Jona: ...Still on LIVE? / Tonton: Yes, Direk. 525,600 viewers.', 'live', 'react', null, null, null, 'It''s a prank.', 'It''s a prank.', 'Relax lang, mga Mother Tuckers. Safe ang lahat.', '{}', null, false, false, false, true, 525600, false, true, true, '{}', 2500, false, false, 'none'),
(250, 'Enzo voice message', 'Iple-play ang voice message.', 'voicemsg', 'dark', 'Enzo', 'Voice message', null, null, null, null, '{}', null, false, false, false, true, null, false, false, false, '{}', 2500, false, false, 'none'),
(260, 'Hate chat', 'Juicy: Direk. Tingnan mo ''to.', 'chat', 'react', null, null, null, null, 'Mag-comment', 'Lalabas sa screen ang comment mo.', '{}', null, false, false, false, true, null, false, true, true, array['AYAN PALA ANG NANAY.', 'Kaya pala ganun ang anak, ganyan ang ina.', 'Isunod na siya.', 'Scripted ''to, clout lang.'], 1500, true, true, 'none'),
(270, 'FINAL voting OPEN', 'Pipindutin ni Tonton ang laptop. Hindi mamamatay ang screen.', 'vote', 'vote', 'MAY THE BEST MOTHER WIN!', 'SINO ANG IE-ELIMINATE?', null, null, 'SINO ANG IE-ELIMINATE?', 'Ikaw ang judge.', array['JUICY', 'ANDY', 'TONTON', 'GEORGIE', 'JONA'], 'final', true, true, true, true, null, false, true, true, array['Eliminate JONA.', 'Si Georgie, drama lang.', 'Yung fur mom, OA.', 'Lahat sila, scripted.'], 1100, true, true, 'none'),
(280, 'Itigil mo na ang LIVE (glitch)', 'Jona: Tonton. Itigil mo na ang… LIVE. Lights flickering. Juicy: Lahat tayo, ina.', 'vote', 'vote', 'MAY THE BEST MOTHER WIN!', 'SINO ANG IE-ELIMINATE?', null, null, 'SINO ANG IE-ELIMINATE?', 'Ikaw ang judge.', array['JUICY', 'ANDY', 'TONTON', 'GEORGIE', 'JONA'], 'final', true, true, true, true, null, false, true, true, array['Eliminate JONA.', 'Si Georgie, drama lang.', 'Yung fur mom, OA.', 'Lahat sila, scripted.'], 700, true, true, 'flicker'),
(290, 'Buzzer: ELIMINATED:', 'Ibababa ni Juicy ang mic. Titigil ang mga boto. Buzzer.', 'result', 'glitch', 'ELIMINATED:', null, null, null, 'ELIMINATED:', null, '{}', 'final', false, false, false, true, null, false, false, false, '{}', 2500, false, false, 'heavy'),
(300, 'Hindi ako galit, Ma. Promise.', 'Lalabas sa screen.', 'blackmsg', 'blackmsg', null, null, 'Hindi ako galit, Ma. Promise.', null, null, 'Hindi ako galit, Ma. Promise.', '{}', null, false, false, false, false, null, false, false, false, '{}', 2500, false, false, 'none'),
(310, 'Blackout / TELON', 'Blackout.', 'black', 'dark', null, null, null, null, null, null, '{}', null, false, false, false, false, null, false, false, false, '{}', 2500, false, false, 'none'),
(320, 'Curtain call', 'Bows. Thank-you sa phones.', 'curtain', 'thanks', 'Maraming salamat, mga Mother Tuckers!', null, null, null, 'Maraming salamat sa panonood!', null, '{}', null, false, false, false, false, null, false, false, false, '{}', 2500, false, false, 'none');

update show_state
set current_cue_id = (select id from cues order by sort limit 1),
    override = null, comments_muted = false, cue_started_at = now(), updated_at = now()
where id = 1;

update cast_members set role_label = 'INA niyo, INA mo, INA nating lahat' where character_name = 'Jona';
