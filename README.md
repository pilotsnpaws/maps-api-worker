# Overview

This is a Cloudflare Worker that provides a REST API for interacting with a MySQL database.
This supports PNP trip and volunteer mapping pages, which are being rebuilt. 

## Endpoints

### GET /trips

Returns a list of trips from the database.

#### Parameters

- `last_post_before`: Returns trips with a last post date before the specified date.
- `last_post_after`: Returns trips with a last post date after the specified date.
- `updated_last_days`: Returns trips with a last post date within the specified number of days.
