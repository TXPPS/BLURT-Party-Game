/**
 * BLURT — classic name pools.
 *
 * These are *parts*, not names. `shared/nameGenerator.ts` slots them into templates,
 * which is why a few hundred words here produce five figures' worth of names, and why
 * adding one adjective adds dozens more.
 *
 * Tone target: a person you would not leave alone with a forklift. Suspicious Gary.
 * Turbo Brenda. Municipal Possum. Nothing here targets anybody real.
 *
 * Keep entries short — the display limit is 20 characters *including the space*, so a
 * 13-character word can only ever pair with a 6-character one. `pnpm lint:content`
 * reports how many combinations actually survive that filter.
 */

import type { NamePoolsData } from '../schema.js';

export const classicNamePools: NamePoolsData = {
  modifier: [
    'Suspicious', 'Turbo', 'Disco', 'Unlicensed', 'Feral', 'Deluxe', 'Emergency',
    'Reluctant', 'Haunted', 'Damp', 'Sudden', 'Retired', 'Discount', 'Vengeful',
    'Wholesome', 'Nocturnal', 'Bewildered', 'Tactical', 'Casual', 'Forbidden',
    'Municipal', 'Unhinged', 'Sentient', 'Anonymous', 'Pungent', 'Bootleg',
    'Feisty', 'Clammy', 'Wistful', 'Immortal', 'Bargain', 'Crispy', 'Vintage',
    'Improper', 'Unstable', 'Ambitious', 'Slightly', 'Barely', 'Chaotic', 'Sacred',
    'Cursed', 'Beloved', 'Hostile', 'Grumpy', 'Sneaky', 'Offbrand', 'Ceremonial',
    'Aggressive', 'Radioactive', 'Semi', 'Fully', 'Wandering', 'Unbothered',
    'Notorious', 'Freelance',
  ],
  title: [
    'Captain', 'Professor', 'Doctor', 'Sergeant', 'Mayor', 'Baron', 'Duchess',
    'Chef', 'Officer', 'Coach', 'Reverend', 'Admiral', 'Judge', 'Sheriff',
    'Wizard', 'Warden', 'Colonel', 'Bishop', 'Deacon', 'Uncle', 'Auntie',
    'Grandma', 'Grandpa', 'Lady', 'Sir', 'Madam', 'Inspector', 'Detective',
    'Marshal', 'Prince', 'Nurse', 'Councillor',
  ],
  given: [
    'Gary', 'Brenda', 'Steve', 'Doug', 'Sharon', 'Terry', 'Deborah', 'Kevin',
    'Linda', 'Barry', 'Susan', 'Wayne', 'Janet', 'Craig', 'Denise', 'Neil',
    'Pauline', 'Colin', 'Maureen', 'Trevor', 'Bev', 'Nigel', 'Sandra', 'Dennis',
    'Carol', 'Roger', 'Gladys', 'Herb', 'Mildred', 'Norman', 'Beryl', 'Clive',
    'Enid', 'Keith', 'Doreen', 'Malcolm', 'Yvonne', 'Graham', 'Sheila', 'Lionel',
    'Agnes', 'Randy', 'Bonnie', 'Chuck', 'Wanda', 'Duane', 'Loretta', 'Marv',
    'Phyllis', 'Stan', 'Ethel', 'Vern', 'Gwen', 'Dale', 'Rhonda', 'Cliff',
    'Marge', 'Hank', 'Peggy', 'Ivan',
  ],
  noun: [
    'Grandma', 'Disaster', 'Situation', 'Incident', 'Vengeance', 'Nonsense',
    'Mayhem', 'Trouble', 'Anomaly', 'Regret', 'Business', 'Energy', 'Paperwork',
    'Ambition', 'Chaos', 'Tragedy', 'Justice', 'Mystery', 'Scandal', 'Wisdom',
    'Panic', 'Silence', 'Thunder', 'Static', 'Drama', 'Rumour', 'Legend',
    'Menace', 'Hazard', 'Ruckus', 'Gossip', 'Mischief', 'Turmoil', 'Fiasco',
    'Debacle', 'Ordeal', 'Verdict', 'Motive', 'Agenda', 'Protocol', 'Overtime',
    'Weekend', 'Monday', 'Breakfast', 'Karaoke', 'Bingo', 'Casserole', 'Vibes',
    'Consent', 'Momentum',
  ],
  animal: [
    'Raccoon', 'Possum', 'Goose', 'Pelican', 'Ferret', 'Badger', 'Weasel',
    'Otter', 'Llama', 'Emu', 'Ostrich', 'Walrus', 'Gecko', 'Newt', 'Toad',
    'Crow', 'Magpie', 'Heron', 'Vulture', 'Moose', 'Bison', 'Donkey', 'Hamster',
    'Gerbil', 'Wombat', 'Platypus', 'Hedgehog', 'Mongoose', 'Meerkat', 'Lemur',
    'Tapir', 'Manatee', 'Narwhal', 'Puffin', 'Pigeon', 'Seagull', 'Squirrel',
    'Beaver', 'Mole', 'Skunk', 'Sloth', 'Alpaca', 'Capybara', 'Stoat', 'Shrew',
  ],
  food: [
    'Meatball', 'Pickles', 'Gravy', 'Custard', 'Bratwurst', 'Nugget', 'Waffle',
    'Crumpet', 'Dumpling', 'Sardine', 'Marzipan', 'Pudding', 'Trifle',
    'Coleslaw', 'Bisque', 'Fondue', 'Gherkin', 'Pretzel', 'Baguette', 'Hummus',
    'Falafel', 'Toastie', 'Chowder', 'Ravioli', 'Gnocchi', 'Brisket', 'Sausage',
    'Mustard', 'Ketchup', 'Wasabi', 'Tapioca', 'Nougat', 'Biscotti', 'Sorbet',
    'Risotto', 'Paprika', 'Anchovy', 'Cabbage', 'Beetroot', 'Parsnip', 'Rhubarb',
    'Lasagna', 'Crouton', 'Jellybean', 'Marmalade',
  ],
  object: [
    'Toaster', 'Mop', 'Ladder', 'Kettle', 'Stapler', 'Doorknob', 'Bucket',
    'Wrench', 'Radiator', 'Mattress', 'Umbrella', 'Trombone', 'Bagpipes',
    'Harpoon', 'Anvil', 'Spatula', 'Blender', 'Vacuum', 'Hosepipe', 'Trolley',
    'Sandbag', 'Gearbox', 'Flagpole', 'Doorbell', 'Lampshade', 'Sundial',
    'Kazoo', 'Zamboni', 'Forklift', 'Crowbar', 'Beanbag', 'Birdbath', 'Postbox',
    'Snowglobe', 'Bunkbed', 'Metronome', 'Lawnmower', 'Accordion', 'Trampoline',
    'Wheelbarrow', 'Chandelier', 'Tambourine', 'Barstool', 'Skateboard', 'Kayak',
  ],
  occupation: [
    'Plumber', 'Barista', 'Notary', 'Dentist', 'Bailiff', 'Ferryman', 'Goatherd',
    'Hypnotist', 'Janitor', 'Lifeguard', 'Magician', 'Mime', 'Optician',
    'Referee', 'Sommelier', 'Surveyor', 'Tailor', 'Trucker', 'Usher', 'Vicar',
    'Welder', 'Wrangler', 'Butler', 'Courier', 'Farrier', 'Cobbler', 'Milkman',
    'Bouncer', 'Barber', 'Stuntman', 'Locksmith', 'Beekeeper', 'Zookeeper',
    'Puppeteer', 'Undertaker', 'Auctioneer', 'Taxidermist', 'Archivist',
    'Bellhop', 'Sculptor',
  ],
  adjective: [
    'Damp', 'Feral', 'Sticky', 'Loud', 'Smug', 'Angry', 'Sleepy', 'Nervous',
    'Bald', 'Hungry', 'Fancy', 'Crusty', 'Silky', 'Tiny', 'Enormous', 'Rubber',
    'Ancient', 'Illegal', 'Wireless', 'Fragrant', 'Bewitched', 'Screaming',
    'Reversed', 'Slippery', 'Certified', 'Unofficial', 'Emeritus', 'Honorary',
    'Interim', 'Deputy', 'Junior', 'Senior', 'Rogue', 'Rabid', 'Glorious',
    'Moist', 'Velvet', 'Concrete', 'Furious', 'Dizzy', 'Lopsided', 'Rusty',
    'Wobbly', 'Prickly', 'Frantic', 'Regal', 'Humble', 'Vacant', 'Bloated',
    'Sparkling',
  ],
};

export default classicNamePools;
