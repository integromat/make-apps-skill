function intToString(startObject) {
    if (startObject.section != null) {
        startObject.section = startObject.section.toString();
    }
    return startObject;
}