// Lets plain Node run the repo's TypeScript outside Next: maps the "@/" alias
// to the repo root and resolves extensionless imports to .ts files.
// Pair with --conditions=react-server so "server-only" resolves to its empty stub.
import { registerHooks } from "node:module";
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const isFile = (filePath) => statSync(filePath, { throwIfNoEntry: false })?.isFile() === true;

registerHooks({
  resolve(specifier, context, nextResolve) {
    let basePath;
    if (specifier.startsWith("@/")) {
      basePath = path.join(repoRoot, specifier.slice(2));
    } else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
      basePath = fileURLToPath(new URL(specifier, context.parentURL));
    } else {
      return nextResolve(specifier, context);
    }
    const match = [basePath, `${basePath}.ts`, path.join(basePath, "index.ts")].find(isFile);
    return nextResolve(match ? pathToFileURL(match).href : specifier, context);
  },
});
