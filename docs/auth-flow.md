# Skolo Saka authentication flow

## Returning user
1. Enter South African phone number.
2. Enter 4-digit PIN.
3. Client derives a strong Supabase password from phone + PIN and signs in with Supabase Auth.

## New user / PIN recovery
1. Enter phone number only.
2. Verify ownership with SMS OTP.
3. Create a 4-digit PIN.
4. The app stores a derived password in Supabase Auth. The raw PIN is not stored in the database or localStorage.

## Profile
Registration requires only a phone number. After sign-in, users may optionally add first name, surname and email to their profile.

## School relationship
When a user adds a school they can record the year they left and grade they left in. These fields are designed to support future school-year cohort matching.
