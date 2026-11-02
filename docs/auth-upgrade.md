# Better Auth 1.6.33 two-factor schema upgrade

## Scope

Better Auth `1.6.33` adds two optional fields to the component's `twoFactor` table:

- `failedVerificationCount: v.optional(v.union(v.null(), v.number()))`
- `lockedUntil: v.optional(v.union(v.null(), v.number()))`

The fields are optional and nullable, so records enrolled before this change remain valid without a backfill. `lockedUntil` is stored by the Convex schema generator as a numeric timestamp.

`convex/betterAuth/generatedSchema.ts` is generated output. Local organization indexes remain in `convex/betterAuth/schema.ts`; regeneration must not replace that wrapper.

## Regeneration

The checked-in output was produced locally only, with the installed Better Auth package pinned at `1.6.33`, the Better Auth CLI pinned at `@better-auth/cli@1.4.21`, and `@convex-dev/better-auth@0.12.5` as the adapter:

```sh
cd convex/betterAuth
bun x --ignore-scripts --package=@better-auth/cli@1.4.21 \
  better-auth generate --output generatedSchema.ts --yes
```

`convex/betterAuth/auth.ts` deliberately constructs the adapter with inert placeholders and supplies a mail callback that throws. Schema generation therefore has no Convex deployment connection and cannot send authentication email. Do not run a deployment, a migration, or any account flow as part of this change.

## Lockout behavior and transaction boundary

The installed `better-auth@1.6.33` two-factor plugin implements account lockout by incrementing `failedVerificationCount`, setting `lockedUntil` when its failure limit is reached, clearing expired locks lazily, and resetting both values after a successful verification. Its defaults are enabled, 10 failed attempts, and 900 seconds.

`tests/convex/auth-schema-upgrade.test.ts` verifies storage compatibility: an old enrolled record with both fields absent remains readable, and a new record persists both fields.

`tests/convex/authFlows.test.ts` also executes the real Better Auth HTTP handler against the isolated Convex fixture and inert delivery sink. It seeds nine prior cross-challenge failures, then verifies that an invalid TOTP request reaches the threshold and persists a lock; a valid TOTP request is denied with `ACCOUNT_TEMPORARILY_LOCKED`; after an expired lock is simulated, a valid TOTP request succeeds and resets the counter and lock. The expiry request uses a fresh test IP because the endpoint's separate per-IP request limiter would otherwise obscure the account-lockout result. This is regression coverage for the installed plugin, not a substitute for staging rollout validation.

Convex mutations are transactional at the individual adapter mutation boundary. The plugin's lockout sequence can make multiple adapter calls, including an increment followed by a lock update. Do not claim that an entire Better Auth HTTP request is atomic across those calls; retain the adapter's normal transaction and retry semantics when assessing concurrent failures.

## Rollout gates

1. Confirm the release candidate uses Better Auth `1.6.33`, `@better-auth/utils@0.4.2`, and `@convex-dev/better-auth@0.12.5` with the adapter peer range `>=1.6.11 <1.7.0`.
2. Review the generated-only change and preserve the custom member and invitation indexes in `convex/betterAuth/schema.ts`.
3. Run the focused compatibility test and typecheck before any deployment.
4. Deploy the schema through the normal reviewed release path. No data backfill is required.
5. In staging, exercise repeated bad second-factor challenges, confirm a lock after the configured threshold, expiry handling, and a successful challenge resetting the counter.

## Adapter type compatibility patch

Bun applies `patches/@convex-dev%2Fbetter-auth@0.12.5.patch` during installation. The adapter's broad plugin-union type instantiation produces an impossible `useSession().data: never` contract with this Better Auth release. The patch describes only the provider's actual client surface (`useSession`, `getSession`, `convex.token`) and its existing cross-domain branch. It changes TypeScript types in source and distributed declarations only, not runtime JavaScript, authentication logic, or authorization. Root/web typechecks verify the application's real client remains assignable, without `any`, ignored diagnostics, or double casts. Remove the patch once an upstream adapter release fixes this contract and passes the same checks.
