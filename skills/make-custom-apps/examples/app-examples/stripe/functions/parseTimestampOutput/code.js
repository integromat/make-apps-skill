function parseTimestampOutput(itemObj) {
    itemObj.price.created = itemObj.price.created ? iml.parseDate(Number(itemObj.price.created ), 'X') : null;

    
    return itemObj;
}