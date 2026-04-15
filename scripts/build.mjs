import { mkdir, cp } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const srcDir = resolve(rootDir, "src");
const distDir = resolve(rootDir, "dist");
const watchMode = process.argv.includes("--watch");

async function ensureDist() {
  await mkdir(resolve(distDir, "popup"), { recursive: true });
  await mkdir(resolve(distDir, "content"), { recursive: true });
  await mkdir(resolve(distDir, "background"), { recursive: true });
}

async function copyStaticFiles() {
  await cp(resolve(srcDir, "manifest.json"), resolve(distDir, "manifest.json"));
  await cp(resolve(srcDir, "popup", "popup.html"), resolve(distDir, "popup", "popup.html"));
  await cp(resolve(srcDir, "popup", "popup.css"), resolve(distDir, "popup", "popup.css"));
}

const commonConfig = {
  bundle: true,
  target: ["chrome114"],
  format: "esm",
  sourcemap: true,
  platform: "browser",
  tsconfig: resolve(rootDir, "tsconfig.json")
};

async function runBuild() {
  await ensureDist();
  await copyStaticFiles();

  if (watchMode) {
    const contexts = await Promise.all([
      esbuild.context({
        ...commonConfig,
        entryPoints: [resolve(srcDir, "content", "extractor.ts")],
        outfile: resolve(distDir, "content", "extractor.js")
      }),
      esbuild.context({
        ...commonConfig,
        entryPoints: [resolve(srcDir, "popup", "popup.ts")],
        outfile: resolve(distDir, "popup", "popup.js")
      }),
      esbuild.context({
        ...commonConfig,
        entryPoints: [resolve(srcDir, "background", "service-worker.ts")],
        outfile: resolve(distDir, "background", "service-worker.js")
      })
    ]);

    await Promise.all(contexts.map((ctx) => ctx.watch()));
    console.log("Watching extension sources...");
    return;
  }

  await Promise.all([
    esbuild.build({
      ...commonConfig,
      entryPoints: [resolve(srcDir, "content", "extractor.ts")],
      outfile: resolve(distDir, "content", "extractor.js")
    }),
    esbuild.build({
      ...commonConfig,
      entryPoints: [resolve(srcDir, "popup", "popup.ts")],
      outfile: resolve(distDir, "popup", "popup.js")
    }),
    esbuild.build({
      ...commonConfig,
      entryPoints: [resolve(srcDir, "background", "service-worker.ts")],
      outfile: resolve(distDir, "background", "service-worker.js")
    })
  ]);

  console.log("Build completed: dist/");
}

runBuild().catch((error) => {
  console.error(error);
  process.exit(1);
});
