import registry from "../../../docs/rule-registry-198.json";

export type CanonicalRuleSection = {
  endRuleId: string;
  ruleCount: number;
  sectionNumber: number;
  sectionTitle: string;
  startRuleId: string;
};

export type CanonicalRuleDefinition = {
  ruleId: string;
  ruleName: string;
  sectionNumber: number;
  sectionTitle: string;
};

export type CanonicalImplementationStatus =
  | "implemented"
  | "partially_implemented"
  | "not_implemented";

export type CanonicalSectionCoverage = {
  implementedScope: string;
  notes: string;
  sectionNumber: number;
  sectionTitle: string;
  status: CanonicalImplementationStatus;
};

export type RuntimeRuleCrosswalk = {
  canonicalRuleIds: string[];
  module: "M01" | "M02";
  note: string;
  runtimeRuleId: string;
};

type CanonicalRegistryDocument = {
  ruleCount: number;
  rules: CanonicalRuleDefinition[];
  sections: CanonicalRuleSection[];
  source: string;
};

const canonicalRegistry = registry as CanonicalRegistryDocument;

export const CANONICAL_RULE_COUNT = canonicalRegistry.ruleCount;
export const CANONICAL_RULES = canonicalRegistry.rules;
export const CANONICAL_SECTIONS = canonicalRegistry.sections;
export const CANONICAL_SOURCE = canonicalRegistry.source;

