# PROMPT — Rebuild the POS Settings screen (game-style, single-screen, no-scroll) + expand the Accent Color palette

> Paste everything below this line into your coding AI while it is working inside this repo. It is written as instructions to that AI.

---

## 0. Context — the repo you are working in

This is a desktop **meat-shop POS**: **Electron 31 + React 18 + TypeScript 5 + Vite 5**, routing via **react-router-dom v6 `MemoryRouter`**, state via **zustand** + **@tanstack/react-query**, DB via **better-sqlite3**, config validated with **zod**, icons via **lucide-react**. Styling is **Tailwind CSS 3** with a CSS-variable design-token system.

You are **not** starting from scratch. Read these files first and build on them — do not reinvent what already works:

| Concern | File | Notes |
|---|---|---|
| Settings screen (current) | `src/App.tsx` → `SettingsView()` (~L1190-1885) and `MeatYieldSettingsTab()` (~L1887-2035) | Currently a horizontal sub-tab bar + one scrolling panel. **Extract this into its own module and replace the layout.** |
| Accent color + theme + layout | `src/modules/settings/frontend/components/POSAppearanceSettings.tsx` | Renders the accent swatch picker + theme mode + POS layout/tile/cart, with a live POS mockup preview. |
| Accent color source of truth | `src/core/theme/AppearanceContext.tsx` | Exports `ACCENT_COLORS`, `AppearanceConfig`, `applyAppearanceToDOM()`, `AppearanceProvider`, `useAppearance()`. Persists to `localStorage['pos_appearance']`. |
| Keyboard shortcuts UI | `src/modules/settings/frontend/components/POSShortcutSettings.tsx` | Backed by `usePOSShortcutsStore` (`localStorage['pos_keyboard_shortcuts']`). |
| Design tokens / component CSS | `src/index.css` | `:root` (light) + `.dark` (dark) CSS vars, plus `@layer components` classes (`.btn-primary/.btn-secondary/.btn-danger`, `.erp-pane`, `.erp-table*`, `.badge-*`, `.pill-*`). |
| Tailwind token mapping | `tailwind.config.js` | `darkMode:'class'`; maps CSS vars to `brand.{50,100,500,600,700}`, `surface-{app,panel,card,hover}`, `border-{subtle,focus}`, `accent`, `text-{primary,secondary,muted}`, `semantic-{success,danger,warning,info}`. |
| Renderer config type | `src/core/shared/types.ts` → `AppConfig` | `shopInfo`, `theme`, `hardware`, `receiptTemplate?`, `billingSettings?`. **Extend this.** |
| Config persistence (main) | `src/core/config/config_service.ts` → `ConfigService` / `configService` | Writes `config.json` in `app.getPath('userData')`, validated by a zod schema. **Extend the schema in lockstep with `AppConfig`.** |
| Config IPC | `src/core/ipc/channels.ts` (`IPC_CHANNELS.CONFIG.GET`/`.UPDATE`), wired in `src/electron/main.ts` (~L260-265) | Renderer reads/writes via `window.api.invoke(...)`, cached by React Query key `['config']`. |
| Meat-yield ratios store | `src/core/config/meatShopConfigStore.ts` (`localStorage['meat_shop_ratios_config_v1']`) | Chicken/goat yield ratios. Keep. |
| Billing quick-flag store | `src/modules/billing/frontend/hooks/useBillingSettingsStore.ts` | Duplicates some flags — see §7 (consolidate). |
| Routing / nav | `src/App.tsx` → `MainLayout()` `<Routes>`; `/settings` route; `Ctrl+,` opens Settings; `Ctrl+T` toggles theme | Providers: `GlobalErrorBoundary → QueryClientProvider → AppearanceProvider → App` (`src/main.tsx`). |

**There is no shared UI component library.** Reuse the CSS classes in `index.css` and lucide icons, and build the small set of new primitives listed in §8.

---

## 1. Goal

Deliver a **single-screen, no-scroll, video-game-style Settings experience** that is neat, cleanly categorized, and highly accessible — and **expand the accent-color palette** from 4 to 10 industry-standard colors.

Two headline requirements from the product owner, in their words:

1. *"Make the accent colour more colourful, as industry standard provides."*
2. *"Neat and clean like video-game settings, highly accessibly categorised. Always put the action/controls on the LEFT and the live preview on the RIGHT. Fit it all in a single full screen — I don't want to scroll the screen unnecessarily."*

