import https from 'https';

const BASE = 'https://wonderfulwednesday.up.railway.app';
const PASSWORD = process.argv[2] || 'changeme';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': PASSWORD,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const clues = [
  { clue: "Ports-to-power conglomerate founder whose group runs Mundra port",                                        answer: "ADANI",       hint: "Surname of the man behind the largest port in India" },
  { clue: "House that makes your almirah, your soap, and your matchbox",                                             answer: "GODREJ",      hint: "A century-old conglomerate — their fridge and their soap share the same name" },
  { clue: "Cannes-loved film chosen to fly India's flag at the 2026 Oscars",                                         answer: "HOMEBOUND",   hint: "A Malayalam film that won the FIPRESCI Prize at Cannes 2025" },
  { clue: "Ticketing app quietly turning into India's Ticketmaster for concerts",                                     answer: "BOOKMYSHOW",  hint: "You used this app the last time you bought a movie ticket" },
  { clue: "E-commerce app that got non-metro India shopping online",                                                  answer: "MEESHO",      hint: "Started as a WhatsApp reselling tool for homemakers" },
  { clue: "Elegant left-hander anchoring India's women's cricket batting order",                                      answer: "MANDHANA",    hint: "Opens the batting for India Women; her cover drive is poetry" },
  { clue: "Teen who dethroned a legend to become the youngest world chess champion",                                  answer: "GUKESH",      hint: "A Chennai teenager who became world champion at 18" },
  { clue: "Long jumper who soared to silver at Glasgow 2026",                                                        answer: "SREESHANKAR", hint: "Jumped 8.41m in Glasgow to land on the podium" },
  { clue: "UPI-powered fintech giant that filed confidentially for a mega IPO",                                       answer: "PHONEPE",     hint: "The purple UPI app that Walmart indirectly owns a stake in" },
  { clue: "Para-athlete who won T47 gold with a 10.71s national record at Glasgow 2026",                             answer: "GAVIT",       hint: "Won T47 100m gold at Glasgow 2026 with a new national record" },
  { clue: "State racing to finish India's first bullet train corridor",                                               answer: "GUJRAT",      hint: "The state where the Sabarmati Ashram and Statue of Unity both stand" },
  { clue: "Punjabi singer who became the first to headline Coachella performing entirely in his mother tongue",       answer: "DOSANJH",     hint: "Sang Lover and GOAT; performed at Coachella 2025 in Punjabi" },
  { clue: "Infosys co-founder who set corporate India abuzz demanding a 70-hour work week",                          answer: "MURTHY",      hint: "NRN — the Infosys patriarch who sparked the 70-hour work debate" },
  { clue: "45-day gathering at Prayagraj that pulled in more people than the population of the US and UK combined",  answer: "KUMBH",       hint: "The world's largest human gathering, held at the Sangam in Prayagraj" },
  { clue: "First woman to run SAP Labs India, and immediate past chairperson of NASSCOM",                            answer: "GANGADHARAN", hint: "Led SAP Labs India and chaired NASSCOM — a tech industry trailblazer" },
  { clue: "Director of RRR and the Baahubali films, now being courted for Hollywood collaborations",                 answer: "RAJAMOULI",   hint: "The man who gave us Baahubali, RRR, and a global fanbase for Telugu cinema" },
];

async function main() {
  const existing = await request('GET', '/api/admin/clues');
  if (existing.body.error) { console.error('Auth failed:', existing.body); process.exit(1); }
  for (const c of existing.body) await request('DELETE', `/api/admin/clues/${c.id}`);
  console.log(`Cleared ${existing.body.length} existing draft clues`);

  for (const c of clues) {
    const r = await request('POST', '/api/admin/clues', c);
    console.log(r.body.answer === c.answer ? `+ ${c.answer}` : `FAILED ${c.answer}: ${JSON.stringify(r.body)}`);
  }

  console.log('\nGenerating crossword...');
  const gen = await request('POST', '/api/admin/generate');
  if (gen.body.error) { console.error('Generate failed:', gen.body); process.exit(1); }
  console.log(`Grid: ${gen.body.width}x${gen.body.height}, placed: ${gen.body.placedWords.length}/16, unplaced: [${gen.body.unplacedWords}]`);

  const pub = await request('POST', '/api/admin/puzzles', {
    title: 'Wonderful Wednesdays: India Edition',
    grid: gen.body,
    hintMode: 'text',
  });
  if (!pub.body.id) { console.error('Publish failed:', pub.body); process.exit(1); }
  console.log(`Published! ID: ${pub.body.id}`);
  console.log('\nShare this link with your team:\nhttps://wonderfulwednesday.up.railway.app');
}

main().catch(console.error);
