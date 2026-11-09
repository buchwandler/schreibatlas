export type Locale = "de" | "en";
export type VerificationStatus = "draft" | "inferred" | "source-backed" | "reviewed" | "verified" | "deprecated";

type VerificationMessage = { label: string; explanation: string };
type Pillar = { title: string; description: string };

type MessageSet = {
  home: string;
  exploreNavigation: string;
  primaryNavigation: string;
  breadcrumbNavigation: string;
  languageNavigation: string;
  switchLanguage: string;
  skipToContent: string;
  footerLicense: string;
  project: string;
  homeTitle: string;
  homeDescription: string;
  heroEyebrow: string;
  heroTitle: string;
  heroIntro: string;
  demoTitle: string;
  demoDescription: string;
  pillarsTitle: string;
  pillars: Pillar[];
  promisesTitle: string;
  promises: string[];
  landingTitle: string;
  landingDescription: string;
  landingPrompt: string;
  languageNavigationShort: string;
  exploreTitle: string;
  exploreDescription: string;
  exploreIntro: string;
  modelSearchLabel: string;
  modelSearchPlaceholder: string;
  verificationFilter: string;
  allFilterOptions: string;
  modelCount: string;
  noModels: string;
  noSearchResults: string;
  viewModel: string;
  modelDetails: string;
  country: string;
  languages: string;
  period: string;
  useStatus: string;
  joined: string;
  slant: string;
  education: string;
  notRecorded: string;
  current: string;
  historical: string;
  currentOrHistorical: string;
  repertoire: string;
  repertoireEmpty: string;
  repertoireComplete: string;
  repertoireIncomplete: string;
  glyphRecords: string;
  noGlyphRecords: string;
  viewRepertoire: string;
  sources: string;
  noSources: string;
  sourceAuthor: string;
  sourcePublisher: string;
  sourceYear: string;
  sourcePages: string;
  sourceNotes: string;
  sourceOpen: string;
  placeholderSource: string;
  fontInformation: string;
  noFonts: string;
  fontCorrespondence: string;
  fontDegree: Record<string, string>;
  licenseAttribution: string;
  verification: Record<VerificationStatus, VerificationMessage>;
  backToModels: string;
  letterTitle: string;
  character: string;
  codePoints: string;
  unicodeOnly: string;
  normalizedGuidelines: string;
  noGuidelineMetrics: string;
  baseline: string;
  xHeight: string;
  capHeight: string;
  ascender: string;
  descender: string;
  glyphForms: string;
  isolatedForm: string;
  contextualForms: string;
  noContextualForms: string;
  connections: string;
  entryConnection: string;
  exitConnection: string;
  present: string;
  absent: string;
  unknown: string;
  variants: string;
  noVariants: string;
  strokeInstructions: string;
  strokeDiagramTitle: string;
  strokeAnimateOnce: string;
  strokeAnimationInitial: string;
  strokeAnimationReduced: string;
  strokeAnimationComplete: string;
  strokeAnimationError: string;
  strokeTimingNote: string;
  strokeAnimationLabel: string;
  strokeRecordedTimingNote: string;
  strokeAnimationPlaying: string;
  strokeNumber: string;
  direction: string;
  penContact: string;
  penDown: string;
  penUp: string;
  start: string;
  end: string;
  forward: string;
  reverse: string;
  noStrokeInstructions: string;
  practiceNavigation: string;
  practiceTitle: string;
  practiceDescription: string;
  practicePrivacy: string;
  practiceModel: string;
  practiceText: string;
  practiceTextPromptNote: string;
  practicePaper: string;
  practiceA4: string;
  practiceLetter: string;
  practiceMargin: string;
  practiceRowHeight: string;
  practiceGuides: string;
  practiceGuidesNone: string;
  practiceGuidesBaseline: string;
  practiceGuidesBaselineXheight: string;
  practiceReferenceRow: string;
  practiceTracingRows: string;
  practiceBlankRows: string;
  practiceRepetitions: string;
  practiceExportSvg: string;
  practicePrint: string;
  practiceCopyLink: string;
  practiceSettingsLink: string;
  practiceCopyLinkSuccess: string;
  practiceCopyLinkError: string;
  practiceLoading: string;
  practiceReady: string;
  practiceNoModels: string;
  practiceNoOutlines: string;
  practiceMissingOutlines: string;
  practiceOverflow: string;
  practiceReference: string;
  practiceTrace: string;
  practiceBlank: string;
  practicePromptPrefix: string;
  practiceGuideLegend: string;
  practiceSvgTitle: string;
  practiceGuideBaselineLabel: string;
  practiceGuideXHeightLabel: string;
  practiceContextLimit: string;
  practiceProvenance: string;
  practiceSourceCredits: string;
  practiceStatusError: string;
  writeNavigation: string;
  writeTitle: string;
  writeDescription: string;
  writePrivacy: string;
  writeModel: string;
  writeCharacter: string;
  writeReferenceOverlay: string;
  writeReferenceOpacity: string;
  writeSurfaceLabel: string;
  writeSurfaceInstructions: string;
  writeKeyboardInstructions: string;
  writeClear: string;
  writeReset: string;
  writeExportJson: string;
  writeExportSvg: string;
  writeStatusLoading: string;
  writeStatusReady: string;
  writeStatusCaptured: string;
  writeStatusError: string;
  writeStatusInvalidCharacter: string;
  writeStatusReferenceLoading: string;
  writeStatusReferenceReady: string;
  writeStatusNoReference: string;
  writeMetricTitle: string;
  writeMetricStrokes: string;
  writeMetricSamples: string;
  writeMetricPathLength: string;
  writeMetricWidth: string;
  writeMetricHeight: string;
  writeMetricDuration: string;
  writeMetricPressureSamples: string;
  writeMetricNoPressure: string;
  writeMetricsLimit: string;
  writeReferenceDisclaimer: string;
  writeProvenance: string;
  writeProvenanceEmpty: string;
  analysisNavigation: string;
  analysisTitle: string;
  analysisDescription: string;
  analysisRequiresJavascript: string;
  analysisPrivacy: string;
  offlineStatusPending: string;
  offlineStatusAssetsCached: string;
  offlineStatusReady: string;
  offlineStatusIncomplete: string;
  offlineStatusUnavailable: string;
  analysisImage: string;
  analysisImageHelp: string;
  analysisWorksheetFile: string;
  analysisWorksheetNoReference: string;
  analysisWorksheetBlankRow: string;
  analysisWorksheetNoInk: string;
  analysisWorksheetHelp: string;
  analysisWorksheetReferenceReady: string;
  analysisWorksheetReferenceInvalid: string;
  analysisWorksheetRecognized: string;
  analysisWorksheetUnavailable: string;
  analysisWorksheetLowConfidence: string;
  analysisWorksheetWritingAvailable: string;
  analysisWorksheetWritingUnavailable: string;
  analysisWorksheetRepeatedAvailable: string;
  analysisExpectedText: string;
  analysisModel: string;
  analysisCropHelp: string;
  analysisResetCrop: string;
  analysisRun: string;
  analysisClear: string;
  analysisExportJson: string;
  analysisExportOverlay: string;
  analysisReset: string;
  analysisStatusIdle: string;
  analysisStatusProcessing: string;
  analysisStatusComplete: string;
  analysisStatusExported: string;
  analysisStatusExportError: string;
  analysisStatusNoFile: string;
  analysisStatusFileType: string;
  analysisStatusFileSize: string;
  analysisStatusDimensions: string;
  analysisStatusDecodeError: string;
  analysisStatusExpected: string;
  analysisStatusCorners: string;
  analysisOriginalPreview: string;
  analysisRectifiedPreview: string;
  analysisMaskPreview: string;
  analysisResults: string;
  analysisDetectedLineCount: string;
  analysisDeskew: string;
  analysisDeskewConfidenceLow: string;
  analysisDeskewConfidenceMedium: string;
  analysisThreshold: string;
  analysisThresholdUnavailable: string;
  analysisForegroundPixels: string;
  analysisLine: string;
  analysisLineHeight: string;
  analysisSlope: string;
  analysisWritingWidth: string;
  analysisBaselineCandidate: string;
  analysisBaselineConfidenceLow: string;
  analysisBaselineNote: string;
  analysisBaselineVariation: string;
  analysisLineSpacing: string;
  analysisLineSpacingUnavailable: string;
  analysisCornerTopLeft: string;
  analysisCornerTopRight: string;
  analysisCornerBottomRight: string;
  analysisCornerBottomLeft: string;
  analysisNoLines: string;
  analysisOverlayPreview: string;
  analysisWordGaps: string;
  analysisWordGapsUnavailable: string;
  compareTitle: string;
  compareDescription: string;
  compareCharacter: string;
  compareModelA: string;
  compareModelB: string;
  compareCountry: string;
  allCountries: string;
  compareMode: string;
  sideBySide: string;
  overlay: string;
  opacity: string;
  showBaseline: string;
  showXHeight: string;
  showBounds: string;
  shareUrl: string;
  copyLink: string;
  copySuccess: string;
  copyError: string;
  loadingGlyphs: string;
  noComparableGlyphs: string;
  noVectorOutline: string;
  glyphLoadError: string;
  comparisonSummary: string;
  outlineDisclaimer: string;
  wordTitle: string;
  wordDescription: string;
  wordInputLabel: string;
  wordInputPlaceholder: string;
  wordFontA: string;
  wordFontB: string;
  wordPreview: string;
  wordShapingNotice: string;
  wordFontLimitations: string;
  wordNoFont: string;
  wordNoCalibration: string;
  wordNoFiles: string;
  wordEmptyText: string;
  wordLoadError: string;
  wordLoading: string;
  wordSummary: string;
};

