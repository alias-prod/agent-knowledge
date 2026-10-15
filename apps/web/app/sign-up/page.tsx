import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { AuthForm } from "@/components/auth/AuthForm";
export const metadata: Metadata = { title: "Create Account", robots: { index: false, follow: false } };
export default function SignUpPage() { return <AuthFrame title="Create Your Account" description="Start with a verified identity. Create a workspace or join one by invitation."><AuthForm mode="signup" /></AuthFrame>; }
