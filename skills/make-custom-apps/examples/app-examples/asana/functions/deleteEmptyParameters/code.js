function deleteEmptyParameters(startObject) {

    for (key in startObject) {
         // boolean with value false should not be deleted
        if (startObject[key] === '' || startObject[key] === null ||  (Array.isArray(startObject[key]) && startObject[key].length === 0)) {
            delete startObject[key]
        }
    }
    return startObject
}