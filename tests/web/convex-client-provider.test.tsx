import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Abel: () => ({ variable: "font-abel" }),
}));

const mocks = vi.hoisted(() => ({
  client: vi.fn(function (this: { url: string }, url: string) {
    this.url = url;
  }),
  provider: vi.fn(),
}));

vi.mock("convex/react", () => ({
  ConvexReactClient: mocks.client,
  ConvexProviderWithAuth: (props: {
    children: ReactNode;
    client: unknown;
    useAuth: unknown;
  }) => {
    mocks.provider(props);
    return props.children;
  },
}));

vi.mock("@workos-inc/authkit-nextjs/components", () => ({
  useAuth: () => ({ user: null, loading: false }),
  useAccessToken: () => ({
    getAccessToken: vi.fn(),
    refresh: vi.fn(),
  }),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ConvexClientProvider", () => {
  test.each([undefined, "", "  \n  "])(
    "handles an unavailable deployment URL (%j) without mounting consumers",
    async (url) => {
      vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", url);
      const { ConvexClientProvider } = await import(
        "../../apps/web/app/ConvexClientProvider"
      );
      const Consumer = vi.fn(() => <p>Workspace data</p>);

      expect(mocks.client).not.toHaveBeenCalled();
      render(
        <ConvexClientProvider>
          <Consumer />
        </ConvexClientProvider>
      );

      expect(
        screen.getByRole("heading", { name: "Workspace connection unavailable" })
      ).toBeInTheDocument();
      expect(screen.getByText("NEXT_PUBLIC_CONVEX_URL")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute(
        "href",
        "/"
      );
      expect(Consumer).not.toHaveBeenCalled();
      expect(mocks.client).not.toHaveBeenCalled();
      expect(mocks.provider).not.toHaveBeenCalled();
    }
  );

  test("initializes a configured client lazily and reuses it on rerenders", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", " https://example.convex.cloud ");
    const { ConvexClientProvider } = await import(
      "../../apps/web/app/ConvexClientProvider"
    );

    expect(mocks.client).not.toHaveBeenCalled();
    const { rerender } = render(
      <ConvexClientProvider>Workspace data</ConvexClientProvider>
    );

    expect(mocks.client).toHaveBeenCalledExactlyOnceWith(
      "https://example.convex.cloud"
    );
    expect(screen.getByText("Workspace data")).toBeInTheDocument();
    const firstProps = mocks.provider.mock.calls[0][0];
    expect(firstProps.useAuth).toBeTypeOf("function");

    rerender(<ConvexClientProvider>Updated data</ConvexClientProvider>);

    expect(mocks.client).toHaveBeenCalledTimes(1);
    expect(mocks.provider.mock.lastCall?.[0].client).toBe(firstProps.client);
    expect(screen.getByText("Updated data")).toBeInTheDocument();
  });

  test("renders the public layout without initializing backend providers", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", undefined);
    const { default: RootLayout } = await import(
      "../../apps/web/app/layout"
    );

    const html = renderToStaticMarkup(
      <RootLayout>
        <main>Public homepage</main>
      </RootLayout>
    );

    expect(html).toContain("<main>Public homepage</main>");
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.provider).not.toHaveBeenCalled();
  });
});
