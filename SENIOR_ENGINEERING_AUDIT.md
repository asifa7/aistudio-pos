# Meat Shop POS — Senior Engineering Review & Fix Report

## Scope

This review was performed against the uploaded project source. The focus was not just UI correctness; it covered Electron startup, renderer architecture, IPC security, database/migrations, inventory, FIFO costing, purchasing, processing/yield, accounting/reporting, multi-location design, reliability, and maintainability.

The current billing/POS flow appears substantially further along than inventory/ERP. I did not treat a UI screen as proof that the underlying business operation is production-safe.

## Changes made in this revision

### 1. Purchase-order TypeScript error fixed

The purchase-order edit/recreation path was passing a widened `string` into a repository contract that requires the exact purchase-order status union.

The object is now explicitly typed as the repository input contract. This preserves type safety instead of using `any` or an unsafe cast.

Expected result:

- `tsc -p tsconfig.node.json --noEmit` passes.
- The specific `status: string` TS2345 error is removed.

### 2. Startup path optimized

Removed avoidable startup work:

- Removed the hard-coded 1.5 second development startup delay.
- Development no longer creates a second splash renderer; production still keeps the splash.
- Development DevTools no longer open automatically. They can be explicitly enabled with `OPEN_DEVTOOLS=1`.
- The renderer now lazy-loads non-POS pages instead of loading every ERP screen into the initial route bundle.
- Browser-only mock IPC is dynamically loaded only for Vite browser development fallback instead of being part of the normal Electron startup path.
- The Vite config was converted to ESM configuration to remove the Vite CJS API warning source.
- The Electron TypeScript project no longer attempts to compile the Vite configuration as part of its backend compilation.

Important: no honest engineer can guarantee a one-second startup on every machine and every future database size. Electron process creation, Windows disk performance, SQLite recovery, migrations, antivirus scanning, and hardware can all affect startup. The changes remove known artificial delays and reduce initial renderer work. The remaining startup time should be measured on the target Windows machine.

### 3. UI color system standardized

The primary application accent was changed from highly saturated purple to a professional teal/neutral system.

The main KPI/card accents that were unnecessarily blue/red were normalized toward the application brand or semantic amber/green treatment.

Semantic danger colors were intentionally not removed everywhere. Red should remain available for genuinely dangerous states such as critical stock, destructive actions, and high-risk warnings. Removing semantic color completely would make the application less usable, not more professional.

### 4. IPC permission enforcement fixed at the actual boundary

The project already contained a role-permission registry, but the actual Electron IPC registrations were directly using `ipcMain.handle()` and were not passing through that permission gate.

This was a real security weakness.

The application now routes renderer IPC handlers through a common permission gate before executing the handler.

This is much safer than relying only on hidden buttons or frontend navigation.

### 5. Renderer compile issues cleaned up

The web TypeScript project had additional existing compile problems in procurement UI code:

- Incorrect relative IPC import paths.
- An unused setter in the quick-purchase UI.

These were corrected so the web TypeScript check also passes.

## Verification performed

### Passed

- Node/Electron TypeScript check.
- Renderer/web TypeScript check.
- SQLite integrity check on the supplied development database.
- Manual execution of the two pending migrations against a copy of the supplied development database.
- The pending migrations completed successfully on the copied database and SQLite integrity remained `ok`.

### Environment limitation

The uploaded `node_modules` contains Windows-native binaries. The audit environment is Linux, so the Windows `better-sqlite3` binary cannot be executed here. The Vite/Rollup native optional dependency is also not usable in this copied Windows `node_modules` tree.

Therefore I did not claim a successful Linux runtime launch. The final runtime test must be performed on your Windows development machine.

# Production-readiness verdict

## Current state: NOT PRODUCTION READY YET

This is not because the POS is bad. The billing portion is reasonably mature, and the project has substantially more architecture than a typical small POS prototype.

The problem is that inventory/ERP/accounting currently contain several design-level risks that could produce incorrect stock or financial reports once a real shop starts using the system.

If you sell this to another butcher shop before fixing these, the risk is yours. A wrong receipt is visible immediately. Wrong inventory valuation, COGS, supplier balance, or branch stock can silently damage a business for months.

