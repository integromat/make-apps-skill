function getFileName(s = "") {
    return s.match(new RegExp('\\"(.*)\\"'))[1];
}