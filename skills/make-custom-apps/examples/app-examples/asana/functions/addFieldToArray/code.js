function addFieldToArray(parameters,...fields) {
	if ( !(parameters["opt_fields"] instanceof Array && parameters["opt_fields"].length !== 0) ) {
		parameters["opt_fields"] = [];
	}
	fields.forEach(field=> {parameters["opt_fields"].push(field);} );
	
	return parameters;
}