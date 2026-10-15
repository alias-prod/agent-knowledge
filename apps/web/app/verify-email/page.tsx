import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { AuthForm } from "@/components/auth/AuthForm";
export const metadata: Metadata = { title: "Verify Email", robots: { index: false, follow: false } };
export default function VerifyEmailPage() { return <AuthFrame title="Verify Your Email" description="Check your inbox for your verification link, or request another one here."><AuthForm mode="verify" /></AuthFrame>; }
