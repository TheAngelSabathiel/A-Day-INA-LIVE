'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function QR({ url, dark = '#241314', light = '#FFFFFF', className = '' }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark, light } })
      .then((svg) => alive && setSrc('data:image/svg+xml;utf8,' + encodeURIComponent(svg)))
      .catch(() => {});
    return () => { alive = false; };
  }, [url, dark, light]);
  return src ? <img className={`qr ${className}`} src={src} alt={`QR code para sa ${url}`} /> : <div className={`qr ${className}`} />;
}

export function useJoinUrl(settings) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    setUrl((settings?.public_url || '').trim() || window.location.origin);
  }, [settings?.public_url]);
  return url;
}

export function prettyUrl(url) {
  return (url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
}
