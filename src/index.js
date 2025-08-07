#!/usr/bin/env node
import simpleGit from "simple-git";
import inquirer from "inquirer";
import ora from "ora";
import escomplex from "typhonjs-escomplex";
import { getFileOutput } from "cognitive-complexity-ts";
import babel from "@babel/core";
import Table from "cli-table3";
import chalk from "chalk";
import path from "path";
import os from "os";
import fs from "fs";
import { execSync } from "child_process";

const git = simpleGit();
const MAX_BUFFER = 50 * 1024 * 1024;
const TMP_DIR = os.tmpdir();

// Babel presets for transforming TSX/TS/JSX
const BABEL_PRESETS = [
  ["@babel/preset-env", { targets: { node: true } }],
  "@babel/preset-typescript",
  "@babel/preset-react",
];

function transformCode(code) {
  try {
    const result = babel.transformSync(code, {
      presets: BABEL_PRESETS,
      filename: "file.tsx",
      babelrc: false,
    });
    return result?.code || code;
  } catch {
    return code;
  }
}

function existsAtRef(ref, file) {
  try {
    execSync(`git cat-file -e ${ref}:${file}`, { maxBuffer: MAX_BUFFER });
    return true;
  } catch {
    return false;
  }
}

async function analyzeCognitive(code, name) {
  const base = path.basename(name);
  const tmpPath = path.join(TMP_DIR, `cpx-${Date.now()}-${base}`);
  fs.writeFileSync(tmpPath, code);
  let cog = null;
  try {
    const report = await getFileOutput(tmpPath);
    cog = report.score ?? null;
  } catch {
    cog = null;
  } finally {
    fs.unlinkSync(tmpPath);
  }
  return cog;
}

async function run() {
  // 1️⃣ Prompt comparison mode
  const { mode } = await inquirer.prompt([
    {
      type: "list",
      name: "mode",
      message: "Select comparison mode:",
      choices: ["Commits", "Branches"],
    },
  ]);

  let fromRef;
  let toRef;

  if (mode === "Commits") {
    const currentCommit = (await git.revparse(["HEAD"])).trim();
    const answers = await inquirer.prompt([
      {
        name: "from",
        message: "🔍 Enter start commit hash:",
        validate: (i) => (i.trim() ? true : "Start commit hash is required"),
      },
      {
        name: "to",
        message: "🔍 Enter end commit hash:",
        default: currentCommit,
      },
    ]);
    fromRef = answers.from;
    toRef = answers.to;
  } else {
    const currentBranch = (await git.revparse(["--abbrev-ref", "HEAD"])).trim();
    const { targetBranch } = await inquirer.prompt([
      {
        type: "input",
        name: "targetBranch",
        message: "🔀 Compare current branch against:",
        default: "origin/main",
      },
    ]);
    fromRef = targetBranch;
    toRef = currentBranch;
  }

  // 2️⃣ Prompt view mode
  const { viewMode } = await inquirer.prompt([
    {
      type: "list",
      name: "viewMode",
      message: "What to show?",
      choices: [
        { name: "All — show metrics for every file in diff", value: "all" },
        { name: "Changed — only files with metric changes", value: "changed" },
        {
          name: "Changed and new files — include added files too",
          value: "changed_and_new",
        },
      ],
      default: "changed",
    },
  ]);

  // 3️⃣ Find changed files
  const spinner = ora().start(
    `Processing files between ${fromRef} and ${toRef}...`
  );
  const diff = await git.diff([`${fromRef}..${toRef}`, "--name-only"]);
  const files = diff.split("\n").filter((f) => /\.(js|ts|jsx|tsx)$/.test(f));
  if (!files.length) {
    spinner.fail("No JS/TS files changed.");
    return;
  }

  // 4️⃣ Analyze complexities
  const results = [];
  for (const file of files) {
    const hadPrev = existsAtRef(fromRef, file);
    const hadCurr = existsAtRef(toRef, file);

    let prevCog = null,
      currCog = null,
      prevCyclo = null,
      currCyclo = null;
    if (hadPrev) {
      const raw = execSync(`git show ${fromRef}:${file}`, {
        encoding: "utf8",
        maxBuffer: MAX_BUFFER,
      });
      const code = transformCode(raw);
      prevCog = await analyzeCognitive(code, file);
      prevCyclo = escomplex.analyzeModule(code, { commonjs: true }).aggregate
        .cyclomatic;
    }
    if (hadCurr) {
      const raw = execSync(`git show ${toRef}:${file}`, {
        encoding: "utf8",
        maxBuffer: MAX_BUFFER,
      });
      const code = transformCode(raw);
      currCog = await analyzeCognitive(code, file);
      currCyclo = escomplex.analyzeModule(code, { commonjs: true }).aggregate
        .cyclomatic;
    }

    const pct = (a, b) => {
      if (a == null || b == null) return "N/A";
      if (a === 0 && b === 0) return "0%";
      if (a === 0) return "∞";
      return `${(((b - a) / Math.abs(a)) * 100).toFixed(1)}%`;
    };

    results.push({
      file,
      hadPrev,
      hadCurr,
      prevCog,
      currCog,
      prevCyclo,
      currCyclo,
      cogDelta: pct(prevCog, currCog),
      cycloDelta: pct(prevCyclo, currCyclo),
    });
  }
  spinner.succeed(`Processed ${files.length} files.`);

  // 5️⃣ Filter based on viewMode
  let filtered = results;
  if (viewMode === "changed") {
    filtered = filtered.filter(
      (r) =>
        r.hadPrev && (r.prevCog !== r.currCog || r.prevCyclo !== r.currCyclo)
    );
  } else if (viewMode === "changed_and_new") {
    filtered = filtered.filter(
      (r) =>
        r.prevCog !== r.currCog ||
        r.prevCyclo !== r.currCyclo ||
        (!r.hadPrev && r.hadCurr)
    );
  }

  // 6️⃣ Sort by abs cognitive delta
  const parseDelta = (d) => {
    if (d === "N/A") return -Infinity;
    if (d === "∞") return Infinity;
    return parseFloat(d.replace("%", "")) || 0;
  };
  filtered.sort((a, b) => parseDelta(b.cogDelta) - parseDelta(a.cogDelta));

  // 7️⃣ Render table
  const table = new Table({
    head: [
      chalk.bold("File"),
      chalk.bold("Prev Cog"),
      chalk.bold("Curr Cog"),
      chalk.bold("%Δ Cog"),
      chalk.bold("Prev Cyclo"),
      chalk.bold("Curr Cyclo"),
      chalk.bold("%Δ Cyclo"),
    ],
  });
  for (const r of filtered) {
    const style = (v) =>
      typeof v === "string"
        ? v.startsWith("-")
          ? chalk.green(v)
          : v === "∞"
          ? chalk.yellow(v)
          : chalk.red(v)
        : v;
    table.push([
      r.file,
      r.prevCog ?? "N/A",
      r.currCog ?? "N/A",
      style(r.cogDelta),
      r.prevCyclo ?? "N/A",
      r.currCyclo ?? "N/A",
      style(r.cycloDelta),
    ]);
  }
  console.log(table.toString());
}

run().catch((err) => {
  console.error(chalk.red("Error:"), err);
  process.exit(1);
});
