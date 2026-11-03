---
name: Xếp Sân
description: Courtside scheduler for badminton and pickleball groups, built for one thumb and weak signal
colors:
  court-green: "#0e7a57"
  court-green-header-dark: "#0f5a40"
  court-green-soft: "#ddf3ea"
  court-green-bright-dark: "#2fbf8a"
  pickleball-blue: "#1f5fbf"
  pickleball-blue-header: "#1d4fa3"
  pickleball-blue-soft: "#dfeafb"
  pickleball-blue-bright-dark: "#7aa9ff"
  shuttle-gold: "#f5b82e"
  shuttle-gold-soft: "#fff3d1"
  team-a-blue: "#3b7cf0"
  team-b-orange: "#f0782f"
  court-stripe-light: "#2f8f5b"
  court-stripe-dark: "#257a4c"
  pickleball-court: "#2f6fc4"
  ground: "#f4f6f5"
  surface: "#ffffff"
  surface-sunk: "#eef2f0"
  ink: "#0f1b15"
  ink-muted: "#56655d"
  line: "#e2e7e4"
  line-strong: "#cdd5d0"
  danger: "#b42318"
  danger-soft: "#fde8e8"
  ground-dark: "#0b0f0d"
  surface-dark: "#131917"
  surface-sunk-dark: "#1b2320"
  ink-dark: "#e9f0eb"
  ink-muted-dark: "#9aaba1"
  line-dark: "#25302b"
typography:
  headline:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.25
  section:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.45
  body:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  name:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.3
  label:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.3
  figure:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.15
    fontFeature: "tnum"
rounded:
  chip: "999px"
  small: "8px"
  control: "12px"
  input: "14px"
  button: "16px"
  card: "18px"
  court-card: "22px"
  nav: "24px"
  sheet: "26px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.court-green}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    height: "50px"
    padding: "0 18px"
  button-secondary:
    backgroundColor: "{colors.surface-sunk}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    height: "50px"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    height: "50px"
  button-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    rounded: "{rounded.button}"
  button-small:
    rounded: "{rounded.control}"
    height: "40px"
    padding: "0 12px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "14px"
  chip-player:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "44px"
  chip-filter:
    backgroundColor: "{colors.surface-sunk}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    height: "40px"
  chip-filter-selected:
    backgroundColor: "{colors.shuttle-gold-soft}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    height: "50px"
  segmented:
    backgroundColor: "{colors.surface-sunk}"
    rounded: "{rounded.input}"
    height: "44px"
---

# Design System: Xếp Sân

## Overview

**Creative North Star: "The Courtside Scoreboard"**

Xếp Sân should read like the electronic board at a sports hall: big figures, flat panels, plain words, and colour that only ever reports a state (whose turn, who won, who has paid, which sport). It is read at arm's length, one-handed, between rallies, under hall lighting and on a cracked phone, so contrast, size and certainty beat ornament every time.

The only picture in the system is the court itself: a striped green (badminton) or blue (pickleball) floor with white lines and a dashed net, on which player chips sit. Everything around it stays quiet so the court and the names on it carry the screen. The two sport colours are the identity; the gold of a shuttle marks a winner or "next up".

Controls are tactile and sure: large, softly rounded, obviously pressable, with clear pressed and selected states. It must work on the slowest phone in the group, offline, in Vietnamese.

**Key Characteristics:**
- Flat surfaces separated by 1px lines and tone steps; shadows only on things that float.
- One sport colour per room drives header, primary buttons, focus and selection; it never decorates.
- Tabular figures for every number; one typeface throughout.
- One drawn icon set, one stroke weight; no emoji in the interface.
- Big targets (44px for primary controls), visible focus, every state named for screen readers.

## Colors

Two sport hues on a cool off-white (or near-black) ground, with one warm gold for winners and turn alerts.

