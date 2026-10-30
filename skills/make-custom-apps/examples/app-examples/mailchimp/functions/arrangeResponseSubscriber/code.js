function arrangeResponseSubscriber(obj, interface) {

	let arr = [];
	if (obj.interests) {
		for (let [key, value] of Object.entries(obj.interests)) {
			if (value === true) {
				arr.push(key);
			}
		}
		interface.filter(i => i.metadata && i.metadata.type === 'interest-categories').forEach(item => {
			let obj1 = {};
			item.spec.forEach(j => {
				let arr1 = [];
				j.metadata.values.forEach(k => {
					arr.forEach(l => {
						if (l === k.id) {
							arr1.push(k.name);
						}
					});
				});
				if(j.type === 'text') {
					if(iml.length(arr1) === 0) obj1[j.name] = null;
					else if (iml.length(arr1) === 1) obj1[j.name] = arr1[0];
				}
				else if(j.type === 'array') {
					if (iml.length(arr1) === 0) obj1[j.name] = [];
					else obj1[j.name] = arr1;
				}
			});
			obj.interests = obj1;
		});
	}

	return obj;
}