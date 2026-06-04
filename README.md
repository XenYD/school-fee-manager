# School Fee Management System

A full-featured, mobile-friendly school fee management web app built with React + Supabase. Works on any phone browser without installation.

## Features

- **Multi-school support** — each school's data is completely isolated
- **Three user roles** — Admin, School Owner, Staff/Teacher
- **Mobile-first design** — works perfectly on phone browsers
- **Fee management** — mark fees paid/unpaid per student per month
- **Auto monthly reset** — every month starts fresh (no paid records)
- **Excel import** — admin can bulk-import students from .xlsx files
- **PDF receipts** — download individual payment receipts
- **Monthly reports** — download full PDF summary per school
- **Secure** — Row Level Security (RLS) enforced at database level

---

## Quick Setup

### Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up (free tier works)
2. Click **New Project** and fill in the details
3. Wait for the project to be ready (~2 minutes)

### Step 2: Run the Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New query**
3. Copy the entire contents of `supabase/schema.sql` and paste it
4. Click **Run** (the green button)

### Step 3: Configure Environment Variables

1. Copy the `.env.example` file to `.env`:
   ```
   cp .env.example .env
   ```

2. In Supabase dashboard, go to **Settings → API**
3. Copy the **Project URL** and **anon public** key
4. Paste them into your `.env` file:
   ```
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### Step 4: Create the First Admin User

1. Run the app locally:
   ```bash
   npm run dev
   ```
2. Go to `http://localhost:5173/signup`
3. Create an account with your admin email and password
4. In Supabase SQL Editor, run this (replace the email):
   ```sql
   UPDATE public.profiles
   SET role = 'admin', school_id = NULL
   WHERE email = 'admin@yourdomain.com';
   ```
5. Log in at `/login` — you'll be taken to the Admin panel

### Step 5: Run Locally

```bash
npm install
npm run dev
```

---

## User Roles & Access

| Feature | Admin | School Owner | Staff |
|---------|-------|-------------|-------|
| View all schools | ✅ | ❌ | ❌ |
| Add/delete schools | ✅ | ❌ | ❌ |
| Import students from Excel | ✅ | ❌ | ❌ |
| Manage users & roles | ✅ | ❌ | ❌ |
| View own school dashboard | ✅ | ✅ | ✅ |
| Add/remove students | ✅ | ✅ | ✅ |
| Mark fees paid/unpaid | ✅ | ✅ | ✅ |
| Download PDF receipts | ❌ | ✅ | ✅ |
| Download monthly reports | ❌ | ✅ | ✅ |

---

## Adding School Owners & Staff

1. Share the `/signup` URL with the new staff member
2. They create an account (default role: Staff)
3. Log in as Admin → go to **Users**
4. Find their name → click **Edit**
5. Set their **Role** (Staff or School Owner) and assign their **School**
6. They can now log in and access their school's data

---

## Excel Import Format

When importing students, your Excel file must have these columns (column names are flexible):

| Student Name | Class | Fee Amount | Parent Phone |
|-------------|-------|-----------|-------------|
| Ahmed Ali | 5A | 5000 | 03001234567 |
| Sara Khan | 5B | 4500 | 03009876543 |

**Accepted column name variations:**
- Name: `Student Name`, `Name`, `Full Name`, `Student`
- Class: `Class`, `Grade`, `Section`
- Fee: `Fee Amount`, `Fee`, `Amount`, `Monthly Fee`, `Fees`
- Phone: `Parent Phone`, `Phone`, `Mobile`, `Contact`, `Parent Mobile`

---

## Monthly Fee Reset

Every month, all students start with **unpaid** status automatically. The system uses a month+year based record system — if no payment record exists for the current month, the student is shown as Unpaid. When you mark a fee as paid, a record is created for that month. This means:

- **January**: all unpaid by default → mark paid as you collect
- **February**: all unpaid again (fresh start) → mark paid again
- No manual reset needed, it's fully automatic

---

## Deploy to Vercel (Free)

1. Push your code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/school-fee-manager.git
   git push -u origin main
   ```

2. Go to [vercel.com](https://vercel.com) → **New Project**
3. Import your GitHub repository
4. Add environment variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Click **Deploy**

Your app will be live at `https://your-app.vercel.app`

---

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS 3
- **Database & Auth**: Supabase (PostgreSQL + GoTrue)
- **PDF Generation**: jsPDF + jsPDF-AutoTable
- **Excel Parsing**: xlsx (SheetJS)
- **Icons**: Lucide React
- **Notifications**: React Hot Toast
- **Routing**: React Router DOM v6
- **Deploy**: Vercel (free tier)

---

## Project Structure

```
src/
├── lib/            # Supabase client
├── types/          # TypeScript interfaces
├── context/        # Auth context (React Context API)
├── components/     # Layout, ProtectedRoute, LoadingSpinner
├── pages/
│   ├── admin/      # Admin dashboard, schools, users
│   └── school/     # School dashboard, students, fees
└── utils/          # PDF generation, Excel parsing
supabase/
└── schema.sql      # Full database schema + RLS policies
```

---

## Security

- All database tables use **Row Level Security (RLS)**
- School owners and staff can **only access their own school's data**
- Role assignment is stored in `app_metadata` (not editable by users)
- No service role key is exposed in the frontend
- All data queries are validated server-side through RLS policies
