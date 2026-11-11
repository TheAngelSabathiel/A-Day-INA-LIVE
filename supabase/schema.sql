-- =====================================================================
-- A Day INA: LIVE  |  Supabase schema + seed
-- Paste the whole file into Supabase > SQL Editor > New query > Run.
-- Safe to re-run: tables use IF NOT EXISTS and the seed only runs
-- when the cues table is empty.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- SETTINGS (single row) ----------
create table if not exists settings (
  id            int primary key default 1 check (id = 1),
  show_title    text default 'A Day INA: LIVE',
  tagline       text,
  presenter     text,
  logo_url      text,
  sublogo_url   text,
  logo_mode     text default 'sublogo' check (logo_mode in ('sublogo','logo')),
  color_bg      text default '#EDE3D1',
  color_surface text default '#F7F1E6',
  color_accent  text default '#6E1423',
  color_ink     text default '#241314',
  schedule      text,
  venue         text,
  synopsis      text,
  advisory      text,
  credits       text,
  helpline      text,
  socials       text,
  public_url    text,
  join_prompt   text default 'I-scan para sumali sa LIVE',
  updated_at    timestamptz default now()
);

-- ---------- CAST ----------
create table if not exists cast_members (
  id             uuid primary key default gen_random_uuid(),
  sort           int not null default 0,
  character_name text not null,
  display_name   text,
  role_label     text,
  actor_name     text,
  bio            text,
  photo_url      text,
  created_at     timestamptz default now()
);

-- ---------- PERFORMANCES ----------
create table if not exists performances (
  id         uuid primary key default gen_random_uuid(),
  sort       int not null default 0,
  label      text not null,
  is_test    boolean not null default false,
  created_at timestamptz default now()
);

-- ---------- CUES ----------
create table if not exists cues (
  id               uuid primary key default gen_random_uuid(),
  sort             int not null default 0,
  label            text not null,
  note             text,
  screen_mode      text not null default 'live',
  phone_mode       text not null default 'standby',
  title            text,
  subtitle         text,
  body             text,
  caption          text,
  phone_title      text,
  phone_body       text,
  options          text[] not null default '{}',
  round_key        text,
  vote_open        boolean not null default false,
  show_bars        boolean not null default false,
  show_qr          boolean not null default false,
  show_live        boolean not null default true,
  counter_target   bigint,
  flowers          boolean not null default false,
  reactions        boolean not null default false,
  timer_seconds    int,
  chat_lines       text[] not null default '{}',
  chat_interval_ms int not null default 2500,
  chat_loop        boolean not null default false,
  created_at       timestamptz default now()
);

-- ---------- LIVE SHOW STATE (single row) ----------
create table if not exists show_state (
  id             int primary key default 1 check (id = 1),
  current_cue_id uuid references cues(id) on delete set null,
  performance_id uuid references performances(id) on delete set null,
  override       text,
  cue_started_at timestamptz default now(),
  inject_text    text,
  inject_at      timestamptz,
  updated_at     timestamptz default now()
);

-- ---------- VOTES ----------
create table if not exists votes (
  id             bigint generated always as identity primary key,
  performance_id uuid not null references performances(id) on delete cascade,
  round_key      text not null,
  choice         text not null,
  device_id      text not null check (char_length(device_id) between 8 and 80),
  created_at     timestamptz default now(),
  unique (performance_id, round_key, device_id)
);
create index if not exists votes_round_idx on votes (performance_id, round_key);

-- ---------- REACTIONS (flowers / hearts) ----------
create table if not exists reactions (
  id             bigint generated always as identity primary key,
  performance_id uuid references performances(id) on delete cascade,
  kind           text not null default 'flower' check (kind in ('flower','heart','haha','wow','sad')),
  count          int not null default 1 check (count between 1 and 10),
  created_at     timestamptz default now()
);

