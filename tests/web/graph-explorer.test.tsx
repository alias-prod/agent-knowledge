import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { GraphSnapshot } from "@agent-knowledge/shared";
import { GraphExplorer } from "../../apps/web/components/graph/GraphExplorer";

const preferences = vi.hoisted(() => ({ reducedMotion: false }));

vi.mock("next/navigation", () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("../../apps/web/components/graph/use-graph-preferences", () => ({
  useReducedMotion: () => preferences.reducedMotion,
}));

vi.mock("../../apps/web/components/graph/GraphViewport", () => ({
  GraphViewport: ({ onSelect, onListView }: { onSelect: (node: { id: string }) => void; onListView: () => void }) => <div aria-label="3D viewport"><button onClick={() => onSelect({ id: "type:knowledge" })}>Select Knowledge in 3D</button><button onClick={onListView}>Unavailable 3D fallback</button></div>,
}));

beforeEach(() => {
  preferences.reducedMotion = false;
  window.history.replaceState(null, "", "/ontology");
});

describe("graph explorer controls", () => {
  test("labels the public ontology honestly and links workspace lenses to the protected route", () => {
    render(<GraphExplorer />);
    expect(screen.getByText("You're exploring the application ontology.")).toBeInTheDocument();
    const lenses = screen.getByRole("navigation", { name: "Graph lenses" });
    expect(within(lenses).getByRole("link", { name: /Knowledge/ })).toHaveAttribute("href", "/graph?lens=knowledge");
    expect(within(lenses).getByRole("link", { name: "Ontology" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText(/No workspace records or personal data are loaded/)).toBeInTheDocument();
  });

  test("inspects 3D selections and follows actual schema relationships", () => {
    const view = render(<GraphExplorer />);
    fireEvent.click(screen.getByRole("button", { name: "Select Knowledge in 3D" }));
    view.rerender(<GraphExplorer />);
    const inspector = screen.getByRole("region", { name: "Node Inspector" });
    expect(within(inspector).getByRole("heading", { name: "Knowledge" })).toBeInTheDocument();
    fireEvent.click(within(inspector).getByRole("button", { name: /Knowledge.*assigned to.*Agents/ }));
    view.rerender(<GraphExplorer />);
    expect(within(screen.getByRole("region", { name: "Node Inspector" })).getByRole("heading", { name: "Agents" })).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("node")).toBe("type:agents");
  });

  test("searches schema fields, handles no results, and clears search", () => {
    const view = render(<GraphExplorer />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search graph nodes" }), { target: { value: "no-such-field-987" } });
    view.rerender(<GraphExplorer />);
    expect(screen.getByText("No matching nodes. Try a different search or clear the filters.")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Clear Filters" })[0]);
    view.rerender(<GraphExplorer />);
    expect(screen.getByRole("searchbox", { name: "Search graph nodes" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "Next node page" })).toBeInTheDocument();
  });

  test("uses the accessible list without mounting 3D for reduced motion", () => {
    preferences.reducedMotion = true;
    render(<GraphExplorer />);
    expect(screen.queryByLabelText("3D viewport")).not.toBeInTheDocument();
    expect(screen.getByText(/respect your reduced-motion preference/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Graph nodes" })).toBeInTheDocument();
  });

  test("keeps all nodes available when 3D is unavailable", () => {
    const view = render(<GraphExplorer />);
    fireEvent.click(screen.getByRole("button", { name: "Unavailable 3D fallback" }));
    view.rerender(<GraphExplorer />);
    expect(screen.queryByLabelText("3D viewport")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Graph nodes" })).toBeInTheDocument();
  });

  test("renders the live empty state without substituting demo records", () => {
    const snapshot: GraphSnapshot = { organizationId: "empty", organizationName: "Empty workspace", knowledge: [], agents: [], retrievals: [], truncated: { knowledge: false, agents: false, retrievals: false } };
    window.history.replaceState(null, "", "/graph?lens=knowledge");
    render(<GraphExplorer snapshot={snapshot} />);
    expect(screen.getByText("Your graph starts with knowledge")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add Knowledge" })).toHaveAttribute("href", "/knowledge");
    expect(screen.queryByText("You're exploring the application ontology.")).not.toBeInTheDocument();
  });
});
