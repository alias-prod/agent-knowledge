"use client";

import { useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, drawSelection, keymap, placeholder } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import * as Y from "yjs";
import { DOCUMENT_LIMITS } from "@agent-knowledge/shared";
import { Bold, Code2, Heading2, Italic, List, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { documentError } from "@/lib/documents";

export type SaveState = { status: "saved" | "pending" | "saving" | "error"; message?: string };
export type DocumentEditorHandle = { flush: () => Promise<void>; getContent: () => string };
const REMOTE = Symbol("remote");

const editorTheme = EditorView.theme({
  "&": { background: "var(--background)", color: "var(--foreground)", minHeight: "24rem", fontSize: "1rem" },
  ".cm-scroller": { fontFamily: "var(--font-sans)", lineHeight: "1.6", overflow: "auto" },
  ".cm-content": { padding: "1.5rem", caretColor: "var(--primary)", minHeight: "24rem" },
  ".cm-line": { padding: "0" },
  "&.cm-focused": { outline: "2px solid var(--ring)", outlineOffset: "-2px" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { background: "var(--accent)" },
  ".cm-cursor": { borderLeftColor: "var(--primary)" },
  ".cm-placeholder": { color: "var(--muted-foreground)" },
}, { dark: true });

const highlights = HighlightStyle.define([
  { tag: tags.heading, color: "var(--primary)", fontWeight: "600" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: [tags.link, tags.url], color: "var(--primary)", textDecoration: "underline" },
  { tag: [tags.monospace, tags.quote], color: "var(--graph-secondary)" },
]);

export function CollaborativeEditor({ id, state, readOnly, onSave, onContent, onState, handleRef }: {
  id: string; state: ArrayBuffer; readOnly: boolean;
  onSave: (update: ArrayBuffer) => Promise<unknown>;
  onContent: (value: string) => void;
  onState: (state: SaveState) => void;
  handleRef: RefObject<DocumentEditorHandle | null>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const undoRef = useRef<Y.UndoManager | null>(null);
  const [ready, setReady] = useState(false);
  const reportContent = useEffectEvent(onContent);
  const reportState = useEffectEvent(onState);
  const persist = useEffectEvent(onSave);
  const initialState = useRef(state);

  useEffect(() => {
    if (!host.current) return;
    const doc = new Y.Doc();
    Y.applyUpdate(doc, new Uint8Array(initialState.current), REMOTE);
    const text = doc.getText("content");
    const undoManager = new Y.UndoManager(text);
    docRef.current = doc;
    undoRef.current = undoManager;
    let pending: Uint8Array[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let flight: Promise<unknown> | null = null;
    let disposed = false;

    async function flush(): Promise<void> {
      if (timer) clearTimeout(timer);
      if (flight) { await flight; return flush(); }
      if (!pending.length) return;
      const batch = pending;
      pending = [];
      if (!disposed) reportState({ status: "saving" });
      flight = persist(Uint8Array.from(Y.mergeUpdates(batch)).buffer);
      try {
        await flight;
      } catch (error) {
        pending = [...batch, ...pending];
        if (!disposed) reportState({ status: "error", message: documentError(error) });
        throw error;
      } finally { flight = null; }
      if (pending.length) return flush();
      if (!disposed) reportState({ status: "saved" });
    }

    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: text.toString(),
        extensions: [
          markdown(), EditorView.lineWrapping, drawSelection(), editorTheme, syntaxHighlighting(highlights),
          placeholder("Start writing. Use Markdown for headings, lists, links, and tables…"),
          EditorView.contentAttributes.of({ "aria-label": "Document content", "aria-multiline": "true", "spellcheck": "true" }),
          EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly),
          keymap.of([...yUndoManagerKeymap, ...defaultKeymap]),
          yCollab(text, undefined, { undoManager }),
          EditorState.transactionFilter.of((transaction) => {
            if (transaction.isUserEvent("input") && transaction.newDoc.length > DOCUMENT_LIMITS.content) {
              queueMicrotask(() => reportState({ status: "error", message: `Documents are limited to ${DOCUMENT_LIMITS.content.toLocaleString("en")} characters. Export a copy or shorten the text.` }));
              return [];
            }
            return transaction;
          }),
        ],
      }),
    });
    viewRef.current = view;
    function changed(update: Uint8Array, origin: unknown) {
      if (disposed) return;
      reportContent(text.toString());
      if (origin === REMOTE || readOnly) return;
      pending.push(update);
      reportState({ status: "pending" });
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void flush().catch(() => undefined); }, 750);
    }
    doc.on("update", changed);
    handleRef.current = { flush, getContent: () => text.toString() };
    reportContent(text.toString());
    reportState({ status: "saved" });
    setReady(true);
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      void flush().catch(() => undefined);
      doc.off("update", changed);
      handleRef.current = null;
      viewRef.current = null;
      docRef.current = null;
      undoRef.current = null;
      view.destroy(); undoManager.destroy(); doc.destroy();
    };
  }, [id, readOnly, handleRef]);

  useEffect(() => {
    if (docRef.current) Y.applyUpdate(docRef.current, new Uint8Array(state), REMOTE);
  }, [state]);

  function format(before: string, after = "", line = false) {
    const view = viewRef.current;
    if (!view || readOnly) return;
    const { from, to } = view.state.selection.main;
    const start = line ? view.state.doc.lineAt(from).from : from;
    const selection = view.state.doc.sliceString(start, to);
    const insert = `${before}${selection || (!line ? "text" : "")}${after}`;
    view.dispatch({ changes: { from: start, to, insert }, selection: { anchor: start + before.length, head: start + insert.length - after.length }, userEvent: "input" });
    view.focus();
  }

  return (
    <div className="document-editor" data-editor-ready={ready ? "true" : undefined}>
      {!readOnly && <div className="document-format-bar" role="toolbar" aria-label="Markdown formatting">
        <Button variant="ghost" size="icon" aria-label="Heading" onClick={() => format("## ", "", true)}><Heading2 aria-hidden="true" /></Button>
        <Button variant="ghost" size="icon" aria-label="Bold" onClick={() => format("**", "**")}><Bold aria-hidden="true" /></Button>
        <Button variant="ghost" size="icon" aria-label="Italic" onClick={() => format("_", "_")}><Italic aria-hidden="true" /></Button>
        <Button variant="ghost" size="icon" aria-label="Bullet list" onClick={() => format("- ", "", true)}><List aria-hidden="true" /></Button>
        <Button variant="ghost" size="icon" aria-label="Inline code" onClick={() => format("`", "`")}><Code2 aria-hidden="true" /></Button>
        <Button variant="ghost" size="icon" aria-label="Undo" onClick={() => { undoRef.current?.undo(); viewRef.current?.focus(); }}><Undo2 aria-hidden="true" /></Button>
        <Button variant="ghost" size="icon" aria-label="Redo" onClick={() => { undoRef.current?.redo(); viewRef.current?.focus(); }}><Redo2 aria-hidden="true" /></Button>
      </div>}
      <div ref={host} className="min-w-0" />
    </div>
  );
}
