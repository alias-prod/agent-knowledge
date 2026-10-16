"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { NAV_COMMANDS } from "@/lib/nav";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const handle = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !event.isComposing && event.keyCode !== 229) { event.preventDefault(); setOpen(value => !value); } };
    window.addEventListener("keydown", handle); return () => window.removeEventListener("keydown", handle);
  }, []);
  const search = query.trim().toLowerCase();
  const commands = NAV_COMMANDS.filter(command => `${command.label} ${command.description} ${command.group}`.toLowerCase().includes(search));
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Workspace Commands</DialogTitle><DialogDescription>Find a page or open your workspace companion.</DialogDescription></DialogHeader><label className="sr-only" htmlFor="command-search">Search Commands</label><Input id="command-search" value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" placeholder="Search workspace pages…" /><div className="flex max-h-96 flex-col gap-2 overflow-y-auto"><Button variant="outline" onClick={() => { setOpen(false); window.dispatchEvent(new Event("alias:open-assistant")); }}>Ask ALIAS</Button>{commands.map(command => <Link key={command.href} href={command.href} onClick={() => { setOpen(false); setQuery(""); }} className="flex min-h-11 flex-col rounded-md px-3 py-3 text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring"><span>{command.label}</span><span className="text-muted-foreground">{command.description}</span></Link>)}{!commands.length && <p className="text-sm text-muted-foreground">No matching pages. Try Documents, Graph, or Members.</p>}</div></DialogContent></Dialog>;
}
