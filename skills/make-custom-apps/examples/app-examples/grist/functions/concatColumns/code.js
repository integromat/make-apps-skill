function concatColumns(fields = {}) {
    // Returns first 3 values of a row.
    // Example: "$Column1:abc $Bcolumn:edf"
    return Object.entries(fields).slice(0, 3).reduce((acc, c) => ((acc += '$' + c[0] + ':' + c[1] + ' '), acc), '');
}