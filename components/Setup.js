export default function Setup({ status }) {
  if (status === 'loading') {
    return (
      <div className="center-screen">
        <div className="loader" aria-label="Loading" />
      </div>
    );
  }
  return (
    <div className="center-screen">
      <div className="setup-card">
        <h1>{status === 'unconfigured' ? 'Kulang ang setup' : 'Hindi maka-connect'}</h1>
        {status === 'unconfigured' ? (
          <p>Ilagay ang <code>NEXT_PUBLIC_SUPABASE_URL</code> at <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> sa Vercel environment variables, tapos i-redeploy.</p>
        ) : (
          <p>Hindi ma-load ang show. I-check ang internet, o kung na-run na ang <code>supabase/schema.sql</code>. I-refresh ang page.</p>
        )}
      </div>
    </div>
  );
}
