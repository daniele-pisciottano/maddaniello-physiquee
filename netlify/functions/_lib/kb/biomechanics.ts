// Knowledge base biomeccanica — principi da "Project Exercise Vol. 2"
// (A. Roncari). Guidano selezione esercizi, tecnica, programmazione e
// prevenzione infortuni.

import type { KbBlock } from './nutrition'

// Sempre incluso quando si parla di allenamento.
export const TRAINING_CORE = `## Principi di allenamento guida (Project Exercise — Roncari)
- **Analisi prima del giudizio**: davanti a un esercizio chiediti quali articolazioni lavorano, dove agisce il momento della gravità, quale famiglia muscolare si oppone e quali muscoli specifici sono coinvolti. Chi "senti tirare" non è necessariamente chi lavora.
- **L'infortunio in palestra è cronico, non acuto**: strappi e stiramenti sono rari, dominano protrusioni, ernie, impingement e tendinopatie da uso ripetuto. Ragiona in mesi e anni, non nella singola serie.
- **Gli esercizi sono per le persone, le statistiche per le popolazioni**: l'anatomia individuale (anca vara/valga, torsione femorale, lunghezza del femore, mobilità di caviglia) cambia l'esecuzione corretta. Si adatta l'esercizio, non si rinuncia all'esercizio.
- **EMG non è ipertrofia**: un picco di attivazione in uno studio non equivale a più crescita in un programma di mesi. Il volume programmato nel tempo conta di più.
- **La forza è per il 70% capacità neurale**: i multiarticolari allenano il sistema nervoso, non solo il muscolo.
- **Il dimagrimento localizzato non esiste**: nessun esercizio "toglie" il grasso di una zona. Lo fa il bilancio calorico.
- **Prima di attribuire un errore all'anatomia**, verifica in ordine: apprendimento motorio, propriocezione, mobilità, retrazione muscolare. Solo dopo anatomia individuale e rigidità strutturale (che va da un fisioterapista).`

