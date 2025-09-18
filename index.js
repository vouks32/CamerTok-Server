//import { getDocs, query, updateDoc } from './localDatabase.js';
//import Tiktok from '@tobyg74/tiktok-api-dl'
import { addDoc, getDoc, getDocs, updateDoc, uploadFile, getFileUrl, deleteFile } from './firestore.js';
import e from 'express';
import cors from "cors";
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import Tiktok from '@tobyg74/tiktok-api-dl'
// server.js
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const api = e();
api.use(cors({
  allowedHeaders: "*",
  origin: function (origin, callback) { // allow requests with no origin  // (like mobile apps or curl requests)
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE"]
}));
api.use(e.json());

// Initialisation du compte
api.post('/api/users', async (req, res) => {
  try {
    const player = req.body;
    console.log("-------------");
    console.log("Création du compte", player.email);

    const playerData = {
      ...player,
      campaigns: [],
      lastUpdated: Date.now(),
      lastConnected: Date.now(),
      lastTiktokUpdate: Date.now(),
    };

    await addDoc('users', player.email, playerData)
    console.log("Création du compte COMPLÉTÉ AVEC SUCCES");
    res.status(201).json(playerData);
  } catch (error) {
    console.error('ERREUR création compte:', error);
    res.status(500).json({ error: 'Échec création compte' });
  }
});

// Mise à jour du compte
api.put('/api/users', async (req, res) => {
  try {
    if (!req.body) return;
    const { email } = req.body;
    console.log('--------------')
    console.log('updating', email)

    const playerData = await updateDoc('users', email, { ...req.body.updates, lastUpdated: Date.now(), lastConnected: Date.now() })

    if (playerData)
      console.log('updated successfully')
    res.json(playerData);
  } catch (error) {
    console.error('Erreur mise à jour compte:', error);
    res.status(500).json({ error: 'Échec mise à jour compte' });
  }
});

// Récupération des données compte
api.get('/api/users', async (req, res) => {
  const { email } = req.query;
  try {
    console.log("-------------");
    const playerDoc = email.includes('@all') ? await getDocs('users') : await getDoc('users', email);
    console.log('récupération des informations de', email);

    if (!playerDoc) {
      console.log('compte non trouvé', email);
      return res.status(404).json({ error: 'compte non trouvé' });
    }

    if (!email.includes('@all'))
      updateDoc('users', email, { lastConnected: Date.now() })

    console.log('compte  trouvé', email);
    res.json(playerDoc);
  } catch (error) {
    console.error('Erreur récupération compte:', email, error);
    res.status(500).json({ error: 'Échec récupération compte' });
  }
});

// Récupération des données compte
api.get('/api/tiktok/info', async (req, res) => {
  try {
    const { username } = req.query;
    console.log("-------------");
    console.log('récupération de s informations de', username);

    const TiktokAccount = await GetTiktokInfo(username)

    if (TiktokAccount.status === "error") {
      console.log('compte non trouvé', username);
      return res.status(404).json({ error: 'compte non trouvé' });
    }

    res.json(TiktokAccount);
  } catch (error) {
    console.error('Erreur récupération compte:', email, error);
    res.status(500).json({ error: 'Échec récupération compte' });
  }
});

const GetTiktokInfo = async (username) => {
  const TiktokAccount = await Tiktok.StalkUser(username)

  if (TiktokAccount.status !== "error") {
    console.log('compte trouvé', username);
    const userPosts = { status: "failed" } //await Tiktok.GetUserPosts(username)
    if (userPosts.status === 'success') {
      console.log(userPosts.totalPosts, "posts récupéré");
      TiktokAccount.result.posts = GetPostsStats(userPosts.result)
    } else {
      console.log(" AUCUN posts récupéré");
      TiktokAccount.result.posts = []
    }
    return TiktokAccount
  }
  return TiktokAccount
}

const GetPostsStats = (posts) => {
  const postsPerDays = []

  posts.forEach((post, i) => {
    let correspondingPPDIndex = postsPerDays.findIndex((_day) => (post.createTime > _day.timeStamp && post.createTime < _day.timeStamp + (60 * 60 * 24)))
    if (correspondingPPDIndex !== -1) {
      postsPerDays[correspondingPPDIndex].posts.push(post)
    } else {
      const postDate = new Date(post.createTime)
      postsPerDays.push({
        posts: [post],
        timeStamp: Math.round(new Date(postDate.getFullYear(), postDate.getMonth(), postDate.getDate()).valueOf() / 1000)
      })
    }
  })

  postsPerDays.forEach((_ppd, i) => {
    const stats = {
      shareCount: 0,
      collectCount: 0,
      commentCount: 0,
      likeCount: 0,
    }
    _ppd.post.forEach(ppdPost => {
      stats.shareCount += ppdPost.stats.shareCount;
      stats.collectCount += ppdPost.stats.collectCount;
      stats.commentCount += ppdPost.stats.commentCount;
      stats.likeCount += ppdPost.stats.likeCount;
    })
    postsPerDays[i].stats = stats
  })

  return postsPerDays.sort((a, b) => a.timeStamp - b.timeStamp)
}


api.post("/api/campaigns/files", async (req, res) => {
  try {
    const { campaignid } = req.query;
    const uploadedFiles = [];

    for (const file of req.files) {
      const filePath = `campaigns/${campaignid}/${file.originalname}`;
      const downloadURL = await uploadFile(file.buffer, filePath, file.mimetype);

      uploadedFiles.push({
        originalname: file.originalname,
        filename: file.originalname,
        path: filePath,
        size: file.size,
        downloadURL
      });
    }

    console.log('Files uploaded to Firebase Storage');
    res.json({ ok: true, files: uploadedFiles });
  } catch (error) {
    console.error("Firebase upload error:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

api.post("/api/campaigns/data", async (req, res) => {
  try {
    const campaign = req.body;

    if (campaign.action && campaign.action === "delete") {
      console.log("-------------");
      console.log("suppression de la campagne", campaign.campaignId);
      const updated = await updateDoc('campaigns', campaign.campaignId, { deleted: true })
      console.log("suppression de la campaign COMPLÉTÉ AVEC SUCCES");
      res.status(201).json({ deleted: true, update: updated });
      return
    }

    console.log("-------------");
    console.log("Création de la campagne", campaign.id);

    const playerData = {
      ...campaign,
      lastUpdated: Date.now()
    };

    await addDoc('campaigns', campaign.id, campaign)
    console.log("Création de la campaign COMPLÉTÉ AVEC SUCCES");
    res.status(201).json(campaign);
  } catch (error) {
    console.error('ERREUR création de la campagne:', error);
    res.status(500).json({ error: 'Échec création campagne' });
  }
});

api.put("/api/campaigns/data", async (req, res) => {
  try {
    const campaign = req.body;

    console.log("-------------");
    console.log("Modification de la campagne", campaign.id);

    await updateDoc('campaigns', campaign.id, campaign)
    console.log("Modification de la campaign COMPLÉTÉ AVEC SUCCES");
    res.status(201).json(campaign);
  } catch (error) {
    console.error('ERREUR création de la campagne:', error);
    res.status(500).json({ error: 'Échec création campagne' });
  }
});

// Récupération des données de la campagne
api.get("/api/campaigns/data", async (req, res) => {
  try {
    const { id } = req.query;
    console.log("-------------");
    const campaignDoc = id.includes('@all') ? await getDocs('campaigns') : await getDoc('campaigns', id);
    console.log('récupération des informations de la campagne', id);

    if (!campaignDoc) {
      console.log('campagne non trouvé', id);
      return res.status(404).json({ error: 'campagne non trouvé' });
    }

    console.log('campagne trouvé', id);
    res.json(campaignDoc);
  } catch (error) {
    console.error('Erreur récupération campagne:', req.query, error);
    res.status(500).json({ error: 'Échec récupération campagne' });
  }
});

// Récupération des fichiers de la campagne
api.get("/api/campaigndocs/:campaignid/:filename", async (req, res) => {
  try {
    const { campaignid, filename } = req.params;
    const filePath = `campaigns/${campaignid}/${filename}`;

    const downloadURL = await getFileUrl(filePath);
    res.redirect(downloadURL);
  } catch (error) {
    console.error('Erreur récupération du fichier:', req.params, error);
    res.status(500).json({ error: 'Échec récupération fichier' });
  }
});

// Suppression des fichiers
api.delete("/api/campaigndocs/:campaignid/:filename", async (req, res) => {
  try {
    const { campaignid, filename } = req.params;
    const filePath = `campaigns/${campaignid}/${filename}`;

    await deleteFile(filePath);
    res.json({ ok: true, message: 'Fichier supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression du fichier:', req.params, error);
    res.status(500).json({ error: 'Échec suppression fichier' });
  }
});


/////////////////////////////////////////      TIKTOK   //////////////////////////////////////////


const CLIENT_KEY = 'sbawichfdxmm1wsd4z';
const CLIENT_SECRET = 'AjwK8nzMegJOzmBZ7zg7zpUuO1NMZesw';
const REDIRECT_URI = '/api/webhook'

/////// //get requests to the root ("/") will route here
api.get("/api/auth", async (req, res) => {
  let hostUrl = req.protocol + '://' + req.get('host');

  const { email } = req.query
  const csrfState = Math.random().toString(36).substring(2);
  res.cookie('csrfState', csrfState, { maxAge: 60000 });

  let url = 'https://www.tiktok.com/v2/auth/authorize/';

  // the following params need to be in `application/x-www-form-urlencoded` format.
  url += '?client_key=' + CLIENT_KEY;
  url += '&scope=user.info.basic,video.list,user.info.profile,user.info.stats';
  url += '&response_type=code';
  url += '&redirect_uri=' + encodeURIComponent(hostUrl + REDIRECT_URI);
  url += '&state=' + csrfState + "--" + email;

  console.log("redirecting to", url)
  res.redirect(url);

});


// Récupération des données de la campagne
api.get("/api/webhook", async (req, res) => {
  const { code, scopes, state, error, error_description } = req.query;
  let hostUrl = req.protocol + '://' + req.get('host');

  try {
    if (error) {
      console.log(error, error_description)
      res.redirect('/tiktokfail')
      return
    }
    if (code) {
      const tiktokAuthCode = { code, scopes, state, date: Math.round(Date.now() / 1000) }
      const userMail = state.split('--')[1]
      console.log(code, state)

      //// Save Auth_code
      const createResponse = await fetch(hostUrl + '/api/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          "skip_zrok_interstitial": "true"
        },
        body: JSON.stringify({
          email: userMail,
          updates: { tiktokAuthCode }
        })
      });

      let updatedUser = await createResponse.json();
      if (updatedUser.error) {
        console.log("error saving code", updatedUser.error)
      }

      // Get tokenResp
      const tokenResponse = await axios.post(
        'https://open.tiktokapis.com/v2/oauth/token/',
        {
          client_key: CLIENT_KEY,
          client_secret: CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: hostUrl + REDIRECT_URI,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
        }
      );
      const Tresponse = tokenResponse.data;
      if (!Tresponse.error) {

        //Get Profil info
        const ProfilResponse = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,avatar_url_100,display_name,bio_description,profile_deep_link,username,follower_count,following_count,likes_count,video_count', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer ' + Tresponse.access_token
          }
        });
        const Profil = (await ProfilResponse.json()).data.user

        // Save Token+tiktokProfil
        const updateResponse = await fetch(hostUrl + '/api/users', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            "skip_zrok_interstitial": "true"
          },
          body: JSON.stringify({
            email: userMail,
            updates: {
              tiktokUser: {
                ...Profil,
                date: Math.round(Date.now() / 1000),
              },
              tiktokToken: {
                ...Tresponse,
                access_token_date: Math.round(Date.now() / 1000),
                refresh_token_date: Math.round(Date.now() / 1000)
              }
            }
          })
        });

        let updatedUser = await updateResponse.json();
        if (updatedUser.error) {
          console.log("error saving Token", updatedUser.error)
          res.redirect('/tiktokfail')
        } else {
          res.redirect('/tiktoksuccess')
        }
      } else {
        console.log(Tresponse.error, Tresponse.error_description)
        res.redirect('/tiktokfail')
        return
      }

    } else {
      res.redirect('/tiktokfail')
    }
  } catch (error) {
    console.error('Erreur récupération du fiechier:', req.query, error);
    res.redirect('/tiktokfail')
  }
});

