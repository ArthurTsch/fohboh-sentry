export const VENDOR_TEMPLATE_HEADERS: Record<string, string[]> = {
  heartland:
    "trans_date,trans_id,card_type,trans_amount,fee_amount,disc_rate,disc_amount,auth_code,terminal_id,batch_id,card_number_last4,trans_type".split(","),
  toast:
    "date,batch_date,pos_merchant_sales,platform_net_sales,transaction_fees,processing_fees,other_merchant_fees,calculated_recovery_variance,bank_deposit_amount,external_ref_id,card_type,entry_method,interchange_rate_applied,transaction_count,notes".split(","),
  square:
    "date,transaction_id,amount,fee,net_total,card_brand,pan_suffix,device_name,location_name,description,refund_id,dispute_id".split(","),
  worldpay:
    "txn_date,txn_id,card_brand,txn_amount,disc_rate,disc_amount,interchange_amount,assessment,terminal_id,batch_number,auth_number".split(","),
  chase:
    "transaction_date,transaction_id,card_type,transaction_amount,disc_rate,disc_amount,interchange_fee,service_fee,authorization_number,mid".split(","),
  ubereats:
    "Store Name,Shop ID,Store ID,Order Count,Count of Misc payment,Sales (excl. tax),Tax on Sales,Sales (incl. tax),Order Error Adjustments,Tax on Order Error Adjustments,Order Error Adjustments (incl. tax),Price adjustments (excl. tax),Tax on Price Adjustments,Price Adjustments (incl. tax),Offers on items (incl. tax),Tax On Offers on items,Delivery Offer Redemptions (incl. tax),Tax On Delivery Offer Redemptions,Offer Redemption Fee,Marketing Adjustment,Bag Fee,Marketplace Fee,Tax on Marketplace Fee,Delivery Network Fee,Tax on Delivery Network Fee,Order Processing Fee,Total Sales after Adjustments (incl tax),Capital payments,Container Deposit Fee,Other payments,Marketplace Facilitator Tax Adjustment,Marketplace Facilitator Tax,Backup Withholding Tax,Total payout,Payout Date,Payout reference ID".split(","),
  doordash:
    "order_date,store_id,order_id,order_subtotal,dd_commission_rate,dd_commission_amount,dd_marketing_fee,error_charge,consumer_fee,payout_amount,order_status".split(","),
  grubhub:
    "date,restaurant_id,order_id,restaurant_food_sales,grubhub_commission,marketing_fee,tax_remitted,adjustment_amount,net_payout,order_type".split(","),
  slice:
    "order_date,store_id,order_id,order_subtotal,slice_commission,marketing_contribution,adjustment,tax,net_payout".split(","),
};

export const ARTIFACT_PURPOSES: Record<string, string> = {
  "m01-agreement": "merchant_agreement_pdf",
  "m01-bank": "bank_statement_pdf",
  "m01-contract": "contract_config_manual_entry",
  "m01-pos": "pos_export_csv",
  "m01-processor": "processor_statement_csv",
  "m02-agreement": "dsp_agreement_pdf",
  "m02-bank": "bank_statement_pdf",
  "m02-contract": "contract_config_manual_entry",
  "m02-pos": "pos_summary_csv",
  "m02-settlement": "dsp_settlement_csv",
};

export const ARTIFACT_EXPECTED_KIND: Record<string, "csv" | "pdf" | "manual" | "csv_or_pdf"> = {
  "m01-agreement": "pdf",
  "m01-bank": "pdf",
  "m01-contract": "manual",
  "m01-pos": "csv",
  "m01-processor": "csv_or_pdf",
  "m02-agreement": "pdf",
  "m02-bank": "pdf",
  "m02-contract": "manual",
  "m02-pos": "csv",
  "m02-settlement": "csv",
};

const GENERIC_CSV_HEADERS: Record<string, string[]> = {
  "m01-pos": ["gross_sales", "tenders", "transactions"],
  "m02-pos": ["channel", "pos_net_sales", "commission_variance"],
};

const TOAST_SALES_BY_CHANNEL_HEADERS =
  "ORDER_SOURCE_NAME,BUSINESS_DAY,CHECK_COUNT,CHECK_NET_AMOUNT,DEFERRED_ITEM_DISCOUNT_AMOUNT,DEFERRED_ITEM_GROSS_AMOUNT,DEFERRED_ITEM_NET_AMOUNT,DEFERRED_ITEM_QUANTITY,DEFERRED_ITEM_REFUND_AMOUNT,DEFERRED_ITEM_TAX_AMOUNT,DISCOUNT_AMOUNT,DISCOUNT_COUNT,GROSS_SALES,GUEST_COUNT,ITEM_GROSS_AMOUNT,ITEM_NET_AMOUNT,ITEM_QUANTITY,ITEM_REFUND_AMOUNT,ITEM_TAX_AMOUNT,ITEM_UPSOLD_AMOUNT,NET_SALES,ORDER_COUNT,ORDER_DURATION,ORDER_NET_AMOUNT,ORDERS_WITH_VOIDS_COUNT,REFUND_AMOUNT,SALES_AFTER_DISCOUNTS,SUB_ITEM_QUANTITY,SUB_ITEM_UPSOLD_AMOUNT,TAX_AMOUNT,TOTAL_QUANTITY_SOLD,TOTAL_UPSOLD_AMOUNT,VOID_AMOUNT,UPSELL_CONVERSION_RATE,VOIDED_ITEM_QUANTITY".split(
    ",",
  );

