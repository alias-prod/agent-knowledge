import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { AuthForm } from "@/components/auth/AuthForm";
export const metadata: Metadata = { title: "Forgot Password", robots: { index: false, follow: false } };
export default function ForgotPasswordPage() { return <AuthFrame title="Recover Your Account" description="Enter your account email. We will send a secure link to choose a new password."><AuthForm mode="forgot" /></AuthFrame>; }