// Récupération des données de la campagne
api.get("/api/refresh_token", async (req, res) => {
  const { refresh_token, email } = req.query;
  let hostUrl = req.protocol + '://' + req.get('host');

  try {
    if (refresh_token) {
      const tokenResponse = await axios.post(
        'https://open.tiktokapis.com/v2/oauth/token/',
        {
          client_key: CLIENT_KEY,
          client_secret: CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
        }
      );

      const Tresponse = tokenResponse.data;
      if (!Tresponse.error) {
        //Get Profil info
        const ProfilResponse = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,avatar_url_100,display_name,bio_description,profile_deep_link,username,follower_count,following_count,likes_count,video_count', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer ' + Tresponse.access_token
          }
        });
        const Profil = (await ProfilResponse.json()).data.user

        // Save Token+tiktokProfil
        const updateResponse = await fetch(hostUrl + '/api/users', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            "skip_zrok_interstitial": "true"
          },
          body: JSON.stringify({
            email: userMail,
            updates: {
              tiktokUser: {
                ...Profil,
                "followerCount": Profil.follower_count,
                "followingCount": Profil.following_count,
                "heartCount": Profil.likes_count,
                "videoCount": Profil.video_count,
                date: Math.round(Date.now() / 1000),
              },
              tiktokToken: {
                ...Tresponse,
                access_token_date: Math.round(Date.now() / 1000),
                refresh_token_date: Math.round(Date.now() / 1000)
              }
            }
          })
        });

        let updatedUser = await updateResponse.json();
        if (updatedUser.error) {
          console.log("error saving Token", updatedUser.error)
          res.status(500).json({ success: false })
        } else {
          res.status(201).json(updatedUser);
        }
      } else {
        console.log(Tresponse.error, Tresponse.error_description)
        res.status(500).json({ success: false })
        return
      }
    } else {
      res.status(500).json({ success: false })
    }
  } catch (error) {
    //console.error('Erreur récupération du fiechier:', req.query, error);
    res.status(500).json({ success: false })
  }
});


