function errorDetails(errors) {

    let result = '';

    errors.forEach(item => {
        let string = '\n ◉ ' + item.field + ': ' + item.message;

        result = result + string;
    });

    return result;
}