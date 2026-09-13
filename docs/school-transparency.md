# School money & transparency

Skolo Saka exposes privacy-preserving school financial transparency through `public.get_school_transparency(school_id)`.

The public school view shows:
- total successful contributions;
- total paid expenditure;
- available balance (contributions minus paid expenditure);
- all currently public projects for the school;
- top 5 contribution amounts first, then the latest remaining contributions;
- approved/paid expenditure with supplier, description, amount, invoice reference and date when available.

Contributor identity is deliberately not exposed by this view. Individual donor names/user ids remain private while transaction amounts and dates stay visible for trust and auditability.

The `/projects` page only loads projects belonging to schools linked to the signed-in user and provides a per-school filter. Each project links to the corresponding `/school/<id>` transparency page.