/////// //get requests to the root ("/") will route here
api.get('/yo', async (req, res) => {
  let fullUrl = req.protocol + '://' + req.get('host');
  console.log(req.protocol, '://', req.get('host'), req.originalUrl)
  res.send("yooooooo => " + fullUrl);

});


/////// //get requests to the root ("/") will route here
api.get("/tiktoksuccess", async (req, res) => {
  res.sendFile(path.join(__dirname, 'tiktoksuccess.html'));
});
api.get("/tiktokfail", async (req, res) => {
  res.sendFile(path.join(__dirname, 'tiktokfailure.html'));
});




/////////  ------------------------------------- SHAKU MINING ------------------------------------- ////////


// Initialisation du compte
api.post('/api/shaku/users', async (req, res) => {
  try {
    const player = req.body;
    console.log("-------------");
    console.log("Création du compte -- SHAKU --", player.email);

    const playerData = {
      ...player,
      lastUpdated: Date.now(),
      lastConnected: Date.now(),
    };

    await addDoc('ShakuUsers', player.email, playerData)
    console.log("Création du compte -- SHAKU -- COMPLÉTÉ AVEC SUCCES");
    res.status(201).json(playerData);
  } catch (error) {
    console.error('ERREUR création compte:', error);
    res.status(500).json({ error: 'Échec création compte' });
  }
});

