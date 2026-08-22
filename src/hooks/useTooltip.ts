import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@nubkins:tooltip:';

/**
 * Shows a one-time tooltip when `condition` first becomes true.
 * Once dismissed it is stored in AsyncStorage and never shown again.
 */
export function useTooltip(key: string, condition = true) {
  const [visible, setVisible] = useState(false);
  const triggered = useRef(false);

  useEffect(() => {
    if (!condition || triggered.current) return;
    triggered.current = true;
    AsyncStorage.getItem(PREFIX + key).then(seen => {
      if (!seen) setVisible(true);
    });
  }, [key, condition]);

  function dismiss() {
    setVisible(false);
    AsyncStorage.setItem(PREFIX + key, '1');
  }

  return { visible, dismiss };
}