export const TRAINING_BLOCKS: KbBlock[] = [
  {
    id: 'squat',
    triggers: [
      'squat',
      'accosciata',
      'front squat',
      'goblet',
      'pressa',
      'leg press',
      'bulgaro',
      'gambe',
      'quadricipiti',
    ],
    title: 'Squat e derivati',
    content: `### Squat
Lo **squat sotto il parallelo non fa male alle ginocchia**: la catena posteriore, in particolare il semimembranoso (intra-articolare), contrasta le forze di taglio del quadricipite. È più sicuro di un mezzo squat super-caricato. Alla schiena non fa male se si mantiene la lordosi.
"**Schiena dritta E ginocchia dietro le punte" è fisicamente impossibile** in catena cinetica chiusa: serve un compromesso, con inclinazione moderata del tronco e ginocchia che possono superare leggermente la punta del piede.
**Punte leggermente in fuori**, secondo l'asse femore-tibia-piede naturale della persona. Forzare i piedi paralleli sposta stress sulle strutture mediali del ginocchio.
Adattamenti: caviglia rigida (dorsiflessione sotto i 10°) → 2-4 cm di rialzo sotto i talloni o scarpe da powerlifting; femore lungo → Front Squat o Goblet, che spostano il baricentro avanti e permettono un busto più eretto.
Errori tipici e cause: schienamento eccessivo (caviglia rigida o femore lungo), retroversione del bacino in buca (propriocezione degli ischiocrurali più spesso che vera retrazione), valgo dinamico (medio gluteo debole → mini-band e step-up controllati), sguardo al soffitto (va tenuto 2-3 metri avanti sul pavimento).`,
  },
  {
    id: 'stacco',
    triggers: [
      'stacco',
      'deadlift',
      'rumeno',
      'sumo',
      'gambe tese',
      'catena posteriore',
      'ischiocrurali',
      'femorali',
      'good morning',
    ],
    title: 'Stacco e catena posteriore',
    content: `### Stacco
Setup: bilanciere all'altezza di metà tibia, piedi sotto le anche, mani larghe quanto le spalle e fuori dalle gambe, bacino in antiversione, schiena compatta con scapole stabili.
Esecuzione: **"spingi nel pavimento", non tirare con le braccia**. Il bilanciere resta adeso alle tibie per tutto il movimento. Apnea e manovra di Valsalva durante l'alzata, che aumenta la pressione intra-addominale e protegge i dischi (solo con sistema cardiovascolare sano).
**Sumo non è "barare"**: è una variante con biomeccanica diversa (piano frontale più coinvolto, ROM minore, busto più eretto), adatta a chi ha femori lunghi o gestisce male il baricentro.
Stacco rumeno / a gambe tese: ginocchia leggermente flesse, bacino indietro, discesa con lordosi neutra fino allo stretch degli ischiocrurali. Enfasi su ischiocrurali e glutei.
Ischiocrurali "corti": distinguere retrazione vera da propriocezione. Si lavora con stretching in scarico e stacco a gambe tese a basso carico con focus percettivo. Servono settimane o mesi.`,
  },
  {
    id: 'glutei',
    triggers: [
      'glutei',
      'gluteo',
      'hip thrust',
      'ponte',
      'affondi',
      'affondo',
      'step up',
      'abduttori',
    ],
    title: 'Glutei e unilaterali',
    content: `### Glutei
**Hip Thrust**: miglior attivazione EMG del grande gluteo, con picco al massimo accorciamento (anca a 0°). Spalle sulla panca, ginocchia a 60-90°, si solleva il **bacino** e non si spinge dai piedi; retroversione finale per non iperestendere il lombare. Gli ischiocrurali sono sfavoriti perché il ginocchio è flesso. Ottimo complementare, ma poco didattico per un principiante: prima squat e stacco.
Gerarchia per il grande gluteo: Hip Thrust > Squat profondo > Stacco > Affondi.
**Affondi**: passo lungo enfatizza il gluteo, passo breve il quadricipite. Ginocchio anteriore allineato alla punta del piede, risalita spingendo dal tallone anteriore.
**Squat bulgaro**: scarico assiale sulla colonna e lavoro sulla simmetria destra/sinistra. Utile anche con poca attrezzatura.
"Hip thrust solo per donne" e "le donne devono fare abductor/adductor" sono miti: i macchinari adduttori/abduttori seduti hanno scarso valore, il medio gluteo si allena meglio con lavori in carico e mini-band.`,
  },
  {
    id: 'core',
    triggers: [
      'addominali',
      'addome',
      'core',
      'plank',
      'crunch',
      'ab wheel',
      'obliqui',
      'sit up',
      'pancia',
      'girovita',
    ],
    title: 'Tronco e addominali',
    content: `### Tronco e addominali
**Miti da smontare**: non esistono "addominali alti e bassi" (è un unico retto dell'addome con bande tendinee); i crunch non fanno andare via la pancia (il dimagrimento localizzato non esiste); il side bending non stringe il girovita, rinforza il quadrato dei lombi; le torsioni del busto **sotto carico** sono rischiose perché il rachide lombare ruota solo 5-10°.
**Sit-up con piedi bloccati** lavora soprattutto l'ileopsoas: preferire Crunch (ROM corto, solo le spalle staccate, schiena bassa a terra, mani alle orecchie senza strappare il collo) o Reverse Crunch (è il **bacino** che sale verso il petto, non solo le gambe).
**Plank**: allineamento spalle-anca-talloni, glutei contratti e bacino retroverso. 30-60 secondi di qualità valgono più di 3 minuti scadenti. **AB Wheel**: rachide neutro per tutto il movimento, si parte dalle ginocchia.
Programmazione: 2-3 sessioni a settimana, mai quotidiano, mix di isotonico e isometrico. 8-15 serie totali per principianti, 15-25 per avanzati.
Bacino: gli **antiversori** (ileopsoas, retto femorale, sartorio, adduttori) aumentano la lordosi, i **retroversori** (retto addome, obliqui, ischiocrurali, glutei, quadrato dei lombi) la riducono. Un sedentario che fa 1000 crunch peggiora il proprio assetto: va equilibrato.`,
  },
  {
    id: 'schiena',
    triggers: [
      'mal di schiena',
      'lombare',
      'ernia',
      'protrusione',
      'discale',
      'lombalgia',
      'colonna',
      'rachide',
      'cervicale',
      'postura',
    ],
    title: 'Rachide, ernie e protrusioni',
    content: `### Rachide, ernie e protrusioni
Il disco intervertebrale è fatto di nucleo polposo (90% acqua) e anulus fibroso. **Flessione più carico** spinge il nucleo posteriormente: se l'anulus è degenerato si arriva a protrusione o ernia. I livelli più colpiti sono **L4-L5 e L5-S1** (e C5-C6, C6-C7 in cervicale), perché sopportano più carico.
Flessione prolungata seguita da estensione improvvisa è il meccanismo classico del "colpo della strega".
Il lombare **flette ed estende, ma ruota pochissimo** (5-10°): le torsioni sotto carico vanno evitate.
Mobilità per segmento: cervicale massima, toracico molto in flessione e poco in estensione, lombare in flesso-estensione ma non in rotazione.
"Hai mal di schiena? Fai la pressa" è un consiglio che spesso peggiora la situazione.
Hyperextension: discesa con lordosi neutra, **mai** in flessione lombare, risalita fino all'allineamento orizzontale.
Per patologie diagnosticate (ernie sintomatiche, instabilità, condropatie) serve sempre la valutazione di un medico o fisioterapista prima di programmare.`,
  },
  {
    id: 'ginocchio',
    triggers: [
      'ginocchio',
      'ginocchia',
      'lca',
      'crociato',
      'menisco',
      'valgo',
      'rotula',
      'leg extension',
      'leg curl',
    ],
    title: 'Ginocchio, valgo e riabilitazione',
    content: `### Ginocchio
**Valgo dinamico**: prevenzione con rinforzo del medio gluteo e degli abduttori (banda elastica laterale), step-up controllati con feedback verbale ("ginocchio in linea con la punta"), affondi unilaterali davanti allo specchio, mini-band sopra le ginocchia nello squat.
**La leg extension non "distrugge" le ginocchia** con ROM e carico controllati: 0-60° in riabilitazione, 0-90° per ipertrofia, movimento lento.
**Leg curl**: movimento controllato senza slanci, ROM completo, eccentrica lenta di 3-4 secondi.
Riabilitazione LCA in palestra, sempre in accordo con il fisioterapista: 0-6 settimane mobilità e isometrie con leg extension 0-60°; 6-12 settimane leg curl, mezzo squat e pressa; 3-6 mesi squat completo e affondi senza valgo; da 6 mesi ritorno graduale ai sovraccarichi e alla pliometria, con test funzionali.
ROM fisiologici di riferimento: flessione ginocchio 130-150°, dorsiflessione caviglia a ginocchio flesso ~20°, flessione anca 120-130°.`,
  },
  {
    id: 'programmazione',
    triggers: [
      'scheda',
      'programma',
      'programmazione',
      'split',
      'frequenza',
      'volume',
      'serie settimanali',
      'quante serie',
      'quanti allenamenti',
      'mesociclo',
      'periodizzazione',
      'push pull',
      'full body',
    ],
    title: 'Programmazione',
    content: `### Programmazione
**Volume di riferimento: 10-20 serie allenanti per gruppo muscolare a settimana.** Sotto le 10 lo stimolo è probabilmente insufficiente, sopra le 20 il recupero diventa il fattore limitante (e va giustificato dal livello dell'atleta).
Struttura di una seduta: si aprono i fondamentali multiarticolari (quando il sistema nervoso è fresco), poi i complementari, infine l'isolamento. I multiarticolari sfruttano meglio il diagramma tensione-lunghezza perché preservano la lunghezza dei bi-articolari.
Bilanciamento dei pattern: per ogni spinta serve una trazione, per ogni movimento di ginocchio (squat/affondo) serve un movimento d'anca (hinge). Uno squilibrio spinta/trazione cronico è una delle cause più comuni di problemi di spalla.
Esempio di settimana per il basso: giorno 1 squat + affondi + complementari quadricipite + addominali; giorno 2 stacco + hip thrust + leg curl + hyperextension; giorno 3 front squat + bulgaro + leg extension + plank.
Progressione: si aumenta prima la qualità esecutiva, poi le ripetizioni nel range, poi il carico. Il rimbalzo a fine eccentrica (riflesso miotatico) rende la ripetizione più facile: il fermo la rende molto più dura, ed è una progressione a sé.`,
  },
  {
    id: 'tecnica',
    triggers: [
      'tecnica',
      'esecuzione',
      'come si fa',
      'cue',
      'respirazione',
      'valsalva',
      'apnea',
      'sbaglio',
      'errore',
    ],
    title: 'Tecnica ed esecuzione',
    content: `### Tecnica ed esecuzione
"L'esecuzione corretta non è il fine, è il mezzo": serve a mettere il carico dove vogliamo e a proteggere le articolazioni, non è un dogma estetico.
**Respirazione**: con carichi vicini al massimale negli esercizi compressivi (squat, stacco) si usa apnea + Valsalva — inspirazione profonda prima della ripetizione, respiro trattenuto in discesa e nella prima parte della risalita, espirazione a fine concentrica. Aumenta la pressione intra-addominale e protegge i dischi. Richiede un sistema cardiovascolare sano.
**Cervicale**: sguardo 2-3 metri davanti sul pavimento, lordosi cervicale fisiologica, mai iperestensione guardando il soffitto.
**Contrazioni**: concentrica in accorciamento (risalita), eccentrica in allungamento controllato (discesa), isometrica senza movimento (plank).
Didattica con neofiti: prima lo squat a corpo libero, poi il goblet con manubrio, poi il back squat; panca dietro come feedback tattile e specchio come feedback visivo.
Quando qualcuno "non riesce" a fare un esercizio, l'ordine di indagine è: apprendimento motorio (la gran parte dei casi), propriocezione, mobilità, retrazione, anatomia individuale, rigidità strutturale.`,
  },
  {
    id: 'cardio-recupero',
    triggers: [
      'cardio',
      'corsa',
      'hiit',
      'recupero',
      'riposo',
      'doms',
      'defaticamento',
      'overtraining',
      'sovrallenamento',
    ],
    title: 'Cardio e recupero',
    content: `### Cardio e recupero
Il cardio non è antagonista dell'ipertrofia se dosato: HIIT di 15-25 minuti (intervalli di 20-60 secondi ad alta intensità con 1-2 minuti di recupero) migliora sensibilità insulinica, EPOC e densità mitocondriale.
Il recupero è parte del programma, non una pausa dal programma: sonno 7-8 ore, gestione dello stress sistemico, scarichi programmati.
I DOMS non sono un indicatore di qualità dell'allenamento: sono un segnale di novità dello stimolo, non di crescita.
Segnali di allarme: calo di forza persistente, sonno peggiorato, articolazioni dolenti a freddo, motivazione crollata. Sono la richiesta di uno scarico, non di più volume.`,
  },
  {
    id: 'spalla-braccia',
    triggers: [
      'spalla',
      'spalle',
      'deltoidi',
      'panca',
      'petto',
      'pettorali',
      'dorso',
      'trazioni',
      'bicipiti',
      'tricipiti',
      'braccia',
      'lat machine',
      'rematore',
    ],
    title: 'Parte alta — note e miti',
    content: `### Parte alta
Il Volume 2 del libro copre tronco e arto inferiore: per la parte alta valgono comunque i principi generali di analisi del movimento e i miti anatomici già smontati.
**Non esistono "petto interno ed esterno"**: il grande pettorale è un muscolo unico, si può variare l'angolo di lavoro (inclinato, piano, declinato) ma non "isolare una porzione interna".
**Non esiste "bicipite alto e basso"**: si può cambiare l'angolo dell'omero (panca Scott, inclinata) modificando la lunghezza del capo lungo, non selezionare una porzione.
Bilanciamento: il rapporto tra spinte e trazioni va tenuto almeno 1:1, meglio sbilanciato verso le trazioni in chi passa la giornata seduto.
Il deltoide posteriore e i rotatori esterni sono cronicamente sotto-allenati rispetto ad anteriore e pettorale: è la combinazione che porta più spesso a problemi di spalla nel tempo.`,
  },
]
