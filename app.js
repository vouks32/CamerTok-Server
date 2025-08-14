import { getDocs, query, updateDoc } from './localDatabase.js';
import { defineWebSocket, api, GetTiktokInfo } from "./api/user.js";

import Tiktok from '@tobyg74/tiktok-api-dl'

console.clear();
api.listen(80, () => {
    console.log(`Serveur joueur démarré sur le port 80`);
});

defineWebSocket();

let interval

const updateCycle = async () => {
    /* const now = new Date();
     const minutes = now.getMinutes();
     phaseMinutes = minutes % 20;
     remainingMinutes = isDayPhase ? (9 - phaseMinutes) : (19 - phaseMinutes);
     remainingSeconds = 59 - now.getSeconds();
 
     if ((minutes % 20) < 10 && !isDayPhase) { }
     if ((minutes % 20) >= 10 && isDayPhase) { }
 
     isDayPhase = (minutes % 20) < 10;*/

    const users = await getDocs('users');
    console.log(users.size)
    for (let i = 0; i < users.size; i++) {
        const user = users.docs[i]
        try {
            if ((user.lastTiktokUpdate && user.lastTiktokUpdate < Date.now() - (1000 * 60 * 60 * 12)) && (!user.lastConnected || (user.lastConnected && user.lastConnected > Date.now() - (1000 * 60 * 60 * 24 * 14)))) {
                console.log("new user", user.username)
                const { username } = user;
                const TiktokAccount = await GetTiktokInfo(username)
                if (TiktokAccount.status === "error") {
                    console.log('compte non trouvé', username, user.email);
                } else {
                    await updateDoc('users', user.email, { tiktokUser: TiktokAccount.result, lastTiktokUpdate: Date.now() })
                }
            }
            await wait()

        } catch (error) {
            console.error('Erreur récupération compte Tiktok:', user.email, error);
        }
    }
};

let timetilNextMin = 60 - ((new Date()).getSeconds() % 60)
setTimeout(() => {
    console.log(" ---- regular update Start ---- ");
  //  updateCycle();
   // interval = setInterval(updateCycle, 1000 * 60 * 10);
}, timetilNextMin * 1000)


function wait() {
    return new Promise((resolve, reject) => {
        // Simulate an asynchronous task (e.g., a network request, a timer)
        setTimeout(() => {
            const success = true; // Simulate success or failure
            if (success) {
                resolve("Function completed successfully!");
            } else {
                reject("Function encountered an error.");
            }
        }, 2000); // Wait for 2 seconds
    });
}






