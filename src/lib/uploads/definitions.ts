export const VENDOR_TEMPLATE_HEADERS: Record<string, string[]> = {
  heartland:
    "trans_date,trans_id,card_type,trans_amount,fee_amount,disc_rate,disc_amount,auth_code,terminal_id,batch_id,card_number_last4,trans_type".split(","),
  toast:
    "date,batch_date,pos_merchant_sales,platform_net_sales,transaction_fees,processing_fees,other_merchant_fees,calculated_recovery_variance,bank_deposit_amount,card_type,entry_method,interchange_rate_applied,transaction_count,notes".split(","),
  square:
    "date,transaction_id,amount,fee,net_total,card_brand,pan_suffix,device_name,location_name,description,refund_id,dispute_id".split(","),
  worldpay:
    "txn_date,txn_id,card_brand,txn_amount,disc_rate,disc_amount,interchange_amount,assessment,terminal_id,batch_number,auth_number".split(","),
  chase:
    "transaction_date,transaction_id,card_type,transaction_amount,disc_rate,disc_amount,interchange_fee,service_fee,authorization_number,mid".split(","),
  ubereats:
    "date,order_id,item_subtotal,commission_charged,commission_rate_applied,platform_gross_sales,order_status,delivery_fee,tip,tax,settlement_date,menu_item_count,channel,notes".split(","),
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

export const ARTIFACT_EXPECTED_KIND: Record<string, "csv" | "pdf" | "manual"> = {
  "m01-agreement": "pdf",
  "m01-bank": "pdf",
  "m01-contract": "manual",
  "m01-pos": "csv",
  "m01-processor": "csv",
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

export function getTemplateHeaders(vendorKey: string) {
  return VENDOR_TEMPLATE_HEADERS[vendorKey] ?? [];
}

export function getExpectedHeaders(artifactKey: string, vendorKey?: string | null) {
  if (vendorKey) {
    const vendorHeaders = getTemplateHeaders(vendorKey);
    if (vendorHeaders.length > 0) {
      return vendorHeaders;
    }
  }

  return GENERIC_CSV_HEADERS[artifactKey] ?? [];
}

export function getArtifactPurpose(artifactKey: string) {
  return ARTIFACT_PURPOSES[artifactKey] ?? artifactKey;
}

export function getExpectedKind(artifactKey: string) {
  return ARTIFACT_EXPECTED_KIND[artifactKey] ?? "manual";
}

export function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}
