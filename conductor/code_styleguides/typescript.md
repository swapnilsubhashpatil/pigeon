# TypeScript Style Guide — Pigeon Backend

## Compiler Settings
Strict mode always on. `tsconfig.json` must include:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

## Naming
- Files: `kebab-case.ts`
- Types/Interfaces: `PascalCase`
- Functions and variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE` for module-level config, `camelCase` for local
- No `I` prefix on interfaces

## Types
- Prefer `interface` for object shapes, `type` for unions/intersections
- Never use `any` — use `unknown` and narrow, or define the type
- Use `zod` for runtime validation of all external API responses; infer the TypeScript type from the schema

```typescript
// Good
const WeatherSignalSchema = z.object({
  severity: z.number().min(0).max(1),
  location: z.string(),
});
type WeatherSignal = z.infer<typeof WeatherSignalSchema>;

// Bad
const data: any = await fetchWeather();
```

## Functions
- Prefer named exports over default exports (except Express routers and the main app)
- Async functions always return `Promise<T>`, never mixed sync/async
- External API calls always wrapped in try/catch; errors logged and re-thrown as typed errors

## Error Handling
```typescript
// All API routes use this pattern
try {
  const result = await someService();
  res.json({ success: true, data: result });
} catch (err) {
  console.error('[route-name]', err);
  res.status(500).json({ success: false, error: 'Internal error' });
}
```

## Environment Variables
Always read via a validated config object, never `process.env.X` inline:
```typescript
// src/config.ts
export const config = {
  geminiApiKey: process.env.GEMINI_API_KEY ?? (() => { throw new Error('GEMINI_API_KEY not set') })(),
  port: Number(process.env.PORT ?? 3000),
};
```

## Imports
- Absolute imports from `src/` root using path aliases (`@/types`, `@/store`, etc.)
- Group: external deps → internal modules → types
- No barrel `index.ts` files unless the module has >3 exports

## Comments
Write no comments unless the WHY is non-obvious. A well-named function needs no explanation.