export const messages: Record<Locale, MessageSet> = {
  de: {
    home: "Startseite",
    exploreNavigation: "Atlas erkunden",
    primaryNavigation: "Hauptnavigation",
    breadcrumbNavigation: "Brotkrumennavigation",
    languageNavigation: "Sprache auswählen",
    switchLanguage: "English",
    skipToContent: "Zum Inhalt springen",
    footerLicense: "Inhalte: CC BY-SA 4.0 · Software: Apache-2.0",
    project: "Offener Handschriftatlas",
    homeTitle: "Handschriftmodelle erkunden",
    homeDescription: "Ein offener, quellenbasierter Atlas für Handschriftmodelle, Buchstabenformen und lokale Analyse.",
    heroEyebrow: "Buchwandler · Open handwriting reference",
    heroTitle: "Handschriftmodelle offen erkunden",
    heroIntro: "Schreibatlas baut einen quellenbasierten, maschinenlesbaren Atlas für Handschriftmodelle und Buchstabenformen auf.",
    demoTitle: "Demo-Daten, keine verifizierten Standards",
    demoDescription: "Die vorhandenen Modelleinträge sind synthetische UI-Platzhalter. Es gibt noch keine belegten Glyphen oder Schreibanweisungen.",
    pillarsTitle: "Vier miteinander verbundene Bereiche",
    pillars: [
      { title: "Erkunden", description: "Modelle, Repertoires und Buchstaben anhand nachvollziehbarer Quellen dokumentieren." },
      { title: "Lernen", description: "Schreibhinweise und Übungsmaterial nur dann zeigen, wenn Inhalt und Herkunft klar gekennzeichnet sind." },
      { title: "Vergleichen", description: "Buchstabenformen auf einer gemeinsamen Grundlinie und x-Höhe gegenüberstellen." },
      { title: "Analysieren", description: "Geometrische Maße später lokal im Browser berechnen, ohne Handschriftbilder hochzuladen." },
    ],
    promisesTitle: "Offen und datenschutzfreundlich",
    promises: [
      "Maschinenlesbare Daten und wiederverwendbare statische Exporte sind das Projektziel.",
      "Quellen und Prüfstatus gehören sichtbar zu jedem fachlichen Datensatz.",
      "Fotoanalyse ist noch nicht verfügbar. Direkte lokale Stifterfassung gibt es unter Lokal schreiben.",
    ],
    landingTitle: "Sprache wählen",
    landingDescription: "Wähle Deutsch oder Englisch für den Schreibatlas.",
    landingPrompt: "Sprache auswählen / Choose a language",
    languageNavigationShort: "Sprache / Language",
    exploreTitle: "Handschriftmodelle",
    exploreDescription: "Durchsuche die dokumentierten Schreibmodelle und ihre Quellen.",
    exploreIntro: "Die Liste wird aus den validierten Modelldatensätzen erzeugt. Demo-Einträge sind ausdrücklich als unverifiziert gekennzeichnet.",
    modelSearchLabel: "Modelle suchen",
    modelSearchPlaceholder: "Name oder Beschreibung",
    verificationFilter: "Prüfstatus",
    allFilterOptions: "Alle",
    modelCount: "{count} Modelle",
    noModels: "Es sind noch keine Modelle eingetragen.",
    noSearchResults: "Keine Modelle passen zu den aktuellen Filtern.",
    viewModel: "Modell öffnen",
    modelDetails: "Modelldaten",
    country: "Land",
    languages: "Sprachen",
    period: "Zeitraum",
    useStatus: "Verwendung",
    joined: "Verbundene Schrift",
    education: "Pädagogischer Kontext",
    slant: "Neigung",
    notRecorded: "Nicht dokumentiert",
    current: "Gegenwärtig",
    historical: "Historisch",
    currentOrHistorical: "Gegenwärtig oder historisch",
    repertoire: "Buchstabenrepertoire",
    repertoireEmpty: "Für dieses Modell sind keine Zeichen eingetragen. Das sagt nichts über ein tatsächliches Alphabet aus.",
    repertoireComplete: "Das Repertoire ist als vollständig markiert und gegen die vorhandenen Glyphendatensätze geprüft.",
    repertoireIncomplete: "Das aufgeführte Repertoire ist nicht als vollständig belegt.",
    glyphRecords: "Dokumentierte Glyphen",
    noGlyphRecords: "Für dieses Modell gibt es noch keine Glyphendatensätze.",
    viewRepertoire: "Repertoire ansehen",
    sources: "Quellen und Herkunft",
    noSources: "Für diesen Datensatz sind keine Quellen eingetragen.",
    sourceAuthor: "Autorenschaft",
    sourcePublisher: "Herausgeber",
    sourceYear: "Jahr",
    sourcePages: "Fundstelle",
    sourceNotes: "Hinweise",
    sourceOpen: "Quelle öffnen",
    placeholderSource: "Projektplatzhalter, kein fachlicher Beleg",
    fontInformation: "Referenzschriften",
    noFonts: "Keine Referenzschrift ist für dieses Modell registriert.",
    fontCorrespondence: "Übereinstimmung mit dem Modell",
    fontDegree: { complete: "Vollständig", partial: "Teilweise", "visual-only": "Nur visuell", unknown: "Unbekannt" },
    licenseAttribution: "Lizenz und Namensnennung",
    verification: {
      draft: { label: "Entwurf", explanation: "Unvollständige Arbeitsdaten, keine Aussage über einen anerkannten Handschriftstandard." },
      inferred: { label: "Abgeleitet", explanation: "Begründete Rekonstruktion, nicht direkt dokumentiert." },
      "source-backed": { label: "Mit Quellen belegt", explanation: "Mit Quellen verknüpft, aber nicht unabhängig überprüft." },
      reviewed: { label: "Geprüft", explanation: "Von Beitragenden anhand der angegebenen Quellen geprüft." },
      verified: { label: "Verifiziert", explanation: "Höchste projektinterne Vertrauensstufe nach dem dokumentierten Prüfverfahren." },
      deprecated: { label: "Veraltet", explanation: "Zur Dokumentation erhalten, aber nicht als aktueller Datensatz verwenden." },
    },
    backToModels: "Zur Modellübersicht",
    letterTitle: "Buchstabe",
    character: "Zeichen",
    codePoints: "Unicode-Codepunkte",
    unicodeOnly: "Dieses Zeichen ist nur als Unicode-Textbezeichnung vorhanden, nicht als Handschriftprobe.",
    normalizedGuidelines: "Normalisierte Schreibrichtlinien",
    noGuidelineMetrics: "Es sind keine normalisierten Grundlinien- und Höhenmaße dokumentiert.",
    baseline: "Grundlinie",
    xHeight: "x-Höhe",
    capHeight: "Versalhöhe",
    ascender: "Oberlänge",
    descender: "Unterlänge",
    glyphForms: "Formen",
    isolatedForm: "Einzelform",
    contextualForms: "Kontextformen",
    noContextualForms: "Keine Kontextformen dokumentiert.",
    connections: "Verbindungen",
    entryConnection: "Anschluss",
    exitConnection: "Abschluss",
    present: "Vorhanden",
    absent: "Nicht vorhanden",
    unknown: "Unbekannt",
    variants: "Varianten",
    noVariants: "Keine Varianten dokumentiert.",
    strokeInstructions: "Schreibbewegungen",
    strokeDiagramTitle: "Statische Strichdiagramme",
    strokeAnimateOnce: "Ablauf einmal abspielen",
    strokeAnimationInitial: "Die Animation startet erst auf Wunsch und wird nicht wiederholt.",
    strokeAnimationReduced: "Animation wegen der Einstellung für reduzierte Bewegung deaktiviert. Statische Diagramme und Schrittangaben bleiben verfügbar.",
    strokeAnimationComplete: "Animation abgeschlossen. Es wurde keine Wiederholung gestartet.",
    strokeAnimationError: "Animation nicht verfügbar. Statische Diagramme und Schrittangaben bleiben verfügbar.",
    strokeTimingNote: "Für Schritte ohne belegte Zeitangabe wird eine illustrative Wiedergabedauer verwendet; sie ist keine Schreibzeit.",
    strokeAnimationLabel: "Illustrative Strichanimation",
    strokeRecordedTimingNote: "Die Animation verwendet die im Datensatz dokumentierten Zeitangaben.",
    strokeAnimationPlaying: "Die Strichanimation wird einmalig abgespielt.",
    noStrokeInstructions: "Es liegen keine belegten Schreibbewegungen vor. Es werden keine allgemeinen Anweisungen ergänzt.",
    practiceNavigation: "Übungsblatt",
    practiceTitle: "Übungsblatt erstellen",
    practiceDescription: "Erzeuge ein druckbares Übungsblatt aus lokal verfügbaren, belegten Vektorkonturen und leeren Schreibzeilen.",
    practicePrivacy: "Übungstext und Einstellungen bleiben lokal. Der teilbare Einstellungslink speichert sie im URL-Fragment, nicht in einer Serveranfrage.",
    practiceModel: "Handschriftmodell",
    practiceText: "Übungstext",
    practiceTextPromptNote: "Der getippte Text ist nur ein Aufgabenhinweis. Er ist keine Handschriftvorlage.",
    practicePaper: "Papierformat",
    practiceA4: "A4",
    practiceLetter: "US Letter",
    practiceMargin: "Rand (mm)",
    practiceRowHeight: "Zeilenhöhe (mm)",
    practiceGuides: "Schreibhilfslinien",
    practiceGuidesNone: "Keine Linien",
    practiceGuidesBaseline: "Grundlinie",
    practiceGuidesBaselineXheight: "Grundlinie und x-Höhe",
    practiceReferenceRow: "Belegte Referenzzeile einfügen",
    practiceTracingRows: "Nachspurzeilen je Wiederholung",
    practiceBlankRows: "Leere Zeilen je Wiederholung",
    practiceRepetitions: "Wiederholungen",
    practiceExportSvg: "SVG herunterladen",
    practicePrint: "Drucken",
    practiceCopyLink: "Einstellungslink kopieren",
    practiceSettingsLink: "Einstellungslink",
    practiceCopyLinkSuccess: "Einstellungslink kopiert.",
    practiceCopyLinkError: "Link konnte nicht kopiert werden. Du kannst ihn aus dem Feld kopieren.",
    practiceLoading: "Lokale Konturdaten werden geladen …",
    practiceReady: "Übungsblatt erstellt. Belegte Konturen: {supported}.",
    practiceNoModels: "Es sind keine Modelle für Übungsblätter verfügbar.",
    practiceNoOutlines: "Für den Text liegen keine belegten Vektorkonturen vor. Es werden nur der Text-Hinweis und leere Übungszeilen ausgegeben.",
    practiceMissingOutlines: "Für einige Zeichen fehlen belegte Konturen. Diese Stellen bleiben leer.",
    practiceOverflow: "Einige Konturen passen nicht in die Zeile und wurden ausgelassen.",
    practiceReference: "Referenz",
    practiceTrace: "Nachspur",
    practiceBlank: "Leer",
    practicePromptPrefix: "Aufgabentext",
    practiceGuideLegend: "Hilfslinien sind Layout-Hilfen, keine verifizierten Modellmaße.",
    practiceSvgTitle: "Schreibatlas-Übungsblatt",
    practiceGuideBaselineLabel: "Grundlinie",
    practiceGuideXHeightLabel: "x-Höhe",
    practiceContextLimit: "Vektorkonturen werden einzeln als isolierte Endformen gezeigt. Verbindungen oder Schreibbewegungen werden nicht ergänzt.",
    practiceProvenance: "Quellen und Lizenzhinweise",
    practiceSourceCredits: "Quellen: {sources} · Lizenz: {license} · Status: {status}",
    practiceStatusError: "Lokale Übungsdaten konnten nicht geladen werden.",
    writeNavigation: "Lokal schreiben",
    writeTitle: "Handschrift lokal erfassen",
    writeDescription: "Zeichne direkt im Browser und untersuche nur die Geometrie deiner lokalen Stiftbewegungen.",
    writePrivacy: "Die Erfassung bleibt im Arbeitsspeicher dieses Tabs. Es gibt keinen Upload. Daten werden nur heruntergeladen, wenn du den Export ausdrücklich startest.",
    writeModel: "Handschriftmodell für Referenz",
    writeCharacter: "Referenzzeichen",
    writeReferenceOverlay: "Belegte isolierte Endform einblenden",
    writeReferenceOpacity: "Deckkraft der Referenz",
    writeSurfaceLabel: "Zeichenfläche",
    writeSurfaceInstructions: "Zeichne mit Maus, Stift oder Touch. Die Oberfläche speichert getrennte Striche und pen-up/pen-down-Zeitpunkte.",
    writeKeyboardInstructions: "Tastatur: Pfeiltasten bewegen den Cursor, Leertaste setzt den Stift auf oder hebt ihn ab, Escape hebt ihn ab.",
    writeClear: "Zeichnung löschen",
    writeReset: "Zurücksetzen",
    writeExportJson: "Messdaten als JSON exportieren",
    writeExportSvg: "Zeichnung als SVG exportieren",
    writeStatusLoading: "Lokale Referenzdaten werden geladen …",
    writeStatusReady: "Bereit. Zeichne mit Maus, Stift, Touch oder Tastatur.",
    writeStatusCaptured: "Erfasst: {strokes} Striche und {samples} Stichproben.",
    writeStatusError: "Lokale Referenzdaten konnten nicht geladen werden. Die Zeichenerfassung bleibt verfügbar.",
    writeStatusInvalidCharacter: "Gib genau ein Schriftzeichen ein, um eine optionale Referenzform zu suchen.",
    writeStatusReferenceLoading: "Belegte Referenzkontur wird lokal geladen …",
    writeStatusReferenceReady: "Isolierte Endform als Referenz geladen. Sie zeigt keine Schreibbewegung.",
    writeStatusNoReference: "Keine belegte Vektor-Endform für dieses Zeichen verfügbar. Die Fläche bleibt ohne Referenz.",
    writeMetricTitle: "Erfasste Geometrie",
    writeMetricStrokes: "Getrennte Striche",
    writeMetricSamples: "Stichproben einschließlich Stift-Hebungen",
    writeMetricPathLength: "Weglänge (Zeichenflächen-Einheiten)",
    writeMetricWidth: "Breite der erfassten Grenzen",
    writeMetricHeight: "Höhe der erfassten Grenzen",
    writeMetricDuration: "Erfassungsdauer (ms)",
    writeMetricPressureSamples: "Stichproben mit Druckwert",
    writeMetricNoPressure: "Das Gerät hat keine Druckwerte gemeldet.",
    writeMetricsLimit: "Diese Maße beschreiben nur die erfasste Bewegung. Sie bewerten weder Handschriftqualität noch Übereinstimmung mit einem Standard.",
    writeReferenceDisclaimer: "Eine Referenzkontur ist eine isolierte Endform aus dem Datensatz, keine Strichfolge und keine Schreibanleitung.",
    writeProvenance: "Herkunft der Referenzkontur",
    writeProvenanceEmpty: "Keine Referenzkontur ausgewählt.",
    analysisNavigation: "Fotoanalyse",
    analysisTitle: "Handschriftfoto lokal untersuchen",
    analysisDescription: "Ein Foto lokal entzerren und vorläufige geometrische Zeilenmerkmale berechnen. Erwarteten Text und Modell gibst du nur als Kontext an; es gibt keine OCR oder Modellbewertung.",
    analysisRequiresJavascript: "JavaScript ist erforderlich, damit dieses Foto lokal im Browser verarbeitet werden kann.",
    analysisPrivacy: "Das Bild und alle berechneten Pixel bleiben im Arbeitsspeicher dieses Tabs. Nichts wird hochgeladen oder automatisch gespeichert. Messdaten oder die Overlay-Grafik werden nur über deinen ausdrücklichen Download exportiert; der Offline-Cache enthält statische Seitenressourcen. Beim Löschen werden Vorschau-URL und Arbeitsdaten freigegeben.",
    offlineStatusPending: "Offline-Caching wird eingerichtet.",
    offlineStatusAssetsCached: "Seite und statische Ressourcen sind zwischengespeichert; der Analyse-Worker wird geladen.",
    offlineStatusReady: "Offline bereit: Seite und Analyse-Worker sind auf diesem Gerät zwischengespeichert.",
    offlineStatusIncomplete: "Offline-Cache unvollständig. Öffne die Seite online und versuche es erneut.",
    offlineStatusUnavailable: "Offline-Caching wird in diesem Browser nicht unterstützt.",
    analysisImage: "Lokales Foto auswählen",
    analysisImageHelp: "Unterstützt werden PNG, JPEG und WebP. Die lokale Verarbeitung ist auf 20 MB und 18 Megapixel begrenzt.",
    analysisWorksheetFile: "Passendes Schreibatlas-Arbeitsblatt (SVG, optional)",
    analysisWorksheetNoReference: "Kein Arbeitsblatt-SVG geladen. Die Analyse verwendet den gewählten manuellen Ausschnitt.",
    analysisWorksheetBlankRow: "Leere Zeile",
    analysisWorksheetNoInk: "keine erkannte Tinte",
    analysisWorksheetHelp: "Wähle das lokal gespeicherte SVG des Arbeitsblatts. Es wird nur lokal gelesen und liefert bekannte Seiten- und Schreibzeilenmaße.",
    analysisWorksheetReferenceReady: "Arbeitsblattreferenz lokal geladen: ",
    analysisWorksheetReferenceInvalid: "Die Datei enthält keine gültigen Schreibatlas-Arbeitsblattmetadaten.",
    analysisWorksheetRecognized: "Arbeitsblattmarker erkannt. Schreibzeilen sind in Millimetern kalibriert.",
    analysisWorksheetUnavailable: "Arbeitsblattmarker nicht zuverlässig erkannt. Es werden keine kalibrierten Zeilenmessungen erstellt.",
    analysisWorksheetLowConfidence: "Markererkennung hat zu geringe Sicherheit. Es werden keine kalibrierten Zeilenmessungen erstellt.",
    analysisWorksheetWritingAvailable: "Kalibrierte Messungen der leeren Zeilen verfügbar. Keine Bewertung der Handschrift.",
    analysisWorksheetWritingUnavailable: "Einzelzeichen wurden nicht sicher getrennt. Zeichenwerte und Formgruppen bleiben unverfügbar.",
    analysisWorksheetRepeatedAvailable: "Lokale Formgruppen für das erwartete Wiederholungszeichen",
    analysisExpectedText: "Erwarteter Text",
    analysisModel: "Handschriftmodell (nur Kontext)",
    analysisCropHelp: "Ziehe die vier Eckpunkte auf die Seitenränder oder verschiebe sie fokussiert mit den Pfeiltasten. Das Viereck wird lokal ausgeschnitten und perspektivisch entzerrt.",
    analysisResetCrop: "Eckpunkte zurücksetzen",
    analysisRun: "Lokal analysieren",
    analysisClear: "Bild und Ergebnisse löschen",
    analysisExportJson: "Messdaten als JSON herunterladen",
    analysisExportOverlay: "Analyse-Overlay als PNG herunterladen",
    analysisReset: "Zurücksetzen",
    analysisStatusIdle: "Wähle ein Bild aus und prüfe die vier Eckpunkte.",
    analysisStatusProcessing: "Bild wird lokal im Web Worker verarbeitet …",
    analysisStatusComplete: "Lokale Verarbeitung abgeschlossen.",
    analysisStatusExported: "Der ausgewählte Export wurde lokal heruntergeladen.",
    analysisStatusExportError: "Der lokale Download konnte nicht erstellt werden.",
    analysisStatusNoFile: "Wähle zuerst ein Bild aus.",
    analysisStatusFileType: "Wähle eine PNG-, JPEG- oder WebP-Bilddatei.",
    analysisStatusFileSize: "Die Datei überschreitet das lokale Limit von 20 MB.",
    analysisStatusDimensions: "Das Bild überschreitet das lokale Limit von 18 Megapixeln.",
    analysisStatusDecodeError: "Das Bild konnte lokal nicht dekodiert werden.",
    analysisStatusExpected: "Gib den erwarteten Text ein. Er wird nicht automatisch erkannt.",
    analysisStatusCorners: "Die vier Eckpunkte müssen ein gültiges, nicht überlappendes Viereck bilden.",
    analysisOriginalPreview: "Lokale Bildvorschau und manuelle Ecken",
    analysisRectifiedPreview: "Entzerrtes und leicht begradigtes Bild",
    analysisMaskPreview: "Schwarz-Weiß-Maske",
    analysisResults: "Vorläufige lokale Bildmerkmale",
    analysisDetectedLineCount: "Erkannte Zeilenbereiche",
    analysisDeskew: "Automatische Drehkorrektur (Grad)",
    analysisDeskewConfidenceLow: "niedrig (heuristisch)",
    analysisDeskewConfidenceMedium: "mittel (heuristisch)",
    analysisThreshold: "Otsu-Schwellwert",
    analysisThresholdUnavailable: "Nicht verfügbar (unzureichender Kontrast)",
    analysisForegroundPixels: "Vordergrundpixel",
    analysisLine: "Zeile",
    analysisLineHeight: "Bildbereichshöhe (Pixel)",
    analysisSlope: "Neigung",
    analysisWritingWidth: "Bildbereichsbreite (Pixel)",
    analysisBaselineCandidate: "Kandidat der unteren Tintenkante",
    analysisBaselineNote: "Dies ist nur eine schwache Näherung aus der unteren Tintenkante, keine bestätigte Schreibgrundlinie.",
    analysisBaselineVariation: "Abweichung der unteren Tintenkante (Pixel)",
    analysisBaselineConfidenceLow: "niedrige Sicherheit (Heuristik)",
    analysisLineSpacing: "Abstand der Zeilenmitten (Pixel)",
    analysisLineSpacingUnavailable: "Nicht verfügbar (weniger als zwei Zeilenbereiche)",
    analysisCornerTopLeft: "Linke obere Bildecke des Ausschnitts",
    analysisCornerTopRight: "Rechte obere Bildecke des Ausschnitts",
    analysisCornerBottomRight: "Rechte untere Bildecke des Ausschnitts",
    analysisCornerBottomLeft: "Linke untere Bildecke des Ausschnitts",
    analysisNoLines: "Es wurden keine ausreichend zusammenhängenden Zeilenbereiche erkannt.",
    analysisOverlayPreview: "Tintenmaske (rot), Zeilenbereich (blau) und Basiskandidat (orange gestrichelt)",
    analysisWordGaps: "Wortabstände",
    analysisWordGapsUnavailable: "Nicht verfügbar (keine OCR oder Wortsegmentierung)",
    strokeNumber: "Strich {number}",
    direction: "Richtung",
    penContact: "Stiftkontakt",
    penDown: "aufgesetzt",
    penUp: "abgehoben",
    start: "Start",
    end: "Ende",
    forward: "Vorwärts",
    reverse: "Rückwärts",
    compareTitle: "Buchstaben vergleichen",
    compareDescription: "Vergleiche belegte Vektorformen mit gemeinsamer Grundlinie und x-Höhe. Die Formen zeigen Endkonturen, keine Schreibbewegungen.",
    compareCharacter: "Zeichen",
    compareModelA: "Modell A",
    compareModelB: "Modell B",
    compareCountry: "Land filtern",
    allCountries: "Alle Länder",
    compareMode: "Ansicht",
    sideBySide: "Nebeneinander",
    overlay: "Überlagerung",
    opacity: "Deckkraft von Modell B",
    showBaseline: "Grundlinie anzeigen",
    showXHeight: "x-Höhe anzeigen",
    showBounds: "Begrenzungsrahmen anzeigen",
    shareUrl: "Teilbarer Vergleichslink",
    copyLink: "Link kopieren",
    copySuccess: "Vergleichslink kopiert.",
    copyError: "Link konnte nicht automatisch kopiert werden. Das Eingabefeld kann manuell kopiert werden.",
    loadingGlyphs: "Glyphendaten werden geladen …",
    noComparableGlyphs: "Es sind noch keine Glyphendatensätze vorhanden. Es werden keine Schriftzeichen als Ersatz-Handschriftformen gezeigt.",
    noVectorOutline: "Für diese Glyphendaten ist keine belegte Vektorform verfügbar.",
    glyphLoadError: "Die lokalen Glyphendaten konnten nicht geladen werden.",
    comparisonSummary: "Vergleich von {character}: Modell A {modelA}, Modell B {modelB}. Beide Formen verwenden Grundlinie 0 und x-Höhe 1.",
    wordTitle: "Wörter vergleichen",
    wordDescription: "Gib einen bekannten Text ein und vergleiche nur lokal registrierte Referenzschriften. Die Eingabe wird nicht übertragen.",
    wordInputLabel: "Vergleichstext",
    wordInputPlaceholder: "Text eingeben",
    wordFontA: "Referenzschrift für Modell A",
    wordFontB: "Referenzschrift für Modell B",
    wordPreview: "Wörtliche Texteingabe, keine Handschriftprobe",
    wordShapingNotice: "Der Browser übernimmt OpenType-Textformung. Eine normalisierte Darstellung setzt eine belegte x-Höhenkalibrierung voraus.",
    wordFontLimitations: "Schriftkonturen zeigen Endformen, keine Schreibbewegungen. Der Übereinstimmungsgrad und seine Grenzen bleiben sichtbar. Fehlen Zeichen in der Datei, kann der Browser auf eine andere Schrift zurückgreifen; solche Formen sind nicht dem Modell zuzurechnen.",
    wordNoFont: "Für dieses Modell ist keine lokale Referenzschrift registriert. Es wird keine Systemschrift als Handschrift-Ersatz verwendet.",
    wordNoCalibration: "Für diese Referenzschrift fehlt eine belegte x-Höhenkalibrierung. Eine normalisierte Darstellung ist nicht verfügbar.",
    wordNoFiles: "Für diese Referenzschrift sind keine lokal nutzbaren Schriftdateien registriert.",
    wordEmptyText: "Gib Text ein, um den wörtlichen Vorschautext zu sehen.",
    wordLoadError: "Die lokale Referenzschrift konnte nicht geladen werden.",
    wordLoading: "Lokale Referenzschriften werden geladen …",
    wordSummary: "Textvergleich für Modell A {modelA} und Modell B {modelB}.",
    outlineDisclaimer: "Vektorkonturen zeigen dokumentierte Endformen. Sie sind keine Schreibbewegungen oder Strichreihenfolge.",
  },
  en: {
    home: "Home",
    exploreNavigation: "Explore atlas",
    primaryNavigation: "Primary navigation",
    breadcrumbNavigation: "Breadcrumbs",
    languageNavigation: "Choose language",
    switchLanguage: "Deutsch",
    skipToContent: "Skip to content",
    footerLicense: "Content: CC BY-SA 4.0 · Software: Apache-2.0",
    project: "Open handwriting atlas",
    homeTitle: "Explore handwriting models",
    homeDescription: "An open, source-backed atlas for handwriting models, letterforms, and local analysis.",
    heroEyebrow: "Buchwandler · Open handwriting reference",
    heroTitle: "Explore handwriting models openly",
    heroIntro: "Schreibatlas is building a source-backed, machine-readable atlas of handwriting models and letterforms.",
    demoTitle: "Demo data, not verified standards",
    demoDescription: "The current model records are synthetic UI placeholders. There are no source-backed glyphs or writing instructions yet.",
    pillarsTitle: "Four connected areas",
    pillars: [
      { title: "Explore", description: "Document models, repertoires, and letters with traceable sources." },
      { title: "Learn", description: "Present writing guidance and practice material only with clear status and provenance." },
      { title: "Compare", description: "Compare letterforms against a shared baseline and x-height." },
      { title: "Analyze", description: "Later, measure geometry locally in the browser without uploading handwriting images." },
    ],
    promisesTitle: "Open and privacy-conscious",
    promises: [
      "Machine-readable data and reusable static exports are project goals.",
      "Sources and verification status belong alongside every factual record.",
      "Photo analysis is not available yet. Direct local pen capture is available under Write locally.",
    ],
    landingTitle: "Choose a language",
    landingDescription: "Choose German or English for the Schreibatlas handwriting atlas.",
    landingPrompt: "Choose a language / Sprache auswählen",
    languageNavigationShort: "Language / Sprache",
    exploreTitle: "Handwriting models",
    exploreDescription: "Browse the documented handwriting models and their sources.",
    exploreIntro: "This list is generated from validated model records. Demo entries are explicitly marked as unverified.",
    modelSearchLabel: "Search models",
    modelSearchPlaceholder: "Name or description",
    verificationFilter: "Verification status",
    allFilterOptions: "All",
    modelCount: "{count} models",
    noModels: "No models have been recorded yet.",
    noSearchResults: "No models match the current filters.",
    viewModel: "Open model",
    modelDetails: "Model record",
    country: "Country",
    languages: "Languages",
    period: "Period",
    useStatus: "Use status",
    joined: "Joined writing",
    slant: "Slant",
    education: "Educational context",
    notRecorded: "Not recorded",
    current: "Current",
    historical: "Historical",
    currentOrHistorical: "Current or historical",
    repertoire: "Character repertoire",
    repertoireEmpty: "No characters are listed for this model. This does not describe an actual alphabet.",
    repertoireComplete: "The repertoire is marked complete and checked against the available glyph records.",
    repertoireIncomplete: "The listed repertoire is not documented as complete.",
    glyphRecords: "Documented glyphs",
    noGlyphRecords: "There are no glyph records for this model yet.",
    viewRepertoire: "View repertoire",
    sources: "Sources and provenance",
    noSources: "No sources are recorded for this entry.",
    sourceAuthor: "Author",
    sourcePublisher: "Publisher",
    sourceYear: "Year",
    sourcePages: "Locator",
    sourceNotes: "Notes",
    sourceOpen: "Open source",
    placeholderSource: "Project placeholder, not subject-matter evidence",
    fontInformation: "Reference fonts",
    noFonts: "No reference font is registered for this model.",
    fontCorrespondence: "Correspondence to the model",
    fontDegree: { complete: "Complete", partial: "Partial", "visual-only": "Visual only", unknown: "Unknown" },
    licenseAttribution: "License and attribution",
    verification: {
      draft: { label: "Draft", explanation: "Incomplete working data, not a claim about a recognized handwriting standard." },
      inferred: { label: "Inferred", explanation: "A reasoned reconstruction, not directly documented." },
      "source-backed": { label: "Source-backed", explanation: "Linked to evidence but not independently reviewed." },
      reviewed: { label: "Reviewed", explanation: "Checked by contributors against the listed sources." },
      verified: { label: "Verified", explanation: "Highest project-level confidence under the documented review process." },
      deprecated: { label: "Deprecated", explanation: "Retained for documentation, but should not be used as current data." },
    },
    backToModels: "Back to model index",
    letterTitle: "Letter",
    character: "Character",
    codePoints: "Unicode code points",
    unicodeOnly: "This character is shown only as a Unicode text label, not as a handwriting sample.",
    normalizedGuidelines: "Normalized writing guidelines",
    noGuidelineMetrics: "No normalized baseline and height measurements are recorded.",
    baseline: "Baseline",
    xHeight: "x-height",
    capHeight: "Cap height",
    ascender: "Ascender",
    descender: "Descender",
    glyphForms: "Forms",
    isolatedForm: "Isolated form",
    contextualForms: "Contextual forms",
    noContextualForms: "No contextual forms are documented.",
    connections: "Connections",
    entryConnection: "Entry",
    exitConnection: "Exit",
    present: "Present",
    absent: "Absent",
    unknown: "Unknown",
    variants: "Variants",
    noVariants: "No variants are documented.",
    strokeInstructions: "Writing movements",
    strokeDiagramTitle: "Static stroke diagrams",
    strokeAnimateOnce: "Play sequence once",
    strokeAnimationInitial: "Animation starts only on request and does not loop.",
    strokeAnimationReduced: "Animation disabled by the reduced-motion preference. Static diagrams and written steps remain available.",
    strokeAnimationComplete: "Animation complete. It will not repeat automatically.",
    strokeAnimationError: "Animation unavailable. Static diagrams and written steps remain available.",
    strokeTimingNote: "Steps without a recorded duration use illustrative playback timing, not a sourced writing time.",
    strokeAnimationLabel: "Illustrative stroke animation",
    strokeRecordedTimingNote: "The animation uses the durations documented in the record.",
    strokeAnimationPlaying: "The stroke sequence is playing once.",
    noStrokeInstructions: "No sourced writing movements are available. Generic instructions are not substituted.",
    practiceNavigation: "Practice sheet",
    practiceTitle: "Create a practice sheet",
    practiceDescription: "Create a printable sheet from locally available sourced vector outlines and blank writing rows.",
    practicePrivacy: "Exercise text and settings stay local. Shareable settings are stored in the URL fragment, not sent in a server request.",
    practiceModel: "Handwriting model",
    practiceText: "Exercise text",
    practiceTextPromptNote: "Typed text is only an exercise prompt. It is not a handwriting sample.",
    practicePaper: "Paper size",
    practiceA4: "A4",
    practiceLetter: "US Letter",
    practiceMargin: "Margin (mm)",
    practiceRowHeight: "Row height (mm)",
    practiceGuides: "Writing guidelines",
    practiceGuidesNone: "No guidelines",
    practiceGuidesBaseline: "Baseline",
    practiceGuidesBaselineXheight: "Baseline and x-height",
    practiceReferenceRow: "Include sourced reference row",
    practiceTracingRows: "Tracing rows per repetition",
    practiceBlankRows: "Blank rows per repetition",
    practiceRepetitions: "Repetitions",
    practiceExportSvg: "Download SVG",
    practicePrint: "Print",
    practiceCopyLink: "Copy settings link",
    practiceSettingsLink: "Settings link",
    practiceCopyLinkSuccess: "Settings link copied.",
    practiceCopyLinkError: "Could not copy the link. You can copy it from the field.",
    practiceLoading: "Loading local outline data …",
    practiceReady: "Practice sheet generated. Sourced outlines: {supported}.",
    practiceNoModels: "No models are available for practice sheets.",
    practiceNoOutlines: "No sourced vector outlines are available for this text. Only the text prompt and blank writing rows are shown.",
    practiceMissingOutlines: "Some characters have no sourced outlines. Those positions remain blank.",
    practiceOverflow: "Some outlines do not fit the row and were omitted.",
    practiceReference: "Reference",
    practiceTrace: "Trace",
    practiceBlank: "Blank",
    practicePromptPrefix: "Exercise text",
    practiceGuideLegend: "Guidelines are layout aids, not verified model measurements.",
    practiceSvgTitle: "Schreibatlas practice sheet",
    practiceGuideBaselineLabel: "Baseline",
    practiceGuideXHeightLabel: "x-height",
    practiceContextLimit: "Vector outlines are shown individually as isolated final forms. Connections and writing movements are not added.",
    practiceProvenance: "Sources and license information",
    practiceSourceCredits: "Sources: {sources} · License: {license} · Status: {status}",
    practiceStatusError: "Local practice data could not be loaded.",
    writeNavigation: "Write locally",
    writeTitle: "Capture handwriting locally",
    writeDescription: "Draw directly in the browser and inspect only the geometry of your local pen movement.",
    writePrivacy: "Capture stays in this tab's memory. Nothing is uploaded. Data is downloaded only when you explicitly export it.",
    writeModel: "Reference handwriting model",
    writeCharacter: "Reference character",
    writeReferenceOverlay: "Show sourced isolated final form",
    writeReferenceOpacity: "Reference opacity",
    writeSurfaceLabel: "Drawing surface",
    writeSurfaceInstructions: "Draw with a mouse, stylus, or touch. The surface records separate strokes and pen-up/pen-down times.",
    writeKeyboardInstructions: "Keyboard: arrow keys move the cursor, Space puts the pen down or lifts it, and Escape lifts it.",
    writeClear: "Clear drawing",
    writeReset: "Reset",
    writeExportJson: "Export capture data as JSON",
    writeExportSvg: "Export drawing as SVG",
    writeStatusLoading: "Loading local reference data …",
    writeStatusReady: "Ready. Draw with a mouse, stylus, touch, or keyboard.",
    writeStatusCaptured: "Captured {strokes} strokes and {samples} samples.",
    writeStatusError: "Local reference data could not be loaded. Drawing capture remains available.",
    writeStatusInvalidCharacter: "Enter exactly one character to look for an optional reference form.",
    writeStatusReferenceLoading: "Loading the sourced reference outline locally …",
    writeStatusReferenceReady: "Isolated final form loaded as a reference. It does not show a writing movement.",
    writeStatusNoReference: "No sourced vector final form is available for this character. The surface remains without a reference.",
    writeMetricTitle: "Captured geometry",
    writeMetricStrokes: "Separate strokes",
    writeMetricSamples: "Samples including pen lifts",
    writeMetricPathLength: "Path length (drawing-surface units)",
    writeMetricWidth: "Captured bounds width",
    writeMetricHeight: "Captured bounds height",
    writeMetricDuration: "Capture duration (ms)",
    writeMetricPressureSamples: "Samples with a pressure value",
    writeMetricNoPressure: "The device did not report pressure values.",
    writeMetricsLimit: "These measurements describe only the captured movement. They do not rate handwriting quality or agreement with a standard.",
    writeReferenceDisclaimer: "A reference outline is an isolated final form from the dataset, not a stroke sequence or writing instruction.",
    writeProvenance: "Reference outline provenance",
    writeProvenanceEmpty: "No reference outline selected.",
    analysisNavigation: "Photo analysis",
    analysisTitle: "Analyze a handwriting photo locally",
    analysisDescription: "Rectify a photo locally and calculate preliminary geometric line features. Expected text and model are context only; there is no OCR or model scoring.",
    analysisRequiresJavascript: "JavaScript is required to process this photo locally in the browser.",
    analysisPrivacy: "The image and all derived pixels stay in this tab's memory. Nothing is uploaded or saved automatically. Measurements or the overlay graphic are exported only through your explicit download; the offline cache contains static site resources. Clearing the page releases the preview URL and working data.",
    offlineStatusPending: "Setting up offline caching.",
    offlineStatusAssetsCached: "The page and static resources are cached; the analysis worker is loading.",
    offlineStatusReady: "Offline ready: the page and analysis worker are cached on this device.",
    offlineStatusIncomplete: "Offline cache is incomplete. Open the page online and try again.",
    offlineStatusUnavailable: "Offline caching is not supported in this browser.",
    analysisImage: "Choose a local photo",
    analysisImageHelp: "PNG, JPEG, and WebP are supported. Local processing is limited to 20 MB and 18 megapixels.",
    analysisWorksheetFile: "Matching Schreibatlas worksheet (optional SVG)",
    analysisWorksheetNoReference: "No worksheet SVG was loaded. Analysis uses the selected manual crop.",
    analysisWorksheetBlankRow: "Blank row",
    analysisWorksheetNoInk: "no detected ink",
    analysisWorksheetHelp: "Choose the locally saved worksheet SVG. It is read locally and provides known page and writing-row dimensions.",
    analysisWorksheetReferenceReady: "Worksheet reference loaded locally: ",
    analysisWorksheetReferenceInvalid: "The file does not contain valid Schreibatlas worksheet metadata.",
    analysisWorksheetRecognized: "Worksheet markers recognized. Writing rows are calibrated in millimetres.",
    analysisWorksheetUnavailable: "Worksheet markers were not reliably recognized. Calibrated row measurements are unavailable.",
    analysisWorksheetLowConfidence: "Marker confidence is too low. Calibrated row measurements are unavailable.",
    analysisWorksheetWritingAvailable: "Calibrated blank-row measurements are available. This is not a handwriting rating.",
    analysisWorksheetWritingUnavailable: "Characters could not be isolated confidently. Character measurements and clusters are unavailable.",
    analysisWorksheetRepeatedAvailable: "Local shape clusters for the expected repeated character",
    analysisExpectedText: "Expected text",
    analysisModel: "Handwriting model (context only)",
    analysisCropHelp: "Drag the four corners to the page edges, or focus a corner and move it with the arrow keys. The quadrilateral is cropped and perspective-corrected locally.",
    analysisResetCrop: "Reset corners",
    analysisRun: "Analyze locally",
    analysisClear: "Clear image and results",
    analysisExportJson: "Download measurements as JSON",
    analysisExportOverlay: "Download analysis overlay as PNG",
    analysisReset: "Reset",
    analysisStatusIdle: "Choose an image and check the four crop corners.",
    analysisStatusProcessing: "Processing the image locally in a Web Worker …",
    analysisStatusComplete: "Local processing complete.",
    analysisStatusExported: "The selected export was downloaded locally.",
    analysisStatusExportError: "The local download could not be created.",
    analysisStatusNoFile: "Choose an image first.",
    analysisStatusFileType: "Choose a PNG, JPEG, or WebP image file.",
    analysisStatusFileSize: "The file exceeds the local 20 MB limit.",
    analysisStatusDimensions: "The image exceeds the local 18 megapixel limit.",
    analysisStatusDecodeError: "The image could not be decoded locally.",
    analysisStatusExpected: "Enter the expected text. It is not recognized automatically.",
    analysisStatusCorners: "The four corners must form a valid, non-overlapping quadrilateral.",
    analysisOriginalPreview: "Local image preview and manual corners",
    analysisRectifiedPreview: "Rectified and lightly deskewed image",
    analysisMaskPreview: "Black and white mask",
    analysisResults: "Preliminary local image features",
    analysisDetectedLineCount: "Detected line regions",
    analysisDeskew: "Automatic rotation correction (degrees)",
    analysisDeskewConfidenceLow: "low (heuristic)",
    analysisDeskewConfidenceMedium: "medium (heuristic)",
    analysisThreshold: "Otsu threshold",
    analysisThresholdUnavailable: "Unavailable (insufficient contrast)",
    analysisForegroundPixels: "Foreground pixels",
    analysisLine: "Line",
    analysisLineHeight: "Image region height (pixels)",
    analysisSlope: "Slope",
    analysisWritingWidth: "Image region width (pixels)",
    analysisBaselineCandidate: "Lower ink-edge candidate",
    analysisBaselineNote: "This is a low-confidence estimate from the lower ink edge, not a confirmed writing baseline.",
    analysisBaselineVariation: "Lower-edge residual variation (pixels)",
    analysisBaselineConfidenceLow: "low confidence (heuristic)",
    analysisLineSpacing: "Distance between line centers (pixels)",
    analysisLineSpacingUnavailable: "Unavailable (fewer than two line regions)",
    analysisCornerTopLeft: "Top-left crop corner",
    analysisCornerTopRight: "Top-right crop corner",
    analysisCornerBottomRight: "Bottom-right crop corner",
    analysisCornerBottomLeft: "Bottom-left crop corner",
    analysisNoLines: "No sufficiently continuous line regions were detected.",
    analysisOverlayPreview: "Ink mask (red), line region (blue), and baseline candidate (orange dashed)",
    analysisWordGaps: "Word gaps",
    analysisWordGapsUnavailable: "Unavailable (no OCR or word segmentation)",
    strokeNumber: "Stroke {number}",
    direction: "Direction",
    penContact: "Pen contact",
    penDown: "down",
    penUp: "up",
    start: "Start",
    end: "End",
    forward: "Forward",
    reverse: "Reverse",
    compareTitle: "Compare letters",
    compareDescription: "Compare sourced vector forms with a shared baseline and x-height. The shapes show final contours, not writing movements.",
    compareCharacter: "Character",
    compareModelA: "Model A",
    compareModelB: "Model B",
    compareCountry: "Filter by country",
    allCountries: "All countries",
    compareMode: "View",
    sideBySide: "Side by side",
    overlay: "Overlay",
    opacity: "Model B opacity",
    showBaseline: "Show baseline",
    showXHeight: "Show x-height",
    showBounds: "Show bounding boxes",
    shareUrl: "Shareable comparison link",
    copyLink: "Copy link",
    copySuccess: "Comparison link copied.",
    copyError: "The link could not be copied automatically. Copy it from the text field.",
    loadingGlyphs: "Loading glyph data …",
    noComparableGlyphs: "No glyph records are available yet. Font text is not substituted for handwriting forms.",
    noVectorOutline: "No sourced vector outline is available for this glyph record.",
    glyphLoadError: "The local glyph data could not be loaded.",
    comparisonSummary: "Comparing {character}: model A {modelA}, model B {modelB}. Both shapes use baseline 0 and x-height 1.",
    wordTitle: "Compare words",
    wordDescription: "Enter known text and compare only locally registered reference fonts. The input is never transmitted.",
    wordInputLabel: "Text to compare",
    wordInputPlaceholder: "Enter text",
    wordFontA: "Reference font for model A",
    wordFontB: "Reference font for model B",
    wordPreview: "Literal text input, not a handwriting sample",
    wordShapingNotice: "The browser performs OpenType text shaping. Normalized rendering requires a sourced x-height calibration.",
    wordFontLimitations: "Font contours show final forms, not writing movements. The recorded correspondence degree and limitations remain visible. If the file lacks characters, the browser may use another font; those forms must not be attributed to the model.",
    wordNoFont: "No local reference font is registered for this model. A system font is not substituted as handwriting.",
    wordNoCalibration: "This reference font has no sourced x-height calibration. Normalized rendering is unavailable.",
    wordNoFiles: "No locally usable font files are registered for this reference font.",
    wordEmptyText: "Enter text to see a literal text preview.",
    wordLoadError: "The local reference font could not be loaded.",
    wordLoading: "Loading local reference fonts …",
    wordSummary: "Text comparison for model A {modelA} and model B {modelB}.",
    outlineDisclaimer: "Vector contours show documented final forms. They are not writing movements or stroke order.",
  },
};
