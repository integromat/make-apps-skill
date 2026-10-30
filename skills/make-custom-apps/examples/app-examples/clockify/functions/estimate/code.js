function estimate(parameters) {

    if(!parameters.type) return;

    return {
        estimate: iml.if(parameters.type === 'AUTO', 0, parameters.estimate),
        type: parameters.type
    };

}