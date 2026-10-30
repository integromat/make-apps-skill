function isMapping(input) {
    if (typeof input !== 'string') return false
    const regex = /{{[^{}]*}}/g;
    return !regex.test(input);
}