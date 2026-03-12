import { checkDatabaseHealth, DatabaseHealthResult } from "@/lib/db-health";
import ConfigClient from "./ConfigClient";

export const dynamic = "force-dynamic";

export type ConfigPageState =
  | { type: "unconfigured" }
  | { type: "healthy"; health: DatabaseHealthResult }
  | { type: "unreachable"; health: DatabaseHealthResult };

export default async function ConfigPage() {
  const dbConfigured = process.env.NEXT_PUBLIC_DB_CONFIGURED;

  let state: ConfigPageState;

  if (dbConfigured !== "true") {
    state = { type: "unconfigured" };
  } else {
    const health = await checkDatabaseHealth();
    if (health.status === "healthy") {
      state = { type: "healthy", health };
    } else {
      state = { type: "unreachable", health };
    }
  }

  return <ConfigClient initialState={state} />;
}
