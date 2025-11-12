"use client";

import { useEffect, useRef } from "react";
import { initToolbar } from "@21st-extension/toolbar";

const stagewiseConfig = {
  plugins: [],
};

export default function StagewiseToolbar(): null {
  const initialized = useRef(false);

  useEffect(() => {
    // Only initialize once and only in development
    if (process.env.NODE_ENV === "development" && !initialized.current) {
      try {
        initToolbar(stagewiseConfig as any);
        initialized.current = true;
      } catch (e) {
        // Guard against runtime errors during init in dev
        // eslint-disable-next-line no-console
        console.warn("Stagewise toolbar failed to initialize:", e);
      }
    }
  }, []);

  return null;
}