const TOAST_PAYOUT_HEADERS =
  "Settled date,Name,Location,Type,Sales period start,Sales period end,# Txns,Payments,Refunds,Fees,Withholdings,Chargebacks,External,Payout,External Ref. ID,Status".split(
    ",",
  );

const DOORDASH_PAYOUT_SUMMARY_HEADERS =
  "Business ID,Business name,Store ID,Store name,Merchant store ID,Payout date,Currency,Channel,Subtotal,Subtotal tax passed to merchant,Staff tip,Commission,Commission tax,Payment processing fee,Marketing fees | (including any applicable taxes),Customer discounts from marketing | (funded by you),Customer discounts from marketing | (funded by DoorDash),Customer discounts from marketing | (funded by a third-party),DoorDash marketing credit,Third-party contribution,Error charges,Adjustments,Net total,Subtotal for tax,Subtotal tax remitted by DoorDash to tax authorities,Tax remitted by DoorDash on fees DoorDash charges to merchant,Payout ID,Payout status".split(
    ",",
  );

const VENDOR_ARTIFACT_HEADERS: Record<string, Record<string, string[]>> = {
  doordash: {
    "m02-settlement": DOORDASH_PAYOUT_SUMMARY_HEADERS,
  },
  ubereats: {
    "m02-settlement": VENDOR_TEMPLATE_HEADERS.ubereats,
  },
  toast: {
    "m01-pos": TOAST_PAYOUT_HEADERS,
    "m02-pos": TOAST_SALES_BY_CHANNEL_HEADERS,
  },
};

export type KnownSourceFormat = {
  artifactKey: string;
  headers: string[];
  key: string;
  name: string;
  sourceSystemKey: string;
};

const KNOWN_SOURCE_FORMATS: KnownSourceFormat[] = [
  {
    artifactKey: "m02-settlement",
    headers: DOORDASH_PAYOUT_SUMMARY_HEADERS,
    key: "doordash-payout-summary-v1",
    name: "DoorDash Payout Summary",
    sourceSystemKey: "doordash",
  },
  {
    artifactKey: "m01-pos",
    headers: TOAST_PAYOUT_HEADERS,
    key: "toast-payouts-v1",
    name: "Toast Payouts",
    sourceSystemKey: "toast",
  },
  {
    artifactKey: "m02-settlement",
    headers: VENDOR_TEMPLATE_HEADERS.ubereats,
    key: "ubereats-payout-settlement-v1",
    name: "Uber Eats Payout Settlement",
    sourceSystemKey: "ubereats",
  },
  {
    artifactKey: "m02-pos",
    headers: TOAST_SALES_BY_CHANNEL_HEADERS,
    key: "toast-sales-by-channel-v1",
    name: "Toast Sales by Channel",
    sourceSystemKey: "toast",
  },
];

export function getTemplateHeaders(vendorKey: string) {
  return VENDOR_TEMPLATE_HEADERS[vendorKey] ?? [];
}

export function getExpectedHeaders(artifactKey: string, vendorKey?: string | null) {
  if (vendorKey) {
    const vendorHeaders = VENDOR_ARTIFACT_HEADERS[vendorKey]?.[artifactKey] ?? [];
    if (vendorHeaders.length > 0) {
      return vendorHeaders;
    }
  }

  return GENERIC_CSV_HEADERS[artifactKey] ?? [];
}

export function detectKnownSourceFormat(artifactKey: string, headers: string[]) {
  const normalizedHeaders = new Set(headers.map(normalizeHeader));
  const candidates = KNOWN_SOURCE_FORMATS.filter((format) => format.artifactKey === artifactKey);

  return (
    candidates
      .map((format) => {
        const required = format.headers.map(normalizeHeader);
        const matched = required.filter((header) => normalizedHeaders.has(header)).length;
        return {
          format,
          matchPct: required.length ? Math.round((matched / required.length) * 100) : 0,
        };
      })
      .filter((candidate) => candidate.matchPct >= 80)
      .sort((left, right) => right.matchPct - left.matchPct)[0] ?? null
  );
}

export function getArtifactPurpose(artifactKey: string) {
  return ARTIFACT_PURPOSES[artifactKey] ?? artifactKey;
}

export function getExpectedKind(artifactKey: string) {
  return ARTIFACT_EXPECTED_KIND[artifactKey] ?? "manual";
}

export function normalizeHeader(value: string) {
  return value
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/^["']+|["']+$/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}
