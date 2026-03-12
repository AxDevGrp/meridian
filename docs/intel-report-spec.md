# Meridian Daily Intelligence Report — Full Implementation Spec

**Version:** 1.0  
**Date:** 2026-03-11  
**Status:** Draft  

---

## Overview

The Meridian Daily Intelligence Report is a fully automated, multi-source intelligence briefing delivered to customers on a scheduled cadence. It uses parallel LLM sub-agents with live web search to research 4 domains simultaneously, then synthesizes results into a structured report with two delivery tiers: a full deep-dive and a punchy executive summary.

**Total runtime:** ~7–10 minutes end-to-end  
**Cadence:** 2x daily (6 AM + 6 PM ET) or configurable per customer  
**Output:** Markdown report (stored) + summary (delivered)

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   CRON SCHEDULER                     │
│         Triggers at 06:00 and 18:00 ET daily        │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│              ORCHESTRATOR AGENT                      │
│   (Kimi K2.5 or Claude Sonnet 4.6)                  │
│   - Spawns 4 parallel research agents               │
│   - Collects results                                 │
│   - Synthesizes final report                         │
│   - Routes delivery                                  │
└──────┬──────────┬──────────┬──────────┬─────────────┘
       │          │          │          │
       ▼          ▼          ▼          ▼
  [POLITICS]  [TECH/AI]  [FINANCE]  [HAPPY NEWS]
  sub-agent   sub-agent  sub-agent   sub-agent
  (parallel)  (parallel) (parallel)  (parallel)
       │          │          │          │
       └──────────┴──────────┴──────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│              SYNTHESIS + FORMATTING                  │
│   - Combine 4 research outputs                      │
│   - Generate Executive Summary                      │
│   - Extract Key Themes                              │
│   - Format full report                              │
└─────────────┬───────────────────────────────────────┘
              │
    ┌─────────┴──────────┐
    ▼                    ▼
[FULL REPORT]      [SUMMARY]
Save to DB /       Email / Discord /
File storage       Slack / SMS
```

---

## Tech Stack Options

| Layer | Recommended | Alternative |
|---|---|---|
| Orchestration | OpenClaw cron + sessions_spawn | LangGraph, Temporal, custom Python |
| LLM (synthesis) | moonshot/kimi-k2.5 | anthropic/claude-sonnet-4-6 |
| LLM (research) | google/gemini-3.1-flash-lite | moonshot/kimi-k2.5 |
| Web Search | Perplexity Sonar Pro API | Brave Search API, Bing API |
| Storage | PostgreSQL + S3 | Supabase, MongoDB |
| Delivery | SendGrid (email), Discord API | Resend, Mailgun, Twilio |
| Scheduler | Node cron / OpenClaw cron | AWS EventBridge, GitHub Actions |

---

## Step 1: Cron Schedule

### OpenClaw Config (current implementation)
```json
{
  "schedule": {
    "kind": "cron",
    "expr": "0 6,18 * * *",
    "tz": "America/New_York"
  },
  "payload": {
    "kind": "agentTurn",
    "message": "Run the daily intel report. Today's date is {{DATE}}. Spawn 4 parallel research sub-agents (intel-politics, intel-tech, intel-finance, intel-happy), collect results, synthesize into the standard report format, save to vault, and post summary to Discord channel 1478841836352049243.",
    "timeoutSeconds": 600
  },
  "sessionTarget": "isolated",
  "delivery": {
    "mode": "announce"
  }
}
```

### Node.js Cron (for standalone Meridian service)
```javascript
import cron from 'node-cron';
import { runIntelReport } from './intel-report.js';

// Run at 6 AM and 6 PM ET daily
cron.schedule('0 6,18 * * *', async () => {
  const date = new Date().toISOString().split('T')[0];
  const time = new Date().getHours() < 12 ? '06:00' : '18:00';
  
  console.log(`[Meridian] Starting intel report for ${date} ${time} ET`);
  await runIntelReport({ date, time });
}, {
  timezone: 'America/New_York'
});
```

---

## Step 2: Research Sub-Agents

Each sub-agent runs in parallel. They are isolated LLM calls with web search access. Below are the exact prompts used in production.

### Sub-Agent: intel-politics

```
You are an elite geopolitical intelligence analyst. Today is [DATE].

Your job: Search the web for the most important world politics and geopolitics stories from the past 24 hours. Be comprehensive, specific, and cite sources.

