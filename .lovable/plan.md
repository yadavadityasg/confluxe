I can’t retrieve or display the current admin password because it is intentionally stored as a one-way hash.

Plan:
1. Use the backend admin controls to reset the password for the existing admin user instead of trying to read it.
2. Confirm the correct login identifier is `admin@wikispace.local` or username `admin` depending on the sign-in form, not `admin@confluxe.local`.
3. Set a new temporary password, then sign in and immediately change it to a private password.
4. If the backend UI reset path is unavailable, I can implement a short-lived, protected reset mechanism and remove it after use.

Important: the code shows usernames are converted to `@wikispace.local`, so `admin@confluxe.local` is likely the wrong email for this app.