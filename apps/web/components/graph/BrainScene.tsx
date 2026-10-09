"use client";

import { useCallback, useState } from "react";
import { CompanyBrain, type Brain, type BrainNode } from "company-brain-3d";
import "company-brain-3d/style.css";

export type BrainSceneProps = {
  data: Brain;
  rotate: boolean;
  onSelect: (node: BrainNode) => void;
  onUnavailable: () => void;
};

export default function BrainScene({ data, rotate, onSelect, onUnavailable }: BrainSceneProps) {
  const [palette, setPalette] = useState<string[] | null>(null);
  const mount = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const styles = getComputedStyle(element);
    setPalette(["--primary", "--graph-secondary", "--foreground", "--muted-foreground"].map((name) => styles.getPropertyValue(name).trim()));
    const handleLoss = (event: Event) => {
      event.preventDefault();
      onUnavailable();
    };
    element.addEventListener("webglcontextlost", handleLoss, true);
    return () => element.removeEventListener("webglcontextlost", handleLoss, true);
  }, [onUnavailable]);

  return (
    <div ref={mount} className="graph-scene">
      {palette && (
        <CompanyBrain
          data={data}
          onSelect={onSelect}
          autoRotate={rotate}
          scrollZoom={false}
          height="100%"
          maxWidth="none"
          background="transparent"
          palette={palette}
          className="knowledge-brain"
        />
      )}
    </div>
  );
}