---

## 2. Hard constraints (do not violate)

1. **No page scroll.** The whole screen fits the Electron window. Root container is `h-screen overflow-hidden`. Only the **middle controls column** may scroll internally (`overflow-y-auto`) as a last resort when a category has many controls. The nav rail, header, preview pane, and bottom action bar are always fully visible and never move.
2. **Controls on the LEFT, live preview on the RIGHT.** Every category follows this: the interactive "action" widgets live in the center/left; a **context-aware live preview** sits on the right and updates as the user changes values (e.g. layout type on the left → POS mockup on the right; receipt toggles on the left → receipt render on the right).
3. **Game-style categorized navigation.** A left nav rail with grouped categories (see §5), icon + label per item, clear active state, full keyboard navigation, and a search box that filters both categories and individual settings.
4. **Keep every existing feature working.** Accent color, theme mode, POS layout/tile/cart, keyboard shortcuts, meat-yield ratios, shop profile, receipt template, backup/CSV export, weighing-scale config — none of these may regress. Re-home them into the new structure.
5. **Build only the settings listed in §6.** Do **not** add the scope-creep features listed in §10.
6. **Light + dark parity** and **WCAG AA contrast** everywhere. Respect `prefers-reduced-motion`.
7. **TypeScript strict**, no `any` on public APIs, and keep zod validation in sync with the renderer types.

---

## 3. Accent Color palette — expand 4 → 10 (industry standard)

**Where:** `ACCENT_COLORS` in `src/core/theme/AppearanceContext.tsx`. The rest of the pipeline already works — `applyAppearanceToDOM()` writes each color into CSS vars (`--brand-500/600/700/50/100`, `--color-accent`) on `document.documentElement`, and Tailwind's `brand.*` utilities are bound to those vars, so **every `bg-brand-500`, `text-brand-500`, `border-brand-500`, etc. across the app updates instantly. Adding colors is therefore a low-risk, additive change.**

**Rules:**
- **Do not change the `id` strings of the existing 4 entries** (teal, green, the amber one, slate). Users have saved preferences under those ids in `localStorage['pos_appearance']`; changing ids would silently reset their choice. Keep the 4 as-is and **append 6 new entries**.
- Keep each entry's existing shape: `{ id, name, hex (base → --brand-500 & --color-accent), hover (→ --brand-600, lighter), active (→ --brand-700, darker), tint50 (→ --brand-50), tint100 (→ --brand-100), swatch (Tailwind bg class for the picker dot) }`.
- All 10 **base** colors have been contrast-checked: white text on the base passes **WCAG AA (≥ 4.5:1)**. Amber and green are the tightest (~5.0:1) — do not lighten the base values or white-on-accent buttons will fail AA.

**The 6 colors to append** (add after the existing 4; a full reference array is in Appendix A):

| id | name | base (hex) | hover | active | tint50 | tint100 |
|---|---|---|---|---|---|---|
| `sky` | Ocean Cyan | `#0369a1` | `#0284c7` | `#075985` | `#f0f9ff` | `#e0f2fe` |
| `blue` | Royal Blue | `#1d4ed8` | `#2563eb` | `#1e40af` | `#eff6ff` | `#dbeafe` |
| `indigo` | Deep Indigo | `#4338ca` | `#4f46e5` | `#3730a3` | `#eef2ff` | `#e0e7ff` |
| `violet` | Violet | `#6d28d9` | `#7c3aed` | `#5b21b6` | `#f5f3ff` | `#ede9fe` |
| `fuchsia` | Magenta | `#a21caf` | `#c026d3` | `#86198f` | `#fdf4ff` | `#fae8ff` |
| `rose` | Crimson Rose | `#be123c` | `#e11d48` | `#9f1239` | `#fff1f2` | `#ffe4e6` |

Result: teal, green, amber, slate (kept) + sky, blue, indigo, violet, fuchsia, rose (new) = 10 covering the full warm/cool spectrum.

**Also fix while you're in the theme layer (small, high-value):**
- `font-outfit` is used on headings across the app but is **not defined** as a Tailwind `fontFamily` utility, so it currently falls back to Inter. Add `outfit: ['Outfit', ...]` to `theme.extend.fontFamily` in `tailwind.config.js` (Outfit is already loaded in `index.html`).
- The `brand.*` fallbacks in `tailwind.config.js` are purple (`#8b5cf6` etc.) and never used because the accent system overwrites them. Replace the fallbacks with the teal defaults so a fresh load (before `pos_appearance` is read) shows the correct brand color, not a purple flash.

