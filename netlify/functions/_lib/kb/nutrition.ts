// Knowledge base nutrizionale — principi da "Project Nutrition" (A. Biasci).
//
// Non è materiale RAG: sono i principi che devono guidare SEMPRE il
// ragionamento, indipendentemente da cosa l'utente ha caricato. I blocchi
// vengono selezionati per argomento (vedi ./index.ts) per non pagare
// l'intera dottrina a ogni messaggio.

export type KbBlock = {
  id: string
  /** Parole chiave che attivano il blocco nella query utente. */
  triggers: string[]
  title: string
  content: string
}

// Sempre incluso: è la spina dorsale del ragionamento nutrizionale.
export const NUTRITION_CORE = `## Principi nutrizionali guida (Project Nutrition — Biasci)
- **Senza dati sono atti di fede**: prima di consigliare, guarda peso, BF, foto e trend. Misura settimanalmente, valuta mensilmente. Un singolo dato giornaliero è rumore.
- **Bilancio settimanale, non giornaliero**: il corpo ragiona su 7+ giorni. Uno sforo isolato non rompe nulla; conta la media della settimana.
- **Investire prima di togliere**: se l'introito è già basso, alzare il fabbisogno viene PRIMA di tagliare. Tagliare da un fabbisogno basso porta al punto di rottura.
- **La caloria è universale in fisica, non in biologia**: lo stesso introito agisce diversamente secondo massa magra, sensibilità insulinica, ormoni e allenamento.
- **L'allenamento è il postino** che decide dove vanno i nutrienti (partizionamento). Più massa magra e più allenamento = i carboidrati vanno al muscolo, non all'adipocita.
- **Nessun alimento è di per sé ingrassante**: contesto, quantità e bilancio decidono. Non demonizzare carboidrati, grassi o pasti serali.
- **Aggiustamenti piccoli e progressivi**: come per il massimale di panca, non si cambiano le calorie di colpo. 40-100 kcal alla volta, poi si misura.`

