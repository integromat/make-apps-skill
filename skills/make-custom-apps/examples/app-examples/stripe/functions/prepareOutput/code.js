function prepareOutput(item) {
	switch (item.object) {
		case 'charge':
			item.created = new Date(item.created * 1000);
			item.refunds = undefined;
			break;
		case 'balance_transaction':
			item.created = new Date(item.created * 1000);
			if (item.available_on !== undefined && item.available_on !== null) {
				item.available_on = new Date(item.available_on * 1000);
			}
			if (item.sourced_transfers !== undefined && item.sourced_transfers !== null) {
				delete item.sourced_transfers;
			}
			break;
		case 'refund':
			item.created = new Date(item.created * 1000);
			break;
		case 'customer':
			item.created = new Date(item.created * 1000);
			if (typeof item.sources === "object" && item.sources !== null) {
				delete item.sources.object;
				delete item.sources.has_more;
				delete item.sources.url;
			}
			if (typeof item.subscriptions === "object" && item.subscriptions !== null) {
				delete item.subscriptions.object;
				delete item.subscriptions.has_more;
				delete item.subscriptions.url;
			}
			break;
		case 'transfer':
			item.created = new Date(item.created * 1000);
			delete item.reversals.object;
			delete item.reversals.url;
			delete item.reversals.has_more;
			break;
		case 'invoice':
			// delete item.lines;
			item.created = new Date(item.created * 1000);
			item.due_date = item.due_date ? new Date(item.due_date * 1000) : undefined;
			item.next_payment_attempt = item.next_payment_attempt ? new Date(item.next_payment_attempt * 1000) : undefined;
			item.period_end = new Date(item.period_end * 1000);
			item.period_start = new Date(item.period_start * 1000);
			item.webhooks_delivered_at = new Date(item.webhooks_delivered_at * 1000);
			if (typeof item.status_transitions === "object" && item.status_transitions !== null) {
				item.status_transitions.finalized_at = item.status_transitions.finalized_at ? new Date(item.status_transitions.finalized_at * 1000) : undefined;
				item.status_transitions.marked_uncollectible_at = item.status_transitions.marked_uncollectible_at ? new Date(item.status_transitions.marked_uncollectible_at * 1000) : undefined;
				item.status_transitions.paid_at = item.status_transitions.paid_at ? new Date(item.status_transitions.paid_at * 1000) : undefined;
				item.status_transitions.voided_at = item.status_transitions.voided_at ? new Date(item.status_transitions.voided_at * 1000) : undefined;
			}
			break;
		case 'invoiceitem':
			item.date = new Date(item.date * 1000);
			if (typeof item.period === "object" && item.period !== null) {
				item.period.end = new Date(item.period.end * 1000);
				item.period.start = new Date(item.period.start * 1000);
			}
			if (typeof item.price === "object" && item.price !== null) {
				item.price.created = new Date(item.price.created * 1000);
			}
			break;
		case 'line_item':
			if (typeof item.period === "object" && item.period !== null) {
				item.period.start = new Date(item.period.start * 1000);
				item.period.end = new Date(item.period.end * 1000);
			}
			if (typeof item.plan === "object" && item.plan !== null) {
				item.plan.created = new Date(item.plan.created * 1000);
			}
			if (typeof item.price === "object" && item.price !== null) {
				item.price.created = new Date(item.price.created * 1000);
			}
			break;
		case 'payment_intent':
			item.created = new Date(item.created * 1000);
			if(item.canceled_at) item.canceled_at = new Date(item.canceled_at * 1000);
			break;
	}

	delete item.object;
	return item;
}