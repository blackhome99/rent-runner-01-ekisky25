// RENT RUNNER — i18n: all in-game text lives here so the story stays original
// and consistent. English only in v1; the table is ready for more locales.
export const STRINGS = {
  en: {
    title: 'RENT RUNNER',
    tagline: 'Your agent covers your rent — one bounty at a time.',
    rentDue: 'RENT DUE',
    cash: 'CASH',
    health: 'HEALTH',
    wantedTitles: [
      '', 'Suspicious — one patrol watching',
      'Chased — patrol cars closing in',
      'Roadblocks up — Moderators on every corner',
      'Helicopter overhead — stay out of sight',
      'Full lockdown — the whole city is hunting you',
    ],
    districts: {
      west: 'DERMAGA BARAT', east: 'PASAR TIMUR', north: 'BUKIT NEON',
      south: 'PANTAI SENJA', center: 'ALUN-ALUN KOTA', harbor: 'PELABUHAN',
    },
    missions: [
      { id: 1, name: 'FIRST DELIVERY', pay: 120, kind: 'delivery',
        brief: 'Mara needs a parcel run from Dock 7 to the corner shop on Pasar Timur. Keep it quiet — rent is due tonight.',
        objective: 'Pick up the parcel at Dock 7, then deliver it to the corner shop.' },
      { id: 2, name: 'TAXI FOR THE TIDE', pay: 160, kind: 'delivery',
        brief: 'A singer missed her ferry. Drive her from the harbor to the beach stage before the show starts.',
        objective: 'Pick up the singer at the harbor, drive her to Pantai Senja stage.' },
      { id: 3, name: 'STREET SPRINT', pay: 220, kind: 'race',
        brief: 'The midnight sprint is on. Beat three modded rivals around the harbor loop — winner takes the pot.',
        objective: 'Win the street race around the harbor loop (3 laps).' },
      { id: 4, name: 'REPO RUN', pay: 260, kind: 'repo',
        brief: 'A debtor skipped town. Repo his sports car from the Bukit Neon garage and bring it to the yard.',
        objective: 'Steal the target sports car and deliver it to the repo yard.' },
      { id: 5, name: 'THE LONG NIGHT', pay: 320, kind: 'delivery',
        brief: 'Three drops, one night, no questions. The Moderators are out in force — stay off the main roads.',
        objective: 'Complete all three drops across the city.' },
      { id: 6, name: 'HARBOUR HEIST', pay: 450, kind: 'heist',
        brief: 'A cash courier van parks at the docks every dusk. Take it — but the whole city will answer.',
        objective: 'Rob the courier van at the docks, then lose the heat.' },
      { id: 7, name: 'GRAND SPRINT', pay: 520, kind: 'race',
        brief: 'The Grand Sprint crosses every district. Five rivals, one trophy, and a rent payment riding on it.',
        objective: 'Win the Grand Sprint (4 laps, 5 rivals).' },
      { id: 8, name: 'RENT OR RUN', pay: 800, kind: 'heist',
        brief: 'The landlord sent enforcers to the safehouse. Hold them off, pay the rent in full — and own your morning.',
        objective: 'Survive the enforcer ambush, then pay the rent at the safehouse.' },
    ],
    dialogue: {
      intro: [
        ['MARA — DISPATCHER', 'Dimas. Rent is due at midnight and the landlord does not do extensions. The job board is full — pick a bounty and move.'],
        ['DIMAS', 'One bounty at a time. That is how the rent gets paid.'],
        ['MARA — DISPATCHER', 'And Dimas — if the Moderators light you up, break line of sight. They cannot chase what they cannot see.'],
      ],
      rentPaid: [
        ['MARA — DISPATCHER', 'Rent paid. The landlord is quiet for one more day. Sleep at the safehouse when you are ready — tomorrow starts earlier.'],
      ],
      busted: 'The Moderators caught up with you. Your cash took a hit, but the safehouse still stands. Get back out there.',
      wasted: 'You went down in the streets of Rent Harbor. The safehouse crew dragged you home — minus some cash.',
    },
    radioStations: [
      { name: 'RADIO HARBOR 97.4', tracks: ['Neon Tide — Sunset Run', 'Palm Static — Harbor Lights', 'Modem Hearts — Rent Day'] },
      { name: 'KOSAN FM 88.1', tracks: ['The Landlords — Pay Up', 'Dimas Blues — Eviction Notice', 'Street Choir — One More Day'] },
      { name: 'MODERATOR BAND 101', tracks: ['Sirens — Official Bulletin', 'Patrol Beat — Night Shift', 'Helicopter Hum — Searchlight'] },
    ],
    shopItems: [
      { id: 'medkit', name: 'Medkit', desc: 'Restores 50 health on the spot.', price: 40 },
      { id: 'armor', name: 'Street Armor', desc: 'Halves damage for the rest of the day.', price: 120 },
      { id: 'ammo', name: 'AK-47 Ammo', desc: '+120 rounds for your rifle.', price: 60 },
      { id: 'repair', name: 'Car Repair', desc: 'Fully repairs your current car.', price: 80 },
      { id: 'snack', name: 'Harbor Snack', desc: 'Restores 15 health. Tastes like the sea.', price: 10 },
    ],
  },
};
export const T = STRINGS.en;
export const DISTRICT_LABEL = {
  west: 'DERMAGA BARAT', east: 'PASAR TIMUR', north: 'BUKIT NEON',
  south: 'PANTAI SENJA', center: 'ALUN-ALUN KOTA', harbor: 'PELABUHAN',
};
