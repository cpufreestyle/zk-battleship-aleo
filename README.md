# 隐海战舰 — Shadow Fleet

> ZK Battleship on Aleo — Zero-Knowledge Naval Combat
>
> Built for [Aleo Hackathon](https://hackathon.xyz/events/public/e7ad6199-0078-42ee-9846-b82c385e4c0e) · GameFi & SocialFi Track

**🔗 Live Demo**: https://shadowfleet.vercel.app

## 🎯 What Is This?

Shadow Fleet is a privacy-preserving Battleship game where ship positions are protected by **zero-knowledge proofs** on Aleo. Players can verify that hit/miss results are correct **without ever revealing** their ship placements.

### Deployed on Aleo Testnet ✅

- **Program ID**: `shadowfleet.aleo`
- **Deploy TX**: [`at1y8dx5envrqxkna07xhny3eg6fmh9vsy3mz6nc5cenxmtckdm2qqsuesdey`](https://www.aleo.network/)
- **verify_hit On-chain TX**: [`at1yal6nvg3t7ukvfe9g7nm48lxe945rj2xp5jr53k5ux0ql9czmcqqrnyxnu`](https://www.aleo.network/)
- **Demo Video**: `demo.webm` (shows ZK proof generation in browser)

### How ZK Privacy Works

```
Player A places ships → ships bitstring (PRIVATE INPUT)
                        ↓
Player B fires at cell → mask (PUBLIC INPUT)
                        ↓
Aleo ZK Program: verify_hit(ships, mask) → ships & mask
                        ↓
ZK PROOF: "The computation is correct" (ships remain ENCRYPTED)
                        ↓
Result: HIT or MISS (PUBLIC OUTPUT)
```

- **Private input**: `ships` (25-bit bitstring of ship positions) — never revealed
- **Public input**: `mask` (which cell was fired at) — visible to both players
- **Public output**: `ships & mask` (non-zero = hit, zero = miss)
- **ZK proof**: Cryptographically guarantees the computation was correct **without exposing `ships`**

## 🎮 Gameplay Features

| Feature | Description |
|---------|-------------|
| **Real ZK Proofs** | Every shot generates a real Aleo snarkVM proof in-browser via WASM |
| **3-Layer ZK Degradation** | L1: shared memory probe → L2: dynamic SDK import → L3: clean fallback (never white-screens) |
| **Interactive Tutorial** | Step-by-step onboarding with mini-board demos for first-time players |
| **Game Speed Control** | 0.5× to 8× speed multiplier for different play styles |
| **Web Audio SFX** | Programmatic sound effects (fire, hit, miss, sunk, victory, defeat, incoming) |
| **FX Layer** | Screen shake on hits, visual feedback for combat impact |
| **Suspense Timing** | Minimum delay between fire and result so fast ZK doesn't feel jarring |
| **Ship Sunk Detection** | Shows which ship was sunk (驱逐舰/护卫舰/潜艇) with names |
| **Battle Feed** | Human-language combat log (e.g. "你向 B3 开火", "💥 B3 命中！") |
| **Proof Panel** | Real-time ZK proof log with ✓ ZK PROOF / ⚠ LOCAL badges |
| **Random Placement** | One-click random ship placement |

## 🏗 Architecture

```
zk-battleship-aleo/
├── index.html              # Game page
├── main.js                 # Game logic + ZK proof integration
├── zk.js                   # Aleo SDK init + 3-layer degradation strategy
├── audio.js                # Web Audio API programmatic SFX
├── fx.js                   # Visual FX layer (screen shake, animations)
├── worker.js               # Web Worker for multithreaded ZK (optional)
├── style.css               # Naval combat themed UI
├── vite.config.js          # Vite config (WASM + COOP/COEP headers)
├── vercel.json             # Vercel deployment headers
├── deploy.mjs              # Aleo testnet deployment script
├── package.json
├── leo/                    # Leo program (on-chain ZK verification)
│   ├── src/main.leo       # Leo source (ZK functions + on-chain transitions)
│   └── program.json       # Leo project config
├── public/                 # Static assets
│   ├── coi-serviceworker.js  # Cross-origin isolation polyfill for GitHub Pages
│   ├── _headers            # Netlify/Cloudflare COOP/COEP headers
│   ├── .nojekyll           # GitHub Pages config
│   └── icons/              # Favicon
├── scripts/                # Build & deploy scripts
│   ├── clean.mjs           # Safe dist cleanup
│   ├── serve-dist.mjs      # Multi-scenario local preview server
│   └── package-itch.mjs    # itch.io packaging
├── demo.webm               # Demo video (2-5 min)
├── DEPLOY.md              # Build & deployment runbook
├── PUBLISH.md             # Publishing checklist (itch.io/GitHub Pages/Vercel)
└── start.sh               # Dev server launcher
```

### ZK 3-Layer Degradation Strategy

The most critical engineering challenge: `@provablehq/wasm` unconditionally creates `WebAssembly.Memory({shared: true})` at module top-level. Without cross-origin isolation (COOP/COEP headers), this throws TypeError and kills the entire page.

```
L1  Capability probe: try creating a minimal shared memory
      ├─ Success → L2
      └─ Fail → register coi-serviceworker (synthesizes COOP/COEP, reload once)
                  ├─ Success → L2
                  └─ Fail → L3

L2  Dynamic import Aleo SDK → real ZK proofs via snarkVM

L3  Clean fallback: dispatch zk-error → game uses local JS verification
    (never white-screens, never freezes — game is always playable)
```

**Key insight**: Chrome desktop hides `SharedArrayBuffer` global but still allows WASM shared memory. Using `crossOriginIsolated === true` as the check would falsely block Chrome. The only correct probe: try creating the exact same `WebAssembly.Memory({shared: true})` the SDK uses.

## 🚀 Quick Start

### Prerequisites

- Node.js **v22** (v24 has npm issues on some machines)

### Run Locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 — Vite config already sets COOP/COEP headers for local ZK.

### Build

```bash
npm run build          # outputs dist/
```

First screen payload: ~35KB (gzip ~14KB). The 21MB Aleo WASM is **lazy-loaded** only when ZK is available — game renders first, ZK loads in background.

### Deploy to Aleo Testnet

```bash
# Get testnet credits from https://faucet.aleo.org first
node deploy.mjs <your_private_key>
```

Or use Leo CLI:

```bash
export PRIVATE_KEY=<your_private_key>
cd leo
leo deploy --network testnet --endpoint https://api.provable.com/v2 --path . -y --broadcast
```

### Multi-Platform Publishing

See [DEPLOY.md](DEPLOY.md) and [PUBLISH.md](PUBLISH.md) for detailed instructions.

| Platform | ZK Support | Config |
|----------|-----------|--------|
| Vercel | ✅ Full | `vercel.json` (COOP/COEP headers) |
| Netlify / CF Pages | ✅ Full | `public/_headers` |
| itch.io | ✅ Full | Enable "SharedArrayBuffer support" in embed options |
| GitHub Pages | ⚠️ SW fallback | `coi-serviceworker.js` auto-polyfill |

## 🔬 ZK Proof Details

### Aleo Instructions (browser SDK)

```aleo
program shadowfleet.aleo;

function verify_hit:
    input r0 as u32.private;
    input r1 as u32.public;
    and r0 r1 into r2;
    output r2 as u32.private;

function verify_victory:
    input r0 as u32.private;
    input r1 as u32.public;
    and r0 r1 into r2;
    output r2 as u32.private;
```

### Leo Program (on-chain)

```leo
program shadowfleet.aleo {
    @noupgrade constructor() {}

    // ZK verification: proves hit/miss without revealing ship positions
    fn verify_hit(ships: u32, public mask: u32) -> u32 {
        return ships & mask;
    }

    // ZK verification: proves all ships sunk without revealing positions
    fn verify_victory(ships: u32, public hits: u32) -> u32 {
        return ships & hits;
    }

    // On-chain transitions for multiplayer mode
    fn place_fleet(ships: u32, public ship_count: u8, public opponent: address) -> Board { ... }
    fn fire(board: Board, public coordinate: u32) -> (Board, u32) { ... }
    fn check_victory(board: Board) -> (Board, u8) { ... }
}
```

### QA Switches

| URL Param | Effect |
|-----------|--------|
| `?zk=off` | Force fallback mode (test game without ZK) |
| `?zk=on` | Skip probe, force-load SDK (debug) |
| `?nocoi=1` | Disable SW polyfill (test worst case) |

## 🛠 Tech Stack

| Component | Technology |
|-----------|-----------|
| ZK Proofs | Aleo snarkVM (WASM in browser) |
| SDK | @provablehq/sdk |
| On-chain | Leo v4.4.1 / Aleo Instructions |
| Frontend | Vanilla JS + Vite 6 |
| Audio | Web Audio API (programmatic synthesis) |
| Hosting | Vercel (COOP/COEP configured) |

## 📋 Hackathon Submission

- **Track**: GameFi & SocialFi
- **Theme**: Programmable Privacy
- **Privacy Feature**: Ship positions are private inputs to ZK programs — verifiable but never revealed
- **Demo Video**: `demo.webm`
- **Live Demo**: https://shadowfleet.vercel.app
- **GitHub**: https://github.com/cpufreestyle/zk-battleship-aleo

## 📄 License

MIT
