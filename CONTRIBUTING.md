# Contributing

Thanks for taking a look at `clawkeys`.

The project is intentionally structured so support for more keypads and more agents
can be added over time without having to rewrite the whole CLI. If you want to add
support for new hardware, a new agent integration, or tighten up the current
workflow, a PR is welcome.

## Ground Rules

- Keep changes focused and easy to review.
- Prefer small, direct fixes over broad refactors unless there is a clear need.
- Preserve the existing CLI behavior unless the change explicitly updates it.
- Add or update tests for behavioral changes.

## Local Setup

```bash
git clone https://github.com/blairhudson/clawkeys.git
cd clawkeys
npm install --ignore-scripts
npm run lint
npm test
npm run build:ts
```

If you want to run the local CLI as `ck` while developing:

```bash
npm link
ck --help
npm unlink -g @clawkeys/ck
```

Native release builds use Rust, but the normal lint/test PR flow does not require
it.

## Pull Requests

Before opening a PR, make sure these pass locally:

```bash
npm run lint
npm test
```

GitHub Actions runs the same checks on pushes and pull requests so it is easy to see
whether a change is in good shape to merge.

## Areas That Benefit From Contributions

- support for more keypad hardware
- support for more agent integrations
- stronger test coverage
- better docs for the physical build and parts list

## License

By contributing, you agree that your contributions will be licensed under the MIT
license used by this repository.