-- ---------- ROW LEVEL SECURITY ----------
alter table settings     enable row level security;
alter table cast_members enable row level security;
alter table performances enable row level security;
alter table cues         enable row level security;
alter table show_state   enable row level security;
alter table votes        enable row level security;
alter table reactions    enable row level security;

drop policy if exists "public read" on settings;
create policy "public read" on settings for select using (true);
drop policy if exists "public read" on cast_members;
create policy "public read" on cast_members for select using (true);
drop policy if exists "public read" on performances;
create policy "public read" on performances for select using (true);
drop policy if exists "public read" on cues;
create policy "public read" on cues for select using (true);
drop policy if exists "public read" on show_state;
create policy "public read" on show_state for select using (true);

-- A vote is accepted only while the current cue has voting open,
-- for the active performance, and for one of the listed options.
drop policy if exists "vote while open" on votes;
create policy "vote while open" on votes for insert to anon, authenticated
with check (
  exists (
    select 1
    from show_state s
    join cues c on c.id = s.current_cue_id
    where s.id = 1
      and s.performance_id = votes.performance_id
      and coalesce(s.override, '') <> 'black'
      and c.vote_open
      and c.round_key = votes.round_key
      and votes.choice = any (c.options)
  )
);

-- Flowers and reactions are accepted only while the current cue allows them.
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
drop policy if exists "public read" on reactions;
create policy "public read" on reactions for select using (true);

-- Tally without exposing individual votes
create or replace function get_tally(p_performance uuid, p_round text)
returns table (choice text, votes bigint)
language sql
security definer
set search_path = public
stable
as $$
  select v.choice, count(*)::bigint
  from votes v
  where v.performance_id = p_performance and v.round_key = p_round
  group by v.choice;
$$;

grant usage on schema public to anon, authenticated;
grant select on settings, cast_members, performances, cues, show_state to anon, authenticated;
grant insert on votes, reactions to anon, authenticated;
grant select on reactions to anon, authenticated;
grant execute on function get_tally(uuid, text) to anon, authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

