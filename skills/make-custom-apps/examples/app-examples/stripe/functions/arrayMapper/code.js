function arrayMapper(body, key, arr) {
		for(let i in arr){
			if(i === "metadata"){
				arr[i] = iml.mapToKeyVal(arr[i]);
			}
			if(typeof(arr[i]) === "object"){
				arrayMapper(body, key + "["+i+"]", arr[i])
			}
			else{
				body[key +"[" + i + "]"] = arr[i];
			}
		}
}