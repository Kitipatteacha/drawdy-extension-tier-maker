import { TableConfig, sanitizeConfig } from "../table/config";
import { command } from "./session";

const CONFIG_KEY = "drawdy-tiermaker-config";

export async function loadConfig(): Promise<TableConfig | null> {
  const res = await command("command:kv-storage:get", { key: CONFIG_KEY });
  const stored = res?.got?.["config"];
  return stored === undefined ? null : sanitizeConfig(stored);
}

export async function saveConfig(config: TableConfig): Promise<void> {
  await command("command:kv-storage:set", {
    key: CONFIG_KEY,
    payload: { config },
  });
}
