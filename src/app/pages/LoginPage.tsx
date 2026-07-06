import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { sendAdminPin, verifyAdminPassword, verifyAdminPin, checkAdminEmail, signupAdmin, setAuthToken, clearAuthSession } from "../lib/api";
import { toast } from "sonner";

type Step = "email" | "login" | "signup" | "pin";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

// ── Step 1: check email ──────────────────────────────────────────────────
  const handleEmailContinue = async () => {
    setError("");
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setError("Email is required."); return; }
    if (!trimmed.includes("@")) { setError("Please enter a valid email address."); return; }

    setIsLoading(true);
    try {
      const result = await checkAdminEmail(trimmed);
      setEmail(trimmed);
      if (result.error) {
        setError(`Server error: ${result.error}`);
      } else {
        setStep(result.exists ? "login" : "signup");
      }
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 2a: login with existing account ────────────────────────────────
  const handleLogin = async () => {
    setError("");
    if (!password.trim()) { setError("Password is required."); return; }

    setIsLoading(true);
    try {
      const pwResult = await verifyAdminPassword(email, password);
      if (!pwResult.success) { setError(pwResult.error ?? "Incorrect password."); return; }

      const pinResult = await sendAdminPin(email);
      if (!pinResult.success) { setError(pinResult.error ?? "Failed to send PIN."); return; }

      toast.success("PIN sent to your email.");
      setStep("pin");
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 2b: create new account ──────────────────────────────────────────
  const handleSignup = async () => {
    setError("");
    if (!password.trim()) { setError("Password is required."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    setIsLoading(true);
    try {
      const result = await signupAdmin(email, password);
      if (!result.success) { setError(result.error ?? "Sign-up failed."); return; }

      const pinResult = await sendAdminPin(email);
      if (!pinResult.success) { setError(pinResult.error ?? "Account created but failed to send PIN."); return; }

      toast.success("Account created! PIN sent to your email.");
      setStep("pin");
    } catch {
      setError("Sign-up failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 3: verify PIN ───────────────────────────────────────────────────
  const handlePinSubmit = async () => {
    setError("");
    if (!pin.trim() || pin.length !== 6) { setError("Please enter the 6-digit PIN."); return; }

    setIsLoading(true);
    try {
      const result = await verifyAdminPin(email, pin);
      if (result.success) {
        clearAuthSession(); // clear any stale previous session first
        localStorage.setItem("studyPlannerEmail", email);
        localStorage.setItem("studyPlannerAdmin", "true");
        localStorage.setItem("studyPlannerRole", result.role ?? "admin");
        if (result.token) setAuthToken(result.token);
        toast.success("Welcome to Study Planner!");
        navigate("/admin");
      } else {
        setError(result.error ?? "Incorrect PIN.");
      }
    } catch {
      setError("PIN verification failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const titles: Record<Step, string> = {
    email: "Study Planner",
    login: "Welcome back",
    signup: "Create account",
    pin: "Verify PIN",
  };

  const descriptions: Record<Step, string> = {
    email: "Enter your email to continue.",
    login: `Sign in as ${email}`,
    signup: `Set a password for ${email}`,
    pin: "Enter the 6-digit PIN sent to your email.",
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(0,168,133,0.18),transparent_30%),radial-gradient(circle_at_75%_80%,rgba(39,83,210,0.14),transparent_28%)]" />
      <Card className="relative w-full max-w-md border-primary/30 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-2xl">{titles[step]}</CardTitle>
          <CardDescription>{descriptions[step]}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* ── Email step ── */}
          {step === "email" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  onKeyDown={(e) => e.key === "Enter" && handleEmailContinue()}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full bg-primary hover:bg-primary/80" onClick={handleEmailContinue} disabled={isLoading}>
                {isLoading ? "Checking…" : "Continue"}
              </Button>
            </>
          )}

          {/* ── Login step ── */}
          {step === "login" && (
            <>
              <div className="space-y-2">
                {/* Hidden username field so browsers correctly associate password with this email */}
                <input type="hidden" autoComplete="username" value={email} readOnly />
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => { setStep("email"); setPassword(""); setError(""); }}>
                  Back
                </Button>
                <Button className="flex-1 bg-primary hover:bg-primary/80" onClick={handleLogin} disabled={isLoading}>
                  {isLoading ? "Signing in…" : "Sign in"}
                </Button>
              </div>
            </>
          )}

          {/* ── Signup step ── */}
          {step === "signup" && (
            <>
              <p className="text-sm text-muted-foreground -mt-1">
                No account found for this email. Create one below.
              </p>
              <div className="space-y-2">
                <input type="hidden" autoComplete="username" value={email} readOnly />
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-confirm">Confirm password</Label>
                <Input
                  id="signup-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  onKeyDown={(e) => e.key === "Enter" && handleSignup()}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => { setStep("email"); setPassword(""); setConfirmPassword(""); setError(""); }}>
                  Back
                </Button>
                <Button className="flex-1 bg-primary hover:bg-primary/80" onClick={handleSignup} disabled={isLoading}>
                  {isLoading ? "Creating…" : "Create account"}
                </Button>
              </div>
            </>
          )}

          {/* ── PIN step ── */}
          {step === "pin" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="login-pin">6-digit PIN</Label>
                <Input
                  id="login-pin"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  onKeyDown={(e) => e.key === "Enter" && handlePinSubmit()}
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => { setStep("login"); setPin(""); setError(""); }}>
                  Back
                </Button>
                <Button className="flex-1 bg-primary hover:bg-primary/80" onClick={handlePinSubmit} disabled={isLoading}>
                  {isLoading ? "Verifying…" : "Verify PIN"}
                </Button>
              </div>
            </>
          )}

        </CardContent>
      </Card>
    </div>
  );
}