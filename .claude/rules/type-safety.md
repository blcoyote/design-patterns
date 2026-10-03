# Preserve Type Safety

- Do not cast to `unknown` to make incompatible types fit. Never use double assertions such as `value as unknown as TargetType` or the equivalent angle-bracket assertions to bypass a type error.
- Fix the underlying type contract instead: correct declarations, use a properly typed API or adapter, or narrow and validate the value with runtime checks and type guards.
- For globals or third-party APIs, use accurate declaration merging or module augmentation when appropriate. Do not invent declarations that disagree with runtime behavior.
- Do not replace the workaround with `any`, `@ts-ignore`, `@ts-expect-error`, or another unchecked assertion merely to silence the same error. If a sound fix is blocked, explain the mismatch and ask before bypassing the type checker.
- `unknown` remains appropriate for genuinely untrusted or unspecified input, provided it is narrowed or validated before use.

For example, do not publish Prism by forcing `globalThis` into an unrelated type:

```ts
(globalThis as unknown as { Prism: typeof Prism }).Prism = Prism;
```

Declare the global accurately or use the library's supported integration instead.
