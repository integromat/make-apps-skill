function parseError(error, expect) {
	// in case of 503, body.error doesn't exist
	if(!error) return;
	const regex = /^Unknown field name: "([^"]+)"$/m;
	if (typeof error.message === "string" && regex.exec(error.message) && Array.isArray(expect)) {
		const fieldId = regex.exec(error.message)[1];
		
		const record = expect.find(p => p.name === "record");
		if (!record || !Array.isArray(record.spec)) return error.message;
		
		const field = record.spec.find(f => f.name === fieldId);
		if (!field) return error.message;
		
		return `${error.message}\n\nAirtable cannot find this column: "${field.label}".\nIf you have modified or removed the column from the table, please edit this module, check the input parameters accordingly and save the scenario.`;
	}
	return error.message || error.type || error;
}