// Mise à jour du compte
api.put('/api/shaku/users', async (req, res) => {
  try {
    if (!req.body) return;
    const { email } = req.body;
    console.log('--------------')
    console.log('updating -- SHAKU --', email)

    const playerData = await updateDoc('ShakuUsers', email, { ...req.body.updates, lastUpdated: Date.now(), lastConnected: Date.now() })
    //// FAIRE DES TRUCS ////

    if (playerData)
      console.log('updated -- SHAKU -- successfully')
    res.json(playerData);
  } catch (error) {
    console.error('Erreur mise à jour compte --SHAKU --:', error);
    res.status(500).json({ error: 'Échec mise à jour compte' });
  }
});

// Récupération des données compte
api.get('/api/shaku/users', async (req, res) => {
  const { email } = req.query;
  try {
    console.log("-------------");
    const playerDoc = email.includes('@all') ? await getDocs('ShakuUsers') : await getDoc('ShakuUsers', email);
    console.log('récupération des informations -- SHAKU -- de', email);

    if (!playerDoc) {
      console.log('compte non trouvé', email);
      return res.status(404).json({ error: 'compte non trouvé' });
    }

    if (!email.includes('@all'))
      updateDoc('ShakuUsers', email, { lastConnected: Date.now() })

    console.log('compte -- SHAKU -- trouvé', email);
    res.json(playerDoc);
  } catch (error) {
    console.error('Erreur récupération compte -- SHAKU --:', email, error);
    res.status(500).json({ error: 'Échec récupération compte' });
  }
});


