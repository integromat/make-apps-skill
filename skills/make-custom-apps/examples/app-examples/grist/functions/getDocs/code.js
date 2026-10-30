function getDocs(workspaces = []) {
    // extracts all docs from each workspace and returns as an array
    return workspaces.reduce((acc, c) => acc.concat(c.docs), []);
}