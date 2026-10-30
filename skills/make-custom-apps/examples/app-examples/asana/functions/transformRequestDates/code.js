function transformRequestDates(obj) {
	// Most of the dates that will be sent to the server need to have the format yyyy-mm-dd, others can just be ISO standard.
	// there is also a set of dates that actually need to be UNIX timestamps in milliseconds.
	if (!obj) return;
	
	dates = ["start_on","due_date","due_on"]; //meant for dates
	datetimes = ["due_at"]; //meant for datetimes in ISO standard. We don't do anything with these. Just writing it here so you know these exist.
	timestamps = []; //meant for unix timestamps
	time_timestamps = []; //meant for time
	
	var keys = iml.keys(obj);
	let keysLength = keys.length;
	
	var output = {};

	for (var j = 0; j < keysLength; j++) {
		//some dates/times are in arrays
		if (obj[keys[j]] && obj[keys[j]] instanceof Array &&  obj[keys[j]].length !== 0) {
			var new_array = [];
			for (var i = 0; i < obj[keys[j]].length ; i++) {
				if (obj[keys[j]][i] && typeof obj[keys[j]][i] === 'object') {
					new_array.push(transformRequestDates(obj[keys[j]][i]));
				} else { //this is for a simple array. Arrays of dates are unusual so this is ok for now.
					new_array.push(obj[keys[j]][i]);
				}
			}
			obj[keys[j]] = new_array;
		}
		
		//some dates/times are hidden deeper in collections
		if (obj[keys[j]] && typeof obj[keys[j]] === 'object' && !(obj[keys[j]] instanceof Array) && !(obj[keys[j]] instanceof Date)) {
			obj[keys[j]] = transformRequestDates(obj[keys[j]]);
		}
		
		//the transformations
		var value = obj[keys[j]];
		
		if (time_timestamps.includes(keys[j])) {
			time_hours = obj[keys[j]].split(':');
			value = time_hours[0]*3600000 + time_hours[1]*60000;
		}
		if (dates.includes(keys[j])) {
			value = iml.formatDate(obj[keys[j]], "YYYY-MM-DD");
		}
		if (timestamps.includes(keys[j])){
			value = parseInt(iml.formatDate(obj[keys[j]],'x'));
		}
		output[keys[j]] = value;
	}

	return output;
}