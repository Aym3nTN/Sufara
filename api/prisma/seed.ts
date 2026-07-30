/**
 * Seed data for Sufara.
 *
 * Coordinates and visit durations are practical working values for the MVP.
 * `importanceScore` is deliberately editorial *data*, managed by administrators
 * — the recommendation engine never hardcodes religious or historical
 * judgements, it only reads this column. Scores here should be reviewed against
 * verified sources before any public launch.
 */
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const CATEGORIES = [
  { key: 'MOSQUE', name: 'Mosque', icon: 'mosque', colorHex: '#1F6F54', sortOrder: 1 },
  { key: 'HISTORICAL_SITE', name: 'Historical Site', icon: 'landmark', colorHex: '#8A6A3B', sortOrder: 2 },
  { key: 'SHRINE_TOMB', name: 'Shrine / Tomb', icon: 'dome', colorHex: '#5C6E8A', sortOrder: 3 },
  { key: 'BATTLE_SITE', name: 'Battle Site', icon: 'swords', colorHex: '#9A5B3B', sortOrder: 4 },
  { key: 'MONUMENT', name: 'Monument', icon: 'monument', colorHex: '#6B7F5B', sortOrder: 5 },
  { key: 'MUSEUM', name: 'Museum', icon: 'museum', colorHex: '#4A6C8A', sortOrder: 6 },
  { key: 'RELIGIOUS_LANDMARK', name: 'Religious Landmark', icon: 'star', colorHex: '#2F7D62', sortOrder: 7 },
  { key: 'OTHER', name: 'Other', icon: 'place', colorHex: '#6B6B6B', sortOrder: 8 },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]['key'];

const COUNTRIES = [
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'TR', name: 'Türkiye' },
  { code: 'PS', name: 'Palestine' },
  { code: 'EG', name: 'Egypt' },
  { code: 'MA', name: 'Morocco' },
];

const CITIES = [
  { name: 'Madinah', countryCode: 'SA', latitude: 24.4686, longitude: 39.6142, timezone: 'Asia/Riyadh' },
  { name: 'Makkah', countryCode: 'SA', latitude: 21.4225, longitude: 39.8262, timezone: 'Asia/Riyadh' },
  { name: 'Istanbul', countryCode: 'TR', latitude: 41.0082, longitude: 28.9784, timezone: 'Europe/Istanbul' },
  { name: 'Jerusalem', countryCode: 'PS', latitude: 31.7767, longitude: 35.2345, timezone: 'Asia/Hebron' },
  { name: 'Cairo', countryCode: 'EG', latitude: 30.0444, longitude: 31.2357, timezone: 'Africa/Cairo' },
  { name: 'Fez', countryCode: 'MA', latitude: 34.0331, longitude: -5.0003, timezone: 'Africa/Casablanca' },
];

interface SeedPlace {
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  primaryCategory: CategoryKey;
  categories?: CategoryKey[];
  shortDescription: string;
  description: string;
  estimatedVisitDurationMinutes: number;
  importanceScore: number;
  historicalPeriod?: string;
  religiousSignificance?: string;
}