api.listen(80, () => {
  console.log(`Serveur joueur démarré sur le port 80`);
});


let interval

const updateCycle = async () => {
  //Manage Campaigns 
  const campaigns = (await getDocs('campaigns')).docs;

  /////////////////////////////   IF campaign enddate is past then end campaign
  for (let i = 0; i < campaigns.length; i++) {
    let campaign = campaigns[i]
    if (Date.now() >= (campaign.campaignInfo.endDate - 1000 * 60 * 60) && campaign.status === "active") {
      campaign.status = 'ended'
    }
  }

  // Get users Videos stats
  const users = await getDocs('users');
  console.group("Updating stats for users =", users.docs.filter(u => u.userType === "creator").length)

  let UpdatedUsersCount = 0

  for (let i = 0; i < users.size && UpdatedUsersCount <= 10; i++) {
    const user = users.docs[i]
    ///   Skip users that has being checked this last 24hrs
    if (user.userType !== "creator" || (user.lastCampaignsUpdatesDate && user.lastCampaignsUpdatesDate > (Date.now() - (60 * 60 * 24 * 1000)))) continue
    UpdatedUsersCount += 1;
    user.lastCampaignsUpdatesDate = Date.now()

    let userVideos = []
    try {
      campaigns.forEach(c => {
        const t = c.evolution.participatingCreators.find(
          pc => pc.creator.email === user.email
        )?.videos?.filter((vid) => vid.status === "active")?.map(vid => {
          const v = { ...vid, campaignId: c.id }
          return v
        })
        if (t)
          userVideos = userVideos.concat(t)
      })

      userVideos.forEach(vid => {
        if (vid.create_time < (Date.now() / 1000) - (60 * 60 * 24 * 14)) {
          vid.status = "ended"
        }
      })

      console.log('--> getting data for', user.email, "videos", userVideos.length)

      const updateUser = await (await fetch('https://campay-api.vercel.app/api/refresh_token?email=' + user?.email + '&refresh_token=' + user?.tiktokToken.refresh_token)).json()
      const createResponse = await fetch('https://open.tiktokapis.com/v2/video/query/?fields=id,title,video_description,duration,cover_image_url,embed_link,view_count,like_count,comment_count,share_count,create_time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + updateUser?.tiktokToken.access_token
        },
        body: JSON.stringify({ "filters": { "video_ids": userVideos.filter(v => v.status === "active").map(v => v.id) } })
      });
      const response = await createResponse.json()
      const UpdatedVideos = response.data.videos;

      console.log('--> setting data for', user.email, "videos", userVideos.length)

      userVideos.forEach((uv) => {
        if (uv.status !== "active") return

        let temp = campaigns.find(c => c.id === uv.campaignId).evolution.participatingCreators.find(
          pc => pc.creator.email === user.email
        )?.videos?.find((vid) => vid.id === uv.id)
        if (temp && UpdatedVideos.find(upV => upV.id === uv.id))
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
      //await wait(10)
      console.log(" ---- Save USER ----- ")
      await updateDoc('users', user.id, user)

    } catch (error) {
      console.error('Erreur récupération compte Tiktok:', user.email, error);
    }
  }

  console.log('--> Saving data in database')
  for (let i = 0; i < campaigns.length; i++) {
    let campaign = campaigns[i]
    await updateDoc('campaigns', campaign.id, campaign)
  }
  console.groupEnd()
};





