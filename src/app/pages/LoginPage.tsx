import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { sendAdminPin, verifyAdminPassword, verifyAdminPin } from "../lib/api";
import { toast } from "sonner";

type Step = "credentials" | "pin";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<Step>("credentials");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isAdminEmail = email.includes("@gmail.com");

  const handleLogin = async () => {
    setError("");
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    setIsLoading(true);

    try {
      if (isAdminEmail) {
        if (!password.trim()) {
          setError("Password is required for admin login.");
          setIsLoading(false);
          return;
        }
        const pwResult = await verifyAdminPassword(password);
        if (!pwResult.success) {
          setError(pwResult.error ?? "Incorrect password.");
          setIsLoading(false);
          return;
        }
        const pinResult = await sendAdminPin();
        if (!pinResult.success) {
          setError(pinResult.error ?? "Failed to send PIN.");
          setIsLoading(false);
          return;
        }
        toast.success("PIN sent to the configured admin email.");
        setStep("pin");
      } else {
        // Non-admin users go straight to the planner
        localStorage.setItem("studyPlannerEmail", email.trim());
        navigate("/");
      }
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSubmit = async () => {
    setError("");
    if (!pin.trim() || pin.length !== 6) {
      setError("Please enter the 6-digit PIN.");
      return;
    }
    setIsLoading(true);
    try {
      const result = await verifyAdminPin(pin);
      if (result.success) {
        localStorage.setItem("studyPlannerEmail", email.trim());
        localStorage.setItem("studyPlannerAdmin", "true");
        toast.success("Admin login successful.");
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(0,168,133,0.18),transparent_30%),radial-gradient(circle_at_75%_80%,rgba(39,83,210,0.14),transparent_28%)]" />
      <Card className="relative w-full max-w-md border-primary/30 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-2xl">
            {step === "pin" ? "Verify PIN" : "Study Planner"}
          </CardTitle>
          <CardDescription>
            {step === "pin"
              ? "Enter the 6-digit PIN sent to the configured admin email."
              : "Enter your email to access the planner. Admin access requires a Gmail address and password."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "credentials" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
              </div>
              {isAdminEmail && (
                <div className="space-y-2">
                  <Label htmlFor="login-password">Admin Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Admin password"
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  />
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" onClick={handleLogin} disabled={isLoading}>
                {isLoading ? "Checking..." : "Continue"}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="login-pin">6-digit PIN</Label>
                <Input
                  id="login-pin"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  onKeyDown={(e) => e.key === "Enter" && handlePinSubmit()}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => { setStep("credentials"); setPin(""); setError(""); }}>
                  Back
                </Button>
                <Button className="flex-1" onClick={handlePinSubmit} disabled={isLoading}>
                  {isLoading ? "Verifying..." : "Verify PIN"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
