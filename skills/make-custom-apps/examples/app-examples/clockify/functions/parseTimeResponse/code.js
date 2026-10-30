function parseTimeResponse(body) {

    let arr = body;

    arr.timeInterval.start = iml.parseDate(body.timeInterval.start);
    
    if (body.timeInterval.end) {
        arr.timeInterval.end = iml.parseDate(body.timeInterval.end);
    }

    return arr;
}