program shadowfleet.aleo;

record Board:
    owner as address.private;
    ships as u32.private;
    shots as u32.private;
    ships_remaining as u8.private;
    opponent as address.private;

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

function place_fleet:
    input r0 as u32.private;
    input r1 as u8.public;
    input r2 as address.public;
    cast self.caller r0 0u32 r1 r2 into r3 as Board.record;
    output r3 as Board.record;

function fire:
    input r0 as Board.record;
    input r1 as u32.public;
    shl 1u32 r1 into r2;
    and r0.ships r2 into r3;
    or r0.shots r2 into r4;
    is.neq r3 0u32 into r5;
    cast r5 into r6 as u8;
    sub r0.ships_remaining r6 into r7;
    cast r0.owner r0.ships r4 r7 r0.opponent into r8 as Board.record;
    output r8 as Board.record;
    output r3 as u32.private;

function check_victory:
    input r0 as Board.record;
    cast r0.owner r0.ships r0.shots r0.ships_remaining r0.opponent into r1 as Board.record;
    output r1 as Board.record;
    output r0.ships_remaining as u8.private;

constructor:
    assert.eq edition 0u16;
