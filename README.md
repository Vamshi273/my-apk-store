# My APK Store — GitHub Pages + Supabase

A static APK catalogue with Supabase email/password admin login, uploads, public downloads, and delete controls.

## Free-plan notes
- Supabase Storage allowance and file-size/bandwidth limits can change; check your dashboard's current quotas.
- This starter caps each APK at 50 MiB in the browser and bucket configuration.
- Public bucket means anyone with a file URL can download that file. Never upload private or sensitive APKs.
- GitHub Pages serves static files only. Supabase is the backend.
- Do not put a Supabase service-role/secret key in this project. Use only the project's publishable/anon key.

## 1. Configure Supabase

1. Open your Supabase project dashboard.
2. Go to **SQL Editor** -> **New query**.
3. Copy all contents of `supabase_setup.sql`, run it, and confirm it succeeds.
4. Go to **Project Settings -> API** (or API Keys) and copy the **Project URL** and **publishable key** (legacy projects may label the public key `anon`).
5. Open `app.js` and replace:
   - `YOUR_SUPABASE_PROJECT_URL`
   - `YOUR_SUPABASE_PUBLISHABLE_KEY`
6. In **Authentication -> Providers -> Email**, keep email/password sign-in enabled. For a private admin-only site, turn off public sign-ups if that setting is available. Do not rely on hiding the login button as security.

## 2. Create your admin user

1. In Supabase, open **Authentication -> Users**.
2. Add a user with your own email and a strong password. If the dashboard offers “Create user” / “Confirm email”, use it to create a confirmed admin account.
3. Copy that user's **UUID/ID**.
4. In SQL Editor, run this query with your real UUID:

   ```sql
   insert into public.admin_users (user_id)
   values ('PASTE-ADMIN-USER-UUID-HERE');
   ```

5. Do not share the password or UUID publicly. Only UUIDs inserted into `admin_users` can upload/delete.

## 3. Test locally (optional)

Because this uses ES modules, open the folder in VS Code and use a local static server extension such as Live Server. Opening `index.html` directly as a `file://` URL may block module loading.

## 4. Publish to GitHub Pages

1. Create a GitHub repository named `my-apk-store` (or your chosen name).
2. Upload these files to the repository root: `index.html`, `styles.css`, `app.js`, `supabase_setup.sql`, and `README.md`.
3. On GitHub, open **Settings -> Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select branch `main`, folder `/(root)`, and save.
6. Wait for the deployment, then open `https://YOUR-GITHUB-USERNAME.github.io/my-apk-store/`.

If your repository has a different name, use that name in the URL.

## 5. Add / remove apps

- Visit the website and click **Admin**.
- Sign in using the Supabase admin account.
- Fill in the name, version, description, and APK. An icon is optional.
- Delete an app using the admin list. This removes its storage files and database row.

## Security / behaviour
- The public catalogue is readable by visitors.
- Storage is public for downloads, but upload/update/delete require an authenticated allowlisted admin.
- Public visitors cannot insert or delete catalogue rows through the database policies.
- The APK's direct public URL can be shared. Use a private bucket and signed URLs instead if you need access-controlled downloads.
- For high traffic or large files, check bandwidth and storage quotas before launch.
- This starter does not verify APK signatures, scan uploads for malware, or prove that an APK is safe. Only distribute files you own or have permission to share.