const PLACES: SeedPlace[] = [
  // ---------------------------------------------------------------- Madinah
  {
    name: 'Al-Masjid an-Nabawi',
    city: 'Madinah',
    latitude: 24.4672,
    longitude: 39.6112,
    primaryCategory: 'MOSQUE',
    categories: ['MOSQUE', 'RELIGIOUS_LANDMARK', 'HISTORICAL_SITE'],
    shortDescription: 'The Prophet’s Mosque, built by the Prophet Muhammad ﷺ after the migration to Madinah.',
    description:
      'The Prophet’s Mosque was established by the Prophet Muhammad ﷺ in 622 CE, shortly after his arrival in Madinah. It began as an open enclosure of palm trunks and mud brick beside his home, and grew across fourteen centuries of expansion into one of the largest mosques in the world. It contains the Rawdah, the Green Dome, and the chamber where the Prophet ﷺ is buried alongside Abu Bakr and Umar. Visitors should allow extra time for entry, prayer and the movement of large crowds around prayer times.',
    estimatedVisitDurationMinutes: 60,
    importanceScore: 100,
    historicalPeriod: 'Early Islamic (1 AH / 622 CE)',
    religiousSignificance: 'The second holiest mosque in Islam and the burial place of the Prophet Muhammad ﷺ.',
  },
  {
    name: 'Quba Mosque',
    city: 'Madinah',
    latitude: 24.4392,
    longitude: 39.6172,
    primaryCategory: 'MOSQUE',
    categories: ['MOSQUE', 'HISTORICAL_SITE'],
    shortDescription: 'The first mosque built in Islam, founded by the Prophet Muhammad ﷺ on his arrival in Madinah.',
    description:
      'Quba was the first mosque established in Islam, founded by the Prophet Muhammad ﷺ in 622 CE during the first days of the migration, before he entered Madinah itself. It has been rebuilt and expanded many times, most recently into a large white complex of domes and courtyards. It is well known in hadith literature for the reward of praying two rak‘ahs there.',
    estimatedVisitDurationMinutes: 45,
    importanceScore: 92,
    historicalPeriod: 'Early Islamic (1 AH / 622 CE)',
    religiousSignificance: 'The first mosque of Islam; praying two rak‘ahs there is described in hadith as carrying the reward of an ‘umrah.',
  },
  {
    name: 'Masjid al-Qiblatayn',
    city: 'Madinah',
    latitude: 24.4842,
    longitude: 39.5786,
    primaryCategory: 'MOSQUE',
    categories: ['MOSQUE', 'HISTORICAL_SITE'],
    shortDescription: 'The Mosque of the Two Qiblas, where the direction of prayer turned towards Makkah.',
    description:
      'It was here, during a congregational prayer in 2 AH, that the revelation came changing the qibla from Jerusalem to the Ka‘bah in Makkah, and the congregation turned mid-prayer. The mosque preserved two prayer niches for centuries; the modern rebuilding retains a single qibla facing Makkah while commemorating the event.',
    estimatedVisitDurationMinutes: 30,
    importanceScore: 85,
    historicalPeriod: 'Early Islamic (2 AH / 624 CE)',
    religiousSignificance: 'Marks the change of the qibla, one of the defining moments of the Madinan period.',
  },
  {
    name: 'Mount Uhud & the Martyrs’ Cemetery',
    city: 'Madinah',
    latitude: 24.5045,
    longitude: 39.6142,
    primaryCategory: 'BATTLE_SITE',
    categories: ['BATTLE_SITE', 'HISTORICAL_SITE'],
    shortDescription: 'The battlefield of Uhud and the resting place of Hamza ibn Abd al-Muttalib and the martyrs.',
    description:
      'Mount Uhud rises north of Madinah and gives its name to the battle fought at its foot in 3 AH. At the base of the mountain lies the cemetery of the martyrs of Uhud, including the Prophet’s ﷺ uncle Hamza ibn Abd al-Muttalib. Nearby stands the small hill of the archers, whose position decided the course of the battle. The site is open ground — plan for walking and, in summer, for heat.',
    estimatedVisitDurationMinutes: 45,
    importanceScore: 88,
    historicalPeriod: 'Early Islamic (3 AH / 625 CE)',
    religiousSignificance: 'Burial place of the martyrs of Uhud; the mountain is described in hadith as a mountain that loves us and that we love.',
  },
  {
    name: 'Jannat al-Baqi',
    city: 'Madinah',
    latitude: 24.4664,
    longitude: 39.6139,
    primaryCategory: 'SHRINE_TOMB',
    categories: ['SHRINE_TOMB', 'HISTORICAL_SITE'],
    shortDescription: 'The principal cemetery of Madinah, resting place of many companions and family of the Prophet ﷺ.',
    description:
      'Al-Baqi lies immediately east of the Prophet’s Mosque and has been the cemetery of Madinah since the earliest days of Islam. Many of the Prophet’s ﷺ family and thousands of his companions are buried here. Visiting hours are limited and access rules differ for men and women, so check locally before planning a stop.',
    estimatedVisitDurationMinutes: 25,
    importanceScore: 84,
    historicalPeriod: 'Early Islamic onwards',
  },
  {
    name: 'Masjid al-Ghamama',
    city: 'Madinah',
    latitude: 24.4675,
    longitude: 39.6096,
    primaryCategory: 'MOSQUE',
    categories: ['MOSQUE', 'HISTORICAL_SITE'],
    shortDescription: 'Ottoman-era mosque marking the site where the Prophet ﷺ is said to have prayed for rain.',
    description:
      'A short walk south-west of the Prophet’s Mosque, Masjid al-Ghamama — the Mosque of the Cloud — marks the musalla where the Prophet ﷺ prayed the ‘Eid prayer and, by tradition, the prayer for rain. The present building is Ottoman, in grey basalt with six domes, and is a good example of the older architectural fabric of central Madinah.',
    estimatedVisitDurationMinutes: 20,
    importanceScore: 62,
    historicalPeriod: 'Ottoman (rebuilt), early Islamic site',
  },
  {
    name: 'Masjid al-Khandaq (Seven Mosques)',
    city: 'Madinah',
    latitude: 24.4859,
    longitude: 39.5978,
    primaryCategory: 'BATTLE_SITE',
    categories: ['BATTLE_SITE', 'MOSQUE', 'HISTORICAL_SITE'],
    shortDescription: 'The site of the Trench, where Madinah was defended during the Battle of al-Khandaq.',
    description:
      'On the western approach to Madinah, a cluster of small historic mosques marks the line of the trench dug in 5 AH on the advice of Salman al-Farisi to defend the city against the confederate armies. The small mosques were replaced by a large modern mosque complex, but the ground and the ridge of Sal‘ still make the defensive geography legible.',
    estimatedVisitDurationMinutes: 30,
    importanceScore: 74,
    historicalPeriod: 'Early Islamic (5 AH / 627 CE)',
  },
  {
    name: 'Masjid Abu Bakr as-Siddiq',
    city: 'Madinah',
    latitude: 24.4681,
    longitude: 39.6099,
    primaryCategory: 'MOSQUE',
    shortDescription: 'Small historic mosque near the Prophet’s Mosque, named after the first caliph.',
    description:
      'One of the small historic mosques of central Madinah, traditionally identified as a place where Abu Bakr as-Siddiq led the ‘Eid prayer during his caliphate. Its modest Ottoman-period form contrasts with the scale of the Prophet’s Mosque a few minutes away, and it is easily combined with Masjid al-Ghamama.',
    estimatedVisitDurationMinutes: 15,
    importanceScore: 52,
    historicalPeriod: 'Ottoman (rebuilt)',
  },
  {
    name: 'Dar al-Madinah Museum',
    city: 'Madinah',
    latitude: 24.4622,
    longitude: 39.6008,
    primaryCategory: 'MUSEUM',
    shortDescription: 'Museum of the history, geography and daily life of Madinah across its Islamic history.',
    description:
      'Dar al-Madinah presents the urban history of Madinah through models, manuscripts, archaeology and reconstructions — including a large model of the Prophet’s Mosque through its successive expansions. It is a good orientation stop early in a visit, giving context to the sites scattered across the modern city.',
    estimatedVisitDurationMinutes: 60,
    importanceScore: 58,
  },
  {
    name: 'Masjid al-Jumu‘ah',
    city: 'Madinah',
    latitude: 24.4525,
    longitude: 39.6162,
    primaryCategory: 'MOSQUE',
    categories: ['MOSQUE', 'HISTORICAL_SITE'],
    shortDescription: 'Where the Prophet ﷺ is reported to have led the first Friday prayer in Madinah.',
    description:
      'Between Quba and the centre of Madinah stands the Mosque of Friday, marking the valley where the Prophet ﷺ led the first Jumu‘ah prayer after leaving Quba for the city. The present small domed mosque dates from a late Ottoman rebuilding and sits conveniently on the route between Quba and the Prophet’s Mosque.',
    estimatedVisitDurationMinutes: 20,
    importanceScore: 66,
    historicalPeriod: 'Early Islamic (1 AH / 622 CE)',
  },
  {
    name: 'Wadi al-Aqiq',
    city: 'Madinah',
    latitude: 24.4478,
    longitude: 39.5622,
    primaryCategory: 'HISTORICAL_SITE',
    shortDescription: 'Historic valley west of Madinah, praised in early sources and lined with early estates.',
    description:
      'Wadi al-Aqiq runs west of Madinah and appears frequently in early Islamic literature as a blessed valley and a place of gardens and estates belonging to the companions and later Umayyad figures. Traces of historic wells, dams and palace ruins survive along its course.',
    estimatedVisitDurationMinutes: 30,
    importanceScore: 45,
  },
  {
    name: 'Al-Baida’ (Miqat Dhul Hulayfah)',
    city: 'Madinah',
    latitude: 24.4131,
    longitude: 39.5461,
    primaryCategory: 'RELIGIOUS_LANDMARK',
    categories: ['RELIGIOUS_LANDMARK', 'MOSQUE'],
    shortDescription: 'The miqat where pilgrims travelling from Madinah enter the state of ihram.',
    description:
      'Also known as Abyar Ali, Dhul Hulayfah is the appointed miqat for pilgrims setting out from Madinah towards Makkah. The large mosque complex on the site provides facilities for changing into ihram, and its history reaches back to the Prophet’s ﷺ own departure for the Farewell Pilgrimage.',
    estimatedVisitDurationMinutes: 30,
    importanceScore: 70,
    religiousSignificance: 'The miqat for pilgrims departing Madinah for hajj or ‘umrah.',
  },

  // ----------------------------------------------------------------- Makkah
  {
    name: 'Al-Masjid al-Haram',
    city: 'Makkah',
    latitude: 21.4225,
    longitude: 39.8262,
    primaryCategory: 'MOSQUE',
    categories: ['MOSQUE', 'RELIGIOUS_LANDMARK', 'HISTORICAL_SITE'],
    shortDescription: 'The Sacred Mosque surrounding the Ka‘bah, the qibla of the Muslim world.',
    description:
      'The Sacred Mosque encloses the Ka‘bah, the House first raised by Ibrahim and Isma‘il, towards which Muslims everywhere face in prayer. It contains the Black Stone, the Station of Ibrahim, the well of Zamzam and the mas‘a between Safa and Marwah. Expansions from the Umayyad period to the present have made it the largest mosque in the world.',
    estimatedVisitDurationMinutes: 120,
    importanceScore: 100,
    historicalPeriod: 'Pre-Islamic foundation; continuous Islamic expansion',
    religiousSignificance: 'The holiest site in Islam and the destination of hajj and ‘umrah.',
  },
  {
    name: 'Jabal an-Nour & the Cave of Hira',
    city: 'Makkah',
    latitude: 21.4577,
    longitude: 39.8617,
    primaryCategory: 'HISTORICAL_SITE',
    categories: ['HISTORICAL_SITE', 'RELIGIOUS_LANDMARK'],
    shortDescription: 'The mountain holding the cave where the first revelation of the Qur’an was received.',
    description:
      'The Mountain of Light rises north-east of Makkah and holds near its summit the small cave of Hira, where the Prophet Muhammad ﷺ used to retreat and where the first verses of the Qur’an were revealed. The climb is steep and takes well over an hour each way in hot conditions; plan it as a half-day undertaking rather than a quick stop.',
    estimatedVisitDurationMinutes: 150,
    importanceScore: 90,
    historicalPeriod: 'Pre-Hijrah (c. 610 CE)',
    religiousSignificance: 'Site of the first revelation of the Qur’an.',
  },
  {
    name: 'Jabal Thawr & the Cave of Thawr',
    city: 'Makkah',
    latitude: 21.3737,
    longitude: 39.8503,
    primaryCategory: 'HISTORICAL_SITE',
    shortDescription: 'The cave that sheltered the Prophet ﷺ and Abu Bakr during the migration to Madinah.',
    description:
      'South of Makkah, Jabal Thawr holds the cave in which the Prophet Muhammad ﷺ and Abu Bakr as-Siddiq took shelter for three nights at the start of the hijrah, an episode referred to in Surah at-Tawbah. As with Hira, the ascent is demanding and should be planned for cooler hours.',
    estimatedVisitDurationMinutes: 150,
    importanceScore: 80,
    historicalPeriod: 'Hijrah (1 AH / 622 CE)',
  },
  {
    name: 'Masjid Aisha (Masjid at-Tan‘im)',
    city: 'Makkah',
    latitude: 21.4470,
    longitude: 39.7770,
    primaryCategory: 'MOSQUE',
    categories: ['MOSQUE', 'RELIGIOUS_LANDMARK'],
    shortDescription: 'The nearest miqat to Makkah, used by residents entering ihram for ‘umrah.',
    description:
      'At Tan‘im, on the northern edge of the Haram boundary, this mosque marks the point from which A’ishah entered ihram for ‘umrah at the Prophet’s ﷺ instruction. It remains the most used miqat for those already in Makkah who wish to perform an additional ‘umrah.',
    estimatedVisitDurationMinutes: 30,
    importanceScore: 68,
    religiousSignificance: 'A miqat for ‘umrah for those inside the boundary of the Haram.',
  },
  {
    name: 'Masjid al-Jinn',
    city: 'Makkah',
    latitude: 21.4297,
    longitude: 39.8280,
    primaryCategory: 'MOSQUE',
    categories: ['MOSQUE', 'HISTORICAL_SITE'],
    shortDescription: 'Mosque marking where a group of jinn are said to have heard the Qur’an and believed.',
    description:
      'A short distance north of the Sacred Mosque, Masjid al-Jinn commemorates the event described in Surah al-Jinn, when a company of jinn listened to the Prophet ﷺ reciting the Qur’an and accepted it. The modern mosque is compact and easy to combine with a visit to the nearby Ma‘la cemetery.',
    estimatedVisitDurationMinutes: 20,
    importanceScore: 60,
  },
  {
    name: 'Jannat al-Mu‘alla',
    city: 'Makkah',
    latitude: 21.4308,
    longitude: 39.8299,
    primaryCategory: 'SHRINE_TOMB',
    shortDescription: 'The historic cemetery of Makkah, burial place of Khadijah bint Khuwaylid.',
    description:
      'Al-Mu‘alla has served as the cemetery of Makkah since before Islam. Khadijah bint Khuwaylid, the first wife of the Prophet ﷺ and the first to believe in his message, is buried here, along with members of the Banu Hashim and many early Muslims.',
    estimatedVisitDurationMinutes: 25,
    importanceScore: 72,
  },
  {
    name: 'Mount Arafat (Jabal ar-Rahmah)',
    city: 'Makkah',
    latitude: 21.3549,
    longitude: 39.9843,
    primaryCategory: 'HISTORICAL_SITE',
    categories: ['HISTORICAL_SITE', 'RELIGIOUS_LANDMARK'],
    shortDescription: 'The plain and hill where pilgrims stand on the ninth of Dhul Hijjah.',
    description:
      'The standing at Arafat is the essential rite of hajj. At the edge of the plain rises Jabal ar-Rahmah, the Mount of Mercy, near where the Prophet ﷺ delivered the Farewell Sermon. Outside the hajj season the plain is quiet and can be visited easily by road from Makkah.',
    estimatedVisitDurationMinutes: 45,
    importanceScore: 86,
    religiousSignificance: 'The standing at Arafat is the central rite of the hajj.',
  },
  {
    name: 'Mina',
    city: 'Makkah',
    latitude: 21.4133,
    longitude: 39.8933,
    primaryCategory: 'HISTORICAL_SITE',
    shortDescription: 'The valley of the hajj encampment and the Jamarat.',
    description:
      'Mina lies east of Makkah between the Sacred Mosque and Muzdalifah, and hosts pilgrims during the days of hajj. The Jamarat bridge, where the stoning takes place, dominates the valley, surrounded by the vast permanent tent city.',
    estimatedVisitDurationMinutes: 40,
    importanceScore: 76,
  },
  {
    name: 'Muzdalifah',
    city: 'Makkah',
    latitude: 21.3833,
    longitude: 39.9333,
    primaryCategory: 'HISTORICAL_SITE',
    shortDescription: 'The open plain where pilgrims spend the night between Arafat and Mina.',
    description:
      'Muzdalifah lies between Arafat and Mina, and pilgrims stop here on the night of the ninth of Dhul Hijjah, praying and gathering pebbles for the following day. Al-Mash‘ar al-Haram, mentioned in the Qur’an, stands at its edge.',
    estimatedVisitDurationMinutes: 30,
    importanceScore: 70,
  },

  // --------------------------------------------------------------- Istanbul
  {
    name: 'Hagia Sophia Grand Mosque',
    city: 'Istanbul',
    latitude: 41.0086,
    longitude: 28.9802,
    primaryCategory: 'MOSQUE',
    categories: ['MOSQUE', 'HISTORICAL_SITE', 'MONUMENT'],
    shortDescription: 'Sixth-century basilica turned imperial mosque, and a landmark of Ottoman Istanbul.',
    description:
      'Built by Justinian in 537 as the great church of Constantinople, Hagia Sophia became an imperial mosque after the conquest of the city in 1453, when Ottoman architects added minarets, mihrab, minbar and the vast calligraphic roundels that still hang beneath the dome. Its structure shaped Ottoman mosque architecture for centuries, most directly through Sinan.',
    estimatedVisitDurationMinutes: 60,
    importanceScore: 88,
    historicalPeriod: 'Byzantine 537 CE; Ottoman from 1453',
  },
  {
    name: 'Sultan Ahmed Mosque (Blue Mosque)',
    city: 'Istanbul',
    latitude: 41.0054,
    longitude: 28.9768,
    primaryCategory: 'MOSQUE',
    categories: ['MOSQUE', 'MONUMENT'],
    shortDescription: 'Early seventeenth-century imperial mosque famous for its İznik tilework and six minarets.',
    description:
      'Commissioned by Sultan Ahmed I and completed in 1617, the mosque takes its popular name from the more than twenty thousand blue İznik tiles lining its interior. It faces Hagia Sophia across a public square and remains an active congregational mosque; visiting hours are arranged around the five daily prayers.',
    estimatedVisitDurationMinutes: 45,
    importanceScore: 84,
    historicalPeriod: 'Ottoman (1609–1617)',
  },
  {
    name: 'Süleymaniye Mosque',
    city: 'Istanbul',
    latitude: 41.0165,
    longitude: 28.9639,
    primaryCategory: 'MOSQUE',
    categories: ['MOSQUE', 'HISTORICAL_SITE'],
    shortDescription: 'Mimar Sinan’s imperial complex for Suleiman the Magnificent, above the Golden Horn.',
    description:
      'Completed in 1557, the Süleymaniye is the masterwork of the architect Mimar Sinan and the centre of a complete külliye: madrasas, a hospital, kitchens, baths and a caravanserai. The tombs of Suleiman the Magnificent and Hurrem Sultan stand in the garden, and Sinan’s own modest tomb is just outside the wall.',
    estimatedVisitDurationMinutes: 50,
    importanceScore: 86,
    historicalPeriod: 'Ottoman (1550–1557)',
  },
  {
    name: 'Eyüp Sultan Mosque',
    city: 'Istanbul',
    latitude: 41.0478,
    longitude: 28.9336,
    primaryCategory: 'MOSQUE',
    categories: ['MOSQUE', 'SHRINE_TOMB'],
    shortDescription: 'Mosque and tomb of Abu Ayyub al-Ansari, companion and host of the Prophet ﷺ in Madinah.',
    description:
      'Built immediately after the conquest of Constantinople at the reputed burial place of Abu Ayyub al-Ansari, who hosted the Prophet ﷺ on his arrival in Madinah and died during the seventh-century siege of the city. The mosque and its tomb became the most visited place of ziyarat in Istanbul and the site where Ottoman sultans were girded with the sword on accession.',
    estimatedVisitDurationMinutes: 45,
    importanceScore: 82,
    historicalPeriod: 'Ottoman (from 1458)',
  },
  {
    name: 'Topkapı Palace — Chamber of the Sacred Relics',
    city: 'Istanbul',
    latitude: 41.0115,
    longitude: 28.9833,
    primaryCategory: 'MUSEUM',
    categories: ['MUSEUM', 'HISTORICAL_SITE'],
    shortDescription: 'Ottoman palace holding the Sacred Trusts, including relics attributed to the Prophet ﷺ.',
    description:
      'Topkapı served as the Ottoman court for almost four centuries. Its Chamber of the Sacred Relics holds the Sacred Trusts brought to Istanbul after the Ottoman assumption of the caliphate, and the Qur’an has been recited there without interruption for centuries. The palace as a whole is large; allow additional time if you intend to see more than the relics.',
    estimatedVisitDurationMinutes: 90,
    importanceScore: 78,
    historicalPeriod: 'Ottoman (1460s onwards)',
  },
  {
    name: 'Fatih Mosque',
    city: 'Istanbul',
    latitude: 41.0192,
    longitude: 28.9497,
    primaryCategory: 'MOSQUE',
    categories: ['MOSQUE', 'SHRINE_TOMB'],
    shortDescription: 'The mosque complex of Mehmed II, the conqueror of Constantinople, and his tomb.',
    description:
      'The first great imperial foundation after the conquest, the Fatih complex was built between 1463 and 1470 on the fourth hill of the city and rebuilt after the earthquake of 1766. Sultan Mehmed II is buried in the tomb behind the qibla wall, and the surrounding quarter still carries the character of the külliye that shaped it.',
    estimatedVisitDurationMinutes: 40,
    importanceScore: 74,
    historicalPeriod: 'Ottoman (1463–1470)',
  },
  {
    name: 'Rüstem Pasha Mosque',
    city: 'Istanbul',
    latitude: 41.0169,
    longitude: 28.9702,
    primaryCategory: 'MOSQUE',
    shortDescription: 'A small Sinan mosque above the markets, covered almost entirely in İznik tiles.',
    description:
      'Hidden on a terrace above the bustle of the Eminönü markets, this compact mosque built by Sinan for the grand vizier Rüstem Pasha carries perhaps the finest concentration of İznik tilework in Istanbul. Its scale makes it a quick and rewarding stop between larger sites.',
    estimatedVisitDurationMinutes: 25,
    importanceScore: 64,
    historicalPeriod: 'Ottoman (1561–1563)',
  },
  {
    name: 'Kariye Mosque (Chora)',
    city: 'Istanbul',
    latitude: 41.0311,
    longitude: 28.9394,
    primaryCategory: 'HISTORICAL_SITE',
    categories: ['HISTORICAL_SITE', 'MOSQUE', 'MONUMENT'],
    shortDescription: 'Byzantine church converted to a mosque, near the land walls of the city.',
    description:
      'Standing near the Theodosian land walls, the Chora building was converted into a mosque in the early sixteenth century by Atik Ali Pasha. It is celebrated for its late Byzantine mosaics and frescoes and for the layered history visible in a single structure.',
    estimatedVisitDurationMinutes: 40,
    importanceScore: 62,
  },
  {
    name: 'Galata Mevlevi Lodge',
    city: 'Istanbul',
    latitude: 41.0290,
    longitude: 28.9757,
    primaryCategory: 'MUSEUM',
    categories: ['MUSEUM', 'HISTORICAL_SITE'],
    shortDescription: 'The oldest Mevlevi lodge in Istanbul, now a museum of Sufi culture.',
    description:
      'Founded in 1491, the Galata lodge was a centre of Mevlevi practice, music and calligraphy for four centuries. It now presents instruments, manuscripts, dervish dress and the semahane where the sema was performed, giving a view of Ottoman spiritual and artistic life beyond the imperial mosques.',
    estimatedVisitDurationMinutes: 45,
    importanceScore: 58,
    historicalPeriod: 'Ottoman (from 1491)',
  },

  // -------------------------------------------------------------- Jerusalem
  {
    name: 'Al-Masjid al-Aqsa (Qibli Mosque)',
    city: 'Jerusalem',
    latitude: 31.7761,
    longitude: 35.2358,
    primaryCategory: 'MOSQUE',
    categories: ['MOSQUE', 'RELIGIOUS_LANDMARK', 'HISTORICAL_SITE'],
    shortDescription: 'The congregational mosque of the Haram ash-Sharif and the first qibla of Islam.',
    description:
      'The silver-domed Qibli Mosque stands at the southern end of the Haram ash-Sharif, the whole of which constitutes al-Masjid al-Aqsa. First built in the Umayyad period and rebuilt many times after earthquakes, it was the direction of prayer for the Muslim community before the qibla turned towards Makkah, and is associated with the night journey of the Prophet ﷺ.',
    estimatedVisitDurationMinutes: 60,
    importanceScore: 98,
    historicalPeriod: 'Umayyad (early 8th century) onwards',
    religiousSignificance: 'The third holiest mosque in Islam and the first qibla.',
  },
  {
    name: 'Dome of the Rock',
    city: 'Jerusalem',
    latitude: 31.7780,
    longitude: 35.2354,
    primaryCategory: 'MONUMENT',
    categories: ['MONUMENT', 'RELIGIOUS_LANDMARK', 'HISTORICAL_SITE'],
    shortDescription: 'The late seventh-century Umayyad shrine at the centre of the Haram ash-Sharif.',
    description:
      'Completed in 691–692 under Abd al-Malik ibn Marwan, the Dome of the Rock is the earliest surviving major work of Islamic architecture, built over the rock associated with the ascension of the Prophet ﷺ. Its mosaics and its long inscription band are among the oldest monumental Qur’anic inscriptions in existence.',
    estimatedVisitDurationMinutes: 45,
    importanceScore: 94,
    historicalPeriod: 'Umayyad (691–692 CE)',
  },
  {
    name: 'Al-Buraq Wall',
    city: 'Jerusalem',
    latitude: 31.7767,
    longitude: 35.2345,
    primaryCategory: 'HISTORICAL_SITE',
    shortDescription: 'The western wall of the Haram, associated with the tethering of al-Buraq.',
    description:
      'The western retaining wall of the Haram ash-Sharif takes its Arabic name from the tradition that the Prophet ﷺ tethered al-Buraq nearby on the night journey. The wall is a place of deep and contested significance; visitors should be attentive to access rules and to the sensitivities of the site.',
    estimatedVisitDurationMinutes: 20,
    importanceScore: 76,
  },
  {
    name: 'Bab al-Rahma Cemetery',
    city: 'Jerusalem',
    latitude: 31.7787,
    longitude: 35.2378,
    primaryCategory: 'SHRINE_TOMB',
    shortDescription: 'Historic Muslim cemetery along the eastern wall of the Old City.',
    description:
      'Stretching beneath the eastern wall of the Haram beside the sealed Golden Gate, Bab al-Rahma is among the oldest Muslim cemeteries in Jerusalem, holding graves of companions, scholars and Jerusalem families across many centuries.',
    estimatedVisitDurationMinutes: 20,
    importanceScore: 60,
  },
  {
    name: 'Islamic Museum of al-Aqsa',
    city: 'Jerusalem',
    latitude: 31.7754,
    longitude: 35.2349,
    primaryCategory: 'MUSEUM',
    shortDescription: 'Museum within the Haram holding manuscripts, ceramics and architectural fragments.',
    description:
      'Housed in a Crusader-era hall on the south-western side of the Haram, the museum collects manuscripts, Qur’ans, ceramics, metalwork and architectural elements removed from the mosque during restorations, tracing the site’s history from the Umayyads onwards.',
    estimatedVisitDurationMinutes: 40,
    importanceScore: 55,
  },

  // ------------------------------------------------------------------ Cairo
  {
    name: 'Mosque of Amr ibn al-As',
    city: 'Cairo',
    latitude: 30.0106,
    longitude: 31.2331,
    primaryCategory: 'MOSQUE',
    categories: ['MOSQUE', 'HISTORICAL_SITE'],
    shortDescription: 'The first mosque built in Egypt and in all of Africa.',
    description:
      'Founded in 641–642 CE in the garrison city of Fustat, the mosque of Amr ibn al-As is the oldest in Egypt and on the African continent. Nothing of the original structure survives above ground after repeated rebuilding, but the site has been in continuous congregational use for nearly fourteen centuries.',
    estimatedVisitDurationMinutes: 40,
    importanceScore: 84,
    historicalPeriod: 'Rashidun (641–642 CE)',
  },
  {
    name: 'Al-Azhar Mosque',
    city: 'Cairo',
    latitude: 30.0459,
    longitude: 31.2625,
    primaryCategory: 'MOSQUE',
    categories: ['MOSQUE', 'HISTORICAL_SITE'],
    shortDescription: 'Fatimid mosque of 972 CE and seat of one of the oldest universities in the world.',
    description:
      'Founded in 970–972 as the congregational mosque of the new Fatimid capital, al-Azhar became a centre of teaching within decades and has functioned as a university ever since, making it one of the oldest continuously operating institutions of learning anywhere. Its courtyard and successive minarets record a thousand years of patronage.',
    estimatedVisitDurationMinutes: 50,
    importanceScore: 90,
    historicalPeriod: 'Fatimid (970–972 CE)',
  },
  {
    name: 'Mosque of Ibn Tulun',
    city: 'Cairo',
    latitude: 30.0288,
    longitude: 31.2496,
    primaryCategory: 'MOSQUE',
    categories: ['MOSQUE', 'MONUMENT'],
    shortDescription: 'Ninth-century mosque with a spiral minaret, the largest in Cairo by area.',
    description:
      'Built between 876 and 879 by Ahmad ibn Tulun, this is the oldest mosque in Cairo surviving in something close to its original form. Its vast courtyard, pointed arcades in brick, carved stucco and unusual external spiral minaret reflect Samarran models brought from Iraq.',
    estimatedVisitDurationMinutes: 45,
    importanceScore: 82,
    historicalPeriod: 'Tulunid (876–879 CE)',
  },
  {
    name: 'Mosque-Madrasa of Sultan Hassan',
    city: 'Cairo',
    latitude: 30.0322,
    longitude: 31.2560,
    primaryCategory: 'MOSQUE',
    categories: ['MOSQUE', 'HISTORICAL_SITE'],
    shortDescription: 'Monumental Mamluk mosque and four-madrasa complex below the Citadel.',
    description:
      'Begun in 1356, the complex of Sultan Hassan is among the largest and most ambitious works of Mamluk architecture, combining a congregational mosque with four madrasas for the Sunni schools of law around a single cruciform courtyard. Its scale, stonework and towering portal make it a highlight of Islamic Cairo.',
    estimatedVisitDurationMinutes: 45,
    importanceScore: 80,
    historicalPeriod: 'Mamluk (1356–1363)',
  },
  {
    name: 'Al-Hussein Mosque',
    city: 'Cairo',
    latitude: 30.0477,
    longitude: 31.2634,
    primaryCategory: 'MOSQUE',
    categories: ['MOSQUE', 'SHRINE_TOMB'],
    shortDescription: 'Mosque beside Khan al-Khalili, traditionally associated with the head of Husayn ibn Ali.',
    description:
      'Founded in the Fatimid period and rebuilt in the nineteenth century, the mosque stands at the heart of old Cairo beside Khan al-Khalili and is one of the most visited in the city. Egyptian tradition holds that the head of Husayn ibn Ali was brought here in the twelfth century.',
    estimatedVisitDurationMinutes: 35,
    importanceScore: 76,
    historicalPeriod: 'Fatimid foundation, 19th-century rebuilding',
  },
  {
    name: 'Mosque of Muhammad Ali & the Citadel',
    city: 'Cairo',
    latitude: 30.0287,
    longitude: 31.2599,
    primaryCategory: 'MOSQUE',
    categories: ['MOSQUE', 'HISTORICAL_SITE', 'MONUMENT'],
    shortDescription: 'Ottoman-style alabaster mosque crowning Salah ad-Din’s citadel above Cairo.',
    description:
      'The Citadel was begun by Salah ad-Din in 1176 and remained the seat of Egyptian government for some seven hundred years. Its skyline is now dominated by the alabaster mosque built by Muhammad Ali between 1830 and 1848 in an Ottoman imperial idiom, with a terrace looking out over the whole of Cairo.',
    estimatedVisitDurationMinutes: 75,
    importanceScore: 78,
    historicalPeriod: 'Ayyubid citadel 1176; mosque 1830–1848',
  },
  {
    name: 'Mosque of Imam al-Shafi‘i',
    city: 'Cairo',
    latitude: 30.0164,
    longitude: 31.2513,
    primaryCategory: 'SHRINE_TOMB',
    categories: ['SHRINE_TOMB', 'MOSQUE'],
    shortDescription: 'The domed tomb of Imam al-Shafi‘i, founder of the Shafi‘i school of law.',
    description:
      'In the southern cemetery of Cairo stands the mausoleum of Imam Muhammad ibn Idris al-Shafi‘i, who died in Fustat in 820. The great wooden dome was raised by the Ayyubids in 1211 and remains the largest funerary dome in Egypt; it is one of the most visited places of ziyarat in the city.',
    estimatedVisitDurationMinutes: 35,
    importanceScore: 74,
    historicalPeriod: 'Ayyubid (1211)',
  },
  {
    name: 'Museum of Islamic Art',
    city: 'Cairo',
    latitude: 30.0470,
    longitude: 31.2523,
    primaryCategory: 'MUSEUM',
    shortDescription: 'One of the world’s foremost collections of Islamic art, from Umayyad to Ottoman.',
    description:
      'The Museum of Islamic Art holds tens of thousands of objects spanning the Islamic world — woodwork, metalwork, ceramics, textiles, coins and manuscripts, including material from Egypt, Iran, Anatolia and Andalusia. It gives context to the monuments standing outside its doors.',
    estimatedVisitDurationMinutes: 90,
    importanceScore: 68,
  },

  // -------------------------------------------------------------------- Fez
  {
    name: 'Al-Qarawiyyin Mosque and University',
    city: 'Fez',
    latitude: 34.0648,
    longitude: -4.9734,
    primaryCategory: 'MOSQUE',
    categories: ['MOSQUE', 'HISTORICAL_SITE'],
    shortDescription: 'Founded in 859 by Fatima al-Fihri, and among the oldest universities in the world.',
    description:
      'Fatima al-Fihri founded al-Qarawiyyin in 859 CE, endowing a mosque that grew into a centre of learning drawing scholars from across the Islamic world and Europe. Its library holds manuscripts more than a thousand years old and has been restored for public use.',
    estimatedVisitDurationMinutes: 45,
    importanceScore: 86,
    historicalPeriod: 'Idrisid (859 CE)',
  },
  {
    name: 'Madrasa Bou Inania',
    city: 'Fez',
    latitude: 34.0637,
    longitude: -4.9820,
    primaryCategory: 'HISTORICAL_SITE',
    categories: ['HISTORICAL_SITE', 'MOSQUE'],
    shortDescription: 'Fourteenth-century Marinid madrasa, celebrated for its carved cedar and zellij.',
    description:
      'Built between 1350 and 1355 by the Marinid sultan Abu Inan Faris, this is the only madrasa in Fez with its own minaret and congregational function. Its courtyard of carved cedar, stucco and zellij tilework is among the finest surviving examples of Marinid craftsmanship.',
    estimatedVisitDurationMinutes: 40,
    importanceScore: 70,
    historicalPeriod: 'Marinid (1350–1355)',
  },
  {
    name: 'Zawiya of Moulay Idris II',
    city: 'Fez',
    latitude: 34.0651,
    longitude: -4.9762,
    primaryCategory: 'SHRINE_TOMB',
    shortDescription: 'The shrine of the founder of Fez, at the heart of the old medina.',
    description:
      'The zawiya holds the tomb of Idris II, who established Fez as a capital in the early ninth century. Rebuilt in the eighteenth century, it sits at the centre of the medina and remains a focus of the city’s religious life.',
    estimatedVisitDurationMinutes: 30,
    importanceScore: 66,
  },
];

