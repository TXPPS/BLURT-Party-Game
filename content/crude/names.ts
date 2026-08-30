/**
 * BLURT — crude name pools.
 *
 * Loaded ONLY when a room is in Crude mode. This module is a separate chunk so that
 * players who never turn Crude on never download a byte of it.
 *
 * Register: juvenile, vulgar, gross-out, bathroom-wall. The joke is always absurdity
 * or the speaker's own dignity — never a group of people. Every entry still goes
 * through `shared/blocklist.ts`, both alone and concatenated with its partner, so an
 * accidental hateful pairing cannot ship. See CONTENT_GUIDE.md → "Crude boundaries".
 *
 * In play these are *merged with* the classic pools, so Crude mode still produces the
 * occasional Suspicious Gary between the Moist Trumpet and the Filthy Beekeeper.
 */

import type { NamePoolsData } from '../schema.js';

export const crudeNamePools: NamePoolsData = {
  modifier: [
    'Filthy', 'Crusty', 'Sweaty', 'Unwashed', 'Rancid', 'Flatulent', 'Greasy',
    'Leaking', 'Nude', 'Chafed', 'Weeping', 'Swampy', 'Clenched', 'Soggy',
    'Blotchy', 'Trouserless', 'Bloated', 'Reeking', 'Slimy', 'Undercooked',
    'Wet', 'Dripping', 'Barefoot', 'Crumbling', 'Sticky',
  ],
  title: [
    'Lord', 'Baroness', 'Sultan', 'Pope', 'Duke', 'General', 'Comrade', 'Boss',
    'Chairman', 'Guru', 'Prophet', 'Sensei', 'Emperor', 'Overlord',
  ],
  given: [
    'Chad', 'Brayden', 'Deshawn', 'Gunther', 'Wendel', 'Bort', 'Klaus', 'Hilda',
    'Bertha', 'Ludmila', 'Ferdinand', 'Beauregard', 'Cornelius', 'Reginald',
    'Wilhelmina', 'Gus', 'Merle', 'Delbert', 'Vonda', 'Earl',
  ],
  noun: [
    'Regret', 'Shame', 'Divorce', 'Bankruptcy', 'Hangover', 'Bloating',
    'Discharge', 'Odour', 'Rash', 'Blister', 'Stench', 'Gurgle', 'Spasm',
    'Malfunction', 'Incident', 'Leakage', 'Sputum', 'Belch', 'Wheeze', 'Grunt',
  ],
  animal: [
    'Slug', 'Maggot', 'Buzzard', 'Warthog', 'Baboon', 'Toad', 'Leech', 'Weasel',
    'Hyena', 'Sewerrat', 'Barnacle', 'Tapeworm', 'Cockroach', 'Bedbug', 'Pigeon',
    'Blobfish', 'Eel', 'Molerat',
  ],
  food: [
    'Bratwurst', 'Meatloaf', 'Kebab', 'Sausage', 'Bologna', 'Chalupa', 'Haggis',
    'Blancmange', 'Porkpie', 'Gravy', 'Trotter', 'Gizzard', 'Tripe', 'Lard',
    'Custard', 'Pudding', 'Sauerkraut', 'Beans', 'Chowder', 'Cheesecurd',
  ],
  object: [
    'Plunger', 'Bidet', 'Urinal', 'Nostril', 'Bucket', 'Loofah', 'Gusset',
    'Waistband', 'Speedo', 'Truss', 'Bedpan', 'Hosepipe', 'Nozzle', 'Bellows',
    'Trombone', 'Colander', 'Mop', 'Sock', 'Toupee', 'Waterbed',
  ],
  occupation: [
    'Bouncer', 'Nudist', 'Streaker', 'Wrestler', 'Gambler',
    'Poolboy', 'Trucker', 'Roadie', 'Bookie', 'Grifter', 'Bailiff', 'Plumber',
    'Exorcist', 'Undertaker', 'Beekeeper', 'Chimneysweep', 'Masseuse',
  ],
  adjective: [
    'Moist', 'Chunky', 'Squelchy', 'Hairy', 'Lumpy', 'Throbbing', 'Bulging',
    'Musty', 'Fermented', 'Pungent', 'Discounted', 'Uninsured', 'Unsupervised',
    'Regrettable', 'Unflushed', 'Untucked', 'Feral', 'Clammy', 'Tepid',
    'Questionable', 'Wilting', 'Curdled', 'Gassy', 'Bristly',
  ],
};

export default crudeNamePools;
