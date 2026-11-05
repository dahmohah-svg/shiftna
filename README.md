# Shiftna | شفتنا

A mobile-first web app (installable PWA) where verified anesthesiologists in
Egypt post and cover shifts. Arabic (right-to-left) is the default language,
with English available from a toggle.

**Stack:** Next.js (App Router) + TypeScript + Tailwind CSS, next-intl for
Arabic/English, Supabase (Auth, Postgres with Row Level Security, private
Storage), deployed on Vercel.

## Run it on your computer

1. Install **Node.js (LTS)** from nodejs.org and **Git**.
2. Download the code and install packages:
   ```bash
   git clone https://github.com/dahmohah-svg/shiftna.git
   cd shiftna
   npm install
   ```
3. Copy the settings file and fill in your Supabase values
   (Supabase → Project Settings → API):
   ```bash
   cp .env.example .env.local
   ```
4. Start the app:
   ```bash
   npm run dev
   ```
5. Open http://localhost:3000. You land on `/ar` (Arabic). Tap **English**
   to switch.

To see the phone layout on a computer: open Chrome DevTools (F12), then click
the phone icon (Toggle device toolbar).

## Checks to run after every change

```bash
npm run lint       # code style problems
npm run typecheck  # type errors
npm run build      # full production build
```

## Where things live

| Path | What it is |
| --- | --- |
| `messages/ar.json`, `messages/en.json` | Every visible word in the app. Edit text here, never in the code. |
| `src/app/[locale]/` | The pages. `[locale]` is `ar` or `en`. |
| `src/app/manifest.ts` | Makes the app installable on a phone. |
| `src/i18n/` | Language settings (Arabic is the default). |
| `src/proxy.ts` | Sends visitors to `/ar` or `/en`. |
| `src/components/` | Reusable pieces such as the language switch. |
| `src/app/[locale]/(app)/` | Screens for approved doctors: shifts, post, offers, bookings, profile, admin. |
| `src/app/actions/` | Server code for every button and form (checks every input). |
| `src/lib/supabase/` | Supabase connection and database types. |
| `supabase/` | Database SQL files and the order they were run. |

## What works (version 1, the pilot app)

- Sign up, confirm email, add details (grade, city, phone), upload the
  Syndicate card, license, specialty certificate and a selfie.
- "Under review" screen until an admin approves; reasons shown if rejected.
- Shifts feed with filters (city, type, subspecialty, paid on the day,
  urgent) and the 24-hour strip; shift details with hospital ratings.
- Post a shift; doctors below the minimum grade see a disabled Offer button.
- Offers: send, withdraw, accept (books the doctor, declines the rest),
  decline. Overlapping shifts are blocked; fatigue warning shown.
- Booking: live chat, "Mark completed", "Did you get paid?", "Doctor did not
  show up", cancel (late cancellations recorded, shift reopens as urgent),
  ratings hidden until both sides submit, report a problem, add to calendar.
- Profile: reliability numbers, rank (yours always; others only for Premium),
  New / Silver / Gold badge, document expiry dates.
- Admin (`/admin`): review doctors with 5-minute private links and expiry
  dates, add and verify hospitals, handle reports, Premium on/off, pause
  accounts. Every action is written to the audit log.

- Alerts tab: live in-app notifications for offers, bookings, cancellations,
  messages, approval, urgent shifts and document expiry; saved shift alerts
  that notify you when a matching shift is posted.

- Hospitals: any approved doctor can add one while posting; the admin
  verifies later. Each hospital shows a credibility level (Verified,
  Trusted, Active, New) based on shifts from different doctors and
  completed shifts. The admin can merge duplicate hospitals; similar names
  in the same city are suggested automatically.
- Teams (private groups): create a team (Premium, checked by admin), invite
  doctors with a code, accept requests, and post shifts only the team sees.

Not built yet (later steps in the guide): usage insights,
email/WhatsApp/phone push notifications, disputes screen, arrival selfie, instant booking,
share links, logbook, rotas, pay ranges, offline mode.

## Put it online (Vercel)

1. On vercel.com: **Add New → Project → Import** the `shiftna` GitHub repo.
2. Under **Environment Variables** add `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (same values as `.env.local`). Deploy.
3. In Supabase: **Authentication → URL Configuration**. Set **Site URL** to
   your Vercel address (for example `https://shiftna.vercel.app`) and add
   `https://shiftna.vercel.app/**` and `http://localhost:3000/**` under
   **Redirect URLs**. Without this, the confirmation email link will not work.
4. Supabase's built-in email only reaches your own team's addresses. For real
   doctors add an email provider under **Authentication → Emails → SMTP**
   (for example Resend). For testing with fake accounts you can switch off
   **Confirm email** under **Authentication → Sign In / Providers → Email**.

## Make yourself the admin

Sign up in the app, then in Supabase open **SQL Editor** and run (with your email):

```sql
update profiles set is_admin = true, status = 'approved', grade = 'consultant', city = 'cairo'
where id = (select id from auth.users where email = 'you@example.com');
```

Doctors can add hospitals themselves while posting; verify them later in
**Profile → Admin panel → Hospitals**.

## Rules

- Never use the Supabase **service-role** key in browser code.
- All access rules live in Row Level Security policies, not in the interface.
- Never log or display document file contents; documents are private.
- Validate all inputs on the server.
- Use logical CSS (`ms-`, `me-`, `ps-`, `pe-`, `start`, `end`) instead of
  `left`/`right` so layouts flip correctly in Arabic.
