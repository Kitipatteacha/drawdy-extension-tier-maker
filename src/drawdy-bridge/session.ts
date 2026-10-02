import {
  DriverCommand,
  DriverCommandIssuer,
  DriverCommandRequest,
  DriverManifest,
  ModuleStyling,
} from "@drawdy/driver-protocol";

import type { DriverToWebview } from "../panel/messages";

export type Session = {
  manifest: DriverManifest;
  issueCommand: DriverCommandIssuer;
  styling: ModuleStyling;
  actionButtonId: string;
  webviewId: string;
  generateId: () => string;
};

let current: Session | null = null;

export const open = (session: Session): void => {
  current = session;
};

export const isOpen = (): boolean => current !== null;

export function session(): Session {
  if (current === null) throw new Error("driver used before activate");
  return current;
}

export const newElementId = (): string => session().generateId();

export const updateStyling = (styling: ModuleStyling): void => {
  session().styling = styling;
};

/* ------------------------------------------------------------------ */
/* Issuing commands                                                     */
/* ------------------------------------------------------------------ */

type CommandType = DriverCommandRequest["type"];

/** The `req` a command takes, or `undefined` for the ones that take none. */
type ReqOf<T extends CommandType> =
  Extract<DriverCommandRequest, { type: T }> extends { req: infer R }
    ? R
    : undefined;

/** The value a command answers with when it succeeds. */
type ValueOf<T extends CommandType> = Extract<
  Extract<DriverCommand, { type: T }>["res"],
  { error?: never }
>["value"];

let requestId = 0;
const nextRequestId = (): string => String(requestId++);

export async function command<T extends CommandType>(
  type: T,
  ...rest: ReqOf<T> extends undefined ? [] : [req: ReqOf<T>]
): Promise<ValueOf<T> | null> {
  const active = session();
  const res = await active.issueCommand({
    type,
    driverId: active.manifest.driverId,
    requestId: nextRequestId(),
    req: rest[0],
  } as DriverCommandRequest);
  return res.res.error === undefined ? (res.res.value as ValueOf<T>) : null;
}

export function post(message: DriverToWebview): void {
  void command("command:webview:post-message", {
    webviewDomId: session().webviewId,
    message,
  });
}

export const status = (text: string, tone: "info" | "error" = "info"): void =>
  post({ type: "status", text, tone });