export const NUTRITION_BLOCKS: KbBlock[] = [
  {
    id: 'reset',
    triggers: [
      'reset',
      'metabolismo',
      'metabolico',
      'stallo',
      'stallare',
      'blocco',
      'non scendo',
      'non dimagrisco',
      'fabbisogno',
      'ricostruzione',
      'aumentare le calorie',
    ],
    title: 'Reset metabolico',
    content: `### Reset metabolico
Soglia: sotto **31-34 kcal/kg (uomo)** o **28-31 kcal/kg (donna)** NON si taglia. Si passa 20-30 settimane ad ALZARE il fabbisogno.
Come: +40-100 kcal ogni 7-14 giorni (prevalentemente carboidrati), allenamento 3-4x/sett ad alto volume senza cedimento, misurazione settimanale. Il BF può salire di 2-4%: è un investimento, non un fallimento.
Indicatori che impongono il reset prima del deficit: introito sotto soglia, stallo da mesi, storia di diete yo-yo, periodo di vita molto stressante, cortisolo cronicamente alto.
Indicatori che autorizzano il deficit: ≥31-34 kcal/kg, allenamenti completati senza stress, sonno regolare, buona massa magra.`,
  },
  {
    id: 'definizione',
    triggers: [
      'definizione',
      'dimagrire',
      'dimagrimento',
      'cut',
      'deficit',
      'perdere peso',
      'perdere grasso',
      'tagliare',
      'asciugare',
    ],
    title: 'Definizione',
    content: `### Definizione
Deficit del **10-20%** rispetto al fabbisogno, mai di più. Perdita sostenibile: **0,5-1% del peso a settimana** (la parte bassa del range sotto il 15% di BF).
Struttura a blocchi: 6-8 settimane di taglio, poi 1-2 settimane di normocalorica prima del blocco successivo. Il taglio continuo spegne la leptina.
Le proteine salgono in deficit (1,7-2,5 g/kg, fino a 2,5-3 in definizione spinta) per proteggere la massa magra. Mantieni l'intensità in palestra: perdere forza significa che stai perdendo muscolo.
Tutte le strategie (low carb, low fat, IF, Zona, dissociata) funzionano se rispettano l'ipocalorica: scegli quella sostenibile per la persona.`,
  },
  {
    id: 'ricariche',
    triggers: [
      'ricarica',
      'refeed',
      'sgarro',
      'cheat',
      'leptina',
      'giorno libero',
      'pasto libero',
    ],
    title: 'Ricariche e leptina',
    content: `### Ricariche e leptina
La leptina cala dopo 3-4 giorni di low-carb: le ricariche cicliche non sono un premio, sono parte del protocollo.
Come farla: pasto fortemente glucidico da fonti **amidacee** (cereali, legumi, tuberi). Poco fruttosio, pochi grassi. Idealmente dopo un allenamento che ha svuotato il glicogeno, così i carboidrati vanno al muscolo.
Frequenza: un pasto di ricarica ogni 3-4 giorni in deficit; 1-2 settimane normocaloriche ogni 4-8 settimane di definizione.
**Lo sgarro programmato non è uno sgarro**: pianificarlo toglie il senso di colpa e rende la dieta sostenibile.`,
  },
  {
    id: 'macro',
    triggers: [
      'proteine',
      'carboidrati',
      'grassi',
      'macro',
      'macronutrienti',
      'g/kg',
      'quanti grammi',
      'quante proteine',
    ],
    title: 'Macronutrienti',
    content: `### Macronutrienti (riferimenti)
Proteine per fase: sedentario 0,9-1 g/kg · sport 1,2-1,6 · massa 0,9-1,5 · mantenimento attivo 1,4-2 · definizione 1,7-2,5 · definizione spinta 2,5-3.
Carboidrati: 2-7 g/kg. Necessari ma non essenziali: il fabbisogno cerebrale è ~120 g/die e le low-carb prolungate spengono la leptina. Più carboidrati tollerati = metabolismo più alto.
Grassi: minimo 0,3 g/kg e comunque **mai sotto 20-30 g/die** (servono per gli ormoni). Metà dei lipidi da olio extravergine.
Acqua: 30-40 ml/kg, di più con caldo e allenamento.
Regola pratica: **più carboidrati → meno proteine; meno carboidrati → più proteine.**`,
  },
  {
    id: 'ig',
    triggers: [
      'indice glicemico',
      'glicemico',
      'glicemia',
      'insulina',
      'insulinico',
      'zuccheri',
      'picco',
    ],
    title: 'Glicemia e insulina',
    content: `### Glicemia e insulina
L'**indice glicemico da solo è inutile**: contano il carico glicemico (IG × quantità reale) e il carico insulinico (stimolazione totale, anche dalle proteine).
L'insulina non è il nemico: è neutrale. Ingrassi con insulina alta **solo** in eccesso calorico con trigliceridi alti e mitocondri saturi. La stessa insulina alta con glicogeno basso dopo l'allenamento è anabolica per il muscolo.
Riferimenti di salute: glicemia a digiuno 80-100 mg/dl, 2h post-pasto <120, HbA1c 4,0-5,3%.
Strategia pratica a tavola: **ordine del pasto** — prima verdura, poi proteine e grassi, poi i carboidrati, eventuale frutta alla fine. Sazi prima e la glicemia resta più stabile.`,
  },
  {
    id: 'massa',
    triggers: [
      'massa',
      'bulk',
      'aumentare di peso',
      'ingrassare',
      'surplus',
      'crescere',
      'mettere muscolo',
    ],
    title: 'Massa e ricomposizione',
    content: `### Massa e ricomposizione
Surplus pulito: **+10-15%** sul fabbisogno (fino a +20% per gli ectomorfi). Il +30% "sporco" è sconsigliato: aggiunge grasso che poi va tolto.
Nei naturali l'ipertrofia è governata dai fattori locali (MGF, tensione meccanica), non dai picchi ormonali sistemici: inutile rincorrere GH e testosterone con protocolli o integratori.
La ricomposizione è possibile ma lenta, e funziona soprattutto in chi ha margine (principianti, ritorno all'allenamento, BF medio-alto).`,
  },
  {
    id: 'integratori',
    triggers: [
      'integratore',
      'integratori',
      'creatina',
      'whey',
      'bcaa',
      'omega',
      'vitamina',
      'proteine in polvere',
      'supplement',
    ],
    title: 'Integrazione',
    content: `### Integrazione (per priorità)
1. **Creatina monoidrato** 3-5 g/die, in qualsiasi momento, nessun carico necessario. È l'integratore con l'evidenza più solida.
2. **Vitamina D**: solo dopo esame ematico che mostri il deficit (molto comune in Italia).
3. **Omega-3 EPA/DHA** 2-4 g/die se la dieta è povera di pesce azzurro.
4. **Whey**: comodità, non magia. Servono se non arrivi alle proteine con il cibo.
5. **BCAA**: utili solo in digiuno intermittente, endurance lunga o ipocaloriche estreme. Se mangi bene sono placebo.
Da evitare: tribulus e test booster, brucia-grassi termogenici, L-carnitina, pre-workout "magici", prodotti detox.`,
  },
  {
    id: 'stress',
    triggers: [
      'stress',
      'cortisolo',
      'sonno',
      'dormire',
      'insonnia',
      'ansia',
      'stanchezza',
      'stanco',
      'fatica',
    ],
    title: 'Stress, sonno e cortisolo',
    content: `### Stress, sonno e cortisolo
Dieta aggressiva + sport eccessivo + vita stressante = **punto di rottura**: crollano leptina e T3, calano i GLUT-4, si perde acqua e massa magra invece di grasso. Va evitato a ogni costo.
Interventi: sonno 7-8h regolare, gestione dei fattori di stress reali, camminate all'aperto, limitare caffeina (max 3-4 caffè, non oltre il pomeriggio) e alcol, carboidrati serali (favoriscono il triptofano e quindi la serotonina).
Se la vita è in una fase molto stressante, non è il momento di una definizione aggressiva: è il momento di mantenere o costruire.`,
  },
  {
    id: 'psicologia',
    triggers: [
      'motivazione',
      'fame',
      'voglia',
      'abbuffata',
      'sensi di colpa',
      'mollare',
      'obiettivo',
      'costanza',
    ],
    title: 'Psicologia e aderenza',
    content: `### Psicologia e aderenza
Si mangia per almeno 10 motivi che non sono la fame: noia, stress, socialità, abitudine, ricompensa. Identificare il motivo vale più di un'altra regola alimentare.
Regola **80-20**: 80% di alimenti integri, 20% libero. Un piano perfetto che nessuno segue vale meno di un piano buono e sostenibile.
Test pratico per la voglia di dolce a fine pasto: "mangerei un frutto adesso?" Se la risposta è no, non è fame, è tentazione.
Obiettivi SMART: specifici, misurabili, con azioni pianificate, realistici e con una scadenza. Tre cose fatte bene battono dieci fatte a metà.
Attenzione all'ortoressia: togliere alimenti dà benessere per autosuggestione 1-2 anni, poi si cerca un nuovo colpevole. Verifica con dati oggettivi.`,
  },
  {
    id: 'diete',
    triggers: [
      'digiuno',
      'intermittente',
      'keto',
      'chetogenica',
      'paleo',
      'zona',
      'vegana',
      'vegetariana',
      'dissociata',
      'mediterranea',
      'detox',
      'dieta dei',
    ],
    title: 'Confronto tra diete',
    content: `### Confronto tra diete
Zona, digiuno intermittente, cicliche, iperproteiche, chetogenica, paleo, dissociata: **funzionano tutte** se creano il deficit. Cambiano aderenza, sostenibilità e adattamento individuale, non la fisica.
Digiuno intermittente 18:6: ottimo per chi è autodisciplinato e preferisce pochi pasti abbondanti. Nel lungo periodo gli acidi grassi liberi cronicamente alti possono peggiorare la sensibilità insulinica.
Chetogenica: efficace nel breve, ma penalizza la performance nei lavori glicolitici e va ciclizzata.
Bufale conclamate da smontare senza esitazione: dieta dei gruppi sanguigni, dieta alcalina, detox e digiuni "disintossicanti", test per le intolleranze in farmacia, pillole brucia-grassi, finestra anabolica di 30 minuti, "5-6 pasti accelerano il metabolismo".`,
  },
  {
    id: 'misurazione',
    triggers: [
      'peso',
      'bilancia',
      'plicometro',
      'body fat',
      'bf',
      'circonferenze',
      'misure',
      'foto',
      'quanto peso',
    ],
    title: 'Misurazione',
    content: `### Misurazione
Servono 4-6 misurazioni per valutare: bilancia (stesso orario, stesse condizioni), circonferenze, plicometria, foto con stessa luce e posa. **Conta il trend, non il singolo dato.**
Frequenza: rilevazione settimanale, valutazione ogni 21-30 giorni. Le oscillazioni quotidiane sono acqua e contenuto intestinale.
Range BF di riferimento — uomo: salute 10-15%, atletico 8-12%, essenziale 3-5%. Donna: salute 18-24%, atletico 14-20%, essenziale 8-12%.
Chi tiene un diario alimentare per la prima volta scopre tipicamente di sottostimare del 30-40% quello che mangia.`,
  },
  {
    id: 'timing',
    triggers: [
      'post workout',
      'pre workout',
      'prima di allenarmi',
      'dopo allenamento',
      'finestra anabolica',
      'timing',
      'quando mangiare',
    ],
    title: 'Timing dei nutrienti',
    content: `### Timing dei nutrienti
La "finestra anabolica di 30 minuti" non esiste: un pasto normale con carboidrati e proteine entro 1-3 ore dall'allenamento è sufficiente.
La sensibilità insulinica resta alta per un paio d'ore dopo l'allenamento: è il momento migliore per collocare la quota glucidica più alta della giornata.
I carboidrati serali non fanno ingrassare: conta il totale. Anzi, la sera favoriscono il rilassamento via triptofano-serotonina.`,
  },
]
