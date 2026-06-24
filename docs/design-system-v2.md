# Finance AI Design System V2

Reusable implementation guide distilled from the PM redesign brief dated 2026-06-25.

## 1. Design Principles

- Clean over fancy. Functional over decorative.
- Reduce visual noise before adding new UI.
- Data is the hero. Numbers should carry the interface.
- Use typography, spacing, and hierarchy instead of gradients or many colors.
- Use one accent color plus neutrals.
- Keep AI invisible: the app should feel like a clean finance product, not an "AI feature demo."
- Prefer subtle borders, opacity, and whitespace over loud backgrounds.
- Avoid unnecessary animation. Interactions should feel quiet and fast.

## 2. Color Tokens

Use a dark, neutral base with emerald as the single accent.

```css
:root {
  --color-bg: #0A0A0B;
  --color-surface: #141416;
  --color-border: #1F1F23;
  --color-text-primary: #FAFAFA;
  --color-text-secondary: #71717A;
  --color-text-muted: #52525B;
  --color-accent: #10B981;
  --color-accent-subtle: #10B98115;
  --color-danger: #EF4444;
}
```

Rules:
- Use emerald for primary CTAs, active states, and positive trends.
- Use red only for danger, negative trends, over-budget, and destructive states.
- Use neutral text/borders for most UI.
- Icons should be monochrome: primary text, secondary text, or muted.
- Do not use colored icon circles.
- Do not use purple/blue gradients as brand treatment.
- Charts should use accent plus opacity variations, not rainbow palettes.

## 3. Typography Rules

Recommended font: Inter or Geist.

| Level | Size | Weight | Color | Usage |
| --- | --- | --- | --- | --- |
| Display | 32px | 600 | Text primary | Primary numbers: balance, income, expenses |
| Heading | 20px | 500 | Text primary | Section titles |
| Body | 14px | 400 | Text secondary | Labels, descriptions, helper text |
| Caption | 12px | 400 | Text muted | Timestamps, metadata |
| Mono amount | 14px | 500 | Text primary | Amounts in lists/cards |

Rules:
- Numbers should be larger than labels.
- Labels should be smaller, muted, and secondary.
- Avoid making every card title the same size/weight.
- Do not rely on icons or color to create hierarchy.
- Use tabular/monospace-feeling amount styling where available for finance rows.

## 4. Spacing Rules

- Prefer generous whitespace over boxed sections.
- Remove large decorative welcome/banner areas.
- Use compact top greetings instead of hero banners.
- Recommended quiet greeting pattern:

```text
Good evening, Shashwat                              June 25, 2026
```

- Keep greeting text around 14px, medium weight, no background, no emoji.
- Separate primary dashboard stats with spacing or subtle vertical dividers.
- Use borders only where boundaries are needed.
- Avoid full card borders on every element.
- Prefer compact rows for secondary metrics.

## 5. Component Rules

Buttons:
- One primary button style: emerald fill.
- Secondary actions should be ghost or outline.
- Avoid gradient buttons.
- Avoid colored action-card buttons.

Icons:
- Use monochrome icons.
- Avoid colored icon backgrounds and decorative icon circles.
- Remove sparkle/AI icons unless they communicate real state.

Cards:
- Use cards only when containment is necessary.
- Prefer unframed page sections for dashboard layout.
- Use subtle borders or surface color, not loud fills.
- Avoid uniform card grids where all metrics appear equally important.

Header:
- Remove oversized centered search.
- Move dark mode toggle and language selector to settings.
- User profile should be simple: initials and name.
- Remove "Premium User" badge from header.

Sidebar:
- Logo should be simple text, e.g. "Finance".
- Nav items use icon + label with one neutral color system.
- Active state: subtle left border or accent-subtle background.
- No emoji or decorative nav icons.

Actions:
- Prefer chat/command input as primary interaction.
- Remove bottom gradient action cards where possible.
- If quick actions remain, make them inline ghost buttons:

```text
Quick Actions: [+ Transaction] [+ Goal] [+ Budget]
```

## 6. Dashboard Stat Card Rules

Create tiered hierarchy.

