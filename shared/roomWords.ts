/**
 * BLURT — curated room-code wordlist.
 *
 * Four-letter, pronounceable, memorable, sayable across a noisy room, and boring
 * enough to be safe. `scripts/contentLint.ts` fails the build if any entry is not
 * exactly four A–Z characters, if there are duplicates, if the list drops below
 * `MIN_ROOM_WORDS`, or if anything here trips the blocklist.
 *
 * Function words (THAT, THIS, WITH, FROM…) are deliberately excluded — a room code
 * should sound like a thing, not like grammar.
 */

export const MIN_ROOM_WORDS = 500;

export const ROOM_WORDS: readonly string[] = [
  // A
  'ABLE', 'ACHE', 'ACID', 'ACRE', 'AJAR', 'ALLY', 'ALTO', 'APEX', 'ARCH', 'AREA',
  'ARIA', 'ARMY', 'ATOM', 'AUNT', 'AUTO', 'AVID', 'AXLE',
  // B
  'BABY', 'BACK', 'BAIT', 'BAKE', 'BALD', 'BALE', 'BALL', 'BAND', 'BANK', 'BARK',
  'BARN', 'BASE', 'BASH', 'BASK', 'BATH', 'BEAD', 'BEAM', 'BEAN', 'BEAR', 'BEAT',
  'BEEF', 'BEEP', 'BELL', 'BELT', 'BEND', 'BIKE', 'BILL', 'BIRD', 'BITE', 'BLAB',
  'BLIP', 'BLOB', 'BLOT', 'BLOW', 'BLUE', 'BLUR', 'BOAR', 'BOAT', 'BOLD', 'BOLT',
  'BOND', 'BONE', 'BOOK', 'BOOM', 'BOOT', 'BORE', 'BOSS', 'BOWL', 'BRAG', 'BRAN',
  'BRAT', 'BRAY', 'BREW', 'BRIM', 'BROW', 'BUCK', 'BUFF', 'BULB', 'BULK', 'BULL',
  'BUMP', 'BUNK', 'BUNS', 'BUOY', 'BURN', 'BURP', 'BUSH', 'BUST', 'BUZZ',
  // C
  'CAFE', 'CAGE', 'CAKE', 'CALF', 'CALM', 'CAMP', 'CANE', 'CAPE', 'CARD', 'CARE',
  'CARP', 'CART', 'CASE', 'CASH', 'CAST', 'CAVE', 'CELL', 'CHAT', 'CHEF', 'CHEW',
  'CHIP', 'CHOP', 'CITY', 'CLAM', 'CLAN', 'CLAP', 'CLAW', 'CLAY', 'CLIP', 'CLOG',
  'CLOT', 'CLUB', 'CLUE', 'COAL', 'COAT', 'CODE', 'COIL', 'COIN', 'COLD', 'COLT',
  'COMB', 'COOK', 'COOL', 'COPE', 'COPY', 'CORD', 'CORE', 'CORK', 'CORN', 'COST',
  'COVE', 'CRAB', 'CRAM', 'CRIB', 'CROP', 'CROW', 'CUBE', 'CUFF', 'CURB', 'CURL',
  'CUTE',
  // D
  'DAMP', 'DARE', 'DARK', 'DARN', 'DART', 'DASH', 'DATA', 'DATE', 'DAWN', 'DEAL',
  'DECK', 'DEED', 'DEEP', 'DEER', 'DELI', 'DENT', 'DESK', 'DIAL', 'DICE', 'DIET',
  'DIME', 'DINE', 'DINO', 'DIRT', 'DISC', 'DISH', 'DISK', 'DIVE', 'DOCK', 'DOME',
  'DOOR', 'DOSE', 'DOTS', 'DOVE', 'DOZE', 'DRAG', 'DRAW', 'DRIP', 'DROP', 'DRUM',
  'DUCK', 'DUDE', 'DUEL', 'DUET', 'DUKE', 'DULL', 'DUMP', 'DUNE', 'DUSK', 'DUST',
  // E
  'EARL', 'EARN', 'EASE', 'EAST', 'ECHO', 'EDGE', 'EDIT', 'EGGS', 'EPIC', 'EXAM',
  'EXIT', 'EYES',
  // F
  'FACE', 'FACT', 'FADE', 'FAIR', 'FAKE', 'FALL', 'FAME', 'FARM', 'FAST', 'FATE',
  'FAWN', 'FEED', 'FEET', 'FERN', 'FEUD', 'FIGS', 'FILE', 'FILM', 'FINE', 'FIRE',
  'FIRM', 'FISH', 'FIST', 'FIVE', 'FLAG', 'FLAP', 'FLAT', 'FLEA', 'FLEX', 'FLIP',
  'FLOP', 'FLOW', 'FOAM', 'FOIL', 'FOLD', 'FOLK', 'FONT', 'FOOD', 'FOOT', 'FORK',
  'FORM', 'FORT', 'FOUR', 'FOWL', 'FREE', 'FROG', 'FUEL', 'FUME', 'FUND', 'FUNK',
  'FUSE', 'FUZZ',
  // G
  'GAIN', 'GALA', 'GALE', 'GAME', 'GAPE', 'GASP', 'GATE', 'GAZE', 'GEAR', 'GEMS',
  'GENE', 'GIFT', 'GILL', 'GIVE', 'GLAD', 'GLEE', 'GLOW', 'GLUE', 'GNAT', 'GOAL',
  'GOAT', 'GOLD', 'GOLF', 'GONG', 'GOOF', 'GOSH', 'GOWN', 'GRAB', 'GRAM', 'GRAY',
  'GRID', 'GRIN', 'GRIP', 'GRIT', 'GROW', 'GRUB', 'GULF', 'GULL', 'GULP', 'GURU',
  'GUSH', 'GUST',
  // H
  'HAIL', 'HALF', 'HALL', 'HALO', 'HALT', 'HAND', 'HANG', 'HARP', 'HASH', 'HAUL',
  'HAWK', 'HAZE', 'HEAD', 'HEAL', 'HEAP', 'HEAT', 'HEEL', 'HELM', 'HELP', 'HEMP',
  'HERB', 'HERD', 'HERO', 'HIDE', 'HIGH', 'HIKE', 'HILL', 'HINT', 'HIVE', 'HOAX',
  'HOLE', 'HOME', 'HOOD', 'HOOF', 'HOOK', 'HOOP', 'HOOT', 'HOPE', 'HORN', 'HOSE',
  'HOST', 'HOUR', 'HOWL', 'HUES', 'HUGE', 'HULL', 'HUMP', 'HUNT', 'HURL', 'HUSH',
  'HUSK', 'HYMN',
  // I
  'IBIS', 'ICED', 'ICON', 'IDEA', 'IDOL', 'INCH', 'INKS', 'IRIS', 'IRON', 'ITCH',
  'ITEM',
  // J
  'JADE', 'JAIL', 'JAMS', 'JARS', 'JAZZ', 'JEEP', 'JEST', 'JETS', 'JIGS', 'JOBS',
  'JOGS', 'JOIN', 'JOKE', 'JOLT', 'JUDO', 'JUMP', 'JUNK', 'JURY',
  // K
  'KALE', 'KEEL', 'KEEN', 'KEEP', 'KELP', 'KEYS', 'KICK', 'KILN', 'KIND', 'KING',
  'KISS', 'KITE', 'KIWI', 'KNEE', 'KNIT', 'KNOB', 'KNOT',
  // L
  'LACE', 'LADY', 'LAIR', 'LAKE', 'LAMB', 'LAMP', 'LAND', 'LANE', 'LARK', 'LASH',
  'LAVA', 'LAWN', 'LAZY', 'LEAF', 'LEAK', 'LEAN', 'LEAP', 'LEGS', 'LENS', 'LICK',
  'LIFE', 'LIFT', 'LIMB', 'LIME', 'LIMP', 'LINE', 'LINK', 'LINT', 'LION', 'LIPS',
  'LIST', 'LOAD', 'LOAF', 'LOAN', 'LOBE', 'LOCK', 'LOFT', 'LOGO', 'LOGS', 'LONG',
  'LOOM', 'LOOP', 'LOOT', 'LORD', 'LORE', 'LOUD', 'LOVE', 'LUCK', 'LULL', 'LUMP',
  'LUNG', 'LURE', 'LUSH', 'LUTE',
  // M
  'MAGE', 'MAIL', 'MAKE', 'MALL', 'MALT', 'MANE', 'MAPS', 'MARE', 'MARK', 'MASH',
  'MASK', 'MAST', 'MATE', 'MATH', 'MAZE', 'MEAL', 'MEAT', 'MELT', 'MEMO', 'MEND',
  'MENU', 'MESH', 'MESS', 'MICE', 'MILD', 'MILE', 'MILK', 'MILL', 'MIME', 'MIND',
  'MINE', 'MINT', 'MIST', 'MITE', 'MOAT', 'MOCK', 'MODE', 'MOLD', 'MOLE', 'MOLT',
  'MONK', 'MOOD', 'MOON', 'MOOR', 'MOPS', 'MOSS', 'MOTH', 'MOVE', 'MULE', 'MUSE',
  'MUSH', 'MUTE', 'MYTH',
  // N
  'NAIL', 'NAME', 'NAPS', 'NAVY', 'NEAT', 'NEON', 'NEST', 'NEWT', 'NICE', 'NINE',
  'NODE', 'NOOK', 'NOON', 'NOPE', 'NOSE', 'NOTE', 'NOUN', 'NUMB',
  // O
  'OAKS', 'OATH', 'OATS', 'OBEY', 'ODDS', 'OGRE', 'OILS', 'OKAY', 'OMEN', 'OOZE',
  'OPAL', 'OPEN', 'OPUS', 'ORAL', 'ORCA', 'OVAL', 'OVEN', 'OWLS',
  // P
  'PACE', 'PACK', 'PACT', 'PAGE', 'PAIL', 'PAIR', 'PALE', 'PALM', 'PANS', 'PARK',
  'PATH', 'PAVE', 'PAWN', 'PEAK', 'PEAR', 'PEAS', 'PECK', 'PEEK', 'PEEL', 'PEEP',
  'PELT', 'PERK', 'PEST', 'PICK', 'PIER', 'PIGS', 'PIKE', 'PILE', 'PINE', 'PINK',
  'PINS', 'PINT', 'PIPE', 'PITA', 'PLAN', 'PLAY', 'PLEA', 'PLOT', 'PLOW', 'PLUG',
  'PLUM', 'POEM', 'POET', 'POKE', 'POLE', 'POLL', 'POND', 'PONY', 'POOL', 'POPS',
  'PORK', 'PORT', 'POSE', 'POUR', 'PREP', 'PREY', 'PROP', 'PUCK', 'PUFF', 'PULL',
  'PULP', 'PUMA', 'PUMP', 'PUNK', 'PUNT', 'PURE', 'PUSH',
  // Q
  'QUAD', 'QUIP', 'QUIT', 'QUIZ',
  // R
  'RACE', 'RACK', 'RAFT', 'RAGE', 'RAIL', 'RAIN', 'RAKE', 'RAMP', 'RANK', 'RANT',
  'RARE', 'RASH', 'RATE', 'RAVE', 'RAYS', 'READ', 'REAP', 'REED', 'REEF', 'REEL',
  'REIN', 'RELY', 'RENT', 'REST', 'RICE', 'RICH', 'RIDE', 'RIFT', 'RIND', 'RING',
  'RINK', 'RIOT', 'RIPE', 'RISE', 'RISK', 'ROAD', 'ROAM', 'ROAR', 'ROBE', 'ROCK',
  'ROLE', 'ROLL', 'ROOF', 'ROOK', 'ROOM', 'ROOT', 'ROPE', 'ROSE', 'ROVE', 'RUBY',
  'RUDE', 'RUGS', 'RUIN', 'RULE', 'RUNG', 'RUNS', 'RUSE', 'RUSH', 'RUST',
  // S
  'SAFE', 'SAGA', 'SAGE', 'SAIL', 'SALT', 'SAND', 'SASH', 'SAVE', 'SCAN', 'SCAR',
  'SEAL', 'SEAM', 'SEAT', 'SEED', 'SEEK', 'SELF', 'SELL', 'SEND', 'SHED', 'SHIN',
  'SHIP', 'SHOE', 'SHOP', 'SHOT', 'SHOW', 'SICK', 'SIDE', 'SIFT', 'SIGH', 'SIGN',
  'SILK', 'SILO', 'SING', 'SINK', 'SITE', 'SIZE', 'SKID', 'SKIM', 'SKIP', 'SKIT',
  'SLAB', 'SLAM', 'SLED', 'SLIM', 'SLIP', 'SLOT', 'SLOW', 'SLUG', 'SNAG', 'SNAP',
  'SNIP', 'SNOW', 'SOAK', 'SOAP', 'SOAR', 'SOCK', 'SODA', 'SOFA', 'SOFT', 'SOIL',
  'SOLO', 'SONG', 'SORT', 'SOUP', 'SOUR', 'SPAN', 'SPAR', 'SPIN', 'SPOT', 'SPUR',
  'STAG', 'STAR', 'STEM', 'STEP', 'STEW', 'STIR', 'STOP', 'STOW', 'STUB', 'STUD',
  'STUN', 'SUIT', 'SURF', 'SWAN', 'SWAP', 'SWAY', 'SWIM',
  // T
  'TACK', 'TACO', 'TAIL', 'TAKE', 'TALE', 'TALK', 'TALL', 'TAME', 'TANK', 'TAPE',
  'TAPS', 'TART', 'TASK', 'TEAL', 'TEAM', 'TECH', 'TEND', 'TENT', 'TERM', 'TEST',
  'TEXT', 'THAW', 'THUD', 'TICK', 'TIDE', 'TIDY', 'TIER', 'TILE', 'TILT', 'TIME',
  'TINT', 'TINY', 'TIPS', 'TIRE', 'TOAD', 'TOES', 'TOFU', 'TOIL', 'TOLL', 'TOMB',
  'TONE', 'TONS', 'TOOL', 'TOOT', 'TORN', 'TOSS', 'TOUR', 'TOWN', 'TRAM', 'TRAP',
  'TRAY', 'TREE', 'TREK', 'TRIM', 'TRIO', 'TRIP', 'TROT', 'TRUE', 'TUBA', 'TUBE',
  'TUCK', 'TUFT', 'TUNA', 'TUNE', 'TURF', 'TURN', 'TUSK', 'TWIG', 'TWIN', 'TYPE',
  // U
  'UGLY', 'UNDO', 'UNIT', 'URGE', 'URNS', 'USER',
  // V
  'VALE', 'VANE', 'VANS', 'VASE', 'VAST', 'VEAL', 'VEIL', 'VEIN', 'VENT', 'VERB',
  'VEST', 'VETO', 'VIBE', 'VIEW', 'VINE', 'VISA', 'VOID', 'VOLT', 'VOTE', 'VOWS',
  // W
  'WADE', 'WAGE', 'WAIL', 'WAKE', 'WALK', 'WALL', 'WAND', 'WANE', 'WARD', 'WARM',
  'WARN', 'WARP', 'WART', 'WASH', 'WASP', 'WAVE', 'WAVY', 'WAXY', 'WEAK', 'WEAR',
  'WEED', 'WEEK', 'WELD', 'WELL', 'WEST', 'WHIM', 'WHIP', 'WHIZ', 'WICK', 'WIDE',
  'WILD', 'WIND', 'WINE', 'WING', 'WINK', 'WIPE', 'WIRE', 'WISE', 'WISH', 'WISP',
  'WOLF', 'WOOD', 'WOOL', 'WORD', 'WORK', 'WORM', 'WOVE', 'WRAP', 'WREN',
  // Y / Z
  'YARD', 'YARN', 'YAWN', 'YEAR', 'YELL', 'YELP', 'YOGA', 'YOKE', 'YOLK', 'YOWL',
  'ZANY', 'ZEAL', 'ZERO', 'ZEST', 'ZINC', 'ZONE', 'ZOOM',
];
