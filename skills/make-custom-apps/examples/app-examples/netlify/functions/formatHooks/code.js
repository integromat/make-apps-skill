function formatHooks(eventsArr) {
    const events = [];
    for (let i = 0; i < eventsArr.length; i++) {
        if (eventsArr[i].includes("deploy")) {
            let event = eventsArr[i].split('_');

            let eventName = event[0].charAt(0).toUpperCase() + event[0].slice(1);
            for (let j = 1; j < event.length; j++) {
                eventName = eventName + ' ' + event[j].charAt(0).toUpperCase() + event[j].slice(1);
            }

            events.push({
                name: eventName,
                value: eventsArr[i]
            });
        }
    }

    return events;
}