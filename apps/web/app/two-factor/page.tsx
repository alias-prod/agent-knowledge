import { AuthFrame } from "@/components/auth/AuthFrame";
import { TwoFactorChallenge } from "@/components/auth/TwoFactorChallenge";
export default function TwoFactorPage() {
  return <AuthFrame title="Verify Your Identity" description="Complete the second factor to finish signing in."><TwoFactorChallenge /></AuthFrame>;
}
