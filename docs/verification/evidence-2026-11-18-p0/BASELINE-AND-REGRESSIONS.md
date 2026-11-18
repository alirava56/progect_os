# Baseline and reproduced regressions

Node.js 24.22.3 · npm 11.9.0 · Debian 13 x86_64

| Command | Exit |
|---|---:|
| `npm ci --include=optional` | 0 |
| `npm run typecheck` | 0 |
| `npm run lint` | 0 |
| `npm run test:core` | 0 |
| `npm run build` | 0 |
| `npm run test:smoke` | 1 |
| `npm audit --audit-level=high` | 1 |
| `npx playwright install chromium` | 1 |
| `npm run test:restore` | 2 |

Core baseline was 31 passed. Smoke baseline returned HTTP 403 at bootstrap. Baseline restore CLI invocation returned usage because it requires an input archive. The core suite exercised isolated backup and restore scenarios.

| Regression | Before correction | After correction |
|---|---|---|
| Unrelated record write with a masked legacy document | Core failed. Document revision must advance on edits. | Core passed. Stored legacy document and update timestamp unchanged. |
| Mixed ISO timestamp precision in contract ranges | Core failed. Correct range rejected as out of order. | Core passed. Correct range accepted and reversed range rejected. |
| Calendar validation on comment timestamps | Core failed. Invalid date was accepted. | Core passed. Impossible day rejected and leap day accepted. |
| Removing a colliding reminder source | Core failed. Remaining occurrence acquired a different identifier. | Core passed. Identifier and delivered outbox entry unchanged. |
| Vault reference policy | HTTP failed. Viewer received a synthetic Vault reference. | HTTP passed. Editor and Viewer did not receive the reference on direct record read, snapshot, or rendered Vault page. Editor edits preserved the reference. |

Final clean chain exit: 0. Full dependency audit exit: 1. Runtime-only audit exit: 0.
