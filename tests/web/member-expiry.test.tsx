import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import MembersPage from "../../apps/web/app/(app)/members/page";

const state = vi.hoisted(() => ({ expiresAt: 0 }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ authOrganizationId: "auth_org", user: { id: "user" }, role: "admin" }) }));
vi.mock("@/lib/auth-client", () => ({ authClient: {
  useActiveOrganization: () => ({ data: { name: "Test", members: [], invitations: [{ id: "invite", email: "invite@example.com", role: "member", status: "pending", expiresAt: state.expiresAt }] }, isPending: false, refetch: vi.fn() }),
} }));
vi.mock("../../apps/web/app/components/ConfirmDialog", () => ({ ConfirmDialog: () => null }));

afterEach(() => { cleanup(); vi.useRealTimers(); });
describe("invitation expiry rendering", () => {
  test("updates expiration without another organization fetch and clears its clock on unmount", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T12:00:00Z"));
    state.expiresAt = Date.now() + 10_000;
    const { unmount } = render(<MembersPage />);
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByText("member · pending")).toBeTruthy();
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByText("member · pending · expired")).toBeTruthy();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  test("marks an already-expired invitation after the client clock initializes", () => {
    vi.useFakeTimers();
    state.expiresAt = Date.now() - 1000;
    render(<MembersPage />);
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByText("member · pending · expired")).toBeTruthy();
  });
});
