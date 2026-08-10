program shadowfleet.aleo {
    // === RECORDS ===

    // Private board record — ship positions are never exposed on-chain
    record Board {
        owner: address,
        ships: u32,           // 25-bit bitstring: bit i = 1 means cell i has a ship
        shots: u32,           // 25-bit bitstring: bit i = 1 means cell i has been fired at
        ships_remaining: u8,  // number of unhit ship cells
        opponent: address,
    }

    // Game state record
    record Game {
        owner: address,
        player1: address,
        player2: address,
        current_turn: u8,     // 0 = player1, 1 = player2
        winner: u8,           // 0 = ongoing, 1 = p1 wins, 2 = p2 wins
    }

    // === ON-CHAIN TRANSITIONS (for deployed mode) ===

    // Place your fleet — creates a private Board record
    // Ship positions remain private in the record, only the owner can spend it
    fn place_fleet(
        ships: u32,
        public ship_count: u8,
        public opponent: address,
    ) -> Board {
        return Board {
            owner: self.caller,
            ships: ships,
            shots: 0u32,
            ships_remaining: ship_count,
            opponent: opponent,
        };
    }

    // Fire at a coordinate — ZK proof verifies hit/miss without revealing ships
    fn fire(
        board: Board,
        public coordinate: u32,
    ) -> (Board, u8) {
        let mask: u32 = 1u32 << coordinate;
        let ship_at_target: u32 = board.ships & mask;
        let is_hit: bool = ship_at_target != 0u32;
        let hit_result: u8 = if is_hit { 1u8 } else { 0u8 };
        let new_shots: u32 = board.shots | mask;
        let new_remaining: u8 = if is_hit {
            board.ships_remaining - 1u8
        } else {
            board.ships_remaining
        };

        return Board {
            owner: board.owner,
            ships: board.ships,
            shots: new_shots,
            ships_remaining: new_remaining,
            opponent: board.opponent,
        }, hit_result;
    }

    // Check if the fleet is destroyed
    fn check_victory(
        board: Board,
    ) -> (Board, u8) {
        let fleet_destroyed: bool = board.ships_remaining == 0u8;
        let result: u8 = if fleet_destroyed { 1u8 } else { 0u8 };
        return board, result;
    }

    // === ZK VERIFICATION FUNCTIONS (used for client-side proof generation) ===
    // These run locally via the Aleo SDK's WASM runtime in the browser.
    // The 'ships' input is PRIVATE — the ZK proof proves the result is correct
    // without revealing the ship positions to the verifier.

    // Returns (ships & mask) as u32 — non-zero means HIT
    // The private 'ships' bitstring is never revealed, only the proof of correct computation
    fn verify_hit(
        ships: u32,
        public mask: u32,
    ) -> u32 {
        return ships & mask;
    }

    // Returns (ships & hits) as u32 — equals ships means all ships are sunk
    fn verify_victory(
        ships: u32,
        public hits: u32,
    ) -> u32 {
        return ships & hits;
    }
}