REQUIRED COVERAGE AREAS (search each explicitly):
1. US-Iran/Middle East conflict — current status, strikes, casualties, diplomacy, Strait of Hormuz
2. Ukraine-Russia war — battlefield updates, peace talks, military moves
3. China — diplomacy, Taiwan, Two Sessions (if active), trade
4. NATO/Europe — military posture, alliance politics
5. Other major conflicts or political crises

FOR EACH STORY INCLUDE:
- Headline (clear, specific)
- Key facts with numbers (casualties, distances, dollar amounts, dates)
- Direct quotes from key figures (attributed)
- Source URL
- Why it matters (1-2 sentences)

ALSO INCLUDE:
- Notable Opinions section (positive and negative perspectives from key figures)
- Patterns & Trends section (3-5 cross-cutting themes you observe)
- Gaps section (what important angles are NOT being covered)

FORMAT: Structured markdown with headers per story. Use bullet points for facts.
ACCURACY: Only report what is confirmed. Flag rumors/unconfirmed clearly.
DEPTH: Go beyond headlines. Find the second and third-order implications.
```

### Sub-Agent: intel-tech

```
You are an elite technology and AI intelligence analyst. Today is [DATE].

Your job: Search the web for the most important AI, technology, and cybersecurity stories from the past 24 hours. Be comprehensive, specific, and cite sources.

REQUIRED COVERAGE AREAS (search each explicitly):
1. AI model releases — new models, benchmarks, pricing, key capabilities
2. Major tech company moves — partnerships, acquisitions, product launches, leadership changes
3. AI funding rounds — $20M+ raises, valuations, investors
4. Cybersecurity — active exploits (with CVE numbers), major breaches, government advisories
5. Semiconductor/chips — supply chain, new products, geopolitical angles
6. Developer tools & open source — notable releases, GitHub trending

FOR EACH STORY INCLUDE:
- Headline
- Key technical facts (benchmark scores, parameter counts, prices, CVE IDs, dollar amounts)
- Source URL
- Why it matters for builders/investors

ALSO INCLUDE:
- Notable Opinions (positive/negative from industry figures)
- Patterns & Trends (3-5 themes)
- Gaps (underreported angles)

FORMAT: Structured markdown. Use bullet points.
SPECIFICITY: Include exact version numbers, model names, benchmark scores. No vague claims.
```

### Sub-Agent: intel-finance

```
You are an elite financial intelligence analyst. Today is [DATE].

Your job: Search the web for the most important market data and financial news from the past 24 hours. Include specific numbers — no vague summaries.

REQUIRED COVERAGE AREAS (search each explicitly):
1. US equity indexes — S&P 500, Dow Jones, Nasdaq (closing price + % change + notable movers)
2. Cryptocurrency — BTC, ETH, SOL (price, 24h % change, market cap, notable flows/events)
3. Commodities — Brent crude, WTI crude, gold, silver (price + % change)
4. Federal Reserve / Central banks — rate expectations, Fed speak, upcoming decisions
5. Economic data releases — CPI, PCE, jobs data, GDP, any macro prints
6. Earnings — notable reports (beats/misses) and upcoming this week
7. Geopolitical market impact — how world events are moving specific assets

FOR EACH AREA INCLUDE:
- Exact prices and percentage changes
- Key analyst commentary (attributed, with source)
- Source URL
- Trading implications (what does this mean for the next 24-48 hours)

ALSO INCLUDE:
- Stagflation/recession risk assessment (current signals)
- Fed rate cut probability (CME FedWatch data if available)
- Notable Opinions section
- Patterns & Trends section

FORMAT: Structured markdown. Lead every section with the key number.
PRECISION: Include timestamps on prices where available. Flag pre-market vs. closing data.
```

### Sub-Agent: intel-happy

```
You are a researcher specializing in positive developments in science, medicine, environment, space, and human achievement. Today is [DATE].

Your job: Search the web for genuinely significant good news from the past 48-72 hours. Not fluff — real breakthroughs, conservation wins, medical advances, and inspiring human stories.

REQUIRED COVERAGE AREAS (search each explicitly):
1. Scientific/medical breakthroughs — new treatments, discoveries, clinical trial results
2. Environmental wins — conservation successes, clean energy milestones, species recovery
3. Space exploration — launches, discoveries, milestones
4. Humanitarian/community — meaningful acts, policy wins, health elimination campaigns

FOR EACH STORY INCLUDE:
- Headline
- Why it actually matters (scientific or human significance)
- Key facts/numbers
- Source URL

