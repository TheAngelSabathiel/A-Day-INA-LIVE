-- A Day INA: LIVE · patch 05
-- Run once in Supabase > SQL Editor after patch-04. Safe to re-run.

-- QR on the Opening theme screen.
update cues set show_qr = true where label = 'Opening theme';

-- Round 1 winner = fewest votes (ties share the medal). The winner cue needs the
-- same names as the Round 1 vote so a name with zero votes still counts.
update cues w set options = v.options,
  note = 'Juicy: Bigyan ng MAMA Medal yan. Winner = pinakakaunting boto (tie = lahat).'
from cues v
where w.label = 'Round 1 WINNER (auto: highest votes)' and v.label = 'Round 1 voting OPEN';
update cues set label = 'Round 1 WINNER (auto: fewest votes)' where label = 'Round 1 WINNER (auto: highest votes)';
