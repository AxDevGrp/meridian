/**
 * Scenario Playbook Engine.
 * Defines 18 geopolitical scenario playbooks and evaluates live data
 * against trigger conditions to produce market impact signals.
 */

import type { AnomalyDataSnapshot } from "@/lib/analytics/anomaly-engine";
import type {
    Anomaly,
    RiskScore,
    Pattern,
    AnomalyKind,
    PatternKind,
} from "@/lib/types/analytics";
import type {
    ScenarioPlaybook,
    TriggerCondition,
    MarketSignal,
    CausalChainStep,
    CausalChainStepStatus,
    PlaybookCategory,
    SignalSeverity,
} from "@/lib/types/signal";
import { confidenceToSeverity } from "@/lib/types/signal";
import { MONITORED_REGIONS } from "@/lib/analytics/regions";
import { haversineKm } from "@/lib/correlation-engine";

// ============================================
// Seeded PRNG (Mulberry32) — for sample data fallback
// ============================================

function mulberry32(seed: number): () => number {
    let state = seed | 0;
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function seededUUID(rng: () => number): string {
    const hex = (n: number) => Math.floor(n * 16).toString(16);
    let uuid = "";
    for (let i = 0; i < 32; i++) {
        if (i === 8 || i === 12 || i === 16 || i === 20) uuid += "-";
        if (i === 12) {
            uuid += "4";
        } else if (i === 16) {
            uuid += (8 + Math.floor(rng() * 4)).toString(16);
        } else {
            uuid += hex(rng());
        }
    }
    return uuid;
}

// Fixed base time for deterministic output (2026-03-12T00:00:00Z)
const BASE_TIME = new Date("2026-03-12T00:00:00Z").getTime();

// ============================================
// 18 Scenario Playbooks
// ============================================

const PLAYBOOKS: ScenarioPlaybook[] = [
    // ── Energy (4 playbooks) ──────────────────────────

    {
        id: "hormuz-shipping-disruption",
        name: "Hormuz Shipping Disruption",
        description: "Vessel deviations and conflict activity in the Strait of Hormuz threaten global oil transit.",
        category: "energy",
        triggerConditions: [
            { kind: "vessel_deviation", label: "Ship deviation in Hormuz", region: "Strait of Hormuz" },
            { kind: "conflict_active", label: "Conflict events near Hormuz", region: "Strait of Hormuz", minCount: 2 },
            { kind: "sentiment_shift", label: "Negative sentiment on Middle East", threshold: -0.3, direction: "below" },
        ],
        confidenceThreshold: 0.5,
        causalChain: [
            { order: 1, event: "Ship attacked or diverted in Strait of Hormuz", consequence: "Shipping lanes narrow, insurance costs spike", icon: "ship", status: "pending" },
            { order: 2, event: "Major tanker operators re-route around Cape", consequence: "Transit time increases 7-14 days", icon: "globe", status: "pending" },
            { order: 3, event: "Spot oil prices surge on supply fear", consequence: "Energy-heavy portfolios gain, transport costs rise", icon: "chart-up", status: "pending" },
            { order: 4, event: "Regional military escalation", consequence: "Defense stocks rally, safe-haven demand increases", icon: "shield", status: "pending" },
        ],
        marketTargets: [
            { symbol: "CL=F", name: "WTI Crude Oil", expectedDirection: "up", magnitude: "large", reasoning: "Supply disruption drives spot price" },
            { symbol: "BZ=F", name: "Brent Crude", expectedDirection: "up", magnitude: "large", reasoning: "Hormuz transit bottleneck" },
            { symbol: "XLE", name: "Energy Select SPDR", expectedDirection: "up", magnitude: "moderate", reasoning: "Energy sector benefits from higher oil" },
        ],
        timeHorizon: "24-72 hours",
        historicalPrecedent: "Similar to Jan 2024 Houthi attacks on Red Sea shipping",
    },
    {
        id: "red-sea-shipping-crisis",
        name: "Red Sea Shipping Crisis",
        description: "Vessel deviations and armed conflict in the Red Sea / Gulf of Aden disrupt global trade routes.",
        category: "energy",
        triggerConditions: [
            { kind: "vessel_deviation", label: "Ship deviation in Red Sea", region: "Red Sea / Gulf of Aden" },
            { kind: "conflict_active", label: "Armed conflict in Red Sea area", region: "Red Sea / Gulf of Aden", minCount: 3 },
            { kind: "market_move", label: "Oil price spike", symbol: "CL=F", threshold: 2.0, direction: "above" },
        ],
        confidenceThreshold: 0.5,
        causalChain: [
            { order: 1, event: "Houthi-style attacks on commercial vessels", consequence: "Shipping companies divert from Suez Canal", icon: "flame", status: "pending" },
            { order: 2, event: "Container ships re-route via Cape of Good Hope", consequence: "Freight rates surge 200-400%", icon: "ship", status: "pending" },
            { order: 3, event: "Supply chain delays compound", consequence: "Retail and manufacturing stocks under pressure", icon: "globe", status: "pending" },
            { order: 4, event: "Naval coalition response", consequence: "Defense spending narrative strengthens", icon: "shield", status: "pending" },
        ],
        marketTargets: [
            { symbol: "CL=F", name: "WTI Crude Oil", expectedDirection: "up", magnitude: "moderate", reasoning: "Suez disruption adds to supply concerns" },
            { symbol: "ZIM", name: "ZIM Integrated Shipping", expectedDirection: "up", magnitude: "large", reasoning: "Shipping rates surge on diversions" },
            { symbol: "LMT", name: "Lockheed Martin", expectedDirection: "up", magnitude: "small", reasoning: "Naval defense spending narrative" },
        ],
        timeHorizon: "48-96 hours",
        historicalPrecedent: "Dec 2023-Feb 2024 Houthi Red Sea attacks",
    },
    {
        id: "black-sea-energy-squeeze",
        name: "Black Sea Energy Squeeze",
        description: "Escalating conflict and GPS jamming in the Black Sea region threatens European energy and agriculture supply.",
        category: "energy",
        triggerConditions: [
            { kind: "conflict_active", label: "Conflict escalation in Black Sea", region: "Black Sea", minCount: 3 },
            { kind: "gps_jamming_active", label: "GPS jamming in Black Sea", region: "Black Sea", minCount: 2 },
            { kind: "market_move", label: "European gas price move", symbol: "NG=F", threshold: 3.0, direction: "above" },
        ],
        confidenceThreshold: 0.5,
        causalChain: [
            { order: 1, event: "Military escalation near Ukrainian ports", consequence: "Grain corridor suspended, port access denied", icon: "flame", status: "pending" },
            { order: 2, event: "GPS jamming disrupts commercial navigation", consequence: "Shipping insurance premiums spike", icon: "radio", status: "pending" },
            { order: 3, event: "European energy supply tightens", consequence: "Natural gas prices surge, power costs rise", icon: "chart-up", status: "pending" },
        ],
        marketTargets: [
            { symbol: "NG=F", name: "Natural Gas Futures", expectedDirection: "up", magnitude: "large", reasoning: "European energy supply disruption" },
            { symbol: "WEAT", name: "Teucrium Wheat Fund", expectedDirection: "up", magnitude: "moderate", reasoning: "Black Sea grain corridor disruption" },
            { symbol: "XLE", name: "Energy Select SPDR", expectedDirection: "up", magnitude: "small", reasoning: "Broad energy sector boost" },
        ],
        timeHorizon: "24-72 hours",
        historicalPrecedent: "Feb 2022 Russia-Ukraine invasion energy shock",
    },
    {
        id: "hormuz-gps-denial",
        name: "Hormuz GPS Denial",
        description: "GPS jamming cluster and military aircraft loitering indicate electronic warfare near the Strait of Hormuz.",
        category: "energy",
        triggerConditions: [
            { kind: "gps_jamming_active", label: "GPS jamming cluster in Hormuz", region: "Strait of Hormuz", minCount: 2 },
            { kind: "anomaly_present", label: "Military aircraft loitering near Hormuz", region: "Strait of Hormuz", anomalyKind: "aircraft_loitering" },
            { kind: "risk_above", label: "Hormuz risk elevated", region: "Strait of Hormuz", threshold: 60 },
        ],
        confidenceThreshold: 0.5,
        causalChain: [
            { order: 1, event: "GPS jamming cluster detected in Strait", consequence: "Commercial vessels lose navigation accuracy", icon: "radio", status: "pending" },
            { order: 2, event: "Military aircraft on patrol patterns", consequence: "Suggests imminent military action or exercise", icon: "alert", status: "pending" },
            { order: 3, event: "Tanker operators pause transit", consequence: "Oil supply bottleneck forms", icon: "ship", status: "pending" },
        ],
        marketTargets: [
            { symbol: "CL=F", name: "WTI Crude Oil", expectedDirection: "up", magnitude: "moderate", reasoning: "Transit uncertainty premium" },
            { symbol: "LMT", name: "Lockheed Martin", expectedDirection: "up", magnitude: "small", reasoning: "Defense readiness narrative" },
        ],
        timeHorizon: "12-48 hours",
    },

    // ── Technology / Supply Chain (3 playbooks) ──────

    {
        id: "taiwan-strait-escalation",
        name: "Taiwan Strait Escalation",
        description: "Military aircraft loitering, GPS jamming, and conflict indicators near Taiwan suggest cross-strait tensions.",
        category: "technology",
        triggerConditions: [
            { kind: "anomaly_present", label: "Aircraft loitering near Taiwan", region: "Taiwan Strait", anomalyKind: "aircraft_loitering" },
            { kind: "gps_jamming_active", label: "GPS interference in Taiwan Strait", region: "Taiwan Strait", minCount: 1 },
            { kind: "conflict_active", label: "Military posturing near Taiwan", region: "Taiwan Strait", minCount: 1 },
        ],
        confidenceThreshold: 0.5,
        causalChain: [
            { order: 1, event: "PLA aircraft cross median line", consequence: "Taiwan raises defense readiness", icon: "alert", status: "pending" },
            { order: 2, event: "Semiconductor supply chain fear", consequence: "TSMC foundry operations questioned", icon: "globe", status: "pending" },
            { order: 3, event: "Tech stock sell-off begins", consequence: "Global chip shortage narrative returns", icon: "chart-up", status: "pending" },
            { order: 4, event: "US naval assets deployed", consequence: "Defense stocks surge, safe-haven rally", icon: "shield", status: "pending" },
        ],
        marketTargets: [
            { symbol: "TSM", name: "Taiwan Semiconductor", expectedDirection: "down", magnitude: "large", reasoning: "Direct foundry disruption risk" },
            { symbol: "NVDA", name: "NVIDIA", expectedDirection: "down", magnitude: "moderate", reasoning: "Supply chain dependency on TSMC" },
            { symbol: "LMT", name: "Lockheed Martin", expectedDirection: "up", magnitude: "moderate", reasoning: "US defense posture escalation" },
        ],
        timeHorizon: "24-96 hours",
        historicalPrecedent: "Aug 2022 Pelosi Taiwan visit market reaction",
    },
    {
        id: "south-china-sea-confrontation",
        name: "South China Sea Confrontation",
        description: "Vessel deviations and military activity in the South China Sea signal potential maritime confrontation.",
        category: "technology",
        triggerConditions: [
            { kind: "vessel_deviation", label: "Ship deviation in South China Sea", region: "South China Sea" },
            { kind: "conflict_active", label: "Military confrontation in SCS", region: "South China Sea", minCount: 2 },
            { kind: "anomaly_present", label: "Military aircraft in SCS", region: "South China Sea", anomalyKind: "aircraft_loitering" },
        ],
        confidenceThreshold: 0.5,
        causalChain: [
            { order: 1, event: "Naval standoff near disputed reef", consequence: "Commercial shipping diverts from area", icon: "ship", status: "pending" },
            { order: 2, event: "Trade route disruption", consequence: "Container shipping rates spike in Asia-Pacific", icon: "globe", status: "pending" },
            { order: 3, event: "Tech supply chain fears", consequence: "Electronics manufacturing delays expected", icon: "chart-up", status: "pending" },
        ],
        marketTargets: [
            { symbol: "TSM", name: "Taiwan Semiconductor", expectedDirection: "down", magnitude: "moderate", reasoning: "Regional instability near foundries" },
            { symbol: "ZIM", name: "ZIM Integrated Shipping", expectedDirection: "up", magnitude: "moderate", reasoning: "Shipping rate surge on diversions" },
            { symbol: "RTX", name: "RTX Corp", expectedDirection: "up", magnitude: "small", reasoning: "Regional defense spending boost" },
        ],
        timeHorizon: "48-96 hours",
    },
    {
        id: "korean-peninsula-crisis",
        name: "Korean Peninsula Crisis",
        description: "Conflict indicators, GPS jamming, and negative sentiment signal heightened tensions on the Korean Peninsula.",
        category: "technology",
        triggerConditions: [
            { kind: "conflict_active", label: "Military activity near DMZ", region: "Korean Peninsula", minCount: 2 },
            { kind: "gps_jamming_active", label: "GPS jamming near Korea", region: "Korean Peninsula", minCount: 1 },
            { kind: "sentiment_shift", label: "Negative sentiment on Korea", threshold: -0.4, direction: "below" },
        ],
        confidenceThreshold: 0.5,
        causalChain: [
            { order: 1, event: "DPRK provocative action detected", consequence: "South Korea raises defense alert", icon: "alert", status: "pending" },
            { order: 2, event: "Regional tech supply chain fears", consequence: "Samsung / SK Hynix operations at risk", icon: "globe", status: "pending" },
            { order: 3, event: "Safe-haven demand surges", consequence: "Gold, yen, VIX all rise", icon: "shield", status: "pending" },
        ],
        marketTargets: [
            { symbol: "005930.KS", name: "Samsung Electronics", expectedDirection: "down", magnitude: "moderate", reasoning: "Proximity to conflict zone" },
            { symbol: "LMT", name: "Lockheed Martin", expectedDirection: "up", magnitude: "moderate", reasoning: "Regional defense spending surge" },
            { symbol: "^VIX", name: "VIX Volatility Index", expectedDirection: "up", magnitude: "large", reasoning: "Fear-driven volatility spike" },
        ],
        timeHorizon: "12-48 hours",
    },

    // ── Currency / Macro (3 playbooks) ───────────────

    {
        id: "yen-carry-trade-unwind",
        name: "Yen Carry Trade Unwind",
        description: "JPY strengthening with US treasury volatility and negative sentiment suggests carry trade unwind risk.",
        category: "currency",
        triggerConditions: [
            { kind: "market_move", label: "JPY sharp move", symbol: "JPY=X", threshold: 1.5, direction: "above" },
            { kind: "market_move", label: "US Treasury volatility", symbol: "TLT", threshold: 1.0, direction: "above" },
            { kind: "sentiment_shift", label: "Macro fear sentiment", threshold: -0.3, direction: "below" },
        ],
        confidenceThreshold: 0.5,
        causalChain: [
            { order: 1, event: "BOJ signals rate adjustment", consequence: "Yen strengthens rapidly against dollar", icon: "chart-up", status: "pending" },
            { order: 2, event: "Carry trade positions unwinding", consequence: "Forced selling across risk assets", icon: "alert", status: "pending" },
            { order: 3, event: "Global liquidity tightening", consequence: "Equities face margin-call driven selling", icon: "globe", status: "pending" },
        ],
        marketTargets: [
            { symbol: "^VIX", name: "VIX Volatility Index", expectedDirection: "up", magnitude: "large", reasoning: "Systematic unwinding drives volatility" },
            { symbol: "GLD", name: "SPDR Gold Trust", expectedDirection: "up", magnitude: "moderate", reasoning: "Safe-haven demand on macro fear" },
            { symbol: "^GSPC", name: "S&P 500", expectedDirection: "down", magnitude: "moderate", reasoning: "Risk-off selling pressure" },
        ],
        timeHorizon: "24-72 hours",
        historicalPrecedent: "Aug 2024 yen carry trade unwind flash crash",
    },
    {
        id: "dollar-strength-squeeze",
        name: "Dollar Strength Squeeze",
        description: "DXY surge signals emerging market stress and commodity weakness.",
        category: "currency",
        triggerConditions: [
            { kind: "market_move", label: "Dollar index surge", symbol: "DX-Y.NYB", threshold: 1.0, direction: "above" },
            { kind: "market_move", label: "Emerging market stress", symbol: "EEM", threshold: 2.0, direction: "above" },
            { kind: "market_move", label: "Commodity weakness", symbol: "DBC", threshold: 1.5, direction: "above" },
        ],
        confidenceThreshold: 0.5,
        causalChain: [
            { order: 1, event: "Fed hawkish surprise or data shock", consequence: "Dollar surges against all majors", icon: "chart-up", status: "pending" },
            { order: 2, event: "EM currencies under pressure", consequence: "Capital flight from emerging markets", icon: "globe", status: "pending" },
            { order: 3, event: "Commodity prices decline", consequence: "Dollar-denominated commodities become expensive", icon: "alert", status: "pending" },
        ],
        marketTargets: [
            { symbol: "EEM", name: "iShares MSCI EM ETF", expectedDirection: "down", magnitude: "moderate", reasoning: "Dollar strength crushes EM" },
            { symbol: "DBC", name: "Invesco DB Commodity Index", expectedDirection: "down", magnitude: "moderate", reasoning: "Strong dollar weighs on commodities" },
            { symbol: "GLD", name: "SPDR Gold Trust", expectedDirection: "down", magnitude: "small", reasoning: "Gold weakens on dollar strength" },
        ],
        timeHorizon: "24-72 hours",
    },
    {
        id: "treasury-volatility-spike",
        name: "Treasury Volatility Spike",
        description: "Sharp moves in long-dated treasuries with VIX spike signal flight to quality.",
        category: "currency",
        triggerConditions: [
            { kind: "market_move", label: "Treasury bond move", symbol: "TLT", threshold: 1.5, direction: "above" },
            { kind: "market_move", label: "VIX spike", symbol: "^VIX", threshold: 15.0, direction: "above" },
            { kind: "sentiment_shift", label: "Flight to quality sentiment", threshold: -0.2, direction: "below" },
        ],
        confidenceThreshold: 0.5,
        causalChain: [
            { order: 1, event: "Unexpected economic data or geopolitical shock", consequence: "Treasury yields plunge as investors seek safety", icon: "chart-up", status: "pending" },
            { order: 2, event: "VIX spikes above 25", consequence: "Options market prices in tail risk", icon: "alert", status: "pending" },
            { order: 3, event: "Equity sell-off accelerates", consequence: "Systematic strategies de-risk", icon: "globe", status: "pending" },
        ],
        marketTargets: [
            { symbol: "TLT", name: "iShares 20+ Year Treasury", expectedDirection: "up", magnitude: "moderate", reasoning: "Flight to safety bid" },
            { symbol: "^GSPC", name: "S&P 500", expectedDirection: "down", magnitude: "moderate", reasoning: "Risk-off rotation" },
            { symbol: "GLD", name: "SPDR Gold Trust", expectedDirection: "up", magnitude: "small", reasoning: "Safe-haven demand" },
        ],
        timeHorizon: "24-48 hours",
    },

    // ── Safe Haven (4 playbooks) ─────────────────────

    {
        id: "global-risk-off-cascade",
        name: "Global Risk-Off Cascade",
        description: "Multi-region risk elevation with VIX spike and gold rally indicates global risk-off mode.",
        category: "safe-haven",
        triggerConditions: [
            { kind: "risk_above", label: "Multi-region risk elevated", region: "Strait of Hormuz", threshold: 60 },
            { kind: "market_move", label: "VIX spike", symbol: "^VIX", threshold: 10.0, direction: "above" },
            { kind: "market_move", label: "Gold rally", symbol: "GLD", threshold: 1.0, direction: "above" },
        ],
        confidenceThreshold: 0.5,
        causalChain: [
            { order: 1, event: "Multiple geopolitical hotspots activate", consequence: "Institutional investors reduce equity exposure", icon: "globe", status: "pending" },
            { order: 2, event: "VIX surges, put demand spikes", consequence: "Options dealers sell index futures to hedge", icon: "chart-up", status: "pending" },
            { order: 3, event: "Gold and treasuries rally", consequence: "Classic risk-off rotation completes", icon: "shield", status: "pending" },
        ],
        marketTargets: [
            { symbol: "GLD", name: "SPDR Gold Trust", expectedDirection: "up", magnitude: "large", reasoning: "Ultimate safe-haven demand" },
            { symbol: "^VIX", name: "VIX Volatility Index", expectedDirection: "up", magnitude: "large", reasoning: "Fear gauge spikes" },
            { symbol: "^GSPC", name: "S&P 500", expectedDirection: "down", magnitude: "moderate", reasoning: "Broad equity sell-off" },
        ],
        timeHorizon: "24-72 hours",
    },
    {
        id: "defense-sector-surge",
        name: "Defense Sector Surge",
        description: "Multi-region conflict escalation with military activity drives defense sector rally.",
        category: "safe-haven",
        triggerConditions: [
            { kind: "conflict_active", label: "Conflict in Eastern Mediterranean", region: "Eastern Mediterranean", minCount: 3 },
            { kind: "conflict_active", label: "Conflict in Black Sea region", region: "Black Sea", minCount: 3 },
            { kind: "anomaly_present", label: "Military aircraft activity", anomalyKind: "aircraft_loitering" },
        ],
        confidenceThreshold: 0.5,
        causalChain: [
            { order: 1, event: "Multiple regional conflicts intensify", consequence: "NATO/allies increase defense posture", icon: "flame", status: "pending" },
            { order: 2, event: "Defense budget increase announcements", consequence: "Order book expectations rise for contractors", icon: "shield", status: "pending" },
            { order: 3, event: "Defense stocks rally on earnings upgrades", consequence: "Sector outperforms broader market", icon: "chart-up", status: "pending" },
        ],
        marketTargets: [
            { symbol: "LMT", name: "Lockheed Martin", expectedDirection: "up", magnitude: "moderate", reasoning: "Multi-theater defense demand" },
            { symbol: "RTX", name: "RTX Corp", expectedDirection: "up", magnitude: "moderate", reasoning: "Missile and radar systems demand" },
            { symbol: "NOC", name: "Northrop Grumman", expectedDirection: "up", magnitude: "moderate", reasoning: "Strategic defense systems demand" },
        ],
        timeHorizon: "48-168 hours",
    },
    {
        id: "energy-crisis-contagion",
        name: "Energy Crisis Contagion",
        description: "Multiple energy regions in crisis with oil spike threatens global energy stability.",
        category: "safe-haven",
        triggerConditions: [
            { kind: "risk_above", label: "Hormuz risk critical", region: "Strait of Hormuz", threshold: 70 },
            { kind: "risk_above", label: "Red Sea risk elevated", region: "Red Sea / Gulf of Aden", threshold: 60 },
            { kind: "market_move", label: "Oil price surge", symbol: "CL=F", threshold: 3.0, direction: "above" },
        ],
        confidenceThreshold: 0.5,
        causalChain: [
            { order: 1, event: "Two major energy chokepoints disrupted", consequence: "Global oil supply faces dual bottleneck", icon: "flame", status: "pending" },
            { order: 2, event: "Strategic petroleum reserve talk", consequence: "Government intervention expected", icon: "shield", status: "pending" },
            { order: 3, event: "Energy stocks surge, airlines decline", consequence: "Sector rotation into energy, out of transport", icon: "chart-up", status: "pending" },
        ],
        marketTargets: [
            { symbol: "XLE", name: "Energy Select SPDR", expectedDirection: "up", magnitude: "large", reasoning: "Energy sector benefits from crisis" },
            { symbol: "CL=F", name: "WTI Crude Oil", expectedDirection: "up", magnitude: "large", reasoning: "Dual chokepoint premium" },
            { symbol: "JETS", name: "US Global Jets ETF", expectedDirection: "down", magnitude: "moderate", reasoning: "Fuel cost pressure on airlines" },
        ],
        timeHorizon: "24-96 hours",
    },
    {
        id: "multi-theater-escalation",
        name: "Multi-Theater Escalation",
        description: "Three or more regions with elevated risk simultaneously signal global instability.",
        category: "safe-haven",
        triggerConditions: [
            { kind: "risk_above", label: "Hormuz risk elevated", region: "Strait of Hormuz", threshold: 50 },
            { kind: "risk_above", label: "Black Sea risk elevated", region: "Black Sea", threshold: 50 },
            { kind: "risk_above", label: "Taiwan risk elevated", region: "Taiwan Strait", threshold: 50 },
        ],
        confidenceThreshold: 0.5,
        causalChain: [
            { order: 1, event: "Three+ regions show simultaneous risk", consequence: "Global instability perception rises sharply", icon: "globe", status: "pending" },
            { order: 2, event: "Institutional risk models trigger de-leveraging", consequence: "Systematic selling across risk assets", icon: "alert", status: "pending" },
            { order: 3, event: "Safe-haven assets rally hard", consequence: "Gold, VIX, defense all surge", icon: "shield", status: "pending" },
            { order: 4, event: "Central banks signal readiness", consequence: "Monetary policy flexibility narrative returns", icon: "chart-up", status: "pending" },
        ],
        marketTargets: [
            { symbol: "^VIX", name: "VIX Volatility Index", expectedDirection: "up", magnitude: "large", reasoning: "Multi-theater fear premium" },
            { symbol: "GLD", name: "SPDR Gold Trust", expectedDirection: "up", magnitude: "large", reasoning: "Global safe-haven demand" },
            { symbol: "ITA", name: "iShares US Aerospace & Defense", expectedDirection: "up", magnitude: "moderate", reasoning: "Defense spending across theaters" },
        ],
        timeHorizon: "24-168 hours",
        historicalPrecedent: "Periods of simultaneous Middle East and Eastern Europe tension",
    },

    // ── Commodity (4 playbooks) ──────────────────────

    {
        id: "grain-supply-shock",
        name: "Grain Supply Shock",
        description: "Black Sea conflict and agricultural region disruption threaten global grain supply.",
        category: "commodity",
        triggerConditions: [
            { kind: "conflict_active", label: "Black Sea conflict escalation", region: "Black Sea", minCount: 3 },
            { kind: "risk_above", label: "Black Sea risk elevated", region: "Black Sea", threshold: 60 },
            { kind: "vessel_deviation", label: "Grain vessel deviation", region: "Black Sea" },
        ],
        confidenceThreshold: 0.5,
        causalChain: [
            { order: 1, event: "Ukrainian port operations disrupted", consequence: "Grain exports halted or delayed", icon: "ship", status: "pending" },
            { order: 2, event: "Global wheat futures surge", consequence: "Importing nations face food inflation", icon: "chart-up", status: "pending" },
            { order: 3, event: "Alternative supply routes explored", consequence: "Overland and Danube routes at capacity", icon: "globe", status: "pending" },
        ],
        marketTargets: [
            { symbol: "WEAT", name: "Teucrium Wheat Fund", expectedDirection: "up", magnitude: "large", reasoning: "Direct supply disruption" },
            { symbol: "CORN", name: "Teucrium Corn Fund", expectedDirection: "up", magnitude: "moderate", reasoning: "Grain complex sympathy move" },
            { symbol: "DBA", name: "Invesco DB Agriculture", expectedDirection: "up", magnitude: "moderate", reasoning: "Broad agriculture inflation" },
        ],
        timeHorizon: "48-168 hours",
        historicalPrecedent: "2022 Ukraine grain corridor disruptions",
    },
    {
        id: "metals-supply-disruption",
        name: "Metals Supply Disruption",
        description: "Sub-Saharan Africa conflict and mining region disruption threaten critical metals supply.",
        category: "commodity",
        triggerConditions: [
            { kind: "conflict_active", label: "Conflict in Sub-Saharan Africa", region: "Sub-Saharan Africa", minCount: 5 },
            { kind: "risk_above", label: "Sub-Saharan risk elevated", region: "Sub-Saharan Africa", threshold: 60 },
            { kind: "sentiment_shift", label: "Negative sentiment on Africa mining", threshold: -0.3, direction: "below" },
        ],
        confidenceThreshold: 0.5,
        causalChain: [
            { order: 1, event: "Mining region conflict intensifies", consequence: "Mines shut down or reduce output", icon: "flame", status: "pending" },
            { order: 2, event: "Critical mineral supply tightens", consequence: "Cobalt, platinum, rare earths at risk", icon: "alert", status: "pending" },
            { order: 3, event: "Materials sector reprices higher", consequence: "Downstream manufacturers face cost pressure", icon: "chart-up", status: "pending" },
        ],
        marketTargets: [
            { symbol: "XLB", name: "Materials Select SPDR", expectedDirection: "up", magnitude: "moderate", reasoning: "Supply scarcity premium" },
            { symbol: "PPLT", name: "abrdn Physical Platinum", expectedDirection: "up", magnitude: "large", reasoning: "South Africa platinum supply risk" },
            { symbol: "LIT", name: "Global X Lithium & Battery", expectedDirection: "up", magnitude: "small", reasoning: "Critical mineral supply chain risk" },
        ],
        timeHorizon: "72-168 hours",
    },
    {
        id: "oil-supply-crunch",
        name: "Oil Supply Crunch",
        description: "Combined disruption in Hormuz and Red Sea creates severe oil supply crunch.",
        category: "commodity",
        triggerConditions: [
            { kind: "vessel_deviation", label: "Vessel deviation in Hormuz", region: "Strait of Hormuz" },
            { kind: "vessel_deviation", label: "Vessel deviation in Red Sea", region: "Red Sea / Gulf of Aden" },
            { kind: "conflict_active", label: "Conflict in both energy corridors", region: "Strait of Hormuz", minCount: 2 },
        ],
        confidenceThreshold: 0.5,
        causalChain: [
            { order: 1, event: "Both Hormuz and Red Sea disrupted", consequence: "40% of global oil transit affected", icon: "flame", status: "pending" },
            { order: 2, event: "Oil surges past $100+", consequence: "Energy crisis narrative dominates", icon: "chart-up", status: "pending" },
            { order: 3, event: "SPR releases and OPEC+ response", consequence: "Supply response lag of 30-60 days", icon: "globe", status: "pending" },
            { order: 4, event: "Recession fears mount", consequence: "Equities fall, bonds rally", icon: "alert", status: "pending" },
        ],
        marketTargets: [
            { symbol: "CL=F", name: "WTI Crude Oil", expectedDirection: "up", magnitude: "large", reasoning: "Dual chokepoint crisis premium" },
            { symbol: "BZ=F", name: "Brent Crude", expectedDirection: "up", magnitude: "large", reasoning: "Global benchmark surges" },
            { symbol: "XOM", name: "ExxonMobil", expectedDirection: "up", magnitude: "moderate", reasoning: "Major integrated oil company benefits" },
        ],
        timeHorizon: "24-72 hours",
        historicalPrecedent: "1973 oil embargo scenario (theoretical modern equivalent)",
    },
    {
        id: "shipping-lane-cascade",
        name: "Shipping Lane Cascade",
        description: "Multiple shipping lane disruptions create cascading global trade disruption.",
        category: "commodity",
        triggerConditions: [
            { kind: "vessel_deviation", label: "Vessel deviation in Red Sea", region: "Red Sea / Gulf of Aden" },
            { kind: "vessel_deviation", label: "Vessel deviation in South China Sea", region: "South China Sea" },
            { kind: "risk_above", label: "Multiple shipping lanes at risk", region: "Red Sea / Gulf of Aden", threshold: 50 },
        ],
        confidenceThreshold: 0.5,
        causalChain: [
            { order: 1, event: "Multiple major shipping lanes disrupted", consequence: "Global container availability plummets", icon: "ship", status: "pending" },
            { order: 2, event: "Freight rates spike across all routes", consequence: "Shipping companies reprice forward contracts", icon: "chart-up", status: "pending" },
            { order: 3, event: "Global trade volume contracts", consequence: "Manufacturing and retail face supply shortages", icon: "globe", status: "pending" },
        ],
        marketTargets: [
            { symbol: "ZIM", name: "ZIM Integrated Shipping", expectedDirection: "up", magnitude: "large", reasoning: "Freight rate surge benefits" },
            { symbol: "BDRY", name: "Breakwave Dry Bulk Shipping", expectedDirection: "up", magnitude: "moderate", reasoning: "Dry bulk rates surge" },
            { symbol: "^GSPC", name: "S&P 500", expectedDirection: "down", magnitude: "small", reasoning: "Global trade disruption drag" },
        ],
        timeHorizon: "48-168 hours",
    },
];

// ============================================
// Exported Playbooks
// ============================================

export { PLAYBOOKS };

// ============================================
// Condition Evaluation
// ============================================

/**
 * Evaluate a single trigger condition against current data.
 */
function evaluateCondition(
    condition: TriggerCondition,
    snapshot: AnomalyDataSnapshot,
    anomalies: Anomaly[],
    riskScores: RiskScore[],
    patterns: Pattern[],
): boolean {
    switch (condition.kind) {
        case "anomaly_present":
            return evaluateAnomalyPresent(condition, anomalies);
        case "risk_above":
            return evaluateRiskAbove(condition, riskScores);
        case "pattern_detected":
            return evaluatePatternDetected(condition, patterns);
        case "market_move":
            return evaluateMarketMove(condition, snapshot);
        case "sentiment_shift":
            return evaluateSentimentShift(condition, snapshot);
        case "conflict_active":
            return evaluateConflictActive(condition, snapshot);
        case "gps_jamming_active":
            return evaluateGpsJammingActive(condition, snapshot);
        case "vessel_deviation":
            return evaluateVesselDeviation(condition, anomalies);
        default:
            return false;
    }
}

function evaluateAnomalyPresent(condition: TriggerCondition, anomalies: Anomaly[]): boolean {
    return anomalies.some((a) => {
        const kindMatch = condition.anomalyKind
            ? a.kind === condition.anomalyKind
            : true;
        const regionMatch = condition.region
            ? a.regionName?.toLowerCase().includes(condition.region.toLowerCase())
            : true;
        return kindMatch && regionMatch;
    });
}

function evaluateRiskAbove(condition: TriggerCondition, riskScores: RiskScore[]): boolean {
    const threshold = condition.threshold ?? 50;
    const region = findMonitoredRegion(condition.region);
    if (!region) return false;

    return riskScores.some(
        (r) =>
            r.regionName.toLowerCase().includes(region.name.toLowerCase()) &&
            r.overallScore >= threshold,
    );
}

function evaluatePatternDetected(condition: TriggerCondition, patterns: Pattern[]): boolean {
    return patterns.some((p) => {
        if (condition.patternKind) {
            return p.kind === (condition.patternKind as PatternKind);
        }
        return true;
    });
}

function evaluateMarketMove(condition: TriggerCondition, snapshot: AnomalyDataSnapshot): boolean {
    if (!condition.symbol || condition.threshold === undefined) return false;

    const instrument = snapshot.marketInstruments.find(
        (m) => m.symbol === condition.symbol,
    );
    if (!instrument || instrument.changePercent === null) return false;

    const absChange = Math.abs(instrument.changePercent);
    return absChange >= condition.threshold;
}

function evaluateSentimentShift(condition: TriggerCondition, snapshot: AnomalyDataSnapshot): boolean {
    const threshold = condition.threshold ?? -0.3;
    if (snapshot.socialPosts.length === 0) return false;

    const scores = snapshot.socialPosts
        .filter((p) => p.sentimentScore !== null)
        .map((p) => p.sentimentScore as number);

    if (scores.length === 0) return false;

    const avgSentiment = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    return avgSentiment < threshold;
}

function evaluateConflictActive(condition: TriggerCondition, snapshot: AnomalyDataSnapshot): boolean {
    const minCount = condition.minCount ?? 1;
    const region = findMonitoredRegion(condition.region);
    if (!region) return false;

    const conflictsInRegion = snapshot.conflicts.filter((c) => {
        const dist = haversineKm(c.latitude, c.longitude, region.center.lat, region.center.lng);
        return dist <= region.radiusKm;
    });

    return conflictsInRegion.length >= minCount;
}

function evaluateGpsJammingActive(condition: TriggerCondition, snapshot: AnomalyDataSnapshot): boolean {
    const minCount = condition.minCount ?? 1;
    const region = findMonitoredRegion(condition.region);
    if (!region) return false;

    const jammingInRegion = snapshot.gpsJamming.filter((z) => {
        const dist = haversineKm(z.latitude, z.longitude, region.center.lat, region.center.lng);
        return dist <= region.radiusKm;
    });

    return jammingInRegion.length >= minCount;
}

function evaluateVesselDeviation(condition: TriggerCondition, anomalies: Anomaly[]): boolean {
    return anomalies.some((a) => {
        if (a.kind !== "vessel_deviation") return false;
        if (condition.region) {
            return a.regionName?.toLowerCase().includes(condition.region.toLowerCase());
        }
        return true;
    });
}

// ============================================
// Helper: find monitored region by name
// ============================================

function findMonitoredRegion(name?: string) {
    if (!name) return undefined;
    const lower = name.toLowerCase();
    return MONITORED_REGIONS.find((r) => r.name.toLowerCase().includes(lower));
}

// ============================================
// Confidence Calculation
// ============================================

/**
 * Calculate confidence score for a playbook based on triggered conditions.
 * Weighted: earlier conditions count slightly more.
 */
function calculateConfidence(
    playbook: ScenarioPlaybook,
    triggeredCount: number,
    totalCount: number,
): number {
    if (totalCount === 0) return 0;
    // Base ratio
    const baseConfidence = triggeredCount / totalCount;
    // Slight boost if many conditions met (non-linear)
    const boost = triggeredCount >= totalCount ? 0.1 : 0;
    return Math.min(1, baseConfidence + boost);
}

// ============================================
// Causal Chain Status Update
// ============================================

/**
 * Update causal chain step statuses based on triggered conditions.
 * First N steps proportional to triggered ratio get "triggered",
 * next step is "watching", rest are "pending".
 */
function updateCausalChainStatuses(
    chain: CausalChainStep[],
    triggeredRatio: number,
): CausalChainStep[] {
    const triggeredSteps = Math.floor(triggeredRatio * chain.length);
    return chain.map((step, idx) => {
        let status: CausalChainStepStatus;
        if (idx < triggeredSteps) {
            status = "triggered";
        } else if (idx === triggeredSteps) {
            status = "watching";
        } else {
            status = "pending";
        }
        return { ...step, status };
    });
}

// ============================================
// Main Entry Point
// ============================================

/**
 * Evaluate all scenario playbooks against current data.
 * Returns an array of active MarketSignals for playbooks that
 * exceed their confidence threshold.
 */
export function evaluateScenarios(
    snapshot: AnomalyDataSnapshot,
    anomalies: Anomaly[],
    riskScores: RiskScore[],
    patterns: Pattern[],
): MarketSignal[] {
    const signals: MarketSignal[] = [];
    const now = new Date().toISOString();

    for (const playbook of PLAYBOOKS) {
        const totalConditions = playbook.triggerConditions.length;
        const triggeredLabels: string[] = [];
        const pendingLabels: string[] = [];

        for (const condition of playbook.triggerConditions) {
            const triggered = evaluateCondition(
                condition,
                snapshot,
                anomalies,
                riskScores,
                patterns,
            );
            if (triggered) {
                triggeredLabels.push(condition.label);
            } else {
                pendingLabels.push(condition.label);
            }
        }

        const confidence = calculateConfidence(
            playbook,
            triggeredLabels.length,
            totalConditions,
        );

        if (confidence >= playbook.confidenceThreshold) {
            const triggeredRatio = triggeredLabels.length / totalConditions;
            const severity = confidenceToSeverity(confidence);

            const signal: MarketSignal = {
                id: `signal-${playbook.id}-${Date.now()}`,
                playbookId: playbook.id,
                playbookName: playbook.name,
                playbookCategory: playbook.category,
                description: playbook.description,
                severity,
                status: "active",
                confidence,
                triggeredConditions: triggeredLabels,
                pendingConditions: pendingLabels,
                causalChain: updateCausalChainStatuses(
                    playbook.causalChain,
                    triggeredRatio,
                ),
                marketTargets: playbook.marketTargets,
                activatedAt: now,
                timeHorizon: playbook.timeHorizon,
                historicalPrecedent: playbook.historicalPrecedent,
            };

            signals.push(signal);
        }
    }

    // Sort by confidence descending
    signals.sort((a, b) => b.confidence - a.confidence);
    return signals;
}

// ============================================
// Sample Data Fallback
// ============================================

/**
 * Generate 2-3 deterministic sample signals when all data is sample data.
 * Uses Mulberry32 PRNG with seed 54321 for reproducibility.
 */
export function generateSampleSignals(): MarketSignal[] {
    const rng = mulberry32(54321);
    const baseTime = BASE_TIME;

    // Pick 3 representative playbooks deterministically
    const selectedPlaybooks = [
        PLAYBOOKS[0],  // hormuz-shipping-disruption (energy)
        PLAYBOOKS[4],  // taiwan-strait-escalation (technology)
        PLAYBOOKS[9],  // global-risk-off-cascade (safe-haven)
    ];

    const signals: MarketSignal[] = [];

    for (let i = 0; i < selectedPlaybooks.length; i++) {
        const playbook = selectedPlaybooks[i];
        const id = seededUUID(rng);
        const totalConditions = playbook.triggerConditions.length;

        // Determine how many conditions are triggered (at least half + 1)
        const triggeredCount = Math.max(
            Math.ceil(totalConditions * 0.5),
            Math.min(totalConditions, Math.floor(rng() * totalConditions) + 1),
        );

        const triggeredLabels: string[] = [];
        const pendingLabels: string[] = [];

        for (let j = 0; j < totalConditions; j++) {
            if (j < triggeredCount) {
                triggeredLabels.push(playbook.triggerConditions[j].label);
            } else {
                pendingLabels.push(playbook.triggerConditions[j].label);
            }
        }

        const confidence = calculateConfidence(playbook, triggeredCount, totalConditions);
        const triggeredRatio = triggeredCount / totalConditions;
        const severity = confidenceToSeverity(confidence);
        const offsetMinutes = Math.floor(rng() * 120);

        const signal: MarketSignal = {
            id: `signal-${id}`,
            playbookId: playbook.id,
            playbookName: playbook.name,
            playbookCategory: playbook.category,
            description: playbook.description,
            severity,
            status: "active",
            confidence,
            triggeredConditions: triggeredLabels,
            pendingConditions: pendingLabels,
            causalChain: updateCausalChainStatuses(
                playbook.causalChain,
                triggeredRatio,
            ),
            marketTargets: playbook.marketTargets,
            activatedAt: new Date(baseTime - offsetMinutes * 60_000).toISOString(),
            timeHorizon: playbook.timeHorizon,
            historicalPrecedent: playbook.historicalPrecedent,
        };

        signals.push(signal);
    }

    // Sort by confidence descending
    signals.sort((a, b) => b.confidence - a.confidence);
    return signals;
}