ALSO INCLUDE:
- Notable Opinions section
- Patterns & Trends (what themes are emerging across positive news)
- Gaps (positive angles that exist but aren't being covered)

FORMAT: Structured markdown. Lead with the most significant story.
QUALITY FILTER: Only include stories with genuine impact. Skip trivial feel-good pieces.
SPECIFICITY: Include researcher names, institutions, journal names where relevant.
```

---

## Step 3: Orchestrator Synthesis Prompt

After all 4 sub-agents return, the orchestrator receives their combined output and runs this synthesis prompt:

```
You are the chief intelligence analyst for Meridian. Today is [DATE] at [TIME] ET.

You have received research from 4 specialist analysts:
1. POLITICS: [insert intel-politics output]
2. TECH/AI: [insert intel-tech output]  
3. FINANCE: [insert intel-finance output]
4. HAPPY NEWS: [insert intel-happy output]

Your job: Synthesize these into a single, polished Daily Intelligence Report.

OUTPUT FORMAT (follow exactly):

---
## 🌍 Daily Intelligence Report — [Day], [Date] ([Time] EST)

### Executive Summary
[6 bullet points — the 6 most important stories across ALL categories]
[Each bullet: emoji + bold category label + specific headline + 1-2 key facts]
[Example: - **🔴 Iran War Day 12** — US strikes hit oil infrastructure for first time; Brent crude hit $119 intraday]

### Geopolitics & War
[Top 4-6 stories with key facts, numbers, quotes. Subsections per region/conflict as needed]

### Markets
[Lead with the key numbers. Cover equities, crypto, commodities, macro. Include specific prices]

### AI & Tech
[Model releases first, then funding, then big tech moves, then cybersecurity]

### Energy
[Oil, gas, renewables — connect to geopolitical context where relevant]

### Macro Economy
[Fed, inflation, jobs, GDP. Connect to market section]

### Bright Spots 🌱
[Science, environment, space, community — lead with most significant]

### Key Themes
[5 cross-cutting themes that connect stories across categories]
[Format: **Theme Name** — 2-3 sentence explanation of the pattern and why it matters]
---

SYNTHESIS RULES:
- Eliminate duplicate stories across sub-agent outputs
- Prioritize stories with the most global significance and reader impact
- Maintain specific numbers — never round or vague-ify
- Keep source attribution for key claims
- Executive Summary must be standalone readable (someone who reads ONLY this gets the essential picture)
- Key Themes must be analytical — connect dots across categories, not just repeat headlines
- Total length: 2,000-4,000 words for full report
- Tone: authoritative, direct, no corporate-speak
```

---

## Step 4: API Calls (Code)

### Python Implementation

```python
import asyncio
import anthropic
from datetime import datetime
from perplexity import PerplexityClient
import pytz

# Initialize clients
claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
perplexity = PerplexityClient(api_key=PERPLEXITY_API_KEY)

# Get current date/time in ET
et = pytz.timezone('America/New_York')
now = datetime.now(et)
date_str = now.strftime('%A, %B %d, %Y')
time_str = now.strftime('%I:%M %p')


async def run_research_agent(domain: str, prompt: str) -> dict:
    """Run a single research sub-agent with web search"""
    
    # Use Perplexity for web search + synthesis
    response = perplexity.chat.completions.create(
        model="sonar-pro",  # or sonar for cheaper
        messages=[
            {
                "role": "system",
                "content": f"You are an elite {domain} analyst. Today is {date_str}. {prompt}"
            },
            {
                "role": "user", 
                "content": f"Search the web and compile your {domain} intelligence report for {date_str}."
            }
        ],
        max_tokens=4000,
        search_recency_filter="day"  # Only last 24 hours
    )
    
    return {
        "domain": domain,
        "content": response.choices[0].message.content,
        "citations": response.citations if hasattr(response, 'citations') else []
    }


async def run_all_research_agents() -> list:
    """Run all 4 research agents in parallel"""
    
    prompts = {
        "intel-politics": POLITICS_PROMPT,
        "intel-tech": TECH_PROMPT,
        "intel-finance": FINANCE_PROMPT,
        "intel-happy": HAPPY_PROMPT
    }
    
    tasks = [
        run_research_agent(domain, prompt) 
        for domain, prompt in prompts.items()
    ]
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Filter out failures
    successful = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            domain = list(prompts.keys())[i]
            print(f"[Meridian] WARNING: {domain} agent failed: {result}")
        else:
            successful.append(result)
    
    return successful


def synthesize_report(research_results: list) -> str:
    """Synthesize all research into final report"""
    
    # Build context from all sub-agent results
    combined_research = ""
    for result in research_results:
        combined_research += f"\n\n=== {result['domain'].upper()} ===\n"
        combined_research += result['content']
    
    # Run synthesis with Claude
    response = claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=6000,
        messages=[
            {
                "role": "user",
                "content": SYNTHESIS_PROMPT.format(
                    date=date_str,
                    time=time_str,
                    research=combined_research
                )
            }
        ]
    )
    
    return response.content[0].text


