# Game series and franchise API research

## Recommendation

Build this on **IGDB alone**. It has first-class grouping data and
already supplies the game's metadata in the production path. Add two deliberately
different result types:

- **Series** — an IGDB `collection`, which IGDB describes as “Collection, AKA
  Series”.
- **Franchise** — an IGDB `franchise`, a broader publisher/IP grouping.

Both resources expose a `games` array of associated IGDB game IDs, so either can
drive a reviewable “add all games” operation. Do not present those labels as
synonyms: a franchise can contain multiple series, ports, remasters, spin-offs,
and unrelated subseries.

## IGDB capability and query shape

IGDB V4 uses POST requests with an APICalypse query body. The relevant official
resources and documented fields are:

| Need | Resource | Useful fields |
| --- | --- | --- |
| Search broad series candidates | `POST /v4/search` | `name`, `collection`, `game`, `platform`, `theme` |
| Find a series and its members | `POST /v4/collections` | `id`, `name`, `slug`, `games`, `type`, relation fields |
| Find a franchise and its members | `POST /v4/franchises` | `id`, `name`, `slug`, `games` |
| Hydrate the member games | `POST /v4/games` | `id`, `name`, `first_release_date`, `game_type`, `version_parent`, `cover.url`, existing catalog fields |

The [IGDB API reference](https://api-docs.igdb.com/#collection) calls a
collection a series and lists its `games` field. Its
[franchise reference](https://api-docs.igdb.com/#franchise) lists the same
membership field. The [Game schema](https://api-docs.igdb.com/#game) also
contains both `collections` and `franchises` (and a deprecated singular
`collection`), confirming that they are distinct relationships.

For discovery, `/search` officially searches collections and games (as well as
characters, platforms, and themes), so it is a good initial series search.
Franchise candidates should be obtained directly from `/franchises` by name
filter. The API's [search examples](https://api-docs.igdb.com/#examples) also
show the `where name ~ "..."*` pattern already used by this repository's
`IGDBService`.

Illustrative server-side requests:

```text
# Series candidates
POST /v4/collections
fields id,name,slug,type,games;
where name ~ "final fantasy"*;
limit 10;

# A selected series/franchise
POST /v4/collections       # or /v4/franchises
fields id,name,slug,games;
where id = 123;
limit 1;

# Candidate games, preserving the source IDs in application code
POST /v4/games
fields id,name,summary,rating,first_release_date,cover.url,genres.name,platforms.name,
       game_type,version_parent;
where id = (1,2,3);
limit 500;
```

IGDB additionally has `collection_memberships` (membership types) and
`collection_relations` (parent/child collections). These should be considered
only for a later “include nested collections” option, not silently traversed:
otherwise an apparently simple selection can unexpectedly expand into a much
larger backlog. See the official [membership](https://api-docs.igdb.com/#collection-membership)
and [relation](https://api-docs.igdb.com/#collection-relation) schemas.

## Recommended product and backend design

1. Add a separate `/series/search?query=` API that returns a small discriminated
   candidate model: `kind` (`collection` or `franchise`), IGDB ID, name, and
   member count where available. This keeps the current `/games/search` contract
   stable.
2. Treat an IGDB group as a **candidate universe**, never as a claim about a
   game's narrative or mainline status. Add a separate, application-owned
   `track` concept for a curated subset, initially `numbered-mainline`. A track
   holds an ordered list of canonical IGDB game IDs and a short source/review
   note. It must be versioned in the deterministic catalog, rather than inferred
   from a name at request time. IGDB has no mainline flag.
3. Add `/series/{kind}/{id}/preview?mode=canonical` and return the existing
   `CatalogGame` shape plus `included`, `reason`, `game_type`,
   `version_parent`, `parent_game`, and `canonical_game_id` classification
   metadata. Fetch the group, hydrate its IDs in batches, then sort by the
   selected track order or first release date. `mode=numbered-mainline` is
   available only where a reviewed track exists; do not pretend that an
   uncurated franchise has one.
4. Make **canonical releases** the safe default, not “mainline”: exclude entries
   with `version_parent` (editions) and exclude the `game_type` values for DLC,
   expansions, bundles, standalone expansions, mods, episodes, seasons,
   expanded games, ports, forks, packs, and updates. Remakes and remasters are
   excluded by default but can replace their canonical original through an
   explicit “prefer modern release” option. Use `game_type`, rather than the
   legacy `category`, because IGDB documents `category` as deprecated in its
   [Game Type reference](https://api-docs.igdb.com/#game-type). A remaining
   `main_game` is still only a playable title: it can be a spin-off.
5. Require a confirmation screen. It must display the included titles, excluded
   titles/reasons, duplicates already in the backlog, and known versus unresolved
   HLTB duration before adding anything. “Final Fantasy” is especially likely to
   have overlapping franchise/collection choices.
6. On confirmation, call the existing per-game resolution/enrichment path for
   each selected game, deduplicate by `igdb_id`, and add the resolved and
   unresolved entries together. Scheduling remains blocked by the app's existing
   unresolved-game behaviour, rather than guessing playtimes.

## Live validation: why Final Fantasy has 359 franchise members

On 2026-08-11, authenticated live queries returned **359** games for the
`Final Fantasy` franchise (ID 4) and **193** games for the same-named collection
(ID 39). Hydrating every ID returned all 359 game records, so this is not a
pagination loss or a duplicate-ID response. It is broad membership: the
[Franchise](https://api-docs.igdb.com/#franchise) and
[Collection](https://api-docs.igdb.com/#collection) schemas define `games` only
as associated game IDs; neither provides a “mainline” subset.

The franchise response is also materially made up of separate release records,
not merely distinct games on several consoles. The hydrated 359 records broke
down by `game_type` as follows:

| `game_type` | Count | What it demonstrates |
| --- | ---: | --- |
| Main game | 154 | Includes numbered titles **and** spin-offs such as Chocobo, Dissidia, mobile games, and `Final Fantasy VII` side stories. |
| DLC / expansion / standalone expansion / season / pack / update | 80 | Includes XI/XIV content and XV/other downloadable content. |
| Bundle | 40 | Collections, complete editions, and multi-game packs. |
| Remake / remaster / expanded game / port | 85 | Separate records for rereleases, including platform-specific ports. |

There were 46 version/edition records with `version_parent`, 165 records with
`parent_game`, and repeated display names (for example, eight records named
`Final Fantasy VII` and eight named `Final Fantasy II`). A `release_dates`
record describes an individual game's platform release; it does not merge the
separate port/remaster records. See the [Game](https://api-docs.igdb.com/#game),
[Game Type](https://api-docs.igdb.com/#game-type), and
[Release Date](https://api-docs.igdb.com/#release-date) schemas.

This directly answers the product question: **yes, different ports, remasters,
editions, DLC, and bundles account for much of the total, but not all of it.**
Even after filtering to top-level `main_game` records, the Final Fantasy
collection had 59 titles, including obvious spin-offs. Type and relationship
metadata are strong hygiene filters, not a semantic definition of mainline.

### Final Fantasy numbered-mainline policy

For MVP, ship one deliberately narrow, editorially reviewed track:

```text
Final Fantasy numbered mainline
I, II, III, IV, V, VI, VII, VIII, IX, X, XI, XII, XIII, XIV, XV, XVI
```

This is **16 canonical entries**, one per Roman numeral, in numerical order.
It excludes direct sequels (`X-2`, `XIII-2`, `Lightning Returns`), VII remake
project titles, MMOs' expansions, and every spin-off, bundle, port, remake,
remaster, edition, DLC, and update. Those titles remain discoverable in the
canonical/all-members preview and can be selected individually. This rule
matches the plain-language request “all the numbered games”; a future product
choice can add a separate `mainline-plus-direct-sequels` track rather than
silently changing the meaning of the existing option.

Store the 16 IGDB IDs as reviewed data and resolve each independently. The live
data has ambiguous/incomplete duplicate records for several names (notably
`Final Fantasy III`, VII, and XIV), so a name regex or “earliest release” rule
would be brittle. Track maintenance should be an explicit review when a new
numbered title is announced or released; automated live tests should assert the
stored IDs still hydrate, retain the intended title/type, and contain no
duplicate canonical game.

### Tests to add before implementation

1. Deterministic unit tests for Final Fantasy's 16-ID track: exact order,
   no duplicates, and explicit exclusions for `X-2`, `XIII-2`, remake titles,
   ports, editions, DLC, and XIV expansions.
2. Preview-service tests: `version_parent` and excluded `game_type` values
   produce visible reasons; an allowed remake/remaster replacement chooses one
   record for its canonical game, never both.
3. API tests: `mode=numbered-mainline` is returned only for known curated
   tracks and an uncurated group returns a clear unsupported-mode validation
   error.
4. Extend the opt-in live IGDB test to hydrate all stored track IDs and assert
   they remain associated with the Final Fantasy franchise/collection. It must
   not assert a fixed franchise member count, which is expected to grow.

This is feasible without persistence or a new source. The local deterministic
fallback must also gain a deterministic collection/franchise fixture (or return
an explicit feature-unavailable result); otherwise this feature would work only
in credentialed deployments and would be untestable locally.

## Duration data

Continue treating HLTB as the scheduler's duration authority. IGDB has a
`game_time_to_beats` endpoint with `hastily`, `normally`, and `completely`
durations in seconds, documented in the [Game Time To Beat
reference](https://api-docs.igdb.com/#game-time-to-beat). It could be an
explicitly labelled fallback for missing HLTB matches, but should not be mixed
silently with the existing HLTB categories because the source and semantics
differ.

## Auth, rate limits, and operational implications

The current backend already follows IGDB's required Twitch client-credentials
flow and sends the required `Client-ID` and `Authorization: Bearer` headers.
The official [IGDB authentication and request documentation](https://api-docs.igdb.com/#authentication)
and [Twitch client-credentials documentation](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#client-credentials-grant-flow)
require the client secret to remain server-side. IGDB does not permit browser
calls because of CORS, so all new calls must stay in FastAPI.

IGDB allows **4 requests/second** and **8 concurrent open requests**; excess
traffic receives HTTP 429. Its official [rate-limit documentation](https://api-docs.igdb.com/#rate-limits)
also documents a maximum `limit` of 500 and [`/multiquery`](https://api-docs.igdb.com/#multiquery)
for up to 10 subqueries per request. A series expansion should therefore batch
game IDs, cap backend concurrency, cache group previews, and rate-limit HLTB
enrichment instead of launching one unbounded request per title.

## Other API options

| Provider | What its official API offers | Fit and trade-off |
| --- | --- | --- |
| [MobyGames](https://www.mobygames.com/info/api/) | `groups` and games filtered by group; examples include named game series. API key required; its documented non-commercial limit is 720 requests/hour and 1 request/second. | Useful optional cross-check when IGDB has bad coverage, but groups are broader editorial themes (adaptations/remakes included), not a clean series contract. Do not add as the default source. |
| [RAWG](https://rawg.io/apidocs) | Related-game “game series” data from a known game, plus DLC/franchise-related data. | Not a first-class searchable series catalog in its official API surface; it would require seeding from a game and adds key, attribution/licensing, and reconciliation work. Inferior to IGDB for the initial feature. |
| [TheGamesDB](https://api.thegamesdb.net/) | Game, platform, genre, developer, and publisher lookup. | No documented franchise/series aggregate resource; not suitable for this feature. |
| [Giant Bomb](https://www.giantbomb.com/api/) | Historically exposed franchises. | Its official page says the API is unavailable during its infrastructure rebuild, so it cannot be a dependency. |
| [Steam Web API](https://partner.steamgames.com/doc/webapi_overview?language=english) | Store/partner-oriented Web API methods. | No documented cross-platform franchise aggregation resource; unsuitable as the catalog authority. |

## Decision

Proceed with an **IGDB group-first MVP**: collections and franchises are broad
searchable scopes, and every “add all” action must use a visible preview.
Separately ship the reviewed **Final Fantasy numbered-mainline** track as the
first curated preset. Do not label IGDB's default group membership or its
`main_game` subset “mainline.” Revisit MobyGames only if production feedback
shows material IGDB grouping gaps.