# Biggest findings

## P0 — Multi-location inventory model is inconsistent

The schema adds `location_id` to stock batches and stock ledger, but the core stock ledger still has a unique constraint on `product_variant_id` rather than a proper `(product_variant_id, location_id)` identity.

More importantly, the repository lookup for a stock ledger retrieves by variant only and ignores location.

FIFO batch lookup can also be performed without a location and therefore can consume batches across locations.

This means the application can conceptually have:

Shop A: 10 kg
Shop B: 20 kg

while a variant-level ledger/FIFO operation sees 30 kg.

That is not acceptable for a multi-location POS.

### Required fix before multi-store sales

The inventory model needs a single, explicit location-aware source of truth:

`variant + location -> stock balance`

and:

`variant + location -> FIFO batches`

Every stock-changing command must carry or derive the location from the authenticated session/context. It should never silently default to location 1.

## P0 — Yield processing does not enforce mass conservation

The processing service draws down the raw input, then creates output batches based on user-provided quantities.

There is no hard invariant enforcing:

`input quantity >= saleable outputs + wastage`

A user can therefore potentially create more output stock than the raw input justified.

For a butcher operation this is a direct inventory-value corruption risk.

### Required invariant

For weight processing:

`input_grams = total_output_grams + wastage_grams + approved_variance_grams`

For piece processing, the equivalent unit/count rule should apply.

Any variance must be explicitly recorded and authorized.

## P0 — Profit reporting contains an artificial 65% COGS fallback

The profit report currently contains logic equivalent to:

`if cost is unavailable -> assume COGS = 65% of selling price`

This is unacceptable in financial reporting software.

It makes a report look complete while returning fabricated accounting data.

A missing cost should instead be represented explicitly as:

- unknown cost
- estimated cost
- incomplete costing

and the report should visibly flag the affected records.

Never invent a financial number to make a dashboard look complete.

## P0 — IPC permission architecture was present but not actually enforced globally

The project had a permission registry and a helper that checked roles, but the primary Electron handler registration bypassed it.

This has now been fixed at the IPC boundary in this revision.

The remaining work is to add automated tests proving that every sensitive channel rejects unauthorized roles.

## P1 — Expense posting is not atomic and is not true double-entry

Expense creation writes the expense row and then writes an accounting ledger row, but the service does not wrap the complete operation in a transaction.

If the first insert succeeds and the second fails, the database can contain an expense with no corresponding accounting entry.

The accounting entry also looks like a daily ledger abstraction rather than a complete debit/credit journal.

This needs to be resolved before presenting the accounting module as enterprise-grade.

## P1 — The accounting model needs stronger proof

The application contains accounting infrastructure, but the current implementation does not yet demonstrate a complete double-entry ledger for every business event.

You need automated invariants proving:

`SUM(debits) = SUM(credits)`

for every journal and for the ledger as a whole.

Inventory events also need corresponding financial postings where appropriate.

## P1 — Migration history is becoming too repair-heavy

There are 35 sequential migrations, including several schema repair/audit/fix migrations.

That is not automatically bad, but it is a warning sign that schema evolution has been reactive.

Before selling the software, you need a clean migration policy:

- immutable applied migrations
- deterministic upgrade path
- migration backup before destructive schema changes
- migration smoke tests
- fresh-database test
- upgrade-from-real-database test
- rollback/recovery strategy for failed upgrades

The current supplied development database has 33 migrations applied, with 034 and 035 pending. Both were manually tested against a copy and passed SQLite integrity checks.

## P1 — FIFO is technically present but needs location context

The FIFO implementation itself has the expected batch-ordering mechanism and supports partial batches.

That is good.

The problem is the surrounding context. FIFO is currently variant-oriented and can operate across all active batches when no location is supplied.

FIFO correctness cannot be separated from location correctness.

## P1 — Overselling is deliberately supported and therefore must be tightly controlled

The application has an oversold mechanism and estimated COGS fallback.

This can be useful in a butcher shop because physical stock and POS stock can temporarily disagree.

But it must be treated as an exception workflow, not normal inventory behavior.

Every oversold event should require:

- authenticated manager authorization
- reason
- exact shortfall
- audit entry
- visible exception report
- eventual reconciliation