-- ---------- REALTIME ----------
do $$
declare t text;
begin
  foreach t in array array['show_state','cues','settings','cast_members','reactions'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------- STORAGE (logos, cast photos) ----------
insert into storage.buckets (id, name, public)
values ('brand', 'brand', true)
on conflict (id) do nothing;

-- =====================================================================
-- SEED (runs only once, when cues is empty)
-- =====================================================================
do $$
declare
  rehearsal uuid;
  first_cue uuid;
begin
  if exists (select 1 from cues) then
    return;
  end if;

  insert into settings (id) values (1) on conflict (id) do nothing;
  update settings set
    show_title = 'A Day INA: LIVE',
    tagline    = 'Mula sa mga ina, para sa mga ina.',
    presenter  = 'Act Avenue',
    schedule   = 'Nov 28 & 29, 2026 · 3PM and 7PM',
    synopsis   = 'Anniversary episode ng A Day INA: LIVE, ang paborito ninyong INA-abangan tuwing madaling araw. Ngayong gabi, ang backstage crew mismo ang guesting mothers, at kayo ang judges. Bawat round, may elimination. May the best mother win!',
    advisory   = 'Tinatalakay ng dula ang isang school shooting, pagkawala ng anak, at pagdadalamhati. May tunog ng putok ng baril, biglang blackout, at glitch effects sa screen.',
    credits    = E'Isang produksyon ng Act Avenue\n\nWritten by: TBA\nDirected by: TBA\nStage Manager: TBA\nLights and Sound: TBA\n\nAudience app by TheAngelSabathiel',
    helpline   = E'Kung may mabigat kang pinagdadaanan, may kausap ka.\nNCMH Crisis Hotline (24/7, libre)\n1553 (landline, toll-free)\n0919-057-1553 (Smart/TNT)\n0917-899-8727 (Globe/TM)',
    join_prompt = 'I-scan para sumali sa LIVE'
  where id = 1;

  insert into cast_members (sort, character_name, display_name, role_label, actor_name, bio) values
    (10, 'Juicy',   'Juicy Pinay',      'Mother-tucking host, artisTANG INA',                 'TBA', 'Good mornight, mga Mother Tuckers! Ito ang paborito ninyong INA-abangan tuwing madaling araw.'),
    (20, 'Andy',    'Andrea C.',        'INAatupag ang beautiful makeup · Mom of two dogs',  'TBA', 'Mom of two dogs, pero mahilig din sa hotdogs. Flavor today: Strawberry ice cream.'),
    (30, 'Tonton',  'Tonton G.',        'Mother INAnother universe · Macho gwapito borTANG INA', 'TBA', 'Welcome to me. Your favorite cameraman. Flavor today: Matcha.'),
    (40, 'Georgie', 'Georgie',          'PA probinsyana · Mother of two and a proud single mom', 'TBA', 'Isa sa pinakamasipag na nakilala ni Juicy. Literal na INA.'),
    (50, 'Jona',    'Direk Jona Reyes', 'Ang INA nating lahat',                              'TBA', 'Ang INA ng A Day INA: LIVE. Mula sa mga ina, para sa mga ina.');

  insert into performances (sort, label, is_test) values
    (0,  'Rehearsal / Test', true),
    (10, 'Nov 28 · 3PM', false),
    (20, 'Nov 28 · 7PM', false),
    (30, 'Nov 29 · 3PM', false),
    (40, 'Nov 29 · 7PM', false);
  select id into rehearsal from performances where is_test order by sort limit 1;

  insert into cues (sort, label, note, screen_mode, phone_mode, title, subtitle, body, caption, phone_title, phone_body,
                    options, round_key, vote_open, show_bars, show_qr, show_live, counter_target, flowers,
                    chat_lines, chat_interval_ms, chat_loop, reactions)
  values
  (10,  'House open', 'Pinapapasok ang audience. Program sa phones.', 'idle', 'program',
        null, null, null, null, null, null,
        '{}', null, false, false, true, false, 12480, false, '{}', 2500, false, false),

  (20,  'Pre-show scene', 'Madilim. Isang ilaw sa may laptop. Jona at Tonton.', 'black', 'dark',
        null, null, null, null, 'Magsisimula na. Paki-silent ang phone.', null,
        '{}', null, false, false, false, false, null, false, '{}', 2500, false, false),

  (30,  'Opening theme', 'Opening Theme: A Day INA: LIVE / Voice over', 'title', 'standby',
        null, 'Good mornight, mga Mother Tuckers!', null, null, 'Naka-LIVE na tayo!', 'Abangan ang botohan. Huwag isara ang page na ito.',
        '{}', null, false, false, false, true, 12480, false, '{}', 2500, false, true),

  (40,  'Intro: Juicy', 'Juicy: Good mornight, mga Mother Tuckers!', 'live', 'standby',
        'JUICY PINAY', 'Mother-tucking host, artisTANG INA', null, null, 'Naka-LIVE na tayo!', 'Mag-react habang pinapakilala ang mga INA.',
        '{}', null, false, false, false, true, null, false, '{}', 2500, false, true),

  (50,  'Intro: Andy', 'Juicy: Una sa ating SpeaKING INAs...', 'live', 'standby',
        'ANDREA C.', 'INAatupag ang beautiful makeup · Mom of two dogs', null, null, 'Naka-LIVE na tayo!', 'Mag-react habang pinapakilala ang mga INA.',
        '{}', null, false, false, false, true, null, false, '{}', 2500, false, true),

  (60,  'Intro: Tonton', 'Juicy: ...mother INAnother universe', 'live', 'standby',
        'TONTON G.', 'Mother INAnother universe · Macho gwapito borTANG INA', null, null, 'Naka-LIVE na tayo!', 'Mag-react habang pinapakilala ang mga INA.',
        '{}', null, false, false, false, true, null, false, '{}', 2500, false, true),

  (70,  'Intro: Georgie + flowers', 'Juicy: Send flowers naman para kay Georgie!', 'live', 'flowers',
        'GEORGIE', 'PA probinsyana · Mother of two and a proud single mom', null, null, 'Send flowers para kay Georgie!', 'I-tap para magpadala ng bulaklak.',
        '{}', null, false, false, false, true, null, true, '{}', 2500, false, true),

  (80,  'Intro: Direk Jona', 'Juicy: Ang INA nating lahat...', 'live', 'standby',
        'DIREK JONA REYES', 'Ang INA nating lahat', null, null, 'Naka-LIVE na tayo!', 'Mag-react habang pinapakilala ang mga INA.',
        '{}', null, false, false, false, true, null, false, '{}', 2500, false, true),

  (90,  'Show logo', 'Juicy: May the best mother win!', 'title', 'standby',
        'MAY THE BEST MOTHER WIN!', 'SINO ANG IE-ELIMINATE?', 'Grace · Overflowing Love · Authenticity · Talent', null, 'May the best mother win!', 'Kayo ang judges ngayong gabi.',
        '{}', null, false, false, false, true, null, false, '{}', 2500, false, true),

  (100, 'Round 1 card', 'ROUND 1: INA GOT TALENT', 'title', 'standby',
        'ROUND 1', 'INA GOT TALENT', null, null, 'Round 1: INA Got Talent', 'Malapit na ang botohan.',
        '{}', null, false, false, false, true, null, false, '{}', 2500, false, false),

  (110, 'Round 1 voting OPEN', 'Juicy: Scan the QR code at iboto kung sino ang ie-eliminate!', 'vote', 'vote',
        'SINO ANG IE-ELIMINATE?', 'Round 1 · INA Got Talent', null, null, 'Sino ang ie-eliminate?', 'Round 1: INA Got Talent. Isang boto lang bawat phone.',
        array['Andy','Georgie','Tonton','Jona'], 'round1', true, true, true, true, null, false, '{}', 2500, false, false),

  (120, 'Round 1 drumroll (votes close)', 'Juicy: At ang eliminated sa first round ay si...', 'drumroll', 'standby',
        'Ang eliminated ay si', 'Round 1 · Resulta', null, null, 'Sarado na ang botohan.', 'Abangan ang resulta sa screen.',
        '{}', 'round1', false, false, false, true, null, false, '{}', 2500, false, false),

  (130, 'Round 1 result: WALA!', 'Juicy: Wala!', 'result', 'standby',
        'WALA!', 'Round 1 · Resulta', 'Sa sobrang talented ng ating SpeaKING INAs, kailangan pa ng isang round.', null, 'WALA!', 'Walang na-eliminate. Next round na!',
        '{}', 'round1', false, false, false, true, null, false, '{}', 2500, false, true),

  (140, 'Round 2 card', 'ROUND 2: NANAY TRENDING', 'title', 'standby',
        'ROUND 2', 'NANAY TRENDING', null, null, 'Round 2: Nanay Trending', 'Abangan.',
        '{}', null, false, false, false, true, null, false, '{}', 2500, false, false),

  (150, 'Breaking news', 'Tonton (breaking news)', 'news', 'standby',
        'Pagba-ban sa Discord sa Pilipinas, isinusulong na', 'Kaugnay ng pamamaril sa Makabuhay National High School',
        'Suspek: Grade 10 student na si E. Dizon, natagpuang patay din matapos ang insidente  •  Ayon sa gobyerno, chatbox ang naghikayat sa krimen  •  Isinusulong ding i-ban ang Rolbucks at Scatter  •  CASE CLOSED',
        null, 'Naka-LIVE pa rin.', null,
        '{}', null, false, false, false, true, null, false, '{}', 2500, false, false),

  (160, 'Viewer comments', 'Juicy: Mga viewers, ano''ng comments n''yo?', 'chat', 'standby',
        'Comments', null, null, null, 'Naka-LIVE pa rin.', null,
        '{}', null, false, false, false, true, null, false,
        array['mommy_lyn|Sana imbestigahan kung sino ang nakaimpluwensya sa kanya.','tita_bebs|Kasalanan ''to ng magulang.','anon_ina|Nasaan ang nanay niyan? Halimaw din siguro.'],
        4500, false, false),

  (170, 'HACK', 'Magdidilim. Naka-on pa rin ang LIVE. Flash: SINO ANG IE-ELIMINATE?', 'glitch', 'glitch',
        'SINO ANG IE-ELIMINATE?', null, null, null, 'SINO ANG IE-ELIMINATE?', null,
        '{}', null, false, false, false, true, null, false, '{}', 2500, false, false),

  (180, 'Gunshot blackout', 'Patlang. Dilim. Isang putok ng baril.', 'black', 'dark',
        null, null, null, null, null, null,
        '{}', null, false, false, false, false, null, false, '{}', 2500, false, false),

  (190, 'THE GAME', 'Lalabas sa screen: One person in the room did this...', 'message', 'message',
        null, null, 'One person in the room did this. Find the killer, with grace, before another one gets eliminated.', null,
        null, 'One person in the room did this.',
        '{}', null, false, false, false, false, null, false, '{}', 2500, false, false),

  (220, 'Six million', 'Lalabas sa screen: FIND THE KILLER. WIN SIX MILLION PESOS.', 'message', 'dark',
        'FIND THE KILLER.', null, 'WIN SIX MILLION PESOS.', null, null, null,
        '{}', null, false, false, false, false, null, false, '{}', 2500, false, false),

  (230, 'Reveal: Still on LIVE', 'Jona: Still on LIVE? / Tonton: 525,600 viewers.', 'live', 'message',
        null, null, null, 'It''s a prank.', 'It''s a prank.', 'Relax lang, mga Mother Tuckers. Safe ang lahat.',
        '{}', null, false, false, false, true, 525600, false, '{}', 2500, false, false),

  (240, 'Hate chat', 'Juicy: Direk. Tingnan mo.', 'chat', 'dark',
        null, null, null, null, null, null,
        '{}', null, false, false, false, true, null, false,
        array['AYAN PALA ANG NANAY.','Kaya pala ganun ang anak, ganyan ang ina.','Isunod na siya.','Scripted ''to, clout lang.'],
        1300, true, false),

  (250, 'FINAL voting OPEN', 'Pipindutin ni Tonton ang laptop. Hindi mamamatay ang screen.', 'vote', 'vote',
        'MAY THE BEST MOTHER WIN!', 'SINO ANG IE-ELIMINATE?', null, null, 'SINO ANG IE-ELIMINATE?', 'Ikaw ang judge.',
        array['JUICY','ANDY','TONTON','GEORGIE','JONA'], 'final', true, true, true, true, null, false,
        array['Eliminate JONA.','Si Georgie, drama lang.','Yung fur mom, OA.','Lahat sila, scripted.'],
        900, true, false),

  (260, 'Buzzer: ELIMINATED:', 'Titigil ang mga boto. Buzzer.', 'result', 'message',
        'ELIMINATED:', null, null, null, 'ELIMINATED:', null,
        '{}', 'final', false, false, false, true, null, false, '{}', 2500, false, false),

  (270, 'Blackout / TELON', 'Blackout.', 'black', 'dark',
        null, null, null, null, null, null,
        '{}', null, false, false, false, false, null, false, '{}', 2500, false, false),

  (280, 'Curtain call', 'Bows. Thank-you on phones.', 'curtain', 'thanks',
        'Maraming salamat, mga Mother Tuckers!', null, null, null, 'Maraming salamat sa panonood!', null,
        '{}', null, false, false, false, false, null, false, '{}', 2500, false, false);

  select id into first_cue from cues order by sort limit 1;
  insert into show_state (id, current_cue_id, performance_id)
  values (1, first_cue, rehearsal)
  on conflict (id) do update set current_cue_id = excluded.current_cue_id, performance_id = excluded.performance_id;
end $$;
