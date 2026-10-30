function returnSectionsKeys(sections) {

    if(Object.keys(sections).length === 0) return;

    let arr = [];

    for (let [key, value] of Object.entries(sections)) {
        let obj = {};

        obj.label = key;
        obj.value = key;

        arr.push(obj);
    }

    return arr;
}