The system already contains much of this conceptually, but it needs automated tests proving the full lifecycle.

# Architecture assessment

## Good

- Electron + React + TypeScript is a reasonable choice for a Windows-first butcher POS.
- SQLite + better-sqlite3 is appropriate for a local-first POS.
- WAL mode is appropriate.
- Foreign keys are enabled.
- The project has a repository/service separation.
- Zod validation exists.
- IPC uses context isolation.
- Node integration is disabled in the renderer.
- The preload exposes a channel whitelist.
- There is a migration engine.
- There is a transaction abstraction.
- Billing has meaningful transaction boundaries.
- FIFO/batch concepts are separated into their own service.
- Audit logging exists.
- Backup functionality exists.
- There is a real attempt at domain separation rather than putting all logic in React components.

## Needs work

The architecture is currently suffering from **too much accumulated enterprise abstraction without enough invariant testing**.

There are many services, repositories, migrations, IPC channels, feature flags, reports, HR, CRM, procurement, accounting, and forecasting pieces.

That creates the appearance of an enterprise system, but the critical question is whether the core invariants are mathematically enforced.

The next development phase should focus less on adding modules and more on proving the existing core.

# Code quality assessment

There is significant TypeScript `any` usage across the project.

The majority appears concentrated around older/complex IPC and mock code, but there are enough occurrences that I would not consider the codebase strongly type-safe yet.

The rule should be:

- `any` is not allowed in domain calculations.
- `any` is not allowed at repository boundaries.
- IPC payloads should use typed schemas.
- External/untrusted input should become typed data only after validation.

Do not waste time replacing every `any` immediately. Start with inventory, billing, accounting, purchasing, and IPC boundaries.

# POS / Billing

## Assessment: relatively strong

The billing flow has several things that are correctly designed:

- transactional completion
- tax calculation
- payment handling
- credit handling
- invoice numbering
- inventory deduction
- FIFO COGS capture
- manager override for negative stock
- voiding
- returns
- audit logging

This is the strongest part of the current application.

It still needs automated end-to-end tests, but I would not rewrite it just for the sake of rewriting it.

# Inventory

## Assessment: the main development risk

Inventory is where you should spend the next development cycles.

The system already contains:

- stock ledger
- stock transactions
- stock batches
- FIFO
- adjustments
- physical count
- wastage
- livestock loss
- yield processing
- transfers
- valuation
- COGS
- forecasting

That is a lot.

The danger is that these mechanisms can disagree with each other.

You need one invariant-driven inventory architecture.

Every inventory event should have a source, quantity, location, cost, actor, timestamp, and reference.

# Purchasing

## Assessment: good foundation, not yet fully trusted

There is meaningful procurement functionality:

- purchase orders
- approvals
- goods receipts
- purchase invoices
- returns
- supplier ledger
- supplier payments
- price history

The TypeScript failure found in the purchase edit path was a straightforward type widening bug and has been fixed.

The larger concern is transactional integrity across procurement + stock + supplier balance + accounting.

Those flows need scenario tests before production.

# Customers / AR

## Assessment: fairly mature

The customer subsystem is more complete than most small POS projects.

The concern is not missing UI. The concern is ensuring every balance-changing event is atomic and reconciled.

Customer balance should always equal the sum of customer ledger events.

# Security

## Improvements already made

IPC permission enforcement now happens at the Electron boundary.

## Remaining concern

There is still a browser fallback mock containing a development credential (`admin123`). It is now dynamically loaded only for Vite development fallback rather than being part of the normal Electron startup path.

For a commercial product, I would eventually remove the credential-based browser mock entirely or isolate it into an explicit test-only environment.

Do not ship a production build with a realistic-looking login backdoor, even if it is "only a mock."

# Startup performance

The original startup path had several avoidable costs:

1. Electron startup.
2. Database initialization at module load.
3. Many backend modules imported eagerly.
4. IPC registration.
5. Migration check.
6. A second splash renderer in development.
7. Main window creation delayed by 1.5 seconds.
8. DevTools opened automatically.
9. All major application screens were imported into the initial React graph.

The fixed version removes the most obvious avoidable work.

### Further improvement if startup is still slow on Windows

