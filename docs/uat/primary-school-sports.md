# Primary school sports UAT scenario

Applied only to `skolo-saka-test` (`faytrobauwibxujvmbct`). No PROD data changes.

Phalaborwa Primary School and Namakgale Primary School each have U13 soccer (11 players), rugby (15 players), and netball (7 players). All 66 learners, ages, match results and venue labels are fictional fixtures, not claims about actual pupils or school events. School records remain unverified.

Accounts were created through the guarded UAT registration endpoint, using synthetic numbers 0600000001–0600000066 and randomly generated credentials. Credentials are not stored here. These identities have no admin assignments. Account app metadata records `uat_synthetic`, `uat_scenario` and the corresponding `sports_player_id`; public profile and roster data contain no phone numbers.

The student membership enum change was applied separately. The seed script requires all 66 synthetic accounts to exist before mutating data. It preserves initial fixture/scorer IDs while replacing the original Demo records and adds fixtures for rugby and netball. Publication/consent timestamps in this scenario are simulated test data; they must never be used as evidence of real guardian consent.

Verified: 66 student memberships, 66 linked accounts/player profiles, six correctly sized rosters, no remaining Demo team/player names. Existing real tester accounts and school memberships were preserved.
