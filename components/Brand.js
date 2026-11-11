export function brandUrl(settings) {
  if (!settings) return null;
  return settings.logo_mode === 'logo'
    ? settings.logo_url || settings.sublogo_url
    : settings.sublogo_url || settings.logo_url;
}

export function Brand({ settings, size = 'md', className = '' }) {
  const title = settings?.show_title || 'A Day INA: LIVE';
  const url = brandUrl(settings);
  if (url) return <img src={url} alt={title} className={`brand-img brand-${size} ${className}`} />;
  return <Wordmark title={title} size={size} className={className} />;
}

export function Wordmark({ title, size = 'md', className = '' }) {
  const parts = String(title).split(/(INA)/);
  return (
    <span className={`wordmark brand-${size} ${className}`} role="img" aria-label={title}>
      {parts.map((p, i) => (p === 'INA' ? <b key={i}>INA</b> : <span key={i}>{p}</span>))}
    </span>
  );
}
