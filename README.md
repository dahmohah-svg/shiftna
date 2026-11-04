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
| `supabase/migrations/` | Database SQL files (coming in the next step). |

## Rules

- Never use the Supabase **service-role** key in browser code.
- All access rules live in Row Level Security policies, not in the interface.
- Never log or display document file contents; documents are private.
- Validate all inputs on the server.
- Use logical CSS (`ms-`, `me-`, `ps-`, `pe-`, `start`, `end`) instead of
  `left`/`right` so layouts flip correctly in Arabic.
