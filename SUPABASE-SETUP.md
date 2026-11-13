# Connect the website to Supabase

The public pages and admin panel in this folder share one Supabase database. The site uses only the public publishable key; database row-level security protects admin functions and private messages.

## 1. Create the backend

1. Create a Supabase project at [supabase.com](https://supabase.com/).
2. Open **SQL Editor**, create a query, paste in `supabase-schema.sql`, and run it.
3. In **Authentication → Settings → User Signups**, turn off **Allow new users to sign up**.
4. Create your administrator account from **Authentication → Users**. Use a strong, unique password and confirm the account.
5. In SQL Editor, allowlist that account by replacing the email below and running:

   ```sql
   insert into public.admin_users (user_id)
   select id from auth.users where lower(email) = lower('admin@example.com')
   on conflict (user_id) do nothing;
   ```

   The account must already exist in Supabase Auth before you run this query.

## 2. Add the public connection values

In **Project Settings → API**, copy the Project URL and the **publishable** key (or legacy `anon` key). Put them in `supabase-config.js`:

```js
window.SUPABASE_CONFIG = {
  url: 'https://YOUR-PROJECT-REF.supabase.co',
  publishableKey: 'YOUR-PUBLISHABLE-KEY'
};
```

These are public browser values. Never put a `service_role` or secret key in this website or GitHub.

## 3. Deploy the site and admin

Upload the contents of this folder, including the `admin` folder and the Supabase files, to the root of the existing `ORIOLINE-FORM-TECH` GitHub Pages repository. Keep the directory structure intact.

- Website: `https://skmaxdollar.github.io/ORIOLINE-FORM-TECH/`
- Admin sign-in: `https://skmaxdollar.github.io/ORIOLINE-FORM-TECH/admin/login.html`

Use the email and password created in Supabase Auth to sign in. The account must also be on the `admin_users` allowlist. Do not upload the older admin/login HTML files from the original project; they contain browser-side credentials.

## What is connected

- Admin project changes, featured projects, and website settings are read by the homepage and portfolio from Supabase.
- Project images are stored in the `project-images` bucket.
- The public contact form saves messages in the database; the authenticated admin page lists them, links sender addresses with `mailto:`, and refreshes for new messages every 20 seconds while open.
- Visitors can read projects and public settings and submit a message. They cannot read messages or change site content.

The database starts with the four sample projects and default contact/hero settings. Replace or edit these through the admin panel. Supabase itself must be provisioned and the public values added to `supabase-config.js` before the connected features will work.
