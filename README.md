# Spache

Space cache. For NASA Near-Earth Object API. Caches, persists and aggregates
the dataset.

## Development & launching

There is no up-kept "shortcut" for "building", optimizing or anything else,
really, apart from watching changes to ts files and then in turn to the compiled
js files to restart the server after changes. To initiate, do:
```
$ npm install
$ npm run watch & npm start
$ # ... or alternatively if you have a NASA API key:
$ npm run watch & SPACHE_NASA_API_KEY=<api-key> npm start
```
which will launch the app at localhost:3000 (http).

## Notes

The NEO API "feed" API is duplicated and cached with exactly the same URL
structure. There is also an aggregation service "stub" at `/aggregations`.
Since the reader likely knows his/her way around node.js, I'll leave the exact
URLs to be found from within the code in `server.ts` and `/routers`.

The solution is far from complete in any way. Some problems / ideas:
- The cache invalidation is way too aggressive if some data is entirely missing
- The cache invalidation does not care about the freshness data
- Future data is cached just as much as historic
- The aggregation service opens doors for querying much enough data at once to
  dry-up the NEO API quota at once with no fallbacks/warnings/errors.
- Aggregation is done entirely in JS when it could and really should be done
  in SQL. Even with SQLite.

What actually (hopefully) works:
- Basic persistent caching regardless of TZ and DST issues
- Aggregation of monthly largest NEOs for a reasonable interval, i.e. ~year.
