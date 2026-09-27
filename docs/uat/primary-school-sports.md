# Primary school sports UAT scenario

Applied only to `skolo-saka-test` (`faytrobauwibxujvmbct`). No PROD data changes.

Phalaborwa Primary School and Namakgale Primary School each have U13 soccer (11 players), rugby (15 players), and netball (7 players). All 66 learners, ages, match results and venue labels are fictional fixtures, not claims about actual pupils or school events. School records remain unverified.

Accounts were created through the guarded UAT registration endpoint, using synthetic numbers 0600000001–0600000066 and randomly generated credentials. Credentials are not stored here. These identities have no admin assignments. Account app metadata records `uat_synthetic`, `uat_scenario` and the corresponding `sports_player_id`; public profile and roster data contain no phone numbers.

The student membership enum change was applied separately. The seed script requires all 66 synthetic accounts to exist before mutating data. It preserves initial fixture/scorer IDs while replacing the original Demo records and adds fixtures for rugby and netball. Publication/consent timestamps in this scenario are simulated test data; they must never be used as evidence of real guardian consent.

Verified: 66 student memberships, 66 linked accounts/player profiles, six correctly sized rosters, no remaining Demo team/player names. Existing real tester accounts and school memberships were preserved.

## Profile photos, badges and rosters

Account photos are stored in the private `profile-photos` bucket. The authenticated upload API validates and decodes raster images, strips metadata, crops to 512px and stores WebP. Account owners can preview their own photo; a school manager or super admin must confirm photo permission before publishing it on a consented player profile. Replacing an account photo leaves the previous approved photo unchanged until reviewed. Published photos can be hidden in Players.

Sports → Manage sports → Rosters assigns existing same-school players to teams or removes them. Team/school permissions are checked in the transactional database RPC. Confirmed historical results remain intact. Sports badges derive from team memberships and confirmed events/results, rather than editable account metadata. The Results screen assigns Player of the Match; another authorised person confirms the result.

Mobile navigation uses two roomy rows below 480px, preserving all seven destinations and their order. `/uat/mobile-preview` is an isolated UAT-only 390px verification view.
