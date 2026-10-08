import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import { AppShell } from "../AppShell";
import { ConvexClientProvider } from "../ConvexClientProvider";
import { ToastProvider } from "../components/ToastProvider";

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthKitProvider>
      <ConvexClientProvider>
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </ConvexClientProvider>
    </AuthKitProvider>
  );
}
