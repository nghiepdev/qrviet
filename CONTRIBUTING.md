# Contributing to QRViet

Thanks for your interest in improving QRViet! Bug reports, translations, documentation, design feedback and code are all welcome.

By taking part in this project you agree to follow its [Code of Conduct](CODE_OF_CONDUCT.md).

## Contents

- [Ways to contribute](#ways-to-contribute)
- [Development setup](#development-setup)
- [Project conventions](#project-conventions)
- [Checking your change](#checking-your-change)
- [Commit messages](#commit-messages)
- [Pull requests](#pull-requests)
- [License](#license)

## Ways to contribute

- **Report a bug**: search the existing issues first, then open a new one with the bug report form.
- **Suggest a feature**: open an issue with the feature request form. Describe the problem you want to solve before the solution.
- **Improve the wording**: the Vietnamese copy is the source of truth, and fixes to both languages are welcome.
- **Fix bank data**: if a bank is missing or has wrong details, open an issue that names it. The list comes from the public VietQR API (see `pnpm sync:banks`).
- **Write code**: issues labelled `good first issue` or `help wanted` are a good start. For larger changes, open an issue first so we can agree on the approach before you spend time on it.

> [!IMPORTANT]
> Never post real account numbers, names, QR codes or screenshots with personal data in issues or pull requests. Use made-up values or blur them.

## Development setup

1. Install [Node.js](https://nodejs.org/) 26 and [pnpm](https://pnpm.io/installation) 12. Installing with other versions or other package managers stops with an error.
2. Fork the repository and clone your fork.
3. Install the dependencies and start the development server:

   ```bash
   pnpm install
   pnpm dev
   ```

4. Open <http://localhost:3000>.

The development server runs without a service worker. To work on offline mode, installation or updates, build the app and serve the production build, then open <http://localhost:4173>:

```bash
pnpm build
pnpm preview
```

To try the app on a phone on the same network, run `pnpm dev --host` and open the network address it prints. Browsers allow the camera and the service worker only on HTTPS or `localhost`, so those two features need an HTTPS tunnel on a phone.

`pnpm install` also installs the Git hooks through Lefthook's postinstall script, allowed in `pnpm-workspace.yaml`. To reinstall the hooks in an existing checkout, run `pnpm exec lefthook install`. GitHub Actions sets `CI=true`, so installation there skips the hooks and runs the checks directly.

Recommended VS Code extensions are listed in `.vscode/extensions.json`. Configure Oxc format-on-save and safe lint fixes in your personal `.vscode/settings.json`, which is ignored by Git.

## Project conventions

### Scope

- QRViet is a static site with no backend, no accounts and no telemetry. Changes must keep it working offline and must not send user data anywhere. The one exception is opt-in: a payment link made with the detailed preview switch on carries its bank, name and amount in the query string, which an optional Netlify edge function writes into the link preview (`netlify/edge-functions/pay-preview.ts`).
- Prefer what the project already uses: Astryx components first, then TanStack libraries, and a new dependency only when neither covers the need. Explain any new dependency in the pull request. To read the Astryx documentation for a component, run `pnpm dlx @astryxdesign/cli component Button` (the CLI is not a project dependency).

### Language and copy

- Code, comments, commit messages and documentation are written in English.
- The interface is in Vietnamese by default, with English as the second language. Never hard-code interface text: add the key to `src/i18n/vi.ts` (the source of truth) and to `src/i18n/en.ts`. A key missing from the English file fails the type check.

### Code style

- TypeScript runs in strict mode, and `pnpm lint` checks both lint rules and TypeScript compiler diagnostics.
- File names are kebab-case (`app-layout.tsx`, `use-qr-scene.ts`). Components keep PascalCase names and hooks start with `use`.
- Import from `src/` through the `#/` alias (`#/lib/vietqr`).
- The scripts in `scripts/` run directly in Node.js, which strips the types without compiling, and the edge function in `netlify/edge-functions/` runs in Deno. In them, and in the `src/` modules they import, use relative imports that end in `.ts` and erasable TypeScript only (no `enum`, `namespace` or constructor parameter properties).
- Keep domain logic (VietQR, EMV, amounts, text) in `src/lib/` as plain TypeScript without React.
- Match the surrounding code: 2-space indentation, single quotes, no semicolons and no spaces inside braces. `.editorconfig` sets the basics for your editor.
- [Oxfmt](https://oxc.rs/docs/guide/usage/formatter/config) owns formatting; `.oxfmtrc.jsonc` preserves this style with its default 100-column width. [Oxlint](https://oxc.rs/docs/guide/usage/linter/config) checks correctness, React Hooks and accessibility in `.oxlintrc.jsonc`. `oxlint-tsgolint` runs type-aware rules and TypeScript compiler diagnostics together via `typeAware` and the experimental `typeCheck` option. The config documents exceptions for custom ARIA widgets, effect-driven browser synchronization and the experimental compiler's scan-loop purity diagnostic.
- Oxfmt sorts Tailwind classes using `src/styles.css`, including the Astryx theme. [eslint-plugin-better-tailwindcss](https://github.com/schoero/eslint-plugin-better-tailwindcss/blob/main/docs/parsers/tsx.md) runs its correctness rules through Oxlint: unknown, conflicting and dynamically concatenated classes. It checks JSX class attributes; the config documents exceptions for separately loaded brand CSS and selectors the plugin cannot detect. Oxlint's JavaScript plugin API is currently alpha.
- Write comments that explain why the code does something, not what it does.

### React

- The React Compiler memoizes components and hooks, so do not add `useMemo`, `useCallback` or `memo`.
- Keep components compilable. The compiler skips a component that breaks the Rules of React, which then works without automatic memoization. To stay compilable:
  - Keep rendering pure. Do not read or write refs, call `Math.random()` or read other mutable values during render; use `useSyncExternalStore` for external state.
  - Move `try`/`catch` blocks with branching logic, dynamic `import()` calls and similar code into plain functions outside the component.
  - Do not add `eslint-disable` comments for React rules: the compiler treats them as a reason to skip the component.
- The app renders in the browser only (`<ClientOnly>` in `src/routes/__root.tsx`). The build writes the root's `head` into the app shell that every page is served with, and the browser takes that HTML over. So a page's `head` may set the title and add tags such as `robots`, but must not replace the root's tags, or the shell's copy stays behind next to the page's. Only `/pay` has HTML of its own (`pay.html`), and only it replaces the preview tags. Head functions must not use browser APIs or stored settings (see `src/seo/head.ts`).
- In the document head, give every stylesheet `<link>` a `precedence`, and every `<style>` an `href` and a `precedence`, and put inline scripts in TanStack's `ScriptOnce`. React then finds them by `href`, or never looks for them. Otherwise it walks the head in order to hydrate them and fails at any text a host adds there: Netlify adds a line break and a comment to every page.

### Interface

- Check every interface change on a phone-sized screen and on desktop, in light and dark mode, and in both languages.
- Icon-only buttons need an accessible label, everything must work with the keyboard, and motion must respect the reduced-motion setting.

### Generated files

| File                                      | How to update it                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/routeTree.gen.ts`                    | Regenerated by TanStack Start during `pnpm dev` and `pnpm build`. Commit it, but do not edit it. |
| `public/splash/*.png`                     | Run `pnpm gen:splash` after changing the boot splash in `src/app/boot-splash.ts`.                |
| `src/data/banks.json` and `public/banks/` | Run `pnpm sync:banks`.                                                                           |

## Checking your change

Before you push, check and build the app. CI runs the same commands on every pull request:

```bash
pnpm check
pnpm build
```

`pnpm check` runs lint, formatting checks and type checking without changing files. Run `pnpm fix` to apply safe lint fixes and formatting, then rerun `pnpm check`. Both Oxc tools respect `.gitignore`; their configs also exclude the generated route tree, and Oxfmt skips the generated bank JSON files. Oxfmt handles Tailwind class order; import order is left unchanged.

[Lefthook](https://lefthook.dev/) runs two Git hooks from `lefthook.yml`:

- **pre-commit** formats staged text files and stages the formatted result with `stage_fixed: true`. It temporarily hides unstaged changes in partially staged files and restores them afterward. If formatting fails or restoring unstaged changes conflicts with the formatted result, the commit stops; resolve the reported problem before retrying.
- **pre-push** runs `pnpm check` on the whole project, including type-aware linting, Tailwind rules, TypeScript diagnostics and formatting. Type checking runs here to avoid repeating the full TypeScript analysis on every commit.

Lefthook reads the config when each hook runs. Keep personal overrides in the ignored `lefthook-local.yml`.

Then try the change in the browser: `pnpm dev` covers most changes, and `pnpm preview` (after `pnpm build`) covers offline mode, installation and updates.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat(scan): read VietQR codes from pasted screenshots
fix(batch): keep leading zeros in account numbers
docs: explain the BASE_PATH variable
```

Common types are `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `build`, `ci` and `chore`.

## Pull requests

1. Create a branch from `main`, for example `feat/batch-labels` or `fix/scan-torch`.
2. Keep each pull request focused on one change. Update the documentation and both translations when behaviour or wording changes.
3. Make sure `pnpm check` and `pnpm build` pass. CI runs the same commands on every pull request.
4. Open the pull request, fill in the template and link the issue it resolves. Add screenshots for interface changes.

A maintainer will review your pull request and may ask for changes before merging it.

## License

By contributing, you agree that your contributions are licensed under the project's [MIT License](LICENSE).
