# AOLMS password recovery

- Signed-in users in all three roles can open **Account → Change password**. AOLMS verifies the current password using Supabase and asks for the new password twice.
- On the login screen, **Forgot password?** requests a recovery email without displaying whether the account exists. The email takes the user to **Reset password**. AOLMS uses a separate in-memory recovery session and removes recovery credentials from the address bar.

## Production setup

1. In Supabase **Authentication → URL Configuration**, allow the exact redirect URL `https://aolms-project.vercel.app/reset-password` (and `http://localhost:3000/reset-password` for local development if needed).
2. Keep the standard reset email confirmation link (the reset email template uses `{{ .ConfirmationURL }}`). This app uses Supabase's browser recovery callback.
3. Configure [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) to deliver recovery emails to technicians outside the Supabase project team.
4. Optionally enable [Require current password when changing password](https://supabase.com/docs/guides/auth/password-security) to enforce the old-password check at the provider too. Recovery links remain the alternative for users who forgot their current password.

After deployment, test end to end with a dedicated test user: request and open the email, set a new password, and verify sign-in with that password. No production email is sent by the browser regression tests.
