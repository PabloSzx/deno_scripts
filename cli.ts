import { exists, existsSync } from "./deps.ts";
import { fail, log } from "./log.ts";

const [cmd = ""] = Deno.args;

switch (cmd.toLowerCase()) {
  case "init": {
    const scriptsTSExists = existsSync("./scripts.ts");
    if (scriptsTSExists) {
      log("scripts.ts file already exists.");
    } else {
      Deno.writeTextFileSync(
        "./scripts.ts",
        `import { Scripts } from "https://deno.land/x/deno_scripts/mod.ts";
        
        Scripts({
          foo: {
            run: "echo dev",
          },
          bar: {
            file: "./mod.ts",
          },
        });`
      );

      await Deno.run({
        cmd: ["deno", "cache", "./scripts.ts"],
      }).status();

      await Deno.run({
        cmd: ["deno", "fmt", "-q", "./scripts.ts"],
      }).status();

      log("\nscripts.ts file created.");
    }

    break;
  }
  default: {
    await readScriptsFile();
  }
}

async function readScriptsFile() {
  const scriptsTSExists = await exists("./scripts.ts");

  if (scriptsTSExists) {
    const cmd = ["deno", "run", "-A", "./scripts.ts", ...Deno.args];

    await Deno.run({
      cmd,
    }).status();
  } else {
    fail("scripts.ts file not found!");
  }
}
