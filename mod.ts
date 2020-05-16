import { existsSync, exists } from "./deps.ts";
import {
  argifyArgs,
  argifyImportMap,
  argifyTsconfig,
  argifyUnstable,
} from "./lib/args.ts";
import { loadEnvFromFile, loadEnvFromObject } from "./lib/env.ts";
import { argifyPermissions } from "./lib/permissions.ts";
import {
  defaultEmptyObject,
  toArgsStringList,
  defaultEmptyArray,
} from "./lib/utils.ts";
import { fail, debug, log } from "./log.ts";
import Watcher from "./watcher.ts";

export interface Permissions {
  allowAll?: boolean;
  allowEnv?: boolean;
  allowHRTime?: boolean;
  allowNet?: boolean | string;
  allowPlugin?: boolean;
  allowRead?: boolean | string;
  allowRun?: boolean;
  allowWrite?: boolean | string;
}

export interface WatchOptions {
  paths?: string[];
  match?: string[];
  skip?: string[];
  extensions?: string[];
  interval?: number;
  recursive?: boolean;
}

export interface CommonArgs {
  /**
   * Load environment variables from a file
   *
   * If it's `true` it will look for ".env"
   *
   * By default it's set to `true` if a `.env` exists.
   */
  envFile?: boolean | string;
  /**
   * Add environment variables
   */
  env?: Record<string, string | number | boolean>;
  /**
   * Arguments to be added after the script
   */
  args?: string | string[];
  /**
   * Enable watch and/or specify options
   */
  watch?: boolean | WatchOptions;
}

export interface CommonDenoConfig extends CommonArgs {
  /**
   * Permissions management
   */
  permissions?: Permissions;
  /**
   * tsconfig location
   */
  tsconfig?: string;
  /**
   * Deno args to be added
   */
  denoArgs?: string | string[];
}

export interface GlobalConfig extends CommonDenoConfig {
  /**
   * If `debug` is enabled, it will print the command
   * that is going to be executed.
   */
  debug?: boolean;
  /**
   * Import map path
   */
  importMap?: string;
  /**
   * Enable unstable features
   */
  unstable?: boolean;
}

export interface ScriptFile extends CommonDenoConfig {
  /**
   * File to be executed with "deno run ..."
   */
  file: string;
  run?: undefined;
}

export interface ScriptRun extends CommonArgs {
  file?: undefined;
  /**
   * Command to be executed
   */
  run: string | string[];
}

function defaultCommonArgs<
  LocalConfig extends CommonArgs,
  GlobalConfig extends CommonArgs
>(_local: LocalConfig, global: GlobalConfig) {
  // If envFile is not specified, it will check if a `.env` exists
  // And if it does, it will turn it `true`
  if (global.envFile === undefined) {
    if (existsSync(".env")) {
      global.envFile = true;
    }
  }
}

/**
 * **deno_scripts** configuration constructor
 */
export async function Scripts(
  config: Record<string, ScriptFile | ScriptRun>,
  /**
   * Global configuration added to every script
   */
  globalConfig: GlobalConfig = defaultEmptyObject
): Promise<void> {
  {
    const [scriptArg, ...restArg] = Deno.args;

    if (!scriptArg) {
      fail("Specify a script to be executed!");
    }

    const script = config[scriptArg];

    if (script == null) {
      fail(`script "${scriptArg}" not found!`);
    }

    defaultCommonArgs(script, globalConfig);

    const envFile = script.envFile ?? globalConfig.envFile;

    let env: Record<string, string> | undefined;

    if (envFile) {
      env = await loadEnvFromFile(
        typeof envFile === "string" ? envFile : ".env"
      );
    }

    if (globalConfig.env) {
      env = {
        ...(env || defaultEmptyObject),
        ...loadEnvFromObject(globalConfig.env),
      };
    }

    if (script.env) {
      env = {
        ...(env || defaultEmptyObject),
        ...loadEnvFromObject(script.env),
      };
    }

    const watchModeEnabled = Boolean(script.watch ?? globalConfig.watch);
    if (watchModeEnabled) {
      log("Watch mode enabled.");
    }
    const watchOptions: WatchOptions = {
      ...(typeof globalConfig.watch === "object"
        ? globalConfig.watch
        : defaultEmptyObject),
      ...(typeof script.watch === "object" ? script.watch : defaultEmptyObject),
    };

    if (script.file) {
      if (!(await exists(script.file))) {
        fail(`File ${script.file} not found!`);
      }
      if (watchModeEnabled) {
        const watcher = new Watcher(
          [script.file, ...(watchOptions.paths || defaultEmptyArray)],
          {
            interval: watchOptions.interval,
            recursive: watchOptions.recursive,
            exts: watchOptions.extensions,
            match: watchOptions.match,
            skip: watchOptions.skip,
          }
        );

        for await (const changes of watcher) {
          log(
            `Detected ${changes.length} change${
              changes.length > 1 ? "s" : ""
            }. Rerunning...`
          );

          for (const change of changes) {
            debug(`File "${change.path}" was ${change.event}`);
          }
        }
      } else {
        const cmd = [
          "deno",
          "run",
          ...argifyPermissions(script.permissions, globalConfig.permissions),
          ...argifyTsconfig(script.tsconfig, globalConfig.tsconfig),
          ...argifyArgs(script.denoArgs, globalConfig.denoArgs),
          ...argifyImportMap(globalConfig.importMap),
          ...argifyUnstable(globalConfig.unstable),
          script.file,
          ...argifyArgs(script.args, globalConfig.args),
          ...restArg,
        ];
        if (globalConfig.debug) {
          debug({
            cmd: cmd.join(" "),
            env,
          });
        }
        const process = Deno.run({
          cmd,
          stdout: "inherit",
          stderr: "inherit",
          stdin: "inherit",
          env,
        });

        Deno.exit((await process.status()).code);
      }
    } else if (script.run) {
      const cmd = [
        ...toArgsStringList(script.run),
        ...argifyArgs(script.args, globalConfig.args),
        ...restArg,
      ];
      if (globalConfig.debug) {
        debug({
          cmd: cmd.join(" "),
          env,
        });
      }
      const process = Deno.run({
        cmd,
        env,
      });

      Deno.exit((await process.status()).code);
    } else {
      fail("Script not found!");
    }
  }
}
