# RSA Performance Metrics — Operational Reporting & Trend Analysis

A browser-based reporting prototype connecting team-level performance summaries with associate-level analysis. Date-range filtering, category averages, checklist completion, and individual trend views support exploration of service-rating records. The repository is a demonstration and contains no confidential company records.


## Engineering focus

The application maps a defined JSON data contract into multiple analytical views: team tables, weekly and monthly summaries, and individual breakdowns. HTML, CSS, JavaScript, and Chart.js connect record retrieval with filtering, reporting, and time-oriented visualization. A compatible backend is required and is outside this repository.

[Read the portfolio case study](https://teme251.github.io/teme251/project-rsa.html)

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
