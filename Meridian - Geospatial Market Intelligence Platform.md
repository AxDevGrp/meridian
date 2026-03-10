---
date: 2026-03-07
type: idea
tags: [idea, trading, geospatial, OSINT, startup, saas]
---

# Meridian — Geospatial Market Intelligence Platform

## Executive Summary

**The Opportunity**

Bloomberg built a $7B/year business selling one dimension of market data. Jane's built a business selling one dimension of geopolitical intelligence. Neither connects the dots between *what's happening in the world* and *what it means for your portfolio* — in real time, spatially, visually.

That gap is the product.

**The Concept**

A geospatial market intelligence platform that fuses open-source signals from across the physical and political world — war zones, shipping lanes, satellite passes, sanctions, social unrest, resource flows, tech disruptions, weather events — and surfaces them as actionable trading and investment signals on a live 3D globe.

Not a news feed. Not a chart. A *spatial command center for capital allocation.*

**What It Ingests**
- 🛢️ **Resources** — maritime AIS (tankers, LNG carriers), pipeline status, commodity chokepoints (Hormuz, Suez, Panama)
- ✈️ **Airspace** — ADS-B flight disruptions, no-fly zones, military activity inference
- 🛰️ **Satellites** — commercial SAR/optical imagery (Capella, Planet), orbital coverage of hotspots
- ⚔️ **Conflict** — ACLED conflict events, OSINT social feeds, GPS jamming zones (EW activity)
- 🗳️ **Politics** — election calendars, sanctions databases, leadership changes, treaty events
- 📡 **Tech & Social** — patent filings, regulatory shifts, social trend velocity, protests/strikes
- 📊 **Markets** — futures, equities, FX, crypto — as the *output layer*, not the input

**What It Outputs**
- Signal alerts: "GPS jamming intensifying over Strait of Hormuz → WTI crude watch"
- Opportunity maps: color-coded globe showing where macro stress is building → linked to correlated instruments
- Historical replay: scrub back any event and see what the signals looked like *before* the market moved
- AI-generated briefs: "Here's what changed in the last 6 hours and what it means for your book"

**Who Pays**
- Macro hedge funds & prop traders (primary — highest willingness to pay, $5K–$50K/mo)
- Family offices & RIAs managing global portfolios
- Commodity trading firms (energy, agriculture, metals)
- Corporate risk/treasury teams (supply chain exposure)
- Serious retail — the "Bloomberg for independent traders" tier ($99–$299/mo)

**Why Now**
- OSINT data democratized — ADS-B, AIS, TLE orbital data, ACLED, social feeds are all free/cheap
- AI agents can normalize, correlate, and narrate multi-dimensional data that was previously too noisy
- 3D globe visualization (CesiumJS + Google 3D Tiles) is now a free API call
- One person can build a working prototype over a weekend (proven by WorldView)
- No one has connected these dots into a *trader-facing* product

**The Moat**
Not the data — that's public. The moat is the *correlation layer*: the trained models and curated signal mappings that reliably connect geophysical events to market moves. That gets more valuable with every event, every backtest, every user interaction.

---

## Name Options

**Top Pick:** **Meridian** — clean, premium, evokes global reach and connecting distant points. Doesn't scream "military" or "finance" alone — implies both.

**Runner-up:** **Orbis** — one word, global, timeless, Latin for "world."

Other candidates: Stratum, Vantage, SIGINT, Watchtower, Recon, GeoEdge, Terravex

---

## Inspiration

- [WorldView by Bilawal Sidhu](https://www.spatialintelligence.ai/p/i-built-a-spy-satellite-simulator) — 3D globe fusing ADS-B, TLE satellites, CCTV, shaders. Built solo over a weekend.
- [The Intelligence Monopoly Is Over](https://www.spatialintelligence.ai/p/the-intelligence-monopoly-is-over) — OSINT reconstruction of Operation Epic Fury using public data only.

**Tech stack reference (WorldView):**
- Google Photorealistic 3D Tiles API
- CesiumJS (3D globe rendering)
- OpenSky Network + ADS-B Exchange (aircraft)
- CelesTrak TLE (satellite orbits)
- OpenStreetMap + particle rendering (streets)
- GLSL shaders (FLIR, NVG, CRT, cel-shade)
- AI agents (Claude, Codex, Gemini) for build acceleration
