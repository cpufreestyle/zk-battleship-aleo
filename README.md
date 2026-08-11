# 隐海战舰 — Shadow Fleet

> ZK Battleship on Aleo — Zero-Knowledge Naval Combat
>
> Built for [Aleo Hackathon](https://hackathon.xyz/events/public/e7ad6199-0078-42ee-9846-b82c385e4c0e) · GameFi & SocialFi Track

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

## 🏗 Architecture

```
zk-battleship-aleo/
├── leo/
│   ├── src/main.leo       # Leo program (ZK verification + on-chain transitions)
│   └── program.json      # Leo project config
├── web-app/
│   ├── index.html        # Game page
│   ├── main.js           # Game logic + ZK proof integration
│   ├── zk.js             # Aleo SDK initialization + ZK execution
│   ├── worker.js         # Web Worker (for multithreaded ZK proof generation)
│   ├── deploy.mjs        # Testnet deployment script
│   ├── style.css         # Naval combat themed UI
│   ├── vite.config.js    # Vite config (WASM + COOP/COEP headers)
│   └── package.json
├── demo.webm             # Demo video (2-5 min)
└── start.sh              # Dev server launcher
```

## 🚀 Quick Start

### Prerequisites

- Node.js v22+ (v24 not recommended due to npm issues)
- npm

### Run Locally

```bash
cd web-app
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### Deploy to Aleo Testnet

```bash
# Get testnet credits from https://faucet.aleo.org first
cd web-app
node deploy.mjs <your_private_key>
```

Or use Leo CLI:

```bash
export PRIVATE_KEY=<your_private_key>
cd leo
leo deploy --network testnet --endpoint https://api.provable.com/v2 --path . -y --broadcast
```

## 🎮 How to Play

1. **Place Ships**: Click cells on your 5×5 grid to place 3 ships (Destroyer: 3 cells, Frigate: 2 cells, Submarine: 2 cells). Use Rotate button to change direction.

2. **Battle**: Click cells on the Enemy Waters grid to fire. Each shot triggers a **real ZK proof generation** via the Aleo WASM runtime.

3. **Verify Privacy**: Watch the proof panel at the bottom — each shot generates a ZK proof showing the result is correct while ship positions remain encrypted (🔒).

4. **Win**: Sink all enemy ships to win! All results are cryptographically verified.

## 🔬 ZK Proof Details

The game uses two Aleo ZK functions:

### `verify_hit(ships: u32.private, mask: u32.public) → u32`
Computes `ships & mask`. Non-zero result = HIT. The `ships` bitstring is a **private input** — the ZK proof proves the AND operation was computed correctly without revealing which cells contain ships.

### `verify_victory(ships: u32.private, hits: u32.public) → u32`
Computes `ships & hits`. If the result equals `ships`, all ships are sunk. Again, ship positions remain private.

### Leo Source (src/main.leo)

```leo
program shadowfleet.aleo {
    @noupgrade constructor() {}

    // ZK verification: proves hit/miss without revealing ship positions
    fn verify_hit(ships: u32, public mask: u32) -> u32 {
        return ships & mask;
    }

    fn verify_victory(ships: u32, public hits: u32) -> u32 {
        return ships & hits;
    }

    // On-chain transitions for multiplayer mode
    fn place_fleet(ships: u32, public ship_count: u8, public opponent: address) -> Board { ... }
    fn fire(board: Board, public coordinate: u32) -> (Board, u32) { ... }
    fn check_victory(board: Board) -> (Board, u8) { ... }
}
```

### Aleo Instructions (used by browser SDK)

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

## 🛠 Tech Stack

| Component | Technology |
|-----------|-----------|
| ZK Proofs | Aleo snarkVM (WASM) |
| SDK | @provablehq/sdk |
| Frontend | Vanilla JS + Vite |
| Language | Aleo Instructions / Leo v4.4.1 |
| Privacy | Zero-Knowledge Proofs (zk-SNARKs) |

## 📋 Hackathon Submission

- **Track**: GameFi & SocialFi
- **Theme**: Programmable Privacy
- **Privacy Feature**: Ship positions are private inputs to ZK programs — verifiable but never revealed
- **Built with**: Aleo SDK, Leo/Aleo Instructions, Vanilla JS
- **Demo Video**: `demo.webm`
- **GitHub**: https://github.com/cpufreestyle/zk-battleship-aleo

## 📄 License

MIT
