import { spawn } from "node:child_process";
import { resolve } from "node:path";

const build = process.argv.includes("--build");
const watch = process.argv.includes("--watch");
const bin = (name) => resolve("node_modules", ".bin", process.platform === "win32" ? `${name}.cmd` : name);
function run(name, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(bin(name), args, { stdio: "inherit", env: process.env, shell: process.platform === "win32" });
    const stop = () => child.kill("SIGTERM");
    process.once("SIGINT", stop); process.once("SIGTERM", stop);
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop);
      if (code === 0) resolveRun(); else reject(new Error(`${name} exited ${code ?? signal}`));
    });
  });
}
try {
  await run("electrobun", ["prepare"]);
  await run("vite", ["build"]);
  await run("electrobun", build ? ["build", "--env=stable"] : ["dev", ...(watch ? ["--watch"] : [])]);
} catch (error) {
  console.error(error.message); process.exitCode = 1;
}
