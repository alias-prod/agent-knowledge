import type { Metadata } from "next";
import { Suspense } from "react";
import { DocumentWorkspace } from "@/components/documents/DocumentWorkspace";

export const metadata: Metadata = {
  title: "Documents",
  description: "Write together, connect documents to your ontology, and govern the knowledge your agents use.",
  robots: { index: false, follow: false },
};

export default function DocumentsPage() {
  return (
    <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Loading document workspace…</p>}>
      <DocumentWorkspace />
    </Suspense>
  );
}