def extract_summary(full_report: str) -> str:
    """Extract just the Executive Summary + Key Themes for delivery"""
    
    lines = full_report.split('\n')
    
    in_summary = False
    in_themes = False
    summary_lines = []
    themes_lines = []
    
    for line in lines:
        if '### Executive Summary' in line:
            in_summary = True
            summary_lines.append(line)
            continue
        if '### Geopolitics' in line or '### Markets' in line:
            in_summary = False
        if in_summary:
            summary_lines.append(line)
            
        if '### Key Themes' in line:
            in_themes = True
            themes_lines.append(line)
            continue
        if in_themes and line.startswith('##') and '### Key Themes' not in line:
            in_themes = False
        if in_themes:
            themes_lines.append(line)
    
    header = f"## 🌍 Daily Intelligence Report — {date_str} ({time_str} ET)\n\n"
    return header + '\n'.join(summary_lines) + '\n\n' + '\n'.join(themes_lines)


async def run_intel_report(customer_config: dict = None):
    """Main entry point — run the full intel report pipeline"""
    
    print(f"[Meridian] Starting research phase — {date_str} {time_str} ET")
    
    # Phase 1: Parallel research
    research_results = await run_all_research_agents()
    print(f"[Meridian] Research complete — {len(research_results)}/4 agents succeeded")
    
    # Phase 2: Synthesis
    full_report = synthesize_report(research_results)
    print(f"[Meridian] Synthesis complete — {len(full_report)} chars")
    
    # Phase 3: Extract summary
    summary = extract_summary(full_report)
    
    # Phase 4: Store full report
    await store_report(full_report, date_str, time_str)
    
    # Phase 5: Deliver
    await deliver_report(summary, full_report, customer_config)
    
    print(f"[Meridian] Report complete and delivered ✅")
    return full_report
```

---

## Step 5: Storage Schema

```sql
-- PostgreSQL schema

CREATE TABLE intel_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE NOT NULL,
    report_time TIME NOT NULL,
    edition VARCHAR(10) DEFAULT 'AM', -- AM or PM
    full_report TEXT NOT NULL,
    summary TEXT NOT NULL,
    word_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Research sub-agent outputs (for debugging/reprocessing)
    research_politics TEXT,
    research_tech TEXT,
    research_finance TEXT,
    research_happy TEXT,
    
    UNIQUE(report_date, edition)
);

CREATE TABLE customer_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES intel_reports(id),
    customer_id UUID NOT NULL,
    channel VARCHAR(50) NOT NULL, -- email, discord, slack, sms
    destination VARCHAR(255) NOT NULL, -- email address, channel ID, phone number
    delivered_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending', -- pending, delivered, failed
    error TEXT
);

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    email VARCHAR(255),
    discord_user_id VARCHAR(100),
    slack_channel_id VARCHAR(100),
    phone VARCHAR(20),
    tier VARCHAR(20) DEFAULT 'standard', -- standard, pro, enterprise
    preferences JSONB DEFAULT '{}',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Step 6: Delivery Logic

### Email (SendGrid)

```python
import sendgrid
from sendgrid.helpers.mail import Mail, Content
import markdown2

async def deliver_email(summary: str, full_report: str, customer: dict):
    sg = sendgrid.SendGridAPIClient(api_key=SENDGRID_API_KEY)
    
    # Convert markdown to HTML
    summary_html = markdown2.markdown(summary, extras=['fenced-code-blocks', 'tables'])
    full_html = markdown2.markdown(full_report, extras=['fenced-code-blocks', 'tables'])
    
    # Email with summary + link to full report
    message = Mail(
        from_email='intel@meridian.ai',
        to_emails=customer['email'],
        subject=f"🌍 Meridian Intel — {date_str}",
        html_content=f"""
        <html>
        <body style="font-family: sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #1a1a2e;">🌍 Meridian Daily Intelligence</h1>
            <p style="color: #666;">{date_str} · {time_str} ET</p>
            <hr>
            {summary_html}
            <hr>
            <details>
                <summary style="cursor: pointer; font-weight: bold;">📄 View Full Report</summary>
                {full_html}
            </details>
            <hr>
            <p style="color: #999; font-size: 12px;">
                Meridian Intelligence · 
                <a href="{{unsubscribe_url}}">Unsubscribe</a>
            </p>
        </body>
        </html>
        """
    )
    
    response = sg.send(message)
    return response.status_code == 202
```

