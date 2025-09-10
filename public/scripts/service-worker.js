self.addEventListener('push', function(event) {
    const options = {
        body: event.data ? event.data.text() : 'Blood Notification',
        icon: 'assets/sad_blood.png',
        badge: 'assets/sad_blood.jpg'
    };

    event.waitUntil(
        self.registration.showNotification('Notification Title', options)
    );
});