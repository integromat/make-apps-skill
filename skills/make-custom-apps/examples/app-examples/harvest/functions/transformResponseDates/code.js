function transformResponseDates(obj) {
	// All datetimes are ISO but they are in a string....
	// On top of that those dates/times can be in nested collections.
	var timestamp_date_keys = ["timer_started_at","created_at","updated_at","updated_since","sent_at","paid_at","closed_at","created_at","updated_at"];
	var exceptions = []; //"Date": "Mon, 24 Feb 2020 16:23:28 +0800",
	var timestamp_time_keys = []; 

	if (!obj) return null;
	
	var keys = iml.keys(obj);
	let keysLength = keys.length;
	
	var output = {}
	for (var i = 0; i < keysLength; i++) {
		if (obj[keys[i]] && obj[keys[i]] instanceof Array &&  obj[keys[i]].length !== 0) {
			var new_array = [];
			for (var j = 0; j < obj[keys[i]].length ; j++) {
				if (obj[keys[i]][j] && typeof obj[keys[i]][j] === 'object') {
					new_array.push(transformResponseDates(obj[keys[i]][j]));
				} else {
					new_array.push(obj[keys[i]][j]);
				}
			}
			obj[keys[i]] = new_array;
		}
		
		if (obj[keys[i]] && typeof obj[keys[i]] === 'object' && !(obj[keys[i]] instanceof Array) ) {
			//some dates/times are hidden deeper
			obj[keys[i]] = transformResponseDates(obj[keys[i]]);
		}
		var value = obj[keys[i]];
		
		if (timestamp_date_keys.includes(keys[i])) {
			value = new Date(value);
		}
		if (exceptions.includes(keys[i])) {
			value = iml.parseDate(value,'ddd, DD MMM YYYY HH:mm:ss ZZZZZ');
		}
		if (timestamp_time_keys.includes(keys[i])) {
			value = new Date(value).toISOString().slice(-13, -5);
		}
		
		output[keys[i]] = value;
	}
	
	return output;
}