---

## 4. The accent picker UI (inside the Appearance category)

Upgrade the swatch picker in `POSAppearanceSettings.tsx`:
- Render the 10 colors as a responsive grid of round swatches (`w-8 h-8 rounded-full`), each using its `swatch` class, with the selected one showing a lucide `Check` and an accent ring (`ring-2 ring-offset-2`).
- Each swatch is a real `<button>` with `aria-pressed`, `aria-label={color.name}`, keyboard focusable, arrow-key navigable as a radiogroup (`role="radiogroup"` on the container, `role="radio"` on each).
- Show the selected color's name next to the grid.
- Changing the accent updates the **right-hand live preview** (the POS mockup) immediately — it already does via CSS vars; make sure the preview visibly uses `bg-brand-500` / `text-brand-500` surfaces so the change reads clearly.

---

## 5. Screen layout & navigation (the "game settings" shell)

Build a new `SettingsScreen` (module: `src/modules/settings/frontend/`) mounted at the `/settings` route in place of the inline `SettingsView()`.

### 5.1 Regions (a fixed 3-region shell, `h-screen`, no page scroll)

```
┌───────────────────────────────────────────────────────────────────────────┐
│  HEADER  ·  "Settings"   [🔎 search settings…]           ● Unsaved changes  │  ← slim, fixed
├───────────────┬───────────────────────────────────┬───────────────────────┤
│  NAV RAIL     │  CONTROLS (the "actions")         │  LIVE PREVIEW         │
│  grouped      │  title + description              │  context-aware to     │
│  categories   │  compact control rows / cards     │  the active category, │
│  (icons+text) │  (this column may scroll          │  updates live         │
│  ~240px       │   internally if needed)  flex-1   │  ~380–420px, sticky   │
│  keyboard nav │                                   │                       │
├───────────────┴───────────────────────────────────┴───────────────────────┤
│  ACTION BAR   [Reset to defaults]        [Cancel]        [Save]  (disabled  │  ← fixed, always
│               until dirty)                                                  │     visible
└───────────────────────────────────────────────────────────────────────────┘
```

- Root: `<div className="h-screen overflow-hidden flex flex-col">`. Middle band is a 3-column `flex` (or CSS grid `grid-cols-[240px_1fr_400px]`).
- **Nav rail** (`bg-surface-panel`, `border-r border-border-subtle`): grouped list (see 5.2), each item = lucide icon + label; active item gets an accent left-border (`border-l-2 border-brand-500`), accent tint background (`bg-brand-50` / dark equivalent), and `aria-current`. `role="tablist"`, items `role="tab"`.
- **Controls column** (`bg-surface-app`): the only scrollable area, `overflow-y-auto`. Header shows the category title (`font-outfit`) + one-line description. `role="tabpanel"`.
- **Preview pane** (`bg-surface-card`, `border-l border-border-subtle`, sticky): a framed device/receipt/matrix mock per category (see §6). Header label "Preview". If the window is narrow (< ~1100px), collapse the preview behind a "Show preview" toggle rather than causing horizontal scroll.
- **Action bar** (`border-t border-border-subtle`): dirty indicator + `Reset to defaults` (`.btn-secondary`), `Cancel`, `Save` (`.btn-primary`, disabled until dirty). Saving persists to the correct layer (§7); Cancel discards the working draft; both clear the dirty flag.

### 5.2 Nav groups (game-style grouping)

Group the categories under quiet section headers in the rail:

```
STORE
  🏪  Business
  🧾  Billing & Invoice
  💰  Tax / GST
  💳  Payment Methods

OPERATIONS
  💵  Cash Box & Shifts
  📦  Inventory
  🔄  Returns & Refunds
  🍗  Live Bird Yield & Ratios      ← existing, meat-shop specific — keep

TEAM
  👨‍💼  Users & Permissions

DEVICE & APP
  🖨️  Printer & Hardware
  🎨  Appearance                    ← accent palette + theme + POS layout
  ⌨️  Keyboard Shortcuts            ← existing — keep
  ⚙️  System & Data
```

