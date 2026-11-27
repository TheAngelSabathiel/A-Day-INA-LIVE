-- A Day INA: LIVE · patch 03 (Nov 27 tech run)
-- Run once in Supabase > SQL Editor. Safe to re-run. Keeps votes, cast and your other cue edits.

-- 1. More scripted stray and hate comments (script lines stay first).
update cues set chat_lines = array['Grabe, Grade 10 pa lang. Halimaw.', 'kuya_jun|Demonyo yung bata. Walang awa.', 'First', 'Kasalanan talaga ng Rolbucks yan, adik sa laro mga bata ngayon.', 'BAN NA LAHAT NG GAMES!!!', 'Hindi Discord ang may kasalanan. Magulang.', 'Nasaan ang nanay nito habang nagpaplano anak niya?', 'tite', 'NO TO PAX SILICA', 'CASE CLOSED agad? Ang bilis ah.', 'Dapat may parusa kahit minor.', 'Sana all may Discord', 'Kawawa yung mga estudyante. Ipagdasal natin sila.', 'Pa-shoutout po from Bulacan!'], chat_interval_ms = 2600, chat_loop = false, chat_ramp = false
  where label = 'Breaking news';
update cues set chat_lines = array['mommy_lyn|Sana imbestigahan kung sino ang nakaimpluwensya sa kanya.', 'tita_bebs|Pabili pong hollow blocks', 'marites.ph|Kasalanan ''to ng magulang.', 'anon_ina|Sino ba yung nanay niyan? Halimaw din siguro.', 'Halimaw yung bata. Wag na pag-usapan.', 'Walang kwentang magulang. Kawawa yung mga biktima.', 'Busy siguro sa trabaho ang nanay, ayan napabayaan.', 'tite', 'Dapat pati nanay kasuhan.', 'NO TO PAX SILICA! Huwag ibenta ang bayan!', 'Makibaka, huwag matakot!', 'Laro lang yan, wag gawing scapegoat ang Rolbucks.', 'Mana sa nanay yan for sure.', 'Pa-shoutout naman po Juicy!', 'Sino nanood dahil sa TikTok?', 'Uso pa ba magulang? Puro gadget na lang.', 'Gutom na po ako.', 'Ang bata pa niya para maging mamamatay-tao.', 'Junk na lahat ng chat apps!'], chat_interval_ms = 3000, chat_loop = false, chat_ramp = false
  where label = 'Viewer comments';
update cues set chat_lines = array['AYAN PALA ANG NANAY.', 'Kaya pala ganun ang anak, ganyan ang ina.', 'Isunod na siya.', 'Scripted ''to, clout lang.', 'Ikaw ang nagpalaki sa halimaw.', 'Nanay ng mamamatay-tao, nag-LIVE pa.', 'Walang hiya, nakangiti pa sa camera.', 'Dapat sa''yo ikulong din.', 'Clout chaser. Ginagamit ang patay na anak.', 'Nasaan ka nung kailangan ka ng anak mo?', 'Bad mother of the year.', 'Unfollow. Report. Block.', 'ELIMINATE THE MOTHER', 'Nakakadiri.', 'tite', 'Ina ka pa ba?', 'Pinabayaan mo siya.', 'Mother tucker talaga.', 'NO TO PAX SILICA'], chat_interval_ms = 1500, chat_loop = true, chat_ramp = true
  where label = 'Hate chat';
update cues set chat_lines = array['Eliminate JONA.', 'Si Georgie, drama lang.', 'Yung fur mom, OA.', 'Lahat sila, scripted.', 'Eliminate ang nanay ng shooter!', 'JONA OUT', 'Vote JONA, wala siyang karapatan dito.', 'Lahat kayo may kasalanan.', 'Si Juicy na lang, ang ingay.', 'Eliminate ang lahat.', 'Mother of the year daw, pero ang anak...', 'Itigil na ang LIVE na ''to.', 'Isunod na siya.', 'tite', 'NO TO PAX SILICA', 'AYAN PALA ANG NANAY.'], chat_interval_ms = 1100, chat_loop = true, chat_ramp = true
  where label = 'FINAL voting OPEN';
update cues set chat_lines = array['Eliminate JONA.', 'Si Georgie, drama lang.', 'Yung fur mom, OA.', 'Lahat sila, scripted.', 'Eliminate ang nanay ng shooter!', 'JONA OUT', 'Vote JONA, wala siyang karapatan dito.', 'Lahat kayo may kasalanan.', 'Si Juicy na lang, ang ingay.', 'Eliminate ang lahat.', 'Mother of the year daw, pero ang anak...', 'Itigil na ang LIVE na ''to.', 'Isunod na siya.', 'tite', 'NO TO PAX SILICA', 'AYAN PALA ANG NANAY.'], chat_interval_ms = 700, chat_loop = true, chat_ramp = true
  where label = 'Itigil mo na ang LIVE (glitch)';

-- 2. In-world wording on the audience program (no "dula" or "show").
update settings set advisory = 'Sensitibo ang episode ngayong gabi: may usapin ng school shooting, pagkawala ng anak, at pagdadalamhati. May malalakas na tunog, biglang blackout, at glitch sa screen.'
  where id = 1 and (advisory is null or advisory ilike '%dula%');

-- 3. Make sure a show is active so phones can vote, react and comment.
update show_state set performance_id = (select id from performances where is_test order by sort limit 1), updated_at = now()
  where id = 1 and performance_id is null;

-- 4. Clear tech-run comments so the first show starts with an empty chat.
update comments set hidden = true where hidden = false;
