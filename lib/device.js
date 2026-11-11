'use client';

let memoryId = null;

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

export function getDeviceId() {
  try {
    let id = localStorage.getItem('adi_device');
    if (!id) {
      id = makeId();
      localStorage.setItem('adi_device', id);
    }
    return id;
  } catch {
    memoryId = memoryId || makeId();
    return memoryId;
  }
}

export function getStored(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function setStored(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
}
