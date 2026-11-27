# MyDay Football API

Private server-side proxy for StrikerAPI. The API key is never included in the app's frontend code.

## Required secret

Set a Worker secret named `STRIKER_API_KEY` in Cloudflare. Never commit the key to GitHub.

## Routes

- `GET /health` — service/configuration status
- `POST /api/list_teams`
- `POST /api/list_games`
- `POST /api/get_schedule`
- `POST /api/get_standings`
- `POST /api/get_ratings`
- `POST /api/get_head_to_head`
- `POST /api/get_squad`
- `POST /api/get_game`
- `POST /api/get_lineups`
- `POST /api/get_availability`
- `POST /api/get_player`
- `POST /api/get_player_games`
- `POST /api/get_leaders`
- `POST /api/get_team_stats`

The proxy is intentionally allow-listed and does not expose betting/odds endpoints or arbitrary upstream URLs.

## Deploy

From this directory, deploy with Wrangler after adding the secret:

```sh
npx wrangler secret put STRIKER_API_KEY
npx wrangler deploy
```
