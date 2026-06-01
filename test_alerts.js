const mqtt = require('mqtt');

// Enkel testklient för att simulera tracker-data
const client = mqtt.connect('mqtt://localhost:1883');

const topic = 'teltonika/fmc880/test-device';

const send = (data) => {
    client.publish(topic, JSON.stringify(data));
};

client.on('connect', () => {
    console.log('Testklient ansluten. Skickar testdata...');

    // Test 1: Bogsering startar, tändning slås på innan 3 min -> Inget larm
    console.log('--- Test 1: Bogsering + Tändning (Ingen webhook ska skickas) ---');
    send({ latlng: '56.8,14.8', ts: Date.now(), '246': 1, '239': 0 }); // Bogsering startar
    setTimeout(() => {
        send({ latlng: '56.8,14.8', ts: Date.now(), '246': 1, '239': 1 }); // Tändning på
    }, 1000);

    // Test 2: Bogsering > 100m -> Larm
    setTimeout(() => {
        console.log('--- Test 2: Bogsering > 100m (Webhook ska skickas) ---');
        send({ latlng: '56.8,14.8', ts: Date.now(), '246': 1, '239': 0 }); 
        setTimeout(() => {
            send({ latlng: '56.9,14.9', ts: Date.now(), '246': 1, '239': 0 }); // Långt bort
        }, 5000);
    }, 5000);
});