### Discord

```python
import discord
import aiohttp

async def deliver_discord(summary: str, customer: dict):
    """Post summary to customer's Discord channel"""
    
    channel_id = customer['discord_channel_id']
    
    # Discord has 2000 char limit per message
    # Split into chunks if needed
    chunks = split_for_discord(summary, max_chars=1900)
    
    async with aiohttp.ClientSession() as session:
        for chunk in chunks:
            payload = {"content": chunk}
            async with session.post(
                f"https://discord.com/api/v10/channels/{channel_id}/messages",
                json=payload,
                headers={"Authorization": f"Bot {DISCORD_BOT_TOKEN}"}
            ) as resp:
                if resp.status != 200:
                    raise Exception(f"Discord delivery failed: {resp.status}")
                await asyncio.sleep(0.5)  # Rate limit buffer


def split_for_discord(text: str, max_chars: int = 1900) -> list[str]:
    """Split markdown text at natural breakpoints for Discord"""
    chunks = []
    current = ""
    
    for line in text.split('\n'):
        if len(current) + len(line) + 1 > max_chars:
            if current:
                chunks.append(current.strip())
            current = line + '\n'
        else:
            current += line + '\n'
    
    if current.strip():
        chunks.append(current.strip())
    
    return chunks
```

### Slack

```python
from slack_sdk.web.async_client import AsyncWebClient

async def deliver_slack(summary: str, customer: dict):
    client = AsyncWebClient(token=SLACK_BOT_TOKEN)
    
    # Use blocks for rich formatting
    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"🌍 Meridian Daily Intel — {date_str}"
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": summary[:2900]  # Slack block limit
            }
        }
    ]
    
    await client.chat_postMessage(
        channel=customer['slack_channel_id'],
        blocks=blocks,
        text=f"Meridian Intel — {date_str}"  # Fallback text
    )
```

---

## Step 7: Customer Delivery Orchestration

```python
async def deliver_report(summary: str, full_report: str, customer_config: dict = None):
    """Route delivery to all appropriate channels for all customers"""
    
    # Get all active customers (or specific customer if provided)
    customers = await get_active_customers(customer_config)
    
    delivery_tasks = []
    
    for customer in customers:
        # Email delivery
        if customer.get('email'):
            delivery_tasks.append(
                deliver_email(summary, full_report, customer)
            )
        
        # Discord delivery
        if customer.get('discord_channel_id'):
            delivery_tasks.append(
                deliver_discord(summary, customer)
            )
        
        # Slack delivery
        if customer.get('slack_channel_id'):
            delivery_tasks.append(
                deliver_slack(summary, customer)
            )
        
        # SMS (Twilio) — summary only, truncated
        if customer.get('phone') and customer.get('tier') == 'pro':
            delivery_tasks.append(
                deliver_sms(summary[:1500], customer)
            )
    
    # Run all deliveries in parallel
    results = await asyncio.gather(*delivery_tasks, return_exceptions=True)
    
    # Log results
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            print(f"[Meridian] Delivery {i} failed: {result}")
    
    return results
```

---

## Step 8: Error Handling & Resilience

```python
import tenacity

@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, min=4, max=30),
    retry=tenacity.retry_if_exception_type(Exception)
)
async def run_research_agent_with_retry(domain: str, prompt: str) -> dict:
    """Research agent with automatic retry on failure"""
    return await run_research_agent(domain, prompt)


async def run_intel_report_safe():
    """Main runner with full error handling"""
    try:
        await run_intel_report()
    except Exception as e:
        # Alert on failure
        print(f"[Meridian] CRITICAL: Report generation failed: {e}")
        
        # Send failure notification to admin
        await notify_admin(
            subject="❌ Meridian Intel Report Failed",
            body=f"Report for {date_str} failed to generate.\n\nError: {e}"
        )
        
        # Attempt fallback with cached previous report
        await deliver_cached_report()
```

---

## Prompt Variables Reference

