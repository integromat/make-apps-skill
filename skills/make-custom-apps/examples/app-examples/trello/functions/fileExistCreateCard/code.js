function fileExistCreateCard(fileName, fileData) {

    if(fileData){
        return {
            'value': fileData,
            'options': {
                'filename': fileName,
                'knownLength': iml.length(fileData)
            }
        };
    }else{
        return undefined;
    }

}