Primary stats:
- Total Balance, Income, Expenses are primary.
- No icon circles.
- Use display-sized numbers, around 32px, weight 600.
- Labels: 12px muted text below.
- Trends: small green/red text, not badges.
- No full card borders required.
- Use spacing or subtle vertical dividers.

Suggested primary layout:

```text
₹2,45,680          ₹85,420           ₹62,340
Total Balance       Income            Expenses
↑ 12.5% vs last     ↑ 8.2%            ↓ 3.1%
month
```

Secondary stats:
- Savings Rate, Investments, Emergency Fund are secondary.
- Use smaller numbers, around 20px.
- Keep in one compact row where space allows.
- Use border-bottom or spacing, not separate loud cards.

Avoid:
- Six identical stat cards.
- Rainbow icons.
- Equal visual weight for all metrics.
- Decorative gradients or colored icon tiles.

## 7. Chart Rules

Balance overview:
- Use a single emerald line.
- Use subtle area fill around 5% opacity.
- Use minimal axes.
- Remove or heavily mute grid lines; faint dotted grid is acceptable.
- Avoid default chart-library styling.
- Remove colored summary cards below charts.
- Put summary context as small text above or in tooltip.

Recommended chart header:

```text
Balance Overview
₹3,448 current · -28.7% vs 6mo ago
```

Time selector:
- Use small text/pill controls: `3M | 6M | 12M`.
- Active state should be underline or subtle accent.
- Avoid filled segmented controls unless very quiet.

Chart palette:
- Accent: emerald.
- Area/secondary series: emerald opacity variants.
- Danger only when showing negative state.
- Do not use rainbow category colors unless the data truly requires comparison.

## 8. Chat Panel Rules

Goal: clean finance chat, not generic chatbot.

Panel:
- Header: "Finance Chat" and close button only.
- Remove implementation details such as "Running in local mode".
- Keep layout minimal and readable.

Messages:
- User messages: right-aligned, subtle accent-subtle background, no heavy border.
- Assistant messages: left-aligned, no bubble background where possible; use clean text.
- Timestamps hidden by default; show only on hover if needed.
- Increase vertical breathing room between messages.
- No suggestion chips in normal chat flow.

Input:
- Full-width bottom input.
- Minimal border/surface.
- Send button should be ghost or very subtle unless active.

Confirmation cards:
- Keep confirmation cards as the only action UI inside chat.
- Card should be clean, bordered, and compact.
- Actions: Confirm, Edit, Cancel.
- Avoid colored action backgrounds except a clear primary confirm treatment.
- Edit should open a small modal/popover when editing structured fields.
- Edit modal should expose only fields users should control, currently Amount and Description.
- Category should be shown on the card, but recalculated automatically from description unless explicitly changed through typed command support.

## 9. Things To Avoid

- Purple/blue gradient banners.
- Rainbow icon backgrounds.
- Colored gradient action cards.
- Over-branding AI with sparkles, "AI" labels, or feature-card framing.
- Large welcome banners that waste vertical space.
- Uniform card grids with no hierarchy.
- Default Recharts visual styling.
- Permanent timestamps in chat.
- Blue user bubbles and generic gray bot bubbles.
- Header clutter: theme toggle, language selector, oversized search, badges.
- Full borders on every card.
- Decorative emoji in dashboard/nav/header UI.
- Loud animations or animated decoration.
- Adding new dependencies for visual polish.
- Replacing established repo patterns when small token/style changes are enough.

## Implementation Constraints

- Preserve all existing business logic.
- Preserve API contracts.
- Preserve transaction confirmation flow.
- Preserve deterministic parser behavior.
- Preserve chat functionality.
- Preserve existing accessibility behavior.
- Prefer small diffs over rewrites.
- Do not introduce new UI libraries.
- Reuse existing components where possible.
- Keep mobile responsiveness intact.
- Update tests only when UI changes require it.

## Rollout Order

1. Design tokens and color system
2. Typography system
3. Dashboard stat hierarchy
4. Header simplification
5. Chart redesign
6. Chat panel redesign
7. Action cleanup
8. Sidebar cleanup

Do not perform all changes in a single implementation pass.
Prefer small, reviewable diffs.