/**
 * The password for the seeded demo accounts.
 *
 * Deliberately never hardcoded. A literal here would be a live credential for
 * every deployment that runs this seed, published in the repository — which is
 * exactly what secret scanners flag, and they are right to. Set SEED_PASSWORD to
 * choose one, or a strong random password is generated and printed once.
 */
function resolveSeedPassword(): { password: string; generated: boolean } {
  const provided = process.env.SEED_PASSWORD?.trim();

  if (provided) {
    if (provided.length < 8) {
      throw new Error('SEED_PASSWORD must be at least 8 characters long');
    }
    return { password: provided, generated: false };
  }

  return { password: `${randomBytes(12).toString('base64url')}aA1!`, generated: true };
}

async function main() {
  console.log('Seeding Sufara…');

  const categories = new Map<string, string>();
  for (const category of CATEGORIES) {
    const record = await prisma.category.upsert({
      where: { key: category.key },
      update: { ...category },
      create: { ...category },
    });
    categories.set(category.key, record.id);
  }

  const countries = new Map<string, string>();
  for (const country of COUNTRIES) {
    const slug = country.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const record = await prisma.country.upsert({
      where: { code: country.code },
      update: { name: country.name, slug },
      create: { name: country.name, code: country.code, slug },
    });
    countries.set(country.code, record.id);
  }

  const cities = new Map<string, string>();
  for (const city of CITIES) {
    const countryId = countries.get(city.countryCode)!;
    const slug = city.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const record = await prisma.city.upsert({
      where: { countryId_slug: { countryId, slug } },
      update: {
        name: city.name,
        latitude: city.latitude,
        longitude: city.longitude,
        timezone: city.timezone,
      },
      create: {
        name: city.name,
        slug,
        countryId,
        latitude: city.latitude,
        longitude: city.longitude,
        timezone: city.timezone,
      },
    });
    cities.set(city.name, record.id);
  }

  const { password, generated } = resolveSeedPassword();
  const passwordHash = await bcrypt.hash(password, 10);

  // Existing accounts keep whatever password they already have: re-running the
  // seed must never silently reset a password someone has since changed.
  const created: string[] = [];

  const adminExisting = await prisma.user.findUnique({ where: { email: 'admin@sufara.app' } });
  const admin = adminExisting
    ? await prisma.user.update({ where: { id: adminExisting.id }, data: { role: 'ADMIN' } })
    : await prisma.user.create({
        data: {
          email: 'admin@sufara.app',
          name: 'Sufara Admin',
          passwordHash,
          role: 'ADMIN',
          preference: { create: {} },
        },
      });
  if (!adminExisting) created.push('admin@sufara.app');

  const travelerExisting = await prisma.user.findUnique({
    where: { email: 'traveler@sufara.app' },
  });
  if (!travelerExisting) {
    await prisma.user.create({
      data: {
        email: 'traveler@sufara.app',
        name: 'Ahmed Khan',
        passwordHash,
        role: 'USER',
        preference: { create: { travelMode: 'DRIVING', walkingTolerance: 'MEDIUM' } },
        interests: {
          create: [
            { categoryId: categories.get('MOSQUE')! },
            { categoryId: categories.get('HISTORICAL_SITE')! },
            { categoryId: categories.get('BATTLE_SITE')! },
          ],
        },
      },
    });
    created.push('traveler@sufara.app');
  }

  for (const place of PLACES) {
    const cityId = cities.get(place.city)!;
    const cityRecord = CITIES.find((c) => c.name === place.city)!;
    const countryId = countries.get(cityRecord.countryCode)!;
    const slug = place.name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const categoryKeys = new Set<CategoryKey>([
      place.primaryCategory,
      ...(place.categories ?? []),
    ]);

    const data = {
      name: place.name,
      shortDescription: place.shortDescription,
      description: place.description,
      countryId,
      cityId,
      latitude: place.latitude,
      longitude: place.longitude,
      primaryCategoryId: categories.get(place.primaryCategory)!,
      estimatedVisitDurationMinutes: place.estimatedVisitDurationMinutes,
      importanceScore: place.importanceScore,
      status: 'ACTIVE',
      historicalPeriod: place.historicalPeriod ?? null,
      religiousSignificance: place.religiousSignificance ?? null,
      createdById: admin.id,
    };

    const record = await prisma.place.upsert({
      where: { cityId_slug: { cityId, slug } },
      update: data,
      create: { ...data, slug },
    });

    await prisma.placeCategory.deleteMany({ where: { placeId: record.id } });
    await prisma.placeCategory.createMany({
      data: [...categoryKeys].map((key) => ({
        placeId: record.id,
        categoryId: categories.get(key)!,
      })),
    });
  }

  console.log(
    `Seeded ${COUNTRIES.length} countries, ${CITIES.length} cities, ${PLACES.length} places, ${CATEGORIES.length} categories.`,
  );

  if (created.length === 0) {
    console.log('Accounts admin@sufara.app and traveler@sufara.app already existed; passwords unchanged.');
  } else if (generated) {
    console.log(`\nCreated ${created.join(' and ')} with a generated password:\n`);
    console.log(`    ${password}\n`);
    console.log('Store it now — it is not written anywhere. Set SEED_PASSWORD to choose your own.');
  } else {
    console.log(`\nCreated ${created.join(' and ')} using the password from SEED_PASSWORD.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