Measure startup timestamps rather than guessing.

Add these checkpoints:

`process start`
→ `Electron ready`
→ `database opened`
→ `migrations complete`
→ `main window created`
→ `renderer loaded`
→ `React mounted`
→ `session loaded`
→ `billing visible`

Then optimize the slowest interval.

If the slowest interval is renderer loading, continue code splitting.

If it is database open/recovery, inspect SQLite/WAL size and shutdown behavior.

If it is migrations, make migrations incremental and run expensive data migrations separately.

If it is session/billing queries, index and reduce initial queries.

# Testing strategy required before selling

The most important missing asset is not another UI screen. It is a deterministic business test suite.

At minimum, create tests for:

### Inventory

- purchase 10kg
- sell 3kg
- refund 1kg
- waste 2kg
- final = 6kg

### FIFO

10kg @ ₹150
10kg @ ₹180
sell 15kg

Expected:

10kg @ ₹150 + 5kg @ ₹180

### Yield

10kg input
7.5kg output
2kg output
0.5kg waste

Expected exact reconciliation.

Also test rejection when output + wastage > input.

### Multi-location

Shop A 10kg
Shop B 20kg
sell 5kg in A

B must remain 20kg.

### Transfer

A → B
5kg

Verify source, transit, destination, ledger, batch cost, and audit.

### Accounting

Every financial event must balance debit and credit.

### Permission

Attempt every sensitive IPC channel as CASHIER.

The operation must be rejected where policy says it should be.

# Recommended development order

## Phase 1 — Core correctness

1. Lock down location-aware inventory architecture.
2. Make FIFO location-aware.
3. Make stock ledger location-aware.
4. Enforce yield/mass conservation.
5. Remove fabricated COGS fallbacks.
6. Make expense/accounting operations atomic.
7. Prove accounting balancing with automated tests.

## Phase 2 — Inventory proof

8. Build purchase → batch → stock tests.
9. Build sale → FIFO → COGS tests.
10. Build refund/void reversal tests.
11. Build adjustment/wastage tests.
12. Build transfer tests.
13. Build processing/yield tests.
14. Build physical stock reconciliation tests.

## Phase 3 — Production reliability

15. Backup/restore testing.
16. Crash recovery testing.
17. Migration upgrade testing.
18. Windows hardware testing.
19. Printer failure testing.
20. Weighing-scale failure testing.

## Phase 4 — Performance

21. Measure real startup timings.
22. Index production-scale queries.
23. Load-test reports.
24. Test 100k+ sales and large inventory histories.

## Phase 5 — New features

Only after the above is stable should you continue with advanced ERP/AI/forecasting features.

# DO NOT BUILD YET

Do not spend the next development cycle on:

- AI recommendations
- advanced prediction
- fancy dashboards
- additional CRM features
- more HR features
- more accounting screens
- more reports
- cloud synchronization
- additional enterprise modules

until inventory, costing, accounting, location isolation, and tests are trustworthy.

# Final scores

| Area | Score |
|---|---:|
| Architecture | 7/10 |
| Database | 6/10 |
| Business Logic | 6/10 |
| Inventory | 5/10 |
| FIFO / Costing | 5/10 |
| Processing / Yield | 4/10 |
| POS / Billing | 8/10 |
| Purchasing | 6/10 |
| Customers / AR | 7/10 |
| Suppliers | 7/10 |
| Accounting | 4/10 |
| Multi-location | 3/10 |
| Permissions | 6/10 after IPC fix |
| Security | 6/10 |
| Reliability | 6/10 |
| Performance | 6/10 |
| Testing | 4/10 |
| UI / UX | 7/10 |
| Production readiness | 4.5/10 |

# Bottom line

You have built much more than a basic POS. The billing core is the part I would preserve and strengthen.

But do not confuse the amount of code with production readiness.

The biggest danger now is inventory/accounting inconsistency, especially once multiple locations and meat processing are involved.

If this software is going to be sold to another butcher shop, the next milestone should be:

**"Every rupee and every gram can be explained."**

If the system cannot answer exactly where a kilogram came from, where it went, what it cost, which shop owns it, who changed it, and how the accounting entry was generated, it is not ready to sell.
