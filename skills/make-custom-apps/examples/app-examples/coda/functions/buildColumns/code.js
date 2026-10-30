function buildColumns(items) {
	let outputArray = [];

	items.forEach(fields => {
		
		var obj = {}
		obj.name = fields.id;
		obj.label = fields.name;
		
		outputArray.push(obj);
	
	});
	
	return outputArray;
}