| Variable | Value | Example |
|---|---|---|
| `[DATE]` | Current date, long format | `Wednesday, March 11, 2026` |
| `[TIME]` | Current time ET | `6:00 AM` |
| `[EDITION]` | AM or PM | `AM` |
| `[CUSTOMER_NAME]` | Customer name for personalization | `Acme Corp` |
| `[FOCUS_SECTORS]` | Customer-specific sectors (Pro/Enterprise) | `defense, semiconductors` |

---

## Customization Options (Per Customer Tier)

### Standard
- 2x daily reports (AM + PM)
- Full standard coverage (Politics, Tech, Finance, Happy)
- Email delivery

### Pro
- 2x daily + breaking news alerts
- Customer-specific sector emphasis (pass focus areas to sub-agents)
- Email + Discord/Slack + SMS
- Access to full report archive

### Enterprise
- Custom cadence (hourly if needed)
- Custom research domains (e.g., add "intel-defense" or "intel-energy" sub-agents)
- Dedicated Discord server / Slack workspace
- API access to raw JSON output
- White-label option

---

## Cost Estimate (Per Report)

| Component | Model | Tokens | Cost |
|---|---|---|---|
| 4x Research agents | Perplexity Sonar Pro | ~4K out each | ~$0.08 total |
| Synthesis | Claude Sonnet 4.6 | ~12K in, ~4K out | ~$0.10 |
| **Total per report** | | | **~$0.18** |
| **Per customer per month** (2x/day) | | | **~$11** |

> At $99/month customer price → ~91% gross margin per customer on LLM costs alone.

---

## Deployment Checklist

- [ ] Perplexity API key configured
- [ ] Anthropic API key configured
- [ ] SendGrid domain verified + API key set
- [ ] Discord bot created with message permissions
- [ ] Slack app installed with chat:write scope
- [ ] PostgreSQL database created + migrations run
- [ ] Cron schedule verified in ET timezone
- [ ] Test run executed for all 4 sub-agents
- [ ] Synthesis output reviewed for quality
- [ ] Email template tested across Gmail/Outlook
- [ ] Error alerting configured
- [ ] Rate limit handling verified (Perplexity: 20 req/min)
- [ ] Report archive accessible via customer portal

---

## Sample Perplexity API Call

```python
import requests

response = requests.post(
    "https://api.perplexity.ai/chat/completions",
    headers={
        "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
        "Content-Type": "application/json"
    },
    json={
        "model": "sonar-pro",  # Best for research
        "messages": [
            {
                "role": "system",
                "content": "You are an elite geopolitical intelligence analyst."
            },
            {
                "role": "user",
                "content": POLITICS_PROMPT
            }
        ],
        "max_tokens": 4000,
        "search_recency_filter": "day",  # Only last 24 hours
        "return_citations": True,
        "return_related_questions": False
    }
)

data = response.json()
content = data['choices'][0]['message']['content']
citations = data.get('citations', [])
```

---

## File Structure for Meridian Service

```
meridian/
├── src/
│   ├── agents/
│   │   ├── orchestrator.py      # Main report runner
│   │   ├── politics.py          # Politics sub-agent + prompt
│   │   ├── tech.py              # Tech sub-agent + prompt
│   │   ├── finance.py           # Finance sub-agent + prompt
│   │   └── happy.py             # Happy news sub-agent + prompt
│   ├── delivery/
│   │   ├── email.py             # SendGrid email delivery
│   │   ├── discord.py           # Discord delivery
│   │   ├── slack.py             # Slack delivery
│   │   └── sms.py               # Twilio SMS delivery
│   ├── storage/
│   │   ├── db.py                # PostgreSQL client
│   │   └── archive.py           # Report archive management
│   ├── synthesis/
│   │   ├── synthesizer.py       # Claude synthesis call
│   │   └── formatter.py         # Extract summary, format output
│   └── main.py                  # Entry point + cron scheduler
├── prompts/
│   ├── politics.txt             # Full politics prompt
│   ├── tech.txt                 # Full tech prompt
│   ├── finance.txt              # Full finance prompt
│   ├── happy.txt                # Full happy news prompt
│   └── synthesis.txt            # Full synthesis prompt
├── migrations/
│   └── 001_initial.sql          # DB schema
├── tests/
│   ├── test_agents.py
│   ├── test_synthesis.py
│   └── test_delivery.py
├── .env.example
├── requirements.txt
└── README.md
```

---

*Meridian Intelligence — Implementation Spec v1.0*  
*Generated: 2026-03-11 | Author: Gobi (OpenClaw)*
