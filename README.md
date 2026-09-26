# Frontline performance reporting prototype

A personal browser prototype for reviewing service rating data by associate and date range. It shows team summaries, category averages, checklist completion, and an individual trend view. This repository is intended as a demonstration and contains no confidential company records.

## What is in the repository

- `index.html` and `results.js`: team tables, search, date filters, and weekly/monthly summaries.
- `detail.html` and `detail.js`: an individual breakdown and a Chart.js trend.
- `styles.css`: responsive presentation.

## Data contract

The front end requests JSON from `window.BACKEND_URL` and expects a `data` array. Entries include `name`, `timestamp`, `overall`, `scores`, `checklist`, `customersServed`, and optional `notes`. The backend is **not included** in this repository, so the pages need a compatible endpoint to display records.

## Run locally

Serve the folder with `python -m http.server 8000`, then open `http://localhost:8000`. Replace the `window.BACKEND_URL` setting in the HTML files with an endpoint you control. For a standalone sample-data demo, see [rsa-monitor](https://github.com/teme251/rsa-monitor).

## Scope

This is a front-end prototype, not a production HR or employee assessment system. It does not include authentication, backend source, or a trained AI model.
