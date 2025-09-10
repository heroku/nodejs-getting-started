self.addEventListener('push', function(event) {
    const options = {
        body: event.data ? event.data.text() : 'Blood Notification',
        icon: '/public/assets/sad_blood.jpg',
        badge: '/public/assets/sad_blood.jpg'
    };

    event.waitUntil(
        self.registration.showNotification('Notification Title', options)
    );
});