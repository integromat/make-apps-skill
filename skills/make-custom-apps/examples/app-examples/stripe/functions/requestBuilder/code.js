function requestBuilder(body, metadata, fraud_details, shipping, source) {
	if(body === null){
		body = {};
	}
	if(metadata !== null){
		iml.arrayMapper(body, "metadata", metadata);
	}
	if(fraud_details !== null){
		iml.arrayMapper(body, "fraud_details", fraud_details);
	}
	if(shipping !== null && shipping.name !== null && shipping.address.line1 !== null){
		iml.arrayMapper(body, "shipping", shipping)
	}
	if(source !== null && source.object !== null){
		iml.arrayMapper(body, "source", source)
	}
	return body;
}