### Primary
- **Court Green** (#0e7a57): badminton rooms and the app default. Header band, primary buttons, focus ring, selected states, links. On dark the interactive green lifts to **#2fbf8a** with dark text on it, and the header deepens to **#0f5a40** so white type keeps contrast.
- **Pickleball Blue** (#1f5fbf): replaces Court Green everywhere inside a pickleball room (`body.pb`). Header **#1d4fa3**; on dark **#7aa9ff** for controls and **#1d3c70** for the header.

### Secondary
- **Shuttle Gold** (#f5b82e, soft #fff3d1): the winning half of a court, the score pill once a score exists, the next four in the queue, the selected chip during a swap. It means "this one", nothing else.

### Tertiary
- **Team Blue** (#3b7cf0) and **Team Orange** (#f0782f): only as the small dot beside "Đội A / Đội B" and the ring around player avatars on court. Never as text colour (they fail contrast as text).

### Neutral
- **Hall Ground** (#f4f6f5) / dark **#0b0f0d**: page background.
- **Panel** (#ffffff) / dark **#131917**: cards, lists, sheet, nav.
- **Sunk Panel** (#eef2f0) / dark **#1b2320**: segmented controls, secondary buttons, chips.
- **Ink** (#0f1b15) / dark **#e9f0eb**: primary text.
- **Muted Ink** (#56655d) / dark **#9aaba1**: secondary text, meta, labels; 4.5:1 on Panel and Ground.
- **Line** (#e2e7e4) for card edges and row rules; **Strong Line** (#cdd5d0) for control borders.
- **Danger** (#b42318 on #fde8e8): destructive buttons and warning toasts only.

### Named Rules
**The State-Only Colour Rule.** Colour reports a state (sport, selected, winner, paid, next up, danger). If a coloured element does not report one, it is grey.

**The One Sport Rule.** A screen shows one sport hue. The lobby is the only place both appear, one per room card.

## Typography

**Body Font:** Be Vietnam Pro (with system-ui, -apple-system, Segoe UI, Roboto fallback). One family for everything.

**Character:** A friendly geometric grotesk drawn for Vietnamese diacritics; sturdy at 700 for names and figures, calm at 400 for sentences.

### Hierarchy
- **Headline** (700, 24px, 1.1, -0.02em): screen title ("Vòng 3", "Đang đánh", "Giải đấu").
- **Title** (700, 19px): app or room name in the header, dialog titles.
- **Section** (700, 15px): section headings in sentence case ("Có mặt · 8", "Khoản chi"), counts in Muted Ink.
- **Body** (400, 15px, 1.45): sentences, tips, descriptions.
- **Name** (600, 14px): player names on chips, rows and lists; truncated with an ellipsis, never wrapped on court.
- **Label** (600, 12–13px): meta lines, nav labels (10.5px is the floor, in the bottom bar only), team labels.
- **Figure** (700, 18–26px, tabular): counts, scores, money, timers, stepper values.

### Named Rules
**The Sentence Case Rule.** No tracked uppercase labels. Headings and labels are sentence case; emphasis comes from weight.

**The Tabular Rule.** Every number that can change or be compared uses tabular figures.

## Layout

A single column, max 640px, centred, 16px side gutters; sheets and the bottom bar follow the same width. Fixed layers from the bottom: the floating nav (56px buttons in a 24px-radius bar), above it the action bar (54px primary button, one per screen), above them the scrolling content padded so nothing hides behind them.

Rhythm on a 4px base: 8–12px inside groups, 16–18px between cards, 18px above a section heading and 10px below it. The lobby uses a two-column grid of room cards (12px gap); everything else is a list or a stack of cards. Two-up grids (`grid2`, mode pickers, the money summary) are the only other columns. The layout holds from 320px up without horizontal scroll.

## Elevation & Depth

Flat by default. Cards, lists, court cards and inputs sit on the ground with a 1px Line border and no shadow; depth between ground, panel and sunk panel is a tone step. Shadows exist only on what floats above content.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 8px 30px rgba(16,40,28,.18)`; dark `0 8px 30px rgba(0,0,0,.6)`): bottom nav, toast.
- **Chip on court** (`box-shadow: 0 2px 6px rgba(0,0,0,.12)`): player chips sitting on the striped court, so they read as pieces on a floor.
- **Selected chip** (`0 0 0 3px` Shuttle Gold ring + float): the first pick during a swap.

### Named Rules
**The Border-Or-Shadow Rule.** A surface gets a 1px border or a shadow, never both. Resting surfaces get the border.

## Shapes

Soft, consistent rounding chosen once: 12px for small controls, 14–16px for inputs and buttons, 18px for cards, 22px for court cards, 24–26px for the nav and the sheet, full pills for filter chips, tags and level badges. Nested shapes step down (court card 22 → court 16 → chip 12 → avatar circle). Avatars and the VS badge are circles. The court is the one illustrated shape: a rounded rectangle with an inset 2px white boundary and a dashed centre net; pickleball adds a lighter kitchen band beside the net.

## Components

### Buttons
Tactile and sure: big, rounded, unmistakably pressable.
- **Shape:** 16px radius, 50px tall (54px in the action bar); small buttons 12px radius, 40px tall.
- **Primary:** sport colour fill, white label (dark label on dark mode's bright fill), 700 weight, icon left with an 8px gap. One per screen.
- **Secondary:** Sunk Panel fill, Ink label. **Ghost:** Panel with a Strong Line border. **Danger:** Danger Soft fill, Danger label.
- **States:** pressed scales to 0.97; hover brightens the primary; focus shows a 2px sport-colour ring offset 2px; disabled at 55% opacity.

### Chips
- **Player chip (on court):** Panel at 95% opacity, 12px radius, 44px tall; avatar with a team-colour ring, name, level number. Selected: gold ring. "Me": sport-colour ring.
- **Filter / choice chip:** Sunk Panel pill, 40px tall; selected adds Shuttle Gold Soft with a gold inset line and `aria-pressed`.

### Cards / Containers
- **Corner Style:** 18px (court cards 22px).
- **Background:** Panel on Hall Ground.
- **Shadow Strategy:** none; see Elevation.
- **Border:** 1px Line.
- **Internal Padding:** 14px (lists use 10–14px rows separated by 1px rules).
- **Stat strips** (header counts, stats tiles) are one container split by 1px dividers, never separate tiles.

### Inputs / Fields
- **Style:** 1px Strong Line border, Panel or Sunk Panel fill, 14–16px radius, 44–50px tall; label above in 13px Muted Ink.
- **Focus:** border turns sport colour; caret and accent colour are the sport colour.
- **Error:** shown as a Danger toast naming the problem and the fix.

### Navigation
Floating bottom bar of four destinations (Người chơi, Xếp sân, Thống kê, Tiền): icon over a 10.5px label, Muted Ink at rest, sport colour on a soft sport tint when current (`aria-current="page"`), a gold count badge for the live round.

### Dialogs (bottom sheet)
Panel sheet with a 26px top radius sliding up over a 45% black backdrop; `role="dialog"`, focus moves in and returns to the opener, Escape closes, Tab stays inside. Title 19px/700 with an optional sport-colour icon.

### Court (signature component)
The drawn court is the identity of the product. Two halves (Đội A / Đội B) on alternating 24px stripes of Court Stripe Light/Dark (badminton) or a flat Pickleball Court blue with a kitchen band (pickleball), a 2px white inset boundary and a dashed white net. Player chips sit on it; the winning half gets a gold wash and ring, the losing half drops to 55% opacity. Header row: court number badge, editable court name, timer, score pill.

## Do's and Don'ts

### Do:
- **Do** let the sport colour carry every interactive and selected state in a room, and nothing else.
- **Do** use the drawn icon set (`css/icons.css`, `<i class="i i-name">`) at 1.15em, inheriting text colour.
- **Do** keep primary controls at 44px or more and give small in-card controls an invisible 8px hit area.
- **Do** use tabular figures for counts, scores, money and timers.
- **Do** write sentence-case Vietnamese labels that name the action ("Xong · Vòng 4", "Mở thêm 1 sân").
- **Do** check every new screen at 320px and 390px in light and dark.

### Don't:
- **Don't** use emoji in the interface; they are allowed only in text shared to Zalo / Messenger.
- **Don't** use gradients, glass or backdrop blur on any surface or button.
- **Don't** put a border and a shadow on the same surface, or shadow a resting card.
- **Don't** write tracked uppercase labels or eyebrows above headings.
- **Don't** use team blue or orange, or any sport hue, as text colour on light grounds.
- **Don't** show both sport colours on one room screen.
- **Don't** invent testimonials, user counts or sample "users" anywhere in the product.
