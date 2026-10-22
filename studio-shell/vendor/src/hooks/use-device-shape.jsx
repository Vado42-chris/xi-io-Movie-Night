import { useEffect, useState } from 'react';
import { DEVICE } from '@/lib/chatSnap.mjs';

/* Which of the contract's three devices this viewport is. `projectionForDevice`
   answers a conversation's SHAPE from this, so the value has to be named the way
   the contract names it — a surface that passed 'small' or 'phone' would be
   answered DEVICE_REQUIRED and would fall back to whatever it guessed. */
const query = () =>
  typeof window === 'undefined'
    ? DEVICE.DESKTOP
    : window.matchMedia('(min-width: 1024px)').matches
      ? DEVICE.DESKTOP
      : window.matchMedia('(min-width: 768px)').matches
        ? DEVICE.TABLET
        : DEVICE.MOBILE;

export function useDeviceShape() {
  const [device, setDevice] = useState(query);

  useEffect(() => {
    const mql = [window.matchMedia('(min-width: 1024px)'), window.matchMedia('(min-width: 768px)')];
    const onChange = () => setDevice(query());
    onChange();
    mql.forEach((m) => m.addEventListener('change', onChange));
    return () => mql.forEach((m) => m.removeEventListener('change', onChange));
  }, []);

  return device;
}