> The product owner's core list is the 10 functional categories. **Appearance, Keyboard Shortcuts, and Live Bird Yield & Ratios already exist and are useful — retain them** (grouped as above). Use lucide icons, not emoji, in the actual UI (emoji here are just labels): e.g. `Store, ReceiptText, Percent, CreditCard, Banknote, Package, RotateCcw, Drumstick, Users, Printer, Palette, Keyboard, Settings`.

### 5.3 Density tactics so nothing needs page-scroll
- One category visible at a time (that's the whole point of the rail).
- Group related controls into compact cards; put booleans in a 2-column grid of `SettingRow`s.
- For heavy categories, use **in-category sub-tabs** (e.g. Users & Permissions → `Users | Roles | Permissions`) or collapsible sub-sections, so the visible surface stays short.
- Prefer segmented controls and switches (inline) over stacked blocks.

---

## 6. Categories — every setting, its control, persistence, and preview

Legend for **Persist**: **CFG** = `config.json` via `IPC_CHANNELS.CONFIG` (extend `AppConfig` + zod). **SQLITE** = new better-sqlite3 table + new IPC channel. **LOCAL** = `localStorage` (device-local). Controls: `Switch`, `Segmented`, `Select`, `Text`, `Number`, `TextArea`, `File`, `Matrix`, `List` (add/edit/remove rows).

> Rule the product owner emphasized: **not every feature is a setting.** Settings define *defaults and rules*; they do not hold live transactions. Product buying price, individual expenses, and the actual cash-in-drawer counts are operational data, **not** settings — do not put them here.

### 6.1 🏪 Business — `CFG` (extend `AppConfig.shopInfo`)
Basic identity, auto-populated onto every invoice/receipt.

| Setting | Control | Field / note |
|---|---|---|
| Business name | Text | exists: `shopInfo.name` |
| Business logo | File (image; store path or base64) | NEW — used on receipts when "Show logo" is on |
| Address | TextArea | `shopInfo.address` |
| Phone number | Text | `shopInfo.phone` |
| Email | Text | NEW |
| GSTIN | Text (validate format) | `shopInfo.gstin` |
| PAN | Text (optional) | NEW |
| Currency | Select (symbol + code) | `shopInfo.currencySymbol` |
| Financial year | Select (e.g. Apr–Mar) | NEW — drives invoice numbering reset |

**Preview (right):** a document-header card showing logo + name + address + GSTIN + phone exactly as it renders on invoices. Make clear this data flows automatically to receipts/invoices (single source of truth).

### 6.2 🧾 Billing & Invoice — `CFG` (extend `AppConfig.receiptTemplate` + new `invoice` section)

| Setting | Control | Note |
|---|---|---|
| Invoice number (current/next) | Number | NEW |
| Invoice prefix | Text | NEW |
| Invoice numbering | Segmented/Select | NEW — e.g. continuous vs reset-per-FY; format pattern |
| Receipt size | Segmented | `58mm / 80mm / A4` (extend `receiptTemplate.paperWidth` to allow A4) |
| Show business logo | Switch | NEW |
| Show GST | Switch | `receiptTemplate.showGstBreakdown` |
| Show HSN | Switch | NEW |
| Show discount | Switch | NEW |
| Show cashier | Switch | NEW |
| Show customer | Switch | NEW |
| Footer message | TextArea | `receiptTemplate.footerMessage` |
| Terms & conditions | TextArea | NEW |
| Auto-print receipt | Switch | `receiptTemplate.autoPrintOnComplete` |
| Number of copies | Number | NEW |
| Reprint invoice permission | Switch | links to the `Refund/Reprint` permission in §6.6 |

**Preview (right):** the **live thermal-receipt render** (reuse the existing `<iframe srcDoc=…>` preview from the current printer tab). It must switch template by size and reflect every toggle live. This is the flagship preview — invest here.

> Scope discipline: implement exactly these. Do **not** add 20 invoice-customization knobs.

### 6.3 💰 Tax / GST — `CFG` (new `AppConfig.tax`; the main-process zod schema already has a `taxes` slot)

| Setting | Control | Note |
|---|---|---|
| GST enabled | Switch | master toggle for the section |
| Tax inclusive / exclusive | Segmented | pricing mode |
| GST rates | List (add/edit/remove) | e.g. 0 / 5 / 12 / 18 / 28 |
| CGST / SGST / IGST | derived display + intra/inter-state rule | CGST+SGST for intra-state, IGST for inter-state |
| HSN code | Switch (enable) + default text | detailed HSN lives on the product |
| Tax rounding | Select | none / nearest / up / down (+ precision) |
| Default tax rate | Select (from GST rates) | fallback when product has none |

**Preview (right):** a sample line item: price → taxable value → CGST+SGST (or IGST) → total, re-computing when inclusive/exclusive flips.

> Show a note in-panel: **tax is normally set per product; these are defaults/rules, not a replacement for product-level tax.**

### 6.4 💳 Payment Methods — `CFG` (new `AppConfig.payments`)

| Setting | Control | Note |
|---|---|---|
| Cash / Card / UPI / Bank transfer / Credit / Other | List of Switches | enable/disable each method |
| Default payment method | Select (from enabled) | consolidates the duplicated flag — see §7 |
| Allow split payment | Switch | |
| Allow credit sale | Switch | |

**Preview (right):** a mock payment dialog showing only enabled methods, with the default highlighted.

> No gateway configuration — you are not integrating a payment gateway yet.

### 6.5 💵 Cash Box & Shifts — `CFG` (new `AppConfig.cashbox`) — **rules only, never transactions**

| Setting | Control | Note |
|---|---|---|
| Enable cashier shifts | Switch | |
| Require opening cash | Switch | |
| Require closing cash count | Switch | |
| Denominations enabled | multi-Switch list | ₹500 / ₹200 / ₹100 / ₹50 / ₹20 / ₹10 / ₹5 / ₹2 / ₹1 — controls which appear in the counter |
| Allow cash withdrawal | Switch | |
| Allow cash deposit | Switch | |
| Allow cash adjustment | Switch | |
| Manager approval for cash adjustment | Switch | ties to permissions |
| Cash discrepancy threshold | Number (currency) | flag variances above this |

**Preview (right):** a mock shift-open panel + denomination counter reflecting the enabled denominations.

> The actual denomination counting and cash movements are **cash-box operations, not settings** — the setting only decides whether/what is required.

### 6.6 👨‍💼 Users & Permissions — `SQLITE` (new tables + IPC) — this is entity data, **not** `config.json`
Use in-category sub-tabs: **Users | Roles | Permissions**.

- **Users** (`List`): Add / Edit / Disable. Fields: name, **PIN (masked; store a hash, never plaintext)**, role (Select), active (Switch).
- **Roles**: seed **Admin / Manager / Cashier**; allow adding roles. (Keep it to these three until the product genuinely needs more.)
- **Permissions** (`Matrix`, roles × permissions): Create bill · Cancel bill · Refund · Apply discount · Change selling price · Edit inventory · Create purchase · Create expense · Modify cash box · View reports · Change settings.

Suggested schema: `users(id, name, pin_hash, role_id, active, created_at)`, `roles(id, name, is_system)`, `role_permissions(role_id, permission_key, allowed)`. Expose via new IPC channels (e.g. `IPC_CHANNELS.USERS.*`) with handlers in `main.ts`.

**Preview (right):** the permission matrix, or a selected user's effective-permissions card.

### 6.7 📦 Inventory — `CFG` (new `AppConfig.inventory`) — behavior rules

| Setting | Control | Note |
|---|---|---|
| Enable inventory tracking | Switch | |
| Allow negative stock | Switch | |
| Low-stock threshold (default) | Number | per-product overrides live on the product |
| Low-stock alerts | Switch | |
| Out-of-stock alerts | Switch | |
| Stock valuation method | Segmented | FIFO / Weighted Average |
| Enable expiry tracking | Switch | |
| Enable batch tracking | Switch | |
| Enable serial number tracking | Switch | only if products need it |
| Default unit | Select | kg / g / pcs … (meat-shop relevant) |

**Preview (right):** a product card + low-stock alert badge reflecting the threshold. No multi-warehouse / multi-store.

### 6.8 🔄 Returns & Refunds — `CFG` (new `AppConfig.returns`)

| Setting | Control |
|---|---|
| Enable returns | Switch |
| Return period (days) | Number |
| Allow partial return | Switch |
| Allow exchange | Switch |
| Refund to original payment | Switch |
| Cash refund | Switch |
| Store credit | Switch |
| Require return reason | Switch |
| Manager approval | Switch |
| Automatically return stock | Switch |

**Preview (right):** a mock return dialog reflecting the enabled options.

### 6.9 🖨️ Printer & Hardware — `CFG` (`AppConfig.hardware` + `receiptTemplate`; reuse existing)

| Setting | Control | Note |
|---|---|---|
| Receipt printer | Select (system printers) | `hardware.printerName` |
| Default printer | Select | |
| Receipt size | Segmented | mirror of Billing (58/80/A4) |
| Test print | Button | fires a test receipt |
| Auto-print | Switch | mirrors `receiptTemplate.autoPrintOnComplete` |
| Barcode scanner | Switch | `hardware.barcodeScannerEnabled` |
| Cash drawer (open on sale) | Switch | NEW |
| Customer display | Switch | only if supported |
| **Weighing scale** (serial port + baud) | Select/Text | existing `hardware.scalePort` / `scaleBaudRate` — **keep**, it's core for a meat shop |

**Preview (right):** printer status card + Test-print button + the thermal receipt preview.

### 6.10 ⚙️ System & Data — mixed (`CFG` + system/IPC)

| Setting | Control | Note |
|---|---|---|
| Application version | read-only | from `package.json` / app |
| Database status | read-only | connected? size? path? |
| Backup | Button | reuse existing backup util |
| Restore backup | Button (+ confirm modal) | |
| Export data | Button | reuse existing CSV export |
| Import data | Button | |
| Check for updates | Button | |
| System diagnostics | Button/panel | |
| Clear cache | Button (+ confirm) | |

**Preview (right):** a system status card — version, DB status, last-backup timestamp.

### 6.11 Retained existing categories (keep working, re-homed)
- **🎨 Appearance** (`LOCAL`, `pos_appearance`): the 10-color accent picker (§3–§4), theme mode (Light/Dark/System), POS layout (Classic/Touch), tile size, cart display. **Preview:** the live POS mockup with the accent applied. *(This is where the "layout type on the left, preview on the right" requirement is most literal — put the layout/tile/cart controls on the left, the POS mockup on the right.)*
- **⌨️ Keyboard Shortcuts** (`LOCAL`, `pos_keyboard_shortcuts` via `usePOSShortcutsStore`): checkout / cash / upi / card / split / credit key bindings. **Preview:** a keycap visualization of the current bindings.
- **🍗 Live Bird Yield & Ratios** (`LOCAL`, `meat_shop_ratios_config_v1` via `useMeatShopConfigStore`): chicken whole ratio, chicken boneless ratio, goat live-to-dressed %, reset-to-defaults. **Preview:** a small yield calculator sample.

---

## 7. Persistence & data model — consolidate, don't fragment

Today, settings are spread across **five** stores (config.json, and four different `localStorage`/zustand buckets), and `skipPaymentConfirmation` / `defaultPaymentMethod` are duplicated in **three** places. Do not add a sixth bucket. Follow this policy:

1. **Store/app configuration → one source of truth in `config.json`.** Extend the `AppConfig` interface in `src/core/shared/types.ts` with new nested sections: `business`, `invoice`, `tax`, `payments`, `cashbox`, `inventory`, `returns` (plus existing `shopInfo`, `hardware`, `receiptTemplate`). **Extend the zod schema in `config_service.ts` to match** (note: `billingSettings` currently isn't in the schema — add it so it stops being stripped). Read/write via the existing `IPC_CHANNELS.CONFIG.GET/UPDATE` + React Query key `['config']`.
2. **Relational/entity data (Users, Roles, Permissions) → SQLite** via better-sqlite3, exposed through new IPC channels. Never store user lists or PIN hashes in `config.json` or `localStorage`.
3. **Device-local visual prefs → keep in `localStorage`**: accent/theme/layout (`pos_appearance`), keyboard shortcuts (`pos_keyboard_shortcuts`), meat-yield ratios (`meat_shop_ratios_config_v1`). These are per-machine and want instant application — leave them where they are.
4. **De-duplicate the payment/print flags.** Make `AppConfig.billingSettings` (in `config.json`) the single source for `skipPaymentConfirmation` and `defaultPaymentMethod`; have `useBillingSettingsStore` and the appearance config read from it instead of keeping their own copies. Migrate any existing `localStorage['pos_print_without_confirming']` value on first run.
5. **Draft/dirty pattern for the screen:** hold an in-memory working draft (a `useSettingsDraftStore` zustand slice, or local state) seeded from the live values. Controls mutate the draft; the action bar shows dirty state; **Save** diffs the draft and writes each field to its correct layer (CFG via IPC, SQLITE via IPC, LOCAL directly); **Cancel** discards; **Reset to defaults** loads documented defaults for the active category only.

---

## 8. Components to build (there is no shared UI lib yet)

Create a small, reusable settings UI kit under **`src/modules/settings/frontend/components/ui/`** (styled with the existing `index.css` classes + Tailwind tokens; icons from lucide-react):

- `SettingsScreen` — the 3-region `h-screen` shell + routing entry (replaces inline `SettingsView`).
- `SettingsNavRail` — grouped, searchable, keyboard-navigable category list (`role="tablist"`).
- `SettingsCategory` — panel wrapper: title (`font-outfit`) + description + the only `overflow-y-auto` scroll region (`role="tabpanel"`).
- `SettingRow` — consistent label + helper text (left) and control (right) alignment; the atomic unit of every category.
- `PreviewPane` — sticky right frame with a header and a per-category slot.
- `SettingsActionBar` — dirty indicator + Reset / Cancel / Save.
- Field primitives: `Switch`, `SegmentedControl`, `Select`, `NumberStepper`, `TextField`, `TextArea`, `AccentSwatchPicker`, `PermissionMatrix`, `DenominationToggles`, `KeyBindingRow`.

Each primitive: controlled, typed props, `id`/`label` association, visible focus ring (`focus-visible:ring-2 ring-border-focus`), disabled state, dark-mode correct.

---

## 9. Accessibility & polish

- **Full keyboard operability:** Tab into the rail, ↑/↓ to move between categories, Enter/Space to activate; within a panel, all controls reachable and operable by keyboard; the accent picker is an arrow-key radiogroup.
- **ARIA:** `tablist`/`tab`/`tabpanel` for rail+panel, `aria-current` on active category, `aria-pressed`/`role="switch"` on toggles, `role="radiogroup"` for accent + segmented controls, labelled inputs, `aria-live="polite"` on the dirty/"Saved" status.
- **Contrast:** WCAG AA in both themes; the accent palette is pre-verified — keep white text only on the `base` (not `hover`) for accent buttons.
- **Motion:** transitions ≤150ms, gated behind `motion-safe:`; honor `prefers-reduced-motion`.
- **Search:** typing in the header search filters visible categories and highlights matching settings; Esc clears.
- **Focus management:** switching category moves focus to the panel heading; opening a confirm modal traps focus and restores it on close.

---

## 10. NON-goals — do NOT build these (scope creep)

Loyalty · Multi-store · Multi-warehouse · Delivery management · Restaurant/Kitchen settings · SMS provider · WhatsApp integration · E-commerce integrations · Accounting integrations · Gift cards · Complex pricing levels · Customer-specific pricing · Advanced API settings · Developer console · Two-factor auth · Complex notification engine · Cloud sync · Enterprise device management · Payment-gateway configuration · Per-printer-model config pages.

If you think one is genuinely needed, leave a `// TODO(scope):` comment and a note in the PR description — do not implement it.

---

## 11. Definition of done (acceptance criteria)

1. `/settings` renders the new 3-region screen; **at no window size ≥ 1100×700 does the page itself scroll** (only the center controls column may scroll internally).
2. Controls are on the left/center and a **live, category-specific preview is on the right** and updates as values change (verify at least: Billing receipt, Appearance POS mockup, Tax line-item, Permissions matrix).
3. The accent picker shows **10** colors; selecting any one recolors the whole app instantly and persists across restart; the existing 4 ids are unchanged; new ids (`sky/blue/indigo/violet/fuchsia/rose`) persist correctly.
4. Every setting in §6 is present with the specified control and persists to the correct layer (CFG / SQLITE / LOCAL); Save/Cancel/Reset + dirty tracking behave correctly.
5. Users/Roles/Permissions are backed by SQLite; PINs are hashed; the permission matrix round-trips.
6. All previously existing features still work (theme, layout, shortcuts, yield ratios, shop profile, receipt template, backup/CSV, scale config).
7. `skipPaymentConfirmation` / `defaultPaymentMethod` now have a single source of truth; old values migrate without loss.
8. Full keyboard navigation + ARIA roles verified; light & dark parity; WCAG AA contrast; reduced-motion respected.
9. TypeScript strict passes; zod schema matches `AppConfig`; no console errors; no purple brand flash on cold load.

---

## 12. Suggested build order

1. Palette + token fixes (§3) — smallest, immediately visible win; verify accent switching + no purple flash.
2. Extract `SettingsScreen` shell + nav rail + action bar + draft/dirty store (§5, §7-5) with the two existing panels (Appearance, Shortcuts) ported in.
3. Build the UI-kit primitives (§8).
4. `AppConfig`/zod extension + Business, Billing (with live receipt preview), Printer & Hardware (§6.1, 6.2, 6.9, 7-1).
5. Tax, Payment Methods, Cash Box, Inventory, Returns (§6.3-6.5, 6.7, 6.8) + de-dup flags (§7-4).
6. Users & Permissions on SQLite (§6.6).
7. System & Data + Yield ratios re-home (§6.10, 6.11).
8. A11y pass, keyboard nav, search, dark-mode QA (§9), then acceptance run (§11).

---

## Appendix A — full `ACCENT_COLORS` reference (10 colors)

Keep your existing 4 entries' `id`s exactly as they are in `AppearanceContext.tsx`; this array shows the intended full set (swatch classes are examples — match your Tailwind palette):

```ts
export const ACCENT_COLORS = [
  // --- existing 4: keep ids identical to current file ---
  { id: 'teal',    name: 'Professional Teal', hex: '#0f766e', hover: '#0d9488', active: '#115e59', tint50: '#f0fdfa', tint100: '#ccfbf1', swatch: 'bg-teal-700' },
  { id: 'green',   name: 'Forest Green',      hex: '#15803d', hover: '#16a34a', active: '#166534', tint50: '#f0fdf4', tint100: '#dcfce7', swatch: 'bg-green-700' },
  { id: 'amber',   name: 'Warm Amber',        hex: '#b45309', hover: '#d97706', active: '#92400e', tint50: '#fffbeb', tint100: '#fef3c7', swatch: 'bg-amber-700' }, // ⚠ this entry may currently be id:'orange' in your file — KEEP whatever id already exists, do NOT rename (would reset saved prefs)
  { id: 'slate',   name: 'Graphite',          hex: '#475569', hover: '#64748b', active: '#334155', tint50: '#f8fafc', tint100: '#f1f5f9', swatch: 'bg-slate-600' },
  // --- 6 new, append ---
  { id: 'sky',     name: 'Ocean Cyan',        hex: '#0369a1', hover: '#0284c7', active: '#075985', tint50: '#f0f9ff', tint100: '#e0f2fe', swatch: 'bg-sky-700' },
  { id: 'blue',    name: 'Royal Blue',        hex: '#1d4ed8', hover: '#2563eb', active: '#1e40af', tint50: '#eff6ff', tint100: '#dbeafe', swatch: 'bg-blue-700' },
  { id: 'indigo',  name: 'Deep Indigo',       hex: '#4338ca', hover: '#4f46e5', active: '#3730a3', tint50: '#eef2ff', tint100: '#e0e7ff', swatch: 'bg-indigo-700' },
  { id: 'violet',  name: 'Violet',            hex: '#6d28d9', hover: '#7c3aed', active: '#5b21b6', tint50: '#f5f3ff', tint100: '#ede9fe', swatch: 'bg-violet-700' },
  { id: 'fuchsia', name: 'Magenta',           hex: '#a21caf', hover: '#c026d3', active: '#86198f', tint50: '#fdf4ff', tint100: '#fae8ff', swatch: 'bg-fuchsia-700' },
  { id: 'rose',    name: 'Crimson Rose',      hex: '#be123c', hover: '#e11d48', active: '#9f1239', tint50: '#fff1f2', tint100: '#ffe4e6', swatch: 'bg-rose-700' },
] as const;
```

Contrast (white text on `base`, WCAG 2.x, sRGB): teal 5.5 · green 5.0 · amber 5.0 · slate 7.6 · sky 5.9 · blue 6.7 · indigo 7.9 · violet 7.1 · fuchsia 6.3 · rose 6.3 — **all ≥ 4.5:1 (AA); green and amber are the tightest at ~5.0.** Do not lighten the `base` values or use white text on the lighter `hover` shade for buttons.
