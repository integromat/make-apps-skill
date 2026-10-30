function buildInterfaceForGroup(group) {
let object;
if(group === "account"){
	object = [{"name":"id","type":"text","label":"ID"},{"name":"object","type":"text","label":"Object"},{"name":"business_logo","type":"text","label":"Business logo"},{"name":"business_name","type":"text","label":"Business name"},{"name":"business_url","type":"text","label":"Business url"},{"name":"charges_enabled","type":"boolean","label":"Charges enabled"},{"name":"country","type":"text","label":"Country"},{"name":"created","type":"number","label":"Created"},{"name":"debit_negative_balances","type":"boolean","label":"Debit negative balances"},{"name":"decline_charge_on","type":"collection","label":"Decline charge on","spec":[{"name":"avs_failure","type":"boolean","label":"AVS failure"},{"name":"cvc_failure","type":"boolean","label":"CVC failure"}]},{"name":"default_currency","type":"text","label":"Default currency"},{"name":"details_submitted","type":"boolean","label":"Details submitted"},{"name":"display_name","type":"text","label":"Display name"},{"name":"email","type":"text","label":"Email"},{"name":"external_accounts","type":"collection","label":"External accounts","spec":[{"name":"object","type":"text","label":"Object"},{"name":"data","type":"array","label":"Data"},{"name":"has_more","type":"boolean","label":"Has more"},{"name":"total_count","type":"number","label":"Total count"},{"name":"url","type":"text","label":"URL"}]},{"name":"legal_entity","type":"collection","label":"Legal entity","spec":[{"name":"additional_owners","type":"array","label":"Additional owners"},{"name":"address","type":"collection","label":"Address","spec":[{"name":"city","type":"text","label":"City"},{"name":"country","type":"text","label":"Country"},{"name":"line1","type":"text","label":"Line 1"},{"name":"line2","type":"text","label":"Line 2"},{"name":"postal_code","type":"text","label":"Postal code"},{"name":"state","type":"text","label":"State"}]},{"name":"business_name","type":"text","label":"Business name"},{"name":"business_tax_id_provided","type":"boolean","label":"Business tax ID provided"},{"name":"dob","type":"collection","label":"DOB","spec":[{"name":"day","type":"text","label":"Day"},{"name":"month","type":"text","label":"Month"},{"name":"year","type":"text","label":"Year"}]},{"name":"first_name","type":"text","label":"First name"},{"name":"last_name","type":"text","label":"Last name"},{"name":"personal_address","type":"collection","label":"Personal address","spec":[{"name":"city","type":"text","label":"City"},{"name":"country","type":"text","label":"Country"},{"name":"line1","type":"text","label":"Line 1"},{"name":"line2","type":"text","label":"Line 2"},{"name":"postal_code","type":"text","label":"Postal code"},{"name":"state","type":"text","label":"State"}]},{"name":"personal_id_number_provided","type":"boolean","label":"Personal ID number provided"},{"name":"ssn_last_4_provided","type":"boolean","label":"SSN last 4 provided"},{"name":"type","type":"text","label":"Type"},{"name":"verification","type":"collection","label":"Verification","spec":[{"name":"details","type":"text","label":"Details"},{"name":"details_code","type":"text","label":"Details code"},{"name":"document","type":"text","label":"Document"},{"name":"status","type":"text","label":"Status"}]}]},{"name":"metadata","type":"collection","label":"Metadata","spec":[]},{"name":"payout_schedule","label":"Payout schedule","type":"collection","spec":[{"name":"delay_days","type":"number","label":"Delay days"},{"name":"interval","type":"text","label":"Interval"}]},{"name":"payout_statement_descriptor","type":"text","label":"Payout statement descriptor"},{"name":"payouts_enabled","type":"boolean","label":"Payouts enabled"},{"name":"product_description","type":"text","label":"Product description"},{"name":"statement_descriptor","type":"text","label":"Statement descriptor"},{"name":"support_email","type":"text","label":"Support email"},{"name":"support_phone","type":"text","label":"Support phone"},{"name":"timezone","type":"text","label":"Timezone"},{"name":"tos_acceptance","type":"collection","label":"TOS acceptance","spec":[{"name":"date","type":"text","label":"Date"},{"name":"ip","type":"text","label":"IP"},{"name":"user_agent","type":"text","label":"User agent"}]},{"name":"type","type":"text","label":"Type"},{"name":"verification","type":"collection","label":"Verification","spec":[{"name":"disabled_reason","type":"text","label":"Disabled reason"},{"name":"due_by","type":"text","label":"Due by"},{"name":"fields_needed","label":"Fields needed","type":"array"}]}];
}
else if(group === "account.application"){
	object = [{"name":"id","label":"ID"}];
}

var out = [
		{
			"name": "created",
			"type": "date",
			"label": "Created"
		},
		{
			"name": "event_type",
			"type": "text",
			"label": "Event type"
		},
		{
			"name": "event_id",
			"type": "text",
			"label": "Event ID"
		},
		{
			"name": "object",
			"label": "Object",
			"type": "collection",
			"spec": object
		}
	]
return out;
}