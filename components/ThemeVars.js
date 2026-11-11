'use client';
import { useEffect } from 'react';

const isHex = (v) => typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v.trim());

export default function ThemeVars({ settings }) {
  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement.style;
    const map = {
      '--bg': settings.color_bg,
      '--surface': settings.color_surface,
      '--accent': settings.color_accent,
      '--ink': settings.color_ink,
    };
    for (const [k, v] of Object.entries(map)) if (isHex(v)) root.setProperty(k, v.trim());
  }, [settings]);
  return null;
}
