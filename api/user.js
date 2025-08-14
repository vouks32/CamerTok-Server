import { addDoc, getDoc, getDocs, updateDoc } from '../localDatabase.js';
import e from 'express';
import cors from "cors";
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import Tiktok from '@tobyg74/tiktok-api-dl'
import multer from 'multer';
import fs from 'fs'

// server.js
import { WebSocketServer } from 'ws';
import axios from 'axios';



const CLIENT_KEY = 'sbawichfdxmm1wsd4z';
const CLIENT_SECRET = 'AjwK8nzMegJOzmBZ7zg7zpUuO1NMZesw';
const REDIRECT_URI = 'https://2xabba4k40yp.share.zrok.io/api/webhook'


let wss;
const clients = new Set(); // Stocke tous les clients connectés


const defineWebSocket = () => {
  wss = new WebSocketServer({ port: 8080 });
  wss.on('connection', (ws) => {
    console.log('Client connected');
    clients.add(ws); // Ajoute le nouveau client

    // Envoi périodique de données
    /*const interval = setInterval(() => {
      sendToAllClients({
        type: "alive"
      });
    }, 10000);*/

    ws.on('close', () => {
      console.log('Client disconnected');
      clients.delete(ws); // Retire le client déconnecté
      //clearInterval(interval);
    });
  });

  console.log('WebSocket server running on ws://localhost:8080');

}

// Fonction pour envoyer à tous les clients
function sendToAllClients(data) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Exemple: Envoyer un message depuis une autre fonction/partie du code
function sendSocketData(type, message = "", value = -1) {
  sendToAllClients({
    type: type,
    timestamp: Date.now(),
    message: message,
    value: value
  });
}

const wsHelper = {
  sendToAll: (data) => {
    const message = JSON.stringify(data);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  },
  sendData: (type, message = "", value = -1) => {
    wsHelper.sendToAll({
      type,
      timestamp: Date.now(),
      message,
      value
    });
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const api = e();
api.use(cors());
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
    //// FAIRE DES TRUCS ////

    if(playerData)
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
    const userPosts = {status : "failed"} //await Tiktok.GetUserPosts(username)
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

// Ensure uploads folder exists
const UPLOAD_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Configure storage with multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const campaignFolder = path.join(UPLOAD_DIR, req.query.campaignid);
    if (!fs.existsSync(campaignFolder)) fs.mkdirSync(campaignFolder, { recursive: true });
    cb(null, campaignFolder);
  },
  filename: function (req, file, cb) {
    // Keep original filename but prefix with timestamp to avoid collisions
    const safeName = file.originalname.replace(/\s+/g, "_");
    //cb(null, `${Date.now()}-${safeName}`);
    cb(null, file.originalname);
  },
});

// Accept multiple files under the field name 'files'
const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1 GB limit (adjust to your needs)
  },
}).array("files", 20); // accept up to 20 files per request

api.post("/api/campaigns/files", (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      console.error("Upload error:", err);
      return res.status(500).json({ ok: false, error: err.message });
    }
    console.log('file uploaded ->', req.files[0].filename)

    // req.files is an array with file info saved locally
    const saved = (req.files || []).map((f) => ({
      originalname: f.originalname,
      filename: f.filename,
      path: f.path,
      size: f.size,
    }));
    res.json({ ok: true, files: saved });
  });
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

// Récupération des données de la campagne
api.get("/api/campaigndocs/:campaignid/:filename", async (req, res) => {
  try {
    const { campaignid, filename } = req.params;
    const campaignFolder = path.join(UPLOAD_DIR, campaignid);
    const filepath = path.join(campaignFolder, filename);

    if (!fs.existsSync(filepath)) {
      console.log('fichier NON trouvé', filename);
      return res.status(404).json({ error: 'fichier non trouvé' });
    }

    console.log('fichier trouvé', filename);
    res.sendFile(filepath)
  } catch (error) {
    console.error('Erreur récupération du fiechier:', req.query, error);
    res.status(500).json({ error: 'Échec récupération fichier' });
  }
});

api.get("/api/auth", async (req, res) => {
  const { email } = req.query
  const csrfState = Math.random().toString(36).substring(2);
  res.cookie('csrfState', csrfState, { maxAge: 60000 });

  let url = 'https://www.tiktok.com/v2/auth/authorize/';

  // the following params need to be in `application/x-www-form-urlencoded` format.
  url += '?client_key=' + CLIENT_KEY;
  url += '&scope=user.info.basic,video.list,user.info.profile,user.info.stats';
  url += '&response_type=code';
  url += '&redirect_uri=' + REDIRECT_URI;
  url += '&state=' + csrfState + "--" + email;

  console.log("redirecting to", url)
  res.redirect(url);

});

// Récupération des données de la campagne
api.get("/api/webhook", async (req, res) => {
  const { code, scopes, state, error, error_description } = req.params;
  try {

    if (error) {
      console.log(error, error_description)
      return
    }
    if (code) {
      const tiktokAuthCode = { scopes, state }
      const userMail = state.split('--')[1]
      console.log(code, state)

      updateDoc('users', userMail, { tiktokAuthCode })

      const tokenResponse = await axios.post(
        discovery.tokenEndpoint,
        {
          client_key: CLIENT_KEY,
          client_secret: CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: REDIRECT_URI,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            "skip_zrok_interstitial": "true"
          },
        }
      );

      const Tresponse = tokenResponse.data;
      if (!Tresponse.error) {
        updateDoc('users', userMail, { ...Tresponse, date: Math.round(Date.now() / 1000) })
      } else {
        console.log(Tresponse.error, Tresponse.error_description)
        return
      }

    }
  } catch (error) {
    console.error('Erreur récupération du fiechier:', req.query, error);
    res.status(500).json({ error: 'Échec récupération fichier' });
  }
});


export { api, GetTiktokInfo, GetPostsStats, defineWebSocket }



