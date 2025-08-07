# complexity-compare-cli

> A CLI tool to compare cyclomatic and cognitive complexity between two Git references in JavaScript/TypeScript projects

---

## Description

`complexity-compare` calculates and compares both cyclomatic and cognitive complexity for changed files between two Git commits or branches, helping you spot complexity regressions at a glance.

---

## 🧠 Complexity Metrics

This project uses two types of complexity metrics:

### 🔁 Cyclomatic Complexity

- Measures the number of independent execution paths.
- Focuses on **control flow**: branches, loops, conditionals.
- Useful for identifying how many tests are needed.

### 🧠 Cognitive Complexity

- Measures how difficult the code is to **read and understand**.
- Penalizes **deep nesting**, recursion, and confusing logic.
- Ignores sequential code, rewarding clean and readable structure.

| Metric           | Cyclomatic Complexity | Cognitive Complexity        |
| ---------------- | --------------------- | --------------------------- |
| Focus            | Execution paths       | Readability / mental effort |
| Nesting          | Not considered        | Penalized                   |
| Sequential logic | Counted               | Ignored                     |
| Goal             | Test coverage         | Code clarity                |

> ✅ Use both to improve maintainability and testability.

---

## Features

- **Commits or Branches**: Compare two commit hashes or your current branch vs. another branch (default: `main`).
- **Metrics**: Uses \[cognitive-complexity-ts] for cognitive complexity (`report.score`) and \[typhonjs-escomplex] for cyclomatic complexity.
- **View Modes**:

  - **All**: Show metrics for every file in the diff.
  - **Changed** _(default)_: Only files with any complexity change.
  - **Changed & New**: Includes changed files and those newly added in the target ref.

- **Sorted Output**: Results sorted by absolute %Δ cognitive complexity, highest first.

---

## 📦 Installation

```bash
# Clone
git clone https://github.com/thomsa/complexity-compare-cli.git
cd complexity-compare-cli

# Install
npm install

# Link globally
npm link
```

This registers the `complexity-compare` command.

---

## 🚀 Usage

Run inside any Git repo:

```bash
complexity-compare
```

Prompts:

1. **Compare mode**: `Commits` or `Branches`.
2. **Refs**:

   - **Commits**: enter start commit (required) and end commit (defaults to HEAD).
   - **Branches**: enter branch to compare against (defaults to `main`).

3. **View mode**: `All`, `Changed`, or `Changed & New` (defaults to `Changed`).

It then outputs an ASCII table, for example:

```
┌───────────────────────────────────────────────────┬─────────┬─────────┬────────┬───────────┬───────────┬───────────┐
│ File                                              │ Prev Cog│ Curr Cog│ %Δ Cog │ Prev Cyclo│ Curr Cyclo│ %Δ Cyclo │
├───────────────────────────────────────────────────┼─────────┼─────────┼────────┼───────────┼───────────┼───────────┤
│ src/components/Button.tsx                         │ 5       │ 8       │ 60.0%  │ 2         │ 3         │ 50.0%     │
│ utils/formatDate.ts                               │ N/A     │ 4       │ N/A    │ N/A       │ 1         │ N/A       │
└───────────────────────────────────────────────────┴─────────┴─────────┴────────┴───────────┴───────────┴───────────┘
```

- **`N/A`** means file was added or removed.
- **∞** indicates infinite % increase.
- **Green** for decreases; **Red** for increases.

---

## ⚙️ Options & Flags

> _Planned_: support for CLI flags (`--from`, `--to`, `--view`, `--json`).

---

## 🛠️ Implementation Details

- **Git handling**: `simple-git` for diffs and file snapshots.
- **Code transform**: `@babel/core` to compile TSX/TS/JSX before analysis.
- **Cognitive Complexity**: `cognitive-complexity-ts` (`report.score`).
- **Cyclomatic Complexity**: `typhonjs-escomplex`.aggregate.cyclomatic.
- **Spinner**: `ora` for progress.
- **Output**: `cli-table3` & `chalk` for a colored ASCII table.

---

## 🔧 Troubleshooting

- **ENOBUFS**: increase `MAX_BUFFER` in `src/index.js` if you hit buffer errors.
- **Missing Scores**: ensure `cognitive-complexity-ts` and dependencies are correctly installed.

---

## 📝 License

MIT © Tamas Lorincz
