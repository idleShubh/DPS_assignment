import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const workspaceNames = ["@lagovia/backend", "@lagovia/frontend"];
const children = workspaceNames.map((workspace) =>
  spawn(npmCommand, ["run", "dev", "--workspace", workspace], {
    env: process.env,
    stdio: "inherit",
  }),
);

let stopping = false;

function stop(signal) {
  if (stopping) {
    return;
  }
  stopping = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

for (const child of children) {
  child.on("error", (error) => {
    console.error("Failed to start a development process.", error);
    process.exitCode = 1;
    stop("SIGTERM");
  });
  child.on("exit", (code, signal) => {
    if (stopping) {
      return;
    }
    if (code !== 0) {
      console.error(
        `A development process stopped unexpectedly (${signal ?? `exit ${code}`}).`,
      );
    }
    process.exitCode = code ?? 1;
    stop("SIGTERM");
  });
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
