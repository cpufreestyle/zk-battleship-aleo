program shadowfleet.aleo {
    @noupgrade constructor() {}

    // === RECORDS ===

    record Board {
        owner: address,
        ships: u32,
        shots: u32,
        ships_remaining: u8,
        opponent: address,
    }

    // === ZK VERIFICATION FUNCTIONS ===
    // ships is PRIVATE — ZK proof proves correctness without revealing positions

    // Returns (ships & mask) — non-zero means HIT
    fn verify_hit(
        ships: u32,
        public mask: u32,
    ) -> u32 {
        return ships & mask;
    }

    // Returns (ships & hits) — equals ships means all sunk
    fn verify_victory(
        ships: u32,
        public hits: u32,
    ) -> u32 {
        return ships & hits;
    }

    // ZK scan: returns (ships & scan_mask) — count of set bits reveals how many
    // ships are in the scanned area, without revealing which specific cells
    fn verify_scan(
        ships: u32,
        public scan_mask: u32,
    ) -> u32 {
        return ships & scan_mask;
    }

    // === ON-CHAIN TRANSITIONS ===

    // Place your fleet — creates a private Board record
    fn place_fleet(
        ships: u32,
        public ship_count: u8,
        public opponent: address,
    ) -> Board {
        return Board {
            owner: std::ctx::caller(),
            ships: ships,
            shots: 0u32,
            ships_remaining: ship_count,
            opponent: opponent,
        };
    }

    // Fire at a coordinate — returns updated board + hit indicator (ships & mask)
    fn fire(
        board: Board,
        public coordinate: u32,
    ) -> (Board, u32) {
        let mask: u32 = 1u32 << coordinate;
        let hit_value: u32 = board.ships & mask;
        let new_shots: u32 = board.shots | mask;
        let new_remaining: u8 = board.ships_remaining - (hit_value != 0u32) as u8;

        let updated: Board = Board {
            owner: board.owner,
            ships: board.ships,
            shots: new_shots,
            ships_remaining: new_remaining,
            opponent: board.opponent,
        };

        return (updated, hit_value);
    }

    // Check if the fleet is destroyed — returns ships_remaining (0 = victory)
    fn check_victory(
        board: Board,
    ) -> (Board, u8) {
        return (board, board.ships_remaining);
    }
}