export const RUNTIME_RULE_CROSSWALK: RuntimeRuleCrosswalk[] = [
  {
    runtimeRuleId: "R001",
    module: "M01",
    canonicalRuleIds: ["R001"],
    note: "Current runtime now persists canonical source-file receipt state from the governed module package.",
  },
  {
    runtimeRuleId: "R002",
    module: "M01",
    canonicalRuleIds: ["R002"],
    note: "Current runtime now persists canonical vendor classification state from the governed artifact route and module context.",
  },
  {
    runtimeRuleId: "R003",
    module: "M01",
    canonicalRuleIds: ["R003"],
    note: "Current runtime now persists canonical parser-version-selection state from the active intake profile.",
  },
  {
    runtimeRuleId: "R004",
    module: "M01",
    canonicalRuleIds: ["R004"],
    note: "Current runtime now persists canonical parse-execution state for the governed source artifact.",
  },
  {
    runtimeRuleId: "R005",
    module: "M01",
    canonicalRuleIds: ["R005"],
    note: "Current runtime now persists canonical parse-failure handling state based on governed structural readiness.",
  },
  {
    runtimeRuleId: "R006",
    module: "M01",
    canonicalRuleIds: ["R006"],
    note: "Current runtime now persists canonical column-mapping application state from governed source readiness.",
  },
  {
    runtimeRuleId: "R007",
    module: "M01",
    canonicalRuleIds: ["R007"],
    note: "Current runtime now persists canonical unmapped-column detection state from governed source readiness.",
  },
  {
    runtimeRuleId: "R008",
    module: "M01",
    canonicalRuleIds: ["R008"],
    note: "Current runtime now persists canonical schema-validation state for the governed source artifact.",
  },
  {
    runtimeRuleId: "R009",
    module: "M01",
    canonicalRuleIds: ["R009"],
    note: "Current runtime now persists canonical schema-rejection state for the governed source artifact.",
  },
  {
    runtimeRuleId: "R010",
    module: "M01",
    canonicalRuleIds: ["R010"],
    note: "Current runtime now persists canonical duplicate-detection state from governed transaction and order normalization.",
  },
  {
    runtimeRuleId: "R011",
    module: "M01",
    canonicalRuleIds: ["R011"],
    note: "Current runtime now persists canonical date-range validation state from governed certification timing evidence.",
  },
  {
    runtimeRuleId: "R012",
    module: "M01",
    canonicalRuleIds: ["R012"],
    note: "Current runtime now persists canonical null-amount rejection state from normalized governed metrics.",
  },
  {
    runtimeRuleId: "R013",
    module: "M01",
    canonicalRuleIds: ["R013"],
    note: "Current runtime now persists canonical negative-amount normalization flags when surfaced by governed metrics.",
  },
  {
    runtimeRuleId: "R014",
    module: "M01",
    canonicalRuleIds: ["R014"],
    note: "Current runtime now persists canonical vendor-profile lookup state from governed contract resolution.",
  },
  {
    runtimeRuleId: "R015",
    module: "M01",
    canonicalRuleIds: ["R015"],
    note: "Current runtime now persists canonical normalization-completion state across the active governed package.",
  },
  {
    runtimeRuleId: "MFR-INT-12",
    module: "M01",
    canonicalRuleIds: ["R056", "R076"],
    note: "Current runtime evaluates Visa debit downgrade-style interchange variance against governed card-brand rate truth.",
  },
  {
    runtimeRuleId: "MFR-INT-14",
    module: "M01",
    canonicalRuleIds: ["R056", "R076"],
    note: "Current runtime evaluates Mastercard debit downgrade-style interchange variance against governed card-brand rate truth.",
  },
  {
    runtimeRuleId: "MFR-INT-22",
    module: "M01",
    canonicalRuleIds: ["R058", "R059", "R061"],
    note: "Current runtime attributes non-contract surcharge pools when statement fee behavior diverges from governed pricing model.",
  },
  {
    runtimeRuleId: "MFR-INT-23",
    module: "M01",
    canonicalRuleIds: ["R058", "R076", "R078"],
    note: "Current runtime attributes debit-bucket fee variance after reconstructing expected total fee behavior from sealed contract terms.",
  },
  {
    runtimeRuleId: "MFR-MRK-03",
    module: "M01",
    canonicalRuleIds: ["R058", "R078"],
    note: "Current runtime audits processor markup bps against the sealed markup cap.",
  },
  {
    runtimeRuleId: "MFR-MRK-05",
    module: "M01",
    canonicalRuleIds: ["R078", "R083"],
    note: "Current runtime detects per-transaction fixed fee overage using governed txn-fee truth.",
  },
  {
    runtimeRuleId: "MFR-VOL-08",
    module: "M01",
    canonicalRuleIds: ["R070", "R079"],
    note: "Current runtime models missed tier-volume discount behavior.",
  },
  {
    runtimeRuleId: "MFR-VOL-09",
    module: "M01",
    canonicalRuleIds: ["R070", "R079"],
    note: "Current runtime models tier downgrade / wrong tier application behavior.",
  },
  {
    runtimeRuleId: "MFR-BIL-15",
    module: "M01",
    canonicalRuleIds: ["R083", "R091"],
    note: "Current runtime compares observed statement fees against fully reconstructed governed-fee expectation.",
  },
  {
    runtimeRuleId: "MFR-BIL-16",
    module: "M01",
    canonicalRuleIds: ["R075", "R083"],
    note: "Current runtime flags extra monthly / compliance-style fee pools outside sealed contract values.",
  },
  {
    runtimeRuleId: "MFR-BIL-17",
    module: "M01",
    canonicalRuleIds: ["R068", "R083"],
    note: "Current runtime detects monthly-minimum style drift beyond the sealed merchant agreement.",
  },
  {
    runtimeRuleId: "MFR-CBK-04",
    module: "M01",
    canonicalRuleIds: ["R073", "R074"],
    note: "Current runtime attributes chargeback-fee leakage using chargeback and refund behavior proxies.",
  },
  {
    runtimeRuleId: "MFR-CBK-05",
    module: "M01",
    canonicalRuleIds: ["R060", "R073"],
    note: "Current runtime flags duplicate / orphaned chargeback-style billing conditions.",
  },
  {
    runtimeRuleId: "MFR-RES-02",
    module: "M01",
    canonicalRuleIds: ["R058", "R091"],
    note: "Current runtime infers excess reserve holdback from gross, fee, and deposit evidence.",
  },
  {
    runtimeRuleId: "MFR-AVS-01",
    module: "M01",
    canonicalRuleIds: ["R065"],
    note: "Current runtime attributes service-fee leakage behaving like AVS downgrade charges.",
  },
  {
    runtimeRuleId: "MFR-VOID-03",
    module: "M01",
    canonicalRuleIds: ["R060", "R083"],
    note: "Current runtime attributes fee billing on voided volume using statement-level operational counts.",
  },
  {
    runtimeRuleId: "MFR-RFD-01",
    module: "M01",
    canonicalRuleIds: ["R072"],
    note: "Current runtime attributes refund-related fee leakage using refund count and average fee behavior.",
  },
  {
    runtimeRuleId: "MFR-FEE-21",
    module: "M01",
    canonicalRuleIds: ["R059", "R083"],
    note: "Current runtime captures residual extra-fee pools not justified by the sealed pricing model.",
  },
  {
    runtimeRuleId: "R060",
    module: "M01",
    canonicalRuleIds: ["R060"],
    note: "Current runtime now detects duplicate processor transaction billing using persisted duplicate transaction counts from governed source exports.",
  },
  {
    runtimeRuleId: "R064",
    module: "M01",
    canonicalRuleIds: ["R064"],
    note: "Current runtime now audits Visa and Mastercard credit fee pools directly against the sealed card-brand rate table.",
  },
  {
    runtimeRuleId: "R086",
    module: "M01",
    canonicalRuleIds: ["R086"],
    note: "Current runtime now captures explicit processor-side error and reversal charge pools when surfaced by governed source evidence.",
  },
  {
    runtimeRuleId: "R063",
    module: "M01",
    canonicalRuleIds: ["R063"],
    note: "Current runtime now measures delayed processor settlement behavior using persisted governed settlement-lag timing.",
  },
  {
    runtimeRuleId: "R068",
    module: "M01",
    canonicalRuleIds: ["R068"],
    note: "Current runtime now evaluates monthly-minimum style fee billing against governed low-volume MFR conditions.",
  },
  {
    runtimeRuleId: "R070",
    module: "M01",
    canonicalRuleIds: ["R070"],
    note: "Current runtime now emits a direct canonical tiered-pricing validation finding when governed tier pricing drifts.",
  },
  {
    runtimeRuleId: "R072",
    module: "M01",
    canonicalRuleIds: ["R072"],
    note: "Current runtime now emits a direct canonical refund-processing-fee finding from governed statement evidence.",
  },
  {
    runtimeRuleId: "R073",
    module: "M01",
    canonicalRuleIds: ["R073"],
    note: "Current runtime now emits a direct canonical chargeback-fee finding from governed contract and chargeback counts.",
  },
  {
    runtimeRuleId: "R075",
    module: "M01",
    canonicalRuleIds: ["R075"],
    note: "Current runtime now isolates PCI/non-compliance-style fee pools when they exceed the governed recurring fee baseline.",
  },
  {
    runtimeRuleId: "R078",
    module: "M01",
    canonicalRuleIds: ["R078"],
    note: "Current runtime now emits a direct canonical processor-markup audit finding from governed MFR rate truth.",
  },
  {
    runtimeRuleId: "R083",
    module: "M01",
    canonicalRuleIds: ["R083"],
    note: "Current runtime now emits a direct canonical statement-fee audit finding from reconstructed governed fee expectation.",
  },
  {
    runtimeRuleId: "R085",
    module: "M01",
    canonicalRuleIds: ["R085"],
    note: "Current runtime now flags governed MFR rate drift beyond the implied notification threshold.",
  },
  {
    runtimeRuleId: "R087",
    module: "M01",
    canonicalRuleIds: ["R087"],
    note: "Current runtime now emits a canonical processor-error-rate narrative finding when governed error-charge evidence is present.",
  },
  {
    runtimeRuleId: "R088",
    module: "M01",
    canonicalRuleIds: ["R088"],
    note: "Current runtime now emits the canonical below-threshold narrative when MFR recovery stays under the operating floor.",
  },
  {
    runtimeRuleId: "R090",
    module: "M01",
    canonicalRuleIds: ["R090"],
    note: "Current runtime now emits the canonical MFR contract-absence flag when governed contract data is missing.",
  },
  {
    runtimeRuleId: "R091",
    module: "M01",
    canonicalRuleIds: ["R091"],
    note: "Current runtime now emits a canonical systematic-variance narrative when MFR overcharge behavior remains persistent.",
  },
  {
    runtimeRuleId: "R092",
    module: "M01",
    canonicalRuleIds: ["R092"],
    note: "Current runtime now emits a canonical period-completeness finding when the governed MFR evidence package is incomplete.",
  },
  {
    runtimeRuleId: "R093",
    module: "M01",
    canonicalRuleIds: ["R093"],
    note: "Current runtime now emits a canonical trust-score-contribution narrative when MFR trust gates remain below release.",
  },
  {
    runtimeRuleId: "R094",
    module: "M01",
    canonicalRuleIds: ["R094"],
    note: "Current runtime now emits a canonical MFR audit-trail completion finding from live auditability scoring.",
  },
  {
    runtimeRuleId: "R095",
    module: "M01",
    canonicalRuleIds: ["R095"],
    note: "Current runtime now emits a canonical MFR narrative-token blocking finding when release gates remain open.",
  },
  {
    runtimeRuleId: "DSP-COM-04",
    module: "M02",
    canonicalRuleIds: ["R016", "R017"],
    note: "Current runtime compares actual DSP commission against the governed contract base and rate.",
  },
  {
    runtimeRuleId: "DSP-COM-05",
    module: "M02",
    canonicalRuleIds: ["R016", "R021"],
    note: "Current runtime detects commission applied to the wrong settlement base versus POS-side governed basis.",
  },
  {
    runtimeRuleId: "DSP-COM-06",
    module: "M02",
    canonicalRuleIds: ["R016", "R017"],
    note: "Current runtime attributes commission charged on tax-remitted volume where excluded by contract.",
  },
  {
    runtimeRuleId: "DSP-COM-07",
    module: "M02",
    canonicalRuleIds: ["R016", "R017"],
    note: "Current runtime attributes commission charged on tip pass-through where excluded by contract.",
  },
  {
    runtimeRuleId: "DSP-PRM-02",
    module: "M02",
    canonicalRuleIds: ["R018", "R038"],
    note: "Current runtime attributes marketing / promo credit leakage using promo-order behavior and sealed marketing terms.",
  },
  {
    runtimeRuleId: "DSP-PRM-03",
    module: "M02",
    canonicalRuleIds: ["R018", "R030"],
    note: "Current runtime attributes DSP-funded promotional adjustments billed back to the merchant.",
  },
  {
    runtimeRuleId: "DSP-RFD-07",
    module: "M02",
    canonicalRuleIds: ["R037", "R049"],
    note: "Current runtime models refund hold-back behavior against payout frequency and adjustment pools.",
  },
  {
    runtimeRuleId: "DSP-RFD-08",
    module: "M02",
    canonicalRuleIds: ["R016", "R037"],
    note: "Current runtime attributes refund commission charged on the wrong governed base.",
  },
  {
    runtimeRuleId: "DSP-DUP-01",
    module: "M02",
    canonicalRuleIds: ["R023", "R024"],
    note: "Current runtime detects duplicate order-fee events by reconciling statement and POS order counts.",
  },
  {
    runtimeRuleId: "DSP-VAR-11",
    module: "M02",
    canonicalRuleIds: ["R049", "R051"],
    note: "Current runtime attributes residual effective-rate variance that remains above the governed tolerance band.",
  },
  {
    runtimeRuleId: "DSP-DEL-04",
    module: "M02",
    canonicalRuleIds: ["R029", "R032"],
    note: "Current runtime detects delivery-fee charges leaking onto pickup order volume.",
  },
  {
    runtimeRuleId: "DSP-DASH-02",
    module: "M02",
    canonicalRuleIds: ["R041"],
    note: "Current runtime compares member-rate commission treatment against non-member delivery-rate behavior.",
  },
  {
    runtimeRuleId: "R023",
    module: "M02",
    canonicalRuleIds: ["R023"],
    note: "Current runtime now detects exact duplicate DSP order events using persisted duplicate order counts from the settlement export.",
  },
  {
    runtimeRuleId: "R024",
    module: "M02",
    canonicalRuleIds: ["R024"],
    note: "Current runtime now detects broader order-volume mismatches between settlement and POS after excluding exact duplicate-order events.",
  },
  {
    runtimeRuleId: "R034",
    module: "M02",
    canonicalRuleIds: ["R034"],
    note: "Current runtime now attributes explicit DSP error-charge pools that exceed the clean operational baseline.",
  },
  {
    runtimeRuleId: "R038",
    module: "M02",
    canonicalRuleIds: ["R038"],
    note: "Current runtime now isolates marketing-charge leakage when promo support is missing or the charge exceeds sealed marketing terms.",
  },
  {
    runtimeRuleId: "R025",
    module: "M02",
    canonicalRuleIds: ["R025"],
    note: "Current runtime now measures delayed DSP settlement behavior using persisted governed settlement-lag timing.",
  },
  {
    runtimeRuleId: "R035",
    module: "M02",
    canonicalRuleIds: ["R035"],
    note: "Current runtime now enforces a canonical DSP fee-cap compliance finding when the effective rate exceeds the governed cap band.",
  },
  {
    runtimeRuleId: "R036",
    module: "M02",
    canonicalRuleIds: ["R036"],
    note: "Current runtime now emits a canonical multi-platform reconciliation finding when POS and settlement bases diverge materially.",
  },
  {
    runtimeRuleId: "R041",
    module: "M02",
    canonicalRuleIds: ["R041"],
    note: "Current runtime now emits a canonical subscription-plan commission finding from governed member-rate behavior.",
  },
  {
    runtimeRuleId: "R046",
    module: "M02",
    canonicalRuleIds: ["R046"],
    note: "Current runtime now emits the canonical below-threshold narrative when DFR recovery stays under the operating floor.",
  },
  {
    runtimeRuleId: "R047",
    module: "M02",
    canonicalRuleIds: ["R047"],
    note: "Current runtime now emits a canonical period-completeness finding when the governed DFR evidence package is incomplete.",
  },
  {
    runtimeRuleId: "R048",
    module: "M02",
    canonicalRuleIds: ["R048"],
    note: "Current runtime now emits a canonical prior-period carryover narrative when governed settlement adjustments remain present.",
  },
  {
    runtimeRuleId: "R049",
    module: "M02",
    canonicalRuleIds: ["R049"],
    note: "Current runtime now emits a canonical systematic-variance narrative when DFR overcharge behavior remains persistent.",
  },
  {
    runtimeRuleId: "R051",
    module: "M02",
    canonicalRuleIds: ["R051"],
    note: "Current runtime now emits a canonical trust-score-contribution narrative when DFR trust gates remain below release.",
  },
  {
    runtimeRuleId: "R052",
    module: "M02",
    canonicalRuleIds: ["R052"],
    note: "Current runtime now emits the canonical DFR contract-absence flag when governed contract data is missing.",
  },
  {
    runtimeRuleId: "R054",
    module: "M02",
    canonicalRuleIds: ["R054"],
    note: "Current runtime now emits a canonical DFR audit-trail completion finding from live auditability scoring.",
  },
  {
    runtimeRuleId: "R055",
    module: "M02",
    canonicalRuleIds: ["R055"],
    note: "Current runtime now emits a canonical DFR narrative-token blocking finding when release gates remain open.",
  },
  {
    runtimeRuleId: "R116",
    module: "M01",
    canonicalRuleIds: ["R116"],
    note: "Current runtime now persists the canonical TG01 data-completeness gate outcome.",
  },
  {
    runtimeRuleId: "R117",
    module: "M01",
    canonicalRuleIds: ["R117"],
    note: "Current runtime now persists the canonical POS-data-presence subgate outcome inside TG01.",
  },
  {
    runtimeRuleId: "R118",
    module: "M01",
    canonicalRuleIds: ["R118"],
    note: "Current runtime now persists the canonical TG02 source-authenticity gate outcome.",
  },
  {
    runtimeRuleId: "R119",
    module: "M01",
    canonicalRuleIds: ["R119"],
    note: "Current runtime now persists the canonical file-integrity hash subgate outcome inside TG02.",
  },
  {
    runtimeRuleId: "R120",
    module: "M01",
    canonicalRuleIds: ["R120"],
    note: "Current runtime now persists the canonical vendor-profile-current subgate outcome inside TG03.",
  },
  {
    runtimeRuleId: "R121",
    module: "M01",
    canonicalRuleIds: ["R121"],
    note: "Current runtime now persists the canonical contract-currency subgate outcome inside TG03.",
  },
  {
    runtimeRuleId: "R122",
    module: "M01",
    canonicalRuleIds: ["R122"],
    note: "Current runtime now persists the canonical TG04 POS-reconciliation gate outcome.",
  },
  {
    runtimeRuleId: "R123",
    module: "M01",
    canonicalRuleIds: ["R123"],
    note: "Current runtime now persists the canonical TG04 reconciliation-fail subgate outcome when gaps remain.",
  },
  {
    runtimeRuleId: "R124",
    module: "M01",
    canonicalRuleIds: ["R124"],
    note: "Current runtime now persists the canonical TG05 duplicate-absence gate outcome.",
  },
  {
    runtimeRuleId: "R125",
    module: "M01",
    canonicalRuleIds: ["R125"],
    note: "Current runtime now persists the canonical TG05 duplicate-detected penalty outcome.",
  },
  {
    runtimeRuleId: "R126",
    module: "M01",
    canonicalRuleIds: ["R126"],
    note: "Current runtime now persists the canonical TG06 period-coverage gate outcome.",
  },
  {
    runtimeRuleId: "R127",
    module: "M01",
    canonicalRuleIds: ["R127"],
    note: "Current runtime now persists the canonical TG06 gap-penalty outcome when evidence coverage is incomplete.",
  },
  {
    runtimeRuleId: "R128",
    module: "M01",
    canonicalRuleIds: ["R128"],
    note: "Current runtime now persists the canonical TG07 fee-legitimacy score outcome.",
  },
  {
    runtimeRuleId: "R129",
    module: "M01",
    canonicalRuleIds: ["R129"],
    note: "Current runtime now persists the canonical TG07 fee-variance grade outcome.",
  },
  {
    runtimeRuleId: "R130",
    module: "M01",
    canonicalRuleIds: ["R130"],
    note: "Current runtime now persists the canonical TG07 high-variance flag outcome.",
  },
  {
    runtimeRuleId: "R131",
    module: "M01",
    canonicalRuleIds: ["R131"],
    note: "Current runtime now persists the canonical TG08 KPI-formula-currency outcome.",
  },
  {
    runtimeRuleId: "R132",
    module: "M01",
    canonicalRuleIds: ["R132"],
    note: "Current runtime now persists the canonical TG08 mid-period-formula-change risk outcome.",
  },
  {
    runtimeRuleId: "R133",
    module: "M01",
    canonicalRuleIds: ["R133"],
    note: "Current runtime now persists the canonical TG09 audit-trail-integrity outcome.",
  },
  {
    runtimeRuleId: "R134",
    module: "M01",
    canonicalRuleIds: ["R134"],
    note: "Current runtime now persists the canonical TG10 narrative-hash-readiness outcome.",
  },
  {
    runtimeRuleId: "R135",
    module: "M01",
    canonicalRuleIds: ["R135"],
    note: "Current runtime now persists the canonical TG11 CAAR-eligibility outcome.",
  },
  {
    runtimeRuleId: "R186",
    module: "M01",
    canonicalRuleIds: ["R186"],
    note: "Current runtime now persists the canonical system-health finding when health flags degrade the certification path.",
  },
  {
    runtimeRuleId: "R188",
    module: "M01",
    canonicalRuleIds: ["R188"],
    note: "Current runtime now persists the canonical master-system health degradation finding when applicable.",
  },
  {
    runtimeRuleId: "R191",
    module: "M01",
    canonicalRuleIds: ["R191"],
    note: "Current runtime now persists the canonical system-health degradation finding when applicable.",
  },
  {
    runtimeRuleId: "R192",
    module: "M01",
    canonicalRuleIds: ["R192"],
    note: "Current runtime now persists the canonical system-health degradation finding when applicable.",
  },
];

