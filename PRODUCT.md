# Product
<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
Recreational badminton and pickleball groups in Vietnam: friends, colleagues or neighbours, 4–20 people, playing once or several times a week on rented courts.

- **Organiser (quản lý):** one person in the group holds the phone at the court, marks who came, sets the courts, generates pairings round after round, records results and collects the court money. Often playing at the same time, so every action must be quick, one-handed and interruptible.
- **Players (người xem):** open the room link shared in the group's Zalo chat to see where and when they play, check themselves in, and get told when it is their turn. They do not edit the schedule.
- **Helper organisers (quản lý phụ):** a second person trusted to run pairings when the organiser is busy, without access to room settings.

## Product Purpose
Take the arguing and the mental arithmetic out of a group session: fair rotation (everyone plays about the same number of games, nobody sits out twice in a row, partners and opponents vary, teams are level), a schedule everyone can see live on their own phone, and the end-of-session money split. Success is a session where nobody asks "who's next?" or "how much do I owe?".

## Positioning
Built around how Vietnamese groups actually play: the schedule and invite live in the Zalo chat, payment is a VietQR bank transfer, courts are rented by the hour and change mid-session, and the same app serves both badminton and pickleball (doubles or singles, rounds or open-play queue).

## Operating Context
- Used standing courtside, on a phone, often mid-game, in noisy halls with weak signal.
- Shared through Zalo / Messenger as a link, text or image.
- Sessions follow a ritual: people arrive (some late), courts are assigned, rounds or a queue run for 1–3 hours, results are optionally recorded, money is split, a new session starts next week with the same player list.
- Rooms: each group has a room with a view password and an admin code; a public lobby lists room names only.

## Capabilities and Constraints
- Static web app (HTML/CSS/vanilla JS in `js/`), no build step, deployable to GitHub Pages; optional Firebase Realtime Database on the free Spark plan for shared rooms.
- Pairing: rounds or queue mode, 1–10 courts, doubles/singles, balanced (levels 1–5 or Elo ratings) or random, late-arrival credit, add/remove court mid-round, planned rounds preview.
- Results, session stats, multi-session archive, best partner pairs, mini tournaments (round robin, knockout).
- Self check-in, "your turn" alerts, cost splitting with VietQR codes, share as text or image.
- Must keep working offline (service worker; edits sync on reconnect).
- Terminology (keep consistent): phòng, quản lý / quản lý phụ / người xem, vòng, sân, nghỉ, hàng chờ, có mặt / vắng, trình độ, buổi, giải đấu.

## Brand Commitments
- Name: **Xếp Sân**. Logo: shuttlecock with a pickleball paddle and ball on a green-to-blue court tile (`icons/`).
- Sport colours: green for badminton, blue for pickleball; the drawn court is the product's signature element.
- Typeface: Be Vietnam Pro.
- Free, no accounts, no ads.
- Vietnamese UI, mobile-first and one-handed.
- Must work offline at the venue.

## Evidence on Hand
No testimonials, user counts, press or partner logos exist. Do not invent any. Sample names in tests and screenshots are placeholders, not real users.

## Product Principles
1. Courtside first: every task must work one-handed, in seconds, on a phone with poor signal.
2. Fairness is visible: the schedule explains itself (who rests, who is next, why) so the group trusts it without the organiser defending it.
3. The organiser runs it, everyone sees it: edits need the admin code; everything else is read-only and live.
4. Free and frictionless: no sign-up, no install required, a link in Zalo is enough.

## Accessibility & Inclusion
WCAG 2.1 AA: text contrast ≥4.5:1 (large ≥3:1), touch targets ≥24px with main controls at 44px, full keyboard and screen-reader support (dialogs, switches, pressed states, live announcements), reduced-motion keeps state feedback.
