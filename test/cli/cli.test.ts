import { exists } from "../../deps.ts";
import {
  __,
  assert,
  assertStrContains,
  assertStrictEq,
  path,
} from "../../dev_deps.ts";

const { dirname } = __(import.meta);

const CLIFileLocation = path.resolve(dirname, "../../cli.ts");

Deno.test("cli run script", async () => {
  const runProcess = Deno.run({
    cwd: dirname,
    cmd: ["deno", "run", "-A", CLIFileLocation, "echo"],
    stdin: "null",
    stderr: "null",
    stdout: "piped",
  });

  assert((await runProcess.status()).code === 0);

  const enc = new TextDecoder();

  assertStrContains(
    enc.decode(await runProcess.output()).trim(),
    "hello world"
  );

  runProcess.close();
});

Deno.test("cli file script", async () => {
  const runProcess = Deno.run({
    cwd: dirname,
    cmd: ["deno", "run", "-A", CLIFileLocation, "log"],
    stdin: "null",
    stderr: "null",
    stdout: "piped",
  });

  await runProcess.status();

  assertStrContains(
    new TextDecoder().decode(await runProcess.output()).trim(),
    "hello world file"
  );

  runProcess.close();
});

Deno.test("cli wrong script", async () => {
  const runProcess = Deno.run({
    cwd: dirname,
    cmd: ["deno", "run", "-A", CLIFileLocation, "other"],
    stdin: "null",
    stderr: "piped",
    stdout: "null",
  });

  await runProcess.status();

  assertStrContains(
    new TextDecoder().decode(await runProcess.stderrOutput()).trim(),
    'script "other" not found!'
  );

  runProcess.close();
});

Deno.test("init scripts.ts", async () => {
  const tempFolderLocation = path.resolve(dirname, "./temp");
  const scriptsTsLocation = path.resolve(dirname, "temp", "./scripts.ts");

  await Deno.mkdir(tempFolderLocation, {
    recursive: true,
  });

  if (await exists(scriptsTsLocation)) {
    await Deno.remove(scriptsTsLocation);
  }

  const initProcess = Deno.run({
    cwd: path.resolve(dirname, "temp"),
    cmd: ["deno", "run", "-A", CLIFileLocation, "init"],
    stdin: "null",
    stderr: "null",
    stdout: "null",
  });

  await initProcess.status();

  initProcess.close();

  assertStrictEq(await exists(scriptsTsLocation), true);

  await Deno.remove(tempFolderLocation, { recursive: true });
});