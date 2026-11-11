export function findCast(cast = [], name = '') {
  const key = String(name).trim().toLowerCase();
  return cast.find((c) => (c.character_name || '').trim().toLowerCase() === key);
}

export function tallyTotal(options = [], tally = {}) {
  return options.reduce((s, o) => s + (tally[o] || 0), 0);
}

export default function VoteBars({ options = [], tally = {}, cast = [], compact = false }) {
  const total = tallyTotal(options, tally);
  const max = Math.max(0, ...options.map((o) => tally[o] || 0));
  return (
    <div className={`bars ${compact ? 'bars-compact' : ''}`}>
      {options.map((o) => {
        const n = tally[o] || 0;
        const pct = total ? Math.round((n * 100) / total) : 0;
        const lead = n > 0 && n === max;
        const m = findCast(cast, o);
        return (
          <div key={o} className={`bar ${lead ? 'lead' : ''}`}>
            <div className="bar-who">
              {m?.photo_url
                ? <img className="bar-avatar" src={m.photo_url} alt="" />
                : <span className="bar-avatar mono-avatar">{o.slice(0, 1)}</span>}
              <span className="bar-name">{o}</span>
            </div>
            <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
            <span className="bar-num">{pct}%<small>{n}</small></span>
          </div>
        );
      })}
    </div>
  );
}
