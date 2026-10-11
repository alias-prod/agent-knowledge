import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import HomePage from "../../apps/web/app/page";
import { PRODUCT_NAME } from "../../apps/web/lib/brand";
import { NAV_COMMANDS } from "../../apps/web/lib/nav";

describe("ALIAS Unified Context Engine identity", () => {
  test("rebrands the landing page and preserves real workspace and ontology destinations", () => {
    const view = render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Unified Context Engine & Ontology Explorer");
    expect(screen.getByRole("link", { name: `${PRODUCT_NAME} home` })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Explore the Ontology" })).toHaveAttribute("href", "/ontology");
    expect(screen.getAllByRole("link", { name: "Open Workspace" })).toHaveLength(2);
    for (const link of screen.getAllByRole("link", { name: "Open Workspace" })) expect(link).toHaveAttribute("href", "/login");
    expect(view.container).not.toHaveTextContent("Agent Knowledge");
    expect(screen.getByRole("complementary", { name: "Illustrative governed context example" })).toBeInTheDocument();
  });

  test("shares document and ontology navigation with the command palette", () => {
    expect(NAV_COMMANDS).toContainEqual(expect.objectContaining({ href: "/documents", label: "Documents" }));
    expect(NAV_COMMANDS).toContainEqual(expect.objectContaining({ href: "/graph", label: "Ontology Explorer" }));
  });
});
