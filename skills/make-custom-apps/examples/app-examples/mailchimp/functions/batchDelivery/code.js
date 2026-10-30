function batchDelivery(param) {

    if(!param.batch_delivery) return undefined;

    return {
        batch_delay: param.batch_delay,
        batch_count: param.batch_count
    };

}