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
    //Manage Campaigns 
    const campaigns = (await getDocs('campaigns')).docs;
    for (let i = 0; i < campaigns.size; i++) {
        let campaign = campaigns.docs[i]
        if (Date.now() >= (campaign.campaignInfo.endDate - 1000 * 60 * 60) && campaign.status === "active") {
            campaign.status = 'ended'
        }
    }

    // Get users Videos stats
    const users = await getDocs('users');
    console.log("Updating stats for users =", users.docs.filter(u => u.userType === "creator").length)

    for (let i = 0; i < users.size; i++) {
        const user = users.docs[i]
        if (user.userType !== "creator") continue

        let userVideos = []
        try {
            campaigns.forEach(c => {
                const t = c.evolution.participatingCreators.find(
                    pc => pc.creator.email === user.email
                )?.videos?.filter((vid) => vid.status === "active")?.map(vid => {
                    return { ...vid, campaignId: c.id }
                })
                if (t)
                    userVideos.push(t)
            })

            console.log('getting data for', user.email, "videos", userVideos.map(v => v.id))

            /*const updateUser = await (await fetch('https://campay-api.vercel.app/api/refresh_token?email=' + user?.email + '&refresh_token=' + user?.tiktokToken.refresh_token)).json()
            console.log(' Token ', updateUser?.tiktokToken)

            const createResponse = await fetch('https://open.tiktokapis.com/v2/video/query/?fields=id,title,video_description,duration,cover_image_url,embed_link,view_count,like_count,comment_count,share_count,create_time', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + updateUser?.tiktokToken.access_token
                },
                body: JSON.stringify({ "filters": { "video_ids": userVideos.map(v => v.id) } })
            });
            const response = await createResponse.json()
            console.log(' video query ', response)
            const UpdatedVideos = response.data.videos;

            userVideos.forEach((uv) => {
                let temp = campaigns[uv.campaignId].evolution.participatingCreators.find(
                    pc => pc.creator.email === user.email
                )?.videos?.find((vid) => vid.id === uv.id)
                if (temp)
                    temp.history = temp?.history ?
                        temp?.history.concat([{
                            views: UpdatedVideos.find(upV => upV.id === uv.id).view_count,
                            likes: UpdatedVideos.find(upV => upV.id === uv.id).like_count,
                            shares: UpdatedVideos.find(upV => upV.id === uv.id).share_count,
                            comments: UpdatedVideos.find(upV => upV.id === uv.id).comment_count,
                            date: Date.now()
                        }])
                        :
                        [{
                            views: UpdatedVideos.find(upV => upV.id === uv.id).view_count,
                            likes: UpdatedVideos.find(upV => upV.id === uv.id).like_count,
                            shares: UpdatedVideos.find(upV => upV.id === uv.id).share_count,
                            comments: UpdatedVideos.find(upV => upV.id === uv.id).comment_count,
                            date: Date.now()
                        }]
            })
*/

            await wait(10)

        } catch (error) {
            console.error('Erreur récupération compte Tiktok:', user.email, error);
        }
    }
};

let secondstilNext6hr = 10 //(60 * 60 * 6) - (Math.floor((new Date()).valueOf() / 1000) % (60 * 60 * 6))

setTimeout(() => {
    console.log(" ---- regular update Start ---- ");
    updateCycle();
    interval = setInterval(updateCycle, 1000 * 60 * 10);
}, secondstilNext6hr * 1000)


function wait(seconds) {
    return new Promise((resolve, reject) => {
        // Simulate an asynchronous task (e.g., a network request, a timer)
        setTimeout(() => {
            const success = true; // Simulate success or failure
            if (success) {
                resolve("Function completed successfully!");
            } else {
                reject("Function encountered an error.");
            }
        }, seconds * 1000); // Wait for 2 seconds
    });
}






