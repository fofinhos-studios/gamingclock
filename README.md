# Gaming Clock

Made with love by 🧡💜 fofinhos.studios

Turn your game backlog into a plan you can actually play. Gaming Clock helps you see how much time your list will take and fit it around your real week.

## What you can do

- Search for games and build a personal backlog.
- See estimated playtime for every game and your whole list.
- Tell Gaming Clock which days you play and how much time you have.
- Create a schedule that plays games one at a time or rotates between them.
- Download your plan as an iCalendar file to add it to your calendar.

## Data credits

Game information is provided by [IGDB](https://www.igdb.com/). Playtime estimates are sourced from [HowLongToBeat](https://howlongtobeat.com/). Game logos and hero banners are provided by [SteamGridDB](https://www.steamgriddb.com/).

## Optional artwork configuration

Set `STEAMGRIDDB_API_KEY` in your local `.env` file or deployment environment to retrieve a selected game's logo and hero banner. Without it, the app continues normally and returns empty artwork URLs.

## Vercel cache warming

Production deployments schedule a daily Vercel Cron Job for 04:00 UTC. It blends current IGDB visits, high-engagement games released in the past 12 months, and Steam's all-time review leaders before warming their shared HowLongToBeat matches in Upstash Redis. This makes frequently selected games less likely to need an upstream HLTB request.

Set `CRON_SECRET` to a random value of at least 16 characters in Vercel. Vercel sends it automatically to the protected cron route. Optionally set `WARM_CACHE_GAME_LIMIT` to warm between 1 and 50 games; the default is 20. The job needs both IGDB credentials and the Upstash Redis environment variables to warm the production cache.
