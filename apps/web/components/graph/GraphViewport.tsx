"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Box, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BrainSceneProps } from "./BrainScene";
import { usePageVisible } from "./use-graph-preferences";

function SceneLoading() {
  return <div className="graph-scene-message" role="status"><Box className="size-6 text-primary" aria-hidden="true" /><p>Preparing the 3D hierarchy…</p></div>;
}

const BrainScene = dynamic(() => import("./BrainScene"), { ssr: false, loading: SceneLoading });

class SceneBoundary extends Component<{ children: ReactNode; onListView: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <UnavailableScene onListView={this.props.onListView} />;
    }
    return this.props.children;
  }
}

function UnavailableScene({ onListView }: { onListView: () => void }) {
  return (
    <div className="graph-scene-message" role="status">
      <ListTree className="size-6 text-primary" aria-hidden="true" />
      <h3 className="text-lg font-medium text-foreground">3D is unavailable in this browser</h3>
      <p className="max-w-sm text-pretty text-center">You can still explore every node and relationship in the accessible list view.</p>
      <Button variant="outline" onClick={onListView}>Use List View</Button>
    </div>
  );
}

export function GraphViewport({ data, rotate, onSelect, onListView }: Omit<BrainSceneProps, "onUnavailable"> & { onListView: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const [contextLost, setContextLost] = useState(false);
  const pageVisible = usePageVisible();
  const handleUnavailable = useCallback(() => setContextLost(true), []);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "160px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={container} className="graph-viewport" aria-label="Interactive company brain" role="region">
      {contextLost ? <UnavailableScene onListView={onListView} /> : (
        <SceneBoundary onListView={onListView}>
          {inView && pageVisible ? (
            <BrainScene data={data} rotate={rotate} onSelect={onSelect} onUnavailable={handleUnavailable} />
          ) : (
            <div className="graph-scene-message"><p>3D rendering paused while out of view.</p></div>
          )}
        </SceneBoundary>
      )}
    </div>
  );
}