export const CANONICAL_SECTION_COVERAGE: CanonicalSectionCoverage[] = [
  {
    sectionNumber: 1,
    sectionTitle: "Data Ingestion & Normalization",
    status: "partially_implemented",
    implementedScope:
      "Canonical intake rules R001-R015 are now persisted from real governed intake state, covering source receipt, parser routing, parse readiness, mapping, schema validation, duplicate detection, date/amount normalization, vendor lookup, and normalization completion.",
    notes:
      "The live app enforces structural gates, hashing, parser selection, and vendor-profile assumptions, but not every canonical normalization rule is emitted as an explicit `R00x` runtime event yet.",
  },
  {
    sectionNumber: 2,
    sectionTitle: "Delivery Fee Recovery / DFR",
    status: "partially_implemented",
    implementedScope:
      "28 live DSP rules cover commission base/rate, promo and marketing pools, settlement timing, fee-cap compliance, multi-platform reconciliation, refund behavior, duplicate orders, order-volume mismatch, delivery-fee leakage, member/subscription handling, residual effective-rate variance, threshold narratives, completeness, contract absence, audit trail, narrative-token release, and explicit DSP error-charge handling.",
    notes:
      "The section is not fully complete. Many vendor-specific DFR rules in the canonical registry still need direct formula implementations and richer upstream fields.",
  },
  {
    sectionNumber: 3,
    sectionTitle: "Merchant Fee Recovery / MFR",
    status: "partially_implemented",
    implementedScope:
      "35 live MFR rules cover interchange downgrade proxies, settlement timing, card-brand fee audit, duplicate transaction billing, monthly minimums, markup caps, txn-fee overage, billing drift, tier/volume behavior, reserve overhold, chargebacks, refunds, voids, processor error charges, threshold narratives, completeness, contract absence, audit trail, narrative-token release, and extra fee pools.",
    notes:
      "The section is not fully complete. The canonical MFR registry includes many more brand, surcharge, compliance, and contract-specific cases than the current runtime evaluates directly.",
  },
  {
    sectionNumber: 4,
    sectionTitle: "Royalty / Spoke 3",
    status: "not_implemented",
    implementedScope: "No production royalty engine is wired yet.",
    notes:
      "The app still locks M03. Canonical royalty rules `R096-R115` require a separate spoke implementation and dedicated governed inputs.",
  },
  {
    sectionNumber: 5,
    sectionTitle: "Trust Gate Evaluation",
    status: "partially_implemented",
    implementedScope:
      "Canonical trust-gate rules R116-R135 are now persisted from the live TG01-TG11 engine, including subgates for completeness, authenticity, vendor currency, reconciliation, duplicates, coverage, fee legitimacy, formula currency, auditability, narrative readiness, and CAAR eligibility.",
    notes:
      "The live formulas are production-grade but still represent a simplified implementation of the canonical trust-gate architecture.",
  },
  {
    sectionNumber: 6,
    sectionTitle: "Certification State & DCLS",
    status: "partially_implemented",
    implementedScope:
      "Canonical certification-state rules R136-R145 are now emitted from the live CAAR assembly path, covering Trust Score calculation, zone assignment, release state, CAAR template path, token injection, and narrative-hash readiness.",
    notes:
      "The live runtime now persists the main DCLS state path, but some deeper immutable-record and downstream release mechanics still remain partial.",
  },
  {
    sectionNumber: 7,
    sectionTitle: "CAAR & Output Finalization",
    status: "partially_implemented",
    implementedScope:
      "Canonical finalization rules R146-R152 are now emitted from the live CAAR assembly path, covering eligibility, output selection, evidence-bundle assembly, attestation preparation, hash workflow, ExportPack readiness, and immutable audit finalization.",
    notes:
      "The current CAAR is materially hardened and traceable, but some downstream export/distribution behaviors still remain narrower than the full canonical spec.",
  },
  {
    sectionNumber: 8,
    sectionTitle: "Loop B Pattern Analysis & Anomaly Detection",
    status: "partially_implemented",
    implementedScope:
      "Canonical Loop B rules now cover the historical batch window, promoted pattern findings, confidence scoring, re-certification escalation, cross-module pattern correlation, persisted findings, and token assembly through `R153-R165` when supported by live findings.",
    notes:
      "The canonical anomaly catalog is broader than the current Loop B rule set. Additional pattern detectors still need direct implementation.",
  },
  {
    sectionNumber: 9,
    sectionTitle: "Cross-Module Reconciliation",
    status: "partially_implemented",
    implementedScope:
      "Canonical cross-module rules `R166-R175` are now emitted for order/transaction reconciliation, aggregate variance, recovery roll-up, Trust Score roll-up, module coverage, conflict handling, composite record assembly, audit trail, and token assembly.",
    notes:
      "The current cross-module logic covers the main release path but does not yet implement every canonical reconciliation branch and narrative token path.",
  },
  {
    sectionNumber: 10,
    sectionTitle: "Operator Actions & Workflow",
    status: "partially_implemented",
    implementedScope:
      "Canonical workflow rules `R176-R185` are now emitted for authentication, authorization, manual-review routing, override logging pathing, dispute escalation readiness, recovery tracking, operator attribution, workflow-state transition, notification state, and auditability.",
    notes:
      "Email dispatch, downstream dispute filing, and some operator-routing behaviors are still workflow scaffolds rather than fully automated canonical rules.",
  },
  {
    sectionNumber: 11,
    sectionTitle: "System Health & Self-Diagnostic",
    status: "partially_implemented",
    implementedScope:
      "System-health events, rule-set drift handling, health penalties, master-system gating, SYS persistence, and direct canonical health-rule persistence for active flags are implemented.",
    notes:
      "The current runtime evaluates a narrower set of health flags than the full canonical `R186-R198` architecture.",
  },
];

