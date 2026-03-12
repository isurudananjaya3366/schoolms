"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import type { ConfigPageState } from "./page";
import type { DatabaseHealthResult } from "@/lib/db-health";

export default function ConfigClient({
  initialState,
}: {
  initialState: ConfigPageState;
}) {
  const router = useRouter();
  const [currentState, setCurrentState] =
    useState<ConfigPageState>(initialState);
  const [step, setStep] = useState<1 | 2>(1);
  const [connectionString, setConnectionString] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [envWriteWarning, setEnvWriteWarning] = useState<string | null>(null);

  // Superadmin form fields
  const [saName, setSaName] = useState("");
  const [saEmail, setSaEmail] = useState("");
  const [saPassword, setSaPassword] = useState("");
  const [saConfirmPassword, setSaConfirmPassword] = useState("");

  // Health data for live refresh in State B
  const [healthData, setHealthData] = useState<DatabaseHealthResult | null>(
    initialState.type === "healthy" || initialState.type === "unreachable"
      ? initialState.health
      : null
  );

  // Update connection string toggle
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updateConnectionString, setUpdateConnectionString] = useState("");

  async function handleConnect() {
    setError(null);
    setSuccess(null);
    setEnvWriteWarning(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/config/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Connection failed");
        return;
      }

      if (data.envWriteWarning) {
        setEnvWriteWarning(data.envWriteWarning);
      }

      if (data.needsSuperadmin) {
        setStep(2);
      } else {
        setSuccess("Database connected successfully. Redirecting...");
        setTimeout(() => router.push("/login?setup=complete"), 1500);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateSuperadmin() {
    setError(null);
    setSuccess(null);

    // Client validation
    if (saPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (saPassword !== saConfirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/config/superadmin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saName,
          email: saEmail,
          password: saPassword,
          confirmPassword: saConfirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create superadmin");
        return;
      }

      router.push("/login?setup=complete");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleHealthCheck() {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/config/health");
      const data: DatabaseHealthResult = await res.json();
      setHealthData(data);

      if (data.status === "healthy") {
        setCurrentState({ type: "healthy", health: data });
      } else if (data.status === "unreachable") {
        setCurrentState({ type: "unreachable", health: data });
      }
    } catch {
      setError("Failed to fetch health status");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdateConnection() {
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/config/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString: updateConnectionString }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Connection failed");
        return;
      }

      setSuccess(
        "Connection string updated. You may need to redeploy for changes to take effect in production."
      );
      setShowUpdateForm(false);
      setUpdateConnectionString("");

      // Refresh health
      await handleHealthCheck();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // ─── State A: Unconfigured ─────────────────────────────
  if (currentState.type === "unconfigured") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <h1 className="text-2xl font-bold text-blue-600">SchoolMS</h1>
            <CardTitle className="text-xl">
              {step === 1 ? "Connect Your Database" : "Create Superadmin Account"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {step === 1
                ? "Step 1 of 2 — Connect Database"
                : "Step 2 of 2 — Create Superadmin"}
            </p>
            <div className="flex justify-center pt-2">
              <Badge variant="destructive">No Database Configured</Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert>
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {envWriteWarning && (
              <Alert>
                <AlertTitle>Note</AlertTitle>
                <AlertDescription>{envWriteWarning}</AlertDescription>
              </Alert>
            )}

            {step === 1 ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="connectionString">
                    MongoDB Connection String
                  </Label>
                  <Input
                    id="connectionString"
                    type="password"
                    placeholder="mongodb+srv://..."
                    value={connectionString}
                    onChange={(e) => setConnectionString(e.target.value)}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Your MongoDB Atlas connection string. This will be stored as
                    DATABASE_URL.
                  </p>
                </div>

                <Button
                  className="w-full"
                  onClick={handleConnect}
                  disabled={isLoading || !connectionString}
                >
                  {isLoading ? "Connecting..." : "Connect & Initialise"}
                </Button>

                <Separator />

                <details className="text-sm">
                  <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                    Need help?
                  </summary>
                  <div className="mt-2 space-y-2 text-muted-foreground">
                    <p>
                      1. Go to{" "}
                      <a
                        href="https://cloud.mongodb.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        MongoDB Atlas
                      </a>
                    </p>
                    <p>2. Create a free cluster if you haven&apos;t already</p>
                    <p>
                      3. Click &quot;Connect&quot; → &quot;Connect your
                      application&quot;
                    </p>
                    <p>4. Copy the connection string</p>
                    <p>
                      5. Replace &lt;password&gt; with your database
                      user&apos;s password
                    </p>
                  </div>
                </details>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="saName">Full Name</Label>
                  <Input
                    id="saName"
                    placeholder="John Doe"
                    value={saName}
                    onChange={(e) => setSaName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="saEmail">Email</Label>
                  <Input
                    id="saEmail"
                    type="email"
                    placeholder="admin@school.com"
                    value={saEmail}
                    onChange={(e) => setSaEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="saPassword">Password</Label>
                  <Input
                    id="saPassword"
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={saPassword}
                    onChange={(e) => setSaPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="saConfirmPassword">Confirm Password</Label>
                  <Input
                    id="saConfirmPassword"
                    type="password"
                    placeholder="Re-enter password"
                    value={saConfirmPassword}
                    onChange={(e) => setSaConfirmPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={handleCreateSuperadmin}
                  disabled={
                    isLoading || !saName || !saEmail || !saPassword || !saConfirmPassword
                  }
                >
                  {isLoading ? "Creating Account..." : "Create Account"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── State B: Healthy ──────────────────────────────────
  if (currentState.type === "healthy") {
    const health = healthData || currentState.health;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">Database Configuration</CardTitle>
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Database Healthy
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert>
                <AlertTitle>Info</AlertTitle>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {health.clusterName && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cluster</span>
                <span className="font-mono">{health.clusterName}</span>
              </div>
            )}

            {health.latencyMs !== null && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Latency</span>
                <span>{health.latencyMs}ms</span>
              </div>
            )}

            <Separator />

            {health.collectionCounts && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Collection Counts</h3>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries(health.collectionCounts).map(
                        ([name, count]) => (
                          <tr key={name} className="border-b last:border-0">
                            <td className="px-3 py-2 capitalize text-muted-foreground">
                              {name.replace(/([A-Z])/g, " $1").trim()}
                            </td>
                            <td className="px-3 py-2 text-right font-mono">
                              {count}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleHealthCheck}
                disabled={isLoading}
              >
                {isLoading ? "Checking..." : "Run Health Check"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowUpdateForm(!showUpdateForm)}
              >
                Update Connection String
              </Button>
            </div>

            {showUpdateForm && (
              <div className="space-y-2 rounded-md border p-3">
                <Label htmlFor="updateConnectionString">
                  New Connection String
                </Label>
                <Input
                  id="updateConnectionString"
                  type="password"
                  placeholder="mongodb+srv://..."
                  value={updateConnectionString}
                  onChange={(e) => setUpdateConnectionString(e.target.value)}
                  disabled={isLoading}
                />
                <Button
                  onClick={handleUpdateConnection}
                  disabled={isLoading || !updateConnectionString}
                >
                  {isLoading ? "Updating..." : "Update & Reconnect"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── State C: Unreachable ──────────────────────────────
  const health = healthData || currentState.health;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Database Configuration</CardTitle>
            <Badge variant="destructive">Database Unreachable</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <AlertTitle>Info</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <Alert variant="destructive">
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription>
              {health.errorMessage || "Unable to reach the database."}
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Troubleshooting</h3>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>Verify your MongoDB Atlas cluster is running</li>
              <li>Check that your IP address is whitelisted</li>
              <li>Confirm the DATABASE_URL connection string is correct</li>
              <li>Ensure the database user has read/write permissions</li>
              <li>Check your network connectivity and firewall rules</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleHealthCheck}
              disabled={isLoading}
            >
              {isLoading ? "Checking..." : "Retry Connection"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowUpdateForm(!showUpdateForm)}
            >
              Update Connection String
            </Button>
          </div>

          {showUpdateForm && (
            <div className="space-y-2 rounded-md border p-3">
              <Label htmlFor="updateConnectionString">
                New Connection String
              </Label>
              <Input
                id="updateConnectionString"
                type="password"
                placeholder="mongodb+srv://..."
                value={updateConnectionString}
                onChange={(e) => setUpdateConnectionString(e.target.value)}
                disabled={isLoading}
              />
              <Button
                onClick={handleUpdateConnection}
                disabled={isLoading || !updateConnectionString}
              >
                {isLoading ? "Updating..." : "Update & Reconnect"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
