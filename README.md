# FRONTIERS Online Alpha 0.8

Turkish turn-based strategy simulation: six countries with 16 land regions each (96 total), six connected maritime zones, seeded asymmetric terrain, and six selectable scenarios. Supports browser-local hotseat and durable shared online rooms for six independent players. No AI opponents.

## Simplified economy

Only three construction types: farm (+3 food), energy (+3 energy), and military facility (unit production + connected supply hub). Material, mines, civilian industry and separate depot construction were removed. Stable supplied land earns tax. Four regions consume one food; naval upkeep is included. Ports are inherent coastal region features rather than another construction type. Resource stocks are credit, food, energy.

## Scenarios

Survival, development, territorial expansion, maritime trade, diplomacy and collective relief. Each has distinct implemented objective conditions, displayed progress and 3 public-objective points. Seeded hidden roles provide another 3 points. Maritime starts with extra fleets/resources; expansion deploys main armies to frontiers. Relief has contributions in rounds 2–3 and a common 18-credit threshold; failure at the end of round 3 costs all countries four credits and one stability.

## Maritime play

The coastline is traced from the user's supplied Mercator reference, including Greenland, Iceland, Britain/Ireland, New Guinea and New Zealand. Each country still contains exactly 16 provinces; named islands count within those 16. Europe and Asia share real land borders. Panama and Sinai are land corridors; Gibraltar is a short sea crossing. Greenland–Iceland–Britain, the Channel, Bering, South Atlantic and Africa–Australia are explicit playable sea links; Africa–Australia is a requested game shortcut. Green corridor lines follow land; dotted lines are abstract Risk-style sea crossings that ground units can use without ships. All land adjacency, supply and air distances use this same graph. Trading uses real land borders or marked land corridors; maritime army shortcuts do not create land trade routes. North America's surface uses one continuous latitude gradient, while Greenland stays glacial. Terrain allocation is weighted toward regional mountain/forest/wetland patterns. The six-zone naval ring remains a separate abstraction. Frigates move one neighboring sea per turn or undertake a blockade action. Local superior fueled fleet strength is required for blockade; the associated frigate must remain. A blockaded port cannot sea-trade, but an available supplied common land boundary remains usable with neutral countries. Defense reinforcement to parity neutralizes the blockade; a probabilistic naval relief action can remove an enemy ship and blockade. Ship losses, movement or ceasefires also change blockade availability.

Sea trades use functioning, supplied, stable and unblocked ports at both ends, with six units of total food/energy cargo per port per round. Each party pays one credit transport and receives two credits harbor income (net +1). Real trades count toward objectives; cash-only aid does not count as maritime activity and needs no physical route. This is an abstract economic model, not a shipping forecast. No arbitrary amphibious invasions outside the marked crossings or naval interdiction of passing third-party shipping.

## Shared rooms

Vinext/Cloudflare Worker route `/api/rooms` owns the canonical game state. D1 binding `DB` stores each room as JSON with a monotonically increasing revision. Conditional SQL updates prevent conflicting writes, and per-member request receipts make committed command retries idempotent. Only server-approved commands are accepted, never a client-submitted game state. Server cryptographic randomness resolves dice.

An anonymous browser gets an opaque seat token. Only its SHA-256 hash is stored in the room; the raw token stays in browser localStorage and is absent from invite URLs. Eight-character room codes are shared with friends. Members choose distinct countries and mark ready; the host starts when all six are ready. Optional test rooms start with at least two people; absent countries settle upkeep and pass, cannot agree to diplomacy, and defend without air support. Refresh/reconnect with the same browser preserves membership. Returning to local play does not remove the seat or end the room. Browser storage deletion or switching devices loses this alpha's seat credential; no cross-device account recovery exists yet.

Clients poll every two seconds. Only the current country's member can submit game commands. Trade, pact and ceasefire proposals require acceptance by the recipient's authenticated room token. Attacks wait for the defender's air-support choice; after 60 seconds the attacker may resolve without defensive air support, or withdraw before resolution. Other commands are blocked while a proposal is pending. Undo is disabled online. Lobby goals are fully hidden; after start each player receives only their own hidden goal, and the seed is stripped from state and logs. Public scoreboard excludes hidden-goal points until completion. All goals are revealed at game end.

## Storage and checks

The local schema remains 5 under `frontiers-alpha-v5`; older local matches are preserved. Online room credentials use a separate per-room key. Static game sources moved from `dist/` to `public/game/`; `dist/` now contains generated Worker build output. Root redirects to `/game/index.html` and preserves room invitations. The project ID and public audience are unchanged. D1 schema is defined in `db/schema.ts`, with generated migration files under `drizzle/`.

Use the Sites dependency and build helpers. `npm test` runs engine, atlas, DOM wiring, six-client room authority/concurrency/privacy tests and SQLite-backed D1 adapter checks. Managed browser visual QA is unavailable; DOM tests verify event wiring but cannot verify browser layout or pointer behavior. Live HTTP smoke checks should verify creation, joining, readiness, starting, turn ownership and durable reload after deployment. This remains an alpha; balance requires human playtesting. There is no automatic turn timeout or replacement for an absent player, no chat and no account-based seat recovery.

The source is synchronized with the existing Sites Git repository. The site audience is preserved from the native access response (public at time of this update). Use the Sites source workflow and the applicable saved-version deployment tool; never create another Site for these edits.

Country display names are COUNTRY A–F. Existing schema-5 matches are preserved and their display names normalized. The territory lens has six country buttons plus an all-countries reset. It highlights current ownership (including conquests), strengthens every province outline, counts the current regions, and lists all their IDs/named islands and terrain. Viewing a country never changes the active turn.
