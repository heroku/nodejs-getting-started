var notificationBtn = document.getElementById("enable") 

function askNotificationPermission() {
  // Check if the browser supports notifications
  console.log("Asking permission!")
  if (!("Notification" in window)) {
    console.log("This browser does not support notifications.");
    return;
  }
  Notification.requestPermission().then((permission) => {
    // set the button to shown or hidden, depending on what the user answers
    console.log(permission)
    notificationBtn.style.display = permission === "granted" ? "none" : "block";
    if (permission === "granted") {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('public/js/service-worker.js')
            .then(function(registration) {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(function(error) {
                console.error('Service Worker registration failed:', error);
            });
        }
        sendNotification()
    }
  });
}

function sendNotification() {
    const img = "public/assets/sad_blood.jpg";
    const blood_type = "O+"
    const text = `HEY! Gimme your ${blood_type} blood!`;
    const notification = new Notification("Blood Donation Center", { body: text, icon: img });
}


