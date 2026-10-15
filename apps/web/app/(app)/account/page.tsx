import type { Metadata } from "next";
import { AccountSettings } from "@/components/auth/AccountSettings";
export const metadata: Metadata = { title: "Your Account", robots: { index: false, follow: false } };
export default function AccountPage() { return <AccountSettings />; }
