"use client";

import * as React from "react";

export function useAnimatedListPresence(
  keys: string[],
  duration: number,
): {
  presentKeys: Set<string>;
  exiting: Set<string>;
} {
  const [presentKeys, setPresentKeys] = React.useState<Set<string>>(
    () => new Set(keys),
  );
  const [exiting, setExiting] = React.useState<Set<string>>(new Set());
  const keysSignature = keys.join("|");
  const prevKeysSignatureRef = React.useRef(keysSignature);

  React.useEffect(() => {
    if (keysSignature === prevKeysSignatureRef.current) return;

    const prevKeys = prevKeysSignatureRef.current.split("|").filter(Boolean);
    const nextKeySet = new Set(keys);
    const prevKeySet = new Set(prevKeys);
    prevKeysSignatureRef.current = keysSignature;

    prevKeySet.forEach((k) => {
      if (!nextKeySet.has(k)) {
        setExiting((s) => new Set(s).add(k));
        window.setTimeout(() => {
          setExiting((s) => {
            const nx = new Set(s);
            nx.delete(k);
            return nx;
          });
          setPresentKeys((s) => {
            const nx = new Set(s);
            nx.delete(k);
            return nx;
          });
        }, duration);
      }
    });

    keys.forEach((k) => {
      if (!prevKeySet.has(k)) {
        setPresentKeys((s) => new Set(s).add(k));
      }
    });
  }, [duration, keys, keysSignature]);

  return { presentKeys, exiting };
}