const IMPLEMENTED_CANONICAL_RULE_IDS = new Set(
  RUNTIME_RULE_CROSSWALK.flatMap((rule) => rule.canonicalRuleIds),
);

export function getCanonicalSectionCoverage() {
  return CANONICAL_SECTION_COVERAGE;
}

export function getRuntimeRuleCrosswalk() {
  return RUNTIME_RULE_CROSSWALK;
}

export function getCanonicalCoverageSummary() {
  const implementedRuleCount = IMPLEMENTED_CANONICAL_RULE_IDS.size;
  const partialSectionCount = CANONICAL_SECTION_COVERAGE.filter(
    (section) => section.status === "partially_implemented",
  ).length;
  const unimplementedSectionCount = CANONICAL_SECTION_COVERAGE.filter(
    (section) => section.status === "not_implemented",
  ).length;

  return {
    canonicalRuleCount: CANONICAL_RULE_COUNT,
    implementedRuntimeRuleCount: RUNTIME_RULE_CROSSWALK.length,
    implementedCanonicalRuleCount: implementedRuleCount,
    partialSectionCount,
    source: CANONICAL_SOURCE,
    unimplementedSectionCount,
  };
}

export function findCanonicalRule(ruleId: string) {
  return CANONICAL_RULES.find((rule) => rule.ruleId === ruleId) ?? null;
}
