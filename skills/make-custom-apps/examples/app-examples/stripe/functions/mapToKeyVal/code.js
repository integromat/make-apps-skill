function mapToKeyVal(array) {
	if(array.lenght === 0){
		return null;
	}
	else{
		const out = {};
		for(var i in array){
			out[array[i].key] = array[i].value;
		}
		return out;
	}
}