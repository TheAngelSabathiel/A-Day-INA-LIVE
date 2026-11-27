-- A Day INA: LIVE · patch 04
-- Run once in Supabase > SQL Editor after patch-03. Safe to re-run. Keeps votes and your other cue edits.

-- ---------- v4: changeable votes, comment speed ----------
alter table show_state add column if not exists chat_speed int not null default 6;
alter table show_state drop constraint if exists show_state_chat_speed_chk;
alter table show_state add constraint show_state_chat_speed_chk check (chat_speed between 1 and 10);

-- One vote per phone per round, changeable while voting is open.
create or replace function cast_vote(p_performance uuid, p_round text, p_choice text, p_device text)
returns text language plpgsql security definer set search_path = public as $$
begin
  if char_length(coalesce(p_device, '')) not between 8 and 80 then
    raise exception 'invalid device' using errcode = '22023';
  end if;
  if not exists (
    select 1 from show_state s join cues c on c.id = s.current_cue_id
    where s.id = 1 and s.performance_id = p_performance and coalesce(s.override, '') <> 'black'
      and c.vote_open and c.round_key = p_round and p_choice = any (c.options)
  ) then
    raise exception 'voting closed' using errcode = '42501';
  end if;
  insert into votes (performance_id, round_key, choice, device_id)
  values (p_performance, p_round, p_choice, p_device)
  on conflict (performance_id, round_key, device_id)
  do update set choice = excluded.choice, created_at = now();
  return p_choice;
end $$;
revoke all on function cast_vote(uuid, text, text, text) from public;
grant execute on function cast_vote(uuid, text, text, text) to anon, authenticated;

-- Cues: "Still on LIVE" and "It's a prank." are now two cues; Enzo voice message removed (Jona plays it live).
update cues set label = 'Still on LIVE', caption = null, phone_title = 'Still on LIVE.', phone_body = null
  where label = 'Reveal: Still on LIVE';
insert into cues (sort, label, note, screen_mode, phone_mode, title, subtitle, body, caption, phone_title, phone_body, options, round_key, vote_open, show_bars, show_qr, show_live, counter_target, flowers, reactions, comments, chat_lines, chat_interval_ms, chat_loop, chat_ramp, fx)
select c.sort + 5, 'It''s a prank.', 'Lalabas ang "It''s a prank." sa screen at phones.', 'live', 'react', null, null, null, 'It''s a prank.', 'It''s a prank.', 'Relax lang, mga Mother Tuckers. Safe ang lahat.', '{}', null, false, false, false, true, 525600, false, true, true, '{}', 2500, false, false, 'none'
from cues c where c.label = 'Still on LIVE'
  and not exists (select 1 from cues where label = 'It''s a prank.');
update show_state set current_cue_id = (select id from cues where label = 'Still on LIVE'), updated_at = now()
  where current_cue_id = (select id from cues where label = 'Enzo voice message');
delete from cues where label = 'Enzo voice message';

update cues set phone_body = 'Round 1: INA Got Talent. Pwede mong palitan ang boto habang bukas.'
  where label = 'Round 1 voting OPEN' and phone_body = 'Round 1: INA Got Talent. Isang boto lang bawat phone.';
